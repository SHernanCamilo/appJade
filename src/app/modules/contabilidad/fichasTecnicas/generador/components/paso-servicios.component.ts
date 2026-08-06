import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { AutoCompleteCompleteEvent, AutoCompleteModule } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';

import { DetalleFicha, DetallePayload, Homologo, ObsItem, OpcionesFormulario } from '../../models/ficha.model';
import { CupsService } from '../../services/cups.service';
import { ParametrosService } from '../../services/parametros.service';

interface FilaServicio extends DetallePayload {
  _id: number;
  _cups_label?: string;
  _homologo_label?: string;
  _obs_label?: string;
}

/**
 * Paso 2: tabla editable de servicios/procedimientos.
 *
 * Reemplaza `generador/form2.php` donde cada fila se guardaba con un POST
 * individual a `insertar2.php`. Aquí el usuario puede agregar/editar/eliminar
 * filas y guardar todo el lote de una sola vez con `items[]`.
 *
 * La búsqueda de CUPS usa autocompletado contra el endpoint del servidor
 * (fulltext index), en vez de cargar 9.400 filas en un `<select>` oculto como
 * hacía el legacy.
 */
@Component({
  selector: 'app-paso-servicios',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    AutoCompleteModule,
    SelectModule,
    InputNumberModule,
    InputTextModule,
    ButtonModule,
    TagModule,
    ToastModule,
    ConfirmDialogModule,
  ],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './paso-servicios.component.html',
  styleUrl: './paso-servicios.component.css',
})
export class PasoServiciosComponent {
  private readonly cups = inject(CupsService);
  private readonly parametros = inject(ParametrosService);
  private readonly mensajes = inject(MessageService);

  /** Detalles existentes (modo edición de una ficha). */
  readonly detallesExistentes = input<DetalleFicha[]>([]);
  readonly guardando = input<boolean>(false);

  readonly continuar = output<DetallePayload[]>();
  readonly volver = output<void>();

  protected readonly opciones = signal<OpcionesFormulario | null>(null);
  protected readonly filas = signal<FilaServicio[]>([]);
  protected readonly sugerenciasCups = signal<{ subcategoria: string; desc_subcat: string }[]>([]);
  protected readonly sugerenciasHomologos = signal<Homologo[]>([]);
  protected readonly observaciones = signal<ObsItem[]>([]);

  protected readonly formasPago = computed(() => this.opciones()?.formas_pago ?? []);
  protected readonly tiposServicio = computed(() => this.opciones()?.tipos_servicio ?? []);

  protected readonly valorTotal = computed(() =>
    this.filas().reduce((sum, f) => sum + (f.valor ?? 0), 0),
  );

  private contadorId = 0;

  constructor() {
    this.parametros.opcionesFormulario().subscribe((o) => this.opciones.set(o));

    // Si hay detalles existentes los carga como filas editables.
    const existentes = this.detallesExistentes();
    if (existentes.length > 0) {
      this.filas.set(existentes.map((d) => this.detalleAFila(d)));
    }
  }

  // ── Acciones de la tabla ──────────────────────────────────────────────

  protected agregarFila(): void {
    this.filas.update((prev) => [
      ...prev,
      {
        _id: ++this.contadorId,
        cups: null,
        grupo: null,
        subgrupo: null,
        tipo_liquidacion: null,
        tipo_servicio: null,
        id_tipo_servicio: null,
        forma_pago: null,
        homologo: null,
        variacion: null,
        valor: 0,
        id_obs_item: null,
        novedad: null,
      },
    ]);
  }

  protected eliminarFila(fila: FilaServicio): void {
    this.filas.update((prev) => prev.filter((f) => f._id !== fila._id));
  }

  protected duplicarFila(fila: FilaServicio): void {
    this.filas.update((prev) => [...prev, { ...fila, _id: ++this.contadorId }]);
  }

  // ── Autocompletado de CUPS ────────────────────────────────────────────

  protected buscarCups(evento: AutoCompleteCompleteEvent): void {
    this.cups.autocompletarCups(evento.query).subscribe((lista) => {
      this.sugerenciasCups.set(lista);
    });
  }

  protected seleccionarCups(fila: FilaServicio, item: { subcategoria: string; desc_subcat: string; grupo?: string | null; subgrupo?: string | null }): void {
    fila.cups = item.subcategoria;
    fila.grupo = item.grupo ?? null;
    fila.subgrupo = item.subgrupo ?? null;
    fila._cups_label = `${item.subcategoria} - ${item.desc_subcat}`;

    // Cargar homólogos del CUPS seleccionado.
    this.cups.homologosDeCups(item.subcategoria).subscribe((homologos) => {
      this.sugerenciasHomologos.set(homologos);
    });
  }

  // ── Cascada de homólogos ──────────────────────────────────────────────

  protected seleccionarHomologo(fila: FilaServicio, homologo: Homologo): void {
    fila.homologo = homologo.code_manual;
    fila._homologo_label = `${homologo.code_manual} - ${homologo.desc_manual}`;
    fila.valor = Number(homologo.valor ?? 0);
  }

  // ── Cascada de observaciones por tipo de servicio ─────────────────────

  protected onTipoServicioCambia(fila: FilaServicio): void {
    if (!fila.id_tipo_servicio) {
      this.observaciones.set([]);
      return;
    }

    // Texto descriptivo para el campo `tipo_servicio` (conserva compatibilidad legacy)
    const ts = this.tiposServicio().find((t) => t.id === fila.id_tipo_servicio);
    fila.tipo_servicio = ts?.descripcion ?? null;

    this.parametros.observacionesPorTipoServicio(fila.id_tipo_servicio).subscribe((obs) => {
      this.observaciones.set(obs);
    });
  }

  protected seleccionarObservacion(fila: FilaServicio, obs: ObsItem | null): void {
    fila.id_obs_item = obs?.id ?? null;
    fila._obs_label = obs?.descripcion ?? '';
  }

  // ── Navegación del wizard ─────────────────────────────────────────────

  protected enviar(): void {
    const items = this.filas();

    if (items.length === 0) {
      this.mensajes.add({
        severity: 'warn',
        summary: 'Sin servicios',
        detail: 'Agregue al menos un servicio/procedimiento antes de continuar.',
        life: 4000,
      });
      return;
    }

    const sinValor = items.filter((f) => !f.valor || f.valor <= 0);
    if (sinValor.length > 0) {
      this.mensajes.add({
        severity: 'warn',
        summary: 'Valor inválido',
        detail: `Hay ${sinValor.length} servicio(s) con valor $0. Verifique la tabla.`,
        life: 4000,
      });
      return;
    }

    const payloads: DetallePayload[] = items.map((f) => ({
      tipo_liquidacion: f.tipo_liquidacion,
      tipo_servicio: f.tipo_servicio,
      id_tipo_servicio: f.id_tipo_servicio,
      cups: f.cups,
      grupo: f.grupo,
      subgrupo: f.subgrupo,
      forma_pago: f.forma_pago,
      homologo: f.homologo,
      variacion: f.variacion,
      valor: f.valor ?? 0,
      id_obs_item: f.id_obs_item,
      novedad: f.novedad,
    }));

    this.continuar.emit(payloads);
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private detalleAFila(d: DetalleFicha): FilaServicio {
    return {
      _id: ++this.contadorId,
      _cups_label: d.cups ? `${d.cups} - ${d.cups_descripcion ?? ''}` : undefined,
      _homologo_label: d.homologo ? `${d.homologo} - ${d.homologo_descripcion ?? ''}` : undefined,
      _obs_label: d.obs_item_descripcion ?? undefined,
      tipo_liquidacion: d.tipo_liquidacion,
      tipo_servicio: d.tipo_servicio,
      id_tipo_servicio: d.id_tipo_servicio,
      cups: d.cups,
      grupo: d.grupo,
      subgrupo: d.subgrupo,
      forma_pago: d.forma_pago,
      homologo: d.homologo,
      variacion: d.variacion,
      valor: Number(d.valor),
      id_obs_item: d.id_obs_item,
      novedad: d.novedad,
    };
  }
}
