'use strict'

if (process.env.NODE_ENV !== 'production') {
    require('dotenv').load();
}


const eventSourcing = require('./tools/EventSourcing')();
const eventStoreService = require('./services/event-store/EventStoreService')();
const mongoDB = require('./data/MongoDB').singleton();
const BusinessDA = require('./data/BusinessDA');
const WalletDA = require('./data/WalletDA');
const WalletTransactionDA = require('./data/WalletTransactionDA');
const LogErrorDA = require('./data/LogErrorDA');
const SpendingRulesDA = require('./data/SpendingRulesDA');
const graphQlService_emi = require('./services/emi-gateway/GraphQlService')();
// const graphQlService_sales = require('./services/sales-gateway/GraphQlService')();
const { concat, forkJoin, of } = require('rxjs');
const { take, mergeMap, delay } = require('rxjs/operators');


const start = () => {
    concat(
        mongoDB.start$(),  // MongoDB primero
        // EventStore needs MongoDB to be ready, wait for it to fully initialize
        eventSourcing.eventStore.start$().pipe(
            take(2), // Wait for both "MQTT broker connecting" and "MongoStore DB connected"
            delay(2000), // Give EventStore MongoStore a moment to fully initialize
            mergeMap(() => of('EventStore ready'))
        ),
        eventStoreService.start$(),
        forkJoin(
            BusinessDA.start$(),
            WalletDA.start$(),
            WalletTransactionDA.start$(),
            LogErrorDA.start$(),
            SpendingRulesDA.start$()
        ),        
        graphQlService_emi.start$(),
        // graphQlService_sales.start$()
    ).subscribe(
        (evt) => {
            console.log('Start step:', evt);
        },
        (error) => {
            console.error('Failed to start', error);
            process.exit(1);
        },
        () => console.log('wallet started')
    );
};

start();
