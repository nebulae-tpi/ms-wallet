const Rx = require("rxjs");

class BusinessHelper {

  constructor() { }


    /**
   * Creates a custom error observable
   * @param {*} errorCode Error code
   * @param {*} methodError Method where the error was generated
   */
  static createCustomError$(errorCode, methodError) {
    return Rx.Observable.throw(
      new CustomError(
        context,
        methodError || "",
        errorCode.code,
        errorCode.description
      )
    );
  }


}

/**
 * Business helpers
 * @returns {BusinessHelper}
 */
module.exports = BusinessHelper;
