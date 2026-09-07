import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Location } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { DropdownModule } from 'primeng/dropdown';
import { MultiSelectModule } from 'primeng/multiselect';

import { EsquemaCatalogo, VistasService, VistaBi } from '../../services/vistas.service';
import { isVistaEnMantenimiento } from '../../helpers/fabric-error.helper';

import { PermissionService } from '../../../../core/services/permission.service';
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';

/** Ruta fullscreen (fuera del layout) que renderiza la vista en modo Excel. */
const VISTA_EXCEL_PATH = '/inteligenciaNegocios/viewVistaExcel';

export interface EsquemaOption {
  code: string;
  label: string;
}

export interface GrupoVistas {
  key: string;
  schema: string;
  codigo: string;
  nombre: string;
  expandido: boolean;
  vistas: VistaBi[];
  esDelegacion?: boolean;
  ocultarCodigo?: boolean;
}

@Component({
  selector: 'app-listado-vistas',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ButtonModule,
    ToastModule,
    TableModule,
    TagModule,
    SkeletonModule,
    InputTextModule,
    TooltipModule,
    DropdownModule,
    MultiSelectModule,
    HasPermissionDirective
  ],
  providers: [MessageService],
  templateUrl: './listadoVistas.component.html',
  styleUrl: './listadoVistas.component.css'
})
export class ListadoVistasComponent implements OnInit {
  isLoadingContext = false;
  isLoadingVistas = false;
  isLaunchingDesktop = false;
  searchTerm = '';
  vistas: VistaBi[] = [];
  departamento: string | null = null;
  esquemasCatalogo: EsquemaCatalogo[] = [];
  esquemaOptions: EsquemaOption[] = [];
  esquemasSeleccionados: string[] = [];
  pageTitle = 'Reportes e Información';
  pageSubtitle = 'Consulta de fuentes de datos disponibles según tus permisos';
  listPath = '/inteligenciaNegocios/vistas';
  vistaAgrupada = false;
  tieneVistasDelegadas = false;

  private grupoTipo?: number;
  private vistasPorEsquema = new Map<string, VistaBi[]>();
  private gruposExpandidos = new Set<string>();

  /** Filas conocidas por vista ("schema.view" en minúsculas). */
  private filasPorVista = new Map<string, number>();
  /** Vistas que el backend marca como demasiado grandes para el navegador. */
  private vistasSoloDesktop = new Set<string>();
  /** Se sobrescribe con el umbral que reporta el backend. */
  private maxFilasWeb = 250000;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private vistasService: VistasService,
    private messageService: MessageService,
    public permissionService: PermissionService
  ) {}

  ngOnInit(): void {
    const data = this.route.snapshot.data;
    this.grupoTipo = data['grupoTipo'] as number | undefined;
    this.vistaAgrupada = !!data['vistaAgrupada'];
    this.listPath = (data['listPath'] as string) ?? this.listPath;
    this.pageTitle = (data['pageTitle'] as string) ?? this.pageTitle;
    this.pageSubtitle = (data['pageSubtitle'] as string) ?? this.pageSubtitle;
    this.cargarContexto();
    this.cargarFilasPorVista();
  }

  /**
   * Tamaño de cada vista para decidir navegador vs JadeOne Desktop. Si falla,
   * el listado sigue funcionando y todas las vistas se abren en el navegador.
   */
  private cargarFilasPorVista(): void {
    this.vistasService.getRowCounts().subscribe({
      next: res => {
        if (res.threshold > 0) {
          this.maxFilasWeb = res.threshold;
        }
        this.filasPorVista = new Map(Object.entries(res.counts ?? {}));
        this.vistasSoloDesktop = new Set(res.desktop_only ?? []);
      },
      error: () => {}
    });
  }

  permissionDesktop(): boolean {
    return this.permissionService.hasPermission('BI-VISTAS-DESKTOP');
  }

  get isLoading(): boolean {
    return this.isLoadingContext || this.isLoadingVistas;
  }

  get totalVistas(): number {
    return this.vistas.length;
  }

  get gruposVistas(): GrupoVistas[] {
    if (this.vistaAgrupada && this.tieneVistasDelegadas) {
      return [
        ...this.buildGruposPorEmpresaDelegada(),
        ...this.buildGruposPorEsquema(true)
      ];
    }
    return this.buildGruposPorEsquema(false);
  }

  get resumenGruposLabel(): string {
    return this.tieneVistasDelegadas ? 'empresa(s)' : 'categoría(s)';
  }

  get tituloSeccionGrupos(): string {
    return this.tieneVistasDelegadas ? 'Vistas delegadas por empresa' : 'Vistas por categoría';
  }

  private buildGruposPorEsquema(soloDirectos = false): GrupoVistas[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.esquemasCatalogo
      .filter(esquema => !soloDirectos || !esquema.es_delegado)
      .map(esquema => {
        const vistasGrupo = this.filtrarVistasGrupo(esquema.schema, term, esquema.nombre);

        return {
          key: esquema.schema,
          schema: esquema.schema,
          codigo: esquema.codigo,
          nombre: esquema.nombre,
          expandido: this.estaGrupoExpandido(esquema.schema, term, vistasGrupo.length > 0),
          vistas: vistasGrupo,
          ocultarCodigo: false
        };
      })
      .filter(grupo => grupo.vistas.length > 0 || (!term && this.vistasPorEsquema.has(grupo.schema)));
  }

  private buildGruposPorEmpresaDelegada(): GrupoVistas[] {
    const term = this.searchTerm.trim().toLowerCase();
    const porEmpresa = new Map<number, GrupoVistas>();

    for (const esquema of this.esquemasCatalogo.filter(e => e.es_delegado)) {
      const vistasGrupo = this.filtrarVistasGrupo(esquema.schema, term, esquema.nombre, esquema.empresa_nombre);
      if (vistasGrupo.length === 0 && term) {
        continue;
      }

      const empresaId = esquema.empresa_id ?? 0;
      const key = `empresa-${empresaId}`;

      if (!porEmpresa.has(empresaId)) {
        porEmpresa.set(empresaId, {
          key,
          schema: esquema.schema,
          codigo: '',
          nombre: esquema.empresa_nombre ?? 'Empresa delegada',
          expandido: this.estaGrupoExpandido(key, term, vistasGrupo.length > 0),
          vistas: [],
          esDelegacion: true,
          ocultarCodigo: true
        });
      }

      const grupo = porEmpresa.get(empresaId)!;
      grupo.vistas.push(...vistasGrupo);
      grupo.expandido = this.estaGrupoExpandido(key, term, grupo.vistas.length > 0);
    }

    return Array.from(porEmpresa.values())
      .filter(grupo => grupo.vistas.length > 0 || !term);
  }

  private filtrarVistasGrupo(
    schema: string,
    term: string,
    nombreEsquema: string,
    empresaNombre?: string
  ): VistaBi[] {
    return (this.vistasPorEsquema.get(schema) ?? []).filter(vista => {
      if (!term) {
        return true;
      }
      return (
        vista.nombre.toLowerCase().includes(term) ||
        vista.codigo.toLowerCase().includes(term) ||
        nombreEsquema.toLowerCase().includes(term) ||
        (vista.fuente ?? '').toLowerCase().includes(term) ||
        (vista.schemaDisplay ?? '').toLowerCase().includes(term) ||
        (empresaNombre ?? '').toLowerCase().includes(term)
      );
    });
  }

  cargarContexto(): void {
    this.isLoadingContext = true;

    this.vistasService.getContext(this.grupoTipo).subscribe({
      next: ctx => {
        this.departamento = ctx.departamento;
        this.esquemasCatalogo = ctx.esquemas_catalogo ?? [];
        this.tieneVistasDelegadas = !!ctx.tiene_vistas_delegadas;
        this.esquemaOptions = this.esquemasCatalogo.map(item => ({
          code: item.schema,
          label: item.nombre
        }));
        this.isLoadingContext = false;

        if (this.esquemaOptions.length === 0) {
          return;
        }

        this.esquemasSeleccionados = this.esquemaOptions.map(o => o.code);
        this.cargarVistasEsquema();
      },
      error: () => {
        this.departamento = null;
        this.esquemasCatalogo = [];
        this.esquemaOptions = [];
        this.isLoadingContext = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo cargar el contexto de permisos.',
          life: 6000
        });
      }
    });
  }

  onEsquemaChange(): void {
    this.searchTerm = '';
    this.vistas = [];

    if (!this.esquemasSeleccionados || this.esquemasSeleccionados.length === 0) {
      return;
    }

    this.cargarVistasEsquema();
  }

  cargarVistasEsquema(forceReload = false): void {
    if (!this.esquemasSeleccionados || this.esquemasSeleccionados.length === 0) {
      return;
    }

    this.isLoadingVistas = true;

    // Separar los esquemas que ya estan en cache de los que hay que pedir a Graph
    const pendientes: string[] = [];
    for (const schema of this.esquemasSeleccionados) {
      if (forceReload) this.vistasPorEsquema.delete(schema);
      if (!this.vistasPorEsquema.has(schema)) pendientes.push(schema);
    }

    // CONCURRENCIA LIMITADA: en vez de disparar N requests /views a la vez
    // (que represaba Graph con 90+ requests), cargar de a MAX_CONCURRENT.
    // Los esquemas ya cacheados no cuentan (resuelven al instante).
    const MAX_CONCURRENT = 3;

    const cargarUno = (schema: string): Promise<void> => {
      return new Promise((resolve) => {
        this.vistasService.getVistasPorEsquema(schema, forceReload, this.grupoTipo).subscribe({
          next: response => {
            const nombreEsquema = this.esquemasCatalogo.find(
              e => e.schema.toLowerCase() === schema.toLowerCase()
            )?.nombre;
            const vistas = (response.data ?? []).map(v => ({
              ...v,
              schemaDisplay: nombreEsquema ?? v.schemaDisplay
            }));
            this.vistasPorEsquema.set(schema, vistas);
            // Actualizar la grilla de forma incremental (el usuario ve vistas
            // apareciendo por esquema, no espera a que TODOS terminen)
            this.recomputarVistasVisibles();
            resolve();
          },
          error: () => {
            // Un esquema que falla no debe tumbar los demas
            this.vistasPorEsquema.set(schema, []);
            resolve();
          }
        });
      });
    };

    // Worker pool: procesa la cola de pendientes de a MAX_CONCURRENT
    const cola = [...pendientes];
    const workers: Promise<void>[] = [];

    const trabajar = async (): Promise<void> => {
      while (cola.length > 0) {
        const schema = cola.shift()!;
        await cargarUno(schema);
      }
    };

    for (let i = 0; i < Math.min(MAX_CONCURRENT, cola.length); i++) {
      workers.push(trabajar());
    }

    // Si todo estaba cacheado, mostrar de una
    if (pendientes.length === 0) {
      this.recomputarVistasVisibles();
      this.isLoadingVistas = false;
      return;
    }

    Promise.all(workers).then(() => {
      this.recomputarVistasVisibles();
      this.isLoadingVistas = false;
    });
  }

  /** Reconstruye this.vistas desde el cache por esquema (para render incremental). */
  private recomputarVistasVisibles(): void {
    const todas: VistaBi[] = [];
    for (const schema of this.esquemasSeleccionados) {
      const cached = this.vistasPorEsquema.get(schema);
      if (cached) todas.push(...cached);
    }
    this.vistas = todas;
  }

  actualizar(): void {
    if (this.esquemasSeleccionados.length > 0) {
      this.cargarVistasEsquema(true);
    } else {
      this.vistasPorEsquema.clear();
      this.cargarContexto();
    }
  }

  abrirVista(vista: VistaBi): void {
    if (isVistaEnMantenimiento(vista)) {
      this.messageService.add({
        severity: 'warn',
        summary: 'En mantenimiento',
        detail: 'Esta vista está en mantenimiento. Intente más tarde.',
        life: 4000
      });
      return;
    }

    if (!vista.estado) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Vista no visible',
        detail: 'Esta vista no está disponible para su sede.',
        life: 3000
      });
      return;
    }

    this.abrirEnDestinoSegunTamano(vista);
  }

  /**
   * Abre la vista en el modo "Actualizar como Excel" en una NUEVA PESTAÑA
   * (sin sidebar, pantalla completa), igual que el modo fullscreen.
   * Descarga el dataset completo vía export/parquet con virtual scroll.
   */
  abrirVistaRefresh(vista: VistaBi, event: Event): void {
    event.stopPropagation();

    if (isVistaEnMantenimiento(vista) || !vista.estado) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Vista no disponible',
        detail: 'Esta vista no está disponible para cargar en modo actualizar.',
        life: 3000
      });
      return;
    }

    this.abrirEnDestinoSegunTamano(vista);
  }

  /** Filas conocidas de la vista, o null si nunca se ha medido su parquet. */
  filasDeVista(vista: VistaBi): number | null {
    return this.filasPorVista.get(this.claveVista(vista)) ?? null;
  }

  esVistaPesada(vista: VistaBi): boolean {
    if (this.vistasSoloDesktop.has(this.claveVista(vista))) {
      return true;
    }
    const filas = this.filasDeVista(vista);
    return filas !== null && filas > this.maxFilasWeb;
  }

  tooltipVistaPesada(vista: VistaBi): string {
    const filas  = this.filasDeVista(vista);
    const limite = this.formatearFilas(this.maxFilasWeb);
    return filas !== null
      ? `${this.formatearFilas(filas)} filas: supera el límite de ${limite} del visor web y se abre en JadeOne Desktop.`
      : `Supera el límite de ${limite} filas del visor web y se abre en JadeOne Desktop.`;
  }

  private claveVista(vista: VistaBi): string {
    return `${vista.schema}.${vista.view_name}`.toLowerCase();
  }

  /**
   * El navegador no sostiene datasets grandes: por encima del umbral la vista
   * se abre en JadeOne Desktop. Sin conteo conocido se asume que cabe en la web.
   */
  private abrirEnDestinoSegunTamano(vista: VistaBi): void {
    if (!this.esVistaPesada(vista)) {
      this.abrirVistaExcelEnPestanaNueva(vista);
      return;
    }

    const filas   = this.filasDeVista(vista);
    const limite  = this.formatearFilas(this.maxFilasWeb);
    const detalle = filas !== null
      ? `La vista tiene ${this.formatearFilas(filas)} filas y supera el límite de ${limite} del visor web.`
      : `La vista supera el límite de ${limite} filas del visor web.`;

    if (!this.permissionDesktop()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Vista disponible solo en JadeOne Desktop',
        detail: `${detalle} Solicite acceso a JadeOne Desktop para consultarla.`,
        life: 9000
      });
      return;
    }

    this.messageService.add({
      severity: 'info',
      summary: 'Abriendo en JadeOne Desktop',
      detail: detalle,
      life: 7000
    });
    this.abrirVistaEscritorio(vista);
  }

  private formatearFilas(filas: number): string {
    return filas.toLocaleString('es-CO');
  }

  private abrirVistaExcelEnPestanaNueva(vista: VistaBi): void {
    const urlTree = this.router.createUrlTree([VISTA_EXCEL_PATH], {
      queryParams: { schema: vista.schema, viewName: vista.view_name }
    });
    const url     = this.router.serializeUrl(urlTree);
    const fullUrl = this.location.prepareExternalUrl(url);
    window.open(fullUrl, '_blank', 'noopener');
  }

  abrirVistaEscritorio(vista: VistaBi, event?: Event): void {
    event?.stopPropagation();

    if (isVistaEnMantenimiento(vista) || !vista.estado || this.isLaunchingDesktop) {
      return;
    }

    this.isLaunchingDesktop = true;
    this.vistasService.launchDesktop(vista.schema, vista.view_name, vista.nombre).subscribe({
      next: res => {
        if (!res.success || !res.protocol_url) {
          this.isLaunchingDesktop = false;
          this.messageService.add({
            severity: 'error',
            summary: 'No se pudo abrir el escritorio',
            detail: res.message ?? 'Intente de nuevo.',
            life: 5000
          });
          return;
        }

        const downloadUrl = res.download_url ?? this.vistasService.getDesktopDownloadUrl();
        this.vistasService.openDesktopProtocol(res.protocol_url, () => {
          this.messageService.add({
            severity: 'warn',
            summary: 'JadeOne Desktop no está instalado',
            detail: 'Se iniciará la descarga. Instale el .exe y vuelva a pulsar el botón.',
            life: 8000
          });
          window.open(downloadUrl, '_blank', 'noopener');
        });
        window.setTimeout(() => { this.isLaunchingDesktop = false; }, VistasService.DESKTOP_LAUNCH_WAIT_MS + 500);
      },
      error: err => {
        this.isLaunchingDesktop = false;
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo abrir el escritorio',
          detail: err?.error?.message ?? 'Sin permiso o error de red.',
          life: 5000
        });
      }
    });
  }

  toggleGrupo(key: string): void {
    if (this.gruposExpandidos.has(key)) {
      this.gruposExpandidos.delete(key);
    } else {
      this.gruposExpandidos.add(key);
    }
  }

  expandirTodos(): void {
    this.gruposVistas.forEach(g => this.gruposExpandidos.add(g.key));
  }

  colapsarTodos(): void {
    this.gruposExpandidos.clear();
  }

  estaGrupoExpandido(key: string, term: string, tieneResultados: boolean): boolean {
    if (term) {
      return tieneResultados;
    }
    return this.gruposExpandidos.has(key);
  }

  contarVisibles(grupo: GrupoVistas): number {
    return grupo.vistas.filter(v => v.estado && !isVistaEnMantenimiento(v)).length;
  }

  esEnMantenimiento(vista: VistaBi): boolean {
    return isVistaEnMantenimiento(vista);
  }

  get vistasFiltradas(): VistaBi[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      return this.vistas;
    }

    return this.vistas.filter(vista =>
      vista.nombre.toLowerCase().includes(term) ||
      vista.codigo.toLowerCase().includes(term) ||
      vista.schemaDisplay.toLowerCase().includes(term) ||
      (vista.fuente ?? '').toLowerCase().includes(term)
    );
  }

  limpiarBusqueda(): void {
    this.searchTerm = '';
  }
}
