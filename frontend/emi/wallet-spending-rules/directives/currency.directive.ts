import { Directive, HostListener, ElementRef, OnInit, Input } from '@angular/core';
import { CurrencyAndPercentagePipe } from './currency.pipe';

// tslint:disable-next-line:directive-selector
@Directive({ selector: '[myCurrencyFormatter]' })
export class CurrencyAndPercentageDirective implements OnInit {

  @Input() myCurrencyFormatter: string;

  private el: HTMLInputElement;

  constructor(
    private elementRef: ElementRef,
    private currencyPipe: CurrencyAndPercentagePipe
  ) {
    this.el = this.elementRef.nativeElement;
  }

  ngOnInit() {
    this.el.value = this.currencyPipe.transform(this.el.value, 2, this.myCurrencyFormatter);
  }

  @HostListener('input', ['$event']) onInput(event) {
    this.el.value = this.el.value.replace(/[^\d.-]/g, '');
  }

  @HostListener('focus', ['$event.target.value'])
  onFocus(value) {
    this.el.value = this.currencyPipe.parse(value, 2,  this.myCurrencyFormatter); // opossite of transform
  }

  @HostListener('blur', ['$event.target.value'])
  onBlur(value) {
    this.el.value = this.currencyPipe.transform(value, 2, this.myCurrencyFormatter);
  }


}
