const { mergeMap, catchError, map, toArray, tap, reduce } = require('rxjs/operators');
const { of, throwError, from } = require('rxjs');
const broker = require("../../tools/broker/BrokerFactory")();
const eventSourcing = require("../../tools/EventSourcing")();
const Event = require("@nebulae/event-store").Event;
const MATERIALIZED_VIEW_TOPIC = "emi-gateway-materialized-view-updates";
const uuidv4 = require("uuid/v4");
const WalletDA = require("../../data/WalletDA");
const WalletTransactionDA = require("../../data/WalletTransactionDA");
const RoleValidator = require("../../tools/RoleValidator");
const { CustomError, DefaultError } = require("../../tools/customError");
const {
  PERMISSION_DENIED_ERROR,
  INTERNAL_SERVER_ERROR
} = require("../../tools/ErrorCodes");
const context = "wallet";

let instance;

class WalletCQRS {
  constructor() {}


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
      ["PLATFORM-ADMIN", "BUSINESS-OWNER", "POS"]
    ).pipe(
      mergeMap(roles => {
        const isPlatformAdmin = roles["PLATFORM-ADMIN"];
        //If a user does not have the role to get info of a wallet from other business, we must return an error
          if (!isPlatformAdmin && authToken.businessId != args.businessId) {
            return this.createCustomError$(
              PERMISSION_DENIED_ERROR,
              'getWallet'
            );
          }
          return of(roles);
      }),
      mergeMap(val => WalletDA.getWallet$(args.businessId)),
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
      ["PLATFORM-ADMIN", "BUSINESS-OWNER"]
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
      mergeMap(val => WalletTransactionDA.getTransactionsHistory$(args.filterInput, args.paginationInput)),
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
    return RoleValidator.checkPermissions$(
      authToken.realm_access.roles,
      "WALLET",
      "getWalletTransactionHistory",
      PERMISSION_DENIED_ERROR,
      ["PLATFORM-ADMIN", "BUSINESS-OWNER"]
    ).pipe(
      mergeMap(roles => {
        const isPlatformAdmin = roles["PLATFORM-ADMIN"];
        //If an user does not have the role to get the transaction history from other business, we must return an error
          if (!isPlatformAdmin && authToken.businessId != args.filterInput.businessId) {
            return this.createCustomError$(
              PERMISSION_DENIED_ERROR,
              'getWalletTransactionsHistoryAmount'
            );
          }
          return of(roles);
      }),
      mergeMap(val => WalletTransactionDA.getTransactionsHistoryAmount$(args.filterInput)),
      toArray(),
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
      ["PLATFORM-ADMIN", "BUSINESS-OWNER"]
    ).pipe(
      mergeMap(roles => {
        const isPlatformAdmin = roles["PLATFORM-ADMIN"];
        //If an user does not have the role to get the transaction history from other business, the query must be filtered with the businessId of the user
        const businessId = !isPlatformAdmin? (authToken.businessId || ''): null;
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
        //console.log('getAssociatedTransactionsHistoryByTransactionHistoryId1 => ', transactionHistory);
        transactionHistory.associatedTransactionIds = [transactionHistory._id];
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
  makeManualBalanceAdjustment$(data, authToken) {
    const manualBalanceAdjustment = !data.args ? undefined : data.args.input;
    manualBalanceAdjustment._id = uuidv4();
    manualBalanceAdjustment.type = 'MOVEMENT';
    manualBalanceAdjustment.concept = manualBalanceAdjustment.adjustmentType;
    return RoleValidator.checkPermissions$(
      authToken.realm_access.roles,
      "wallet",
      "makeManualBalanceAdjustment",
      PERMISSION_DENIED_ERROR,
      ["PLATFORM-ADMIN"]
    ).pipe(
      mergeMap(roles => {              
        return eventSourcing.eventStore.emitEvent$(
          new Event({
            eventType: manualBalanceAdjustment.adjustmentType == 'WITHDRAWAL' ? "WalletSpendingCommited": "WalletDepositCommited",
            eventTypeVersion: 1,
            aggregateType: "Wallet",
            aggregateId: manualBalanceAdjustment._id,
            data: manualBalanceAdjustment,
            user: authToken.preferred_username
          })
        );
      }),
      map(result => {
        return {
          code: 200,
          message: `Manual balance adjustment with id: ${manualBalanceAdjustment._id} has been created`
        };
      }),
      mergeMap(rawResponse => this.buildSuccessResponse$(rawResponse)),
      catchError(err => this.handleError$(err))
    );
  }

  getTypesAndConceptsValues$() {
    return of(process.env.WALLET_TRANSACTION_TYPES_CONCEPTS)
      .pipe(
        map(typesAndConcepts => JSON.parse(typesAndConcepts)),
        map(typesAndConceptsObj => Object.entries(typesAndConceptsObj)),
        map(typesAndConcepts => 
          typesAndConcepts.reduce((acc, item) => { 
            acc.push({
              type:  item[0],
              concepts: item[1]
            });
            return acc; 
          }, []),
        ),
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
        result: {
          code: 200
        }
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
