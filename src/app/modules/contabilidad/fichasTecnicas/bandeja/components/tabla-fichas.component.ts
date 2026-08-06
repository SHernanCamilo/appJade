import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';

import { Ficha, PaginationMeta } from '../../models/ficha.model';
import { EstadoBadgeComponent } from '../../shared/estado-badge.component';

/** Acción solicitada sobre una fila. */
export interface AccionFicha {
  tipo: 'ver' | 'editar' | 'pdf' | 'validar' | 'actualizar' | 'cancelar';
  ficha: Ficha;
}

/**
 * Componente presentacional del listado de fichas.
 *
 * Usa `p-table` en modo lazy: la paginación, el orden y la búsqueda se
 * resuelven en el servidor. El legacy cargaba todas las filas en el HTML y
 * dejaba que DataTables paginara en el navegador.
 */
@Component({
  selector: 'app-tabla-fichas',
  standalone: true,
  imports: [CommonModule, TableModule, ButtonModule, TooltipModule, SkeletonModule, EstadoBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-table
      [value]="fichas()"
      [lazy]="true"
      [loading]="cargando()"
      [paginator]="true"
      [rows]="meta()?.per_page ?? 20"
      [totalRecords]="meta()?.total ?? fichas().length"
      [rowsPerPageOptions]="[10, 20, 50, 100]"
      [first]="primerRegistro()"
      (onLazyLoad)="cargarPagina.emit($event)"
      dataKey="id"
      styleClass="p-datatable-sm p-datatable-striped ft-tabla"
      currentPageReportTemplate="{first}–{last} de {totalRecords}"
      [showCurrentPageReport]="true"
    >
      <ng-template pTemplate="header">
        <tr>
          <th style="width: 11rem">Consecutivo</th>
          <th style="width: 13rem">Estado</th>
          <th>Agremiación</th>
          <th>Especialidad</th>
          <th style="width: 12rem">Vigencia</th>
          <th style="width: 9rem" class="ft-tabla__num">Valor</th>
          <th style="width: 5rem" class="ft-tabla__num">Ítems</th>
          <th style="width: 11rem">Acciones</th>
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-f>
        <tr>
          <td>
            <strong>{{ f.consecutivo ?? 'Borrador ' + f.id }}</strong>
            @if (f.id_padre) {
              <small class="ft-tabla__sub">Actualización v{{ f.version }}</small>
            }
          </td>
          <td>
            <app-estado-badge
              [estado]="f.estado"
              [vigencia]="f.vigencia_estado"
              [diasRestantes]="f.dias_restantes"
            />
          </td>
          <td class="ft-tabla__truncar" [pTooltip]="f.agremiacion?.nombre ?? ''">
            {{ f.agremiacion?.nombre ?? '—' }}
          </td>
          <td class="ft-tabla__truncar">
            {{ f.especialidad?.descripcion ?? '—' }}
            @if (f.especialidad?.perfil) {
              <small class="ft-tabla__sub">{{ f.especialidad?.perfil }}</small>
            }
          </td>
          <td>{{ f.fecha_ini | date: 'dd/MM/yy' }} — {{ f.fecha_fin | date: 'dd/MM/yy' }}</td>
          <td class="ft-tabla__num">{{ f.vlr_contrato | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</td>
          <td class="ft-tabla__num">{{ f.total_detalles }}</td>
          <td>
            <div class="ft-tabla__acciones">
              <p-button
                icon="pi pi-eye"
                [rounded]="true"
                [text]="true"
                severity="secondary"
                pTooltip="Ver detalle"
                (onClick)="accion.emit({ tipo: 'ver', ficha: f })"
              />

              @if (f.estado?.es_editable) {
                <p-button
                  icon="pi pi-pencil"
                  [rounded]="true"
                  [text]="true"
                  pTooltip="Editar"
                  (onClick)="accion.emit({ tipo: 'editar', ficha: f })"
                />
              }

              @if (puedeValidar()) {
                <p-button
                  icon="pi pi-check-square"
                  [rounded]="true"
                  [text]="true"
                  severity="success"
                  pTooltip="Validar"
                  (onClick)="accion.emit({ tipo: 'validar', ficha: f })"
                />
              }

              @if (f.estado?.es_final && f.consecutivo) {
                <p-button
                  icon="pi pi-file-plus"
                  [rounded]="true"
                  [text]="true"
                  severity="help"
                  pTooltip="Crear actualización"
                  (onClick)="accion.emit({ tipo: 'actualizar', ficha: f })"
                />
              }

              <p-button
                icon="pi pi-file-pdf"
                [rounded]="true"
                [text]="true"
                severity="danger"
                pTooltip="Ver PDF"
                (onClick)="accion.emit({ tipo: 'pdf', ficha: f })"
              />
            </div>
          </td>
        </tr>
      </ng-template>

      <ng-template pTemplate="loadingbody">
        @for (fila of esqueletos; track fila) {
          <tr>
            @for (col of columnas; track col) {
              <td><p-skeleton height="1.1rem" /></td>
            }
          </tr>
        }
      </ng-template>

      <ng-template pTemplate="emptymessage">
        <tr>
          <td colspan="8" class="ft-tabla__vacio">
            <i class="pi pi-inbox"></i>
            <p>{{ mensajeVacio() }}</p>
          </td>
        </tr>
      </ng-template>
    </p-table>
  `,
  styles: [
    `
      .ft-tabla__num {
        text-align: right;
      }

      .ft-tabla__truncar {
        max-width: 15rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .ft-tabla__sub {
        display: block;
        color: #6c757d;
        font-size: 0.72rem;
      }

      .ft-tabla__acciones {
        display: flex;
        gap: 0.1rem;
      }

      .ft-tabla__vacio {
        text-align: center;
        padding: 3rem 1rem;
        color: #6c757d;
      }

      .ft-tabla__vacio i {
        font-size: 2rem;
        display: block;
        margin-bottom: 0.5rem;
        opacity: 0.5;
      }

      .ft-tabla__vacio p {
        margin: 0;
      }
    `,
  ],
})
export class TablaFichasComponent {
  readonly fichas = input<Ficha[]>([]);
  readonly meta = input<PaginationMeta | null>(null);
  readonly cargando = input<boolean>(false);
  readonly puedeValidar = input<boolean>(false);
  readonly mensajeVacio = input<string>('No hay fichas en esta bandeja.');

  readonly accion = output<AccionFicha>();
  readonly cargarPagina = output<TableLazyLoadEvent>();

  protected readonly esqueletos = [1, 2, 3, 4, 5];
  protected readonly columnas = [1, 2, 3, 4, 5, 6, 7, 8];

  protected primerRegistro(): number {
    const m = this.meta();

    if (!m) {
      return 0;
    }

    return (m.current_page - 1) * m.per_page;
  }
}
