const { mergeMap, catchError, map, toArray } = require('rxjs/operators');
const { of } = require('rxjs');
const broker = require("../../tools/broker/BrokerFactory")();
const MATERIALIZED_VIEW_TOPIC = "materialized-view-updates";
const LogErrorDA = require("../../data/LogErrorDA");
const RoleValidator = require("../../tools/RoleValidator");
const { CustomError, DefaultError } = require("../../tools/customError");
const {
  PERMISSION_DENIED_ERROR,
  INTERNAL_SERVER_ERROR
} = require("../../tools/ErrorCodes");

let instance;

class LogErrorCQRS {
  constructor() { }



  /**
   * handle the cron job event - handleSettlementJobTriggeredEvent
   *
   * @param {*} settlementJobTriggered cron job event
   * @returns {Rx.Observable}
   */
  handleSettlementJobTriggeredEvent$(settlementJobTriggered) {
    return Rx.Observable.empty();
  }

  /**
   * Gets wallet errors
   *
   * @param args args
   * @param args.page Page number to recover
   * @param args.count Amount of rows to recover
   */
  getWalletErrors$({ args }, authToken) {
    //console.log('getWalletErrors =>', args);
    return RoleValidator.checkPermissions$(
      authToken.realm_access.roles,
      "WalletError",
      "getWalletErrorsCount$()",
      PERMISSION_DENIED_ERROR,
      ["PLATFORM-ADMIN"]
    ).pipe(
      mergeMap(roles => {
        return LogErrorDA.getLogError$(args.page, args.count, args.errorType)
      }),
      mergeMap(rawResponse => this.buildSuccessResponse$(rawResponse)),
      catchError(err => {
        return this.handleError$(err);
      })
    );
  }

    /**
   * Gets wallet errors count
   *
   * @param args args
   * @param args.page Page number to recover
   * @param args.count Amount of rows to recover
   * @param args.errorType Error type
   */
  getWalletErrorsCount$({ args }, authToken) {
    return RoleValidator.checkPermissions$(
      authToken.realm_access.roles,
      "WalletError",
      "getWalletErrorsCount$()",
      PERMISSION_DENIED_ERROR,
      ["PLATFORM-ADMIN"]
    ).pipe(
      mergeMap(roles => {
        return LogErrorDA.getLogErrorCount$(args.page, args.count, args.errorType)
      }),
      mergeMap(rawResponse => this.buildSuccessResponse$(rawResponse)),
      catchError(err => {
        return this.handleError$(err);
      })
    );
  }

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
 * Log error
 * @returns {LogErrorCQRS}
 */
module.exports = () => {
  if (!instance) {
    instance = new LogErrorCQRS();
    console.log("LogErrorCQRS Singleton created");
  }
  return instance;
};
