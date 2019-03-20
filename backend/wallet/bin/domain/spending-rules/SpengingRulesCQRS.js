const Rx = require("rxjs");
const broker = require("../../tools/broker/BrokerFactory")();
const MATERIALIZED_VIEW_TOPIC = "emi-gateway-materialized-view-updates";
const RoleValidator = require("../../tools/RoleValidator");
const { CustomError, DefaultError } = require("../../tools/customError");
const {
  PERMISSION_DENIED_ERROR
} = require("../../tools/ErrorCodes");
const eventSourcing = require('../../tools/EventSourcing')();
const Event = require("@nebulae/event-store").Event;
const spendingRulesDA = require('../../data/SpendingRulesDA');
const { take, mergeMap, tap, catchError, map } = require('rxjs/operators');
const  { forkJoin, of, interval, throwError } = require('rxjs');

let instance;

class BusinessCQRS {
  constructor() {}
  

  /**
   * 
   * @param {any} param0 args that contains args query and JWT
   * @param {any} authToken decoded token
   */
  getSpendingRule$({ root, args, jwt }, authToken) {
    return RoleValidator.checkPermissions$(
      authToken.realm_access.roles,
      "SpendingRule",
      "getSpendingRule$",
      PERMISSION_DENIED_ERROR,
      ["PLATFORM-ADMIN"]
    ).pipe(
      mergeMap(() => spendingRulesDA.getSpendingRule$(args.businessId)),
      mergeMap(rawResponse => this.buildSuccessResponse$(rawResponse)),
      catchError(err => this.errorHandler$(err))
    );
  }

  getWalletSpendingRuleQuantity$({ root, args, jwt }, authToken) {
    return RoleValidator.checkPermissions$(
      authToken.realm_access.roles,
      "SpendingRule",
      "getSpendingRule$",
      PERMISSION_DENIED_ERROR,
      ["PLATFORM-ADMIN"]
    ).pipe(
      mergeMap(() => spendingRulesDA.getDocumentsCount$() ),
      mergeMap(rawResponse => this.buildSuccessResponse$(rawResponse)),
      catchError(err => this.errorHandler$(err))
    );
  }
  

  getSpendingRules$({ root, args, jwt }, authToken) {
    return RoleValidator.checkPermissions$(
      authToken.realm_access.roles,
      "SpendingRule",
      "getSpendingRule$",
      PERMISSION_DENIED_ERROR,
      ["PLATFORM-ADMIN"]
    ).pipe(
      mergeMap(() =>
        spendingRulesDA.getSpendingRules$(
          args.page,
          args.count,
          args.filter,
          args.sortColumn,
          args.sortOrder
        )
      ),
      mergeMap(rawResponse => this.buildSuccessResponse$(rawResponse)),
      catchError(err => this.errorHandler$(err))
    );
  }
  /**
   * Edit a spending rule
   */
  updateSpendingRule$({ root, args, jwt }, authToken) {
    // console.log("updateSpendingRule =========> ", args);
    return RoleValidator.checkPermissions$(
      authToken.realm_access.roles,
      "SpendingRule",
      "getSpendingRule$",
      PERMISSION_DENIED_ERROR,
      ["PLATFORM-ADMIN"]
    ).pipe(
      mergeMap(() => eventSourcing.eventStore.emitEvent$(
        new Event({
          eventType: "SpendingRuleUpdated",
          eventTypeVersion: 1,
          aggregateType: "SpendingRule",
          aggregateId: args.businessId,
          data: args,
          user: authToken.preferred_username
        })
      )
      ),
      map(() => ({ code: 10000, message: "asdas" })), // MISSSING CODE
      mergeMap(r => this.buildSuccessResponse$(r)),
      catchError(err => this.errorHandler$(err))
    );
  }

  //#region  mappers for API responses
  errorHandler$(err) {
    return Rx.of(err).pipe(
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
    return Rx.of(rawRespponse).pipe(
      map(resp => ({
        data: resp,
        result: {
          code: 200
        }
      }))
    );
  }
}

/**
 * Business CQRS
 * @returns {BusinessCQRS}
 */
module.exports = () => {
  if (!instance) {
    instance = new BusinessCQRS();
    console.log("BusinessCQRS Singleton created");
  }
  return instance;
};
