import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

import { FichaProximaVencer } from '../../models/ficha.model';

/**
 * Componente presentacional de alertas de vencimiento.
 *
 * El color de cada fila lo resuelve la vista SQL `v_fich_proximos_vencer`
 * (`color_alerta`), replicando la semántica del legacy: rojo ≤10 días,
 * naranja ≤15, amarillo ≤30.
 */
@Component({
  selector: 'app-alertas-vencimiento',
  standalone: true,
  imports: [CommonModule, CardModule, TableModule, TagModule, ButtonModule, SkeletonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card styleClass="ft-alertas">
      <ng-template pTemplate="header">
        <div class="ft-alertas__cabecera">
          <h3>
            <i class="pi pi-exclamation-triangle"></i>
            Próximas a vencer
          </h3>
          <small>Vigencias que expiran en los siguientes 30 días</small>
        </div>
      </ng-template>

      @if (cargando()) {
        <p-skeleton height="12rem" borderRadius="0.5rem" />
      } @else {
        <p-table
          [value]="fichas()"
          [scrollable]="true"
          scrollHeight="20rem"
          styleClass="p-datatable-sm p-datatable-striped"
        >
          <ng-template pTemplate="header">
            <tr>
              <th style="width: 7rem">Días</th>
              <th>Ficha</th>
              <th>Agremiación</th>
              <th style="width: 8rem">Vence</th>
              <th style="width: 4rem"></th>
            </tr>
          </ng-template>

          <ng-template pTemplate="body" let-f>
            <tr>
              <td>
                <span class="ft-alertas__dias" [style.background]="f.color_alerta">
                  {{ f.dias_restantes }} d
                </span>
              </td>
              <td>
                <strong>{{ f.consecutivo ?? 'Borrador ' + f.id }}</strong>
                <small class="ft-alertas__sub">{{ f.especialidad_descripcion }}</small>
              </td>
              <td class="ft-alertas__truncar">{{ f.agremiacion_nombre }}</td>
              <td>{{ f.fecha_fin | date: 'dd/MM/yyyy' }}</td>
              <td>
                <p-button
                  icon="pi pi-arrow-up-right"
                  [rounded]="true"
                  [text]="true"
                  severity="secondary"
                  pTooltip="Abrir ficha"
                  (onClick)="fichaSeleccionada.emit(f.id)"
                />
              </td>
            </tr>
          </ng-template>

          <ng-template pTemplate="emptymessage">
            <tr>
              <td colspan="5" class="ft-alertas__vacio">
                <i class="pi pi-check-circle"></i>
                Ninguna ficha vence en los próximos 30 días.
              </td>
            </tr>
          </ng-template>
        </p-table>
      }
    </p-card>
  `,
  styles: [
    `
      .ft-alertas__cabecera {
        padding: 1rem 1.15rem 0.35rem;
      }

      .ft-alertas__cabecera h3 {
        margin: 0;
        font-size: 1rem;
        display: flex;
        align-items: center;
        gap: 0.45rem;
        color: #212529;
      }

      .ft-alertas__cabecera i {
        color: #fd7e14;
      }

      .ft-alertas__cabecera small {
        color: #6c757d;
        font-size: 0.78rem;
      }

      .ft-alertas__dias {
        display: inline-block;
        min-width: 3.2rem;
        padding: 0.15rem 0.5rem;
        border-radius: 999px;
        color: #212529;
        font-weight: 700;
        font-size: 0.75rem;
        text-align: center;
      }

      .ft-alertas__sub {
        display: block;
        color: #6c757d;
        font-size: 0.72rem;
      }

      .ft-alertas__truncar {
        max-width: 16rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .ft-alertas__vacio {
        text-align: center;
        padding: 2rem 1rem;
        color: #6c757d;
      }

      .ft-alertas__vacio i {
        color: #198754;
        margin-right: 0.35rem;
      }
    `,
  ],
})
export class AlertasVencimientoComponent {
  readonly fichas = input<FichaProximaVencer[]>([]);
  readonly cargando = input<boolean>(false);

  readonly fichaSeleccionada = output<number>();
}
