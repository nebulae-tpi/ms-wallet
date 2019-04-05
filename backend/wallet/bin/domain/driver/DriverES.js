"use strict";

const { of, forkJoin, range } = require("rxjs");
const { tap, mergeMap, catchError, map, mapTo, toArray, delay } = require("rxjs/operators");
const broker = require("../../tools/broker/BrokerFactory")();
const Event = require("@nebulae/event-store").Event;
const eventSourcing = require("../../tools/EventSourcing")();
const MATERIALIZED_VIEW_TOPIC = "emi-gateway-materialized-view-updates";
const walletDA = require("../../data/WalletDA");
const WalletSpendingRuleDA = require('../../data/SpendingRulesDA');
const defaultWSR = process.env.WSR_DRIVER || {};

/**
 * Singleton instance
 */
let instance;

class DriverES {
  constructor() {
  }

  handleDriverCreated$({ aid, data }) {
    console.log("handleDriverCreated$", aid);
    return of(data)
      .pipe(
        // create the default wallet state
        map(rawdata => ({
          _id: aid,
          businessId: rawdata.businessId,
          type: 'DRIVER',
          fullname: `${ ((rawdata.generalInfo||{}).name || '' ) } ${ ((rawdata.generalInfo||{}).lastname || '') }`,
          documentId: ((rawdata.generalInfo||{}).document || ''),
          pockets: { main: 0, bonus: 0 }
        })),
        mergeMap(wallet => walletDA.createNeWallet$(wallet)),
        mergeMap(r => ( r && r.ops && r.insertedCount == 1) ? this.emitWalletCreatedOrUpdated$(r.ops[0]) : of({})),
        mergeMap(() => WalletSpendingRuleDA.createNewWalletSpendingRule$({ walletId: aid, businessId: data.businessId,  ...defaultWSR})),
      );
  }
  
  handleDriverGeneralInfoUpdated$({ aid, data }) {
    console.log("handleDriverGeneralInfoUpdated$", aid);
    return of(data)
      .pipe(
        map(rawdata => ({
          _id: aid,
          // businessId: rawdata.businessId, // todo
          type: 'DRIVER',
          fullname: `${((rawdata.generalInfo||{}).name || '')} ${((rawdata.generalInfo||{}).lastname || '')}`,
          documentId: (rawdata.generalInfo.document || '')
        })),
        mergeMap(wallet => walletDA.findAndUpdateWallet$(wallet, { pockets: { main: 0, bonus: 0 } } )),
        mergeMap(r => (r && r.value)
          ? this.emitWalletCreatedOrUpdated$(r.value).pipe(mapTo(r.lastErrorObject))
          : of(r.lastErrorObject)
        ),
        mergeMap(({upserted}) => upserted
          ? WalletSpendingRuleDA.updateNewWalletSpendingRule$({ walletId: aid, businessId:data.businessId,  ...defaultWSR})
          : of(null)
        )
      );
  }

  emitWalletCreatedOrUpdated$(wallet){
    console.log('PARA EMITIR ==> (WalletUpdated) ', wallet );
    return eventSourcing.eventStore.emitEvent$(
      new Event({
        eventType: "WalletUpdated",
        eventTypeVersion: 1,
        aggregateType: "Wallet",
        aggregateId: wallet._id,
        data: wallet,
        user: "SYSTEM"
      })
    )
  }


}

/**
 * @returns {DriverES}
 */
module.exports = () => {
  if (!instance) {
    instance = new DriverES();
    console.log(`${instance.constructor.name} Singleton created`);
  }
  return instance;
};
