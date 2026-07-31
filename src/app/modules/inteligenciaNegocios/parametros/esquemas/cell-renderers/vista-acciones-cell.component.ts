import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { TooltipModule } from 'primeng/tooltip';
import { BiVista } from '../services/bi-grupo.service';

export interface VistaAccionesCellParams extends ICellRendererParams<BiVista> {
  puedeGestionar: boolean;
  savingVistaId: number | null;
  onDelete: (vista: BiVista) => void;
}

@Component({
  selector: 'app-vista-acciones-cell',
  standalone: true,
  imports: [CommonModule, TooltipModule],
  template: `
    <button
      type="button"
      class="btn-icon-danger"
      (click)="onClickDelete($event)"
      [disabled]="!puedeGestionar || savingVistaId === vista.id"
      pTooltip="Eliminar vista"
      tooltipPosition="top">
      <i class="pi pi-trash"></i>
    </button>
  `,
  styles: [`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
    }

    .btn-icon-danger {
      width: 2rem;
      height: 2rem;
      padding: 0;
      border-radius: 8px;
      border: 1px solid #fecaca;
      background: #fff;
      color: #dc2626;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
    }

    .btn-icon-danger .pi {
      font-size: 0.95rem;
    }

    .btn-icon-danger:hover:not(:disabled) {
      background: #fef2f2;
      border-color: #f87171;
      color: #b91c1c;
    }

    .btn-icon-danger:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
  `]
})
export class VistaAccionesCellComponent implements ICellRendererAngularComp {
  vista!: BiVista;
  puedeGestionar = false;
  savingVistaId: number | null = null;
  onDelete!: (vista: BiVista) => void;

  onClickDelete(event: MouseEvent): void {
    event.stopPropagation();
    this.onDelete(this.vista);
  }

  agInit(params: VistaAccionesCellParams): void {
    this.refreshParams(params);
  }

  refresh(params: VistaAccionesCellParams): boolean {
    this.refreshParams(params);
    return true;
  }

  private refreshParams(params: VistaAccionesCellParams): void {
    this.vista = params.data!;
    this.puedeGestionar = params.puedeGestionar;
    this.savingVistaId = params.savingVistaId;
    this.onDelete = params.onDelete;
  }
}
