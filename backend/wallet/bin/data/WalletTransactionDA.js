"use strict";

let mongoDB = undefined;
const  { defer, Observable, of } = require('rxjs');
const { mergeMap, map, tap } = require('rxjs/operators');
const Crosscutting = require("../tools/Crosscutting");

const COLLECTION_NAME = `TransactionsHistory_`;

class WalletTransactionDA {

  static start$(mongoDbInstance) {
    return Observable.create((observer) => {
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
   * Saves the transaction in a Mongo collection. The collection where the transaction 
   * will be stored is determined according to the last four (4) characters of the uuid.
   * since these correspond to the month and year where the info will be persisted.
   * 
   * @param {*} transactionData transaction to create
   */
  static saveTransactionHistory$(transactionData) {
    const monthYear = transactionData._id.substr(transactionData._id.length - 4);
    const collection = mongoDB.db.collection(`${COLLECTION_NAME}${monthYear}`);    
    return defer(() => collection.insertOne(transactionData));
  }


  /**
   * Gets transaction history by id.
   * @param {*} businessId ID of the business to filter
   * @param {*} transactionHistoryId ID of the transaction history
   */
  static getTransactionHistoryById$(businessId, transactionHistoryId) {
    const monthYear = transactionHistoryId.substr(transactionHistoryId.length - 4);
    const collection = mongoDB.db.collection(`${COLLECTION_NAME}${monthYear}`);
    return of({businessId, transactionHistoryId})
    .pipe(
      map(filter => {
        let query = {
          _id: transactionHistoryId
        };
        if(filter.businessId){
          query.businessId = filter.businessId;
        }
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
    const monthYear = id.substr(id.length - 4);
    const collection = mongoDB.db.collection(`${COLLECTION_NAME}${monthYear}`);
    return of(transactionHistoryIds)
    .pipe(
      map(data => {
        let query = {
          _id: {$in: transactionHistoryIds},
          businessId: businessId
        };
        return query;
      }),
      mergeMap(query => defer(() => collection.find(query).limit(10).toArray()))
    );
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
      const monthYear = Crosscutting.getMonthYear(initDateFormat);
      const collection = mongoDB.db.collection(`${COLLECTION_NAME}${monthYear}`);
      const query = {
        businessId: filter.businessId,
      };

      if(filter.initDate){
        query.timestamp = query.timestamp || {};
        query.timestamp['$gte'] = filter.initDate;
      }

      if(filter.endDate){
        query.timestamp = query.timestamp || {};
        query.timestamp['$lt'] = filter.endDate;
      }

      if(filter.terminal && filter.terminal.id){
        query['terminal.id'] = filter.terminal.id;
      }

      if(filter.terminal && filter.terminal.userId){
        query['terminal.userId'] = filter.terminal.userId;
      }

      if(filter.terminal && filter.terminal.username){
        query['terminal.username'] = filter.terminal.username;
      }

      if(filter.transactionType){
        query.type = filter.transactionType;
      }

      if(filter.transactionConcept){
        query.concept = filter.transactionConcept;
      }

      //console.log('Query => ', JSON.stringify(query));
      const cursor = collection.find(query).skip(pagination.count * pagination.page).limit(pagination.count).sort({timestamp: pagination.sort});
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
    const monthYear = Crosscutting.getMonthYear(initDateFormat);
    const collection = mongoDB.db.collection(`${COLLECTION_NAME}${monthYear}`);
    const query = {
      businessId: filter.businessId,
    };

    if(filter.initDate){
      query.timestamp = query.timestamp || {};
      query.timestamp['$gte'] = filter.initDate;
    }

    if(filter.endDate){
      query.timestamp = query.timestamp || {};
      query.timestamp['$lt'] = filter.endDate;
    }

    if(filter.terminal && filter.terminal.id){
      query['terminal.id'] = filter.terminal.id;
    }

    if(filter.terminal && filter.terminal.userId){
      query['terminal.userId'] = filter.terminal.userId;
    }

    if(filter.terminal && filter.terminal.username){
      query['terminal.username'] = filter.terminal.username;
    }

    if(filter.transactionType){
      query.type = filter.transactionType;
    }

    if(filter.transactionConcept){
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
