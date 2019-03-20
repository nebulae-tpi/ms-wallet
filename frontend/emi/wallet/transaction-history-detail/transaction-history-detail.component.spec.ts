import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { TransactionHistoryDetailComponent } from './transaction-history-detail.component';

describe('TransactionHistoryDetailComponent', () => {
  let component: TransactionHistoryDetailComponent;
  let fixture: ComponentFixture<TransactionHistoryDetailComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ TransactionHistoryDetailComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TransactionHistoryDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
