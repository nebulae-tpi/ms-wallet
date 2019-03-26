"use strict";

require('datejs');

let mongoDB = undefined;
//const mongoDB = require('./MongoDB')();
const COLLECTION_NAME = "Service";
const { CustomError } = require("../../../tools/customError");
const { map, mergeMap, reduce, tap } = require("rxjs/operators");
const { of, Observable, defer, from, range } = require("rxjs");
const Crosscutting = require("../../../tools/Crosscutting");
const SERVICE_CLOSED_THRESHOLD = parseInt(process.env.SERVICE_CLOSED_THRESHOLD) || 5*60*1000; // FIVE MINUTES
const SERVICE_COMPLETED_THRESHOLD = parseInt(process.env.SERVICE_COMPLETED_THRESHOLD) || 30*60*1000; // 30 MINUTES
const STATES_TO_CLOSE_SERVICE = ["DONE", "CANCELLED_DRIVER", "CANCELLED_CLIENT", "CANCELLED_OPERATOR", "CANCELLED_SYSTEM"];

class ShiftDA {
  static start$(mongoDbInstance) {
    return Observable.create(observer => {
      if (mongoDbInstance) {
        mongoDB = mongoDbInstance;
        observer.next("using given mongo instance");
      } else {
        mongoDB = require("../../../data/MongoDB").singleton();
        observer.next("using singleton system-wide mongo instance");
      }
      observer.complete();
    });
  }


    /**
   * Find services to complete
   */
  static findServicesOnboardToComplete$(){
    const projection = { _id: 1, businessId: 1, state: 1, "vehicle.licensePlate": 1, "driver.documentId": 1, "client.id": 1 };
    const query = {
      $and: [
        { state: { $in: ['ON_BOARD'] } },
        { closed: false },
        { lastModificationTimestamp: { $lte: Date.now() - SERVICE_COMPLETED_THRESHOLD } }
      ]
    };

    return of(Date.today().getDate() <= 2)
      .pipe(
        mergeMap(searchInBeforeMonth => searchInBeforeMonth
          ? of({ start: -1, count: 2 })
          : of({ start: 0, count: 1 })
        ),
        mergeMap(({ start, count }) => range(start, count)),
        map(monthsToAdd => mongoDB.getHistoricalDb(undefined, monthsToAdd)),
        map(db => db.collection(COLLECTION_NAME)),
        mergeMap(collection => {
          const cursor = collection.find(query, { projection });
          return mongoDB.extractAllFromMongoCursor$(cursor);
        })
      );
  }

  /**
   * Find services to close
   */
  static findServicesToClose$(){
    const projection = { _id: 1, businessId: 1, state: 1, "vehicle.licensePlate": 1, "driver.documentId": 1, "client.id": 1 };
    const query = {
      $and: [
        { state: { $in: STATES_TO_CLOSE_SERVICE } },
        { closed: false },
        { lastModificationTimestamp: { $lte: Date.now() - SERVICE_CLOSED_THRESHOLD } }
      ]
    };

    return of(Date.today().getDate() <= 2)
      .pipe(
        mergeMap(searchInBeforeMonth => searchInBeforeMonth
          ? of({ start: -1, count: 2 })
          : of({ start: 0, count: 1 })
        ),
        mergeMap(({ start, count }) => range(start, count)),
        map(monthsToAdd => mongoDB.getHistoricalDb(undefined, monthsToAdd)),
        map(db => db.collection(COLLECTION_NAME)),
        mergeMap(collection => {
          const cursor = collection.find(query, { projection });
          return mongoDB.extractAllFromMongoCursor$(cursor);
        })
      );
  }



}
/**
 * @returns {ShiftDA}
 */
module.exports = ShiftDA;
