import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import * as Rx from 'rxjs';
import { GatewayService } from '../../../../api/gateway.service';
import {
  makeManualBalanceAdjustment
} from '../gql/wallet';

@Injectable()
export class ManualPocketAdjustmentService {

  constructor(private gateway: GatewayService) { }

  /**
   * Make a new manual balance adjustment
   * @param mba Balance adjustment to be created
   */
  makeManualBalanceAdjustment$(mba: any): Observable<any> {
    const manualBalanceAdjustmentInput = {
      businessWalletId: mba.businessWalletId,
      walletId: mba.walletId,
      location: mba.location,
      value: mba.value,
      adjustmentType: mba.adjustmentType,
      notes: mba.notes,
    };

    return this.gateway.apollo.mutate<any>({
      mutation: makeManualBalanceAdjustment,
      variables: {
        input: manualBalanceAdjustmentInput
      },
      errorPolicy: 'all'
    });
  }

}
