"use strict";

const { of, forkJoin, range } = require("rxjs");
const { tap, mergeMap, catchError, map, mapTo, toArray, delay } = require("rxjs/operators");
const broker = require("../../tools/broker/BrokerFactory")();
const Event = require("@nebulae/event-store").Event;
const eventSourcing = require("../../tools/EventSourcing")();
const MATERIALIZED_VIEW_TOPIC = "emi-gateway-materialized-view-updates";
const walletDA = require("../../data/WalletDA");
const WalletSpendingRuleDA = require('../../data/SpendingRulesDA');
const defaultWSR = process.env.WSR_USER || {};

/**
 * Singleton instance
 */
let instance;

class UserES {
  constructor() {
  }

  handleUserCreated$({aid, data}){
    return of(data)
      .pipe(
        // create the default wallet state
        map(rawdata => ({
          _id: aid,
          businessId: rawdata.businessId,
          type: 'USER',
          fullname: `${(rawdata.generalInfo||{}).name} ${(rawdata.generalInfo||{}).lastname}`,
          documentId: (rawdata.generalInfo||{}).documentId,
          pockets: { main: 0, credit: 0, bonus: 0 }
        })),
        mergeMap(wallet => walletDA.createNeWallet$(wallet)),
        // create the default wallet spending Rule
        mergeMap(() => WalletSpendingRuleDA.createNewWalletSpendingRule$(defaultWSR))
      );
  }
  
  handleUserGeneralInfoUpdated$({aid, data}){
    return of(data)
      .pipe(
        map(rawdata => ({
          _id: aid,
          businessId: rawdata.businessId, // todo
          type: 'USER',
          fullname: `${(rawdata.generalInfo||{}).name} ${(rawdata.generalInfo||{}).lastname}`,
          documentId: (rawdata.generalInfo||{}).documentid
        })),
        mergeMap(wallet => walletDA.updateWallet$(wallet, { pockets: { main: 0, credit: 0, bonus: 0 } } )),
        mergeMap(mResult => (mResult && mResult.result && mResult.result.inserted == 1)
          ? WalletSpendingRuleDA.updateNewWalletSpendingRule$({}, defaultWSR)
          : of(null)
        )
      );
  }


}

/**
 * @returns {UserES}
 */
module.exports = () => {
  if (!instance) {
    instance = new UserES();
    console.log(`${instance.constructor.name} Singleton created`);
  }
  return instance;
};
