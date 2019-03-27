////////// ANGULAR //////////
import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormControl
} from '@angular/forms';

////////// RXJS ///////////
// tslint:disable-next-line:import-blacklist
import * as Rx from 'rxjs/Rx';
import {
  map,
  mergeMap,
  switchMap,
  toArray,
  filter,
  tap,
  takeUntil,
  startWith,
  debounceTime,
  distinctUntilChanged,
  take
} from 'rxjs/operators';
import { Subject, Observable, concat } from 'rxjs';

//////////// ANGULAR MATERIAL ///////////
import {
  MatPaginator,
  MatSort,
  MatTableDataSource,
  MatSnackBar
} from '@angular/material';
import { fuseAnimations } from '../../../../core/animations';

//////////// i18n ////////////
import { FuseTranslationLoaderService } from '../../../../core/services/translation-loader.service';
import { TranslateService } from '@ngx-translate/core';
import { locale as english } from '../i18n/en';
import { locale as spanish } from '../i18n/es';

//////////// Services ////////////
import { KeycloakService } from 'keycloak-angular';
import { WalletService } from './../wallet.service';
import { TransactionHistoryService } from './transaction-history.service';
import { MAT_MOMENT_DATE_FORMATS } from './my-date-format';
import { ToolbarService } from '../../../toolbar/toolbar.service';

import {
  DateAdapter,
  MAT_DATE_FORMATS,
  MAT_DATE_LOCALE,
  MomentDateAdapter
} from '@coachcare/datepicker';

import * as moment from 'moment';

@Component({
// tslint:disable-next-line: component-selector
  selector: 'app-transaction-history',
  templateUrl: './transaction-history.component.html',
  styleUrls: ['./transaction-history.component.scss'],
  animations: fuseAnimations,
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'es' },
    {
      provide: DateAdapter,
      useClass: MomentDateAdapter,
      deps: [MAT_DATE_LOCALE]
    },
    { provide: MAT_DATE_FORMATS, useValue: MAT_MOMENT_DATE_FORMATS }
  ]
})
export class TransactionHistoryComponent implements OnInit, OnDestroy {
  private ngUnsubscribe = new Subject();

  walletFilterCtrl: FormControl;
  filterForm: FormGroup;
  // Table data
  dataSource = new MatTableDataSource();
  // Columns to show in the table
  displayedColumns = [ 'timestamp', 'type', 'concept', 'value', 'pocket', 'user'];

  transactionTypes: any = [];
  transactionConcepts: any = [];
  typesAndConceptsList: any = [];

  allBusiness: any = [];
  selectedWallet: any = null;
  selectedWalletName: any = '';
  selectedTransactionHistory: any = null;
  // isPlatformAdmin: Boolean = false;
  canChangeWallet = false;

  RolesToChangeWallet = ['PLATFORM-ADMIN', 'BUSINESS-OWNER'];

  businessQueryFiltered$: Observable<any[]>;

  walletData: any = {
    spendingState: '',
    pockets: {
      main: 0,
      bonus: 0,
      credit: 0
    }
  };

  // transactionType: any;

  maxEndDate: any = null;
  minEndDate: any = null;

  // Table values
  @ViewChild(MatPaginator)
  paginator: MatPaginator;
  @ViewChild('filter')
  filter: ElementRef;
  @ViewChild(MatSort)
  sort: MatSort;
  tableSize: number;
  page = 0;
  count = 10;
  filterText = '';
  sortColumn = null;
  sortOrder = null;
  itemPerPage = '';
  // Indicates if there are new transactions
  outdatedData = false;

  selectedBusinessId: any;


  constructor(
    private formBuilder: FormBuilder,
    private translationLoader: FuseTranslationLoaderService,
    private translate: TranslateService,
    private snackBar: MatSnackBar,
    private keycloakService: KeycloakService,
    private walletService: WalletService,
    private transactionHistoryService: TransactionHistoryService,
    private adapter: DateAdapter<any>,
    private toolbarService: ToolbarService,
  ) {
    this.translationLoader.loadTranslations(english, spanish);
    this.walletFilterCtrl = new FormControl();
  }

  ngOnInit() {
    this.buildFilterForm();       // Initialize the filter form in the side nav
    this.loadRoleData();          // Load the roles of the user
    this.onLangChange();          // Language listener to update the time filter
    this.loadTypesAndConcepts();  // Load the types and concepts to apply in filter
    this.loadWalletFilter();      // BusinessQueryFiltered$ initializer
    this.detectFilterAndPaginatorChanges(); // detects the changes in filter and paginator and sends to service
    this.loadDataInForm();        // Load data in filter form and paginator using data saved in the service
    // this.loadWalletData();        // create the listener in change wallet to listen the wallet update subscription
    this.refreshTransactionHistoryTable();
  }

  buildFilterForm() {
    const startOfMonth = moment().startOf('month');
    const endOfMonth = moment().endOf('day');
    this.minEndDate = startOfMonth;
    this.maxEndDate = endOfMonth;
    // Reactive Form
    this.filterForm = this.formBuilder.group({
      initDate: [startOfMonth],
      endDate: [endOfMonth],
      transactionType: [null],
      transactionConcept: [null]
    });
    this.filterForm.disable({
      onlySelf: true,
      emitEvent: false
    });
  }

  compareIds(business1: any, business2: any): boolean {
    return business1 && business2
      ? business1._id === business2._id
      : business1 === business2;
  }

  compareTypes(type1: any, type2: any): boolean {
    return type1 && type2 ? type1.type === type2.type : type1 === type2;
  }

  displayFn(wallet) {
    console.log('DISPLAYING ==> ', wallet);
    return wallet ? `${wallet.fullname} (${wallet.documentId})` : '';
  }

  /**
   * load the last filters of filter, paginator, selected Wallet saved in the service
   */
  loadDataInForm() {
    Rx.Observable.combineLatest(
      this.transactionHistoryService.filterAndPaginator$,
      this.transactionHistoryService.selectedWalletEvent$
    )
      .pipe(take(1))
      .subscribe(([filterAndPaginator, selectedWallet]) => {
        console.log(`### FilterAndPaginator ==>`, filterAndPaginator);
        console.log('### selectedWallet     ==> ', selectedWallet);
        if (filterAndPaginator) {
          if (filterAndPaginator.filter) {
            const filterData: any = filterAndPaginator.filter;

            this.minEndDate = moment(filterData.initDate);
            this.maxEndDate =  moment(filterData.initDate.valueOf()).endOf('month');

            this.filterForm.patchValue({
              initDate: filterData.initDate,
              endDate: filterData.endDate,
              transactionType: filterData.transactionTypeData,
              transactionConcept: filterData.transactionConcept
            });
          }

          if (filterAndPaginator.pagination) {
            (this.page = filterAndPaginator.pagination.page),
              (this.count = filterAndPaginator.pagination.count);
          }
        }

        if (selectedWallet) {
          this.selectedWallet = selectedWallet;
          this.walletFilterCtrl.setValue(this.selectedWallet);
        }
        this.filterForm.enable({ emitEvent: true });
        this.outdatedData = false;
      });
  }

  /**
   * Paginator of the table
   */
  getPaginator$() {
    return this.paginator.page.pipe(startWith({ pageIndex: 0, pageSize: 10 }));
  }

  /**
   * Changes the internationalization of the dateTimePicker component
   */
  onLangChange() {
    this.translate.onLangChange
      .pipe(
        startWith({ lang: this.translate.currentLang }),
        takeUntil(this.ngUnsubscribe)
      )
      .subscribe(event => {
        if (event) { this.adapter.setLocale(event.lang); }
      });
  }

  loadTypesAndConcepts() {
    this.transactionHistoryService.getTypesAndConcepts$()
      .pipe(
        map(result => result.data.typeAndConcepts),
        takeUntil(this.ngUnsubscribe)
      )
      .subscribe(data => {
        this.typesAndConceptsList = data;
      });
  }

  /**
   * Subscribes to wallet subscription
   */
  subscribeWalletUpdated(){
    this.transactionHistoryService.selectedWalletEvent$
    .pipe(
      filter(selectedBusiness => selectedBusiness != null),
      switchMap((selectedBusiness: any) =>
        this.walletService.getWalletPocketUpdatedSubscription$(selectedBusiness._id)
      )
    );
  }

  /**
   * get the wallet data according to the selected wallet
   */
  loadWalletData() {
    this.transactionHistoryService.selectedWalletEvent$
      .pipe(
        filter(selectedBusiness => selectedBusiness != null),
        switchMap((selectedBusiness: any) => concat(
          this.walletService.getWallet$(selectedBusiness._id)
            .pipe(
              mergeMap(resp => this.graphQlAlarmsErrorHandler$(resp)),
              filter((resp: any) => !resp.errors || resp.errors.length === 0),
              map(result => result.data.getWallet)
            ),
          this.walletService.getWalletPocketUpdatedSubscription$(selectedBusiness._id)
            .pipe(
              tap(wallet => this.outdatedData = true)
            )
        )),
        map(wallet => {
          let credit = 0;
          if (wallet.pockets.main < 0) {
            credit += wallet.pockets.main;
          }

          if (wallet.pockets.bonus < 0) {
            credit += wallet.pockets.bonus;
          }
          const walletCopy = {
            ...wallet,
            pockets: {
              main: wallet.pockets.main < 0 ? 0 : wallet.pockets.main,
              bonus: wallet.pockets.bonus < 0 ? 0 : wallet.pockets.bonus,
              credit: credit
            }
          };
          return walletCopy;
        }),
        takeUntil(this.ngUnsubscribe)
      )
      .subscribe(wallet => {
        console.log('new Wallet => ', wallet);
        this.walletData = wallet;
      });
  }

  /**
   *
   * @param element Element HTML
   */
  getFormChanges$() {
    return this.filterForm.valueChanges.pipe(
      debounceTime(500),
      distinctUntilChanged()
    );
  }

  onInitDateChange() {
    const start = this.filterForm.get('initDate').value;
    const end = this.filterForm.get('endDate').value;

    const startMonth = start.month();
    const startYear = start.year();
    const startMonthYear = startMonth + '-' + startYear;

    const endMonth = end.month();
    const endYear = end.year();
    const endMonthYear = endMonth + '-' + endYear;

    this.minEndDate = moment(start);
    if (startMonthYear !== endMonthYear) {
      this.filterForm.patchValue({
        endDate: moment(start.valueOf()).endOf('month')
      });
      this.maxEndDate =  moment(start.valueOf()).endOf('month');
    }
  }

  onEndDateChange() {
    // const start = this.filterForm.get('initDate').value;
    // this.minEndDate = moment(start);
  }

  resetFilter() {
    this.filterForm.reset();
    this.paginator.pageIndex = 0;
    this.page = 0;
    this.count = 10;

    const startOfMonth = moment().startOf('month');
    const endOfMonth = moment().endOf('day');
    this.filterForm.patchValue({
      initDate: startOfMonth,
      endDate: endOfMonth
    });
    this.outdatedData = false;
  }

  detectFilterAndPaginatorChanges() {
    Rx.Observable.combineLatest(this.getFormChanges$(), this.getPaginator$())
      .pipe(
        filter(() => this.filterForm.enabled),
        map(([formChanges, paginator]) => {
          const data = {
            filter: {
              initDate: formChanges.initDate,
              endDate: formChanges.endDate,
              // transactionType: {type: 'SALE', concepts: ['ADIOS']},
              transactionConcept: formChanges.transactionConcept,
            },
            pagination: {
              page: paginator.pageIndex,
              count: paginator.pageSize,
              sort: -1
            }
          };

          data.filter['transactionTypeData'] = formChanges.transactionType;
          return data;
        }),
        takeUntil(this.ngUnsubscribe)
      )
      .subscribe(filterAndPagination => this.transactionHistoryService.addFilterAndPaginatorData(filterAndPagination));
  }

  /**
   * Refreshes the table data according to the filters and the paginator.
   */
  refreshTransactionHistoryTable() {
    Rx.Observable.combineLatest(
      this.transactionHistoryService.filterAndPaginator$,
      this.transactionHistoryService.selectedWalletEvent$,
      this.toolbarService.onSelectedBusiness$
    )
      .pipe(
        debounceTime(500),
        filter(
          ([filterAndPagination, selectedWallet, selectedBusiness]) => {
            console.log('refreshTable => ', [
              filterAndPagination,
              selectedWallet,
              selectedBusiness
            ]);
            return filterAndPagination != null && selectedWallet != null;
          }
        ),
        map(([filterAndPagination, selectedWallet, selectedBusiness]) => {
          const filterInput = {
            businessId: (selectedBusiness && selectedBusiness.id) ?  selectedBusiness.id : null,
            walletId: selectedWallet._id,
            initDate: filterAndPagination.filter.initDate
              ? filterAndPagination.filter.initDate.valueOf()
              : null,
            endDate: filterAndPagination.filter.endDate
              ? filterAndPagination.filter.endDate.valueOf()
              : null,
            transactionType: filterAndPagination.filter.transactionTypeData
              ? filterAndPagination.filter.transactionTypeData.type
              : undefined,
            transactionConcept:
              filterAndPagination.filter.transactionConcept,
            // terminal: filterAndPagination.filter.terminal
          };

          const paginationInput = filterAndPagination.pagination;
          return [filterInput, paginationInput];
        }),
        // mergeMap(([filterInput, paginationInput]) =>
        //   forkJoin(
        //     this.transactionHistoryService.getTransactionsHistory$(filterInput, paginationInput)
        //       .pipe(mergeMap(resp => this.graphQlAlarmsErrorHandler$(resp))),
        //     this.transactionHistoryService.getTransactionsHistoryAmount$(filterInput)
        //       .pipe(mergeMap(resp => this.graphQlAlarmsErrorHandler$(resp)))
        //   )
        // ),
        takeUntil(this.ngUnsubscribe)
      )
      .subscribe(([transactionsHistory, transactionsHistoryAmount]) => {
        console.log(transactionsHistory, transactionsHistoryAmount);
        // this.outdatedData = false;
        // if (transactionsHistory.data.getWalletTransactionsHistory) {
        //   transactionsHistory.data.getWalletTransactionsHistory.sort(
        //     function(transactionsHistory1, transactionsHistory2) {
        //       return (
        //         transactionsHistory2.timestamp -
        //           transactionsHistory1.timestamp ||
        //         (transactionsHistory2.pocket < transactionsHistory1.pocket
        //           ? -1
        //           : 1)
        //       );
        //     }
        //   );
        // }

        // this.dataSource.data =
        //   transactionsHistory.data.getWalletTransactionsHistory;
        // this.tableSize =
        //   transactionsHistoryAmount.data.getWalletTransactionsHistoryAmount;
      });
  }

  /**
   *
   */
  loadRoleData() {
    this.checkIfUserCanChangeWallet$()
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe(response => {
        console.log('checkIfUserCanChangeWallet', response);
        this.canChangeWallet = response;
      });
  }

  /**
   * Creates the transaction history filter
   */
  createTransactionHistoryFilterForm() {
    return this.formBuilder.group({});
  }

  /**
   * Checks if the logged user has role PLATFORM-ADMIN
   */
  checkIfUserCanChangeWallet$() {
    return Rx.Observable.of(this.keycloakService.getUserRoles(true))
    .pipe(
      map((userRoles: string[]) => userRoles.filter(value => -1 !== this.RolesToChangeWallet.indexOf(value)).length),
      map(commonRoles => commonRoles > 0)
    );
  }

  loadWalletFilter() {
    this.businessQueryFiltered$ = this.checkIfUserCanChangeWallet$()
    .pipe(
      mergeMap(canChangeWallet => {
        console.log('canChangeWallet => ', canChangeWallet);
        if (canChangeWallet) {
          return this.walletFilterCtrl.valueChanges.pipe(
            startWith(undefined),
            filter(filterValue  => typeof filterValue === 'string'),
            debounceTime(500),
            distinctUntilChanged(),
            mergeMap((filterText: String) => this.getWalletsFiltered$(filterText, 10))
          );
        } else {
          return this.walletService.getMyOwnWallet$().pipe(
            mergeMap(r => this.graphQlAlarmsErrorHandler$(r)),
            map(r => (r && r.data && r.data.getMyWallet) ? r.data.getMyWallet : null ),
            tap(wallet => {
              console.log('this.walletService.getMyOwnWallet$()', wallet);
              this.selectedWallet = wallet;
              this.walletData.pockets = wallet.pockets;
              this.selectedWalletName = `${wallet.fullname} (${wallet.documentId})`;
              this.onSelectWalletEvent(this.selectedWallet);
            }),
            filter(wallet => wallet != null),
            toArray()
          );
        }
      })
    );
  }

  getWalletsFiltered$(filterText: String, limit: number): Observable<any[]> {
    return this.walletService.getWalletsByFilter(filterText, null,  limit).pipe(
      mergeMap(resp => this.graphQlAlarmsErrorHandler$(resp)),
      filter(resp => !resp.errors),
      mergeMap(result => Observable.from(result.data.getWalletsByFilter)),
      toArray()
    );
  }


  /**
   * Receives the selected transaction history
   * @param transactionHistory selected transaction history
   */
  selectTransactionHistoryRow(transactionHistory) {
    this.selectedTransactionHistory = transactionHistory;
  }

  /**
   * Listens when a new wallet have been selected
   * @param wallet  selected wallet
   */
  onSelectWalletEvent(wallet) {
    console.log('onSelectWalletEvent => ', wallet);
    this.walletData.pockets = wallet.pockets;
    this.transactionHistoryService.selectWallet(wallet);
  }

  graphQlAlarmsErrorHandler$(response) {
    return Rx.Observable.of(JSON.parse(JSON.stringify(response))).pipe(
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
  showSnackBarError(response) {
    // console.log('showSnackBarError => ', response);
    if (response.errors) {
      if (Array.isArray(response.errors)) {
        response.errors.forEach(error => {
          if (Array.isArray(error)) {
            error.forEach(errorDetail => {
              this.showMessageSnackbar('ERRORS.' + errorDetail.message.code);
            });
          } else {
            response.errors.forEach(errorData => {
              this.showMessageSnackbar('ERRORS.' + errorData.message.code);
            });
          }
        });
      }
    }
  }

  /**
   * Shows a message snackbar on the bottom of the page
   * @param messageKey Key of the message to i18n
   * @param detailMessageKey Key of the detail message to i18n
   */
  showMessageSnackbar(messageKey, detailMessageKey?) {
    const translationData = [];
    if (messageKey) {
      translationData.push(messageKey);
    }

    if (detailMessageKey) {
      translationData.push(detailMessageKey);
    }

    this.translate.get(translationData).subscribe(data => {
      this.snackBar.open(
        messageKey ? data[messageKey] : '',
        detailMessageKey ? data[detailMessageKey] : '',
        {
          duration: 5000
        }
      );
    });
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
