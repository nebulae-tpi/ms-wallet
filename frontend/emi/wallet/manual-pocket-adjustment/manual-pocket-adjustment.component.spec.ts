import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ManualPocketAdjustmentComponent } from './manual-pocket-adjustment.component';

describe('ManualPocketAdjustmentComponent', () => {
  let component: ManualPocketAdjustmentComponent;
  let fixture: ComponentFixture<ManualPocketAdjustmentComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ManualPocketAdjustmentComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ManualPocketAdjustmentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
