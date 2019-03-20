import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../../core/modules/shared.module';
import { DatePipe } from '@angular/common';
import { FuseWidgetModule } from '../../../core/components/widget/widget.module';
import { CurrencyMaskModule } from "ng2-currency-mask";
import { TransactionHistoryService } from './transaction-history/transaction-history.service';
import { ManualPocketAdjustmentService } from './manual-pocket-adjustment/manual-pocket-adjustment.service';
import { TransactionHistoryDetailService } from './transaction-history-detail/transaction-history-detail.service';
import { WalletErrorsService } from './wallet-errors/wallet-errors.service';
import { WalletService } from './wallet.service';
import { walletComponent } from './wallet.component';
import { TransactionHistoryComponent } from './transaction-history/transaction-history.component';
import { ManualPocketAdjustmentComponent } from './manual-pocket-adjustment/manual-pocket-adjustment.component';
import { TransactionHistoryDetailComponent } from './transaction-history-detail/transaction-history-detail.component';
import { WalletErrorsComponent } from './wallet-errors/wallet-errors.component';
import { GeneralErrorsComponent } from './wallet-errors/general-errors/general-errors.component';
import { DialogComponent } from './dialog/dialog.component';
import { CurrencyFormatterDirective } from './directives/currencyFormatter.directive';
import { CurrencyPipe } from './directives/currency.pipe';

const routes: Routes = [
  {
    path: 'transaction-history',
    component: TransactionHistoryComponent,
  },
  {
    path: 'transaction-history/:id',
    component: TransactionHistoryDetailComponent,
  },
  {
    path: 'manual-pocket-adjustment',
    component: ManualPocketAdjustmentComponent,
  },
  {
    path: 'wallet-errors',
    component: WalletErrorsComponent,
  }
];

@NgModule({
  imports: [
    SharedModule,
    RouterModule.forChild(routes),
    FuseWidgetModule,
    CurrencyMaskModule
  ],
  declarations: [
    walletComponent,
    WalletErrorsComponent,
    TransactionHistoryComponent,
    TransactionHistoryDetailComponent,
    ManualPocketAdjustmentComponent,
    GeneralErrorsComponent,
    CurrencyFormatterDirective,
    DialogComponent,
    CurrencyPipe
  ],
  entryComponents: [DialogComponent],
  providers: [ WalletService, WalletErrorsService, DatePipe, ManualPocketAdjustmentService, TransactionHistoryService, TransactionHistoryDetailService, CurrencyPipe]
})

export class WalletModule {}
