"use strict";
const Rx = require("rxjs");
const eventSourcing = require("../../tools/EventSourcing")();
const business = require("../../domain/business/");
const spendingRule = require('../../domain/spending-rules');
const wallet = require('../../domain/wallet');
const { map, switchMap, filter, mergeMap, concatMap } = require('rxjs/operators');
const { UserES } = require('../../domain/user');
const { DriverES } = require('../../domain/driver');
const { ClientES } = require('../../domain/client');
/**
 * Singleton instance
 */
let instance;
/**
 * Micro-BackEnd key
 */
const mbeKey = "ms-wallet_mbe_wallet_15";

class EventStoreService {
  constructor() {
    this.functionMap = this.generateFunctionMap();
    this.subscriptions = [];
    this.aggregateEventsArray = this.generateAggregateEventsArray();
  }

  /**
   * Starts listening to the EventStore
   * Returns observable that resolves to each subscribe agregate/event
   *    emit value: { aggregateType, eventType, handlerName}
   */
  start$() {
    //default error handler
    const onErrorHandler = error => {
      console.error("Error handling  EventStore incoming event", error);
      process.exit(1);
    };
    //default onComplete handler
    const onCompleteHandler = () => {
      () => console.log("EventStore incoming event subscription completed");
    };
    console.log("EventStoreService starting ...");

    return Rx.from(this.aggregateEventsArray).pipe(
      map(aggregateEvent => ({ ...aggregateEvent, onErrorHandler, onCompleteHandler }))
      ,map(params => this.subscribeEventHandler(params))
    );      
  }

  /**
   * Stops listening to the Event store
   * Returns observable that resolves to each unsubscribed subscription as string
   */
  stop$() {
    return Rx.from(this.subscriptions).pipe(
      map(subscription => {
        subscription.subscription.unsubscribe();
        return `Unsubscribed: aggregateType=${aggregateType}, eventType=${eventType}, handlerName=${handlerName}`;
      })
    );
  }

  /**
     * Create a subscrition to the event store and returns the subscription info     
     * @param {{aggregateType, eventType, onErrorHandler, onCompleteHandler}} params
     * @return { aggregateType, eventType, handlerName  }
     */
  subscribeEventHandler({ aggregateType, eventType, onErrorHandler, onCompleteHandler }) {
    const handler = this.functionMap[eventType];
    const subscription =
      //MANDATORY:  AVOIDS ACK REGISTRY DUPLICATIONS
      eventSourcing.eventStore.ensureAcknowledgeRegistry$(aggregateType, mbeKey).pipe(
        mergeMap(() => eventSourcing.eventStore.getEventListener$(aggregateType, mbeKey, false)),
        filter(evt => evt.et === eventType),
        mergeMap(evt => Rx.concat(
          handler.fn.call(handler.obj, evt),
          //MANDATORY:  ACKWOWLEDGE THIS EVENT WAS PROCESSED
          eventSourcing.eventStore.acknowledgeEvent$(evt, mbeKey),
        ))
      )
        .subscribe(
          (evt) => {
            // console.log(`EventStoreService: ${eventType} process: ${evt}`);
          },
          onErrorHandler,
          onCompleteHandler
        );
    this.subscriptions.push({ aggregateType, eventType, handlerName: handler.fn.name, subscription });
    return { aggregateType, eventType, handlerName: `${handler.obj.name}.${handler.fn.name}` };
  }

  /**
  * Starts listening to the EventStore
  * Returns observable that resolves to each subscribe agregate/event
  *    emit value: { aggregateType, eventType, handlerName}
  */
  syncState$() {
    return Rx.from(this.aggregateEventsArray).pipe(
      concatMap(params => this.subscribeEventRetrieval$(params))
    )
  }


  /**
   * Create a subscrition to the event store and returns the subscription info     
   * @param {{aggregateType, eventType, onErrorHandler, onCompleteHandler}} params
   * @return { aggregateType, eventType, handlerName  }
   */
  subscribeEventRetrieval$({ aggregateType, eventType }) {
    const handler = this.functionMap[eventType];
    //MANDATORY:  AVOIDS ACK REGISTRY DUPLICATIONS
    return eventSourcing.eventStore.ensureAcknowledgeRegistry$(aggregateType, mbeKey).pipe(
      switchMap(() => eventSourcing.eventStore.retrieveUnacknowledgedEvents$(aggregateType, mbeKey)),
      filter(evt => evt.et === eventType),
      concatMap(evt => Rx.concat(
        handler.fn.call(handler.obj, evt),
        //MANDATORY:  ACKWOWLEDGE THIS EVENT WAS PROCESSED
        eventSourcing.eventStore.acknowledgeEvent$(evt, mbeKey)
      ))
    );
  }

  ////////////////////////////////////////////////////////////////////////////////////////
  /////////////////// CONFIG SECTION, ASSOC EVENTS AND PROCESSORS BELOW     //////////////
  ////////////////////////////////////////////////////////////////////////////////////////

  generateFunctionMap() {
    return {
      // BUSINESSES
      BusinessCreated: {
        fn: business.eventSourcing.handleBusinessCreated$,
        obj: business.eventSourcing
      },
      BusinessGeneralInfoUpdated: {
        fn: business.eventSourcing.handleBusinessGeneralInfoUpdated$,
        obj: business.eventSourcing
      },
      BusinessActivated: {
        fn: business.eventSourcing.handleBusinessStateUpdated$,
        obj: business.eventSourcing
      },
      BusinessDeactivated: {
        fn: business.eventSourcing.handleBusinessStateUpdated$,
        obj: business.eventSourcing
      },
      // DRIVERS
      DriverCreated: {
        fn: DriverES.handleDriverCreated$,
        obj: DriverES
      },
      DriverGeneralInfoUpdated: {
        fn: DriverES.handleDriverGeneralInfoUpdated$,
        obj: DriverES
      },
      DriverStateUpdated: {
        fn: DriverES.handleDriverStateUpdated$,
        obj: DriverES
      },
      // CLIENT
      ClientCreated: {
        fn: ClientES.handleClientCreated$,
        obj: ClientES
      },
      ClientGeneralInfoUpdated: {
        fn: ClientES.handleClientGeneralInfoUpdated$,
        obj: ClientES
      },
      ClientStateUpdated: {
        fn: ClientES.handleClientStateUpdated$,
        obj: ClientES
      },
      ClientSatelliteIdUpdated: {
        fn: ClientES.handleClientSatelliteIdUpdated$,
        obj: ClientES
      },
      EndClientCreated: {
        fn: ClientES.handleEndClientCreated$,
        obj: ClientES 
      },
      // USER
      UserCreated:{
        fn: UserES.handleUserCreated$,
        obj: UserES 
      },
      UserGeneralInfoUpdated:{
        fn: UserES.handleUserGeneralInfoUpdated$,
        obj: UserES 
      },
      UserActivated:{
        fn: UserES.handleUserStateUpdated$,
        obj: UserES 
      },
      UserDeactivated:{
        fn: UserES.handleUserStateUpdated$,
        obj: UserES 
      },      
      // WALLET TRANSACTIONS
      WalletTransactionCommited:{
        fn: wallet.eventSourcing.handleWalletTransactionCommited$, 
        obj: wallet.eventSourcing 
      },
      // WALLET SPENDING RULES
      // SpendingRuleUpdated:{
      //   fn: spendingRule.eventSourcing.handleSpendingRuleUpdated$,
      //   obj: spendingRule.eventSourcing
      // },
      // WalletSpendingCommited: {
      //   fn: wallet.eventSourcing.handleWalletSpendingCommited$,
      //   obj: wallet.eventSourcing
      // },
      // WalletDepositCommited: {
      //   fn: wallet.eventSourcing.handleWalletDepositCommited$,
      //   obj: wallet.eventSourcing
      // },
      WalletTransactionExecuted: {
        fn: wallet.eventSourcing.handleWalletTransactionExecuted$,
        obj: wallet.eventSourcing
      },
      // CreateIndexesWalletTriggered: { 
      //   fn: wallet.eventSourcing.createIndexesWallet$, 
      //   obj: wallet.eventSourcing 
      // },
    };
    
  }
  

  /**
  * Generates a map that assocs each AggretateType withs its events
  */
  generateAggregateEventsArray() {
    return [

      // BUSINESSES
      { aggregateType: "Business", eventType: "BusinessCreated" },
      { aggregateType: "Business", eventType: "BusinessGeneralInfoUpdated" },
      { aggregateType: "Business", eventType: "BusinessActivated" },
      { aggregateType: "Business", eventType: "BusinessDeactivated" },
      // DRIVERS
      { aggregateType: "Driver", eventType: "DriverCreated" },
      { aggregateType: "Driver", eventType: "DriverGeneralInfoUpdated" },
      { aggregateType: "Driver", eventType: "DriverStateUpdated" },
      // CLIENT
      { aggregateType: "Client", eventType: "ClientCreated" },
      { aggregateType: "Client", eventType: "ClientGeneralInfoUpdated" },
      { aggregateType: "Client", eventType: "ClientSatelliteIdUpdated" },
      { aggregateType: "Client", eventType: "ClientStateUpdated" },
      { aggregateType: "Client", eventType: "EndClientCreated" },
      // USER
      { aggregateType: "User", eventType: "UserCreated" },
      { aggregateType: "User", eventType: "UserGeneralInfoUpdated" },
      { aggregateType: "User", eventType: "UserActivated" },
      { aggregateType: "User", eventType: "UserDeactivated" },

      // WALLET MOVEMENTS      
      { aggregateType: "Wallet", eventType: "WalletTransactionCommited" },

      // WALLET SPENDING RULES      
      // {
      //   aggregateType: "SpendingRule",
      //   eventType: "SpendingRuleUpdated"
      // },
      // {
      //   aggregateType: "Wallet",
      //   eventType: "WalletSpendingCommited"
      // },
      // {
      //   aggregateType: "Wallet",
      //   eventType: "WalletDepositCommited"
      // },
      {
        aggregateType: "Wallet",
        eventType: "WalletTransactionExecuted"
      },
      // {
      //   aggregateType: "Cronjob",
      //   eventType: "CreateIndexesWalletTriggered"
      // }
    ]
  }
}



/**
 * @returns {EventStoreService}
 */
module.exports = () => {
  if (!instance) {
    instance = new EventStoreService();
    console.log("NEW  EventStore instance  !!");
  }
  return instance;
};

