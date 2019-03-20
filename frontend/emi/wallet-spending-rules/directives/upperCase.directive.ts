import { Directive, ElementRef, HostListener } from '@angular/core';

@Directive({
  // tslint:disable-next-line:directive-selector
  selector: '[emiUpperCase]'
})
export class UpperCaseDirective {

  constructor(public ref: ElementRef) { }

  @HostListener('input', ['$event']) onInput(event) {
    this.ref.nativeElement.value = event.target.value.toUpperCase();
  }

}
