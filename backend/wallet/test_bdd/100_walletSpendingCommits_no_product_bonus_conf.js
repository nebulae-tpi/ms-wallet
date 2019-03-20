// TEST LIBS
const assert = require("assert");
const uuidv4 = require("uuid/v4");
const expect = require("chai").expect;

const { take, mergeMap, map,tap,delay,toArray,reduce,concatMap,filter } = require("rxjs/operators");
const {forkJoin,of,interval,concat,from,observable,bindNodeCallback,defer,range } = require("rxjs");

//LIBS FOR TESTING
const MqttBroker = require("../bin/tools/broker/MqttBroker");
const MongoDB = require("../bin/data/MongoDB").MongoDB;

let BusinessDA = undefined;
let WalletDA = undefined;
let WalletTransactionDA = undefined;
let LogErrorDA = undefined;
let SpendingRulesDA = undefined;

//
let mongoDB = undefined;
let broker = undefined;

const dbName = `test-${uuidv4()
  .toString()
  .slice(0, 5)}-wallet`;

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
      BusinessDA = require("../bin/data/BusinessDA");
      WalletDA = require("../bin/data/WalletDA");
      WalletTransactionDA = require("../bin/data/WalletTransactionDA");
      LogErrorDA = require("../bin/data/LogErrorDA");
      SpendingRulesDA = require("../bin/data/SpendingRulesDA");
      mongoDB = require("../bin/data/MongoDB").singleton();

      of({})
        .pipe(
          mergeMap(() =>
            concat(
              eventSourcing.eventStore.start$(),
              eventStoreService.start$(),
              mongoDB.start$(),
              BusinessDA.start$(),
              WalletDA.start$(),
              WalletTransactionDA.start$(),
              LogErrorDA.start$(),
              SpendingRulesDA.start$()
            )
          )
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
        );
    }),
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
  describe("Create the business units", function() {
    const businessList = [ { _id: "123456789_Metro_med", name: "Metro de Medellin" } ]; // busines list demo
    it("Create one busines unit", function(done) {
      from(businessList)
        .pipe(
          delay(20),
          // send the command to create the business
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
          evt => {},
          error => {
            console.error(`sent message failded ${error}`);
            return done(error);
          },
          () => {
            return done();
          }
        );
    });

    it("verify its defaults documents", function(done) {
      of({})
        .pipe(
          mergeMap(() =>
            forkJoin(
              BusinessDA.getBusiness$(businessList[0]._id), // fecth the business mapped id vs name
              SpendingRulesDA.getSpendingRule$(businessList[0]._id), // fecth the spendinRule by default
              WalletDA.getWallet$(businessList[0]._id) // fect the wallet for the related  business
            )
          ),
          tap(([business, spendingRule, wallet]) => {
            expect(business).to.be.deep.equal(
              {
                _id: businessList[0]._id,
                name: businessList[0].name
              },
              "The businessId vs businessName expected"
            );

            expect({
              ...spendingRule,
              id: 0,
              _id: 0,
              lastEditionTimestamp: 0
            }).to.be.deep.equal(
              {
                _id: 0,
                id: 0,
                businessId: businessList[0]._id,
                businessName: businessList[0].name,
                minOperationAmount: 0,
                lastEditionTimestamp: 0,
                editedBy: "SYSTEM",
                productBonusConfigs: [],
                autoPocketSelectionRules: []
              },
              "Spending rule expected"
            );

            expect(spendingRule.id).to.be.equal(
              spendingRule.lastEditionTimestamp,
              "id and lastEditionTimestamp must to be equals"
            );

            expect({ ...wallet, _id: 0 }).to.be.deep.equal(
              {
                _id: 0,
                businessId: businessList[0]._id,
                businessName: businessList[0].name,
                spendingState: "FORBIDDEN",
                pockets: {
                  main: 0,
                  bonus: 0
                }
              },
              "Expected wallet by default"
            );
          })
        )
        .subscribe(
          ok => {},
          error => {
            console.log(error);
            return done(error);
          },
          () => {
            console.log(
              "Business, spendingRules and wallet documents were checked"
            );
            return done();
          }
        );
    });
  });

  /**
   * generate the 100 walletSpendingCommits
   */
  describe("process 100 walletSpending commits", function() {
    const businessList = [
      { _id: "123456789_Metro_med", name: "Metro de Medellin" }
    ];
    let valuesInTest = [1250,24300,10850,15100,49300,46800,18750,21350,26600,8450,11850,45300,5400,44550,40200,44100,18500,2000,250,16650,21800,
      26200,47600,8750,37050,43050,34650,11500,44950,10150,3150,28100,13200,41200,1150,4500,46300,20650,37950,26350,36850,48300,8750,37250,16250,
      14950,36600,20150,41000,34150,34850,35750,6550,4650,39800,38300,49950,1700,24450,49750,19100,40850,35650,46400,48350,1450,17950,33500,33650,
      15450,49450,11900,27050,39950,37150,36450,20050,44150,3050,16350,46400,30500,45300,6450,28700,30350,26850,27450,40100,24250,1950,11700,41800,
      25100,32700,44300,44550,48900,45600,9300];

    it("Process the 100 events", function(done) {
      this.timeout(7200000);
      const commitsEmitter = function(index, qty, businessId, delayTime = 0) {
        return range(index, qty).pipe(
          concatMap(i =>
            of(i).pipe(
              mergeMap(() =>
                broker.send$("Events", "", {
                  et: "WalletSpendingCommited",
                  etv: 1,
                  at: "Wallet",
                  aid: businessId,
                  data: {
                    businessId: businessId,
                    type: "VENTA",
                    concept: "RECARGA_CIVICA",
                    value: valuesInTest[i],
                    terminal: {},
                    user: "felipe.santa",
                    notes: "recarga de una civica desde pruebas BDD"
                  },
                  user: "juan.santa",
                  timestamp: Date.now(),
                  av: 164
                })
              ),
              delay(delayTime)
            )
          )
        );
      };

      const logger = function(qty, delayTime) {
        return range(0, qty).pipe(
          concatMap(i =>
            of(i).pipe(
              tap(() => console.log(`${i} of ${qty}`)),
              delay(delayTime)
            )
          )
        );
      };

      const timesToSendEvent = 100;
      const delayToSendEachPackage = 200;
      // const valuesInTest_ = [...Array(100)].map(e => {
      //   const randomNumner = Math.floor(Math.random() * 50000);
      //   return randomNumner - (randomNumner % 50);
      // });
      // console.log(JSON.stringify(valuesInTest_));

      of({})
        .pipe(
          mergeMap(() =>
            concat(
              // commitsEmitter(0, 1, businessList[0]._id, delayToSendEachPackage),
              forkJoin(
                // commitsEmitter(1, timesToSendEvent - 1, businessList[0]._id, delayToSendEachPackage),
                commitsEmitter(
                  0,
                  timesToSendEvent,
                  businessList[0]._id,
                  delayToSendEachPackage
                ),
                logger(timesToSendEvent, delayToSendEachPackage)
              )
            )
          ),
          toArray()          
        )
        .subscribe(
          () => console.log( "##### WALLET SPENDING COMMITS SENT WITHVALUES ==> ", JSON.stringify(valuesInTest) ),
          error => {
            console.log(error);
            return done(error);
          },
          () => done()
        );
    });
  });

  /**
   * wait for all transactions
   * 
   * to calculate the expected transactions, final pocket status use the following python code
   * http://tpcg.io/VmDyYR

   */
  describe("Wait for all transactions and check the wallet pockects", function() {
    const businessList = [
      { _id: "123456789_Metro_med", name: "Metro de Medellin" }
    ];
    const date = new Date();
    let month = date.getMonth() + 1;
    let year = date.getFullYear() + "";
    month = (month.length == 1 ? "0" : "") + month;
    year = year.substr(year.length - 2);

    it("WAIT FOR THE EXPECTED TRANSACTIONS", function(done) {
      let count = 0;
      let tickCounts = 0;
      const limitTicks = 10;
      const expectedTransactions = 100;
      this.timeout(7200000);
      const collection = mongoDB.client
        .db(dbName)
        .collection(`TransactionsHistory_${month}${year}`);
      interval(1000)
        .pipe(
          tap(() => {
            console.log("Waiting for all transactions creation...", count)
            console.log(`${tickCounts} try of ${limitTicks} `)
          }),
          mergeMap(() => defer(() => collection.count())),
          filter(c => {
            count = c;
            tickCounts++;
            return (count >= expectedTransactions || tickCounts >= limitTicks);
          }),
          take(1),
          tap((totalTransactions) => {
            expect(totalTransactions).to.be.equal(expectedTransactions)
          } ),
          delay(3000),
          mergeMap(() => WalletDA.getWallet$(businessList[0]._id)),
          tap(walletObj => {
            expect({ ...walletObj, _id: 0,  }).to.be.deep.equal({
              _id: 0,
              businessId: businessList[0]._id,
              businessName: businessList[0].name,
              spendingState: 'FORBIDDEN',
              pockets: {
                main: -2729950,
                bonus: 0
              }
            })
          })
          
        )
        .subscribe(
          finalWallet => console.log( "FINAL WALLET STATE IS  ==> ", JSON.stringify(finalWallet) ),
          error => {
            console.log(error);
            return done(error);
          },
          () => done()
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
          mergeMap(() => mongoDB.stop$())
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
