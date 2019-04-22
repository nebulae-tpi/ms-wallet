////////// ANGULAR //////////
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

////////// RXJS ///////////
import {
  map,
  mergeMap,
  tap,
  filter,
} from 'rxjs/operators';
import { Subject, of, forkJoin } from 'rxjs';

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
  MatSnackBar,
  MatDialog
} from '@angular/material';
import { fuseAnimations } from '../../../../core/animations';
import { DialogComponent } from '../dialog/dialog.component';

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

  selectedTransactionName = '';
  walletDocumentId = '';
  disabledRevertBtn = false;

  constructor(
    private translationLoader: FuseTranslationLoaderService,
    private keycloakService: KeycloakService,
    private activatedRouter: ActivatedRoute,
    private walletService: WalletService,
    private transactionHistoryDetailService: TransactionHistoryDetailService,
    private dialog: MatDialog,
    private translate: TranslateService,
    private snackBar: MatSnackBar,
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
        tap(tx => this.selectedTransaction = JSON.parse(JSON.stringify(tx))),
        mergeMap(tx => forkJoin(of(tx), this.loadWalletName$(tx)) ),
        mergeMap(([tx, a]) => {
          const hasAssociatedTxIds = tx.associatedTransactionIds != null && tx.associatedTransactionIds.length > 0;

          if (!hasAssociatedTxIds) {
            return of([tx]);
          }
          return this.canViewRelatedtransactions
          ? this.transactionHistoryDetailService.getAssociatedTransactionsHistoryByTransactionHistoryId$(tx._id)
          : of([]);
        }),
        map((r: any) => ( r && r.data && r.data.getAssociatedTransactionsHistoryByTransactionHistoryId)),
        tap(atxs => {
          this.dataSource.data = atxs;
        })
      )
      .subscribe();
  }

  loadWalletName$(transaction){
    return of(transaction.walletId)
    .pipe(
      mergeMap(wId => this.walletService.getWallet$(wId)),
      tap(r => {
        this.selectedTransactionName = ((r.data || {}).getWallet || {}).fullname || '';
        this.walletDocumentId = ((r.data || {}).getWallet || {}).documentId || '';
      })
    );
  }

  revertTransaction(){
    this.dialog.open(DialogComponent, {
      data: {
        dialogMessage: 'WALLET.REVERT_TRANSACTION_MESSAGE',
        dialogTitle: 'WALLET.REVERT_TRANSACTION_MESSAGE_TITLE'
      }
    })
    .afterClosed()
    .pipe(
      tap(() => this.disabledRevertBtn = true),
      filter(accepted => (accepted && this.selectedTransaction )),
      map(() => ([ this.selectedTransaction._id, ...this.selectedTransaction.associatedTransactionIds]) ),
      filter(ids => {        
        if (!ids || ids.length !== 2){
          console.log('Invalid Transaction to Revert');
          return false;
        }
        return true;
      }),
      mergeMap(ids => this.transactionHistoryDetailService.revertTransaction$(this.selectedTransaction.businessId, ids)),
      mergeMap(resp => this.graphQlAlarmsErrorHandler$(resp)),
      filter(r => (r && r.data && r.data.WalletRevertTransaction)),
      map(r => r.data.WalletRevertTransaction),
      tap(r => {
        if(r.code === 200){
          this.selectedTransaction.reverted = true;
        }
        console.log('graphQlAlarmsErrorHandler$', r);
      }),
    ).subscribe(
      result => { this.disabledRevertBtn = false },
      error => console.log('Error realizando operación ==> ', error)
    );

  }

      /**
   * Handles the Graphql errors and show a message to the user
   * @param response
   */
  graphQlAlarmsErrorHandler$(response: any) {
    return of(JSON.parse(JSON.stringify(response))).pipe(
      tap((resp: any) => {
        if (response && Array.isArray(response.errors)) {
          response.errors.forEach(error => {
            this.showMessageSnackbar('ERRORS.' + ((error.extensions || {}).code || 1) );
          });
        }
        return resp;
      })
    );
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
          duration: 2000
        }
      );
    });
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
