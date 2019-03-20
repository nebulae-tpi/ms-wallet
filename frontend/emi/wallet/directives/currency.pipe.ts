import { Pipe, PipeTransform } from '@angular/core';

const PADDING = '000000';

@Pipe({ name: 'myCurrency' })
export class CurrencyPipe implements PipeTransform {

  private DECIMAL_SEPARATOR: string;
  private THOUSANDS_SEPARATOR: string;

  constructor() {
    // TODO comes from configuration settings
    this.DECIMAL_SEPARATOR = '.';
    this.THOUSANDS_SEPARATOR = '\'';
  }

  transform(value: number | string, fractionSize: number = 2, type: string): string {
    let [ integer, fraction = '' ] = ( parseFloat(value.toString()) || '').toString().split(this.DECIMAL_SEPARATOR);
    fraction = fractionSize > 0
      ? this.DECIMAL_SEPARATOR + (fraction + PADDING).substring(0, fractionSize)
      : '';
    integer = integer.replace(/\B(?=(\d{3})+(?!\d))/g, this.THOUSANDS_SEPARATOR);
    console.log('transform => type ', type);
    return (type === 'FIXED')
      ? '$ ' + integer + fraction
      : integer + fraction + ' %';
  }

  parse(value: string, fractionSize: number = 2, type: string ): string {
    value = value.replace('$ ', '');
    value = value.replace(' %', '');
    let [ integer, fraction = '' ] = (value || '').split(this.DECIMAL_SEPARATOR);
    integer = integer.replace(new RegExp(this.THOUSANDS_SEPARATOR, 'g'), '');
    fraction = parseInt(fraction, 10) > 0 && fractionSize > 0
      ? this.DECIMAL_SEPARATOR + (fraction + PADDING).substring(0, fractionSize)
      : '';
    return integer + fraction;
  }

}
