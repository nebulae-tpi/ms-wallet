const Rx = require("rxjs");
const BusinessDA = require("../../data/BusinessDA");
const spendingRules = require('../spending-rules');
const wallet = require('../wallet');
const { take, mergeMap, tap, catchError, map } = require('rxjs/operators');
const  { forkJoin, of, interval } = require('rxjs');

let instance;

class BusinessES {
  constructor() {
  }

  /**
   * Persists the business on the materialized view according to the received data from the event store.
   * @param {*} businessCreatedEvent business created event
   */
  handleBusinessCreated$(businessCreatedEvent) {
    return of(businessCreatedEvent)
    .pipe(
      mergeMap((business) => forkJoin(
        BusinessDA.persistBusiness$(business.data),
        spendingRules.eventSourcing.handleBusinessCreated$(business.data),
        wallet.eventSourcing.handleBusinessCreated$(businessCreatedEvent)
      ))
    )
  }

  /**
   * updates the business general info on the materialized view according to the received data from the event store.
   * @param {*} evt business general info updated event
   */
  handleBusinessGeneralInfoUpdated$(evt) {
    return of(evt.data)
      .pipe(
        mergeMap(businessUpdated => forkJoin(
          BusinessDA.updateBusinessGeneralInfo$(
            evt.aid,
            businessUpdated
          ),
          spendingRules.eventSourcing.handleBusinessGeneralInfoUpdated$(evt.aid, businessUpdated.name ),
          wallet.eventSourcing.handleBusinessGeneralInfoUpdated$(evt)
        )
        )
      );
  }

  /**
   * Handles and persist the errors generated while a settlementJobTriggered was being processed.
   * @param {*} error Error
   * @param {*} event settlementJobTriggered event
   */
  errorHandler$(error, event) {
    return Rx.Observable.of({ error, event }).mergeMap(log =>
      LogErrorDA.persistAccumulatedTransactionsError$(log)
    );
  }
}

/**
 * Business event consumer
 * @returns {BusinessES}
 */
module.exports = () => {
  if (!instance) {
    instance = new BusinessES();
    console.log("SettlementES Singleton created");
  }
  return instance;
};
