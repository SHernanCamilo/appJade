import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { Textarea } from 'primeng/textarea';
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
    Textarea,
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

  readonly confirmar = output<string>();
  readonly volver = output<void>();

  protected readonly observacion = signal<string>('');

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

  protected enviar(): void {
    this.confirmar.emit(this.observacion().trim());
  }
}
