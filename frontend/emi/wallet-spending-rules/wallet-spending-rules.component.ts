import { WalletSpendingRuleService } from './wallet-spending-rules.service';
import {
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
  ElementRef
} from '@angular/core';
import { fuseAnimations } from '../../../core/animations';
import { TranslateService } from '@ngx-translate/core';
import { FuseTranslationLoaderService } from './../../../core/services/translation-loader.service';
import { locale as english } from './i18n/en';
import { locale as spanish } from './i18n/es';
// tslint:disable-next-line:import-blacklist
import * as Rx from 'rxjs/Rx';
import { MatTableDataSource, MatPaginator } from '@angular/material';
import {
  debounceTime,
  startWith,
  distinctUntilChanged,
  filter,
  map,
  tap,
  mergeMap
} from 'rxjs/operators';


export interface SpendingRule {
  businessId: string;
  businessName: string;
  minOperationAmount: number;
  lastEditionTimestamp: number;
  editedBy: string;
}

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'wallet-spending-rules',
  templateUrl: './wallet-spending-rules.component.html',
  styleUrls: ['./wallet-spending-rules.component.scss'],
  animations: fuseAnimations
})
export class WalletComponent implements OnInit, OnDestroy {
  @ViewChild('filter')
  filter: ElementRef;
  @ViewChild(MatPaginator) paginator: MatPaginator;

  spendingRulesDataSource = new MatTableDataSource();
  allSubscriptions = [];
  tableColumns: string[] = [
    'businessId',
    'businessName',
    'minOperationAmount',
    'lastEditionTimestamp',
    'editedBy'
  ];

  tableSize: number;
  page = 0;
  count = 10;
  filterText = '';
  sortColumn = null;
  sortOrder = null;
  itemPerPage = '';

  constructor(
    private walletSpendingService: WalletSpendingRuleService,
    private translationLoader: FuseTranslationLoaderService,
    private translatorService: TranslateService
  ) {
    this.translationLoader.loadTranslations(english, spanish);
  }

  ngOnInit() {

    this.walletSpendingService.getSpendingRulesQuantity$()
    .pipe(
      tap(spendingRulesQuantity => this.tableSize = spendingRulesQuantity)
    )
    .subscribe( r => {  }, e => console.log(e), () => {} );

    /**
     * subscription to listen the filter text
     */
    this.allSubscriptions.push(
      Rx.Observable.fromEvent(this.filter.nativeElement, 'keyup')
        .pipe(
          debounceTime(400),
          startWith(''),
          distinctUntilChanged(),
          filter(() => this.filter.nativeElement),
          map(() => this.filter.nativeElement.value.trim()),
          tap(filterText => (this.filterText = filterText)),
          mergeMap( () => this.refreshDataTable(this.page, this.count, this.filterText))
        )
        .subscribe( r => {  }, e => console.log(e), () => {} )
    );

     // Creates an observable for listen the events when the paginator of the table is modified
     this.allSubscriptions.push(
      this.paginator.page
      .pipe(
        tap(pageChanged => {
          this.page = pageChanged.pageIndex;
          this.count = pageChanged.pageSize;
        }),
        mergeMap( () => this.refreshDataTable(this.page, this.count, this.filterText))
      )
      .subscribe(() => {}, error => console.log(error), () => {})
    );
  }



    /**
   * Finds the users and updates the table data
   * @param page page number
   * @param count Max amount of users that will be return.
   * @param searchFilter Search filter
   */
  refreshDataTable(page, count, searchFilter) {
    console.log('refreshDataTable(page, count, searchFilter)');
    return this.walletSpendingService
      .getSpendinRules$(page, count, searchFilter, this.sortColumn, this.sortOrder)
      .pipe(
        mergeMap(resp => this.graphQlAlarmsErrorHandler$(resp)),
        filter((resp: any) => !resp.errors || resp.errors.length === 0),
        map(response => response.data.WalletGetSpendingRules),
        tap(spendingRules => (this.spendingRulesDataSource.data = spendingRules))
      );
  }

   /**
   * Handles the Graphql errors and show a message to the user
   * @param response
   */
  graphQlAlarmsErrorHandler$(response){
    return Rx.Observable.of(JSON.parse(JSON.stringify(response)))
    .pipe(
      tap((resp: any) => {
        this.showSnackBarError(resp);
        return resp;
      })
    );
  }

    /**
   * Shows an error snackbar
   * @param response
   */
  showSnackBarError(response){
    if (response.errors){
      console.log(response.errors);
    }
  }

  ngOnDestroy() {

  }
}
