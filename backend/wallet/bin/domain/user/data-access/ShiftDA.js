"use strict";

require('datejs');

let mongoDB = undefined;
//const mongoDB = require('./MongoDB')();
const COLLECTION_NAME = "Shift";
const { CustomError } = require("../../../tools/customError");
const { map, mergeMap, reduce, tap } = require("rxjs/operators");
const { of, Observable, defer, from, range } = require("rxjs");
const Crosscutting = require("../../../tools/Crosscutting");

const SHIFT_DISCONNECT_THRESHOLD = parseInt(process.env.SHIFT_DISCONNECT_THRESHOLD) || 5 * 60 * 1000; // FIVE MINUTES
const SHIFT_CLOSE_THRESHOLD =  parseInt(process.env.SHIFT_CLOSE_THRESHOLD) || 60 * 60 * 1000; // TWELVE HOUR


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
   * Get the Shift data
  * @param {string} id Shift ID
   */
  static getShiftById$(id) {
    const collection = mongoDB.getHistoricalDbByYYMM(id.substring(id.length - 4)).collection(COLLECTION_NAME);
    return defer(() => collection.findOne(
      { _id: id },
      { projection: { stateChanges: 0, onlineChanges: 0 } }
    ));
  }

  static getShiftList$(filter, pagination) {
    const projection = { stateChanges: 0, onlineChanges: 0 };
    const query = {};


    if (filter.businessId) { query["businessId"] = filter.businessId; }
    if (filter.driverDocumentId) { query["driver.documentId"] = filter.driverDocumentId; }
    if (filter.driverFullname) { query["driver.fullname"] = { $regex: filter.driverFullname, $options: "i" }; }
    if (filter.vehicleLicensePlate) { query["vehicle.licensePlate"] = { $regex: filter.vehicleLicensePlate, $options: "i" }; }
    if (filter.states) { query["state"] = { $in: filter.states }; }
    if (filter.initTimestamp && filter.endTimestamp) { }
    if (filter.showClosedShifts && filter.initTimestamp && filter.endTimestamp) {
      query.timestamp = { $gte: filter.initTimestamp, $lt: filter.endTimestamp };
    }

    return of(query.timestamp)
      .pipe(
        mergeMap(includeClosed => includeClosed
          ? of({})
            .pipe(
              mergeMap(() => {
                const date1 = new Date(new Date(filter.initTimestamp).toLocaleString('es-CO', { timeZone: 'America/Bogota' }));
                const date2 = new Date(new Date(filter.endTimestamp).toLocaleString('es-CO', { timeZone: 'America/Bogota' }));
                const dateNow = new Date(new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }));
                const monthsBeforedate1 = (Crosscutting.getYearMonthArray(date1, dateNow).length * -1) + 1;
                const monthsBeforedate2 = Crosscutting.getYearMonthArray(date1, date2).length;
                return of({
                  start: monthsBeforedate1,
                  count: monthsBeforedate2
                });
              })
            )
          : of(Date.today().getDate() <= 2)
            .pipe(
              mergeMap(searchInBeforeMonth => searchInBeforeMonth
                ? of({ start: -1, count: 2 })
                : of({ start: 0, count: 1 })
              )
            )
        ),
        mergeMap(({ start, count }) => range(start, count)),
        map(monthsToAdd => mongoDB.getHistoricalDb(undefined, monthsToAdd)),
        map(db => db.collection(COLLECTION_NAME)),
        mergeMap(collection => {
          const cursor = collection
            .find(query, { projection })
            .skip(pagination.count * pagination.page)
            .limit(pagination.count)
            .sort({ creationTimestamp: pagination.sort });

          return mongoDB.extractAllFromMongoCursor$(cursor);
        }));
  }


  static getShiftListSize$(filter) {
    const query = {};


    if (filter.businessId) { query["businessId"] = filter.businessId; }
    if (filter.driverDocumentId) { query["driver.documentId"] = filter.driverDocumentId; }
    if (filter.driverFullname) { query["driver.fullname"] = { $regex: filter.driverFullname, $options: "i" }; }
    if (filter.vehicleLicensePlate) { query["vehicle.licensePlate"] = { $regex: filter.vehicleLicensePlate, $options: "i" }; }
    if (filter.states) { query["state"] = { $in: filter.states }; }
    if (filter.initTimestamp && filter.endTimestamp) { }
    if (filter.showClosedShifts && filter.initTimestamp && filter.endTimestamp) {
      query.timestamp = { $gte: filter.initTimestamp, $lt: filter.endTimestamp };
    }

    return of(query.timestamp)
      .pipe(
        mergeMap(includeClosed => includeClosed
          ? of({})
            .pipe(
              mergeMap(() => {
                const date1 = new Date(new Date(filter.initTimestamp).toLocaleString('es-CO', { timeZone: 'America/Bogota' }));
                const date2 = new Date(new Date(filter.endTimestamp).toLocaleString('es-CO', { timeZone: 'America/Bogota' }));
                const dateNow = new Date(new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }));
                const monthsBeforedate1 = (Crosscutting.getYearMonthArray(date1, dateNow).length * -1) + 1;
                const monthsBeforedate2 = Crosscutting.getYearMonthArray(date1, date2).length;
                return of({
                  start: monthsBeforedate1,
                  count: monthsBeforedate2
                });

              })
            )
          : of(Date.today().getDate() <= 2)
            .pipe(
              mergeMap(searchInBeforeMonth => searchInBeforeMonth
                ? of({ start: -1, count: 2 })
                : of({ start: 0, count: 1 })
              )
            )
        ),
        mergeMap(({ start, count }) => range(start, count)),
        map(monthsToAdd => mongoDB.getHistoricalDb(undefined, monthsToAdd)),
        map(db => db.collection(COLLECTION_NAME)),
        mergeMap(collection => collection.count(query))

      );
  }


  static getShiftStateChangeList$(shiftId, pagination) {
    const collection = mongoDB.getHistoricalDbByYYMM(shiftId.substring(shiftId.length - 4)).collection(COLLECTION_NAME);
    return defer(() => collection
      .find({ _id: shiftId })
      .project({ _id: 1, stateChanges: { $slice: [pagination.count * pagination.page, pagination.count] } })
      .toArray()
    )
      .pipe(
        map(result => result ? result[0].stateChanges : [])
      )
  }

  static getShiftStateChangeListSize$(shiftId) {
    const collection = mongoDB.getHistoricalDbByYYMM(shiftId.substring(shiftId.length - 4)).collection(COLLECTION_NAME);

    return defer(() => collection.aggregate([
      { $match: { _id: shiftId } },
      {
        $project: {
          _id: 1,
          stateChangeListSize: { $cond: { if: { $isArray: "$stateChanges" }, then: { $size: "$stateChanges" }, else: -1 } }
        }
      }
    ])
      .toArray()
    )
      .pipe(
        map(result => result ? result[0].stateChangeListSize : 0),
      )
  }



  static getShiftOnlineChangeList$(shiftId, pagination) {
    const collection = mongoDB.getHistoricalDbByYYMM(shiftId.substring(shiftId.length - 4)).collection(COLLECTION_NAME);
    return defer(() => collection
      .find({ _id: shiftId })
      .project({ _id: 1, onlineChanges: { $slice: [pagination.count * pagination.page, pagination.count] } })
      .toArray()
    )
      .pipe(
        map(result => result ? result[0].onlineChanges : [])
      )
  }

  static getShiftOnlineChangeListSize$(shiftId) {
    const collection = mongoDB.getHistoricalDbByYYMM(shiftId.substring(shiftId.length - 4)).collection(COLLECTION_NAME);

    return defer(() => collection.aggregate([
      { $match: { _id: shiftId } },
      {
        $project: {
          _id: 1,
          onlineChangesListSize: { $cond: { if: { $isArray: "$onlineChanges" }, then: { $size: "$onlineChanges" }, else: -1 } }
        }
      }
    ])
      .toArray()
    )
      .pipe(
        map(result => result ? result[0].onlineChangesListSize : 0),
      )
  }


  static getShiftsToDisconnect$() {
    const projection = { _id: 1, businessId: 1, "driver.id": 1, "vehicle.id": 1, "vehicle.licensePlate": 1 };
    const query = {
      $and: [
        { state: { $ne: "CLOSED" } },
        { online: true },
        { lastReceivedComm: { $lte: Date.now() - SHIFT_DISCONNECT_THRESHOLD } }
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
          const cursor = collection
            .find(query, { projection });


          return mongoDB.extractAllFromMongoCursor$(cursor);
        })
      );
  }

  static getShiftsToClose$() {

    const projection = { _id: 1, businessId: 1, "driver.id": 1, "vehicle.id": 1, "vehicle.licensePlate": 1 };
    const query = {
      $and: [
        { online: false },
        { state: { $ne: "CLOSED" } },
        { state: { $ne: "BUSY" } },
        { lastReceivedComm: { $lte: Date.now() - SHIFT_CLOSE_THRESHOLD } }
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
          const cursor = collection
            .find(query, { projection });
          return mongoDB.extractAllFromMongoCursor$(cursor);
        })
      );


  }


}
/**
 * @returns {ShiftDA}
 */
module.exports = ShiftDA;
