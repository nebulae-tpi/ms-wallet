"use strict";

const { map, mergeMap, toArray } = require("rxjs/operators");
const { from, Observable, defer } = require("rxjs");

let mongoDB = undefined;
const COLLECTION_NAME = "WalletError";

class LogErrorDA {
  static start$(mongoDbInstance) {
    return Observable.create(observer => {
      if (mongoDbInstance) {
        mongoDB = mongoDbInstance;
        observer.next("using given mongo instance ");
      } else {
        mongoDB = require("./MongoDB").singleton();
        observer.next("using singleton system-wide mongo instance");
      }
      observer.complete();
    });
  }
  

  /**
   * Gets errors
   * @param {*} page Indicates the page number which will be returned
   * @param {*} count Indicates the max amount of rows that will be return.
   * @param {*} type error type
   */
  static getLogError$(page, count, type) {
    const collection = mongoDB.db.collection(COLLECTION_NAME);
    const query = {};
    if (type){
      query['type'] = type;
    }
    return defer(() =>
      collection
        .find(query)
        .sort({ timestamp: -1 })
        .skip(count * page)
        .limit(count)
        .toArray()
    ).pipe(
      mergeMap(logErrors => {
        return from(logErrors);
      }),
      map(log => {
        return {
          _id: log._id,
          error: log.error,
          timestamp: log.timestamp,
          event: JSON.stringify(log.event),
          type: log.type
        };
      }),
      toArray()
    );
  }

  /**
   * Gets errors count
   * @param {*} type error type
   */
  static getLogErrorCount$(type) {
    const query = {};
    if (type){
      query['type'] = type;
    }
    const collection = mongoDB.db.collection(COLLECTION_NAME);
    return defer(() => collection.count(query));
  }

  /**
   * Creates an error log
   * @param {*} log data to persist
   * @param {*} log.error Error detail
   * @param {*} log.event event where the error was generated
   * @param {*} log.type Error type
   */
  static persistLogError$(log) {
    const collection = mongoDB.db.collection(COLLECTION_NAME);
    const logErrorData = {
      error: log.error,
      timestamp: Date.now(),
      event: log.event,
      type: log.type
    };
    return defer(() => collection.insertOne(logErrorData));
  }
}

/**
 * Returns a LogErrorDA
 * @returns {LogErrorDA}
 */
module.exports = LogErrorDA;
