import { Directive, HostListener, ElementRef, OnInit, Input } from '@angular/core';
import { CurrencyPipe } from './currency.pipe';

// tslint:disable-next-line:directive-selector
@Directive({ selector: '[currencyFormatter]' })
export class CurrencyFormatterDirective implements OnInit {

  @Input() currencyFormatter: string;

  private el: HTMLInputElement;

  constructor(
    private elementRef: ElementRef,
    private currencyPipe: CurrencyPipe
  ) {
    this.el = this.elementRef.nativeElement;
  }

  ngOnInit() {
    this.el.value = this.currencyPipe.transform(this.el.value, 2, this.currencyFormatter);
  }

  @HostListener('input', ['$event']) onInput(event) {
    this.el.value = this.el.value.replace(/[^\d.-]/g, '');
  }

  @HostListener('focus', ['$event.target.value'])
  onFocus(value) {
    this.el.value = this.currencyPipe.parse(value, 2,  this.currencyFormatter); // opossite of transform
  }

  @HostListener('blur', ['$event.target.value'])
  onBlur(value) {
    this.el.value = this.currencyPipe.transform(value, 2, this.currencyFormatter);
  }


}
