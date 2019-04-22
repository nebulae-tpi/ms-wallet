import { ManualPocketAdjustmentService } from './manual-pocket-adjustment.service';
import { WalletService } from '../wallet.service';
////////// RXJS ///////////
// tslint:disable-next-line:import-blacklist
import * as Rx from 'rxjs/Rx';
import {  mergeMap, takeUntil, tap, map, toArray, filter, startWith, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Subject, Observable } from 'rxjs';

////////// ANGULAR //////////
import { Component, OnInit, OnDestroy} from '@angular/core';
import { FormBuilder, FormGroup, FormControl, Validators, FormGroupDirective } from '@angular/forms';

//////////// ANGULAR MATERIAL ///////////
import {
  MatDialog,
  MatSnackBar
} from '@angular/material';

//////////// i18n ////////////
import { FuseTranslationLoaderService } from '../../../../core/services/translation-loader.service';
import { TranslateService } from '@ngx-translate/core';
import { locale as english } from '../i18n/en';
import { locale as spanish } from '../i18n/es';

////////// COMPONENTS /////////
import { DialogComponent } from '../dialog/dialog.component';
import { ToolbarService } from '../../../toolbar/toolbar.service';

@Component({
// tslint:disable-next-line: component-selector
  selector: 'app-manual-pocket-adjustment',
  templateUrl: './manual-pocket-adjustment.component.html',
  styleUrls: ['./manual-pocket-adjustment.component.scss']
})
export class ManualPocketAdjustmentComponent implements OnInit, OnDestroy{
  private ngUnsubscribe = new Subject();
  manualBalanceAdjustmentsForm: FormGroup;
  selectedBusinessData: any = null;
  wallet: any = null;

  businessQueryFiltered$: Observable<any[]>; // Wallet autocomplete supplier
  selectedWallet: any = null;
  selectedBusinessId: any;

  constructor(
    private walletService: WalletService,
    private manualPocketAdjustmentService: ManualPocketAdjustmentService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private formBuilder: FormBuilder,
    private translationLoader: FuseTranslationLoaderService,
    private translate: TranslateService,
    private toolbarService: ToolbarService,
  ) {
    this.translationLoader.loadTranslations(english, spanish);
  }

  ngOnInit() {
    this.createManualBalanceAdjustmentForm(); // form initializer
    this.loadWalletFilter();            // BusinessQueryFiltered$ initializer
    this.listenBusinessChanges();
  }

  listenBusinessChanges(){
    this.toolbarService.onSelectedBusiness$
    .pipe(
      tap(bu => {
        this.selectedBusinessId = (bu && bu.id) ? bu.id : undefined;
        if (this.manualBalanceAdjustmentsForm){
          this.manualBalanceAdjustmentsForm.get('wallet').setValue(null);
        }
      })
    )
    .subscribe();
  }



  loadWalletFilter() {
    this.businessQueryFiltered$ = this.manualBalanceAdjustmentsForm.get('wallet').valueChanges.pipe(
      startWith(undefined),
      filter(filterValue  => typeof filterValue === 'string'),
      debounceTime(500),
      distinctUntilChanged(),
      mergeMap((filterText: String) => this.getWalletsFiltered$(filterText, 10))
    );
  }

  getWalletsFiltered$(filterText: String, limit: number): Observable<any[]> {
    return this.walletService.getWalletsByFilter(filterText, this.selectedBusinessId, limit)
      .pipe(
        mergeMap(resp => this.graphQlAlarmsErrorHandler$(resp)),
        filter(resp => !resp.errors),
        mergeMap(result => Observable.from(result.data.getWalletsByFilter)),
        toArray()
      );
  }

   /**
   * Listens when a new wallet have been selected
   * @param wallet  selected wallet
   */
  onSelectWalletEvent(wallet) {
    console.log('onSelectWalletEvent => ', wallet);
  }


  /**
   * Gets the wallet info associated with the business
   * @param business Business to query the info
   */
  getWallet$(business){
    return this.walletService.getWallet$(business._id)
    .pipe(
      map((wallet: any) => {
        return {
          businessId: '4312432',
          pocket: {
            main: 0,
            bonus: 0,
            credit: 0
          },
          state: '',
          _id: ''
        };
      })
    );
  }

    /**
   * Creates the business detail form and its validations
   */
  createManualBalanceAdjustmentForm() {
    this.manualBalanceAdjustmentsForm = this.formBuilder.group({
      value: new FormControl(null, [Validators.required, Validators.min(1)]),
      notes: new FormControl(null, [Validators.minLength(20), Validators.maxLength(200), Validators.required]),
      wallet: new FormControl(null, [Validators.required, this.validateWalletSelection ]),
    });
  }

  displayFn(wallet): string | undefined {
    return wallet ? `${wallet.fullname}: ${wallet.documentId} (${this.translate.instant('WALLET.ENTITY_TYPES.' + wallet.type)})` : '';
  }

  displayFnWrapper() {
    return (offer) => this.displayFn(offer);
  }

  validateWalletSelection(c: FormControl){
    if ( typeof c.value === 'string' || !c.value ){ return { walletSelected: { valid: false } }; }
    return null;
  }

  /**
   *
   * @param adjustmentType Indicates if the adjustment type is 'ACCREDIT' or 'DEBIT'
   */
  makeManualBalanceAdjustment(adjustmentType: String, formDirective: FormGroupDirective){
    this.dialog
    // Opens confirm dialog
    .open(DialogComponent, {
      data: {
        dialogMessage: 'WALLET.MAKE_MANUAL_BALANCE_ADJUSTMENT_MESSAGE',
        dialogTitle: 'WALLET.MAKE_MANUAL_BALANCE_ADJUSTMENT_TITLE'
      }
    })
    .afterClosed()
    .pipe(
      filter(accepted => accepted),
      map(() => {
        const data = this.manualBalanceAdjustmentsForm.getRawValue();
        const manualBalanceAdjustment = {
          adjustmentType,
          walletId: data.wallet._id,
          businessWalletId: this.selectedBusinessId,
          value: data.value,
          notes: data.notes
        };
        return manualBalanceAdjustment;
      }),
      filter(mba => {
        if (mba && !mba.businessWalletId) {
          this.showMessageSnackbar('ERRORS.BUSINESS_REQUIRED');
          return false;
        }
        else { return true; }
      }),
      mergeMap(mba => this.manualPocketAdjustmentService.makeManualBalanceAdjustment$(mba)),
      // mergeMap(resp => this.graphQlAlarmsErrorHandler$(resp)),
      // filter((resp: any) => !resp.errors || resp.errors.length === 0)
    ).subscribe(() => {
      formDirective.resetForm();
      this.manualBalanceAdjustmentsForm.reset();
      this.snackBar.open(this.translationLoader.getTranslate().instant('WALLET.EXECUTED_OPERATION'),
        this.translationLoader.getTranslate().instant('WALLET.CLOSE'), {
          duration: 5000
        });
    },
      error => console.log('Error realizando operación ==> ', error)
    );




    // this.manualPocketAdjustmentService.makeManualBalanceAdjustment$(manualBalanceAdjustment)
    // .pipe(
    //   mergeMap(resp => this.graphQlAlarmsErrorHandler$(resp)),
    //   filter((resp: any) => !resp.errors || resp.errors.length === 0)
    // )
    // .subscribe(res => {
    //   this.snackBar.open(this.translationLoader.getTranslate().instant('WALLET.EXECUTED_OPERATION'),
    //   this.translationLoader.getTranslate().instant('WALLET.CLOSE'), {
    //     duration: 2000
    //   });
    // },
    // error => {
    //   console.log("Error realizando operación ==> ", error);
    // })

  }

    /**
   * Handles the Graphql errors and show a message to the user
   * @param response
   */
  graphQlAlarmsErrorHandler$(response: any) {
    return Rx.Observable.of(JSON.parse(JSON.stringify(response))).pipe(
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

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }

}
