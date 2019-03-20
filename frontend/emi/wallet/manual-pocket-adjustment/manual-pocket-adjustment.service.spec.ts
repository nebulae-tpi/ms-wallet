import { TestBed, inject } from '@angular/core/testing';

import { ManualPocketAdjustmentService } from './manual-pocket-adjustment.service';

describe('ManualPocketAdjustmentService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ManualPocketAdjustmentService]
    });
  });

  it('should be created', inject([ManualPocketAdjustmentService], (service: ManualPocketAdjustmentService) => {
    expect(service).toBeTruthy();
  }));
});
