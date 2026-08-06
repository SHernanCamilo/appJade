import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SkeletonModule } from 'primeng/skeleton';

import { AgrupacionValor } from '../../models/ficha.model';

interface ChartData {
  labels: string[];
  datasets: { label: string; data: number[]; backgroundColor: string[]; borderRadius: number }[];
}

/**
 * Componente presentacional del gráfico de distribución del valor contratado.
 *
 * Recibe los datos ya agregados por SQL (`v_fich_fichas_listado` + GROUP BY),
 * no calcula nada en el navegador.
 */
@Component({
  selector: 'app-grafico-distribucion',
  standalone: true,
  imports: [CommonModule, CardModule, ChartModule, SelectButtonModule, SkeletonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card>
      <ng-template pTemplate="header">
        <div class="ft-grafico__cabecera">
          <h3><i class="pi pi-chart-bar"></i> {{ titulo() }}</h3>
          <small>Valor contratado de fichas vigentes</small>
        </div>
      </ng-template>

      @if (cargando()) {
        <p-skeleton height="16rem" borderRadius="0.5rem" />
      } @else if (datos().length === 0) {
        <p class="ft-grafico__vacio">Sin datos para graficar.</p>
      } @else {
        <p-chart type="bar" [data]="chartData()" [options]="opciones" height="18rem" />
      }
    </p-card>
  `,
  styles: [
    `
      .ft-grafico__cabecera {
        padding: 1rem 1.15rem 0.35rem;
      }

      .ft-grafico__cabecera h3 {
        margin: 0;
        font-size: 1rem;
        display: flex;
        align-items: center;
        gap: 0.45rem;
        color: #212529;
      }

      .ft-grafico__cabecera i {
        color: #0d6efd;
      }

      .ft-grafico__cabecera small {
        color: #6c757d;
        font-size: 0.78rem;
      }

      .ft-grafico__vacio {
        text-align: center;
        color: #6c757d;
        padding: 3rem 1rem;
        margin: 0;
      }
    `,
  ],
})
export class GraficoDistribucionComponent {
  readonly datos = input<AgrupacionValor[]>([]);
  readonly titulo = input<string>('Distribución');
  readonly cargando = input<boolean>(false);

  private readonly paleta = [
    '#0d6efd', '#198754', '#fd7e14', '#6f42c1', '#20c997',
    '#dc3545', '#0dcaf0', '#ffc107', '#6610f2', '#495057',
  ];

  protected readonly chartData = computed<ChartData>(() => {
    const datos = this.datos();

    return {
      labels: datos.map((d) => this.etiqueta(d)),
      datasets: [
        {
          label: 'Valor contratado',
          data: datos.map((d) => Number(d.valor)),
          backgroundColor: datos.map((_, i) => this.paleta[i % this.paleta.length]),
          borderRadius: 6,
        },
      ],
    };
  });

  protected readonly opciones = {
    indexAxis: 'y' as const,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { parsed: { x: number } }) =>
            new Intl.NumberFormat('es-CO', {
              style: 'currency',
              currency: 'COP',
              maximumFractionDigits: 0,
            }).format(ctx.parsed.x),
        },
      },
    },
    scales: {
      x: {
        ticks: {
          callback: (valor: string | number) =>
            new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(valor)),
        },
        grid: { color: '#f1f3f5' },
      },
      y: { grid: { display: false } },
    },
  };

  private etiqueta(dato: AgrupacionValor): string {
    const texto = dato.especialidad_descripcion ?? dato.agremiacion_nombre ?? 'Sin clasificar';

    return texto.length > 32 ? `${texto.slice(0, 32)}…` : texto;
  }
}
