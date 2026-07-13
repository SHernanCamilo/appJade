import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { TagModule } from 'primeng/tag';
import { BiVistaEstado } from '../services/bi-grupo.service';

export interface EstadoTagCellParams extends ICellRendererParams {
  getEstadoLabel: (estado: BiVistaEstado) => string;
  getEstadoSeverity: (estado: BiVistaEstado) => 'success' | 'warn' | 'danger' | 'secondary';
}

@Component({
  selector: 'app-estado-tag-cell',
  standalone: true,
  imports: [CommonModule, TagModule],
  template: `<p-tag [value]="label" [severity]="severity"></p-tag>`
})
export class EstadoTagCellComponent implements ICellRendererAngularComp {
  label = '';
  severity: 'success' | 'warn' | 'danger' | 'secondary' = 'secondary';

  agInit(params: EstadoTagCellParams): void {
    this.refreshParams(params);
  }

  refresh(params: EstadoTagCellParams): boolean {
    this.refreshParams(params);
    return true;
  }

  private refreshParams(params: EstadoTagCellParams): void {
    const estado = (params.data?.estado ?? 'activo') as BiVistaEstado;
    this.label = params.getEstadoLabel(estado);
    this.severity = params.getEstadoSeverity(estado);
  }
}
