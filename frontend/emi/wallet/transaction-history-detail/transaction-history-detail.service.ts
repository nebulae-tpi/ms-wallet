import { Injectable } from '@angular/core';
import { GatewayService } from '../../../../api/gateway.service';
import {
  getWalletTransactionsHistoryById,
  getAssociatedTransactionsHistoryByTransactionHistoryId
} from '../gql/wallet';

@Injectable()
export class TransactionHistoryDetailService {

  constructor(private gateway: GatewayService) { }

  /**
   * Gets the transaction history by its id
   * @param transactionHistoryId Transaction history id filter
   */
  getTransactionHistoryById$(transactionHistoryId) {
    return this.gateway.apollo
      .query<any>({
        query: getWalletTransactionsHistoryById,
        variables: {
          id: transactionHistoryId
        },
        fetchPolicy: 'network-only',
        errorPolicy: 'all'
      });
  }

  /**
   * Gets the associated transactions history related with the filtered transaction history
   * @param transactionHistoryId Transaction history id filter
   */
  getAssociatedTransactionsHistoryByTransactionHistoryId$(transactionHistoryId) {
    return this.gateway.apollo
      .query<any>({
        query: getAssociatedTransactionsHistoryByTransactionHistoryId,
        variables: {
          id: transactionHistoryId
        },
        fetchPolicy: 'network-only',
        errorPolicy: 'all'
      });
  }
}
