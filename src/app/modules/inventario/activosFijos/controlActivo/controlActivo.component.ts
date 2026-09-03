import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TabViewModule } from 'primeng/tabview';
import { DropdownModule } from 'primeng/dropdown';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { MessageService } from 'primeng/api';

import {
  ActivoFijo,
  ActivosFijosService,
  CampoBusqueda,
  NovedadActivoPayload,
  NovedadExternaPayload,
  ResumenTrazabilidad,
  ValidacionPeriodicidad,
  TipoInventario,
  TrazabilidadActivo,
  ResultadoInventario
} from '../services/activos-fijos.service';

/**
 * Campos de novedad que el inventariador puede reportar.
 * - Estado: ELIMINADO (es solo lectura desde Fabric).
 * - Unidad funcional: ELIMINADA.
 * - tipo_inventario_id: REQUERIDO, identifica el tipo de inventario que se realiza.
 */
interface FormularioNovedad {
  tipo_inventario_id: number | null;
  novedad_placa: string;
  novedad_articulo: string;
  novedad_marca: string;
  novedad_modelo: string;
  novedad_serie: string;
  novedad_responsable: string;
  novedad_localizacion: string;
  novedad_sucursal: string;
  novedad_estado_fisico: string;
  observacion: string;
}

/** Formulario para registrar activo externo (no está en el maestro). */
interface FormularioExterno {
  placa: string;
  tipo_inventario_id: number | null;
  serie: string;
  articulo_nombre: string;
  marca: string;
  modelo: string;
  responsable: string;
  localizacion: string;
  sucursal: string;
  estado_fisico: string;
  observacion: string;
}

const FORMULARIO_VACIO: FormularioNovedad = {
  tipo_inventario_id: null,
  novedad_placa: '',
  novedad_articulo: '',
  novedad_marca: '',
  novedad_modelo: '',
  novedad_serie: '',
  novedad_responsable: '',
  novedad_localizacion: '',
  novedad_sucursal: '',
  novedad_estado_fisico: '',
  observacion: ''
};

const FORMULARIO_EXTERNO_VACIO: FormularioExterno = {
  placa: '',
  tipo_inventario_id: null,
  serie: '',
  articulo_nombre: '',
  marca: '',
  modelo: '',
  responsable: '',
  localizacion: '',
  sucursal: '',
  estado_fisico: '',
  observacion: ''
};

/** Índices de las pestañas. */
const TAB_REGISTRAR = 0;
const TAB_TRAZABILIDAD = 1;

/**
 * Control de Activos Fijos — módulo único con dos pestañas.
 *
 *   Registro     → busca el activo en el maestro de Indigo (vista de Fabric),
 *                  muestra sus datos en solo lectura (incluyendo EstadoActivo,
 *                  Localización y Responsable) y permite reportar diferencias.
 *                  Requiere seleccionar el Tipo de Inventario antes de guardar.
 *
 *   Trazabilidad → listado paginado de todas las tomas, filtrable por
 *                  Tipo Inventario (en lugar de Unidad Funcional).
 */
@Component({
  selector: 'app-control-activo',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ToastModule,
    TooltipModule,
    TableModule,
    TagModule,
    TabViewModule,
    DropdownModule,
    AutoCompleteModule
  ],
  providers: [MessageService],
  templateUrl: './controlActivo.component.html',
  styleUrl: './controlActivo.component.css'
})
export class ControlActivoComponent implements OnInit {
  private readonly service = inject(ActivosFijosService);
  private readonly messages = inject(MessageService);

  /** 0 = Registrar toma, 1 = Trazabilidad */
  tabActiva = TAB_REGISTRAR;

  // =========================================================================
  // PESTAÑA 1 — REGISTRAR TOMA
  // =========================================================================

  campoBusqueda: CampoBusqueda = 'placa';
  valorBusqueda = '';
  buscando = false;

  readonly camposBusqueda: Array<{ valor: CampoBusqueda; etiqueta: string }> = [
    { valor: 'placa', etiqueta: 'Placa' },
    { valor: 'serie', etiqueta: 'Serie' },
    { valor: 'responsable', etiqueta: 'Responsable' },
    { valor: 'articulo', etiqueta: 'Artículo' }
  ];

  resultados: ActivoFijo[] = [];
  activo: ActivoFijo | null = null;
  historial: TrazabilidadActivo[] = [];
  cargandoHistorial = false;

  formulario: FormularioNovedad = { ...FORMULARIO_VACIO };
  guardando = false;

  /** Estados físicos del activo (cargados desde opciones del backend). */
  estadosFisicos: string[] = [];

  /** Tipos de inventario activos para el dropdown requerido. */
  tiposInventario: TipoInventario[] = [];
  tiposInventarioOpciones: Array<{ label: string; value: number }> = [];

  /** Localizaciones desde DetalleActivos (Indigo). */
  localizacionesOpciones: Array<{ label: string; value: string }> = [];

  /** Responsables desde DetalleActivos (Indigo). */
  responsablesSugerencias: string[] = [];

  /** Controla si se muestra el formulario de activo externo. */
  mostrarFormExterno = false;
  formularioExterno: FormularioExterno = { ...FORMULARIO_EXTERNO_VACIO };
  guardandoExterno = false;

  /** Alerta de periodicidad: se muestra cuando el backend rechaza con 409 o al seleccionar tipo. */
  alertaPeriodicidad: string | null = null;
  validacionPeriodicidad: ValidacionPeriodicidad | null = null;
  validandoPeriodicidad = false;

  /** Indica si la última búsqueda no encontró resultados. */
  sinResultados = false;

  // =========================================================================
  // PESTAÑA 2 — TRAZABILIDAD
  // =========================================================================

  registros: TrazabilidadActivo[] = [];
  resumen: ResumenTrazabilidad | null = null;

  cargandoTraza = false;
  totalRegistros = 0;
  filasPorPagina = 25;
  primeraFila = 0;

  /** Filtros del reporte de trazabilidad. */
  filtros = {
    placa: '',
    estado_fisico: '',
    desde: '',
    hasta: '',
    tipo_inventario_id: null as number | null,
    responsable: '',
    localizacion: '',
    resultado: '' as ResultadoInventario | '',
    es_externo: false
  };

  readonly resultadosInventario: Array<{ valor: ResultadoInventario; etiqueta: string }> = [
    { valor: 'con_novedades', etiqueta: 'Con novedades' },
    { valor: 'sin_novedades', etiqueta: 'Sin novedades (coincide maestro)' },
    { valor: 'externo', etiqueta: 'Activo externo (no en Indigo)' }
  ];
  resultadosInventarioOpciones: Array<{ label: string; value: ResultadoInventario }> =
    this.resultadosInventario.map(r => ({ label: r.etiqueta, value: r.valor }));

  exportando = false;
  exportandoActivo = false;
  expandidas: Record<number, boolean> = {};

  // =========================================================================
  // INIT
  // =========================================================================

  ngOnInit(): void {
    this.cargarOpciones();
    this.cargarLocalizaciones();
    this.cargarTrazabilidad();
    this.cargarResumen();
  }

  // =========================================================================
  // PESTAÑAS
  // =========================================================================

  onTabChange(evento: { index: number }): void {
    this.tabActiva = evento.index;
    if (evento.index === TAB_TRAZABILIDAD) {
      this.cargarTrazabilidad();
      this.cargarResumen();
    }
  }

  irATrazabilidad(): void {
    this.tabActiva = TAB_TRAZABILIDAD;
    this.cargarTrazabilidad();
    this.cargarResumen();
  }

  // =========================================================================
  // BÚSQUEDA EN EL MAESTRO
  // =========================================================================

  get puedeBuscar(): boolean {
    return this.valorBusqueda.trim().length >= 2 && !this.buscando;
  }

  get etiquetaCampoActual(): string {
    return this.camposBusqueda.find(c => c.valor === this.campoBusqueda)?.etiqueta.toLowerCase() ?? 'valor';
  }

  consultar(): void {
    if (!this.puedeBuscar) return;

    this.buscando = true;
    this.resultados = [];
    this.activo = null;
    this.historial = [];
    this.sinResultados = false;
    this.mostrarFormExterno = false;
    this.alertaPeriodicidad = null;

    this.service.buscar(this.campoBusqueda, this.valorBusqueda.trim()).subscribe({
      next: respuesta => {
        this.buscando = false;
        const encontrados = respuesta.data ?? [];

        if (encontrados.length === 0) {
          this.sinResultados = true;
          this.messages.add({
            severity: 'warn',
            summary: 'Sin resultados',
            detail: `No se encontró ningún activo con ese ${this.etiquetaCampoActual}.`,
            life: 5000
          });
          return;
        }

        if (encontrados.length === 1) {
          this.seleccionar(encontrados[0]);
        } else {
          this.resultados = encontrados;
          this.messages.add({
            severity: 'info',
            summary: `${encontrados.length} activos encontrados`,
            detail: 'Seleccione el activo que va a inventariar.',
            life: 4000
          });
        }
      },
      error: (error: HttpErrorResponse) => {
        this.buscando = false;
        this.messages.add({
          severity: 'error',
          summary: 'Error consultando',
          detail: error.error?.message ?? 'No se pudo consultar el maestro de activos.',
          life: 7000
        });
      }
    });
  }

  seleccionar(activo: ActivoFijo): void {
    this.activo = activo;
    this.resultados = [];
    this.formulario = { ...FORMULARIO_VACIO };
    this.alertaPeriodicidad = null;
    this.validacionPeriodicidad = null;

    if (activo.placa) {
      this.cargarHistorialActivo(activo.placa);
      if (this.formulario.tipo_inventario_id) {
        this.verificarPeriodicidad(activo.placa, this.formulario.tipo_inventario_id);
      }
    }
  }

  regresar(): void {
    this.activo = null;
    this.resultados = [];
    this.historial = [];
    this.valorBusqueda = '';
    this.formulario = { ...FORMULARIO_VACIO };
    this.sinResultados = false;
    this.mostrarFormExterno = false;
    this.formularioExterno = { ...FORMULARIO_EXTERNO_VACIO };
    this.alertaPeriodicidad = null;
    this.validacionPeriodicidad = null;
  }

  onTipoInventarioChange(): void {
    this.alertaPeriodicidad = null;
    this.validacionPeriodicidad = null;

    if (this.activo?.placa && this.formulario.tipo_inventario_id) {
      this.verificarPeriodicidad(this.activo.placa, this.formulario.tipo_inventario_id);
    }
  }

  private verificarPeriodicidad(placa: string, tipoInventarioId: number): void {
    this.validandoPeriodicidad = true;
    this.service.validarPeriodicidad(placa, tipoInventarioId).subscribe({
      next: respuesta => {
        this.validandoPeriodicidad = false;
        this.validacionPeriodicidad = respuesta.data ?? null;
        if (respuesta.data && !respuesta.data.puede_registrar) {
          this.alertaPeriodicidad = respuesta.data.mensaje ?? 'Ya existe un registro en este período.';
        }
      },
      error: () => {
        this.validandoPeriodicidad = false;
        this.validacionPeriodicidad = null;
      }
    });
  }

  // =========================================================================
  // REGISTRO DE NOVEDAD
  // =========================================================================

  /** Campos de novedad con valor (excluye tipo_inventario_id y observacion). */
  get novedadesLlenas(): number {
    const excluir = new Set(['tipo_inventario_id', 'observacion']);
    return Object.entries(this.formulario)
      .filter(([clave]) => !excluir.has(clave))
      .filter(([, valor]) => String(valor ?? '').trim() !== '').length;
  }

  get puedeRegistrar(): boolean {
    if (!this.activo || this.guardando) return false;
    if (!this.formulario.tipo_inventario_id) return false;
    if (this.validacionPeriodicidad && !this.validacionPeriodicidad.puede_registrar) return false;
    return this.novedadesLlenas > 0 || this.formulario.observacion.trim() !== '';
  }

  get tipoInventarioSeleccionado(): TipoInventario | null {
    if (!this.formulario.tipo_inventario_id) return null;
    return this.tiposInventario.find(t => t.id === this.formulario.tipo_inventario_id) ?? null;
  }

  registrar(): void {
    if (!this.puedeRegistrar || !this.activo?.placa) return;

    this.guardando = true;
    this.alertaPeriodicidad = null;

    const payload: NovedadActivoPayload = {
      placa: this.activo.placa,
      tipo_inventario_id: this.formulario.tipo_inventario_id!
    };

    // Solo campos con valor, sin estado (readonly)
    const camposNovedad: Array<keyof FormularioNovedad> = [
      'novedad_placa', 'novedad_articulo', 'novedad_marca', 'novedad_modelo',
      'novedad_serie', 'novedad_responsable', 'novedad_localizacion',
      'novedad_sucursal', 'novedad_estado_fisico', 'observacion'
    ];

    camposNovedad.forEach(clave => {
      const valor = String(this.formulario[clave] ?? '').trim();
      if (valor !== '') {
        (payload as unknown as Record<string, unknown>)[clave] = valor;
      }
    });

    const placaGuardada = this.activo.placa;

    this.service.registrarNovedad(payload).subscribe({
      next: respuesta => {
        this.guardando = false;
        this.messages.add({
          severity: 'success',
          summary: 'Novedad registrada',
          detail: `Se guardaron ${respuesta.data.total_cambios} cambio(s) para la placa ${placaGuardada}.`,
          life: 6000
        });
        this.formulario = { ...FORMULARIO_VACIO };
        this.cargarHistorialActivo(placaGuardada);
        this.cargarTrazabilidad();
        this.cargarResumen();
      },
      error: (error: HttpErrorResponse) => {
        this.guardando = false;
        // 409 = conflicto de periodicidad
        if (error.status === 409) {
          this.alertaPeriodicidad = error.error?.message ?? 'Ya existe un registro para este activo en el período.';
        } else {
          this.messages.add({
            severity: 'error',
            summary: 'No se pudo registrar',
            detail: error.error?.message ?? 'Error guardando la novedad.',
            life: 7000
          });
        }
      }
    });
  }

  // =========================================================================
  // HISTORIAL DEL ACTIVO SELECCIONADO
  // =========================================================================

  private cargarHistorialActivo(placa: string): void {
    this.cargandoHistorial = true;
    this.service.historial(placa).subscribe({
      next: respuesta => {
        this.cargandoHistorial = false;
        this.historial = respuesta.data ?? [];
      },
      error: () => {
        this.cargandoHistorial = false;
        this.historial = [];
      }
    });
  }

  /**
   * Carga opciones del backend: estados_fisicos + tipos_inventario activos.
   * El estado del activo ya no se carga porque es solo lectura desde Fabric.
   */
  private cargarOpciones(): void {
    this.service.opciones().subscribe({
      next: respuesta => {
        this.estadosFisicos = respuesta.data?.estados_fisicos ?? [];
        this.tiposInventario = respuesta.data?.tipos_inventario ?? [];
        this.tiposInventarioOpciones = this.tiposInventario.map(t => ({
          label: `${t.nombre} (${t.periodicidad_nombre})`,
          value: t.id
        }));
      },
      error: () => {
        this.estadosFisicos = ['En buen estado', 'Para Reparacion', 'Dar de baja'];
        this.tiposInventario = [];
        this.tiposInventarioOpciones = [];
      }
    });
  }

  private cargarLocalizaciones(busqueda = ''): void {
    this.service.localizaciones(busqueda, 300).subscribe({
      next: respuesta => {
        this.localizacionesOpciones = (respuesta.data ?? []).map(item => ({
          label: item.valor,
          value: item.valor
        }));
      },
      error: () => {
        this.localizacionesOpciones = [];
      }
    });
  }

  buscarLocalizaciones(evento: { filter?: string }): void {
    this.cargarLocalizaciones(evento.filter ?? '');
  }

  buscarResponsables(evento: { query: string }): void {
    const busqueda = evento.query ?? '';
    if (busqueda.trim().length < 2) {
      this.responsablesSugerencias = [];
      return;
    }

    this.service.responsables(busqueda, 30).subscribe({
      next: respuesta => {
        this.responsablesSugerencias = (respuesta.data ?? []).map(item => item.valor);
      },
      error: () => {
        this.responsablesSugerencias = [];
      }
    });
  }

  // =========================================================================
  // REGISTRO DE ACTIVO EXTERNO
  // =========================================================================

  abrirFormExterno(): void {
    this.mostrarFormExterno = true;
    this.formularioExterno = { ...FORMULARIO_EXTERNO_VACIO };
    if (this.campoBusqueda === 'placa' && this.valorBusqueda.trim()) {
      this.formularioExterno.placa = this.valorBusqueda.trim();
    }
  }

  cerrarFormExterno(): void {
    this.mostrarFormExterno = false;
    this.formularioExterno = { ...FORMULARIO_EXTERNO_VACIO };
  }

  get puedeRegistrarExterno(): boolean {
    return this.formularioExterno.placa.trim().length >= 2 &&
      this.formularioExterno.tipo_inventario_id !== null &&
      !this.guardandoExterno;
  }

  registrarExterno(): void {
    if (!this.puedeRegistrarExterno) return;

    this.guardandoExterno = true;

    const payload: NovedadExternaPayload = {
      placa: this.formularioExterno.placa.trim(),
      tipo_inventario_id: this.formularioExterno.tipo_inventario_id!
    };

    const camposExterno: Array<keyof Omit<FormularioExterno, 'placa' | 'tipo_inventario_id'>> = [
      'serie', 'articulo_nombre', 'marca', 'modelo',
      'responsable', 'localizacion', 'sucursal', 'estado_fisico', 'observacion'
    ];

    camposExterno.forEach(clave => {
      const valor = String(this.formularioExterno[clave] ?? '').trim();
      if (valor !== '') {
        (payload as unknown as Record<string, unknown>)[clave] = valor;
      }
    });

    this.service.registrarNovedadExterna(payload).subscribe({
      next: respuesta => {
        this.guardandoExterno = false;
        this.messages.add({
          severity: 'success',
          summary: 'Activo externo registrado',
          detail: `Se registró el activo con placa ${respuesta.data.placa} fuera del maestro.`,
          life: 6000
        });
        this.cerrarFormExterno();
        this.sinResultados = false;
        this.cargarTrazabilidad();
        this.cargarResumen();
      },
      error: (error: HttpErrorResponse) => {
        this.guardandoExterno = false;
        const msg = error.status === 409
          ? error.error?.message
          : (error.error?.message ?? 'Error registrando el activo externo.');
        this.messages.add({
          severity: error.status === 409 ? 'warn' : 'error',
          summary: error.status === 409 ? 'Restricción de periodicidad' : 'No se pudo registrar',
          detail: msg,
          life: 7000
        });
      }
    });
  }

  // =========================================================================
  // EXPORTAR EXCEL
  // =========================================================================

  /** Compatibilidad: botón "Excel". */
  exportarExcel(): void {
    this.exportar('excel');
  }

  /** Exporta el reporte consolidado en el formato indicado (Req. 7). */
  exportar(formato: 'excel' | 'csv' | 'pdf'): void {
    this.exportando = true;

    const extension = formato === 'excel' ? 'xlsx' : formato;
    const etiqueta = formato === 'excel' ? 'Excel' : formato.toUpperCase();

    this.service.exportar(formato, {
      tipo_inventario_id: this.filtros.tipo_inventario_id ?? undefined,
      placa: this.filtros.placa || undefined,
      estado_fisico: this.filtros.estado_fisico || undefined,
      desde: this.filtros.desde || undefined,
      hasta: this.filtros.hasta || undefined,
      responsable: this.filtros.responsable || undefined,
      localizacion: this.filtros.localizacion || undefined,
      resultado: this.filtros.resultado || undefined,
      es_externo: this.filtros.es_externo || undefined
    }).subscribe({
      next: (blob: Blob) => {
        this.exportando = false;
        const url = window.URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = url;
        const prefijo = formato === 'excel' ? 'historial_activos' : 'reporte_inventario';
        enlace.download = `${prefijo}_${new Date().toISOString().slice(0, 10)}.${extension}`;
        enlace.click();
        window.URL.revokeObjectURL(url);
        this.messages.add({
          severity: 'success',
          summary: 'Exportación completada',
          detail: `El archivo ${etiqueta} se descargó correctamente.`,
          life: 4000
        });
      },
      error: (error: HttpErrorResponse) => {
        this.exportando = false;
        this.messages.add({
          severity: 'error',
          summary: 'Error exportando',
          detail: error.error?.message ?? `No se pudo generar el archivo ${etiqueta}.`,
          life: 7000
        });
      }
    });
  }

  /** Descarga la línea de tiempo (historial) del activo actualmente seleccionado. */
  exportarHistorialDeActivo(): void {
    if (!this.activo?.placa || this.exportandoActivo) return;

    this.exportandoActivo = true;
    const placa = this.activo.placa;

    this.service.exportarHistorialActivo(placa).subscribe({
      next: (blob: Blob) => {
        this.exportandoActivo = false;
        const url = window.URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = `historial_activo_${placa}.xlsx`;
        enlace.click();
        window.URL.revokeObjectURL(url);
        this.messages.add({
          severity: 'success',
          summary: 'Historial exportado',
          detail: `Se descargó la línea de tiempo del activo ${placa}.`,
          life: 4000
        });
      },
      error: (error: HttpErrorResponse) => {
        this.exportandoActivo = false;
        this.messages.add({
          severity: 'error',
          summary: 'Error exportando',
          detail: error.error?.message ?? 'No se pudo generar el historial del activo.',
          life: 7000
        });
      }
    });
  }

  // =========================================================================
  // TRAZABILIDAD GENERAL
  // =========================================================================

  cargarTrazabilidad(): void {
    this.cargandoTraza = true;
    const pagina = Math.floor(this.primeraFila / this.filasPorPagina) + 1;

    this.service.trazabilidad({
      placa: this.filtros.placa || undefined,
      estado_fisico: this.filtros.estado_fisico || undefined,
      desde: this.filtros.desde || undefined,
      hasta: this.filtros.hasta || undefined,
      tipo_inventario_id: this.filtros.tipo_inventario_id ?? undefined,
      responsable: this.filtros.responsable || undefined,
      localizacion: this.filtros.localizacion || undefined,
      resultado: this.filtros.resultado || undefined,
      es_externo: this.filtros.es_externo || undefined,
      per_page: this.filasPorPagina,
      page: pagina
    }).subscribe({
      next: respuesta => {
        this.cargandoTraza = false;
        this.registros = respuesta.data ?? [];
        this.totalRegistros = respuesta.meta?.total ?? 0;
      },
      error: (error: HttpErrorResponse) => {
        this.cargandoTraza = false;
        this.registros = [];
        this.messages.add({
          severity: 'error',
          summary: 'Error',
          detail: error.error?.message ?? 'No se pudo cargar la trazabilidad.',
          life: 6000
        });
      }
    });
  }

  private cargarResumen(): void {
    this.service.resumen().subscribe({
      next: respuesta => (this.resumen = respuesta.data),
      error: () => (this.resumen = null)
    });
  }

  onPageChange(evento: { first: number; rows: number }): void {
    this.primeraFila = evento.first;
    this.filasPorPagina = evento.rows;
    this.cargarTrazabilidad();
  }

  aplicarFiltros(): void {
    this.primeraFila = 0;
    this.cargarTrazabilidad();
  }

  limpiarFiltros(): void {
    this.filtros = {
      placa: '',
      estado_fisico: '',
      desde: '',
      hasta: '',
      tipo_inventario_id: null,
      responsable: '',
      localizacion: '',
      resultado: '',
      es_externo: false
    };
    this.primeraFila = 0;
    this.cargarTrazabilidad();
  }

  get hayFiltrosActivos(): boolean {
    return this.filtros.placa !== '' ||
      this.filtros.estado_fisico !== '' ||
      this.filtros.desde !== '' ||
      this.filtros.hasta !== '' ||
      this.filtros.tipo_inventario_id !== null ||
      this.filtros.responsable !== '' ||
      this.filtros.localizacion !== '' ||
      this.filtros.resultado !== '' ||
      this.filtros.es_externo;
  }

  alternar(id: number): void {
    this.expandidas[id] = !this.expandidas[id];
  }

  verTrazabilidadDeActivo(): void {
    if (!this.activo?.placa) return;
    this.filtros = {
      placa: this.activo.placa,
      estado_fisico: '',
      desde: '',
      hasta: '',
      tipo_inventario_id: null,
      responsable: '',
      localizacion: '',
      resultado: '',
      es_externo: false
    };
    this.primeraFila = 0;
    this.irATrazabilidad();
  }

  // =========================================================================
  // HELPERS DE VISTA
  // =========================================================================

  severidadEstadoFisico(estado: string | null): 'success' | 'warn' | 'danger' | 'info' {
    switch (estado) {
      case 'En buen estado': return 'success';
      case 'Para Reparacion': return 'warn';
      case 'Dar de baja': return 'danger';
      default: return 'info';
    }
  }

  valor(dato: string | null | undefined): string {
    return dato && dato.trim() !== '' ? dato : '—';
  }

  nombreTipoInventario(registro: TrazabilidadActivo): string {
    return registro.tipo_inventario?.nombre ?? '—';
  }
}
