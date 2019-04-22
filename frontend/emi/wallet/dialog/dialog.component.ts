
import { Component, OnInit, Inject} from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';

export interface DialogData {
  dialogTitle: string;
  dialogMessage: string;
}

@Component({
// tslint:disable-next-line: component-selector
  selector: 'app-dialog.component',
  templateUrl: './dialog.component.html',
  styleUrls: ['./dialog.component.scss']
})
export class DialogComponent implements OnInit {

  constructor(private dialogRef: MatDialogRef<DialogComponent>, @Inject(MAT_DIALOG_DATA) public data: DialogData) {

  }

  ngOnInit() {

  }

  pushButton(okButton: Boolean) {
    this.dialogRef.close(okButton);
  }

}
