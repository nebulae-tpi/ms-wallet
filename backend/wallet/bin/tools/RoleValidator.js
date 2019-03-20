const Rx = require("rxjs");
const { CustomError } = require("./customError");
const { take, mergeMap, tap, catchError, map, reduce} = require('rxjs/operators');
const  { forkJoin, of, interval, throwError, from } = require('rxjs');

/**
 * Role validator
 */
class RoleValidator {

    /**
 * Checks if the user has the permissions needed, otherwise throws an error according to the passed parameters.
 *
 * @param {*} UserRoles Roles of the authenticated user
 * @param {*} name Context name
 * @param {*} method method name
 * @param {*} error  This is the error that will be thrown if the user do not have the required roles
 * @param {*} requiredRoles Array with required roles (The authenticated user must have at least one of the required roles,
 *  otherwise the operation that the user is trying to do will be rejected.
 */
static checkPermissions$(
    userRoles,
    contextName,
    method,
    error,
    requiredRoles
  ) {
    return from(requiredRoles)
    .pipe(
      map(requiredRole => {
        const role = {name: requiredRole, value: false};
        if (
          userRoles == undefined ||
          userRoles.length == 0 ||
          !userRoles.includes(requiredRole)
        ) {
          role.value = false;
        }else{
          role.value = true;
        }
        
        return role;
      }),
      reduce((acc, val) => {
        acc[val.name] = val.value;
        return acc;
      }, {}),
      mergeMap(validRoles => {
        if (!Object.values(validRoles).includes(true)) {
          return throwError(
            new CustomError(contextName, method, error.code, error.description)
          );
        } else {
          return of(validRoles);
        }
      })
    );
  }
  
  /**
   * Returns true if the user has at least one of the required roles
   * @param {*} userRoles Roles of the user
   * @param {*} requiredRoles Required roles
   */
  static hasPermissions(
    userRoles,
    requiredRoles
  ) {
    if(requiredRoles == undefined || requiredRoles.length == 0){
      return true;
    }
  
    if (userRoles == undefined || userRoles.length == 0) {
      return false;
    }
  
    let found = false;
    for (const requiredRole in requiredRoles) {
      
      if (userRoles.includes(requiredRoles[requiredRole])) {
        found = true;
        break;
      }
    }
  
    return found;
  }

};
  
  module.exports = RoleValidator;