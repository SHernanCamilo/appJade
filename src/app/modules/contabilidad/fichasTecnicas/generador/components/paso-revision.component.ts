import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, input, output, signal } from '@angular/core';
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
export class PasoRevisionComponent implements OnInit {
  readonly cabecera = input.required<CrearFichaPayload>();
  readonly detalles = input.required<DetallePayload[]>();
  readonly opciones = input<OpcionesFormulario | null>(null);
  readonly guardando = input<boolean>(false);
  /** Mapa código→nombre de profesionales, para mostrar sus nombres en la revisión. */
  readonly nombresProfesionales = input<Record<string, string>>({});
  /**
   * Observaciones ya capturadas en una visita anterior a este paso.
   * El padre las conserva para que no se pierdan al navegar entre pasos.
   */
  readonly observacionesPrevias = input<string[]>([]);

  /**
   * Emite al confirmar: las observaciones y si además debe enviarse a validación.
   *  - enviar=false → solo guarda el borrador.
   *  - enviar=true  → guarda y envía a validación (crea el consecutivo/flujo).
   */
  readonly confirmar = output<{ observaciones: string[]; enviar: boolean }>();
  /** Notifica al padre el estado actual de las observaciones (para conservarlas). */
  readonly observacionesCambian = output<string[]>();
  /** Volver al paso 2 (servicios). */
  readonly volver = output<void>();
  /** Volver al paso 1 (datos del contrato / profesionales). */
  readonly volverADatos = output<void>();

  /** Nombre legible de un profesional por su código (o el código si no hay nombre). */
  protected nombreProfesional(codigo: string): string {
    return this.nombresProfesionales()[codigo] ?? codigo;
  }

  /** Lista de observaciones generales agregadas (como en el legacy form3). */
  protected readonly observaciones = signal<string[]>([]);
  /** Texto en edición del input de nueva observación. */
  protected readonly nuevaObservacion = signal<string>('');

  /** Restaura las observaciones capturadas en una visita anterior a este paso. */
  ngOnInit(): void {
    const previas = this.observacionesPrevias();
    if (previas.length > 0) {
      this.observaciones.set([...previas]);
    }
  }

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
    this.observacionesCambian.emit(this.observaciones());
  }

  protected eliminarObservacion(indice: number): void {
    this.observaciones.update((prev) => prev.filter((_, i) => i !== indice));
    this.observacionesCambian.emit(this.observaciones());
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

  /** Lista final incluyendo el texto pendiente en el input (si lo hay). */
  private observacionesConPendiente(): string[] {
    const pendiente = this.nuevaObservacion().trim();
    const lista = [...this.observaciones()];
    if (pendiente !== '') {
      lista.push(pendiente.toUpperCase());
    }
    return lista;
  }

  /** Guarda solo el borrador (sin enviar a validación). */
  protected guardarBorrador(): void {
    this.confirmar.emit({ observaciones: this.observacionesConPendiente(), enviar: false });
  }

  /** Guarda y envía a validación (inicia el flujo de aprobación). */
  protected guardarYEnviar(): void {
    this.confirmar.emit({ observaciones: this.observacionesConPendiente(), enviar: true });
  }

  /** Vuelve al paso 2 conservando las observaciones (incluido el pendiente). */
  protected onVolver(): void {
    this.observacionesCambian.emit(this.observacionesConPendiente());
    this.volver.emit();
  }

  /** Vuelve al paso 1 conservando las observaciones (incluido el pendiente). */
  protected onVolverADatos(): void {
    this.observacionesCambian.emit(this.observacionesConPendiente());
    this.volverADatos.emit();
  }
}
