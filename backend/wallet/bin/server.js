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
const graphQlService_sales = require('./services/sales-gateway/GraphQlService')();
const Rx = require('rxjs');

const start = () => {
    Rx.concat(
        eventSourcing.eventStore.start$(),
        eventStoreService.start$(),
        mongoDB.start$(),
        BusinessDA.start$(),
        WalletDA.start$(),
        WalletTransactionDA.start$(),
        LogErrorDA.start$(),
        SpendingRulesDA.start$(),
        graphQlService_emi.start$(),
        graphQlService_sales.start$()
    ).subscribe(
        (evt) => {
            // console.log(evt)
        },
        (error) => {
            console.error('Failed to start', error);
            process.exit(1);
        },
        () => console.log('wallet started')
    );
};

start();