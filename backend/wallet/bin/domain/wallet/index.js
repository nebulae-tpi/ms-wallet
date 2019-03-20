const eventSourcing = require('./WalletES')();
const cqrs = require('./WalletCQRS')();

module.exports = {
    eventSourcing,
    cqrs
};