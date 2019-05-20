const withFilter = require("graphql-subscriptions").withFilter;
const PubSub = require("graphql-subscriptions").PubSub;
const pubsub = new PubSub();
const { of } = require("rxjs");
const { map, mergeMap, catchError } = require('rxjs/operators');
const broker = require("../../broker/BrokerFactory")();
const RoleValidator = require('../../tools/RoleValidator');
const { CustomError } = require("../../tools/customError");
//Every single error code
// please use the prefix assigned to this microservice
const INTERNAL_SERVER_ERROR_CODE = 19001;
const PERMISSION_DENIED_ERROR_CODE = 19002;
const { ApolloError } = require("apollo-server");
const { handleError$ } = require('../../tools/GraphqlResponseTools');
const CONTEXT_NAME = "WALLET";


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
  //// QUERY ///////
  Query: {
    getWalletTransactionsHistory(root, args, context) {
      return RoleValidator.checkPermissions$(
        context.authToken.realm_access.roles,
        CONTEXT_NAME,
        "getWalletTransactionsHistory",
        PERMISSION_DENIED_ERROR_CODE,
        "Permission denied",
        ["PLATFORM-ADMIN", "DRIVER", "CLIENT", "BUSINESS-OWNER", "OPERATOR", "OPERATION-SUPERVISOR"]
      )
        .pipe(
          mergeMap(() => broker.forwardAndGetReply$(
              "Wallet", "emigateway.graphql.query.getWalletTransactionsHistory",
              { root, args, jwt: context.encodedToken }, 2000
          )),
          catchError(err => handleError$(err, "getWalletTransactionsHistory")),
          mergeMap(response => getResponseFromBackEnd$(response))
        ).toPromise();
    },
    getWalletTransactionsHistoryAmount(root, args, context) {
      return RoleValidator.checkPermissions$(
        context.authToken.realm_access.roles,
        CONTEXT_NAME,
        "getWalletTransactionsHistoryAmount",
        PERMISSION_DENIED_ERROR_CODE,
        "Permission denied",
        ["PLATFORM-ADMIN", "DRIVER", "CLIENT", "BUSINESS-OWNER", "OPERATOR", "OPERATION-SUPERVISOR"]
      )
        .pipe(
          mergeMap(() => broker.forwardAndGetReply$(
              "Wallet",
              "emigateway.graphql.query.getWalletTransactionsHistoryAmount",
              { root, args, jwt: context.encodedToken }, 2000
          )),
          catchError(err => handleError$(err, "getWalletTransactionsHistoryAmount")),
          mergeMap(response => getResponseFromBackEnd$(response))
        ).toPromise();
    },
    getWalletTransactionsHistoryById(root, args, context) {
      return RoleValidator.checkPermissions$(
        context.authToken.realm_access.roles,
        CONTEXT_NAME,
        "getWalletTransactionsHistoryById",
        PERMISSION_DENIED_ERROR_CODE,
        "Permission denied",
        ["PLATFORM-ADMIN", "DRIVER", "CLIENT", "BUSINESS-OWNER", "OPERATOR", "OPERATION-SUPERVISOR"]
      )
      .pipe(
        mergeMap(() =>  broker.forwardAndGetReply$(
          "Wallet", "emigateway.graphql.query.getWalletTransactionsHistoryById",
          { root, args, jwt: context.encodedToken }, 2000
        )),
        catchError(err => handleError$(err, "getWalletTransactionsHistoryById")),
        mergeMap(response => getResponseFromBackEnd$(response))

      ).toPromise();
    },
    getAssociatedTransactionsHistoryByTransactionHistoryId(
      root,
      args,
      context
    ) {
      return RoleValidator.checkPermissions$(
        context.authToken.realm_access.roles,
        CONTEXT_NAME,
        "getAssociatedTransactionsHistoryByTransactionHistoryId",
        PERMISSION_DENIED_ERROR_CODE,
        "Permission denied",
        ["PLATFORM-ADMIN", "BUSINESS-OWNER"]
      )
      .pipe(
        mergeMap(() => broker.forwardAndGetReply$(
          "Wallet", "emigateway.graphql.query.getAssociatedTransactionsHistoryByTransactionHistoryId",
          { root, args, jwt: context.encodedToken }, 2000
        )),
        catchError(err => handleError$(err, "getAssociatedTransactionsHistoryByTransactionHistoryId")),
        mergeMap(response => getResponseFromBackEnd$(response))
      ).toPromise();
    },
    getWallet(root, args, context) {
      return RoleValidator.checkPermissions$(
        context.authToken.realm_access.roles,
        CONTEXT_NAME,
        "getWallet",
        PERMISSION_DENIED_ERROR_CODE,
        "Permission denied",
        ["PLATFORM-ADMIN", "DRIVER", "CLIENT", "BUSINESS-OWNER", "OPERATOR", "OPERATION-SUPERVISOR"]
      )
      .pipe(
        mergeMap(() => broker.forwardAndGetReply$(
          "Wallet", "emigateway.graphql.query.getWallet",
          { root, args, jwt: context.encodedToken }, 2000
        )),
        catchError(err => handleError$(err, "getWallet")),
        mergeMap(response => getResponseFromBackEnd$(response))
      ).toPromise();
    },
    getBusinessByFilter(root, args, context) {
      return RoleValidator.checkPermissions$(
        context.authToken.realm_access.roles,
        CONTEXT_NAME,
        "getBusinessByFilter",
        PERMISSION_DENIED_ERROR_CODE,
        "Permission denied",
        ["PLATFORM-ADMIN"]
      )
      .pipe(
        mergeMap(response => broker.forwardAndGetReply$(
          "Business", "emigateway.graphql.query.getBusinessByFilter",
          { root, args, jwt: context.encodedToken }, 2000
        )),
        catchError(err => handleError$(err, "getBusinessByFilter")),
        mergeMap(response => getResponseFromBackEnd$(response))
      ).toPromise();
    },
    getWalletsByFilter(root, args, context) {
      return RoleValidator.checkPermissions$(
        context.authToken.realm_access.roles,
        CONTEXT_NAME,
        "getWalletsByFilter",
        PERMISSION_DENIED_ERROR_CODE,
        "Permission denied",
        ["PLATFORM-ADMIN", "BUSINESS-OWNER", ]
      )
      .pipe(
        mergeMap(() => broker.forwardAndGetReply$(
          "Wallet", "emigateway.graphql.query.getWalletsByFilter",
          { root, args, jwt: context.encodedToken }, 2000
        )),
        catchError(err => handleError$(err, "getWalletsByFilter")),
        mergeMap(response => getResponseFromBackEnd$(response))
      ).toPromise();
    },
    getMyWallet(root, args, context) {
      return RoleValidator.checkPermissions$(
        context.authToken.realm_access.roles,
        CONTEXT_NAME,
        "getMyWallet",
        PERMISSION_DENIED_ERROR_CODE,
        "Permission denied",
        ["PLATFORM-ADMIN", "DRIVER", "CLIENT", "BUSINESS-OWNER", "OPERATOR", "OPERATION-SUPERVISOR"]
      )
      .pipe(
        mergeMap(() => broker.forwardAndGetReply$(
          "Wallet", "emigateway.graphql.query.getMyWallet",
          { root, args, jwt: context.encodedToken }, 2000
        )),
        catchError(err => handleError$(err, "getMyWallet")),
        mergeMap(response => getResponseFromBackEnd$(response))
      ).toPromise();
    },
    getWalletBusiness(root, args, context) {
      return RoleValidator.checkPermissions$(
        context.authToken.realm_access.roles,
        CONTEXT_NAME,
        "getWalletBusiness",
        PERMISSION_DENIED_ERROR_CODE,
        "Permission denied",
        ["PLATFORM-ADMIN", "BUSINESS-OWNER"]
      )
      .pipe(
        mergeMap(() => broker.forwardAndGetReply$(
          "Business", "emigateway.graphql.query.getWalletBusiness",
          { root, args, jwt: context.encodedToken }, 2000
        )),
        catchError(err => handleError$(err, "getWalletBusiness")),
        mergeMap(response => getResponseFromBackEnd$(response))
      ).toPromise();
    },
    getWalletBusinesses(root, args, context) {
      return RoleValidator.checkPermissions$(
        context.authToken.realm_access.roles,
        CONTEXT_NAME,
        "getWalletBusinesses",
        PERMISSION_DENIED_ERROR_CODE,
        "Permission denied",
        ["PLATFORM-ADMIN"]
      )
      .pipe(
        mergeMap(response => broker.forwardAndGetReply$(
          "Business", "emigateway.graphql.query.getWalletBusinesses",
          { root, args, jwt: context.encodedToken }, 2000
        )),
        catchError(err => handleError$(err, "getWalletBusinesses")),
        mergeMap(response => getResponseFromBackEnd$(response))
      ).toPromise();
    },
    getWalletBusinessById(root, args, context) {
      return RoleValidator.checkPermissions$(
        context.authToken.realm_access.roles,
        CONTEXT_NAME,
        "getWalletBusinessById",
        PERMISSION_DENIED_ERROR_CODE,
        "Permission denied",
        ["PLATFORM-ADMIN", "BUSINESS-OWNER"]
      )
      .pipe(
        mergeMap(() => broker.forwardAndGetReply$(
          "Business", "emigateway.graphql.query.getWalletBusinessById",
          { root, args, jwt: context.encodedToken }, 2000
        )),
        catchError(err => handleError$(err, "getWalletBusinessById")),
        mergeMap(response => getResponseFromBackEnd$(response))
      ).toPromise();
    },
    WalletGetSpendingRule(root, args, context) {
      return RoleValidator.checkPermissions$(
        context.authToken.realm_access.roles,
        CONTEXT_NAME,
        "getWalletSpendingRule",
        PERMISSION_DENIED_ERROR_CODE,
        "Permission denied",
        ["PLATFORM-ADMIN"]
      )
      .pipe(
        mergeMap(() => broker.forwardAndGetReply$(
            "SpendingRule", "emigateway.graphql.query.getSpendingRule",
            { root, args, jwt: context.encodedToken }, 2000
          )
        ),
        catchError(err => handleError$(err, "getWalletSpendingRule")),
        mergeMap(response => getResponseFromBackEnd$(response))
      ).toPromise();
    },
    WalletGetSpendingRules(root, args, context) {
      return RoleValidator.checkPermissions$(
        context.authToken.realm_access.roles,
        CONTEXT_NAME,
        "WalletGetSpendingRules",
        PERMISSION_DENIED_ERROR_CODE,
        "Permission denied",
        ["PLATFORM-ADMIN"]
      )
      .pipe(
        mergeMap(() => broker.forwardAndGetReply$(
            "SpendingRule", "emigateway.graphql.query.getSpendingRules",
            { root, args, jwt: context.encodedToken }, 2000
        )),
        catchError(err => handleError$(err, "WalletGetSpendingRules")),
        mergeMap(response => getResponseFromBackEnd$(response))
      ).toPromise();
    },
    typeAndConcepts(root, args, context) {
      return RoleValidator.checkPermissions$(
        context.authToken.realm_access.roles,
        CONTEXT_NAME,
        "typeAndConcepts",
        PERMISSION_DENIED_ERROR_CODE,
        "Permission denied",
        ["PLATFORM-ADMIN", "DRIVER", "CLIENT", "BUSINESS-OWNER", "OPERATOR", "OPERATION-SUPERVISOR"]
      )
      .pipe(
        mergeMap(() => broker.forwardAndGetReply$(
            "Wallet", "emigateway.graphql.query.getTypeAndConcepts",
            { root, args, jwt: context.encodedToken }, 2000
        )),
        catchError(err => handleError$(err, "typeAndConcepts")),
        mergeMap(response => getResponseFromBackEnd$(response)),
      ).toPromise();
    },
    WalletSpendingRuleQuantity(root, args, context) {
      return RoleValidator.checkPermissions$(
        context.authToken.realm_access.roles,
        CONTEXT_NAME,
        "WalletSpendingRuleQuantity",
        PERMISSION_DENIED_ERROR_CODE,
        "Permission denied",
        ["PLATFORM-ADMIN", "BUSINESS-OWNER"]
      )
      .pipe(
        mergeMap(() => broker.forwardAndGetReply$(
            "Wallet", "emigateway.graphql.query.getWalletSpendingRuleQuantity",
            { root, args, jwt: context.encodedToken }, 2000
        )),
        catchError(err => handleError$(err, "WalletSpendingRuleQuantity")),
        mergeMap(response => getResponseFromBackEnd$(response))
      ).toPromise();
    },
    getWalletErrors(root, args, context) {
      return RoleValidator.checkPermissions$(
        context.authToken.realm_access.roles,
        "Wallet",
        "getWalletErrors",
        PERMISSION_DENIED_ERROR_CODE,
        "Permission denied",
        ["PLATFORM-ADMIN"]
      )
      .pipe(
        mergeMap(() => broker.forwardAndGetReply$(
          "WalletError", "emigateway.graphql.query.getWalletErrors",
          { root, args, jwt: context.encodedToken }, 2000
        )),
        catchError(err => handleError$(err, "getWalletErrors")),
        mergeMap(response => getResponseFromBackEnd$(response))
      ).toPromise();
    },
    getWalletErrorsCount(root, args, context) {
      return RoleValidator.checkPermissions$(
        context.authToken.realm_access.roles,
        "Wallet",
        "getWalletErrorsCount",
        PERMISSION_DENIED_ERROR_CODE,
        "Permission denied",
        ["PLATFORM-ADMIN"]
      )
      .pipe(
        mergeMap(() => broker.forwardAndGetReply$(
          "WalletError",
          "emigateway.graphql.query.getWalletErrorsCount",
          { root, args, jwt: context.encodedToken },
          2000
        )),
        catchError(err => handleError$(err, "getWalletErrorsCount")),
        mergeMap(response => getResponseFromBackEnd$(response))
      ).toPromise();
    }
  },
  //// MUTATIONS ///////
  Mutation: {
    makeManualBalanceAdjustment(root, args, context) {
      return RoleValidator.checkPermissions$(
        context.authToken.realm_access.roles,
        CONTEXT_NAME,
        "makeManualBalanceAdjustment",
        PERMISSION_DENIED_ERROR_CODE,
        "Permission denied",
        ["PLATFORM-ADMIN"]
      )
      .pipe(
        mergeMap(() => broker.forwardAndGetReply$(
          "Wallet",
          "emigateway.graphql.mutation.makeManualBalanceAdjustment",
          { root, args, jwt: context.encodedToken },
          2000
        )),
        catchError(err => handleError$(err, "makeManualBalanceAdjustment")),
        mergeMap(response => getResponseFromBackEnd$(response))
      ).toPromise();
    },
    walletUpdateSpendingRule(root, args, context) {
      return RoleValidator.checkPermissions$(
        context.authToken.realm_access.roles,
        CONTEXT_NAME,
        "makeManualBalanceAdjustment",
        PERMISSION_DENIED_ERROR_CODE,
        "Permission denied",
        ["PLATFORM-ADMIN"]
      )
      .pipe(
        mergeMap(() => broker .forwardAndGetReply$(
          "SpendingRule",
          "emigateway.graphql.mutation.updateSpendingRule",
          { root, args, jwt: context.encodedToken },
          2000
        )),
        catchError(err => handleError$(err, "updateSpendingRule")),
        mergeMap(response => getResponseFromBackEnd$(response))
      ).toPromise();
    },
    WalletRevertTransaction(root, args, context) {
      return RoleValidator.checkPermissions$(
        context.authToken.realm_access.roles,
        CONTEXT_NAME,
        "WalletRevertTransaction",
        PERMISSION_DENIED_ERROR_CODE,
        "Permission denied",
        ["PLATFORM-ADMIN", "BUSINESS-OWNER"]
      )
      .pipe(
        mergeMap(() => broker .forwardAndGetReply$("Wallet", "emigateway.graphql.mutation.revertTransaction", { root, args, jwt: context.encodedToken }, 2000 )),
        catchError(err => handleError$(err, "WalletRevertTransaction")),
        mergeMap(response => getResponseFromBackEnd$(response))
      ).toPromise();
    },
  },
  //// SUBSCRIPTIONS ///////
  Subscription: {
    walletPocketUpdated: {
      subscribe: withFilter(
        (payload, variables, context, info) => {
          //Checks the roles of the user, if the user does not have at least one of the required roles, an error will be thrown
          RoleValidator.checkAndThrowError(
            context.authToken.realm_access.roles,
            ["PLATFORM-ADMIN", "DRIVER", "CLIENT", "BUSINESS-OWNER", "OPERATOR", "OPERATION-SUPERVISOR"],
            CONTEXT_NAME,
            "walletPocketUpdated",
            PERMISSION_DENIED_ERROR_CODE,
            "Permission denied"
          );
          return pubsub.asyncIterator("walletPocketUpdated");
        },
        (payload, variables, context, info) => payload.walletPocketUpdated._id == variables.walletId
      )
    }
  }
};





//// SUBSCRIPTIONS SOURCES ////

const eventDescriptors = [
    {
        backendEventName: 'walletPocketUpdated',
        gqlSubscriptionName: 'walletPocketUpdated',
        dataExtractor: (evt) => evt.data,// OPTIONAL, only use if needed
        onError: (error, descriptor) => console.log(`Error processing ${descriptor.backendEventName}`),// OPTIONAL, only use if needed
        onEvent: (evt, descriptor) => {} // console.log(`Event of type  ${descriptor.backendEventName} arraived`),// OPTIONAL, only use if needed
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
            () =>
                console.log(
                    `${descriptor.gqlSubscriptionName} listener STOPED`
                )
        );
});


