const BusinessDA = require("../../data/BusinessDA");
const LogErrorDA = require("../../data/LogErrorDA");
const WalletDA = require('../../data/WalletDA');
const WalletHelper = require("./WalletHelper");
const broker = require('../../tools/broker/BrokerFactory')();
const SpendingRulesDA = require('../../data/SpendingRulesDA');
const { mergeMap, catchError, map, defaultIfEmpty, first, tap, filter, toArray, groupBy, debounceTime} = require('rxjs/operators');
const  { forkJoin, of, interval, from, throwError, concat, Observable, Subject } = require('rxjs');
const uuidv4 = require("uuid/v4");
const [ MAIN_POCKET, BONUS_POCKET, CREDIT_POCKET ]  = [ 'MAIN', 'BONUS', "CREDIT" ];
const Crosscutting = require("../../tools/Crosscutting");
const eventSourcing = require("../../tools/EventSourcing")();
const Event = require("@nebulae/event-store").Event;
const mongoDB = require('../../data/MongoDB').singleton();

const MATERIALIZED_VIEW_TOPIC = "emi-gateway-materialized-view-updates";

let instance;

class WalletES {
  constructor() {
    this.walletPocketUpdatedEventEmitter$ = new Subject();
    this.buildWalletEmissor();
  }

  /**
   * Defines when a wallet event must be emitted
   */
  buildWalletEmissor(){
    this.walletPocketUpdatedEventEmitter$
    .pipe(
      groupBy(business => business._id),
      mergeMap(group$ => group$.pipe(debounceTime(5000))),
      mergeMap(business => this.sendWalletPocketUpdatedEvent$(business))
    )
    .subscribe(
      (result) => {},
      (err) => { console.log(err) },
      () => { }
    );
  }

    /**
   * Sends an event with the wallet info associated with the indicated business.
   * @param {*} business 
   */
  sendWalletPocketUpdatedEvent$(business){
    return of(business)
    .pipe(
      mergeMap(business => WalletDA.getWallet$(business._id)),
      mergeMap(wallet => {
        return of(wallet)
        .pipe(
          mergeMap(wallet => broker.send$(MATERIALIZED_VIEW_TOPIC, 'walletPocketUpdated', wallet)),
          mergeMap(res => {
            return eventSourcing.eventStore.emitEvent$(
              new Event({
                eventType: 'WalletPocketUpdated',
                eventTypeVersion: 1,
                aggregateType: "Wallet",
                aggregateId: wallet._id,
                data: wallet,
                user: 'SYSTEM'
              })
            );
          })
        )
      })
    );
  }


  /**
   * Receives a business created event and create a wallet for the business
   * @param {*} businessCreated Business created event
   */
  handleBusinessCreated$(businessCreatedEvent) {
    return of(businessCreatedEvent.data) 
    .pipe(
      map(businessCreated => {
        return {
          businessId: businessCreated._id,
          businessName: businessCreated.generalInfo.name,
          spendingState: 'FORBIDDEN',
          pockets: {
            main: 0,
            bonus: 0
          }
        }
      }),
      // Create a new wallet fro the business created
      mergeMap(wallet => WalletDA.createWallet$(wallet)),
      //Throws a wallet spending alarm according to the wallet spending state
      mergeMap(wallet => WalletHelper.throwAlarm$(wallet))
    )
  }

  /**
   * Receives a business created event and create a wallet for the business
   * @param {*} businessCreated Business created event
   */
  handleBusinessGeneralInfoUpdated$(businessGeneralInfoUpdatedEvent) {
    return of(businessGeneralInfoUpdatedEvent) 
    .pipe(
      mergeMap(businessGeneralInfoUpdatedEvent => WalletDA
        .updateWalletBusinessName$(businessGeneralInfoUpdatedEvent.aid, businessGeneralInfoUpdatedEvent.data.name)
      )
    );
  }
  
  handleWalletSpendingCommited$(evt){
    console.log("handleWalletSpendingCommited$", evt);
    return of(evt.data)
    .pipe(
      mergeMap(eventData => forkJoin(
        // search the wallet for business unit
        WalletDA.getWallet$(eventData.businessId),
        // Search the spendingRule for business unit
        SpendingRulesDA.getSpendingRule$(eventData.businessId)
      )),
      // selects the pocket to use and returns => { wallet, spendingRule, selectedPocket }
      mergeMap(([wallet, spendingRule]) => this.selectPockect$(wallet, spendingRule, evt.data.value)),
      // selects the according productBonusConfig returns => { wallet, productBonusConfig, selectedPocket }
      map(result => ({...result, spendingRule: result.spendingRule.productBonusConfigs.find(e => (e.type == evt.data.type && e.concept == evt.data.concept)) })),      
      mergeMap(result => this.calculateTransactionsToExecute$(evt, result)),
      // tap(r => console.log("PARA PROCESAR", JSON.stringify(r))),
      map(tx => ({
        wallet: tx.wallet,
        transaction: this.createWalletTransactionExecuted(
          tx.transaction.businessId,
          tx.transaction.type,
          tx.transaction.concept,
          ...tx.transaction.transactions
        )
      })),
      mergeMap(tx =>
        eventSourcing.eventStore.emitEvent$(
          new Event({
            eventType: "WalletTransactionExecuted",
            eventTypeVersion: 1,
            aggregateType: "Wallet",
            aggregateId: tx.wallet._id,
            data: tx.transaction,
            user: 'SYSTEM'
          })
        )
      ),
      catchError(error => {
        console.log(`An error was generated while a walletSpendingCommitedEvent was being processed: ${error.stack}`);
        return this.errorHandler$(evt, error.stack, 'walletSpendingCommitedEvent');
      })
    )
  }
/**
 * 
 * @param {any} evt WalletSpendingCommited Event
 * @param {Object} result Transaction object
 * @param {Object} result.wallet business unitWallet
 * @param {Object} result.wallet.pockets business unit pockets in wallet
 * @param {number} result.wallet.pockets.main main amount in wallet
 * @param {number} result.wallet.pockets.bonus bonus amount in wallet
 * @param {Object} result.productBonusConfig productBonus configuration
 * @param {string} result.productBonusConfig.bonusType bonustype
 * @param {number} result.productBonusConfig.bonusValueByMain BonusValueByMain
 * @param {number} result.productBonusConfig.bonusValueByCredit BonusValueByCredit
 * @param {string} result.selectedPocket selected pocket to use 
 * 
 */
  calculateTransactionsToExecute$(evt, result) {
    // console.log("calculateTransactionsToExecute$");
    const date = new Date();
    return of({
      businessId: evt.data.businessId,
      type: evt.data.type,
      concept: evt.data.concept
    })
      .pipe(
        mergeMap(tx => forkJoin(
          of(tx),
          this.calculateMainTransaction$(evt, result, date ),
          this.calculateBonusTransaction$(evt, result, date)
        )),
        mergeMap(([basicObj, mainTx, bonusTx]) => {          
          if(bonusTx){
            bonusTx.associatedTransactionIds.push(mainTx.id);
            mainTx.associatedTransactionIds.push(bonusTx.id);
          }
          return of({ ...basicObj, transactions: [mainTx, bonusTx].filter(e => e != null ) })       
        }),
        // tap(({transactions}) => {
        //   transactions.forEach(tx => console.log('TX => ',tx))
        // } ),
        map(tx => ({transaction: tx, wallet: result.wallet}) )  
      )
  }

  /**
   * 
   * @param {any} evt WalletSpendingCommited Event
   * @param {String} result todo
   */
  calculateMainTransaction$(evt, result, now) {
    return of(Crosscutting.generateHistoricalUuid(now))
      .pipe(
        map(() => ({
          id: Crosscutting.generateHistoricalUuid(now),
          pocket: result.selectedPocket,
          value: evt.data.value * -1,
          user: evt.user,
          location: evt.data.location,
          notes: evt.data.notes,
          terminal: evt.data.terminal,
          associatedTransactionIds: []
        })
        ),
        mergeMap(transaction => forkJoin(
          of(transaction),
          of(transaction.pocket.toString().toLowerCase())
          .pipe(
            map(selectedPocket => selectedPocket == BONUS_POCKET.toLowerCase()
            ? BONUS_POCKET
            : result.wallet.pockets.main >= evt.data.value ? MAIN_POCKET : CREDIT_POCKET
            )             
          )
        )),
        map(([transaction, pocketAlias]) => ({...transaction, pocketAlias: pocketAlias })  )
      )
  }

  /**
   * 
   * @param {any} evt WalletSpendingCommited Event
   * @param {Object} result Transaction object
   * @param {Object} result.wallet business unitWallet
   * @param {Object} result.wallet.pockets business unit pockets in wallet
   * @param {number} result.wallet.pockets.main main amount in wallet
   * @param {number} result.wallet.pockets.bonus bonus amount in wallet
   * @param {Object} result.productBonusConfig productBonus configuration
   * @param {string} result.productBonusConfig.bonusType bonustype
   * @param {number} result.productBonusConfig.bonusValueByMain BonusValueByMain
   * @param {number} result.productBonusConfig.bonusValueByCredit BonusValueByCredit
   * @param {string} result.selectedPocket selected pocket to use 
   */
  calculateBonusTransaction$(evt, result, now) {
    // console.log("calculateBonusTransaction$", result.selectedPocket);
    return of({ evt, result })
      .pipe(
        mergeMap(() => {
          return (result.selectedPocket != MAIN_POCKET || !result.spendingRule )
            ? of(null)
            : of({}).
              pipe(
                map(() => ({ // create the basic info for transaction
                  id: Crosscutting.generateHistoricalUuid(now),
                  pocket: BONUS_POCKET,
                  value: 0,
                  user: evt.user,
                  location: evt.data.location,
                  notes: evt.data.notes,
                  terminal: evt.data.terminal,
                })),
                mergeMap( tx =>
                  forkJoin( 
                    of(tx), // keeps the basic transaction data 
                    of({    // calculate the transaction amount
                      txAmount: evt.data.value,
                      spendingRule: result.spendingRule,
                      wallet: result.wallet,
                      pocket: result.selectedPocket
                    })
                      .pipe(
                        map(data => {
                          return (data.spendingRule.bonusType == "FIXED")
                            ? (data.wallet.pockets.main >= data.txAmount)
                              ? data.spendingRule.bonusValueByMain
                              : data.spendingRule.bonusValueByCredit
                            : (data.wallet.pockets.main >= data.txAmount)
                              ? (data.txAmount * data.spendingRule.bonusValueByMain) / 100
                              : (data.txAmount * data.spendingRule.bonusValueByCredit) / 100
                        }),
                        map(amount => ((amount * 1000) / 1000 ).toString()),
                        map( amountAsString  => {
                          const decimals = 2;
                          return (amountAsString.indexOf('.') !== -1 &&  ( amountAsString.length - amountAsString.indexOf('.') > decimals + 1 ) )
                            ? Math.floor(parseFloat(amountAsString) * Math.pow(10, decimals)) / Math.pow(10, decimals)
                            : parseFloat(amountAsString);
                        })
                      )
                  )          
                ),
                mergeMap(([transaction, transactionValue]) => of({ ...transaction, value: transactionValue, associatedTransactionIds: [] })),
                map(tx => (tx.value == 0) ? null : tx)
              )
        })        
      );
  }
 

  /**
   * 
   * @param {any} wallet business unit Wallet 
   * @param {any} spendingRule Business spending rules
   * @param {number} transactionAmount Transaction amount
   */
  selectPockect$(wallet, spendingRule, transactionAmount) {
    return of(spendingRule.autoPocketSelectionRules)
      .pipe(
        map(rules => rules.sort((a, b) => a.priority - b.priority)),
        mergeMap(rules => 
          from(rules)
          .pipe(
            filter(pocketSelectionRule => {
            if (
              (pocketSelectionRule.condition.pocket != MAIN_POCKET && pocketSelectionRule.condition.pocket != BONUS_POCKET)
              || (pocketSelectionRule.condition.comparator != 'ENOUGH' && !pocketSelectionRule.condition.value)) {
              return throwError('Error ')
            }

            let condition = false;

            switch (pocketSelectionRule.condition.comparator) {
              case 'GT':     
                condition = wallet.pockets[pocketSelectionRule.condition.pocket.toLowerCase()] > pocketSelectionRule.condition.value;
                break;
              case 'GTE':    
                condition = wallet.pockets[pocketSelectionRule.condition.pocket.toLowerCase()] >= pocketSelectionRule.condition.value;
                break;
              case 'LT':     
                condition = wallet.pockets[pocketSelectionRule.condition.pocket.toLowerCase()] < pocketSelectionRule.condition.value;
                break;
              case 'LTE':    
                condition = wallet.pockets[pocketSelectionRule.condition.pocket.toLowerCase()] <= pocketSelectionRule.condition.value
                break;
              case 'ENOUGH': 
                condition = wallet.pockets[pocketSelectionRule.condition.pocket.toLowerCase()] > transactionAmount;
                break;
              //INSUFICIENT
              case 'INS':    
                condition = wallet.pockets[pocketSelectionRule.condition.pocket.toLowerCase()] < transactionAmount;
                break;
              default:       
                throw new Error('Invalid comparator');
            }

            return (condition && wallet.pockets[pocketSelectionRule.pocketToUse.toLowerCase()] >= transactionAmount);

            }),
            defaultIfEmpty({ pocketToUse: MAIN_POCKET }),
            first()
          )  
        ),
        map(({pocketToUse}) =>  pocketToUse),
        map(selectedPocket => {
          return (
            (wallet.pockets[selectedPocket.toLowerCase()] >= transactionAmount))
            ? selectedPocket
            : (selectedPocket == MAIN_POCKET && wallet.pockets.main < transactionAmount && wallet.pockets.bonus >= transactionAmount )
              ? BONUS_POCKET
              : MAIN_POCKET
        }),
        // tap(sp => console.log("#### SELECTED POCKET ", sp, " for ", transactionAmount)),
        mergeMap(selectedPocket => of({ wallet, spendingRule, selectedPocket }))
      )
  }

  /**
   * Takes the wallet deposit commited events, generates the corresponding transactions and emits an walletTransactionExecuted
   * 
   * @param {*} walletDepositCommitedEvent 
   */
  handleWalletDepositCommited$(walletDepositCommitedEvent){
    return of(walletDepositCommitedEvent)
    .pipe(
      //Create wallet execute transaction
      map(({data, user}) => {
        const uuId = Crosscutting.generateHistoricalUuid(new Date());
        const transaction = {
            id: uuId,
            pocket: MAIN_POCKET,
            value: data.value,
            notes: data.notes,
            location: data.location,
            user
        };
        return this.createWalletTransactionExecuted(data.businessId, data.type, data.concept, transaction);
      }),
      //Get wallet of the implied business
      mergeMap(walletTransactionExecuted => WalletDA.getWallet$(walletTransactionExecuted.businessId)
      .pipe(map(wallet => [wallet, walletTransactionExecuted]))),
      //Emit the wallet transaction executed
      mergeMap(([wallet, walletTransactionExecuted]) => {           
        return eventSourcing.eventStore.emitEvent$(
          new Event({
            eventType: 'WalletTransactionExecuted',
            eventTypeVersion: 1,
            aggregateType: "Wallet",
            aggregateId: wallet._id,
            data: walletTransactionExecuted,
            user: 'SYSTEM'
          })
        );
      }),
      catchError(error => {
        console.log(`An error was generated while a walletDepositCommitedEvent was being processed: ${error.stack}`);
        return this.errorHandler$(walletDepositCommitedEvent, error.stack, 'walletDepositCommitedEvent');
      })
    )
  }

  /**
   * Creates a wallet transaction executed event
   * @param {string} businessId ID of the business implied in the wallet deposit.
   * @param {string} transactionType Transaction type (E.g SALE, PAYMENT, ...)
   * @param {string} transactionConcept Transaction concept (E.g CIVICARECARGA, ...)
   * @param {Object[]} transactions Transaction object
   * @param {string} transactions[].id Transaction ID
   * @param {string} transactions[].pocket Pocket where the transaction will be applied
   * @param {number} transactions[].value Value that will be increment or decrement in the pocket indicated in the transaction
   * @param {string} transactions[].user User that performed the operation that caused this transaction.
   * @param {GeoJSON} [transactions[].location] Location object
   * @param {GeoJSON} [transactions[].location.geojson] GeoJSON object
   * @param {string} [transactions[].location.geojson.type] GeoJSON type (E.g Point, LineString, ...)
   * @param {number[]} [transactions[].location.geojson.coordinates] Coordinates given according to the used geojson type
   * @param {string} [transactions[].notes] Additional data related with the transaction
   * @param {string} [transactions[].terminal] Terminal object (info which refers to the terminal where the transaction was performed)
   * @param {string} [transactions[].terminal.id] Terminal ID
   * @param {string} [transactions[].terminal.userId] Terminal user ID
   * @param {string} [transactions[].terminal.username] Terminal username
   * @param {string[]} [transactions[].associatedTransactionIds] Id that refers to the transactions related with this one.
   */
  createWalletTransactionExecuted(businessId, transactionType, transactionConcept, ...transactions){
    return {
      businessId,
      transactionType,
      transactionConcept,
      transactions: transactions
    }
  }

    /**
   * Takes the wallet transaction executed events and performs three operations:
   * 1. persists transactions in a transaction history collection.   
   * 2. Applies increments and decrements over the implied pockets
   * 3. Checks pockets of the business to see if an alarm should be generated (WalletSpendingAllowed, WalletSpendingForbidden).
   * 
   * These operations are done in the above order to avoid problems in case that an error occurred. 
   * Therefore if an error ocurred the wallet of the implied business will not be updated and the error will be recorded.
   * 
   * @param {*} walletTransactionExecuted wallet transaction executed event
   */
  handleWalletTransactionExecuted$(walletTransactionExecuted){
    // console.log('handleWalletTransactionExecuted => ', JSON.stringify(walletTransactionExecuted));
    return of(walletTransactionExecuted)
    .pipe(
      //Check if there are transactions to be processed
      filter(event => event.data.transactions && event.data.transactions.length > 0),
      //Get the business implied in the transactions
      mergeMap(event => 
        BusinessDA.getBusiness$(event.data.businessId)
        .pipe(
          map(business => ([event, business]))
        )
      ),
      mergeMap(([event, business]) => concat(
        of(business),
        WalletHelper.saveTransactions$(event),
        WalletHelper.applyTransactionsOnWallet$(event, business),
        WalletHelper.checkWalletSpendingAlarms$(business._id),
      )),
      toArray(),
      tap(res => {
        //console.log('handleWalletTransactionExecuted => ', res[0])
        this.walletPocketUpdatedEventEmitter$.next(res[0])
      }),
      catchError(error => {
        console.log(`An error was generated while a walletTransactionExecuted was being processed: ${error.stack}`);
        return this.errorHandler$(walletTransactionExecuted, error.stack, 'walletTransactionExecuted');
      })
    );
  }

/**
 * Creates the indexes for the tables history
 * @param {*} indexesWallet 
 */
  createIndexesWallet$(indexesWallet){
    const indexes = [{
      collection: 'TransactionsHistory_', 
      fields: {type: 1, concept: 1, timestamp: 1, 'terminal.id': 1, 'terminal.userId': 1, 'terminal.username': 1}
    }];
    return from(indexes)
    .pipe(
      //Get the business implied in the transactions
      mergeMap(index =>  {
        index.collection = index.collection+Crosscutting.getMonthYear(new Date());
        return mongoDB.createIndexBackground$(index);
      })
    );
  }

  /**
   * Handles and persist the errors generated.
   * @param {*} error Error stack   
   * @param {*} event settlementJobTriggered event
   * @param {*} errorType Error type (walletTransactionExecuted, walletDepositCommitedEvent, ...)
   */
  errorHandler$(event, error, errorType) {
    return of({ error, type: errorType, event }).pipe(
      mergeMap(log =>
        LogErrorDA.persistLogError$(log)
      )
    );
  }
}

/**
 * Wallet ES consumer
 * @returns {WalletES}
 */
module.exports = () => {
  if (!instance) {
    instance = new WalletES();
    console.log("WalletES Singleton created");
  }
  return instance;
};
