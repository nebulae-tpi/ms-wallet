"use strict";

let mongoDB = undefined;
const Rx = require("rxjs");
const COLLECTION_NAME = "SpendingRules";
const { CustomError } = require("../tools/customError");
const { defer, of } = require('rxjs');
const { map, mergeMap } = require('rxjs/operators');

class SpendingRules {

    static start$(mongoDbInstance) {
        return Rx.Observable.create((observer) => {
            if (mongoDbInstance) {
                mongoDB = mongoDbInstance;
                observer.next('using given mongo instance ');
            } else {
                mongoDB = require('./MongoDB').singleton();
                observer.next('using singleton system-wide mongo instance');
            }
            observer.complete();
        });
    }

    /**
     * Creates a new  wallet spending rule
     * @param {*} business spendig rule to create
     */
    static persistDefaultSpendingRule$(spendingRule) {
        const collection = mongoDB.db.collection(COLLECTION_NAME);
        return of(spendingRule)
        .pipe(
            mergeMap(spendingRule => defer(() => collection.insertOne(spendingRule) ))
        )

        //return Rx.Observable.defer(() => collection.insertOne(spendingRule));
    }

  /**
   * update the business name to the spending rule related 
   * @param {string} id  Business ID
   * @param {string} name  New business name for spending rule
   */
    static updateSpendingRuleBusinessName$(id, name) {
        const collection = mongoDB.db.collection(COLLECTION_NAME);
        return of({ id, name })
            .pipe(
                mergeMap(update => Rx.defer(() => collection.findOneAndUpdate(
                    { businessId: update.id },
                    {
                        $set: { businessName: update.name }
                    }, {
                        returnOriginal: false
                    }
                ))),
                map(result => result && result.value ? result.value : undefined)
            )
    }

    /**
     * 
     * @param {any} spendingRule Spending rule Object
     * @param {string} responsibleUser user responsible for the edition
     */
    static updateWalletSpendingRule$(spendingRule, responsibleUser, timestamp ) {
        const collection = mongoDB.db.collection(COLLECTION_NAME);
        return of(spendingRule)
            .pipe(
                mergeMap(spendingRuleUpdated => Rx.defer(() => collection.findOneAndUpdate(
                    { businessId: spendingRuleUpdated.businessId },
                    {
                        $set: { ...spendingRuleUpdated, editedBy: responsibleUser, lastEditionTimestamp: timestamp }
                    }, {
                        returnOriginal: false
                    }
                ))),
                map(result => result && result.value ? result.value : undefined)
            )
    }


    /**
     * 
     * @param {string} businessId Business unit related
     */
    static getSpendingRule$(businessId) {
        const collection = mongoDB.db.collection(COLLECTION_NAME);
        return of(businessId)
            .pipe(
                mergeMap(id => defer(() => collection.findOne(
                    { businessId: id }
                )))
            )
    }

    
    static getSpendingRules$(page, count, filter, sortColumn, order) {
        let filterObject = {};
        const orderObject = {};
        if (filter && filter != "") {
          filterObject = {
            $or: [
              { 'businessName': { $regex: `${filter}.*`, $options: "i" } },
              { 'businessId': { $regex: `${filter}.*`, $options: "i" } }
            ]
          };
        }
        
        if (sortColumn && order) {
          let column = sortColumn;      
          orderObject[column] = order == 'asc' ? 1 : -1;
        }
        const collection = mongoDB.db.collection(COLLECTION_NAME);

        return defer( () =>
          collection
            .find(filterObject)
            .sort(orderObject)
            .skip(count * page)
            .limit(count)
            .toArray()
        );
      
    }

    static getDocumentsCount$(){
        const collection = mongoDB.db.collection(COLLECTION_NAME);
        return defer(() => collection.count() )
      }


    /**
   * Extracts the next value from a mongo cursor if available, returns undefined otherwise
   * @param {*} cursor
   */
  static async extractNextFromMongoCursor(cursor) {
    const hasNext = await cursor.hasNext();
    if (hasNext) {
      const obj = await cursor.next();
      return obj;
    }
    return undefined;
  }
}

/**
 * @returns {SpendingRules}
 */
module.exports = SpendingRules;
