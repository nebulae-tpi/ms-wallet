"use strict";

let mongoDB = undefined;
const  { defer, Observable, of } = require('rxjs');
const { mergeMap, map, tap } = require('rxjs/operators');
const Crosscutting = require("../tools/Crosscutting");

const COLLECTION_NAME = `Transactions`;

class WalletTransactionDA {
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
   * Saves the transaction in a Mongo collection. The collection where the transaction
   * will be stored is determined according to the last four (4) characters of the uuid.
   * since these correspond to the month and year where the info will be persisted.
   *
   * @param {*} transactionData transaction to create
   */
  static saveTransactionHistory$(transactionData) {
    const collection = mongoDB
      .getHistoricalDbByYYMM(transactionData._id.split("-").pop())
      .collection(COLLECTION_NAME);
    return defer(() => collection.insertOne(transactionData));
  }

  /**
   * Gets transaction history by id.
   * @param {*} businessId ID of the business to filter
   * @param {*} transactionHistoryId ID of the transaction history
   */
  static getTransactionHistoryById$(businessId, transactionHistoryId) {
    const collection = mongoDB
      .getHistoricalDbByYYMM(transactionHistoryId.split("-").pop())
      .collection(COLLECTION_NAME);

    return of({ businessId, transactionHistoryId }).pipe(
      map(filter => {
        let query = {
          _id: transactionHistoryId
        };
        // if(filter.businessId){
        //   query.businessId = filter.businessId;
        // }
        return query;
      }),
      mergeMap(query => defer(() => collection.findOne(query)))
    );
  }

  /**
   * Gets transaction history by id.
   * @param {*} transactionHistoryIds ID of the transaction history
   */
  static getTransactionsHistoryByIds$(id, transactionHistoryIds, businessId) {
    const collection = mongoDB.getHistoricalDbByYYMM(id.split('-').pop()).collection(COLLECTION_NAME);
    const query = {
      _id: { $in: transactionHistoryIds },
      businessId: businessId
    };
    return defer(() => collection.find(query).limit(10).toArray());
  }

  /**
   * Gets transaction hsitory from a business according to the filters and the pagination.
   *
   * @param {*} filter Filter data
   * @param {*} filter.businessId ID of the business to filter
   * @param {*} filter.initDate start date range
   * @param {*} filter.endDate End date range
   * @param {*} filter.transactionType Transaction type filter
   * @param {*} filter.transactionConcept Transaction concept filter
   * @param {*} filter.terminal Terminal object
   * @param {*} filter.terminal.id Id of the terminal to filter
   * @param {*} filter.terminal.userId Id of the terminal user to filter
   * @param {*} filter.terminal.username username of the terminal user to filter
   * @param {*} pagination Pagination data
   * @param {*} pagination.page Page of the data to return
   * @param {*} pagination.count Count of records to return
   * @param {*} pagination.sortTimestamp Indicates if the info should be sorted asc or desc according to the timestamp.
   */
  static getTransactionsHistory$(filter, pagination) {
    return Observable.create(async observer => {
      const initDateFormat = new Date(filter.initDate);
      const collection = mongoDB
        .getHistoricalDb(initDateFormat)
        .collection(COLLECTION_NAME);

      const query = { walletId: filter.walletId };

      if (filter.initDate) {
        query.timestamp = query.timestamp || {};
        query.timestamp["$gte"] = filter.initDate;
      }

      if (filter.endDate) {
        query.timestamp = query.timestamp || {};
        query.timestamp["$lt"] = filter.endDate;
      }

      if (filter.transactionType) {
        query.type = filter.transactionType;
      }

      if (filter.transactionConcept) {
        query.concept = filter.transactionConcept;
      }

      const cursor = collection
        .find(query)
        .skip(pagination.count * pagination.page)
        .limit(pagination.count)
        .sort({ timestamp: pagination.sort });
      let obj = await this.extractNextFromMongoCursor(cursor);
      while (obj) {
        observer.next(obj);
        obj = await this.extractNextFromMongoCursor(cursor);
      }

      observer.complete();
    });
  }

  static getTransactionsHistoryDriverApp$(args, walletId) {
    return Observable.create(async observer => {
      const dateAsString = args.year + "/" + args.month + "/5";
      const initDateFormat = new Date(dateAsString);

      const collection = mongoDB
        .getHistoricalDb(initDateFormat)
        .collection(COLLECTION_NAME);
      const query = { walletId: walletId };

      // if(filter.transactionType){
      //   query.type = filter.transactionType;
      // }

      // if(filter.transactionConcept){
      //   query.concept = filter.transactionConcept;
      // }

      const cursor = collection
        .find(query)
        .skip(args.count * args.page)
        .limit(args.count)
        .sort({ timestamp: -1 });
      let obj = await this.extractNextFromMongoCursor(cursor);
      while (obj) {
        observer.next(obj);
        obj = await this.extractNextFromMongoCursor(cursor);
      }
      observer.complete();
    });
  }

  /**
   * Gets the amount of transactions history from a business according to the filters.
   *
   * @param {*} filter Filter data
   * @param {*} filter.businessId ID of the business to filter
   * @param {*} filter.initDate start date range
   * @param {*} filter.endDate End date range
   * @param {*} filter.transactionType Transaction type filter
   * @param {*} filter.transactionConcept Transaction concept filter
   * @param {*} filter.terminal Terminal object
   * @param {*} filter.terminal.id Id of the terminal to filter
   * @param {*} filter.terminal.userId Id of the terminal user to filter
   * @param {*} filter.terminal.username username of the terminal user to filter
   */
  static getTransactionsHistoryAmount$(filter) {
    const initDateFormat = new Date(filter.initDate);
    const collection = mongoDB
      .getHistoricalDb(initDateFormat)
      .collection(COLLECTION_NAME);
    const query = { businessId: filter.businessId, walletId: filter.walletId };

    if (filter.initDate) {
      query.timestamp = query.timestamp || {};
      query.timestamp["$gte"] = filter.initDate;
    }

    if (filter.endDate) {
      query.timestamp = query.timestamp || {};
      query.timestamp["$lt"] = filter.endDate;
    }

    if (filter.transactionType) {
      query.type = filter.transactionType;
    }

    if (filter.transactionConcept) {
      query.concept = filter.transactionConcept;
    }
    return collection.count(query);
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
 * Returns a WalletTransactionDA
 * @returns {WalletTransactionDA}
 */
module.exports = WalletTransactionDA;
