import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { SkeletonModule } from 'primeng/skeleton';

import { BandejaFichas, IndicadoresFichas } from '../../models/ficha.model';

interface Kpi {
  clave: string;
  titulo: string;
  valor: number;
  icono: string;
  color: string;
  bandeja: BandejaFichas | null;
  destacado: boolean;
}

/**
 * Componente presentacional de KPIs. Recibe los indicadores ya calculados y
 * emite la bandeja a abrir al hacer clic.
 */
@Component({
  selector: 'app-kpi-cards',
  standalone: true,
  imports: [CommonModule, SkeletonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ft-kpis">
      @if (cargando()) {
        @for (i of esqueletos; track i) {
          <p-skeleton height="6.5rem" borderRadius="0.75rem" />
        }
      } @else {
        @for (kpi of kpis(); track kpi.clave) {
          <button
            type="button"
            class="ft-kpi"
            [class.ft-kpi--clickable]="kpi.bandeja !== null"
            [class.ft-kpi--alerta]="kpi.destacado && kpi.valor > 0"
            [disabled]="kpi.bandeja === null"
            (click)="kpi.bandeja && bandejaSeleccionada.emit(kpi.bandeja)"
            [attr.aria-label]="kpi.titulo + ': ' + kpi.valor"
          >
            <span class="ft-kpi__icono" [style.background]="kpi.color">
              <i [class]="kpi.icono"></i>
            </span>
            <span class="ft-kpi__cuerpo">
              <span class="ft-kpi__valor">{{ kpi.valor | number }}</span>
              <span class="ft-kpi__titulo">{{ kpi.titulo }}</span>
            </span>
          </button>
        }
      }
    </div>

    @if (!cargando()) {
      <div class="ft-valor-total">
        <span class="ft-valor-total__label">Valor contratado vigente</span>
        <span class="ft-valor-total__monto">
          {{ indicadores()?.valor_contratado ?? 0 | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}
        </span>
      </div>
    }
  `,
  styles: [
    `
      .ft-kpis {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
        gap: 0.85rem;
      }

      .ft-kpi {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 1rem;
        background: #fff;
        border: 1px solid #e9ecef;
        border-radius: 0.75rem;
        text-align: left;
        font: inherit;
        cursor: default;
        transition: box-shadow 0.15s, transform 0.15s, border-color 0.15s;
      }

      .ft-kpi--clickable {
        cursor: pointer;
      }

      .ft-kpi--clickable:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgb(0 0 0 / 8%);
        border-color: #ced4da;
      }

      .ft-kpi--alerta {
        border-color: #f1aeb5;
        background: #fff5f5;
      }

      .ft-kpi__icono {
        display: grid;
        place-items: center;
        width: 2.6rem;
        height: 2.6rem;
        border-radius: 0.6rem;
        color: #fff;
        font-size: 1.1rem;
        flex: 0 0 auto;
      }

      .ft-kpi__cuerpo {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }

      .ft-kpi__valor {
        font-size: 1.5rem;
        font-weight: 700;
        line-height: 1.1;
        color: #212529;
      }

      .ft-kpi__titulo {
        font-size: 0.78rem;
        color: #6c757d;
        line-height: 1.25;
      }

      .ft-valor-total {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 1rem;
        margin-top: 0.85rem;
        padding: 0.9rem 1.15rem;
        background: linear-gradient(90deg, #0d6efd 0%, #4c8dff 100%);
        border-radius: 0.75rem;
        color: #fff;
      }

      .ft-valor-total__label {
        font-size: 0.85rem;
        opacity: 0.9;
      }

      .ft-valor-total__monto {
        font-size: 1.35rem;
        font-weight: 700;
      }
    `,
  ],
})
export class KpiCardsComponent {
  readonly indicadores = input<IndicadoresFichas | null>(null);
  readonly cargando = input<boolean>(false);

  readonly bandejaSeleccionada = output<BandejaFichas>();

  protected readonly esqueletos = [1, 2, 3, 4, 5, 6];

  protected readonly kpis = computed<Kpi[]>(() => {
    const i = this.indicadores();

    if (!i) {
      return [];
    }

    return [
      { clave: 'borradores', titulo: 'Borradores pendientes', valor: i.borradores, icono: 'pi pi-file-edit', color: '#6c757d', bandeja: 'borradores', destacado: false },
      { clave: 'rechazadas', titulo: 'Rechazadas por corregir', valor: i.rechazadas, icono: 'pi pi-times-circle', color: '#dc3545', bandeja: 'rechazados', destacado: true },
      { clave: 'proceso', titulo: 'En validación', valor: i.en_proceso, icono: 'pi pi-hourglass', color: '#0dcaf0', bandeja: 'procesando', destacado: false },
      { clave: 'aprobar', titulo: 'Por aprobar', valor: i.por_aprobar, icono: 'pi pi-check-square', color: '#0d6efd', bandeja: 'por-aprobar', destacado: false },
      { clave: 'vigentes', titulo: 'Fichas vigentes', valor: i.vigentes, icono: 'pi pi-verified', color: '#198754', bandeja: 'finalizadas', destacado: false },
      { clave: 'porVencer', titulo: 'Vencen en 30 días', valor: i.proximas_vencer, icono: 'pi pi-exclamation-triangle', color: '#fd7e14', bandeja: 'proximas-vencer', destacado: true },
      { clave: 'vencidas', titulo: 'Vencidas', valor: i.vencidas, icono: 'pi pi-ban', color: '#6f42c1', bandeja: 'vencidas', destacado: false },
      { clave: 'total', titulo: 'Total histórico', valor: i.total, icono: 'pi pi-database', color: '#495057', bandeja: null, destacado: false },
    ];
  });
}
