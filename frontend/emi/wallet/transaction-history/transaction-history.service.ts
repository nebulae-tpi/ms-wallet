import { Injectable } from "@angular/core";
import { Observable, BehaviorSubject } from "rxjs";
import {
  startWith
} from "rxjs/operators";
import { GatewayService } from "../../../../api/gateway.service";
import * as moment from "moment";
import {
  getWalletTransactionsHistory,
  getWalletTransactionsHistoryAmount,
  getTypesAndConcepts
} from "../gql/wallet";

@Injectable()
export class TransactionHistoryService {

  private selectedBusinessSubject$ = new BehaviorSubject<any>(null);
  private _filterAndPaginator$ = new BehaviorSubject({
    filter: {
      initDate: moment().startOf('month'),
      endDate: moment().endOf('day'),
      terminal: {}
    },
    pagination: {
      page: 0, count: 10, sort: -1
    },
  });

  constructor(private gateway: GatewayService) {}

  addFilterAndPaginatorData(filterAndPaginator) {
    console.log(`addFilterAndPaginatorData => ${JSON.stringify(filterAndPaginator)}`);
    this._filterAndPaginator$.next(filterAndPaginator);
  }

  /**
   * @returns {Observable<any>}
   */
  get filterAndPaginator$(): Observable<any> {
    return this._filterAndPaginator$.asObservable()
  }

  /**
   * Returns an observable
   */
  get selectedBusinessEvent$() {
    return this.selectedBusinessSubject$.asObservable();
  }

  /**
   * Set the selected business
   */
  selectBusiness(business) {
    this.selectedBusinessSubject$.next(business);
  }

  /**
   * Gets the transactions history according to the filter data and pagination.
   *
   * @param filterInput
   * @param paginationInput
   * @returns {Observable}
   */
  getTransactionsHistory$(filterInput, paginationInput) {
    return this.gateway.apollo.query<any>({
      query: getWalletTransactionsHistory,
      variables: {
        filterInput: filterInput,
        paginationInput: paginationInput
      },
      fetchPolicy: "network-only",
      errorPolicy: "all"
    });
  }

    /**
   * Gets the transactions history amount according to the filter data.
   *
   * @param filterInput
   * @returns {Observable}
   */
  getTransactionsHistoryAmount$(filterInput) {
    return this.gateway.apollo.query<any>({
      query: getWalletTransactionsHistoryAmount,
      variables: {
        filterInput: filterInput
      },
      fetchPolicy: "network-only",
      errorPolicy: "all"
    });
  }

  /**
   * Gets the transactions types and concepts
   *
   * @returns {Observable}
   */
  getTypesAndConcepts$() {
    return this.gateway.apollo.query<any>({
      query: getTypesAndConcepts,
      fetchPolicy: "network-only",
      errorPolicy: "all"
    });
  }

}
