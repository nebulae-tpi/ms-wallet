import { tap } from 'rxjs/operators';
import { FuseTranslationLoaderService } from './../../../../core/services/translation-loader.service';
import { WalletSpendingRuleService } from '../wallet-spending-rules.service';
import { Component, OnDestroy, OnInit, Input } from '@angular/core';
import { fuseAnimations } from '../../../../core/animations';
import {MatSnackBar} from '@angular/material';
// tslint:disable-next-line:import-blacklist
import * as Rx from 'rxjs/Rx';
import { FormGroup, FormControl, Validators, FormArray, FormBuilder, AbstractControl } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { filter, mergeMap, map } from 'rxjs/operators';
import { ObservableMedia } from '@angular/flex-layout';
import { from, forkJoin, of } from 'rxjs';
import { locale as english } from '../i18n/en';
import { locale as spanish } from '../i18n/es';


export interface SpendingRule {
  id: string;
  businessId: String;
  businessName: String;
  editedBy: string;
  lastEditionTimestamp: number;
  minOperationAmount: number;
  autoPocketSelectionRules: AutoPocketRule[];
  productBonusConfigs: ProductConfigRule[];
}

export interface ProductConfigRule {
  type: string;
  concept: string;
  bonusType: String;
  bonusValueByMain: number;
  bonusValueByCredit: number;
}

export interface AutoPocketRule {
  priority: number;
  pocketToUse: string;
  condition: { pocket: string, comparator: string, value: number | null };
}



@Component({
  // tslint:disable-next-line:component-selector
  selector: 'spending-rule',
  templateUrl: './spending-rule.component.html',
  styleUrls: ['./spending-rule.component.scss'],
  animations: fuseAnimations
})
export class SpendingRuleComponent implements OnInit, OnDestroy {
  @Input() currentVersion = true;
  selectedSpendingRule: SpendingRule;
  // screenMode = 0;
  alertBorderAtProductBonusConfig: -1;
  alertBorderAtAutopocketSelectionRule: -1;
  typeAndConcepts: {type: string, concepts: string[]}[];

  settingsForm: FormGroup = new FormGroup({
    businessId: new FormControl('', [Validators.required]),
    businessName: new FormControl('', [Validators.required]),
    productBonusConfigs: new FormArray([]),
    autoPocketSelectionRules: new FormArray([])
  });

  constructor(
    private walletSpendingRuleService: WalletSpendingRuleService,
    private route: ActivatedRoute,
    private translationLoader: FuseTranslationLoaderService,
    private formBuilder: FormBuilder,
    public snackBar: MatSnackBar,
    private observableMedia: ObservableMedia ) {
      this.translationLoader.loadTranslations(english, spanish);
      this.settingsForm.get('autoPocketSelectionRules').setValidators([ Validators.required]);
      this.settingsForm.get('productBonusConfigs').setValidators([ this.validateAllProductBonusConfigs.bind(this) ]);
      this.settingsForm.setValidators([this.validateAll.bind(this)]);
  }


  ngOnInit() {

    // const grid = new Map([['xs', 1], ['sm', 2], ['md', 3], ['lg', 4], ['xl', 5]]);
    // let start: number;
    // grid.forEach((cols, mqAlias) => {
    //   if (this.observableMedia.isActive(mqAlias)) {
    //     start = cols;
    //   }
    // });

    // this.observableMedia.asObservable()
    //   .map(change => grid.get(change.mqAlias))
    //   .startWith(start)
    //   .subscribe((e: number) => { this.screenMode = e; }, err => console.log(err));




    this.route.params
    .pipe(
      filter(params => params['buId']),
      map(params => params['buId']),
      mergeMap(buId => forkJoin(
        this.walletSpendingRuleService.getTypeAndConcepts$()
        .pipe( tap(typeAndConcepts => this.typeAndConcepts = JSON.parse(JSON.stringify(typeAndConcepts))) ),
        of(buId)
      )),
      mergeMap( ([x, buId]) => this.walletSpendingRuleService.getSpendinRule$(buId)),
      map(rule => JSON.parse(JSON.stringify(rule))),
      tap(spendingRule => this.selectedSpendingRule = spendingRule),
      mergeMap(spendingRule => this.loadSpendingRule$(spendingRule))
    )
    .subscribe(p => {}, e => console.log(e), () => console.log('Completed'));

  }

  /**
   *
   * @param businesId Business id to search its spending rule
   */
  loadSpendingRule$(spendingRule: any){
    return Rx.Observable.of(spendingRule)
    .pipe(
      mergeMap((spendingRuleItem: SpendingRule) => Rx.Observable.forkJoin(
        Rx.Observable.of(spendingRuleItem)
        .pipe(
          tap(sr => {
            this.settingsForm.get('businessName').setValue(sr.businessName);
            this.settingsForm.get('businessId').setValue(sr.businessId);
            this.settingsForm.addControl('minOperationAmount', new FormControl(sr.minOperationAmount, [ Validators.required ]) );
          })
        ),
        Rx.Observable.of(spendingRuleItem)
        .pipe(
          filter(rule => (rule.autoPocketSelectionRules != null) ),
          map(sr => sr.autoPocketSelectionRules.sort((a: AutoPocketRule , b: AutoPocketRule) => a.priority - b.priority )),
          mergeMap(autoPocketRules =>
            from(autoPocketRules).pipe(
              tap(autoPocketRule =>  this.addAutoPocketSelectionRule(autoPocketRule)  )
            )
          )
        ),
        Rx.Observable.of(spendingRuleItem)
        .pipe(
          filter(rule => (rule.productBonusConfigs != null) ),
          map(sr => sr.productBonusConfigs),
          mergeMap(productRules =>
            from(productRules).pipe(
              tap(productRule =>  this.addProductSetting(productRule))
            )
          )
        )
      )
      )
    );
  }

  addProductSetting(productConfig?: ProductConfigRule ): void {
    const items = this.settingsForm.get('productBonusConfigs') as FormArray;
    items.push(this.createProductSetting( productConfig ));
  }
  addAutoPocketSelectionRule(autoPocketRule?: AutoPocketRule ): void {
    const items = this.settingsForm.get('autoPocketSelectionRules') as FormArray;
    items.push(this.createAutoPocketRule( autoPocketRule ));
  }

  deleteControl(formType: string, index: number){
    this.alertBorderAtAutopocketSelectionRule = this.alertBorderAtProductBonusConfig = -1;
    const formGroup = this.settingsForm.get(formType) as FormArray;
    formGroup.removeAt(index);
  }

  createAutoPocketRule(pocketRule: AutoPocketRule) {
    if (!pocketRule){
      pocketRule = {
        priority : (this.settingsForm.get('autoPocketSelectionRules') as FormArray).length + 1,
        pocketToUse: 'MAIN',
        condition: {
          pocket: 'MAIN',
          comparator: 'ENOUGH',
          value: null
        }
      };
    }
    const group = this.formBuilder.group({
      priority: new FormControl({ value: pocketRule.priority, disabled: !this.currentVersion }, [Validators.required, Validators.min(1)]),
      pocketToUse: new FormControl({ value: pocketRule.pocketToUse, disabled: !this.currentVersion }, [Validators.required]),
      pocket: new FormControl({ value: pocketRule.condition.pocket, disabled: !this.currentVersion }, [Validators.required]),
      comparator: new FormControl({ value: pocketRule.condition.comparator, disabled: !this.currentVersion }, [Validators.required]),
      value: new FormControl({ value: pocketRule.condition.value, disabled: !this.currentVersion } )
    });
    group.setValidators(this.validateComparatorValue.bind(this));
    return group;
  }

  createProductSetting(productConfig?: ProductConfigRule) {
    if (!productConfig){
      productConfig = {
        type: '',
        concept: '',
        bonusType: 'PERCENTAGE',
        bonusValueByMain: 0,
        bonusValueByCredit: 0
      };
    }
    const productType = this.typeAndConcepts.find(e => e.type.toUpperCase() === productConfig.type);
    return this.formBuilder.group({
      type: new FormControl( { value: productType, disabled: !this.currentVersion  }, [Validators.required]),
      concept: new FormControl({ value: productConfig.concept, disabled: !this.currentVersion },
        [ Validators.required, Validators.minLength(5), Validators.maxLength(30)]),
      bonusType: new FormControl({ value: productConfig.bonusType, disabled: !this.currentVersion }, [Validators.required]),
      bonusValueByMain: new FormControl({ value: productConfig.bonusValueByMain, disabled: !this.currentVersion }, [
          Validators.required,
          Validators.min(0)
        ]
      ),
      bonusValueByCredit: new FormControl({ value: productConfig.bonusValueByCredit, disabled: !this.currentVersion }, [
        Validators.required,
        Validators.min(0)
      ]
    )
    });
  }

  validateComparatorValue(formsGroup: FormGroup): {[s: string]: boolean} {
    console.log('####################', formsGroup);
    if ( (formsGroup.controls.comparator.value !== 'INS' && formsGroup.controls.comparator.value !== 'ENOUGH' ) && formsGroup.controls.comparator.value.value == null  ){
      console.log('return {"valueRequired": true };');
      return {'valueRequired': true };
    }

    return null;
  }

  validateAllProductBonusConfigs(): { [s: string]: boolean } {
    const productsConfsControls = this.settingsForm.get('productBonusConfigs') as FormArray;
    let error = null;
    productsConfsControls.controls.forEach((productsConfs: FormGroup) => {
      Object.keys(productsConfs.controls).forEach(atr => {
        if (productsConfs.controls[atr].errors){
          error = { 'Invalid' : true};
        }
      });
    });
    return error || null;
  }

  validateAll(): { [s: string]: boolean } {
    if ( this.settingsForm.get('minOperationAmount') && this.settingsForm.get('minOperationAmount').errors) {
      return  { 'conceptAndtypeRequired': true };
    }
    if (this.settingsForm.get('productBonusConfigs').errors){
      return {'someProductConfigInvalid': true};
    }
    if (this.settingsForm.get('autoPocketSelectionRules').errors){
      return {'somePocketSelectionRulesInvalid': true};
    }
    return null;
  }

  saveSpendingRule() {
    Rx.Observable.of(this.settingsForm.getRawValue())
      .pipe(
        map(({
          businessId,
          minOperationAmount,
          productBonusConfigs,
          autoPocketSelectionRules
        }) => ({
          businessId,
          minOperationAmount,
          productBonusConfigs: productBonusConfigs.reduce(
            (acc, p) => {
              acc.push({
                type: p.type.type.toUpperCase(),
                concept: p.concept.toUpperCase(),
                bonusType: p.bonusType,
                bonusValueByMain: this.truncateNumber(p.bonusValueByMain),
                bonusValueByCredit: this.truncateNumber(p.bonusValueByCredit)
              });
              return acc;
            },
            []
          ),
          autoPocketSelectionRules: autoPocketSelectionRules.reduce(
            (acc, p) => {
              acc.push({
                priority: p.priority,
                pocketToUse: p.pocketToUse,
                condition: {
                  pocket: p.pocket,
                  comparator: p.comparator,
                  value: p.value ?  this.truncateNumber(p.value) : null
                }
              });
              return acc;
            },
            []
          )
        })
      ),
        tap((sr: SpendingRule) => this.selectedSpendingRule = {...this.selectedSpendingRule, ... sr}),
        mergeMap(spendingRuleUpdate => this.walletSpendingRuleService.updateSpendingRule$(spendingRuleUpdate)),
        tap((result: any) => {
          if (!result.erros) {
            this.snackBar.open( this.translationLoader.getTranslate().instant('RESULTS.UPDATE_DONE') , '', {
              duration: 3000,
            });
          }
        })
      )
      .subscribe(r => {}, e => console.log(), () => {});
  }

  undoChanges(){

    console.log('form ===>', this.settingsForm);

    // Rx.Observable.of(this.selectedSpendingRule)
    // .pipe(
    //   tap(() => {
    //     this.settingsForm = new FormGroup({
    //       businessId: new FormControl({value: '', disabled: true}, [Validators.required]),
    //       businessName: new FormControl({value: '', disabled: true}, [Validators.required]),
    //       // minOperationAmount: new FormControl(null, [Validators.required]),
    //       productBonusConfigs: new FormArray([], [Validators.required]),
    //       autoPocketSelectionRules: new FormArray([], [Validators.required])
    //     });
    //   }),
    //   mergeMap(() => this.loadSpendingRule$(this.selectedSpendingRule) )
    // )
    // .subscribe(r => {}, e => console.log(e), () => console.log('Completed') );
  }

  truncateNumber(number: number, decimals: number = 2): number{
    const amountAsString = number.toString();
    return (amountAsString.indexOf('.') !== -1 &&  ( amountAsString.length - amountAsString.indexOf('.') > decimals + 1 ) )
            ? Math.floor(parseFloat(amountAsString) * Math.pow(10, decimals)) / Math.pow(10, decimals)
            : parseFloat(amountAsString);
  }

  ngOnDestroy() {
  }

}
