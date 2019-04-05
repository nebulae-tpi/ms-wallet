const { of, Observable, bindNodeCallback } = require('rxjs');
const { map, tap } = require('rxjs/operators');
const request = require('request');



const buildMqttParams = (context) => {
  const mqttParamsCount = process.env.DRIVER_APP_MQTT_DRIVER_URL.split(';').length;
  let i;
  let params = [];
  for (i = 0; i < mqttParamsCount; i++) {
    params.push(
      {
        url: process.env.DRIVER_APP_MQTT_DRIVER_URL.split(';')[i],
        port: parseInt(process.env.DRIVER_APP_MQTT_DRIVER_PORT.split(';')[i]),
        clientId: context.authToken.preferred_username,
        user: process.env.DRIVER_APP_MQTT_DRIVER_USER.split(';')[i],
        password: process.env.DRIVER_APP_MQTT_DRIVER_PASSWORD.split(';')[i],
        order: i
      },
    );
  };
  return params;
};

const buildGoogleMapsParams = () => {
  return {
    googleMapsAndroidKey: process.env.GOOGLE_MAPS_ANDROID_KEY,
    googleMapsBrowserKey: process.env.GOOGLE_MAPS_BROWSER_KEY
  };
}

const buildPredefinedMessages = () => {  
  const predefinedMessages = JSON.parse(process.env.PREDEFINED_MESSAGES_DRIVER);
  return predefinedMessages.messages;
}


module.exports = {

  Query: {

    MqttParams: (root, args, context, info) => {
      return of(buildMqttParams(context)).toPromise()
    },


    GoogleMapsParams: (root, args, context, info) => {
      return of({
        googleMapsAndroidKey: process.env.GOOGLE_MAPS_ANDROID_KEY,
        googleMapsBrowserKey: process.env.GOOGLE_MAPS_BROWSER_KEY
      }).toPromise()
    },


    Params: (root, args, context, info) => {
      return of({
        GoogleMapsParams: buildGoogleMapsParams(),
        MqttParams: buildMqttParams(context)
      }).toPromise()
    },

    PredefinedMessages: (root, args, context, info) => {
      return of(buildPredefinedMessages())
      .toPromise()
    }

  },
}




