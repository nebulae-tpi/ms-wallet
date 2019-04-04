const Rx = require("rxjs");
const BusinessDA = require("../../data/BusinessDA");
const spendingRules = require('../spending-rules');
const wallet = require('../wallet');
const { take, mergeMap, tap, catchError, map } = require('rxjs/operators');
const  { forkJoin, of, interval } = require('rxjs');

const walletDA = require("../../data/WalletDA");
const WalletSpendingRuleDA = require('../../data/SpendingRulesDA');
const defaultWSR = process.env.WSR_BUSINESS || {};

let instance;

class BusinessES {
  constructor() {
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
        // create the default wallet spending Rule
        mergeMap(() => WalletSpendingRuleDA.createNewWalletSpendingRule$(defaultWSR))
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
        mergeMap(wallet => walletDA.updateWallet$(wallet, { pockets: { main: 0, credit: 0, bonus: 0 } })),
        mergeMap(mResult => (mResult && mResult.result && mResult.result.inserted == 1)
          ? WalletSpendingRuleDA.updateNewWalletSpendingRule$({}, defaultWSR)
          : of(null)
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
