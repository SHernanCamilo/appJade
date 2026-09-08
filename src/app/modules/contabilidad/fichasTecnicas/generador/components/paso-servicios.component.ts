import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { AutoCompleteCompleteEvent, AutoCompleteModule } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';

import {
  CupsGrupo,
  CupsSubgrupo,
  DetalleFicha,
  DetallePayload,
  Ficha,
  Homologo,
  ObsItem,
  OpcionesFormulario,
} from '../../models/ficha.model';
import { CupsService } from '../../services/cups.service';
import { FichasTecnicasService } from '../../services/fichas-tecnicas.service';
import { ParametrosService } from '../../services/parametros.service';

// ── Tipos de liquidación (replicados del legacy form_liquidacion.php) ─────────
export type TipoLiquidacion = 'TIPO DE SERVICIO' | 'CUPS' | 'GRUPO' | 'SUBGRUPO' | '';

export const TIPOS_LIQUIDACION: { label: string; value: TipoLiquidacion }[] = [
  { label: 'Tipo de Servicio', value: 'TIPO DE SERVICIO' },
  { label: 'CUPS',             value: 'CUPS' },
  { label: 'Grupo',            value: 'GRUPO' },
  { label: 'Subgrupo',         value: 'SUBGRUPO' },
];

// ── Formas de pago por rama (replicadas del legacy) ───────────────────────────
export const FORMAS_PAGO_TIPO_SERVICIO_NORMAL: string[] = [
  'VR FIJO MES',
  'VR HORA GENERAL',
  'VR DIA GENERAL',
  'VR SEMANA GENERAL',
  'VR FIN DE SEMANA GENERAL',
  'VR LUNES A VIERNES GENERAL',
  'VR HORA FIN DE SEMANA JORNADA DIURNA',
  'VR HORA FIN DE SEMANA JORNADA NOCTURNA',
  'VR HORA LUNES A VIERNES JORNADA DIURNA',
  'VR HORA LUNES A VIERNES JORNADA NOCTURNA',
  'VR HORA SEGÚN CUADRO DE TURNOS',
];

export const FORMAS_PAGO_CONJUNTO: string[] = [
  'MONTO FIJO MES CON EVENTOS',
  'VALOR HORA CON EVENTOS',
  'PORCENTAJE DEL VALOR FACTURADO',
];

export const FORMAS_PAGO_ISS_SOAT: string[] = [
  'ISS 2001',
  'SOAT 2020', 'SOAT 2021', 'SOAT 2022', 'SOAT 2023', 'SOAT 2024',
  'SOAT UVT 2023', 'SOAT UVT 2024', 'SOAT UVT 2025',
  'SOAT VIGENTE', 'SOAT UVT VIGENTE',
  'PORCENTAJE FACTURADO A EAPB',
  'TARIFA EVENTO',
  'TARIFA BAJO COTIZACIÓN',
];

// ISS/SOAT que activan PORCENTAJE en vez de VALOR
const ISS_USA_PORCENTAJE = new Set([
  'ISS 2001', 'SOAT 2020', 'SOAT 2021', 'SOAT 2022', 'SOAT 2023', 'SOAT 2024',
  'SOAT UVT 2023', 'SOAT UVT 2024', 'SOAT UVT 2025',
  'SOAT VIGENTE', 'SOAT UVT VIGENTE', 'PORCENTAJE FACTURADO A EAPB',
]);

export const TIPOS_SERVICIO_NORMAL = ['COORDINACIÓN', 'PRESENCIALIDAD', 'DISPONIBILIDAD'];
export const TIPO_SERVICIO_CONJUNTO = 'CONJUNTO DE SERVICIOS';

// ── Porcentajes de variación (replicados del legacy form2-edit.php) ───────────
export interface OpcionPorcentaje { label: string; value: string; }

export const PORCENTAJES: OpcionPorcentaje[] = (() => {
  const mas = [80, 72, 45, 40, 37, 35, 34, 32, 31, 30, 28, 27, 26, 25, 24, 23, 22, 21, 20,
    18, 17, 16, 15, 14, 13, 12, 11, 10, 8, 7, 6, 5, 4, 3];
  const menos = [3, 4, 5, 8, 10, 12, 14, 15, 18, 20, 22, 25, 27, 28, 30, 32, 33, 34, 35, 36,
    37, 38, 39, 40, 41, 42, 43, 44, 45, 47, 48, 49, 50, 52, 55, 62, 65, 66, 67, 68, 70, 71,
    72, 73, 74, 75, 76, 77];

  const opciones: OpcionPorcentaje[] = mas.map((n) => ({ label: `MÁS ${n}%`, value: String(n) }));
  opciones.push({ label: 'SIN VARIACIÓN 0%', value: '0' });
  menos.forEach((n) => opciones.push({ label: `MENOS -${n}%`, value: String(-n) }));

  return opciones;
})();

// ── Ítem del borrador de trabajo (formulario de captura) ──────────────────────
interface ItemForm {
  tipo_liquidacion: TipoLiquidacion;
  tipo_servicio: string | null;
  cups: string | null;
  _cups_label: string | null;
  grupo: string | null;
  subgrupo: string | null;
  forma_pago: string | null;
  homologo: string | null;
  _homologo_label: string | null;
  variacion: string | null;
  valor: number;
  id_obs_item: number | null;
}

// ── Fila ya agregada a la tabla de previsualización ──────────────────────────
export interface FilaServicio extends DetallePayload {
  _id: number;
  _cups_label?: string | null;
  _homologo_label?: string | null;
  _obs_label?: string | null;
}

/**
 * Paso 2 del generador — patrón legacy (form2.php):
 *   [ Formulario de captura arriba ]  → botón "Agregar ítem a la ficha"
 *   [ Tabla de previsualización abajo ] con los ítems ya agregados
 *
 * El formulario cambia según tipo_liquidacion:
 *   - TIPO DE SERVICIO → servicio + forma pago turno → valor o %
 *   - CUPS → autocomplete → homólogos → forma pago ISS/SOAT/tarifa → valor o %
 *   - GRUPO / SUBGRUPO → forma pago → grupo/subgrupo → %
 *
 * Los ítems agregados se conservan en el signal `filas` y se emiten al padre;
 * al volver del paso 3 el padre los reinyecta vía [detallesPrevios].
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
    DialogModule,
    TagModule,
    ToastModule,
    TooltipModule,
  ],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './paso-servicios.component.html',
  styleUrl: './paso-servicios.component.css',
})
export class PasoServiciosComponent implements OnInit {
  private readonly cups       = inject(CupsService);
  private readonly parametros = inject(ParametrosService);
  private readonly fichas     = inject(FichasTecnicasService);
  private readonly mensajes   = inject(MessageService);

  // ── Inputs ──────────────────────────────────────────────────────────────
  readonly detallesExistentes = input<DetalleFicha[]>([]);
  readonly detallesPrevios    = input<DetallePayload[]>([]);
  readonly guardando          = input<boolean>(false);

  // ── Outputs ─────────────────────────────────────────────────────────────
  readonly continuar = output<DetallePayload[]>();
  readonly volver    = output<void>();

  // ── Estado: catálogos y tabla ─────────────────────────────────────────────
  protected readonly opciones        = signal<OpcionesFormulario | null>(null);
  protected readonly filas           = signal<FilaServicio[]>([]);
  protected readonly sugerenciasCups = signal<{ subcategoria: string; desc_subcat: string; grupo?: string | null; subgrupo?: string | null }[]>([]);
  protected readonly grupos          = signal<CupsGrupo[]>([]);
  protected readonly subgrupos       = signal<CupsSubgrupo[]>([]);
  protected readonly homologos       = signal<Homologo[]>([]);
  protected readonly observaciones   = signal<ObsItem[]>([]);
  protected readonly cargandoHomologos = signal<boolean>(false);

  // ── Estado: importación de servicios desde otra ficha ─────────────────────
  /** Estados importables (legacy import.php: id_estado in 5,11). */
  private static readonly ESTADOS_IMPORTABLES = [5, 11];
  protected readonly mostrarImportar     = signal<boolean>(false);
  protected readonly cargandoFichas       = signal<boolean>(false);
  protected readonly fichasImportables    = signal<Ficha[]>([]);
  protected readonly fichaOrigen          = signal<number | null>(null);
  protected readonly importando           = signal<boolean>(false);

  /**
   * Homólogos filtrados por la forma de pago (tipo_manual) seleccionada.
   * Si eligió "ISS 2001" solo muestra homólogos ISS; si "SOAT 2024" solo SOAT.
   * Las tarifas (TARIFA EVENTO/COTIZACIÓN) no filtran por manual — muestran todo.
   */
  protected readonly homologosFiltrados = computed<Homologo[]>(() => {
    const fp = this.item().forma_pago;
    const todos = this.homologos();
    if (!fp) return todos;

    // Determinar el "tipo_manual" objetivo según la forma de pago
    const fpUpper = fp.toUpperCase();
    if (fpUpper.startsWith('ISS')) {
      return todos.filter((h) => (h.tipo_manual ?? '').toUpperCase().includes('ISS'));
    }
    if (fpUpper.startsWith('SOAT')) {
      return todos.filter((h) => (h.tipo_manual ?? '').toUpperCase().includes('SOAT'));
    }
    // Tarifas / porcentaje EAPB → sin filtro por manual
    return todos;
  });

  // ── Estado: formulario de captura (un solo ítem en edición) ───────────────
  protected readonly item = signal<ItemForm>(this.itemVacio());

  protected readonly valorTotal = computed(() =>
    this.filas().reduce((s, f) => s + (f.valor ?? 0), 0)
  );

  // Constantes expuestas al template
  protected readonly TIPOS_LIQ      = TIPOS_LIQUIDACION;
  protected readonly FP_TS_NORMAL   = FORMAS_PAGO_TIPO_SERVICIO_NORMAL;
  protected readonly FP_TS_CONJUNTO = FORMAS_PAGO_CONJUNTO;
  protected readonly FP_ISS_SOAT    = FORMAS_PAGO_ISS_SOAT;
  protected readonly SERVICIOS_TS   = [...TIPOS_SERVICIO_NORMAL, TIPO_SERVICIO_CONJUNTO];
  protected readonly PORCENTAJES    = PORCENTAJES;

  private contadorId = 0;
  private gruposCargados = false;
  private subgruposCargados = false;

  // ── Ciclo de vida ────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.parametros.opcionesFormulario().subscribe((o) => this.opciones.set(o));

    const existentes = this.detallesExistentes();
    if (existentes.length > 0) {
      this.filas.set(existentes.map((d) => this.detalleAFila(d)));
      return;
    }

    const previos = this.detallesPrevios();
    if (previos.length > 0) {
      this.filas.set(previos.map((d) => this.payloadAFila(d)));
    }
  }

  // ── Helpers de estado del formulario ──────────────────────────────────────

  private itemVacio(): ItemForm {
    return {
      tipo_liquidacion: '',
      tipo_servicio: null,
      cups: null,
      _cups_label: null,
      grupo: null,
      subgrupo: null,
      forma_pago: null,
      homologo: null,
      _homologo_label: null,
      variacion: null,
      valor: 0,
      id_obs_item: null,
    };
  }

  /** Actualiza un campo del ítem en edición (inmutable para OnPush). */
  protected patch(cambios: Partial<ItemForm>): void {
    this.item.set({ ...this.item(), ...cambios });
  }

  // ── Cambios en el formulario de captura ────────────────────────────────────

  protected onTipoLiquidacionCambia(): void {
    // Reiniciar el ítem conservando solo el tipo
    const tipo = this.item().tipo_liquidacion;
    this.item.set({ ...this.itemVacio(), tipo_liquidacion: tipo });
    this.homologos.set([]);
    this.observaciones.set([]);

    switch (tipo) {
      case 'GRUPO':
        this.cargarGrupos();
        this.cargarObservaciones(3);
        break;
      case 'SUBGRUPO':
        this.cargarSubgrupos();
        this.cargarObservaciones(3);
        break;
    }
  }

  protected onTipoServicioCambia(): void {
    this.patch({ forma_pago: null, variacion: null, valor: 0, id_obs_item: null });
    this.observaciones.set([]);

    const servicio = this.item().tipo_servicio;
    if (!servicio) return;

    if (TIPOS_SERVICIO_NORMAL.includes(servicio)) {
      this.cargarObservaciones(1);
    } else if (servicio === TIPO_SERVICIO_CONJUNTO) {
      this.cargarObservaciones(2);
    }
  }

  protected onFormaPagoConjuntoCambia(): void {
    this.patch({ variacion: null, valor: 0 });
  }

  // ── CUPS ───────────────────────────────────────────────────────────────────

  protected buscarCups(evento: AutoCompleteCompleteEvent): void {
    if ((evento.query ?? '').length < 2) return;
    this.cups.autocompletarCups(evento.query).subscribe((lista) => {
      this.sugerenciasCups.set(Array.isArray(lista) ? lista : []);
    });
  }

  protected seleccionarCups(item: { subcategoria: string; desc_subcat: string; grupo?: string | null; subgrupo?: string | null }): void {
    // Conserva la forma de pago ya elegida (va antes que el homólogo).
    this.patch({
      cups: item.subcategoria,
      _cups_label: `${item.subcategoria} — ${item.desc_subcat}`,
      grupo: item.grupo ?? null,
      subgrupo: item.subgrupo ?? null,
      homologo: null,
      _homologo_label: null,
    });

    this.homologos.set([]);
    this.cargandoHomologos.set(true);
    this.cargarObservaciones(3);

    this.cups.homologosDeCups(item.subcategoria).subscribe({
      next: (h) => { this.homologos.set(Array.isArray(h) ? h : []); this.cargandoHomologos.set(false); },
      error: () => this.cargandoHomologos.set(false),
    });
  }

  protected seleccionarHomologo(codeManual: string | null): void {
    if (!codeManual) {
      this.patch({ homologo: null, _homologo_label: null });
      return;
    }
    const h = this.homologos().find((x) => x.code_manual === codeManual) ?? null;
    this.patch({
      homologo: codeManual,
      _homologo_label: h ? `${h.code_manual} — ${h.desc_manual}` : codeManual,
      valor: h?.valor ? Number(h.valor) : this.item().valor,
    });
  }

  protected onFormaPagoCupsCambia(): void {
    // Al cambiar la forma de pago cambia el filtro de homólogos → limpiar homólogo
    this.patch({ variacion: null, valor: 0, homologo: null, _homologo_label: null });
  }

  // ── GRUPO / SUBGRUPO ───────────────────────────────────────────────────────

  protected onFormaPagoGrupoCambia(): void {
    this.patch({ variacion: null });
  }

  // ── Visibilidad de campos (según tipo del ítem en edición) ─────────────────

  protected esTipoServicioNormal(): boolean {
    const s = this.item().tipo_servicio;
    return s != null && TIPOS_SERVICIO_NORMAL.includes(s);
  }

  protected esTipoServicioConjunto(): boolean {
    return this.item().tipo_servicio === TIPO_SERVICIO_CONJUNTO;
  }

  protected cupsUsaPorcentaje(): boolean {
    return this.item().tipo_liquidacion === 'CUPS' && ISS_USA_PORCENTAJE.has(this.item().forma_pago ?? '');
  }

  protected cupsUsaValor(): boolean {
    const fp = this.item().forma_pago;
    return this.item().tipo_liquidacion === 'CUPS' && (fp === 'TARIFA EVENTO' || fp === 'TARIFA BAJO COTIZACIÓN');
  }

  protected conjuntoUsaValor(): boolean {
    const fp = this.item().forma_pago;
    return this.esTipoServicioConjunto() && (fp === 'MONTO FIJO MES CON EVENTOS' || fp === 'VALOR HORA CON EVENTOS');
  }

  protected conjuntoUsaPorcentaje(): boolean {
    return this.esTipoServicioConjunto() && this.item().forma_pago === 'PORCENTAJE DEL VALOR FACTURADO';
  }

  protected grupoUsaPorcentaje(): boolean {
    const t = this.item().tipo_liquidacion;
    return (t === 'GRUPO' || t === 'SUBGRUPO') && !!this.item().forma_pago;
  }

  /**
   * Muestra el campo de observación del ítem cuando el usuario ya avanzó
   * lo suficiente en la rama como para haber disparado la carga de observaciones.
   */
  protected mostrarObservacion(): boolean {
    const it = this.item();
    switch (it.tipo_liquidacion) {
      case 'TIPO DE SERVICIO': return !!it.tipo_servicio;
      case 'CUPS':             return !!it.cups;
      case 'GRUPO':            return !!it.grupo || !!it.forma_pago;
      case 'SUBGRUPO':         return !!it.subgrupo || !!it.forma_pago;
      default:                 return false;
    }
  }

  // ── Agregar ítem a la ficha (tabla) ────────────────────────────────────────

  protected agregarItem(): void {
    const it = this.item();

    if (!this.itemValido(it)) {
      this.mensajes.add({
        severity: 'warn',
        summary: 'Ítem incompleto',
        detail: 'Complete todos los campos requeridos del ítem antes de agregarlo.',
        life: 4000,
      });
      return;
    }

    const fila: FilaServicio = {
      _id: ++this.contadorId,
      tipo_liquidacion: it.tipo_liquidacion || null,
      tipo_servicio: it.tipo_servicio,
      id_tipo_servicio: null,
      cups: it.cups,
      _cups_label: it._cups_label,
      grupo: it.grupo,
      subgrupo: it.subgrupo,
      forma_pago: it.forma_pago,
      homologo: it.homologo,
      _homologo_label: it._homologo_label,
      _obs_label: this.observaciones().find((o) => o.id === it.id_obs_item)?.descripcion ?? null,
      variacion: it.variacion,
      valor: it.valor ?? 0,
      id_obs_item: it.id_obs_item,
      novedad: null,
    };

    this.filas.update((prev) => [...prev, fila]);

    // Resetear el formulario para el siguiente ítem
    this.item.set(this.itemVacio());
    this.homologos.set([]);
    this.observaciones.set([]);

    this.mensajes.add({ severity: 'success', summary: 'Ítem agregado', life: 2000 });
  }

  protected eliminarFila(fila: FilaServicio): void {
    this.filas.update((prev) => prev.filter((f) => f._id !== fila._id));
  }

  // ── Importar servicios de otra ficha (legacy import.php) ───────────────────

  /** Abre el diálogo y carga las fichas importables (estados 5 y 11). */
  protected abrirImportar(): void {
    this.fichaOrigen.set(null);
    this.mostrarImportar.set(true);

    if (this.fichasImportables().length > 0) return; // ya cargadas

    this.cargandoFichas.set(true);
    this.fichas
      .listar({ id_estado: PasoServiciosComponent.ESTADOS_IMPORTABLES, per_page: 200 })
      .subscribe({
        next: (resp) => {
          this.fichasImportables.set(Array.isArray(resp.data) ? resp.data : []);
          this.cargandoFichas.set(false);
        },
        error: () => {
          this.fichasImportables.set([]);
          this.cargandoFichas.set(false);
          this.mensajes.add({
            severity: 'error',
            summary: 'No se pudieron cargar las fichas',
            detail: 'Intente nuevamente en unos segundos.',
            life: 4000,
          });
        },
      });
  }

  /** Etiqueta legible de una ficha para el desplegable ("consecutivo — agremiación — especialidad"). */
  protected etiquetaFicha(f: Ficha): string {
    const consecutivo = f.consecutivo ?? `Ficha #${f.id}`;
    const agrem = f.agremiacion?.nombre ?? 's/agremiación';
    const esp = f.especialidad?.descripcion ?? 's/especialidad';
    return `${consecutivo} — ${agrem} — ${esp}`;
  }

  /** Trae los detalles de la ficha origen y los agrega a la tabla actual. */
  protected confirmarImportar(): void {
    const idOrigen = this.fichaOrigen();
    if (!idOrigen) {
      this.mensajes.add({
        severity: 'warn',
        summary: 'Seleccione una ficha',
        detail: 'Elija la ficha de la que desea importar los servicios.',
        life: 3500,
      });
      return;
    }

    this.importando.set(true);
    this.fichas.detalles(idOrigen).subscribe({
      next: (detalles) => {
        const nuevas = (Array.isArray(detalles) ? detalles : []).map((d) => this.detalleAFila(d));
        this.filas.update((prev) => [...prev, ...nuevas]);
        this.importando.set(false);
        this.mostrarImportar.set(false);

        this.mensajes.add({
          severity: nuevas.length > 0 ? 'success' : 'info',
          summary: nuevas.length > 0 ? 'Servicios importados' : 'Sin servicios',
          detail: nuevas.length > 0
            ? `Se agregaron ${nuevas.length} servicio(s) desde la ficha seleccionada.`
            : 'La ficha seleccionada no tiene servicios para importar.',
          life: 3500,
        });
      },
      error: () => {
        this.importando.set(false);
        this.mensajes.add({
          severity: 'error',
          summary: 'Error al importar',
          detail: 'No se pudieron obtener los servicios de la ficha seleccionada.',
          life: 4000,
        });
      },
    });
  }

  // ── Navegación ─────────────────────────────────────────────────────────────

  protected enviar(): void {
    const items = this.filas();

    if (items.length === 0) {
      this.mensajes.add({
        severity: 'warn',
        summary: 'Sin servicios',
        detail: 'Agregue al menos un ítem a la ficha antes de continuar.',
        life: 4000,
      });
      return;
    }

    this.continuar.emit(
      items.map((f) => ({
        tipo_liquidacion:  f.tipo_liquidacion,
        tipo_servicio:     f.tipo_servicio,
        id_tipo_servicio:  f.id_tipo_servicio,
        cups:              f.cups,
        grupo:             f.grupo,
        subgrupo:          f.subgrupo,
        forma_pago:        f.forma_pago,
        homologo:          f.homologo,
        variacion:         f.variacion,
        valor:             f.valor ?? 0,
        id_obs_item:       f.id_obs_item,
        novedad:           f.novedad,
      }))
    );
  }

  // ── Carga de catálogos ─────────────────────────────────────────────────────

  private cargarGrupos(): void {
    if (this.gruposCargados) return;
    this.cups.grupos().subscribe({
      next: (g) => { this.grupos.set(Array.isArray(g) ? g : []); this.gruposCargados = true; },
      error: () => {},
    });
  }

  private cargarSubgrupos(): void {
    if (this.subgruposCargados) return;
    this.cups.subgrupos().subscribe({
      next: (s) => { this.subgrupos.set(Array.isArray(s) ? s : []); this.subgruposCargados = true; },
      error: () => {},
    });
  }

  private cargarObservaciones(codigoServicio: number): void {
    this.parametros.observacionesPorTipoServicio(codigoServicio).subscribe({
      next: (obs) => this.observaciones.set(Array.isArray(obs) ? obs : []),
      error: () => this.observaciones.set([]),
    });
  }

  // ── Validación del ítem en edición ─────────────────────────────────────────

  private itemValido(it: ItemForm): boolean {
    switch (it.tipo_liquidacion) {
      case 'TIPO DE SERVICIO':
        if (!it.tipo_servicio || !it.forma_pago) return false;
        if (TIPOS_SERVICIO_NORMAL.includes(it.tipo_servicio)) return (it.valor ?? 0) > 0;
        if (it.tipo_servicio === TIPO_SERVICIO_CONJUNTO) {
          if (it.forma_pago === 'PORCENTAJE DEL VALOR FACTURADO') return !!it.variacion;
          return (it.valor ?? 0) > 0;
        }
        return true;
      case 'CUPS':
        if (!it.cups || !it.forma_pago) return false;
        if (ISS_USA_PORCENTAJE.has(it.forma_pago)) return !!it.variacion;
        return (it.valor ?? 0) > 0;
      case 'GRUPO':
        return !!it.grupo && !!it.forma_pago && !!it.variacion;
      case 'SUBGRUPO':
        return !!it.subgrupo && !!it.forma_pago && !!it.variacion;
      default:
        return false;
    }
  }

  // ── Etiqueta de concepto para la tabla ─────────────────────────────────────

  protected conceptoFila(f: FilaServicio): string {
    switch (f.tipo_liquidacion) {
      case 'TIPO DE SERVICIO': return f.tipo_servicio ?? '—';
      case 'CUPS':             return f._cups_label ?? f.cups ?? '—';
      case 'GRUPO':            return f.grupo ?? '—';
      case 'SUBGRUPO':         return f.subgrupo ?? '—';
      default:                 return '—';
    }
  }

  /** Etiqueta legible del porcentaje (ej. "MÁS 72%"). */
  protected labelPorcentaje(valor: string | null): string {
    if (valor == null || valor === '') return '—';
    return PORCENTAJES.find((p) => p.value === valor)?.label ?? `${valor}%`;
  }

  // ── Conversión DetalleFicha / DetallePayload → FilaServicio ──────────────

  private detalleAFila(d: DetalleFicha): FilaServicio {
    return {
      _id: ++this.contadorId,
      _cups_label:     d.cups ? `${d.cups} — ${d.cups_descripcion ?? ''}` : null,
      _homologo_label: d.homologo ? `${d.homologo} — ${d.homologo_descripcion ?? ''}` : null,
      _obs_label:      d.obs_item_descripcion ?? null,
      tipo_liquidacion:  d.tipo_liquidacion,
      tipo_servicio:     d.tipo_servicio,
      id_tipo_servicio:  d.id_tipo_servicio,
      cups:              d.cups,
      grupo:             d.grupo,
      subgrupo:          d.subgrupo,
      forma_pago:        d.forma_pago,
      homologo:          d.homologo,
      variacion:         d.variacion,
      valor:             Number(d.valor),
      id_obs_item:       d.id_obs_item,
      novedad:           d.novedad,
    };
  }

  private payloadAFila(p: DetallePayload): FilaServicio {
    return {
      _id: ++this.contadorId,
      _cups_label:     p.cups ?? null,
      _homologo_label: p.homologo ?? null,
      tipo_liquidacion:  p.tipo_liquidacion,
      tipo_servicio:     p.tipo_servicio,
      id_tipo_servicio:  p.id_tipo_servicio,
      cups:              p.cups,
      grupo:             p.grupo,
      subgrupo:          p.subgrupo,
      forma_pago:        p.forma_pago,
      homologo:          p.homologo,
      variacion:         p.variacion,
      valor:             p.valor ?? 0,
      id_obs_item:       p.id_obs_item,
      novedad:           p.novedad,
    };
  }
}
