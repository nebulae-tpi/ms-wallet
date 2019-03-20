import { Injectable } from "@angular/core";
import { Observable } from "rxjs/Observable";
import * as Rx from "rxjs";
import { GatewayService } from "../../../../api/gateway.service";
import {
  makeManualBalanceAdjustment
} from "../gql/wallet";

@Injectable()
export class ManualPocketAdjustmentService {

  constructor(private gateway: GatewayService) { }

  /**
   * Make a new manual balance adjustment
   * @param manualBalanceAdjustment Balance adjustment to be created
   */
  makeManualBalanceAdjustment$(manualBalanceAdjustment): Observable<any> {
    const manualBalanceAdjustmentInput = {
      businessId: manualBalanceAdjustment.businessId,
      location: manualBalanceAdjustment.location,
      value: manualBalanceAdjustment.value,
      adjustmentType: manualBalanceAdjustment.adjustmentType,
      notes: manualBalanceAdjustment.notes,    
    };

    return this.gateway.apollo.mutate<any>({
      mutation: makeManualBalanceAdjustment,
      variables: {
        input: manualBalanceAdjustmentInput
      },
      errorPolicy: "all"
    });
  }

}
