import { CommonModule, CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';

import { ResumenBandeja } from '../../models/ficha.model';
import { FichasTecnicasService } from '../../services/fichas-tecnicas.service';

interface KpiCard {
  icono: string;
  etiqueta: string;
  valor: number | string;
  clase: string;         // clase CSS de color
  ruta?: string;         // enlace a la bandeja correspondiente
  tooltip?: string;
}

/**
 * Tarjetas KPI de resumen para el tope de la bandeja.
 *
 * Consume GET /fichas-tecnicas/dashboard/resumen-bandeja (filtraje por
 * alcance del usuario en el backend: generador solo ve sus fichas,
 * autorizador su(s) sucursal(es), aprobador todo).
 */
@Component({
  selector: 'app-kpis-bandeja',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, SkeletonModule, TooltipModule, CurrencyPipe],
  template: `
    <div class="ft-kpis" aria-label="Resumen de fichas técnicas">

      @if (cargando()) {
        @for (i of [1,2,3,4]; track i) {
          <div class="ft-kpis__card ft-kpis__card--skeleton">
            <p-skeleton width="2rem" height="2rem" styleClass="mb-2" />
            <p-skeleton width="4rem" height="1.5rem" styleClass="mb-1" />
            <p-skeleton width="6rem" height="0.875rem" />
          </div>
        }
      } @else if (error()) {
        <span class="ft-kpis__error">No se pudo cargar el resumen</span>
      } @else {
        @for (card of tarjetas(); track card.etiqueta) {
          <a
            class="ft-kpis__card {{ card.clase }}"
            [routerLink]="card.ruta ?? null"
            [pTooltip]="card.tooltip ?? ''"
            tooltipPosition="bottom"
            [attr.aria-label]="card.etiqueta + ': ' + card.valor"
            tabindex="0"
          >
            <span class="ft-kpis__icon pi {{ card.icono }}" aria-hidden="true"></span>
            <span class="ft-kpis__valor">{{ card.valor }}</span>
            <span class="ft-kpis__etiqueta">{{ card.etiqueta }}</span>
          </a>
        }
      }

    </div>
  `,
  styles: [`
    .ft-kpis {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .ft-kpis__card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.25rem;
      min-width: 120px;
      flex: 1 1 120px;
      padding: 0.875rem 1rem;
      border-radius: 10px;
      border: 1px solid transparent;
      cursor: pointer;
      text-decoration: none;
      transition: transform 0.15s, box-shadow 0.15s;
      background: var(--surface-card, #fff);
    }

    .ft-kpis__card:hover,
    .ft-kpis__card:focus-visible {
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(0,0,0,0.10);
      outline: 2px solid currentColor;
      outline-offset: 2px;
    }

    .ft-kpis__card--skeleton {
      cursor: default;
      background: var(--surface-ground, #f4f4f4);
    }

    .ft-kpis__icon {
      font-size: 1.5rem;
    }

    .ft-kpis__valor {
      font-size: 1.5rem;
      font-weight: 700;
      line-height: 1;
    }

    .ft-kpis__etiqueta {
      font-size: 0.75rem;
      text-align: center;
      opacity: 0.85;
    }

    .ft-kpis__error {
      color: var(--red-500, #ef4444);
      font-size: 0.875rem;
      padding: 0.5rem;
    }

    /* ── Variantes de color ── */
    .ft-kpis__card--total     { border-color: var(--blue-200, #bfdbfe);   color: var(--blue-700, #1d4ed8);   background: var(--blue-50, #eff6ff);   }
    .ft-kpis__card--proceso   { border-color: var(--yellow-200, #fde68a); color: var(--yellow-700, #a16207); background: var(--yellow-50, #fefce8); }
    .ft-kpis__card--aprobadas { border-color: var(--green-200, #bbf7d0);  color: var(--green-700, #15803d);  background: var(--green-50, #f0fdf4);  }
    .ft-kpis__card--rechazadas{ border-color: var(--red-200, #fecaca);    color: var(--red-700, #b91c1c);    background: var(--red-50, #fef2f2);    }
    .ft-kpis__card--vencer    { border-color: var(--orange-200, #fed7aa); color: var(--orange-700, #c2410c); background: var(--orange-50, #fff7ed); }
  `],
})
export class KpisBandejaComponent implements OnInit {
  private readonly fichasService = inject(FichasTecnicasService);

  protected readonly cargando = signal(true);
  protected readonly error    = signal(false);
  protected readonly tarjetas = signal<KpiCard[]>([]);

  private readonly BASE = '/contabilidad/fichas-tecnicas';

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(false);

    this.fichasService.resumenBandeja().subscribe({
      next: (res) => {
        this.tarjetas.set(this.construirTarjetas(res));
        this.cargando.set(false);
      },
      error: () => {
        this.error.set(true);
        this.cargando.set(false);
      },
    });
  }

  private construirTarjetas(r: ResumenBandeja): KpiCard[] {
    return [
      {
        icono:    'pi-file',
        etiqueta: 'Total fichas',
        valor:    r.total,
        clase:    'ft-kpis__card--total',
        tooltip:  'Total de fichas en tu alcance',
      },
      {
        icono:    'pi-clock',
        etiqueta: 'En proceso',
        valor:    r.en_proceso,
        clase:    'ft-kpis__card--proceso',
        ruta:     `${this.BASE}/bandeja/procesando`,
        tooltip:  'Pendientes de autorización o aprobación',
      },
      {
        icono:    'pi-check-circle',
        etiqueta: 'Aprobadas/Vigentes',
        valor:    r.aprobadas,
        clase:    'ft-kpis__card--aprobadas',
        ruta:     `${this.BASE}/bandeja/finalizadas`,
        tooltip:  'Fichas aprobadas y en vigencia',
      },
      {
        icono:    'pi-times-circle',
        etiqueta: 'Rechazadas',
        valor:    r.rechazadas,
        clase:    'ft-kpis__card--rechazadas',
        ruta:     `${this.BASE}/bandeja/rechazados`,
        tooltip:  'Devueltas para corrección',
      },
      {
        icono:    'pi-exclamation-triangle',
        etiqueta: 'Próx. a vencer',
        valor:    r.proximas_vencer,
        clase:    'ft-kpis__card--vencer',
        ruta:     `${this.BASE}/bandeja/proximas-vencer`,
        tooltip:  'Vencen en los próximos 30 días',
      },
    ];
  }
}
