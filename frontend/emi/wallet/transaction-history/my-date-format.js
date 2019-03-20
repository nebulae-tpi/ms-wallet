
export const MAT_MOMENT_DATE_FORMATS = {
  parse: {
    date: ['YYYY-MM-DD', 'YYYY/MM/DD', 'll'],
    datetime: ['YYYY-MM-DD HH:mm', 'YYYY/MM/DD HH:mm', 'll h:mma'],
    time: ['H:mm', 'HH:mm', 'h:mm a', 'hh:mm a']
  },
  display: {
    date: 'll',
    datetime: 'll HH:mm',
    time: 'h:mm a',
    dateA11yLabel: 'LL',
    monthDayLabel: 'MMM D',
    monthDayA11yLabel: 'MMMM D',
    monthYearLabel: 'MMMM YYYY',
    monthYearA11yLabel: 'MMMM YYYY',
    timeLabel: 'HH:mm'
  }
};
