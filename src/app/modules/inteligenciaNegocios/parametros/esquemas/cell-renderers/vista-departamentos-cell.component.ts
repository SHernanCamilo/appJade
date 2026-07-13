import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { MultiSelectModule } from 'primeng/multiselect';
import { BiVista } from '../services/bi-grupo.service';

export interface VistaDepartamentosCellParams extends ICellRendererParams<BiVista> {
  departamentosOptions: { label: string; value: string }[];
  puedeGestionar: boolean;
  savingVistaId: number | null;
  onChange: (vista: BiVista, departamentos: string[] | null) => void;
}

@Component({
  selector: 'app-vista-departamentos-cell',
  standalone: true,
  imports: [CommonModule, FormsModule, MultiSelectModule],
  template: `
    <p-multiSelect
      [ngModel]="vista.departamentos || []"
      (ngModelChange)="onChange(vista, $event)"
      [options]="departamentosOptions"
      optionLabel="label"
      optionValue="value"
      placeholder="Todos"
      [showClear]="true"
      [filter]="true"
      [disabled]="!puedeGestionar || savingVistaId === vista.id"
      [loading]="savingVistaId === vista.id"
      [maxSelectedLabels]="2"
      selectedItemsLabel="{0} sedes"
      appendTo="body"
      styleClass="w-full dept-multiselect-grid">
    </p-multiSelect>
  `
})
export class VistaDepartamentosCellComponent implements ICellRendererAngularComp {
  vista!: BiVista;
  departamentosOptions: { label: string; value: string }[] = [];
  puedeGestionar = false;
  savingVistaId: number | null = null;
  onChange!: (vista: BiVista, departamentos: string[] | null) => void;

  agInit(params: VistaDepartamentosCellParams): void {
    this.refreshParams(params);
  }

  refresh(params: VistaDepartamentosCellParams): boolean {
    this.refreshParams(params);
    return true;
  }

  private refreshParams(params: VistaDepartamentosCellParams): void {
    this.vista = params.data!;
    this.departamentosOptions = params.departamentosOptions ?? [];
    this.puedeGestionar = params.puedeGestionar;
    this.savingVistaId = params.savingVistaId;
    this.onChange = params.onChange;
  }
}
