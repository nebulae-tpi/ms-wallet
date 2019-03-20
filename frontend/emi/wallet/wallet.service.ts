import { Injectable } from "@angular/core";
import { Observable, BehaviorSubject } from "rxjs";
import { GatewayService } from "../../../api/gateway.service";
import {
  getWalletBusiness,
  getWalletBusinesses,
  getWallet,
  getWalletBusinessById,
  getBusinessByFilter,
  walletPocketUpdated
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
  getWallet$(businessId) {
    return this.gateway.apollo.query<any>({
      query: getWallet,
      variables: {
        businessId: businessId
      },
      fetchPolicy: "network-only",
      errorPolicy: "all"
    });
  }

  /**
   * Receives an event with the last wallet state when a wallet has been updated.
   * @param businessId 
   */
  getWalletPocketUpdatedSubscription$(businessId): Observable<any> {
    return this.gateway.apollo
      .subscribe({
        query: walletPocketUpdated,
        variables: {
          businessId: businessId
        },
      })
      .map(resp => {
        console.log('resp.data.walletPocketUpdated => ', resp);
        return resp.data.walletPocketUpdated;
      });
  }
}
