"use strict";

// const { concat } = require('rxjs');
const UserES = require("./UserES")();

// const DataAccess = require("./data-access/");

module.exports = {
  /**
   * domain start workflow
   */
  // start$: concat(DataAccess.start$()),
  // start$: concat(DataAccess.start$),
  /**
   * @returns {UserES}
   */
  UserES
};

