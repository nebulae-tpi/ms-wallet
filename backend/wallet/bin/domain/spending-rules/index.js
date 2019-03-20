const eventSourcing = require('./SpendingRulesES')();
const cqrs = require('./SpengingRulesCQRS')();

module.exports = {
    eventSourcing,
    cqrs
}