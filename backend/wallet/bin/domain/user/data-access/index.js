"use strict";

const { concat } = require('rxjs');

const ShiftDA = require("./ShiftDA");
const ServiceDA = require("./ServiceDA");

module.exports = {
  /**
   * Data-Access start workflow
   */
  start$: concat(ShiftDA.start$(), ServiceDA.start$()),
  /**
   * @returns {ShiftDA}
   */
  ShiftDA, 
  /**
   * @returns {ServiceDA}
   */
  ServiceDA
};
