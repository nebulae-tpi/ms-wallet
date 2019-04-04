const Rx = require("rxjs");
const BusinessDA = require("../../data/BusinessDA");
const spendingRules = require('../spending-rules');
const wallet = require('../wallet');
const { take, mergeMap, tap, catchError, map, delay, mapTo } = require('rxjs/operators');
const  { forkJoin, of, interval } = require('rxjs');

const walletDA = require("../../data/WalletDA");
const WalletSpendingRuleDA = require('../../data/SpendingRulesDA');
const defaultWSR = process.env.WSR_BUSINESS || {};
const eventSourcing = require("../../tools/EventSourcing")();
const Event = require("@nebulae/event-store").Event;

let instance;

class BusinessES {
  constructor() {
    // of({})
    //   .pipe(
    //     delay(2000),
    //     mergeMap(() => eventSourcing.eventStore.emitEvent$(
    //       new Event({
    //         eventType: "UserGeneralInfoUpdated",
    //         eventTypeVersion: 1,
    //         aggregateType: "User",
    //         aggregateId: "sd989845--14-g4--f0-6-g4-6-45-f4o9",
    //         data: { 
    //           businessId: "4j5hb34g5j345--gg6w-",
    //           generalInfo: {
    //             name: 'Nombre',
    //             lastname: 'Nombre',
    //             documentId: 'documento ID'
    //           }
    //         },
    //         user: "SYSTEM"
    //       })
    //     ))
    //   )
    // .subscribe()
  }

  /**
   * Create the dafault wallet and WalletSpendingRule for the business created
   * @param {*} event business created event
   */
  handleBusinessCreated$({aid, data}) {
    console.log("handleBusinessCreated$", aid);
    return of(data)
      .pipe(
        // create the default wallet state
        map(rawdata => ({
          _id: aid,
          businessId: aid,
          type: 'BUSINESS',
          fullname: (rawdata.generalInfo || {}).name,
          documentId: (rawdata.generalInfo || {}).documentId,
          pockets: { main: 0, credit: 0, bonus: 0 }
        })),
        mergeMap(wallet => walletDA.createNeWallet$(wallet)),
        mergeMap(r => ( r && r.ops && r.insertedCount == 1) ? this.emitWalletCreatedOrUpdated$(r.ops[0]) : of({})),
        mergeMap(() => WalletSpendingRuleDA.createNewWalletSpendingRule$({ walletId: aid, businessId:aid,  ...defaultWSR}))
      );
  }

  /**
   * updates Wallet and WSR if necessary for the business edited
   * @param {*} evt business general info updated event
   */
  handleBusinessGeneralInfoUpdated$({aid, data, user}) {
    console.log("handleBusinessGeneralInfoUpdated$", aid);
    return of(data)
      .pipe(
        map(rawdata => ({
          _id: aid,
          businessId: aid, // todo
          type: 'BUSINESS',
          fullname: (rawdata.generalInfo || {}).name,
          documentId: (rawdata.generalInfo || {}).documentId
        })),
        mergeMap(wallet => walletDA.findAndUpdateWallet$(wallet, { pockets: { main: 0, credit: 0, bonus: 0 } })),
        mergeMap(r => (r && r.value)
          ? this.emitWalletCreatedOrUpdated$(r.value).pipe(mapTo(r.lastErrorObject))
          : of(r.lastErrorObject)
        ),
        mergeMap(({upserted}) => upserted
          ? WalletSpendingRuleDA.updateNewWalletSpendingRule$({ walletId: aid, businessId:aid,  ...defaultWSR})
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
