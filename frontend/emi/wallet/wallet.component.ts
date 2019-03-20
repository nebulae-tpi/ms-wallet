import { WalletService } from './wallet.service';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { fuseAnimations } from '../../../core/animations';
import { Subscription } from 'rxjs/Subscription';
import * as Rx from 'rxjs/Rx';

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'wallet',
  templateUrl: './wallet.component.html',
  styleUrls: ['./wallet.component.scss'],
  animations: fuseAnimations
})
export class walletComponent implements OnInit, OnDestroy {
  
  helloWorld: String = 'Hello World static.';
  helloWorldLabelQuery$: Rx.Observable<any>;
  helloWorldLabelSubscription$: Rx.Observable<any>;

  constructor(private walletervice: WalletService  ) {  
      

  }
    

  ngOnInit() {
    // this.helloWorldLabelQuery$ = this.walletervice.getHelloWorld$();
    // this.helloWorldLabelSubscription$ = this.walletervice.getEventSourcingMonitorHelloWorldSubscription$();
  }

  
  
  ngOnDestroy() {
  }

}
