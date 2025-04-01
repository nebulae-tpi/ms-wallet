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
        active: true,
        fullname: `${((rawdata.generalInfo || {}).name || '')}`,
        documentId: ((rawdata.generalInfo || {}).documentId || ''),        
        pockets: { main: 0, bonus: 0 }
      })),
      mergeMap(wallet => walletDA.createNeWallet$(wallet)),
      mergeMap(r => ( r && r.ops && r.insertedCount == 1) ? this.emitWalletCreatedOrUpdated$(r.ops[0]) : of({})),
      mergeMap(() => WalletSpendingRuleDA.createNewWalletSpendingRule$({ walletId: aid, businessId: data.businessId,  ...defaultWSR})),
    );
  }

  handleEndClientCreated$({aid, data}){
    return of(data)
    .pipe(
      // create the default wallet state
      map(rawdata => ({
        _id: aid,
        businessId: rawdata.businessId,
        type: 'CLIENT',
        active: true,
        fullname: `${((rawdata.generalInfo || {}).name || '')}`,
        documentId: ((rawdata.generalInfo || {}).documentId || ''),        
        pockets: { main: 0, bonus: 0 }
      })),
      mergeMap(wallet => walletDA.createNeWallet$(wallet)),
      mergeMap(r => ( r && r.ops && r.insertedCount == 1) ? this.emitWalletCreatedOrUpdated$(r.ops[0]) : of({})),
      mergeMap(() => WalletSpendingRuleDA.createNewWalletSpendingRule$({ walletId: aid, businessId: data.businessId,  ...defaultWSR})),
    );
  }


  
  handleClientGeneralInfoUpdated$({ aid, data }) {
    return of(data)
      .pipe(
        map(rawdata => ({
          _id: aid,
          // businessId: rawdata.businessId, // todo
          type: 'CLIENT',
          fullname: `${(rawdata.generalInfo||{}).name}`,
          documentId: (rawdata.generalInfo||{}).document || (rawdata.generalInfo||{}).documentId
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

  handleClientStateUpdated$({aid, data}){
    return of(data.state)
    .pipe(
      mergeMap(active => walletDA.updateActiveStatus$(aid, active)),
      mergeMap( r => (r && r.value) ? this.emitWalletCreatedOrUpdated$(r.value) : of({}))
    )
  }


  handleClientSatelliteIdUpdated$({aid, data}){
    if(data.businessId){
      return walletDA.updateBusinessId$(aid, data.businessId);
    }else {
      return of({});
    }
  }

  emitWalletCreatedOrUpdated$(wallet){
    // console.log('PARA EMITIR ==> (WalletUpdated) ', wallet );
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
 * @returns {ClientES}
 */
module.exports = () => {
  if (!instance) {
    instance = new ClientES();
    console.log(`${instance.constructor.name} Singleton created`);
  }
  return instance;
};
