const { mergeMap, catchError, map, toArray, tap, reduce } = require('rxjs/operators');
const { of, throwError, from, forkJoin } = require('rxjs');
const broker = require("../../tools/broker/BrokerFactory")();
const eventSourcing = require("../../tools/EventSourcing")();
const Event = require("@nebulae/event-store").Event;
const MATERIALIZED_VIEW_TOPIC = "emi-gateway-materialized-view-updates";
const uuidv4 = require("uuid/v4");
const WalletDA = require("../../data/WalletDA");
const WalletTransactionDA = require("../../data/WalletTransactionDA");
const RoleValidator = require("../../tools/RoleValidator");
const { CustomError, DefaultError } = require("../../tools/customError");
const walletDA = require("../../data/WalletDA");
const {
  PERMISSION_DENIED_ERROR,
  INTERNAL_SERVER_ERROR,
  DRIVER_ID_NO_FOUND_IN_TOKEN,
  NO_WALLET_ID_IN_AUTH_TOKEN,
  MISSING_TRANSACTIONS_TO_REVERT,
  TRANSACTION_NO_FOUND,
  TRANSACTION_ALREADY_REVERTED,
  INSUFFICIENT_BALANCE
} = require("../../tools/ErrorCodes");
const context = "wallet";

let instance;

class WalletCQRS {
  constructor() {}
   /**
   * Gets the business where the user that is performing the request belong
   *
   * @param {*} args args
   * @param {*} args.businessId business ID
   */
  getWalletsByFilter$({ args }, authToken) {
    return RoleValidator.checkPermissions$(
      authToken.realm_access.roles,
      "wallet",
      "getWalletsByFilter$",
      PERMISSION_DENIED_ERROR,
      ["PLATFORM-ADMIN", "BUSINESS-OWNER"]
      ).pipe(
          mergeMap(() => walletDA.getFilteredWallets$(args.filterText, args.businessId, args.limit)),
          mergeMap(rawResponse => this.buildSuccessResponse$(rawResponse)),
          catchError(err => this.handleError$(err))
      );
  }

  getMyWallet$({ args }, authToken) {
    // console.log("getMyWallet$", args);
    return RoleValidator.checkPermissions$(
      authToken.realm_access.roles,
      "wallet",
      "getMyWallet$",
      PERMISSION_DENIED_ERROR,
      ["PLATFORM-ADMIN", "DRIVER", "CLIENT", "BUSINESS-OWNER", "OPERATOR", "OPERATION-SUPERVISOR"]
      ).pipe(
          map(() => authToken.userId || authToken.driverId || authToken.clientId, ),
          // tap(wi => console.log('BUSCANDO WALLET ID ==> ', wi )),
          mergeMap(walletId => !walletId ? this.createCustomError$(NO_WALLET_ID_IN_AUTH_TOKEN, "getMyWallet$" ) : of(walletId) ),
          mergeMap(walletId => walletDA.getWalletById$(walletId)),
          // tap(r => console.log("RESPONSE ==> ", r)),
          mergeMap(rawResponse => this.buildSuccessResponse$(rawResponse)),
          catchError(err => this.handleError$(err))
      );
  }


        /**
   * Creates a custom error observable
   * @param {*} errorCode Error code
   * @param {*} methodError Method where the error was generated
   */
  createCustomError$(errorCode, methodError) {
    return throwError(
      new CustomError(
        context,
        methodError || "",
        errorCode.code,
        errorCode.description
      )
    );
  }
  /**
   * Gets the wallet info of a business
   *
   * @param {*} args args
   */
  getWallet$({ args }, authToken) {
    return RoleValidator.checkPermissions$(
      authToken.realm_access.roles,
      "WALLET",
      "getWallet",
      PERMISSION_DENIED_ERROR,
      ["PLATFORM-ADMIN", "DRIVER", "CLIENT", "BUSINESS-OWNER", "OPERATOR", "OPERATION-SUPERVISOR"]
    ).pipe(
      // mergeMap(roles => {
      //   const isPlatformAdmin = roles["PLATFORM-ADMIN"];
      //   //If a user does not have the role to get info of a wallet from other business, we must return an error
      //     if (!isPlatformAdmin && authToken.businessId != args.businessId) {
      //       return this.createCustomError$(
      //         PERMISSION_DENIED_ERROR,
      //         'getWallet'
      //       );
      //     }
      //     return of(roles);
      // }),
      mergeMap(() => WalletDA.getWalletById$(args.walletId)),
      mergeMap(rawResponse => this.buildSuccessResponse$(rawResponse)),
      catchError(err => this.handleError$(err))
    );
  }

  /**  
   * Gets the wallet transaction history of a business
   *
   * @param {*} args args
   */
  getWalletTransactionHistory$({ args }, authToken) {
    return RoleValidator.checkPermissions$(
      authToken.realm_access.roles,
      "WALLET",
      "getWalletTransactionHistory",
      PERMISSION_DENIED_ERROR,
      ["PLATFORM-ADMIN", "DRIVER", "CLIENT", "BUSINESS-OWNER", "OPERATOR", "OPERATION-SUPERVISOR"]
    ).pipe(
      mergeMap(roles => {
        const isPlatformAdmin = roles["PLATFORM-ADMIN"];
        //If an user does not have the role to get the transaction history from other business, we must return an error
          if (!isPlatformAdmin && authToken.businessId != args.filterInput.businessId) {
            return this.createCustomError$(
              PERMISSION_DENIED_ERROR,
              'getWalletTransactionHistory'
            );
          }
          return of(roles);
      }),
      mergeMap(() => WalletTransactionDA.getTransactionsHistory$(args.filterInput, args.paginationInput)),
      toArray(),
      mergeMap(rawResponse => this.buildSuccessResponse$(rawResponse)),
      catchError(err => this.handleError$(err))
    );
  }

  getWalletTransactionsHistoryDriverApp$({ args }, authToken) {
    return RoleValidator.checkPermissions$(
      authToken.realm_access.roles,
      "WALLET",
      "getWalletTransactionsHistoryDriverApp",
      PERMISSION_DENIED_ERROR,
      ["DRIVER"]
    ).pipe(
      mergeMap(roles => {
        const isPlatformAdmin = roles["PLATFORM-ADMIN"];
        //If an user does not have the role to get the transaction history from other business, we must return an error
          if (!authToken.driverId) {
            return this.createCustomError$(
              DRIVER_ID_NO_FOUND_IN_TOKEN,
              'getWalletTransactionsHistoryDriverApp'
            );
          }
          return of( authToken.driverId );
      }),
      mergeMap(walletId => WalletTransactionDA.getTransactionsHistoryDriverApp$(args, walletId)),
      toArray(),
      mergeMap(rawResponse => this.buildSuccessResponse$(rawResponse)),
      catchError(err => this.handleError$(err))
    );
  }

      /**
   * Gets the amount of wallet transaction history of a business
   *
   * @param {*} args args
   */
  getWalletTransactionsHistoryAmount$({ args }, authToken) {
    // console.log("getWalletTransactionsHistoryAmount$", args);
    return RoleValidator.checkPermissions$(
      authToken.realm_access.roles,
      "WALLET",
      "getWalletTransactionHistory",
      PERMISSION_DENIED_ERROR,
      ["PLATFORM-ADMIN", "DRIVER", "CLIENT", "BUSINESS-OWNER", "OPERATOR", "OPERATION-SUPERVISOR"]
    ).pipe(
      mergeMap(roles => {
        const isPlatformAdmin = roles["PLATFORM-ADMIN"];
        //If an user does not have the role to get the transaction history from other business, we must return an error
          if (!isPlatformAdmin && authToken.businessId != args.filterInput.businessId) {
            return this.createCustomError$(PERMISSION_DENIED_ERROR, 'getWalletTransactionsHistoryAmount');
          }
          return of(roles);
      }),
      mergeMap(val => WalletTransactionDA.getTransactionsHistoryAmount$(args.filterInput)),
      mergeMap(rawResponse => this.buildSuccessResponse$(rawResponse)),
      catchError(err => this.handleError$(err))
    );
  }

      /**
   * Gets the wallet transaction history of a business
   *
   * @param {*} args args
   */
  getWalletTransactionHistoryById$({ args }, authToken) {
    return RoleValidator.checkPermissions$(
      authToken.realm_access.roles,
      "WALLET",
      "getWalletTransactionHistoryById",
      PERMISSION_DENIED_ERROR,
      ["PLATFORM-ADMIN", "DRIVER", "CLIENT", "BUSINESS-OWNER", "OPERATOR", "OPERATION-SUPERVISOR"]
    ).pipe(
      mergeMap(roles => {
        const isPlatformAdmin = roles["PLATFORM-ADMIN"];
        //If an user does not have the role to get the transaction history from other business, the query must be filtered with the businessId of the user
        const businessId = !isPlatformAdmin ? (authToken.businessId || ''): null;
        return WalletTransactionDA.getTransactionHistoryById$(businessId, args.id);
      }),
      mergeMap(rawResponse => this.buildSuccessResponse$(rawResponse)),
      catchError(err => this.handleError$(err))
    );
  }

  /**
   * Gets the associated transactions history by transaction history id
   *
   * @param {*} args args
   */
  getAssociatedTransactionsHistoryByTransactionHistoryId$({ args }, authToken) {    
    return RoleValidator.checkPermissions$(
      authToken.realm_access.roles,
      "WALLET",
      "getAssociatedTransactionsHistoryByTransactionHistoryId",
      PERMISSION_DENIED_ERROR,
      ["PLATFORM-ADMIN", "BUSINESS-OWNER"]
    ).pipe(
      mergeMap(roles => {
        const isPlatformAdmin = roles["PLATFORM-ADMIN"];
        //If an user does not have the role to get the transaction history from other business, the query must be filtered with the businessId of the user
        const businessId = !isPlatformAdmin? (authToken.businessId || ''): null;
        return WalletTransactionDA.getTransactionHistoryById$(businessId, args.id);
      }),
      mergeMap(transactionHistory => {
        // transactionHistory.associatedTransactionIds = [transactionHistory._id];
        if(transactionHistory && transactionHistory.associatedTransactionIds && transactionHistory.associatedTransactionIds.length > 0){
          return WalletTransactionDA.getTransactionsHistoryByIds$(args.id, transactionHistory.associatedTransactionIds, transactionHistory.businessId)
        }else{
          return of([])
        }    
      }),
      mergeMap(rawResponse => this.buildSuccessResponse$(rawResponse)),
      catchError(err => this.handleError$(err))
    );
  }

  
  /**
   * Makes manual balance adjustment
   *
   * @param {*} data args that contain the ifno of the manual balance adjustment
   * @param {string} authToken JWT token
   */
  makeManualBalanceAdjustment$({args}, authToken) {   
    let mba = !args ? undefined : args.input; // Manual balance Adjusment
    mba = {
      _id: uuidv4(), type: 'MOVEMENT', notes: mba.notes,
      concept: mba.adjustmentType, timestamp: Date.now(),      
      amount: mba.value,
      businessId: args.input.businessWalletId,       
      fromId: mba.adjustmentType === 'DEPOSIT' ? mba.businessWalletId : mba.walletId,
      toId: mba.adjustmentType === 'DEPOSIT' ? mba.walletId : mba.businessWalletId
    };
    return RoleValidator.checkPermissions$(
      authToken.realm_access.roles,
      "wallet",
      "makeManualBalanceAdjustment",
      PERMISSION_DENIED_ERROR,
      ["PLATFORM-ADMIN"]
    ).pipe(
      mergeMap(() => eventSourcing.eventStore.emitEvent$(
        new Event({
          eventType: "WalletTransactionCommited",
          eventTypeVersion: 1,
          aggregateType: "Wallet",
          aggregateId: mba._id,
          data: mba,
          user: authToken.preferred_username
        })
      )),
      map(() => ({ code: 200, message: `Manual balance adjustment has been created` })),
      mergeMap(rawResponse => this.buildSuccessResponse$(rawResponse)),
      catchError(err => this.handleError$(err))
    );
  }

  revertTransaction$({args}, authToken){
    return RoleValidator.checkPermissions$(
      authToken.realm_access.roles, "wallet", "revertTransaction", PERMISSION_DENIED_ERROR, ["PLATFORM-ADMIN", "BUSINESS-OWNER"])
        .pipe(
          // validate transaction length
          map(() => ((args.transactionIds||{}).length == 2)
              ? args.transactionIds
              : this.createCustomError$(MISSING_TRANSACTIONS_TO_REVERT, 'revertTransaction')
          ),
          // validate transaction exists
          mergeMap(([tx1, tx2]) => forkJoin(
            WalletTransactionDA.getTransactionHistoryById$(args.businessId, tx1),
            WalletTransactionDA.getTransactionHistoryById$(args.businessId, tx2),
          )),
          // validate transaction is not already reverted
          mergeMap(([tx1, tx2]) => {
            if(!tx1 || !tx2){
              return this.createCustomError$(TRANSACTION_NO_FOUND, 'revertTransaction');
            }
            if(tx1.reverted || tx2.reverted){
              return this.createCustomError$(TRANSACTION_ALREADY_REVERTED, 'revertTransaction')
            }
            return of([tx1, tx2])
            .pipe(
              map(() => ({
                walletId: tx1.amount > 0 ? tx1.walletId : tx2.walletId,
                amount: tx1.amount > 0 ? tx1.amount : tx2.amount  })
              ),
              mergeMap(txData => forkJoin(
                walletDA.getWalletById$(txData.walletId),
                of(txData)
              )),
              // // validate the balance required to revert transaction
              mergeMap(([wallet, txData]) => {
                if(!wallet || wallet.pockets.main < txData.amount){
                  return this.createCustomError$(INSUFFICIENT_BALANCE, 'revertTransaction')
                }
                return of([tx1, tx2]);
              })
            )
          }),
          mergeMap(([tx1, tx2]) => forkJoin(
            WalletTransactionDA.markAsReverted$(tx1._id),
            WalletTransactionDA.markAsReverted$(tx2._id),
            of([tx1, tx2])
          )),
          // Create the wallet transaction committed
          map(([a, b, txs]) => ({
            _id: uuidv4(), type: 'MOVEMENT', notes: '',
            concept: "CLIENT_AGREEMENT_REFUND", timestamp: Date.now(),      
            amount: txs[0].amount > 0 ? txs[0].amount : txs[1].amount ,
            businessId: txs[0].businessId,       
            fromId: txs[0].amount > 0 ? txs[0].walletId : txs[1].walletId,
            toId: txs[0].amount < 0 ? txs[0].walletId : txs[1].walletId 
          })),
          mergeMap(txData => eventSourcing.eventStore.emitEvent$(
            new Event({
              eventType: "WalletTransactionCommited",
              eventTypeVersion: 1,
              aggregateType: "Wallet",
              aggregateId: txData._id,
              data: txData,
              user: authToken.preferred_username
            })
          )),
          map(() => ({ code: 200, message: `Manual balance adjustment has been created` })),
          mergeMap(rawResponse => this.buildSuccessResponse$(rawResponse)),
          catchError(err => this.handleError$(err))
      );
  }

  getTypesAndConceptsValues$() {
    return of(process.env.WALLET_TRANSACTION_TYPES_CONCEPTS)
      .pipe(
        map(typesAndConcepts => JSON.parse(typesAndConcepts)),
        map(typesAndConceptsObj => Object.entries(typesAndConceptsObj)),
        map(typesAndConcepts => typesAndConcepts.reduce((acc, item) => [...acc, {type:  item[0],concepts: item[1]}], [])),
        mergeMap(rawResponse => this.buildSuccessResponse$(rawResponse)),
        catchError(error => this.handleError$(error))
      )
  }

  //#region method for third parties

  getWalletwalletForThirdsParties$({args}, authToken){
    return of(authToken.businessId)
    .pipe(
      mergeMap(businessId => businessId 
        ? WalletDA.getWallet$(businessId) 
        : throwError(new CustomError("businessId required", "getWalletwalletForThirdsParties", 17006, "Business ID required" ) )),
      map(({businessId, spendingState, pockets}) => ({businessId, spendingState, pockets}) ),
      mergeMap(rawResponse => this.buildSuccessResponse$(rawResponse)),
      catchError(ex => this.handleError$(ex) )      
    )
  }
  //#endregion


  //#region  mappers for API responses
  handleError$(err) {
    console.log("Handle error => ", err);
    return of(err).pipe(
      map(err => {
        const exception = { data: null, result: {} };
        const isCustomError = err instanceof CustomError;
        if (!isCustomError) {
          err = new DefaultError(err);
        }
        exception.result = {
          code: err.code,
          error: { ...err.getContent() }
        };
        return exception;
      })
    );
  }

  buildSuccessResponse$(rawRespponse) {
    return of(rawRespponse).pipe(
      map(resp => ({
        data: resp,
        result: { code: 200 }
      }))
    )
  }
}

/**
 * Wallet CQRS
 * @returns {WalletCQRS}
 */
module.exports = () => {
  if (!instance) {
    instance = new WalletCQRS();
    console.log("WalletCQRS Singleton created");
  }
  return instance;
};
