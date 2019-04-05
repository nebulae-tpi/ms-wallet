const { of, Observable, bindNodeCallback } = require('rxjs');
const { map, tap } = require('rxjs/operators');
const request = require('request');

module.exports = {

  Mutation: {
    createToken: (root, args, context, info) => {
      //console.log(JSON.stringify(args));
      return bindNodeCallback(request.post)({
        headers: { 'content-type': 'application/json' },
        url: args.base_url,
        form: args
      }).pipe(
        map(([resp, jsonStr]) => JSON.parse(jsonStr))
      ).toPromise()
    },
    refreshToken: (root, args, context, info) => {
      return bindNodeCallback(request.post)({
        headers: { 'content-type': 'application/json' },
        url: args.base_url,
        form: args
      }).pipe(
        map(([resp, jsonStr]) => JSON.parse(jsonStr))
      ).toPromise()
    },
  },
}




