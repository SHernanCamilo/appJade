import { Component, input, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonModule } from 'primeng/skeleton';

/**
 * Componente reutilizable de loading para tablas/grids.
 * Muestra un skeleton con columnas simuladas, un mensaje de estado y un
 * contador de tiempo transcurrido para que el usuario sepa cuánto ha esperado.
 *
 * Uso:
 *   <app-grid-loader [mensaje]="'Consultando datos...'" [columnas]="6" [filas]="8"></app-grid-loader>
 */
@Component({
  selector: 'app-grid-loader',
  standalone: true,
  imports: [CommonModule, SkeletonModule],
  template: `
    <div class="grid-loader">
      <div class="loader-header">
        <div class="loader-spinner"><i class="pi pi-spin pi-spinner"></i></div>
        <div class="loader-text">
          <span class="loader-title">{{ mensaje() }}</span>
          <span class="loader-subtitle" *ngIf="subtitulo()">{{ subtitulo() }}</span>
        </div>
        <div class="loader-timer">
          <span class="timer-value">{{ tiempoFormateado() }}</span>
          <span class="timer-label">transcurrido</span>
        </div>
      </div>

      <!-- Mensaje de alerta si supera 30s -->
      <div class="loader-warning" *ngIf="segundos() >= 30 && segundos() < 120">
        <i class="pi pi-info-circle"></i>
        Esta vista contiene muchos datos. La consulta puede demorar hasta 3 minutos.
      </div>
      <div class="loader-warning loader-warning--long" *ngIf="segundos() >= 120">
        <i class="pi pi-exclamation-triangle"></i>
        La consulta está tomando más de lo habitual. Puede continuar esperando o aplicar filtros para reducir el volumen.
      </div>

      <div class="loader-skeleton">
        <!-- Header row -->
        <div class="skeleton-header">
          <p-skeleton *ngFor="let c of colsArray" [width]="getColWidth()" height="32px" styleClass="skeleton-cell"></p-skeleton>
        </div>
        <!-- Body rows -->
        <div class="skeleton-row" *ngFor="let r of rowsArray">
          <p-skeleton *ngFor="let c of colsArray" [width]="getColWidth()" height="24px" styleClass="skeleton-cell"></p-skeleton>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .grid-loader { padding: 1.5rem; }

    .loader-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1.25rem;
      padding: 0.75rem 1rem;
      background: #f0f9ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
    }

    .loader-spinner {
      font-size: 1.25rem;
      color: #3b82f6;
    }

    .loader-text {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      flex: 1;
    }

    .loader-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: #1e40af;
    }

    .loader-subtitle {
      font-size: 0.75rem;
      color: #6b7280;
    }

    .loader-timer {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 0.35rem 0.75rem;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      min-width: 4.5rem;
    }

    .timer-value {
      font-size: 1.1rem;
      font-weight: 700;
      color: #1e40af;
      font-variant-numeric: tabular-nums;
    }

    .timer-label {
      font-size: 0.6rem;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .loader-warning {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
      padding: 0.6rem 1rem;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 6px;
      font-size: 0.8rem;
      color: #92400e;
    }

    .loader-warning--long {
      background: #fef2f2;
      border-color: #fecaca;
      color: #991b1b;
    }

    .loader-skeleton {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
    }

    .skeleton-header {
      display: flex;
      gap: 0.5rem;
      padding: 0.75rem;
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
    }

    .skeleton-row {
      display: flex;
      gap: 0.5rem;
      padding: 0.6rem 0.75rem;
      border-bottom: 1px solid #f3f4f6;
    }

    .skeleton-row:last-child { border-bottom: none; }

    :host ::ng-deep .skeleton-cell { border-radius: 4px; }
  `]
})
export class GridLoaderComponent implements OnInit, OnDestroy {
  mensaje = input<string>('Cargando datos...');
  subtitulo = input<string>('');
  columnas = input<number>(6);
  filas = input<number>(8);

  readonly segundos = signal<number>(0);

  private intervalo: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.intervalo = setInterval(() => {
      this.segundos.update((s) => s + 1);
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.intervalo) {
      clearInterval(this.intervalo);
      this.intervalo = null;
    }
  }

  tiempoFormateado(): string {
    const s = this.segundos();
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return min > 0
      ? `${min}:${sec.toString().padStart(2, '0')}`
      : `${sec}s`;
  }

  get colsArray(): number[] { return Array.from({ length: this.columnas() }, (_, i) => i); }
  get rowsArray(): number[] { return Array.from({ length: this.filas() }, (_, i) => i); }

  getColWidth(): string {
    const base = Math.floor(100 / this.columnas());
    return `${base}%`;
  }
}
