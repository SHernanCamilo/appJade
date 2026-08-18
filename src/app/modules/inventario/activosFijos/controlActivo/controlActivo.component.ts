import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TabViewModule } from 'primeng/tabview';
import { MessageService } from 'primeng/api';

import {
  ActivoFijo,
  ActivosFijosService,
  CampoBusqueda,
  NovedadActivoPayload,
  NovedadExternaPayload,
  ResumenTrazabilidad,
  TrazabilidadActivo
} from '../services/activos-fijos.service';

/** Campos de novedad que el inventariador puede reportar. */
interface FormularioNovedad {
  novedad_placa: string;
  novedad_estado: string;
  novedad_articulo: string;
  novedad_marca: string;
  novedad_modelo: string;
  novedad_serie: string;
  novedad_responsable: string;
  novedad_localizacion: string;
  novedad_tipo_inventario: string;
  novedad_sucursal: string;
  novedad_estado_fisico: string;
  novedad_unidad_funcional: string;
  observacion: string;
}

/** Formulario para registrar activo externo (no está en el maestro). */
interface FormularioExterno {
  placa: string;
  serie: string;
  articulo_nombre: string;
  marca: string;
  modelo: string;
  responsable: string;
  localizacion: string;
  sucursal: string;
  estado_fisico: string;
  observacion: string;
  unidad_funcional: string;
}

const FORMULARIO_VACIO: FormularioNovedad = {
  novedad_placa: '',
  novedad_estado: '',
  novedad_articulo: '',
  novedad_marca: '',
  novedad_modelo: '',
  novedad_serie: '',
  novedad_responsable: '',
  novedad_localizacion: '',
  novedad_tipo_inventario: '',
  novedad_sucursal: '',
  novedad_estado_fisico: '',
  novedad_unidad_funcional: '',
  observacion: ''
};

const FORMULARIO_EXTERNO_VACIO: FormularioExterno = {
  placa: '',
  serie: '',
  articulo_nombre: '',
  marca: '',
  modelo: '',
  responsable: '',
  localizacion: '',
  sucursal: '',
  estado_fisico: '',
  observacion: '',
  unidad_funcional: ''
};

/** Índices de las pestañas. */
const TAB_REGISTRAR = 0;
const TAB_TRAZABILIDAD = 1;

/**
 * Control de Activos Fijos — módulo único con dos pestañas.
 *
 *   Registro     → busca el activo en el maestro de Indigo (vista de Fabric),
 *                  muestra sus datos en solo lectura y permite reportar las
 *                  diferencias encontradas en sitio. Incluye el historial del
 *                  activo que se está inventariando.
 *
 *   Trazabilidad → listado de todas las tomas registradas, con indicadores y
 *                  filtros por placa, estado físico y rango de fechas.
 *
 * Se unificaron en un solo componente para que el inventariador registre y
 * verifique sin cambiar de página: al guardar una novedad se salta a la
 * pestaña de trazabilidad ya recargada.
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
    TabViewModule
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

  /** Resultados cuando la búsqueda devuelve más de un activo. */
  resultados: ActivoFijo[] = [];

  activo: ActivoFijo | null = null;
  historial: TrazabilidadActivo[] = [];
  cargandoHistorial = false;

  formulario: FormularioNovedad = { ...FORMULARIO_VACIO };
  guardando = false;

  estados: string[] = [];
  estadosFisicos: string[] = [];

  /** Unidades funcionales cargadas del backend. */
  unidadesFuncionales: string[] = [];

  /** Centros de costo desde Fabric (cp.VW_Payroll_UnidadFuncionales_CC) */
  centrosCosto: { code: string; unidad_funcional: string }[] = [];

  /** Empleados activos para el select de responsable */
  empleados: { documento: string; nombre: string }[] = [];
  buscandoEmpleados = false;

  /** Controla si se muestra el formulario de activo externo. */
  mostrarFormExterno = false;
  formularioExterno: FormularioExterno = { ...FORMULARIO_EXTERNO_VACIO };
  guardandoExterno = false;

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

  filtros = { placa: '', estado_fisico: '', desde: '', hasta: '', unidad_funcional: '', es_externo: false };

  /** Exportando Excel. */
  exportando = false;

  /** Filas expandidas en la tabla de trazabilidad. */
  expandidas: Record<number, boolean> = {};

  ngOnInit(): void {
    this.cargarOpciones();
    this.cargarUnidadesFuncionales();
    this.cargarCentrosCosto();
    this.cargarTrazabilidad();
    this.cargarResumen();
  }

  // =========================================================================
  // PESTAÑAS
  // =========================================================================

  onTabChange(evento: { index: number }): void {
    this.tabActiva = evento.index;

    // Al entrar a trazabilidad se recarga para reflejar lo recién guardado
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
    if (!this.puedeBuscar) {
      return;
    }

    this.buscando = true;
    this.resultados = [];
    this.activo = null;
    this.historial = [];
    this.sinResultados = false;
    this.mostrarFormExterno = false;

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

        // Un solo resultado: abrir directo. Varios: dejar elegir.
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

    if (activo.placa) {
      this.cargarHistorialActivo(activo.placa);
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
  }

  // =========================================================================
  // REGISTRO DE NOVEDAD
  // =========================================================================

  /** Cuántos campos de novedad tienen valor (sin contar la observación). */
  get novedadesLlenas(): number {
    return Object.entries(this.formulario)
      .filter(([clave]) => clave !== 'observacion')
      .filter(([, valor]) => valor.trim() !== '').length;
  }

  get puedeRegistrar(): boolean {
    if (!this.activo || this.guardando) {
      return false;
    }
    return this.novedadesLlenas > 0 || this.formulario.observacion.trim() !== '';
  }

  registrar(): void {
    if (!this.puedeRegistrar || !this.activo?.placa) {
      return;
    }

    this.guardando = true;

    const payload: NovedadActivoPayload = { placa: this.activo.placa };

    // Solo se envían los campos con valor: ausente significa "sin novedad"
    (Object.keys(this.formulario) as Array<keyof FormularioNovedad>).forEach(clave => {
      const valor = this.formulario[clave].trim();
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

        // Refrescar la otra pestaña para que el registro ya aparezca allí
        this.cargarTrazabilidad();
        this.cargarResumen();
      },
      error: (error: HttpErrorResponse) => {
        this.guardando = false;
        this.messages.add({
          severity: 'error',
          summary: 'No se pudo registrar',
          detail: error.error?.message ?? 'Error guardando la novedad.',
          life: 7000
        });
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

  private cargarOpciones(): void {
    this.service.opciones().subscribe({
      next: respuesta => {
        this.estados = respuesta.data?.estados ?? [];
        this.estadosFisicos = respuesta.data?.estados_fisicos ?? [];
      },
      error: () => {
        // Fallback: el formulario sigue usable con los valores conocidos
        this.estados = ['Activo', 'Inactivo'];
        this.estadosFisicos = ['En buen estado', 'Para Reparacion', 'Dar de baja'];
      }
    });
  }

  private cargarUnidadesFuncionales(): void {
    this.service.unidadesFuncionales().subscribe({
      next: respuesta => {
        this.unidadesFuncionales = (respuesta.data ?? []).map(uf => uf.valor);
      },
      error: () => {
        this.unidadesFuncionales = [];
      }
    });
  }

  private cargarCentrosCosto(): void {
    this.service.centrosCosto().subscribe({
      next: respuesta => {
        this.centrosCosto = respuesta.data ?? [];
      },
      error: () => {
        this.centrosCosto = [];
      }
    });
  }

  buscarEmpleados(busqueda: string): void {
    if (busqueda.trim().length < 3) {
      return;
    }
    this.buscandoEmpleados = true;
    this.service.empleados(busqueda, 30).subscribe({
      next: respuesta => {
        this.buscandoEmpleados = false;
        this.empleados = respuesta.data ?? [];
      },
      error: () => {
        this.buscandoEmpleados = false;
        this.empleados = [];
      }
    });
  }

  // =========================================================================
  // REGISTRO DE ACTIVO EXTERNO (NO ESTÁ EN EL MAESTRO)
  // =========================================================================

  abrirFormExterno(): void {
    this.mostrarFormExterno = true;
    this.formularioExterno = { ...FORMULARIO_EXTERNO_VACIO };
    // Pre-llenar la placa con lo que buscó el usuario si el campo era 'placa'
    if (this.campoBusqueda === 'placa' && this.valorBusqueda.trim()) {
      this.formularioExterno.placa = this.valorBusqueda.trim();
    }
  }

  cerrarFormExterno(): void {
    this.mostrarFormExterno = false;
    this.formularioExterno = { ...FORMULARIO_EXTERNO_VACIO };
  }

  get puedeRegistrarExterno(): boolean {
    return this.formularioExterno.placa.trim().length >= 2 && !this.guardandoExterno;
  }

  registrarExterno(): void {
    if (!this.puedeRegistrarExterno) {
      return;
    }

    this.guardandoExterno = true;

    const payload: NovedadExternaPayload = { placa: this.formularioExterno.placa.trim() };

    // Solo se envían los campos con valor
    (Object.keys(this.formularioExterno) as Array<keyof FormularioExterno>).forEach(clave => {
      if (clave === 'placa') return;
      const valor = this.formularioExterno[clave].trim();
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
        this.messages.add({
          severity: 'error',
          summary: 'No se pudo registrar',
          detail: error.error?.message ?? 'Error registrando el activo externo.',
          life: 7000
        });
      }
    });
  }

  // =========================================================================
  // EXPORTAR EXCEL
  // =========================================================================

  exportarExcel(): void {
    this.exportando = true;

    this.service.exportarExcel({
      placa: this.filtros.placa || undefined,
      estado_fisico: this.filtros.estado_fisico || undefined,
      desde: this.filtros.desde || undefined,
      hasta: this.filtros.hasta || undefined,
      unidad_funcional: this.filtros.unidad_funcional || undefined,
      es_externo: this.filtros.es_externo || undefined
    }).subscribe({
      next: (blob: Blob) => {
        this.exportando = false;
        const url = window.URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = `activos_fijos_${new Date().toISOString().slice(0, 10)}.xlsx`;
        enlace.click();
        window.URL.revokeObjectURL(url);
        this.messages.add({
          severity: 'success',
          summary: 'Exportación completada',
          detail: 'El archivo Excel se descargó correctamente.',
          life: 4000
        });
      },
      error: (error: HttpErrorResponse) => {
        this.exportando = false;
        this.messages.add({
          severity: 'error',
          summary: 'Error exportando',
          detail: error.error?.message ?? 'No se pudo generar el archivo Excel.',
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
      unidad_funcional: this.filtros.unidad_funcional || undefined,
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
    this.filtros = { placa: '', estado_fisico: '', desde: '', hasta: '', unidad_funcional: '', es_externo: false };
    this.primeraFila = 0;
    this.cargarTrazabilidad();
  }

  get hayFiltrosActivos(): boolean {
    return this.filtros.placa !== '' ||
      this.filtros.estado_fisico !== '' ||
      this.filtros.desde !== '' ||
      this.filtros.hasta !== '' ||
      this.filtros.unidad_funcional !== '' ||
      this.filtros.es_externo;
  }

  alternar(id: number): void {
    this.expandidas[id] = !this.expandidas[id];
  }

  /** Abre la trazabilidad filtrada por la placa que se está inventariando. */
  verTrazabilidadDeActivo(): void {
    if (!this.activo?.placa) {
      return;
    }
    this.filtros = { placa: this.activo.placa, estado_fisico: '', desde: '', hasta: '', unidad_funcional: '', es_externo: false };
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

  /** Muestra un guion cuando el maestro no trae el dato. */
  valor(dato: string | null | undefined): string {
    return dato && dato.trim() !== '' ? dato : '—';
  }
}
