const eventSourcing = require('./BusinessES')();
const cqrs = require('./BusinessCQRS')();

module.exports = {
    eventSourcing,
    cqrs,
    "handleBusinessCreated$": eventSourcing.handleBusinessCreated$,
    "handleBusinessGeneralInfoUpdated$": eventSourcing.handleBusinessGeneralInfoUpdated$
};