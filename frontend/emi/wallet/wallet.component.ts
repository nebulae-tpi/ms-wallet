import { WalletService } from './wallet.service';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { fuseAnimations } from '../../../core/animations';

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'wallet',
  templateUrl: './wallet.component.html',
  styleUrls: ['./wallet.component.scss'],
  animations: fuseAnimations
})
export class walletComponent implements OnInit, OnDestroy {

  constructor() {

  }

  ngOnInit() {
  }

  ngOnDestroy() {
  }

}
