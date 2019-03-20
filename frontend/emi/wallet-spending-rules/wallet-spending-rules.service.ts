import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import * as Rx from 'rxjs';
import { GatewayService } from '../../../api/gateway.service';
import {
  getSpendingRulesQuantity,
  getTypeAndConcepts,
  getSpendingRule,
  getSpendingRules,
  walletHelloWorldSubscription,
  updateSpendingRule
} from './gql/wallet-spending-rules';

@Injectable()
export class WalletSpendingRuleService {

  typesVsConcepts: { type: string, concepts: string[] }[];

  constructor(private gateway: GatewayService) {
  }

  getSpendingRulesQuantity$() {
    return this.gateway.apollo
      .query<any>({
        query: getSpendingRulesQuantity,
        fetchPolicy: 'network-only'
      })
      .map(resp => resp.data.WalletSpendingRuleQuantity);
  }


  getTypeAndConcepts$() {
    return this.gateway.apollo
      .query<any>({
        query: getTypeAndConcepts,
        fetchPolicy: 'network-only'
      })
      .map(resp => resp.data.typeAndConcepts);
  }

  /**
  * Hello World subscription sample, please remove
  */
 getEventSourcingMonitorHelloWorldSubscription$(): Observable<any> {
  return this.gateway.apollo
    .subscribe({
      query: walletHelloWorldSubscription
    })
    .map(resp => resp.data.walletHelloWorldSubscription.sn);
}
/**
 * Fetch the business unit spending rule.
 * @param businessId Business id
 */
getSpendinRule$(businessId: string){
  return this.gateway.apollo
      .watchQuery<any>({
        query: getSpendingRule,
        fetchPolicy: 'network-only',
        errorPolicy: 'all',
        variables: {
          businessId: businessId
        }
      })
      .valueChanges.map(
        resp => resp.data.WalletGetSpendingRule
      );
}

/*
page: Int!, $count: Int!, $filter: String, $sortColumn: String, $sortOrder: String
*/

/**
 * Fetch the business unit spending rule.
 * @param businessId Business id
 */
getSpendinRules$(page: number, count: number, filter: string, sortColumn: string, sortOrder: string){
  return this.gateway.apollo
      .watchQuery<any>({
        query: getSpendingRules,
        fetchPolicy: 'network-only',
        errorPolicy: 'all',
        variables: {
          page: page,
          count: count,
          filter: filter,
          sortColumn: sortColumn,
          sortOrder: sortOrder
        }
      })
      .valueChanges;
}

updateSpendingRule$(spendingRuleInput: any){
  return this.gateway.apollo
  .mutate<any>({
    mutation: updateSpendingRule,
    variables: {
      input: spendingRuleInput
    },
    errorPolicy: 'all'
  });
}




}
