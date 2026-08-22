import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray } from '@angular/forms';
import { GlpiCategoriaNodoComponent } from './categoria-nodo.component';

@Component({
  selector: 'app-glpi-categoria-nodo-hijas',
  standalone: true,
  imports: [CommonModule, GlpiCategoriaNodoComponent],
  template: `
    <app-glpi-categoria-nodo
      *ngFor="let hija of hijas.controls; let j = index"
      [nodo]="$any(hija)"
      [nivel]="nivel"
      [indice]="j + 1"
      [submitted]="submitted"
      (eliminar)="quitar.emit(j)">
    </app-glpi-categoria-nodo>
  `
})
export class GlpiCategoriaNodoHijasComponent {
  @Input({ required: true }) hijas!: FormArray;
  @Input() nivel = 2;
  @Input() submitted = false;
  @Output() quitar = new EventEmitter<number>();
}
