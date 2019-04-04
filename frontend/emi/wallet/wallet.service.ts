import { Injectable } from "@angular/core";
import { Observable, BehaviorSubject } from "rxjs";
import { GatewayService } from "../../../api/gateway.service";
import {
  getWalletBusiness,
  getWalletBusinesses,
  getWallet,
  getWalletBusinessById,
  getBusinessByFilter,
  walletPocketUpdated,
  getWalletsByFilter,
  getMyWallet
} from "./gql/wallet";

@Injectable()
export class WalletService {

  constructor(private gateway: GatewayService) {}

    getBusinessByFilter(filterText: String, limit: number): Observable<any> {
      return this.gateway.apollo
        .query<any>({
          query: getBusinessByFilter,
          variables: {
            filterText: filterText,
            limit: limit
          },
          fetchPolicy: 'network-only',
          errorPolicy: 'all'
        });
    }

    getWalletsByFilter(filterText: String, businessId: String, limit: number): Observable<any> {
      return this.gateway.apollo
        .query<any>({
          query: getWalletsByFilter,
          variables: { filterText, businessId, limit },
          fetchPolicy: 'network-only',
          errorPolicy: 'all'
        });
    }

    getMyOwnWallet$(){
      return this.gateway.apollo
        .query<any>({
          query: getMyWallet,
          fetchPolicy: 'network-only',
          errorPolicy: 'all'
        });
    }

  /**
   * get the business by id
   *
   * @returns {Observable}
   */
  getBusinessById$(id) {
    return this.gateway.apollo
      .query<any>({
        query: getWalletBusinessById,
        variables: {
          id: id
        },
        fetchPolicy: 'network-only',
        errorPolicy: 'all'
      });
  }

  /**
   * get the business which the user belongs
   *
   * @returns {Observable}
   */
  getBusiness$() {
    return this.gateway.apollo.query<any>({
      query: getWalletBusiness,
      fetchPolicy: "network-only",
      errorPolicy: "all"
    });
  }

  /**
   * get all of the businesses
   *
   * @returns {Observable}
   */
  getBusinesses$() {
    return this.gateway.apollo.query<any>({
      query: getWalletBusinesses,
      fetchPolicy: "network-only",
      errorPolicy: "all"
    });
  }

  /**
   * get wallet info of a business
   *
   * @param businessId ID of business to filter
   * @returns {Observable}
   */
  getWallet$(walletId) {
    return this.gateway.apollo.query<any>({
      query: getWallet,
      variables: { walletId },
      fetchPolicy: "network-only",
      errorPolicy: "all"
    });
  }

  /**
   * Receives an event with the last wallet state when a wallet has been updated.
   * @param walletId 
   */
  getWalletPocketUpdatedSubscription$(walletId: string): Observable<any> {
    return this.gateway.apollo
      .subscribe({
        query: walletPocketUpdated,
        variables: { walletId },
      })
      .map(resp => {
        return (resp && resp.data ) ? resp.data.walletPocketUpdated : null
      });
      
  }
 
  
}
