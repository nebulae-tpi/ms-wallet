import { ManualPocketAdjustmentService } from './manual-pocket-adjustment.service';
import { WalletService } from '../wallet.service';
////////// RXJS ///////////
// tslint:disable-next-line:import-blacklist
import * as Rx from 'rxjs/Rx';
import {  mergeMap, takeUntil, tap, map, toArray, filter } from 'rxjs/operators';
import { Subject, BehaviorSubject } from 'rxjs';

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

@Component({
  selector: 'app-manual-pocket-adjustment',
  templateUrl: './manual-pocket-adjustment.component.html',
  styleUrls: ['./manual-pocket-adjustment.component.scss']
})
export class ManualPocketAdjustmentComponent implements OnInit, OnDestroy{
  private ngUnsubscribe = new Subject();
  manualBalanceAdjustmentsForm: FormGroup;
  selectedBusinessData: any = null;
  allBusiness: any = [];
  wallet: any = null;
  value;
  private selectedBusinessSubject$ = new Subject();

  constructor(
    private walletService: WalletService,
    private manualPocketAdjustmentService: ManualPocketAdjustmentService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private formBuilder: FormBuilder,
    private translationLoader: FuseTranslationLoaderService,
    private translate: TranslateService,
  ) {
    this.translationLoader.loadTranslations(english, spanish);
  }

  ngOnInit() {
    this.manualBalanceAdjustmentsForm = this.createManualBalanceAdjustmentForm();
    this.loadBusinessData();
    this.loadWalletData();
  }

  /**
   * Loads all the information needed for the form (business)
   */
  loadBusinessData(){
    this.getAllBusiness$().pipe(
      mergeMap(resp => this.graphQlAlarmsErrorHandler$(resp)),
      filter((resp: any) => !resp.errors || resp.errors.length === 0),
      takeUntil(this.ngUnsubscribe)
    ).subscribe(businessData => {
      this.allBusiness = businessData;
    });

  }

  /**
   * Get the wallet info according to the selected business
   */
  loadWalletData(){
    this.selectedBusinessSubject$
    .pipe(
      mergeMap(selectedBusiness => this.getWallet$(selectedBusiness)),
      mergeMap(resp => this.graphQlAlarmsErrorHandler$(resp)),
      filter((resp: any) => !resp.errors || resp.errors.length === 0),
      takeUntil(this.ngUnsubscribe)
    ).subscribe(wallet => {
      console.log('loadWalletData => ', wallet);

      this.wallet = wallet;
    });
  }

  /**
   * Creates an observable of business
   */
  getAllBusiness$() {
    return this.walletService.getBusinesses$().pipe(
      mergeMap(res => {
        console.log('getAllBusiness => ', res);
        return Rx.Observable.from(res.data.getWalletBusinesses);
      }),
      map((business: any) => {
        return {
          _id: business._id,
          name: business.name
        };
      }),
      toArray()
    );
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
    return this.formBuilder.group({
      value: new FormControl(null, [Validators.required, Validators.min(1)]),
      notes: new FormControl(null, [Validators.minLength(20), Validators.maxLength(200), Validators.required]),
      business: new FormControl(null, Validators.required),
    });
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
      map(accepted => {
        const data = this.manualBalanceAdjustmentsForm.getRawValue();
        const manualBalanceAdjustment = {
          adjustmentType,
          businessId: data.business._id,
          value: this.value,
          notes: data.notes
        };
        return manualBalanceAdjustment;
      }),
      mergeMap(manualBalanceAdjustment => this.manualPocketAdjustmentService.makeManualBalanceAdjustment$(manualBalanceAdjustment)),
      mergeMap(resp => this.graphQlAlarmsErrorHandler$(resp)),
      filter((resp: any) => !resp.errors || resp.errors.length === 0)
    ).subscribe(res => {
      formDirective.resetForm();
      this.manualBalanceAdjustmentsForm.reset();
      this.snackBar.open(this.translationLoader.getTranslate().instant('WALLET.EXECUTED_OPERATION'),
      this.translationLoader.getTranslate().instant('WALLET.CLOSE'), {
        duration: 2000
      });
    },
    error => {
      console.log('Error realizando operación ==> ', error);
    });




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
   * Listens when a new business have been selected
   * @param business  selected business
   */
  onSelectBusinessEvent(business) {
    this.selectedBusinessSubject$.next(business);
  }

    /**
   * Handles the Graphql errors and show a message to the user
   * @param response
   */
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
    if (response.errors) {
      if (Array.isArray(response.errors)) {
        response.errors.forEach(error => {
          if (Array.isArray(error)) {
            error.forEach(errorDetail => {
              this.showMessageSnackbar('ERRORS.' + errorDetail.message.code);
            });
          } else {
            response.errors.forEach(err => {
              this.showMessageSnackbar('ERRORS.' + err.message.code);
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
