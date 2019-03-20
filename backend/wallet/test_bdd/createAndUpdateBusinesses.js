// TEST LIBS
const assert = require("assert");
const uuidv4 = require("uuid/v4");
const expect = require("chai").expect;

const { take, mergeMap, catchError, map, tap, delay, toArray } = require('rxjs/operators');
const  { forkJoin, of, interval, concat, from } = require('rxjs');

//LIBS FOR TESTING
const MqttBroker = require("../bin/tools/broker/MqttBroker");
const MongoDB = require("../bin/data/MongoDB").MongoDB;

//
let mongoDB = undefined;
let broker = undefined;

const dbName = `test-${uuidv4()
  .toString()
  .slice(0, 5)}-wallet`;

// const dbName = `wallet`;

const environment = {
  NODE_ENV: "production",
  BROKER_TYPE: "MQTT",
  REPLY_TIMEOUT: 2000,
  GATEWAY_REPLIES_TOPIC_SUBSCRIPTION: "emi-gateway-replies-topic-mbe-wallet",
  MQTT_SERVER_URL: "mqtt://localhost:1883",
  MONGODB_URL: "mongodb://localhost:27017",
  MONGODB_DB_NAME: dbName,
  JWT_PUBLIC_KEY:
    "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAg4HWDCe7Ro6JzaX4/NQme1bmytli2MT3OkHks5Aq+2jmFYLx79p4NnzWpcG/Lc2BbBJfIEezCl/UMmgPDd9RIGGvonSmZYUx7cy0aZvDzxA1fIjczdQu5umFK5WrECDPgFri3X6O/tu6kF9hN683g822E1MRO4/47OvMfc/gEuCBwE+UWR0xqCFyskMd+qWYnMqiL/AZvthQrmhhmSn83n/e7eadh8oH3LRRfbrIPFF26FFhMrUUze/QwkUYcMPy8MMXs3SXFFEnSl3sz+gzwKphDwghPyFt5BZDcZOfMS3XHdhATmS3UlMPUOKuLNBEY9P8ocKsKO0F7ZHl0y4XRwIDAQAB\n-----END PUBLIC KEY-----",
  EVENT_STORE_BROKER_TYPE: "MQTT",
  EVENT_STORE_BROKER_EVENTS_TOPIC: "Events",
  EVENT_STORE_BROKER_URL: "mqtt://localhost:1883",
  EVENT_STORE_STORE_TYPE: "MONGO",
  EVENT_STORE_STORE_URL: "mongodb://localhost:27017",
  EVENT_STORE_STORE_AGGREGATES_DB_NAME: "Aggregates",
  EVENT_STORE_STORE_EVENTSTORE_DB_NAME: "EventStore",
  GMT_TO_SERVE: "GMT-5",
  WALLET_TRANSACTION_TYPES_CONCEPTS: {"SALE": ["RECARGA_CIVICA"], "MOVEMENT": ["DEPOSIT", "WITHDRAWAL"]}
};

/*
NOTES:
before run please start mongoDB:
  docker-compose up setup-rs

  remember to config /etc/hosts to resolve store-mongo1, store-mongo2, store-mongo3
    127.0.0.1 store-mongo1
    127.0.0.1 store-mongo2
    127.0.0.1 store-mongo3

*/

describe("E2E - Simple transaction", function() {
  /*
  * PREAPARE
  */
  describe("Prepare test DB and backends", function() {
    it("start wallet server", function(done) {
      this.timeout(60000);
      Object.keys(environment).forEach(envKey => {
        process.env[envKey] = environment[envKey];
        console.log(`env var set => ${envKey}:${process.env[envKey]}`);
      });

      const eventSourcing = require("../bin/tools/EventSourcing")();
      const eventStoreService = require("../bin/services/event-store/EventStoreService")();
      const BusinessDA = require('../bin/data/BusinessDA');
      const WalletDA = require('../bin/data/WalletDA');
      const WalletTransactionDA = require('../bin/data/WalletTransactionDA');
      const LogErrorDA = require('../bin/data/LogErrorDA');
      const SpendingRulesDA = require('../bin/data/SpendingRulesDA');
      mongoDB = require("../bin/data/MongoDB").singleton();
      
    of({})
        .pipe(
            mergeMap(() => concat(
                eventSourcing.eventStore.start$(),
                eventStoreService.start$(),
                mongoDB.start$(),
                BusinessDA.start$(),
                WalletDA.start$(),
                WalletTransactionDA.start$(),
                LogErrorDA.start$(),
                SpendingRulesDA.start$(),
            ))
        )
        .subscribe(
            evt => {
                console.log(evt);
            },
            error => {
                console.error("Failed to start", error);
                //process.exit(1);
                return done(error);
            },
            () => {
                console.log("wallet server started");
                return done();
            }
        )
    }),
    //   it("start acss-channel server", function(done) {
    //     this.timeout(3000);

    //     const eventSourcing = require("../../../../ms-acss-channel-afcc-reload/backend/acss-channel-afcc-reload/bin/tools/EventSourcing")();
    //     const eventStoreService = require("../../../../ms-acss-channel-afcc-reload/backend/acss-channel-afcc-reload/bin/services/event-store/EventStoreService")();
    //     const mongoDB = require("../../../../ms-acss-channel-afcc-reload/backend/acss-channel-afcc-reload//bin/data/MongoDB").singleton();
    //     const AfccReloadChannelDA = require("../../../../ms-acss-channel-afcc-reload/backend/acss-channel-afcc-reload/bin/data/AfccReloadChannelDA");
    //     const AfccReloadsDA = require("../../../../ms-acss-channel-afcc-reload/backend/acss-channel-afcc-reload/bin/data/AfccReloadsDA");
    //     const TransactionsDA = require("../../../../ms-acss-channel-afcc-reload/backend/acss-channel-afcc-reload/bin/data/TransactionsDA");
    //     const TransactionsErrorsDA = require("../../../../ms-acss-channel-afcc-reload/backend/acss-channel-afcc-reload/bin/data/TransactionsErrorsDA");
    //     // const graphQlService = require('./services/gateway/GraphQlService')();
    //     const Rx = require("rxjs");

    //     Rx.Observable.concat(
    //       eventSourcing.eventStore.start$(),
    //       eventStoreService.start$(),
    //       mongoDB.start$(),
    //       Rx.Observable.forkJoin(
    //         AfccReloadChannelDA.start$(),
    //         AfccReloadsDA.start$(),
    //         TransactionsDA.start$(),
    //         TransactionsErrorsDA.start$()
    //       )
    //       // graphQlService.start$()
    //     ).subscribe(
    //       evt => {
    //         // console.log(evt)
    //       },
    //       error => {
    //         console.error("Failed to start", error);
    //         // process.exit(1);
    //         return done(error);
    //       },
    //       () => {
    //         console.log("acss-channel-afcc-reload started");
    //         return done();
    //       }
    //     );
    //   }),
      it("start MQTT broker", function(done) {
        broker = new MqttBroker({
          mqttServerUrl: process.env.MQTT_SERVER_URL,
          replyTimeout: process.env.REPLY_TIMEOUT || 2000
        });
        done();
      });
  });


  

  /*
  * CREATE BUSINESS UNITS
  */
  describe("Create the business units", function () {
    it("Create one busines unit", function (done) {
      from([
        { _id: "123456789_Metro_med", name: "Metro de Medellin" },
        { _id: "123456789_Gana", name: "Gana Medellin" },
        { _id: "123456789_NebulaE_POS", name: "NebulaE_POS" },
        { _id: "123456789_PlaceToPay", name: "Place to Play" },
        { _id: "123456789_NebulaE", name: "NebulaE" },
        { _id: "123456789_surplus", name: "surplus collector" },
        { _id: "123456789_Pasarela", name: "Pasarela" }
      ]).
      pipe( 
        delay(20),
        mergeMap(bu =>
          broker.send$("Events", "", {
            et: "BusinessCreated",
            etv: 1,
            at: "Business",
            aid: bu._id,
            data: { generalInfo: bu, _id: bu._id },
            user: "juan.santa",
            timestamp: Date.now(),
            av: 164
          })
        ),
        toArray(),
        delay(1000)
      )
      .subscribe(
        evt => console.log(`Message sent to create a business unit: ${evt}`),
        error => {
          console.error(`sent message failded ${error}`);
          return done(error);
        },
        () => {
          return done();
        }
      );
    });
  });
  /*
  * DE-PREAPARE
  */

  describe("de-prepare test DB", function() {
    it("delete mongoDB", function(done) {
      this.timeout(8000);
      of({})
      .pipe(
          delay(5000),
          mergeMap(() => mongoDB.dropDB$())
      )
      .subscribe(
        evt => console.log(`${evt}`),
        error => {
          console.error(`Mongo DropDB failed: ${error}`);
          return done(error);
        },
        () => {
          return done();
        }
      );      
    });
    it("stop mongo", function(done) {
      this.timeout(4000);
      of({})
      .pipe(
        delay(1000),
        mergeMap(() => mongoDB.stop$() )
      )
      .subscribe(
        evt => console.log(`Mongo Stop: ${evt}`),
        error => {
          console.error(`Mongo Stop failed: ${error}`);
          return done(error);
        },
        () => {
          return done();
        }
      );       
    });
  });


});
