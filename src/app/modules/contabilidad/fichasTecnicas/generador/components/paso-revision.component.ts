import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { InputTextModule } from 'primeng/inputtext';
import { PanelModule } from 'primeng/panel';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

import { CrearFichaPayload, DetallePayload, OpcionesFormulario } from '../../models/ficha.model';

@Component({
  selector: 'app-paso-revision',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PanelModule,
    CardModule,
    TableModule,
    TagModule,
    ButtonModule,
    DividerModule,
    InputTextModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './paso-revision.component.html',
  styleUrl: './paso-revision.component.css',
})
export class PasoRevisionComponent {
  readonly cabecera = input.required<CrearFichaPayload>();
  readonly detalles = input.required<DetallePayload[]>();
  readonly opciones = input<OpcionesFormulario | null>(null);
  readonly guardando = input<boolean>(false);

  /** Emite la lista de observaciones generales al confirmar. */
  readonly confirmar = output<string[]>();
  readonly volver = output<void>();

  /** Lista de observaciones generales agregadas (como en el legacy form3). */
  protected readonly observaciones = signal<string[]>([]);
  /** Texto en edición del input de nueva observación. */
  protected readonly nuevaObservacion = signal<string>('');

  protected get agremiacion(): string {
    return this.opciones()?.agremiaciones.find((a) => a.id === this.cabecera().id_agremiacion)?.nombre ?? '—';
  }

  protected get especialidad(): string {
    return this.opciones()?.especialidades.find((e) => e.id === this.cabecera().id_especialidad)?.descripcion ?? '—';
  }

  protected get objeto(): string {
    return this.opciones()?.objetos_contrato.find((o) => o.id === this.cabecera().id_objeto_contrato)?.descripcion ?? '—';
  }

  protected get totalServicios(): number {
    return this.detalles().reduce((s, d) => s + (d.valor ?? 0), 0);
  }

  protected setNuevaObservacion(valor: string): void {
    this.nuevaObservacion.set(valor);
  }

  /** Agrega la observación en edición a la lista (Enter o botón). */
  protected agregarObservacion(): void {
    const texto = this.nuevaObservacion().trim();
    if (texto === '') return;

    this.observaciones.update((prev) => [...prev, texto.toUpperCase()]);
    this.nuevaObservacion.set('');
  }

  protected eliminarObservacion(indice: number): void {
    this.observaciones.update((prev) => prev.filter((_, i) => i !== indice));
  }

  /** Resuelve el "concepto" de un detalle según su tipo de liquidación. */
  protected conceptoDetalle(d: DetallePayload): string {
    switch (d.tipo_liquidacion) {
      case 'TIPO DE SERVICIO':
        return d.tipo_servicio ?? '—';
      case 'CUPS':
        return d.cups ?? '—';
      case 'GRUPO':
        return d.grupo ?? '—';
      case 'SUBGRUPO':
        return d.subgrupo ?? '—';
      default:
        return '—';
    }
  }

  protected enviar(): void {
    // Si quedó texto sin agregar en el input, lo incluye igualmente.
    const pendiente = this.nuevaObservacion().trim();
    const lista = [...this.observaciones()];
    if (pendiente !== '') {
      lista.push(pendiente.toUpperCase());
    }
    this.confirmar.emit(lista);
  }
}
