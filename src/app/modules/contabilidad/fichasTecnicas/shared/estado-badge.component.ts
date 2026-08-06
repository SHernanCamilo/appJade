import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { FichEstado, VigenciaEstado } from '../models/ficha.model';

/**
 * Componente presentacional: muestra el estado del workflow y, opcionalmente,
 * la vigencia con su color de alerta.
 *
 * El color del estado viene de `fich_estados.color_hex`, así que se puede
 * cambiar desde la base de datos sin tocar el frontend.
 */
@Component({
  selector: 'app-estado-badge',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="ft-badge"
      [style.background]="colorEstado()"
      [attr.title]="estado()?.descripcion ?? ''"
    >
      {{ estado()?.descripcion ?? 'SIN ESTADO' }}
    </span>

    @if (vigencia(); as v) {
      @if (v !== 'VIGENTE') {
        <span class="ft-badge ft-badge--vigencia" [style.background]="colorVigencia()">
          {{ etiquetaVigencia() }}
        </span>
      }
    }
  `,
  styles: [
    `
      .ft-badge {
        display: inline-block;
        padding: 0.15rem 0.6rem;
        border-radius: 999px;
        color: #fff;
        font-size: 0.72rem;
        font-weight: 600;
        letter-spacing: 0.02em;
        white-space: nowrap;
      }

      .ft-badge--vigencia {
        margin-left: 0.35rem;
      }
    `,
  ],
})
export class EstadoBadgeComponent {
  readonly estado = input<FichEstado | undefined>();
  readonly vigencia = input<VigenciaEstado | null>(null);
  readonly diasRestantes = input<number | null>(null);

  protected readonly colorEstado = computed(() => this.estado()?.color_hex ?? '#6c757d');

  protected readonly colorVigencia = computed<string>(() => {
    switch (this.vigencia()) {
      case 'VENCIDA':
        return '#6f42c1';
      case 'CRITICA':
        return '#dc3545';
      case 'ALERTA':
        return '#fd7e14';
      case 'PROXIMA':
        return '#ffc107';
      default:
        return '#198754';
    }
  });

  protected readonly etiquetaVigencia = computed<string>(() => {
    const dias = this.diasRestantes();
    const estado = this.vigencia();

    if (estado === 'VENCIDA') {
      return dias !== null ? `VENCIDA (${Math.abs(dias)} d)` : 'VENCIDA';
    }

    return dias !== null ? `${estado} · ${dias} d` : (estado ?? '');
  });
}
