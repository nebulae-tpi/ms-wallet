const { of, Observable, bindNodeCallback } = require('rxjs');
const { map, tap } = require('rxjs/operators');
const request = require('request');

module.exports = {

  Query: {
    BusinessContactInfo: (root, args, context, info) => {
      return of(
        {
          name: 'NebulaE',
          whatsapp: 573004832728,
          phone: 3004832728,
          zello: 'zello://nyc?add_channel',
          defaultLocation: '6.164863, -75.601650'
        }
      )
        .toPromise()
    },
  },
}




