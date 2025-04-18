const BusinessDA = require("../../data/BusinessDA");
const LogErrorDA = require("../../data/LogErrorDA");
const WalletDA = require('../../data/WalletDA');
const WalletHelper = require("./WalletHelper");
const broker = require('../../tools/broker/BrokerFactory')();
const SpendingRulesDA = require('../../data/SpendingRulesDA');
const WalletTransactionsDA = require('../../data/WalletTransactionDA');
const { mergeMap, catchError, map, defaultIfEmpty, first, tap, delay, filter, toArray, groupBy, debounceTime} = require('rxjs/operators');
const  { forkJoin, of, interval, from, throwError, concat, Observable, Subject } = require('rxjs');
const uuidv4 = require("uuid/v4");
const [ MAIN_POCKET, BONUS_POCKET, CREDIT_POCKET ]  = [ 'MAIN', 'BONUS', "CREDIT" ];
const Crosscutting = require("../../tools/Crosscutting");
const eventSourcing = require("../../tools/EventSourcing")();
const Event = require("@nebulae/event-store").Event;
const mongoDB = require('../../data/MongoDB').singleton();

const MATERIALIZED_VIEW_TOPIC = "emi-gateway-materialized-view-updates";
const CLIENT_GATEWAY_MATERIALIZED_VIEW_TOPIC = "client-gateway-materialized-view-updates";
const transactionCache = {

}

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
      groupBy(walletId => walletId),
      mergeMap(group$ => group$.pipe(debounceTime(5000))),
      mergeMap(walletId => this.sendWalletPocketUpdatedEvent$(walletId))
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
  sendWalletPocketUpdatedEvent$(walletId) {
    return WalletDA.getWalletById$(walletId)
      .pipe(
        mergeMap(wallet => forkJoin(
          broker.send$(MATERIALIZED_VIEW_TOPIC, 'walletPocketUpdated', wallet),
          broker.send$(CLIENT_GATEWAY_MATERIALIZED_VIEW_TOPIC, 'walletPocketUpdated', wallet),
          eventSourcing.eventStore.emitEvent$(
            new Event({
              eventType: 'WalletUpdated',
              eventTypeVersion: 1,
              aggregateType: "Wallet",
              aggregateId: walletId,
              data: wallet,
              user: 'SYSTEM'
            })
          )
        )),
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
  
  handleWalletSpendingCommited$({aid, data}){
    // console.log("handleWalletSpendingCommited$", data);
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
            user: 'SYSTEM',
            timestamp: Date.now()
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
        mergeMap(selectedPocket => of({ wallet, spendingRule, selectedPocket }))
      )
  }

  /**
   * Takes the wallet deposit commited events, generates the corresponding transactions and emits an walletTransactionExecuted
   * 
   * @param {*} walletDepositCommitedEvent 
   */
  handleWalletDepositCommited$({aid, data, user}){
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
            user: 'SYSTEM',
            timestamp: Date.now()
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
  handleWalletTransactionExecuted$({aid, user, data}){
    // console.log('handleWalletTransactionExecuted => ', {aid, user, data} );
    return WalletDA.updateAmount$(data.walletId, 'main', data.amount)
    .pipe(
      mergeMap(walletPrev => WalletTransactionsDA.saveTransactionHistory$(data, (walletPrev ||{}).value)),
      tap(() => {
        // console.log('Enviando la actualizacion de billetera, ', data.walletId);
        this.walletPocketUpdatedEventEmitter$.next(data.walletId)
      })
    );
  }

/**
 * Creates the indexes for the tables history
 * @param {*} indexesWallet 
 */
  createIndexesWallet$(indexesWallet){
    const indexes = [{
      collection: 'Transactions', 
      fields: {type: 1, concept: 1, timestamp: 1 }
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

  addElelemtToCache(arr, element){
    const MAX_SIZE = 1000;
    arr.push(element);           
    if (arr.length > MAX_SIZE) {
      arr.shift();
    }
    
  }

  handleWalletTransactionCommited$({ aid, av, data, user }) {
    const arrCache = transactionCache[data.businessId] || [];
    if(!arrCache.some(a => a == aid)){
      this.addElelemtToCache(arrCache,aid);
      transactionCache[data.businessId] = arrCache;
      console.log("cacheLength ==> ",arrCache.length);
      if (data.concept === "APP_DRIVER_AGREEMENT_PAYMENT") {
        if(data.businessId == "7d95f8ef-4c54-466a-8af9-6dd197dd920a"){
          return of({});
        }
        if(data.driverToDriver){
          return of({}).pipe(
            map(() => {
              const movements =[
                {
                  _id: Crosscutting.generateDateBasedUuid(),
                  businessId: data.businessId,
                  walletId: data.fromId,
                  amount: data.amount * -1,
                  type: data.type,
                  sourceEvent: {aid, av},
                  concept: "DRIVER_PAYMENT_FOR_APP_CLIENT_SERVICE",
                  timestamp: Date.now(),
                  notes: data.notes,
                  pocket: 'MAIN',
                  user
                },
                {
                  _id: Crosscutting.generateDateBasedUuid(),
                  businessId: data.businessId,
                  walletId: data.toId,
                  amount: data.amount,
                  type: data.type,
                  sourceEvent: {aid, av},
                  concept: data.concept,
                  timestamp: Date.now(),
                  notes: data.notes,
                  pocket: 'MAIN',
                  user
                }
              ];
              return movements;
            }),
            mergeMap(txs => from(txs)
                .pipe(
                  mergeMap(tx => eventSourcing.eventStore.emitEvent$(
                    new Event({
                      eventType: 'WalletTransactionExecuted',
                      eventTypeVersion: 1,
                      aggregateType: "Wallet",
                      aggregateId: tx.walletId,
                      data: tx,
                      user: user,
                      timestamp: Date.now()
                    })
                  )),
                  toArray()
                )
              )
          )
        }else {
          return of({}).pipe(
            map(() => {
              const clientValue = data.businessId == "7d95f8ef-4c54-466a-8af9-6dd197dd920a" ? 0 : parseInt((process.env.APP_CLIENT_AGREEMENT || "500"));
              const driverValue = data.businessId == "7d95f8ef-4c54-466a-8af9-6dd197dd920a" ? data.amount * 0.2 : parseInt((process.env.APP_DRIVER_AGREEMENT || "200"));
              if(data.businessId == "7d95f8ef-4c54-466a-8af9-6dd197dd920a"){
                data.clientId = undefined
              }
              const businessValue = data.amount- clientValue - (data.referrerDriverId ? driverValue : 0);
              const movements =[
                {
                  _id: Crosscutting.generateDateBasedUuid(),
                  businessId: data.businessId,
                  walletId: data.fromId,
                  amount: data.amount * -1,
                  type: data.type,
                  sourceEvent: {aid, av},
                  concept: "DRIVER_PAYMENT_FOR_APP_CLIENT_SERVICE",
                  timestamp: Date.now(),
                  notes: data.notes,
                  pocket: 'MAIN',
                  user
                },
                {
                  _id: Crosscutting.generateDateBasedUuid(),
                  businessId: data.businessId,
                  walletId: data.toId,
                  amount: data.clientId ? businessValue : data.amount,
                  type: data.type,
                  sourceEvent: {aid, av},
                  concept: data.concept,
                  timestamp: Date.now(),
                  notes: data.notes,
                  pocket: 'MAIN',
                  user
                }
              ];
              if(data.clientId){
                movements.push({
                  _id: Crosscutting.generateDateBasedUuid(),
                  businessId: data.businessId,
                  walletId: data.clientId,
                  amount: clientValue,
                  type: data.type,
                  sourceEvent: {aid, av},
                  concept: data.concept,
                  timestamp: Date.now(),
                  notes: data.notes,
                  pocket: 'MAIN',
                  user
                });
              }
              if(data.referrerDriverId){
                movements.push({
                  _id: Crosscutting.generateDateBasedUuid(),
                  businessId: data.businessId,
                  walletId: data.referrerDriverId,
                  amount: driverValue,
                  type: data.type,
                  sourceEvent: {aid, av},
                  concept: data.concept,
                  timestamp: Date.now(),
                  notes: data.notes,
                  pocket: 'MAIN',
                  user
                })
              }
              
              return movements.map(movement => {
                return ({...movement,associatedTransactionIds: movements.filter(m => m._id !== movement._id).map(mov => mov._id)
                 })
              });
            }),
            mergeMap(txs => from(txs)
                .pipe(
                  mergeMap(tx => eventSourcing.eventStore.emitEvent$(
                    new Event({
                      eventType: 'WalletTransactionExecuted',
                      eventTypeVersion: 1,
                      aggregateType: "Wallet",
                      aggregateId: tx.walletId,
                      data: tx,
                      user: user,
                      timestamp: Date.now()
                    })
                  )),
                  toArray()
                )
              )
            
          )
        }
        ;
      } else { 
        return of({})
          .pipe(
            map(() => ([
              {
                _id: Crosscutting.generateDateBasedUuid(),
                businessId: data.businessId,
                sourceEvent: {aid, av},
                walletId: data.fromId,
                amount: data.amount * -1,
                type: data.type,
                plate: data.plate,
                concept: data.concept,
                timestamp: Date.now(),
                notes: data.notes,
                pocket: 'MAIN',
                user
              },
              {
                _id: Crosscutting.generateDateBasedUuid(),
                businessId: data.businessId,
                walletId: data.toId,
                sourceEvent: {aid, av},
                amount: data.amount,
                type: data.type,
                plate: data.plate,
                concept: data.concept,
                timestamp: Date.now(),
                notes: data.notes,
                pocket: 'MAIN',
                user
              }
            ])),
            //  Fill the asociated transactions
            map(txs => ([
              { ...txs[0], associatedTransactionIds: [txs[1]._id] },
              { ...txs[1], associatedTransactionIds: [txs[0]._id] },
            ])),
            mergeMap(txs => from(txs)
              .pipe(
                mergeMap(tx => eventSourcing.eventStore.emitEvent$(
                  new Event({
                    eventType: 'WalletTransactionExecuted',
                    eventTypeVersion: 1,
                    aggregateType: "Wallet",
                    aggregateId: tx.walletId,
                    data: tx,
                    user: user,
                    timestamp: Date.now()
                  })
                )),
                toArray()
              )
            )
          )
      }
    }
    else{
      return of({});
    }
    
    // console.log("handleWalletTransactionCommited$", aid, data, user);

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
