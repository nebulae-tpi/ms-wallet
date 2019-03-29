////////// ANGULAR //////////
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

////////// RXJS ///////////
import {
  map,
  mergeMap,
  toArray,
  tap
} from 'rxjs/operators';
import { Subject, fromEvent, from, of, Observable } from 'rxjs';

//////////// Services ////////////
import { KeycloakService } from 'keycloak-angular';
import { WalletService } from './../wallet.service';
import { TransactionHistoryDetailService } from './transaction-history-detail.service';

//////////// i18n ////////////
import { FuseTranslationLoaderService } from '../../../../core/services/translation-loader.service';
import { TranslateService } from '@ngx-translate/core';
import { locale as english } from '../i18n/en';
import { locale as spanish } from '../i18n/es';

//////////// ANGULAR MATERIAL ///////////
import {
  MatPaginator,
  MatSort,
  MatTableDataSource,
  MatSnackBar
} from '@angular/material';
import { fuseAnimations } from '../../../../core/animations';

@Component({
// tslint:disable-next-line: component-selector
  selector: 'app-transaction-history-detail',
  templateUrl: './transaction-history-detail.component.html',
  styleUrls: ['./transaction-history-detail.component.scss']
})
export class TransactionHistoryDetailComponent implements OnInit, OnDestroy {
  private ngUnsubscribe = new Subject();

  // Table data
  dataSource = new MatTableDataSource();
  // Columns to show in the table
  displayedColumns = [
    'timestamp',
    'type',
    'concept',
    'amount',
    'pocket',
    'user'
  ];

  userRoles: any;
  isPlatformAdmin: Boolean = false;

  canViewRelatedtransactions = false;
  rolesToChangeWallet = ['PLATFORM-ADMIN', 'BUSINESS-OWNER'];

  selectedTransaction: any = {
    terminal: {}
  };
  selectedBusiness: any = null;

  constructor(
    private translationLoader: FuseTranslationLoaderService,
    private keycloakService: KeycloakService,
    private activatedRouter: ActivatedRoute,
    private walletService: WalletService,
    private transactionHistoryDetailService: TransactionHistoryDetailService
  ) {
    this.translationLoader.loadTranslations(english, spanish);
  }

  ngOnInit() {
    this.checkIfUserIsPlatformAdmin();
    this.loadTransactionHistory();
  }

  /**
   * Checks if the user is system admin
   */
  async checkIfUserIsPlatformAdmin() {
    this.userRoles = await this.keycloakService.getUserRoles(true);
    this.canViewRelatedtransactions = this.userRoles.filter(value => -1 !== this.rolesToChangeWallet.indexOf(value)).length > 0;
    this.isPlatformAdmin = this.userRoles.some(role => role === 'PLATFORM-ADMIN');
  }

  /**
   * Loads the transaction history according to the url param
   */
  loadTransactionHistory() {
    this.activatedRouter.params
      .pipe(
        mergeMap(params => this.transactionHistoryDetailService.getTransactionHistoryById$(params.id)),
        map(response => response.data.getWalletTransactionsHistoryById),
        map(tx => {
          this.selectedTransaction = tx;
          return tx;
        }),
        mergeMap(tx => {
          const hasAssociatedTxIds = tx.associatedTransactionIds != null && tx.associatedTransactionIds.length > 0;

          if (!hasAssociatedTxIds) {
            return of([tx]);
          }

          console.log('Transacciones asociadas', tx.associatedTransactionIds);

          return this.canViewRelatedtransactions
          ? this.transactionHistoryDetailService.getAssociatedTransactionsHistoryByTransactionHistoryId$(tx._id)
          : of([]);
        }),
        map((r: any) => ( r && r.data && r.data.getAssociatedTransactionsHistoryByTransactionHistoryId)),
        tap(atxs => {
          console.log('ATXS LIST ==>', atxs);
          this.dataSource.data = atxs;
        })
      )
      .subscribe();
  }

  /**
   * get the business by id
   * @returns {Observable}
   */
  getBusinessById$(id) {
    return this.walletService
      .getBusinessById$(id)
      .pipe(map((res: any) => res.data.getBusinessById));
  }

  /**
   * Receives the selected transaction history
   * @param transactionHistory selected transaction history
   */
  selectTransactionHistoryRow(transactionHistory) {
    this.selectedTransaction = transactionHistory;
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
