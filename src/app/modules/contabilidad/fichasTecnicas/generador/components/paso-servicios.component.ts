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
  Homologo,
  ObsItem,
  OpcionesFormulario,
} from '../../models/ficha.model';
import { CupsService } from '../../services/cups.service';
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

// ── Estructura interna de cada fila ──────────────────────────────────────────
export interface FilaServicio extends DetallePayload {
  // ID interno para trackBy
  _id: number;
  // Labels de display (no se envían al backend)
  _cups_label?: string;
  _homologo_label?: string;
  _obs_label?: string;
  // Caché de homólogos cargados para esta fila
  _homologos?: Homologo[];
  // Caché de observaciones para esta fila
  _observaciones?: ObsItem[];
  // Estado de carga
  _cargandoHomologos?: boolean;
  _cargandoObs?: boolean;
}

/**
 * Paso 2 del generador: tabla editable de servicios/procedimientos.
 *
 * Replicamos la lógica condicional de form_liquidacion.php del legacy:
 *   - TIPO DE SERVICIO → tipo_servicio + forma_pago de turno → valor o %
 *   - CUPS → autocomplete CUPS → homólogos → forma_pago ISS/SOAT/tarifa → valor o %
 *   - GRUPO → select grupo → forma_pago ISS/SOAT → %
 *   - SUBGRUPO → select subgrupo → forma_pago ISS/SOAT → %
 *
 * Cada fila es independiente con su propia lógica de visibilidad.
 *
 * Fix persistencia: recibe [detallesPrevios] del padre para restaurar al volver.
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
  private readonly mensajes   = inject(MessageService);

  // ── Inputs ──────────────────────────────────────────────────────────────
  /** Detalles existentes (modo edición de una ficha). */
  readonly detallesExistentes  = input<DetalleFicha[]>([]);
  /** Detalles previos del paso 2 — restaurar al volver del paso 3. */
  readonly detallesPrevios     = input<DetallePayload[]>([]);
  readonly guardando           = input<boolean>(false);

  // ── Outputs ─────────────────────────────────────────────────────────────
  readonly continuar = output<DetallePayload[]>();
  readonly volver    = output<void>();

  // ── Estado ──────────────────────────────────────────────────────────────
  protected readonly opciones        = signal<OpcionesFormulario | null>(null);
  protected readonly filas           = signal<FilaServicio[]>([]);
  protected readonly sugerenciasCups = signal<{ subcategoria: string; desc_subcat: string; grupo?: string | null; subgrupo?: string | null }[]>([]);
  protected readonly grupos          = signal<CupsGrupo[]>([]);
  protected readonly subgrupos       = signal<CupsSubgrupo[]>([]);

  protected readonly tiposServicio = computed(() => this.opciones()?.tipos_servicio ?? []);
  protected readonly valorTotal    = computed(() =>
    this.filas().reduce((s, f) => s + (f.valor ?? 0), 0)
  );

  // Constantes expuestas al template
  protected readonly TIPOS_LIQ        = TIPOS_LIQUIDACION;
  protected readonly FP_TS_NORMAL     = FORMAS_PAGO_TIPO_SERVICIO_NORMAL;
  protected readonly FP_TS_CONJUNTO   = FORMAS_PAGO_CONJUNTO;
  protected readonly FP_ISS_SOAT      = FORMAS_PAGO_ISS_SOAT;
  protected readonly TS_NORMALES      = TIPOS_SERVICIO_NORMAL;
  protected readonly TS_CONJUNTO      = TIPO_SERVICIO_CONJUNTO;
  protected readonly PORCENTAJES      = PORCENTAJES;

  private contadorId = 0;
  private gruposCargados   = false;
  private subgruposCargados = false;

  // ── Ciclo de vida ────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.parametros.opcionesFormulario().subscribe((o) => this.opciones.set(o));

    // Prioridad: detallesExistentes (edición) > detallesPrevios (volver del paso 3)
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

  // ── Acciones de tabla ────────────────────────────────────────────────────

  protected agregarFila(): void {
    this.filas.update((prev) => [
      ...prev,
      {
        _id: ++this.contadorId,
        tipo_liquidacion: null,
        tipo_servicio: null,
        id_tipo_servicio: null,
        cups: null,
        grupo: null,
        subgrupo: null,
        forma_pago: null,
        homologo: null,
        variacion: null,
        valor: 0,
        id_obs_item: null,
        novedad: null,
        _homologos: [],
        _observaciones: [],
        _cargandoHomologos: false,
        _cargandoObs: false,
      } as FilaServicio,
    ]);
  }

  protected eliminarFila(fila: FilaServicio): void {
    this.filas.update((prev) => prev.filter((f) => f._id !== fila._id));
  }

  protected duplicarFila(fila: FilaServicio): void {
    const nueva: FilaServicio = {
      ...fila,
      _id: ++this.contadorId,
      _homologos: [...(fila._homologos ?? [])],
      _observaciones: [...(fila._observaciones ?? [])],
    };
    this.filas.update((prev) => [...prev, nueva]);
  }

  // ── Lógica condicional por tipo_liquidacion ───────────────────────────────

  /**
   * Llamado cuando cambia tipo_liquidacion en una fila.
   * Limpia los campos que no aplican a la nueva rama y precarga datos necesarios.
   */
  protected onTipoLiquidacionCambia(fila: FilaServicio): void {
    // Limpiar todos los campos dependientes
    fila.tipo_servicio    = null;
    fila.id_tipo_servicio = null;
    fila.cups             = null;
    fila._cups_label      = undefined;
    fila.grupo            = null;
    fila.subgrupo         = null;
    fila.forma_pago       = null;
    fila.homologo         = null;
    fila._homologo_label  = undefined;
    fila.variacion        = null;
    fila.valor            = 0;
    fila.id_obs_item      = null;
    fila._homologos       = [];
    fila._observaciones   = [];

    switch (fila.tipo_liquidacion) {
      case 'GRUPO':
        this.cargarGrupos();
        this.cargarObservaciones(fila, 3);
        break;
      case 'SUBGRUPO':
        this.cargarSubgrupos();
        this.cargarObservaciones(fila, 3);
        break;
    }

    this.filas.set([...this.filas()]);
  }

  // ── RAMA: TIPO DE SERVICIO ────────────────────────────────────────────────

  protected onTipoServicioCambia(fila: FilaServicio): void {
    fila.forma_pago = null;
    fila.variacion  = null;
    fila.valor      = 0;
    fila.id_obs_item = null;
    fila._observaciones = [];

    const servicio = fila.tipo_servicio;
    if (!servicio) { this.filas.set([...this.filas()]); return; }

    let codigoObs = 0;
    if (TIPOS_SERVICIO_NORMAL.includes(servicio)) {
      codigoObs = 1;
    } else if (servicio === TIPO_SERVICIO_CONJUNTO) {
      codigoObs = 2;
    }

    if (codigoObs > 0) this.cargarObservaciones(fila, codigoObs);
    this.filas.set([...this.filas()]);
  }

  protected onFormaPagoConjuntoCambia(fila: FilaServicio): void {
    fila.variacion = null;
    fila.valor     = 0;
    this.filas.set([...this.filas()]);
  }

  // ── RAMA: CUPS ────────────────────────────────────────────────────────────

  protected buscarCups(evento: AutoCompleteCompleteEvent): void {
    if ((evento.query ?? '').length < 2) return;
    this.cups.autocompletarCups(evento.query).subscribe((lista) => {
      this.sugerenciasCups.set(lista);
    });
  }

  protected seleccionarCups(
    fila: FilaServicio,
    item: { subcategoria: string; desc_subcat: string; grupo?: string | null; subgrupo?: string | null }
  ): void {
    fila.cups          = item.subcategoria;
    fila.grupo         = item.grupo ?? null;
    fila.subgrupo      = item.subgrupo ?? null;
    fila._cups_label   = `${item.subcategoria} — ${item.desc_subcat}`;
    fila.homologo      = null;
    fila._homologo_label = undefined;
    fila._homologos    = [];
    fila._cargandoHomologos = true;

    this.cargarObservaciones(fila, 3);
    this.filas.set([...this.filas()]);

    this.cups.homologosDeCups(item.subcategoria).subscribe({
      next: (homologos) => {
        fila._homologos = homologos;
        fila._cargandoHomologos = false;
        this.filas.set([...this.filas()]);
      },
      error: () => {
        fila._cargandoHomologos = false;
        this.filas.set([...this.filas()]);
      },
    });
  }

  /** Busca un homólogo en la caché de la fila por su code_manual. */
  protected findHomologo(fila: FilaServicio, codeManual: string): Homologo | null {
    return (fila._homologos ?? []).find((h) => h.code_manual === codeManual) ?? null;
  }

  protected seleccionarHomologo(fila: FilaServicio, homologo: Homologo | null): void {
    if (!homologo) {
      fila.homologo       = null;
      fila._homologo_label = undefined;
      fila.valor          = 0;
    } else {
      fila.homologo        = homologo.code_manual;
      fila._homologo_label = `${homologo.code_manual} — ${homologo.desc_manual}`;
      fila.valor           = Number(homologo.valor ?? 0);
    }
    this.filas.set([...this.filas()]);
  }

  protected onFormaPagoCupsCambia(fila: FilaServicio): void {
    fila.variacion = null;
    fila.valor     = 0;
    this.filas.set([...this.filas()]);
  }

  // ── RAMA: GRUPO / SUBGRUPO ────────────────────────────────────────────────

  protected onGrupoCambia(fila: FilaServicio): void {
    // La forma de pago se elige antes que el grupo (orden legacy); no la limpiamos.
    this.filas.set([...this.filas()]);
  }

  protected onSubgrupoCambia(fila: FilaServicio): void {
    this.filas.set([...this.filas()]);
  }

  protected onFormaPagoGrupoCambia(fila: FilaServicio): void {
    // Al cambiar la forma de pago se resetea el porcentaje
    fila.variacion = null;
    this.filas.set([...this.filas()]);
  }

  // ── Helpers de visibilidad expuestos al template ──────────────────────────

  /** TIPO DE SERVICIO: sub-rama normal (coordinación, presencialidad, disponibilidad). */
  protected esTipoServicioNormal(fila: FilaServicio): boolean {
    return fila.tipo_servicio != null && TIPOS_SERVICIO_NORMAL.includes(fila.tipo_servicio);
  }

  /** TIPO DE SERVICIO: sub-rama conjunto. */
  protected esTipoServicioConjunto(fila: FilaServicio): boolean {
    return fila.tipo_servicio === TIPO_SERVICIO_CONJUNTO;
  }

  /** CUPS con forma_pago ISS/SOAT → muestra porcentaje. */
  protected cupsUsaPorcentaje(fila: FilaServicio): boolean {
    return fila.tipo_liquidacion === 'CUPS' && ISS_USA_PORCENTAJE.has(fila.forma_pago ?? '');
  }

  /** CUPS con tarifa → muestra valor. */
  protected cupsUsaValor(fila: FilaServicio): boolean {
    return fila.tipo_liquidacion === 'CUPS' &&
      (fila.forma_pago === 'TARIFA EVENTO' || fila.forma_pago === 'TARIFA BAJO COTIZACIÓN');
  }

  /** CONJUNTO con MONTO o VALOR HORA → muestra valor. */
  protected conjuntoUsaValor(fila: FilaServicio): boolean {
    return fila.tipo_servicio === TIPO_SERVICIO_CONJUNTO &&
      (fila.forma_pago === 'MONTO FIJO MES CON EVENTOS' || fila.forma_pago === 'VALOR HORA CON EVENTOS');
  }

  /** CONJUNTO con PORCENTAJE → muestra variacion. */
  protected conjuntoUsaPorcentaje(fila: FilaServicio): boolean {
    return fila.tipo_servicio === TIPO_SERVICIO_CONJUNTO &&
      fila.forma_pago === 'PORCENTAJE DEL VALOR FACTURADO';
  }

  /** GRUPO/SUBGRUPO con forma_pago → muestra porcentaje. */
  protected grupoUsaPorcentaje(fila: FilaServicio): boolean {
    return (fila.tipo_liquidacion === 'GRUPO' || fila.tipo_liquidacion === 'SUBGRUPO') &&
      !!fila.forma_pago;
  }

  // ── Navegación del wizard ─────────────────────────────────────────────────

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

    const sinTipo = items.filter((f) => !f.tipo_liquidacion);
    if (sinTipo.length > 0) {
      this.mensajes.add({
        severity: 'warn',
        summary: 'Tipo de liquidación requerido',
        detail: `${sinTipo.length} fila(s) sin tipo de liquidación. Seleccione el tipo en cada ítem.`,
        life: 5000,
      });
      return;
    }

    const sinValorOPct = items.filter((f) => !this.filaEsValida(f));
    if (sinValorOPct.length > 0) {
      this.mensajes.add({
        severity: 'warn',
        summary: 'Datos incompletos',
        detail: `${sinValorOPct.length} ítem(s) sin valor o porcentaje. Verifique la tabla.`,
        life: 5000,
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

  // ── Carga de datos ────────────────────────────────────────────────────────

  private cargarGrupos(): void {
    if (this.gruposCargados) return;
    this.cups.grupos().subscribe({
      next: (g) => { this.grupos.set(g); this.gruposCargados = true; },
      error: () => {},
    });
  }

  private cargarSubgrupos(): void {
    if (this.subgruposCargados) return;
    this.cups.subgrupos().subscribe({
      next: (s) => { this.subgrupos.set(s); this.subgruposCargados = true; },
      error: () => {},
    });
  }

  private cargarObservaciones(fila: FilaServicio, codigoServicio: number): void {
    fila._cargandoObs = true;
    this.parametros.observacionesPorTipoServicio(codigoServicio).subscribe({
      next: (obs) => {
        fila._observaciones = obs;
        fila._cargandoObs   = false;
        this.filas.set([...this.filas()]);
      },
      error: () => {
        fila._cargandoObs = false;
        this.filas.set([...this.filas()]);
      },
    });
  }

  // ── Validación por fila ───────────────────────────────────────────────────

  private filaEsValida(fila: FilaServicio): boolean {
    switch (fila.tipo_liquidacion) {
      case 'TIPO DE SERVICIO':
        if (!fila.tipo_servicio || !fila.forma_pago) return false;
        if (TIPOS_SERVICIO_NORMAL.includes(fila.tipo_servicio)) return (fila.valor ?? 0) > 0;
        if (fila.tipo_servicio === TIPO_SERVICIO_CONJUNTO) {
          if (fila.forma_pago === 'PORCENTAJE DEL VALOR FACTURADO') return !!fila.variacion;
          return (fila.valor ?? 0) > 0;
        }
        return true;
      case 'CUPS':
        if (!fila.cups || !fila.forma_pago) return false;
        if (ISS_USA_PORCENTAJE.has(fila.forma_pago)) return !!fila.variacion;
        return (fila.valor ?? 0) > 0;
      case 'GRUPO':
      case 'SUBGRUPO':
        return !!(fila.grupo || fila.subgrupo) && !!fila.forma_pago && !!fila.variacion;
      default:
        return false;
    }
  }

  // ── Conversión DetalleFicha / DetallePayload → FilaServicio ──────────────

  private detalleAFila(d: DetalleFicha): FilaServicio {
    return {
      _id: ++this.contadorId,
      _cups_label:     d.cups ? `${d.cups} — ${d.cups_descripcion ?? ''}` : undefined,
      _homologo_label: d.homologo ? `${d.homologo} — ${d.homologo_descripcion ?? ''}` : undefined,
      _obs_label:      d.obs_item_descripcion ?? undefined,
      _homologos:      [],
      _observaciones:  [],
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
      _cups_label:     p.cups ?? undefined,
      _homologo_label: p.homologo ?? undefined,
      _homologos:      [],
      _observaciones:  [],
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
