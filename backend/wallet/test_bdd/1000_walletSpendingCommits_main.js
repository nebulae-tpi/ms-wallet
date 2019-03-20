// TEST LIBS
const assert = require("assert");
const uuidv4 = require("uuid/v4");
const expect = require("chai").expect;

const { take,mergeMap,map,tap,delay,toArray,concatMap,filter } = require("rxjs/operators");
const { forkJoin,of,interval,concat,from,defer,range } = require("rxjs");

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
    });

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
          evt => console.log("business unit created"),
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
   * Create spending rule
   */
  describe("Create SpendingRule", function() {
    const businessList = [ { _id: "123456789_Metro_med", name: "Metro de Medellin" } ]; // busines list demo
    let beforeSpendingRule = undefined;
    let afterSpendingRule = undefined;

    it("Update minOperationAmount and generate a ALLOWED state for spendingState ", function(done) {
      of({})
        .pipe(
          mergeMap(() => SpendingRulesDA.getSpendingRule$(businessList[0]._id)), // get the current spendingRule
          tap(spendingRule => (beforeSpendingRule = spendingRule)),
          map(
            ({
              businessId,
              productBonusConfigs,
              autoPocketSelectionRules
            }) => ({
              businessId,
              minOperationAmount: -1500000,
              productBonusConfigs,
              autoPocketSelectionRules
            })
          ),
          // give a debt capacity to 750.000
          mergeMap(spendingRuleUpdate =>
            broker.send$("Events", "", {
              et: "SpendingRuleUpdated",
              etv: 1,
              at: "SpendingRule",
              aid: businessList[0]._id,
              data: { input: spendingRuleUpdate },
              user: "juan.santa",
              timestamp: Date.now(),
              av: 164
            })
          ),
          delay(1000),
          mergeMap(() =>
            forkJoin(
              SpendingRulesDA.getSpendingRule$(businessList[0]._id),
              WalletDA.getWallet$(businessList[0]._id)
            )
          ), // get the current spendingRule
          tap(([spendingRule, wallet]) => (afterSpendingRule = spendingRule)),
          tap(([spendingRule, wallet]) => {
            expect(beforeSpendingRule.minOperationAmount).to.be.equal(0);
            expect(afterSpendingRule.minOperationAmount).to.be.equal(-1500000);
            expect(afterSpendingRule.editedBy).to.be.equal("juan.santa");
            expect({ ...wallet, _id: 0 }).to.be.deep.equal(
              {
                _id: 0,
                businessId: businessList[0]._id,
                businessName: businessList[0].name,
                spendingState: "ALLOWED",
                pockets: {
                  main: 0,
                  bonus: 0
                }
              },
              "must to be deep equal with allowed at spendingstate"
            );
          })
        )
        .subscribe(evt => {}, error => done(error), () => done());
    });

    it("Insert a new productBonusConfig", function(done) {
      // new productBonusConfig to add at spendingRule
      const productBonusConfigs = [
        {
          type: "VENTA",
          concept: "RECARGA_CIVICA",
          bonusType: "PERCENTAGE",
          bonusValueByMain: 0,
          bonusValueByCredit: 0
        }
      ];

      of({})
        .pipe(
          mergeMap(() => SpendingRulesDA.getSpendingRule$(businessList[0]._id)), // get the current spendingRule
          tap(spendingRule => (beforeSpendingRule = spendingRule)), // save the current spendingRule
          map(
            ({ businessId, minOperationAmount, autoPocketSelectionRules }) => 
              ({
                businessId,
                minOperationAmount,
                productBonusConfigs,
                autoPocketSelectionRules
              })            
          ),
          // send the event to update the spending rule with the new productBonusConfig
          mergeMap(spendingRuleUpdate =>
            broker.send$("Events", "", {
              et: "SpendingRuleUpdated",
              etv: 1,
              at: "SpendingRule",
              aid: businessList[0]._id,
              data: { input: spendingRuleUpdate },
              user: "juan.santa",
              timestamp: Date.now(),
              av: 164
            })
          ),
          delay(1000),
          mergeMap(() =>
            forkJoin(
              SpendingRulesDA.getSpendingRule$(businessList[0]._id), // get the new spendingRule from DB
              WalletDA.getWallet$(businessList[0]._id) // get the wallet from DB
            )
          ), // get the current spendingRule
          tap(([spendingRule, wallet]) => (afterSpendingRule = spendingRule)), 
          tap(([spendingRule, wallet]) => {
            expect(beforeSpendingRule.minOperationAmount).to.be.equal(-1500000);
            expect(afterSpendingRule.minOperationAmount).to.be.equal(-1500000);
            expect(afterSpendingRule.productBonusConfigs).to.be.length(1,"Must to be just one element here");
            expect(afterSpendingRule.productBonusConfigs[0]).to.be.deep.equal(productBonusConfigs[0]);
            expect(afterSpendingRule.editedBy).to.be.equal("juan.santa");

            expect({ ...wallet, _id: 0 }).to.be.deep.equal(
              {
                _id: 0,
                businessId: businessList[0]._id,
                businessName: businessList[0].name,
                spendingState: "ALLOWED",
                pockets: {
                  main: 0,
                  bonus: 0
                }
              },
              ""
            );
            console.log("#######################################");
          })
        )
        .subscribe(evt => {}, error => done(error), () => done());
    });

  });

  /**
   * generate the 100 walletSpendingCommits
   */
  describe("process 100 walletSpending commits", function() {
    const businessList = [ { _id: "123456789_Metro_med", name: "Metro de Medellin" } ]; // busines list demo
    let valuesInTest = [46400,34250,3600,6550,42600,47400,5850,31450,15650,27950,9900,33650,30250,9400,37850,39050,15050,13500,42800,5100,27800,46600,
      25650,9450,23650,16100,47300,16400,10350,37750,48450,33950,200,37350,39750,24200,14650,32950,6200,29000,11600,1550,26200,10600,23600,48250,10650,
      41200,9800,7100,36250,29950,44950,7200,19300,24500,43400,3500,39550,45250,19550,14200,19600,28900,2800,37400,44100,9650,49750,10300,17150,44700,
      2850,22850,26750,17500,21150,36500,12250,47450,39650,23500,5400,22850,2250,18850,8650,29100,28800,37200,40650,24150,34750,48200,7400,46150,
      12700,38700,13800,38400,11500,29550,2950,27100,33750,49650,16350,26600,31950,35400,40200,49000,14800,49850,41450,21850,30050,7250,1850,37000,
      44550,17850,24800,34750,11550,7150,20800,5800,34450,45850,5600,44100,3150,31050,27400,32400,49850,7400,42550,18150,32300,48400,43350,19500,850,
      33550,11550,40050,650,26700,13150,39750,42900,21500,30100,46300,15000,14900,29400,47750,15650,46050,29250,46900,42200,8400,28700,20750,22550,
      41800,28850,34050,47250,47050,21200,1550,44050,22800,41700,5250,16200,16450,25450,43300,34600,46100,6950,17900,47000,21500,2100,41950,45000,
      26450,46600,8400,41350,46600,14250,30100,28750,22850,22700,38600,27700,46000,40600,40600,46350,18250,16100,6250,20500,32100,29900,44250,17550,
      5550,27450,41800,41350,44150,31250,49250,21300,38750,1150,21900,15950,38900,32050,25600,38650,3000,33350,42700,36350,38650,23800,19200,24950,
      6050,46000,43100,28900,3100,45600,48650,4050,39850,6500,21500,24550,10600,42250,17250,38400,15350,8300,36750,20050,18650,24550,35850,31550,8450,
      26400,20200,46950,46000,3850,33500,3800,30300,31250,35550,32550,12750,17750,25250,48500,35950,25500,45550,39850,36300,14350,9550,45500,2000,40900,
      40800,41300,39150,18900,32600,41300,32200,45650,42200,36500,34050,44450,14400,21250,22350,30600,23850,25150,26700,40200,22450,14850,28950,5700,
      20650,42150,23550,12500,40900,35100,46050,2350,44150,25900,40100,3350,22200,34150,24350,40750,41450,13850,7450,23400,34300,39050,38550,21400,
      20650,45750,47350,30300,32250,19050,39800,4200,13800,25500,7950,42350,44650,39250,27550,20750,39000,40950,18850,14800,38900,44200,40150,33000,
      20600,26100,34250,6800,38400,11150,8300,40700,12300,43800,9500,7800,28150,25100,20600,14700,40300,7850,28000,10700,45700,39600,29950,28850,
      28900,40000,22350,5900,7800,5250,36700,33600,35700,1600,47100,43300,17950,17300,42800,4650,39550,48300,22650,4400,31600,5650,17850,15250,28700,
      42550,33200,24050,46250,37900,37350,39100,17650,3400,45250,45850,21300,11500,21550,26050,12850,46150,47900,33100,8900,4900,43100,24050,10700,
      48950,41500,34350,1000,37900,33450,1050,4500,46250,34450,36850,44700,11150,10000,500,21450,21350,26800,21150,32950,33450,14500,19750,10950,13650,
      43250,14150,49500,20450,27550,36700,1050,19200,35750,37350,16950,500,24200,19600,17250,23800,18500,45250,27350,11150,8350,6350,49400,10400,13700,
      39700,45000,9200,4550,15300,45500,30000,31350,5400,11000,49600,14550,30150,15900,4850,45100,43900,24500,38100,3450,15850,13950,17850,2250,23850,
      16050,23650,15450,23950,27000,11150,15250,41400,32800,4050,7700,15700,14950,26800,12550,28650,31700,45450,34950,37150,35500,35200,44050,39700,
      24850,6650,14200,10800,36000,16700,11750,2250,31750,550,25200,35800,44750,2250,31300,47600,46900,750,36750,9000,31100,20100,1900,700,15050,43300,
      19400,20000,2350,44000,49600,24800,46600,4600,13450,31350,33700,10100,45750,10750,32400,29500,44850,35550,8300,28050,48850,28500,48100,24100,8350,
      27300,16900,21900,26800,46150,13800,38850,1550,24000,3800,9200,26600,44900,25500,45250,49500,12700,45550,3200,33550,34800,23500,23450,16450,
      49250,14650,49450,22900,9850,22850,25200,16400,44700,12500,44800,15800,5850,21300,5850,22500,35500,15950,15000,29550,9000,44100,42900,7100,41300,
      700,30500,33600,45500,38900,15900,39000,38100,27100,26050,39700,34300,10450,43300,9050,22600,36000,46200,40500,26950,41650,42950,3450,23450,
      3000,41700,18950,46950,14500,200,41750,47000,8450,27850,13950,7050,17400,37100,49050,24100,8300,6800,10100,25350,8850,43750,19500,9900,10250,
      1100,26200,32900,31100,8050,47350,2850,22700,31900,16400,34450,2400,14750,15700,3450,49450,46400,3050,12900,31450,7450,33700,38000,39000,2450,
      35150,30650,40850,34250,18900,30100,39950,4650,15200,2800,12300,38600,12400,18200,27600,8250,45100,17550,40300,28800,49150,23600,1450,40050,
      26850,21400,28300,33650,44450,18600,23650,43150,14750,10900,9900,29350,18550,35300,31900,13150,12700,15050,40450,39500,44350,6250,42650,40150,
      36300,30400,47050,4000,43150,46500,30250,10250,9600,44650,24850,31950,34150,12800,27350,1550,39800,13100,10050,31600,23450,38150,10900,12250,
      37400,46900,5150,30050,19850,13450,5500,8750,31750,38350,4250,31200,8500,30800,49550,8850,12700,16700,33800,950,36900,25700,32250,10150,37950,
      2950,41600,22800,45950,14600,41000,9400,28100,1500,31900,3500,47450,11750,12850,11000,2850,19000,350,6900,25900,3450,27650,5100,1950,4250,14100,
      7150,26700,9200,45400,32900,29650,5150,17800,23100,23750,31950,49350,19800,36400,44050,35550,6600,28250,8600,25800,22050,13300,23250,15550,8450,
      47850,45050,43200,49000,33100,45650,25750,34250,28800,49600,2000,42950,16100,10200,25150,38950,43050,6100,34600,25600,25350,31500,22600,30300,
      40750,30250,49250,29500,23250,8400,40700,24850,9350,38550,48300,36250,7950,5750,40200,31900,29100,27100,28150,24150,13550,21600,15550,21350,
      17000,5650,7000,48950,42650,11450,13750,4600,20600,39550,29500,47150,15800,34600,29100,250,5450,31500,6700,46900,11450,48450,22950,37400,16500,
      13850,11350,9550,31100,19800,19800,32550,12250,36250,24350,41100,20800,7000,4700,16200,45250,15700,39750,11300,23350,30750,5600,25000,6200,44550,
      3650,32650,17300,36950,40950,5850,27050,21400,28950,4350,13250,30500,40250,15950,16550,34400,49600,10150,1350,35600,16100,29450,36450,1050,8450,
      2550,10250,40900,22650,250,4300,29600,21700,11150,31550,12100,11600,900,48500,32700,7450,34950,43350,10800,3100]

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

      const timesToSendEvent = 500;
      const delayToSendEachPackage = 50;
      // const valuesInTest_ = [...Array(1000)].map(e => {
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
                commitsEmitter( 0, timesToSendEvent, businessList[0]._id, delayToSendEachPackage ),
                commitsEmitter( 500, timesToSendEvent, businessList[0]._id, delayToSendEachPackage ),
                logger(timesToSendEvent, delayToSendEachPackage)
              )
            )
          ),
          toArray()          
        )
        .subscribe(
          () => console.log( "##### WALLET SPENDING COMMITS SENT WITHVALUES ==> ", valuesInTest ),
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
      const expectedTransactions = 1000;
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
            expect(totalTransactions).to.be.equal(expectedTransactions, "Must to have 1000 transactions")
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
                main: -25490100,
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
