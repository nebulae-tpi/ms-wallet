"use strict";

const { of, forkJoin, range } = require("rxjs");
const { tap, mergeMap, catchError, map, mapTo, toArray, delay } = require("rxjs/operators");
const broker = require("../../tools/broker/BrokerFactory")();
const Event = require("@nebulae/event-store").Event;
const eventSourcing = require("../../tools/EventSourcing")();
const MATERIALIZED_VIEW_TOPIC = "emi-gateway-materialized-view-updates";
const walletDA = require("../../data/WalletDA");
const WalletSpendingRuleDA = require('../../data/SpendingRulesDA');
const defaultWSR = process.env.WSR_CLIENT || {};

/**
 * Singleton instance
 */
let instance;

class ClientES {
  constructor() {
  }

  handleClientCreated$({aid, data}){
    return of(data)
    .pipe(
      // create the default wallet state
      map(rawdata => ({
        _id: aid,
        businessId: rawdata.businessId,
        type: 'CLIENT',
        fullname: `${(rawdata.generalInfo||{}).name}`,
        documentId: (rawdata.generalInfo||{}).documentId,
        pockets: { main: 0, credit: 0, bonus: 0 }
      })),
      mergeMap(wallet => walletDA.createNeWallet$(wallet)),
      // create the default wallet spending Rule
      mergeMap(() => WalletSpendingRuleDA.createNewWalletSpendingRule$(defaultWSR))
    );
  }
  
  handleClientGeneralInfoUpdated$({ aid, data }) {
    return of(data)
      .pipe(
        map(rawdata => ({
          _id: aid,
          businessId: rawdata.businessId, // todo
          type: 'CLIENT',
          fullname: `${(rawdata.generalInfo||{}).name}`,
          documentId: (rawdata.generalInfo||{}).document
        })),
        mergeMap(wallet => walletDA.updateWallet$(wallet, { pockets: { main: 0, credit: 0, bonus: 0 } })),
        mergeMap(mResult => (mResult && mResult.result && mResult.result.inserted == 1)
          ? WalletSpendingRuleDA.updateNewWalletSpendingRule$({}, defaultWSR)
          : of(null)
        )
      );
  }


}

/**
 * @returns {ClientES}
 */
module.exports = () => {
  if (!instance) {
    instance = new ClientES();
    console.log(`${instance.constructor.name} Singleton created`);
  }
  return instance;
};
