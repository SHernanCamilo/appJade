import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';

import { ConflictoProfesional } from '../models/ficha.model';

/**
 * Componente presentacional del conflicto de profesionales (regla R1).
 *
 * El legacy mostraba este error como un bloque de texto con saltos de línea
 * dentro de un SweetAlert, sin indicar qué ficha causaba el choque de forma
 * navegable. Aquí se presenta como tabla con enlace a cada ficha en conflicto.
 */
@Component({
  selector: 'app-conflictos-dialog',
  standalone: true,
  imports: [CommonModule, DialogModule, TableModule, ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [(visible)]="visible"
      [modal]="true"
      [draggable]="false"
      [style]="{ width: '46rem' }"
      header="Conflicto de vigencias"
      styleClass="ft-conflictos"
    >
      <p class="ft-conflictos__intro">
        No es posible guardar la ficha: los siguientes profesionales ya están vinculados a
        fichas vigentes cuyas fechas se cruzan con el periodo seleccionado.
      </p>

      <p-table [value]="conflictos()" [scrollable]="true" scrollHeight="18rem" styleClass="p-datatable-sm">
        <ng-template pTemplate="header">
          <tr>
            <th>Profesional</th>
            <th style="width: 8rem">Documento</th>
            <th style="width: 10rem">Ficha</th>
            <th style="width: 12rem">Vigencia en conflicto</th>
          </tr>
        </ng-template>

        <ng-template pTemplate="body" let-c>
          <tr>
            <td>{{ c.nombre_profesional }}</td>
            <td>{{ c.documento }}</td>
            <td>
              <span class="ft-conflictos__consecutivo">{{ c.consecutivo }}</span>
              @if (c.sucursal) {
                <small class="ft-conflictos__sucursal">{{ c.sucursal }}</small>
              }
            </td>
            <td>{{ c.fecha_ini | date: 'dd/MM/yyyy' }} — {{ c.fecha_fin | date: 'dd/MM/yyyy' }}</td>
          </tr>
        </ng-template>
      </p-table>

      <p class="ft-conflictos__ayuda">
        Ajuste el periodo de vigencia, retire al profesional en conflicto o cree una
        actualización sobre la ficha existente.
      </p>

      <ng-template pTemplate="footer">
        <p-button label="Entendido" icon="pi pi-check" (onClick)="visible.set(false)" />
      </ng-template>
    </p-dialog>
  `,
  styles: [
    `
      .ft-conflictos__intro {
        margin: 0 0 1rem;
        font-size: 0.9rem;
        color: #495057;
      }

      .ft-conflictos__consecutivo {
        font-weight: 600;
        display: block;
      }

      .ft-conflictos__sucursal {
        color: #6c757d;
        font-size: 0.75rem;
      }

      .ft-conflictos__ayuda {
        margin: 1rem 0 0;
        padding: 0.75rem;
        background: #fff3cd;
        border: 1px solid #ffe69c;
        border-radius: 0.5rem;
        font-size: 0.85rem;
        color: #664d03;
      }
    `,
  ],
})
export class ConflictosDialogComponent {
  /** Modelo bidireccional: el padre solo alterna la visibilidad. */
  readonly visible = model<boolean>(false);
  readonly conflictos = input<ConflictoProfesional[]>([]);
}
