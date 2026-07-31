import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonModule } from 'primeng/skeleton';

/**
 * Componente reutilizable de loading para tablas/grids.
 * Muestra un skeleton con columnas simuladas y un mensaje de estado.
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
export class GridLoaderComponent {
  mensaje = input<string>('Cargando datos...');
  subtitulo = input<string>('');
  columnas = input<number>(6);
  filas = input<number>(8);

  get colsArray(): number[] { return Array.from({ length: this.columnas() }, (_, i) => i); }
  get rowsArray(): number[] { return Array.from({ length: this.filas() }, (_, i) => i); }

  getColWidth(): string {
    const base = Math.floor(100 / this.columnas());
    return `${base}%`;
  }
}
