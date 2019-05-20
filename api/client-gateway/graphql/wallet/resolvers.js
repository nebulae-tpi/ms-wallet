"use strict";

const withFilter = require("graphql-subscriptions").withFilter;
const PubSub = require("graphql-subscriptions").PubSub;
const pubsub = new PubSub();

const { of, Observable, bindNodeCallback } = require("rxjs");
const { map, tap, mergeMap, switchMapTo } = require("rxjs/operators");

const broker = require("../../broker/BrokerFactory")();
const RoleValidator = require("../../tools/RoleValidator");

const INTERNAL_SERVER_ERROR_CODE = 23001;
const USERS_PERMISSION_DENIED_ERROR_CODE = 23002;
const { ApolloError } = require("apollo-server");

function getResponseFromBackEnd$(response) {
  return of(response)
  .pipe(
      map(({result, data}) => {            
          if (result.code != 200 && result.error) {
              throw new ApolloError(result.error.msg, result.code, result.error );
          }
          return data;
      })
  );
}


module.exports = {
  Query: {
    ClientWallet: (root, args, context, info) => {
      return RoleValidator.checkPermissions$(context.authToken.realm_access.roles, "ms-client", "ClientWallet",
        USERS_PERMISSION_DENIED_ERROR_CODE, "Permission denied", ["CLIENT"])
        .pipe(
          switchMapTo(
            broker.forwardAndGetReply$(
              "Client",
              "clientgateway.graphql.query.clientWallet", 
              { root, args, jwt: context.encodedToken },
              2000
            )
          ),
          mergeMap(response => getResponseFromBackEnd$(response))
        )
        .toPromise();
    }
  },
  // Mutation: {

  // },

  //// SUBSCRIPTIONS ///////
  Subscription: {
    ClientWalletUpdates: {
      subscribe: withFilter(
        (payload, variables, context, info) => {
          return pubsub.asyncIterator("ClientWalletUpdates");
        },
        (payload, variables, context, info) => {
          
          const clientId = context.authToken.clientId;
          const walletId = payload.ClientWalletUpdates._id;
          const userIsClient = context.authToken.realm_access.roles.includes("CLIENT");

          return (userIsClient && (clientId === walletId) );
        }
      )
    },
  }
};


//// SUBSCRIPTIONS SOURCES ////

const eventDescriptors = [
  {
      backendEventName: 'walletPocketUpdated',
      gqlSubscriptionName: 'ClientWalletUpdates',
      dataExtractor: (evt) => evt.data,// OPTIONAL, only use if needed
      onError: (error, descriptor) => console.log(`Error processing ${descriptor.backendEventName}`),// OPTIONAL, only use if needed
      onEvent: (evt, descriptor) => {
          console.log(`Event of type  ${descriptor.backendEventName} arraived`);
      },
      // OPTIONAL, only use if needed
  },
];


/**
* Connects every backend event to the right GQL subscription
*/
eventDescriptors.forEach(descriptor => {
  broker
      .getMaterializedViewsUpdates$([descriptor.backendEventName])
      .subscribe(
          evt => {
              if (descriptor.onEvent) {
                  descriptor.onEvent(evt, descriptor);
              }
              const payload = {};
              payload[descriptor.gqlSubscriptionName] = descriptor.dataExtractor ? descriptor.dataExtractor(evt) : evt.data
              pubsub.publish(descriptor.gqlSubscriptionName, payload);
          },

          error => {
              if (descriptor.onError) {
                  descriptor.onError(error, descriptor);
              }
              console.error(
                  `Error listening ${descriptor.gqlSubscriptionName}`,
                  error
              );
          },

          () => console.log(`${descriptor.gqlSubscriptionName} listener STOPPED`)
      );
});

