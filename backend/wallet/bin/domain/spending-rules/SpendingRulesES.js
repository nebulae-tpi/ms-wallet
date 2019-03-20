const Rx = require("rxjs");
const SpendingRulesDA = require("../../data/SpendingRulesDA");
const WalletHelper = require('../wallet/WalletHelper');
const { take, mergeMap, catchError, map, tap } = require('rxjs/operators');
const  { forkJoin, of, interval } = require('rxjs');

let instance;

class SpendingRulesES {
  constructor() {
  }

  /**
   * Persists the business on the materialized view according to the received data from the event store.
   * @param {*} businessCreatedEvent business created event
   */
  handleBusinessCreated$(businessCreated) {
    return of(businessCreated) 
    .pipe(
      mergeMap(businessCreated => this.createDefaultSpendingRule$(businessCreated._id, businessCreated.generalInfo.name)),
      mergeMap(newSpendingRule => SpendingRulesDA.persistDefaultSpendingRule$(newSpendingRule) )
    )
  }


  handleBusinessGeneralInfoUpdated$(buId, buName) {
    return SpendingRulesDA.updateSpendingRuleBusinessName$(buId, buName)
  }

  // esto va para un helper
  createDefaultSpendingRule$(buId, buName){
    return of(Date.now())
    .pipe(
      map(time => ({
        id: time,
        businessId: buId,
        businessName: buName,
        minOperationAmount: 0,
        productBonusConfigs: [],
        autoPocketSelectionRules: [],
        lastEditionTimestamp: time,
        editedBy: "SYSTEM"
      }))
    );
  }

  /**
   * 
   * @param {any} evt SpendingRuleUpdated event
   */
  handleSpendingRuleUpdated$(evt){
    return of(evt.data.input)
    .pipe(
      mergeMap(spendingRule => SpendingRulesDA.updateWalletSpendingRule$(spendingRule, evt.user, evt.timestamp )),
      mergeMap(() => WalletHelper.checkWalletSpendingAlarms$(evt.data.input.businessId) )
    )
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
 * @returns {SpendingRulesES}
 */
module.exports = () => {
  if (!instance) {
    instance = new SpendingRulesES();
    console.log(` => ${instance.constructor.name} Singleton created` );
  }
  return instance;
};
