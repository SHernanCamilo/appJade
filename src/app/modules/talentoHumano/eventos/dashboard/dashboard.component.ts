import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject, debounceTime, distinctUntilChanged, forkJoin, of, switchMap, takeUntil } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { EventSolicitudService, EventSolicitud, CreateEventSolicitudRequest, UnidadFuncionalOption, FlujoPreview, EmpleadoOption, MotivoRechazoOption, formatEmpleadoLabel, formatUnidadFuncionalLabel, formatMotivoRechazoLabel } from '../services/event-solicitud.service';
import { ContextoService, Empresa } from '../../../../core/services/contexto.service';
import { ExcelExportService, ExcelColumn } from '../../../../core/services/excel-export.service';
import { environment } from '../../../../environments/environment';
import { DataTableComponent } from '../../../../complements/shared/data-table/data-table.component';
import { TableColumn } from '../../../../complements/shared/data-table/table-column.model';

// PrimeNG
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { TextareaModule } from 'primeng/textarea';
import { SkeletonModule } from 'primeng/skeleton';
import { MultiSelectModule } from 'primeng/multiselect';
import { MessageService, ConfirmationService } from 'primeng/api';
import { TableLazyLoadEvent } from 'primeng/table';

interface BandejaPasoPendiente {
  paso: string;
  items: EventSolicitud[];
  titulo: string;
  icono: string;
  estilo: 'aprobar' | 'autorizar' | 'digitalizar' | 'otros';
}

@Component({
  selector: 'app-dashboard-eventos',
  standalone: true,
  imports: [
    CommonModule, RouterModule, FormsModule,
    ButtonModule, InputTextModule, DialogModule,
    ToastModule, ConfirmDialogModule, TagModule, TooltipModule,
    DropdownModule, CalendarModule, TextareaModule, SkeletonModule, MultiSelectModule,
    DataTableComponent
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardEventosComponent implements OnInit, OnDestroy {

  activeTab: 'Solicitar Evento' | 'gestionar' | 'configuracion' = 'Solicitar Evento';

  novedades: EventSolicitud[] = [];
  novedadesFiltradas: EventSolicitud[] = [];
  solicitudTotal = 0;
  solicitudPage = 1;
  solicitudPerPage = 10;
  solicitudFirst = 0;
  solicitudColumns: TableColumn[] = [];
  bandejaColumns: TableColumn[] = [];
  gestionadosColumns: TableColumn[] = [];
  empleadoOptions: { label: string; value: number }[] = [];
  empleadoCubreOptions: { label: string; value: number }[] = [];
  unidadFuncionalOptions: { label: string; value: number }[] = [];
  novedadOptions: any[] = [];
  empresaOptions: { label: string; value: number }[] = [];
  esTransversal = false;
  empresaSeleccionada: number | null = null;
  isLoadingEmpleados = false;
  isLoadingEmpleadosCubre = false;
  isLoadingUnidadesFuncionales = false;
  sinNovedadesEmpresa = false;

  private readonly PAGE_SIZE = 500;
  private terminoEmpleado = '';
  private terminoEmpleadoCubre = '';
  private paginaEmpleado = 1;
  private paginaEmpleadoCubre = 1;
  hayMasEmpleados = false;
  hayMasEmpleadosCubre = false;
  isSearchingEmpleados = false;
  isSearchingEmpleadosCubre = false;

  private terminoUnidad = '';
  private paginaUnidad = 1;
  hayMasUnidades = false;
  isSearchingUnidades = false;

  private busquedaEmpleado$ = new Subject<string>();
  private busquedaEmpleadoCubre$ = new Subject<string>();
  private busquedaUnidad$ = new Subject<string>();
  private solapamientoCheck$ = new Subject<void>();
  private destroy$ = new Subject<void>();
  isLoading = false;
  isSubmitting = false;

  searchTerm = '';
  selectedEstado: number | null = null;
  estadosOptions = [
    { label: 'Todos', value: null },
    { label: 'Registrado', value: 1 },
    { label: 'Aprobado', value: 2 },
    { label: 'Autorizado', value: 3 },
    { label: 'Rechazado', value: 4 },
    { label: 'Digitalizado', value: 5 },
    { label: 'Anulado', value: 6 },
  ];

  showFormDialog = false;
  editMode = false;
  currentId?: number;
  submitted = false;
  fechaInicialInvalida = false;
  isLoadingEdicion = false;
  private hidratandoEdicion = false;
  private edicionRequestId = 0;
  mensajesSolapamiento: string[] = [];

  formData: {
    empresa_id: number | null;
    empleado_id: number | null;
    empleado_ids: number[];
    aprobador_id: number | null;
    unidad_funcional_id: number | null;
    novedad_id: number | null;
    empleado_cubre_id: number | null;
    fecha_inicial: Date | null;
    fecha_final: Date | null;
    descripcion: string;
  } = this.emptyForm();

  constructor(
    private solicitudService: EventSolicitudService,
    private contextoService: ContextoService,
    private http: HttpClient,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private excelExportService: ExcelExportService
  ) {}

  ngOnInit(): void {
    this.buildColumns();
    this.loadNovedades();
    this.loadEmpresasDisponibles();
    this.loadMotivosRechazo();

    // Búsqueda lazy de empleados de mis UF — por identificación o nombre
    this.busquedaEmpleado$.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      switchMap(term => {
        this.terminoEmpleado = term;
        this.paginaEmpleado = 1;
        this.isSearchingEmpleados = true;
        const empresaId = this.formData.empresa_id ?? this.empresaSeleccionada;
        return this.solicitudService.getEmpleadosMiUnidad(empresaId, term, 1, this.PAGE_SIZE);
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (data) => {
        this.hayMasEmpleados = data.length === this.PAGE_SIZE;
        this.setEmpleadoOptions(data, false);
        this.isSearchingEmpleados = false;
      },
      error: () => { this.empleadoOptions = []; this.isSearchingEmpleados = false; }
    });

    // Búsqueda lazy de empleados de toda la empresa (campo cubre)
    this.busquedaEmpleadoCubre$.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      switchMap(term => {
        this.terminoEmpleadoCubre = term;
        this.paginaEmpleadoCubre = 1;
        this.isSearchingEmpleadosCubre = true;
        const empresaId = this.formData.empresa_id ?? this.empresaSeleccionada;
        return this.solicitudService.getEmpleados(empresaId, term, 1, this.PAGE_SIZE);
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (data) => {
        this.hayMasEmpleadosCubre = data.length === this.PAGE_SIZE;
        this.setEmpleadoCubreOptions(data, false);
        this.isSearchingEmpleadosCubre = false;
      },
      error: () => { this.empleadoCubreOptions = []; this.isSearchingEmpleadosCubre = false; }
    });

    // Búsqueda lazy de unidades funcionales — por código o nombre
    this.busquedaUnidad$.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      switchMap(term => {
        this.terminoUnidad = term;
        this.paginaUnidad = 1;
        this.isSearchingUnidades = true;
        const empresaId = this.formData.empresa_id ?? this.empresaSeleccionada;
        return this.solicitudService.getUnidadesFuncionales(empresaId, term, 1, this.PAGE_SIZE);
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (data) => {
        this.hayMasUnidades = data.length === this.PAGE_SIZE;
        this.setUnidadFuncionalOptions(data, false);
        this.isSearchingUnidades = false;
      },
      error: () => { this.unidadFuncionalOptions = []; this.isSearchingUnidades = false; }
    });

    this.solapamientoCheck$.pipe(
      debounceTime(400),
      takeUntil(this.destroy$),
      switchMap(() => this.consultarSolapamientos$())
    ).subscribe(mensajes => {
      this.mensajesSolapamiento = mensajes;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  buildColumns(): void {
    this.solicitudColumns = [
      { field: 'consecutivo', header: 'Consecutivo', sortable: true },
      { field: 'empleado', header: 'Empleado', sortable: true },
      { field: 'unidad_funcional', header: 'U. Funcional', sortable: true },
      { field: 'fecha_nov_ini', header: 'Inicio', sortable: true },
      { field: 'fecha_nov_fin', header: 'Fin', sortable: true },
      { field: 'estado', header: 'Estado', sortable: true }
    ];

    this.bandejaColumns = [
      { field: 'consecutivo', header: 'Consecutivo', sortable: true },
      { field: 'empleado', header: 'Empleado', sortable: true },
      { field: 'unidad_funcional', header: 'U. Funcional', sortable: true },
      { field: 'fecha_nov_ini', header: 'Inicio', sortable: true },
      { field: 'fecha_nov_fin', header: 'Fin', sortable: true },
      { field: 'estado', header: 'Estado', sortable: true }
    ];

    this.gestionadosColumns = [
      { field: 'consecutivo', header: 'Consecutivo', sortable: true },
      { field: 'empleado', header: 'Empleado', sortable: true },
      { field: 'unidad_funcional', header: 'U. Funcional' },
      { field: 'mi_accion', header: 'Mi acción' },
      { field: 'mi_paso', header: 'Paso' },
      { field: 'mi_fecha_accion', header: 'Fecha acción', sortable: true },
      { field: 'fecha_nov_ini', header: 'Inicio', sortable: true },
      { field: 'fecha_nov_fin', header: 'Fin', sortable: true },
      { field: 'estado', header: 'Estado', sortable: true }
    ];
  }

  setTab(tab: 'Solicitar Evento' | 'gestionar' | 'configuracion'): void {
    this.activeTab = tab;
    if (tab === 'gestionar') {
      this.loadPendientes();
      this.loadMotivosRechazo();
    }
  }

  loadMotivosRechazo(): void {
    this.isLoadingMotivosRechazo = true;
    this.solicitudService.getMotivosRechazo().subscribe({
      next: (data) => {
        this.motivosRechazoOptions = (data || []).map(m => ({
          label: formatMotivoRechazoLabel(m),
          value: m.id
        }));
        this.isLoadingMotivosRechazo = false;
      },
      error: () => {
        this.motivosRechazoOptions = [];
        this.isLoadingMotivosRechazo = false;
      }
    });
  }

  resetFormularioRechazo(): void {
    this.rechazoMotivoId = null;
    this.rechazoComentario = '';
  }

  get rechazoMasivo(): boolean {
    return this.rechazoTargets.length > 0;
  }

  get eventosARechazar(): EventSolicitud[] {
    return this.rechazoMasivo
      ? this.rechazoTargets
      : (this.rechazoTarget ? [this.rechazoTarget] : []);
  }

  get consecutivosRechazo(): string {
    return this.eventosARechazar.map(e => e.consecutivo).join(', ');
  }

  cerrarDialogoRechazo(): void {
    this.showRechazoDialog = false;
    this.rechazoTarget = undefined;
    this.rechazoTargets = [];
    this.rechazoPasoMasivo = null;
    this.resetFormularioRechazo();
  }

  private puedeConfirmarRechazo(): boolean {
    return !!this.rechazoMotivoId;
  }

  // ===== Bandeja de gestión (aprobaciones) =====
  pendientes: EventSolicitud[] = [];
  bandejasPorPaso: BandejaPasoPendiente[] = [];
  isLoadingPendientes = false;
  searchPendientes = '';
  seleccionPorPaso: Record<string, EventSolicitud[]> = {};
  isProcesandoMasivo = false;

  showRechazoDialog = false;
  rechazoMotivoId: number | null = null;
  rechazoComentario = '';
  rechazoTarget?: EventSolicitud;
  rechazoTargets: EventSolicitud[] = [];
  rechazoPasoMasivo: string | null = null;
  motivosRechazoOptions: { label: string; value: number }[] = [];
  isLoadingMotivosRechazo = false;
  isProcesando = false;

  showDetalleDialog = false;
  detalleEvento?: EventSolicitud;
  detalleSoloLectura = false;
  historialDetalle: any[] = [];
  isLoadingHistorialDetalle = false;
  mostrarMotivoRechazoDetalle = false;

  showHistorialDialog = false;
  historial: any[] = [];
  isLoadingHistorial = false;

  // ===== Eventos gestionados (revisión + exportación) =====
  showGestionadosDialog = false;
  gestionados: EventSolicitud[] = [];
  isLoadingGestionados = false;
  searchGestionados = '';
  isExportandoExcel = false;

  loadPendientes(): void {
    this.isLoadingPendientes = true;
    this.solicitudService.getPendientes(this.searchPendientes.trim() || undefined).subscribe({
      next: (res) => {
        this.pendientes = res.data || [];
        this.inicializarSeleccionBandejas();
        this.recalcularBandejas();
        this.isLoadingPendientes = false;
      },
      error: () => {
        this.pendientes = [];
        this.seleccionPorPaso = {};
        this.recalcularBandejas();
        this.isLoadingPendientes = false;
      }
    });
  }

  cantidadSeleccionados(paso: string): number {
    return this.seleccionPorPaso[paso]?.length || 0;
  }

  aprobarSeleccionados(paso: string): void {
    const seleccionados = [...(this.seleccionPorPaso[paso] || [])];
    if (seleccionados.length === 0 || this.isProcesandoMasivo) return;

    this.isProcesandoMasivo = true;
    forkJoin(
      seleccionados.map(evento =>
        this.solicitudService.aprobarEvento(evento.id).pipe(
          map(() => ({ ok: true as const, evento })),
          catchError(err => of({
            ok: false as const,
            evento,
            message: err.error?.message || 'Error al aprobar'
          }))
        )
      )
    ).subscribe({
      next: (results) => {
        const exitosos = results.filter(r => r.ok).length;
        const fallidos = results.filter(r => !r.ok);

        if (exitosos > 0) {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: exitosos === 1 ? '1 evento procesado' : `${exitosos} eventos procesados`
          });
        }
        if (fallidos.length > 0) {
          const detalle = fallidos
            .map(f => `${f.evento.consecutivo}: ${f.message}`)
            .join('; ');
          this.messageService.add({
            severity: fallidos.length === seleccionados.length ? 'error' : 'warn',
            summary: 'Algunos eventos no se procesaron',
            detail: detalle
          });
        }

        this.seleccionPorPaso[paso] = [];
        this.isProcesandoMasivo = false;
        this.loadPendientes();
        this.loadNovedades();
      },
      error: () => {
        this.isProcesandoMasivo = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al procesar la selección' });
      }
    });
  }

  abrirGestionados(): void {
    this.showGestionadosDialog = true;
    if (this.gestionados.length === 0) {
      this.loadGestionados();
    }
  }

  loadGestionados(): void {
    this.isLoadingGestionados = true;
    this.solicitudService.getGestionados(this.searchGestionados.trim() || undefined).subscribe({
      next: (res) => {
        this.gestionados = res.data || [];
        this.isLoadingGestionados = false;
      },
      error: () => {
        this.gestionados = [];
        this.isLoadingGestionados = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los eventos gestionados' });
      }
    });
  }

  nombreEmpleado(ev: EventSolicitud): string {
    const emp: any = ev.empleado;
    if (!emp) return '—';
    return typeof emp === 'string' ? emp : (emp.nombre || '—');
  }

  getAccionLabel(accion?: string | null): string {
    const valor = (accion || '').toLowerCase();
    if (valor === 'aprobado') return 'Aprobado';
    if (valor === 'rechazado') return 'Rechazado';
    return accion || '—';
  }

  getAccionSeverity(accion?: string | null): 'success' | 'danger' | 'info' {
    const valor = (accion || '').toLowerCase();
    if (valor === 'aprobado') return 'success';
    if (valor === 'rechazado') return 'danger';
    return 'info';
  }

  async exportarGestionadosExcel(): Promise<void> {
    if (this.gestionados.length === 0 || this.isExportandoExcel) return;

    this.isExportandoExcel = true;
    try {
      const columnas: ExcelColumn[] = [
        { header: 'Consecutivo', key: 'consecutivo', width: 16 },
        { header: 'Empleado', key: 'empleado', width: 32 },
        { header: 'U. Funcional', key: 'unidad_funcional', width: 28 },
        { header: 'Mi acción', key: 'mi_accion', width: 14 },
        { header: 'Paso', key: 'mi_paso', width: 18 },
        { header: 'Fecha acción', key: 'mi_fecha_accion', width: 20 },
        { header: 'Inicio', key: 'fecha_nov_ini', width: 20 },
        { header: 'Fin', key: 'fecha_nov_fin', width: 20 },
        { header: 'Estado', key: 'estado', width: 16 },
        { header: 'Comentario', key: 'mi_comentario', width: 40 },
      ];

      const datos = this.gestionados.map(ev => ({
        consecutivo: ev.consecutivo,
        empleado: this.nombreEmpleado(ev),
        unidad_funcional: ev.unidad_funcional || '—',
        mi_accion: this.getAccionLabel(ev.mi_accion),
        mi_paso: ev.mi_paso || '—',
        mi_fecha_accion: this.formatearFecha(ev.mi_fecha_accion),
        fecha_nov_ini: this.formatearFecha(ev.fecha_nov_ini),
        fecha_nov_fin: this.formatearFecha(ev.fecha_nov_fin),
        estado: this.getEstadoLabel(ev.estado),
        mi_comentario: ev.mi_comentario || '',
      }));

      await this.excelExportService.exportToExcel(
        datos,
        columnas,
        'Gestionados',
        'eventos_gestionados',
        undefined,
        { title: 'Eventos gestionados', subtitle: 'Eventos aprobados o rechazados por el usuario' }
      );

      this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Archivo Excel generado' });
    } catch {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo exportar a Excel' });
    } finally {
      this.isExportandoExcel = false;
    }
  }

  private inicializarSeleccionBandejas(): void {
    const idsValidos = new Set(this.pendientes.map(p => p.id));
    const pasosActuales = new Set<string>();

    for (const evento of this.pendientes) {
      pasosActuales.add((evento.paso_actual || 'Sin paso').trim());
    }

    for (const paso of pasosActuales) {
      const previa = this.seleccionPorPaso[paso] || [];
      this.seleccionPorPaso[paso] = previa.filter(e => idsValidos.has(e.id));
    }

    for (const paso of Object.keys(this.seleccionPorPaso)) {
      if (!pasosActuales.has(paso)) {
        delete this.seleccionPorPaso[paso];
      }
    }
  }

  private recalcularBandejas(): void {
    const grupos = new Map<string, EventSolicitud[]>();
    for (const evento of this.pendientes) {
      const paso = (evento.paso_actual || 'Sin paso').trim();
      if (!grupos.has(paso)) {
        grupos.set(paso, []);
      }
      grupos.get(paso)!.push(evento);
    }

    this.bandejasPorPaso = Array.from(grupos.entries())
      .map(([paso, items]) => ({
        paso,
        items,
        titulo: `Por ${paso}`,
        icono: this.iconoBandejaPaso(paso),
        estilo: this.estiloBandejaPaso(paso),
      }))
      .sort((a, b) => this.ordenBandejaPaso(a.paso) - this.ordenBandejaPaso(b.paso));
  }

  get hayBandejasPendientes(): boolean {
    return this.bandejasPorPaso.length > 0;
  }

  private ordenBandejaPaso(paso: string): number {
    const normalizado = paso.toLowerCase();
    const orden = ['aprobar', 'autorizar', 'digitalizar'];
    const idx = orden.findIndex(p => normalizado.startsWith(p));
    return idx >= 0 ? idx : orden.length;
  }

  private estiloBandejaPaso(paso: string): BandejaPasoPendiente['estilo'] {
    const normalizado = paso.toLowerCase();
    if (normalizado.startsWith('aprobar')) return 'aprobar';
    if (normalizado.startsWith('autorizar')) return 'autorizar';
    if (normalizado.startsWith('digitalizar')) return 'digitalizar';
    return 'otros';
  }

  private iconoBandejaPaso(paso: string): string {
    const estilo = this.estiloBandejaPaso(paso);
    const iconos: Record<BandejaPasoPendiente['estilo'], string> = {
      aprobar: 'pi-check-circle',
      autorizar: 'pi-verified',
      digitalizar: 'pi-file-edit',
      otros: 'pi-list',
    };
    return iconos[estilo];
  }

  aprobarEvento(evento: EventSolicitud, cerrarDetalle = false): void {
    this.isProcesando = true;
    this.solicitudService.aprobarEvento(evento.id).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Evento aprobado' });
        this.isProcesando = false;
        if (cerrarDetalle) {
          this.cerrarDetalleEvento();
        }
        this.loadPendientes();
        this.loadNovedades();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al aprobar' });
        this.isProcesando = false;
      }
    });
  }

  abrirDetalleEvento(evento: EventSolicitud): void {
    this.detalleSoloLectura = false;
    this.detalleEvento = evento;
    this.mostrarMotivoRechazoDetalle = false;
    this.resetFormularioRechazo();
    this.historialDetalle = [];
    this.isLoadingHistorialDetalle = false;
    this.showDetalleDialog = true;
    this.cargarHistorialRechazo(evento);
  }

  abrirDetalleSolicitud(novedad: EventSolicitud): void {
    this.detalleSoloLectura = true;
    this.detalleEvento = novedad;
    this.mostrarMotivoRechazoDetalle = false;
    this.resetFormularioRechazo();
    this.historialDetalle = [];
    this.isLoadingHistorialDetalle = false;
    this.showDetalleDialog = true;
    this.cargarHistorialRechazo(novedad);
  }

  private cargarHistorialRechazo(evento: EventSolicitud): void {
    if (!this.esEstadoRechazado(evento.estado)) return;

    this.isLoadingHistorialDetalle = true;
    this.solicitudService.getHistorial(evento.id).subscribe({
      next: (res) => {
        this.historialDetalle = res.data?.aprobaciones || [];
        this.isLoadingHistorialDetalle = false;
      },
      error: () => {
        this.historialDetalle = [];
        this.isLoadingHistorialDetalle = false;
      }
    });
  }

  cerrarDetalleEvento(): void {
    this.showDetalleDialog = false;
    this.detalleEvento = undefined;
    this.detalleSoloLectura = false;
    this.historialDetalle = [];
    this.isLoadingHistorialDetalle = false;
    this.mostrarMotivoRechazoDetalle = false;
    this.resetFormularioRechazo();
  }

  esEstadoRechazado(estado: EventSolicitud['estado'] | undefined): boolean {
    return estado != null && this.getEstadoCodigo(estado) === 4;
  }

  getMotivoRechazo(evento: EventSolicitud | undefined): string | null {
    if (!evento) return null;

    if (evento.motivo_rechazo && typeof evento.motivo_rechazo === 'object') {
      let texto = formatMotivoRechazoLabel(evento.motivo_rechazo);
      const comentario = (evento.coment_aprobador || '').trim();
      if (comentario) {
        texto += `. ${comentario}`;
      }
      return texto;
    }

    const legacy = (evento.coment_aprobador || '').trim();
    if (legacy) return legacy;

    const rechazoHistorial = this.historialDetalle.find(h =>
      String(h.accion || '').toLowerCase().includes('rechaz') && String(h.comentario || '').trim()
    );

    return rechazoHistorial?.comentario?.trim() || null;
  }

  getRechazadoPorNombre(): string | null {
    const rechazo = this.getEntradaRechazoHistorial();
    if (!rechazo) return null;

    const user = rechazo.user;
    return user?.name || user?.nombre || (rechazo.id_user ? `Usuario ${rechazo.id_user}` : null);
  }

  getRechazadoPaso(): string | null {
    const rechazo = this.getEntradaRechazoHistorial();
    if (!rechazo) return null;

    return rechazo.paso?.nombre_paso || rechazo.paso?.nombre || null;
  }

  private getEntradaRechazoHistorial(): any | null {
    const entradas = this.historialDetalle.filter(h =>
      String(h.accion || '').toLowerCase().includes('rechaz')
    );
    if (entradas.length === 0) return null;
    return entradas[entradas.length - 1];
  }

  aprobarEventoDesdeDetalle(): void {
    if (!this.detalleEvento) return;
    this.aprobarEvento(this.detalleEvento, true);
  }

  confirmarRechazoDesdeDetalle(): void {
    if (!this.detalleEvento || !this.puedeConfirmarRechazo()) return;
    this.isProcesando = true;
    this.solicitudService.rechazarEvento(this.detalleEvento.id, {
      id_motivo_rechazo: this.rechazoMotivoId!,
      comentario: this.rechazoComentario.trim() || undefined
    }).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Evento rechazado' });
        this.isProcesando = false;
        this.cerrarDetalleEvento();
        this.loadPendientes();
        this.loadNovedades();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al rechazar' });
        this.isProcesando = false;
      }
    });
  }

  calcularHorasEvento(inicio: string, fin: string): string {
    if (!inicio || !fin) return '—';
    try {
      const parse = (f: string) => new Date(f.includes(' ') ? f.replace(' ', 'T') : f);
      const dIni = parse(inicio);
      const dFin = parse(fin);
      if (isNaN(dIni.getTime()) || isNaN(dFin.getTime())) return '—';

      const diffMs = dFin.getTime() - dIni.getTime();
      if (diffMs <= 0) return '0 h';

      const totalMin = Math.round(diffMs / 60000);
      const horas = Math.floor(totalMin / 60);
      const minutos = totalMin % 60;
      const decimal = (totalMin / 60).toFixed(2);

      const legible = minutos === 0 ? `${horas} h` : `${horas} h ${minutos} min`;
      return `${legible} (${decimal} h)`;
    } catch {
      return '—';
    }
  }

  getEmpleadoNombre(empleado: EventSolicitud['empleado'] | EventSolicitud['empleado_cubre'] | undefined): string {
    if (!empleado) return '—';
    if (typeof empleado === 'string') return empleado;
    return empleado.nombre || '—';
  }

  getIniciales(nombre: string): string {
    if (!nombre || nombre === '—') return '?';
    const partes = nombre.trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0) return '?';
    if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  }

  getNovedadLabel(evento: EventSolicitud): string {
    const n = evento.novedad;
    if (!n) return '—';
    if (typeof n === 'string') return n;
    const codigo = n.codigo ? `${n.codigo} - ` : '';
    return `${codigo}${n.descripcion || '—'}`;
  }

  abrirRechazo(evento: EventSolicitud): void {
    this.rechazoTarget = evento;
    this.rechazoTargets = [];
    this.rechazoPasoMasivo = null;
    this.resetFormularioRechazo();
    this.loadMotivosRechazo();
    this.showRechazoDialog = true;
  }

  abrirRechazoSeleccionados(paso: string): void {
    const seleccionados = [...(this.seleccionPorPaso[paso] || [])];
    if (seleccionados.length === 0 || this.isProcesandoMasivo) return;

    this.rechazoTarget = undefined;
    this.rechazoTargets = seleccionados;
    this.rechazoPasoMasivo = paso;
    this.resetFormularioRechazo();
    this.loadMotivosRechazo();
    this.showRechazoDialog = true;
  }

  confirmarRechazo(): void {
    const eventos = this.eventosARechazar;
    if (!eventos.length || !this.puedeConfirmarRechazo()) return;

    const payload = {
      id_motivo_rechazo: this.rechazoMotivoId!,
      comentario: this.rechazoComentario.trim() || undefined
    };

    if (eventos.length === 1 && !this.rechazoMasivo) {
      this.isProcesando = true;
      this.solicitudService.rechazarEvento(eventos[0].id, payload).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Evento rechazado' });
          this.cerrarDialogoRechazo();
          this.isProcesando = false;
          this.loadPendientes();
          this.loadNovedades();
        },
        error: (err) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al rechazar' });
          this.isProcesando = false;
        }
      });
      return;
    }

    const paso = this.rechazoPasoMasivo;
    this.isProcesandoMasivo = true;
    forkJoin(
      eventos.map(evento =>
        this.solicitudService.rechazarEvento(evento.id, payload).pipe(
          map(() => ({ ok: true as const, evento })),
          catchError(err => of({
            ok: false as const,
            evento,
            message: err.error?.message || 'Error al rechazar'
          }))
        )
      )
    ).subscribe({
      next: (results) => {
        const exitosos = results.filter(r => r.ok).length;
        const fallidos = results.filter(r => !r.ok);

        if (exitosos > 0) {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: exitosos === 1 ? '1 evento rechazado' : `${exitosos} eventos rechazados`
          });
        }
        if (fallidos.length > 0) {
          this.messageService.add({
            severity: fallidos.length === eventos.length ? 'error' : 'warn',
            summary: 'Algunos eventos no se rechazaron',
            detail: fallidos.map(f => `${f.evento.consecutivo}: ${f.message}`).join('; ')
          });
        }

        if (paso) this.seleccionPorPaso[paso] = [];
        this.cerrarDialogoRechazo();
        this.isProcesandoMasivo = false;
        this.loadPendientes();
        this.loadNovedades();
      },
      error: () => {
        this.isProcesandoMasivo = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al rechazar la selección' });
      }
    });
  }

  verHistorial(evento: EventSolicitud): void {
    this.showHistorialDialog = true;
    this.isLoadingHistorial = true;
    this.historial = [];
    this.solicitudService.getHistorial(evento.id).subscribe({
      next: (res) => {
        this.historial = res.data?.aprobaciones || [];
        this.isLoadingHistorial = false;
      },
      error: () => { this.historial = []; this.isLoadingHistorial = false; }
    });
  }

  onBuscarUnidadFuncional(event: { filter: string }): void {
    const term = (event?.filter ?? '').trim();
    if (term.length >= 2) {
      this.busquedaUnidad$.next(term);
    } else if (term.length === 0 && this.terminoUnidad !== '') {
      this.busquedaUnidad$.next('');
    }
  }

  onPanelUnidadAbierto(): void {
    if (this.terminoUnidad !== '') {
      this.busquedaUnidad$.next('');
    }
  }

  cargarMasUnidades(): void {
    const empresaId = this.formData.empresa_id ?? this.empresaSeleccionada;
    if (!empresaId || !this.hayMasUnidades || this.isSearchingUnidades) return;

    this.isSearchingUnidades = true;
    this.paginaUnidad++;
    this.solicitudService.getUnidadesFuncionales(empresaId, this.terminoUnidad, this.paginaUnidad, this.PAGE_SIZE)
      .subscribe({
        next: (data) => {
          this.hayMasUnidades = data.length === this.PAGE_SIZE;
          this.setUnidadFuncionalOptions(data, true);
          this.isSearchingUnidades = false;
        },
        error: () => {
          this.paginaUnidad--;
          this.isSearchingUnidades = false;
        }
      });
  }

  private setUnidadFuncionalOptions(unidades: UnidadFuncionalOption[], append: boolean): void {
    const mapa = new Map<number, { label: string; value: number }>();
    if (append) {
      this.unidadFuncionalOptions.forEach(o => mapa.set(o.value, o));
    } else if (this.formData.unidad_funcional_id) {
      const selected = this.unidadFuncionalOptions.find(o => o.value === this.formData.unidad_funcional_id);
      if (selected) mapa.set(selected.value, selected);
    }
    unidades.forEach(u => mapa.set(u.id, { label: formatUnidadFuncionalLabel(u), value: u.id }));
    this.unidadFuncionalOptions = Array.from(mapa.values());
  }

  private resetUnidadesBusqueda(): void {
    this.terminoUnidad = '';
    this.paginaUnidad = 1;
    this.hayMasUnidades = false;
  }

  onBuscarEmpleado(event: { filter: string }): void {
    const term = (event?.filter ?? '').trim();
    if (term.length >= 2) {
      this.busquedaEmpleado$.next(term);
    } else if (term.length === 0 && this.terminoEmpleado !== '') {
      this.busquedaEmpleado$.next('');
    }
  }

  onBuscarEmpleadoCubre(event: { filter: string }): void {
    const term = (event?.filter ?? '').trim();
    if (term.length >= 2) {
      this.busquedaEmpleadoCubre$.next(term);
    } else if (term.length === 0 && this.terminoEmpleadoCubre !== '') {
      this.busquedaEmpleadoCubre$.next('');
    }
  }

  onPanelEmpleadoAbierto(): void {
    if (this.terminoEmpleado !== '') {
      this.busquedaEmpleado$.next('');
    }
  }

  onPanelEmpleadoCubreAbierto(): void {
    if (this.terminoEmpleadoCubre !== '') {
      this.busquedaEmpleadoCubre$.next('');
    }
  }

  cargarMasEmpleados(): void {
    const empresaId = this.formData.empresa_id ?? this.empresaSeleccionada;
    if (!empresaId || !this.hayMasEmpleados || this.isSearchingEmpleados) return;

    this.isSearchingEmpleados = true;
    this.paginaEmpleado++;
    this.solicitudService.getEmpleadosMiUnidad(empresaId, this.terminoEmpleado, this.paginaEmpleado, this.PAGE_SIZE)
      .subscribe({
        next: (data) => {
          this.hayMasEmpleados = data.length === this.PAGE_SIZE;
          this.setEmpleadoOptions(data, true);
          this.isSearchingEmpleados = false;
        },
        error: () => {
          this.paginaEmpleado--;
          this.isSearchingEmpleados = false;
        }
      });
  }

  cargarMasEmpleadosCubre(): void {
    const empresaId = this.formData.empresa_id ?? this.empresaSeleccionada;
    if (!empresaId || !this.hayMasEmpleadosCubre || this.isSearchingEmpleadosCubre) return;

    this.isSearchingEmpleadosCubre = true;
    this.paginaEmpleadoCubre++;
    this.solicitudService.getEmpleados(empresaId, this.terminoEmpleadoCubre, this.paginaEmpleadoCubre, this.PAGE_SIZE)
      .subscribe({
        next: (data) => {
          this.hayMasEmpleadosCubre = data.length === this.PAGE_SIZE;
          this.setEmpleadoCubreOptions(data, true);
          this.isSearchingEmpleadosCubre = false;
        },
        error: () => {
          this.paginaEmpleadoCubre--;
          this.isSearchingEmpleadosCubre = false;
        }
      });
  }

  private setEmpleadoOptions(personas: EmpleadoOption[], append: boolean): void {
    const mapa = new Map<number, { label: string; value: number }>();
    if (append) {
      this.empleadoOptions.forEach(o => mapa.set(o.value, o));
    } else {
      const idsPreservar = this.editMode
        ? (this.formData.empleado_id ? [this.formData.empleado_id] : [])
        : this.formData.empleado_ids;
      idsPreservar.forEach(id => {
        const selected = this.empleadoOptions.find(o => o.value === id);
        if (selected) mapa.set(selected.value, selected);
      });
    }
    personas.forEach(p => mapa.set(p.id, { label: formatEmpleadoLabel(p), value: p.id }));
    this.empleadoOptions = Array.from(mapa.values());
  }

  private setEmpleadoCubreOptions(personas: EmpleadoOption[], append: boolean): void {
    const mapa = new Map<number, { label: string; value: number }>();
    if (append) {
      this.empleadoCubreOptions.forEach(o => mapa.set(o.value, o));
    } else if (this.formData.empleado_cubre_id) {
      const selected = this.empleadoCubreOptions.find(o => o.value === this.formData.empleado_cubre_id);
      if (selected) mapa.set(selected.value, selected);
    }
    personas.forEach(p => mapa.set(p.id, { label: formatEmpleadoLabel(p), value: p.id }));
    this.empleadoCubreOptions = Array.from(mapa.values());
  }

  private resetEmpleadosBusqueda(): void {
    this.terminoEmpleado = '';
    this.terminoEmpleadoCubre = '';
    this.paginaEmpleado = 1;
    this.paginaEmpleadoCubre = 1;
    this.hayMasEmpleados = false;
    this.hayMasEmpleadosCubre = false;
    this.resetUnidadesBusqueda();
  }

  emptyForm() {
    return {
      empresa_id:        null as number | null,
      empleado_id:       null as number | null,
      empleado_ids:      [] as number[],
      aprobador_id:      null as number | null,
      unidad_funcional_id: null as number | null,
      novedad_id:        null as number | null,
      empleado_cubre_id: null as number | null,
      fecha_inicial:     null as Date | null,
      fecha_final:       null as Date | null,
      descripcion:       ''
    };
  }

  loadEmpresasDisponibles(): void {
    this.contextoService.obtenerEmpresasDisponibles().subscribe({
      next: (empresas: Empresa[]) => {
        if (empresas.length === 0) {
          this.esTransversal = true;
          this.http.get<{ success: boolean; data: { nombre: string; id: number }[] }>(
            `${environment.URL_SERVICIOS}/empresas-activas`
          ).subscribe({
            next: (r) => {
              this.empresaOptions = (r.data || []).map(e => ({ label: e.nombre, value: e.id }));
            }
          });
        } else if (empresas.length === 1) {
          this.esTransversal = false;
          this.empresaSeleccionada = empresas[0].id;
          this.formData.empresa_id = empresas[0].id;
          this.loadEmpleados(empresas[0].id);
          this.loadUnidadesFuncionales(empresas[0].id);
          this.loadNovedadesCatalogo(empresas[0].id);
        } else {
          this.esTransversal = true;
          this.empresaOptions = empresas.map(e => ({ label: e.nombre, value: e.id }));
        }
      },
      error: () => {
        this.esTransversal = false;
        this.loadEmpleados();
      }
    });
  }

  loadEmpleados(empresaId?: number | null): void {
    this.empresaSeleccionada = empresaId ?? null;
    this.resetEmpleadosBusqueda();
    this.isLoadingEmpleados = true;
    this.solicitudService.getEmpleadosMiUnidad(empresaId, '', 1, this.PAGE_SIZE).subscribe({
      next: (data) => {
        this.hayMasEmpleados = data.length === this.PAGE_SIZE;
        this.setEmpleadoOptions(data, false);
        this.isLoadingEmpleados = false;
      },
      error: () => { this.empleadoOptions = []; this.isLoadingEmpleados = false; }
    });
    this.loadEmpleadosCubre(empresaId);
  }

  loadEmpleadosCubre(empresaId?: number | null): void {
    this.isLoadingEmpleadosCubre = true;
    this.solicitudService.getEmpleados(empresaId, '', 1, this.PAGE_SIZE).subscribe({
      next: (data) => {
        this.hayMasEmpleadosCubre = data.length === this.PAGE_SIZE;
        this.setEmpleadoCubreOptions(data, false);
        this.isLoadingEmpleadosCubre = false;
      },
      error: () => { this.empleadoCubreOptions = []; this.isLoadingEmpleadosCubre = false; }
    });
  }

  onEmpresaChange(empresaId: number | null): void {
    if (this.hidratandoEdicion) return;

    this.formData.empleado_id       = null;
    this.formData.empleado_ids      = [];
    this.formData.aprobador_id      = null;
    this.formData.empleado_cubre_id = null;
    this.formData.novedad_id        = null;
    this.formData.unidad_funcional_id = null;
    this.mostrarEmpleadoCubre       = false;
    this.flujoPreview               = null;
    this.empleadoOptions = [];
    this.empleadoCubreOptions = [];
    this.unidadFuncionalOptions = [];
    this.resetEmpleadosBusqueda();
    this.novedadOptions = [];
    
    if (empresaId) {
      this.loadEmpleados(empresaId);
      this.loadUnidadesFuncionales(empresaId);
      this.loadNovedadesCatalogo(empresaId);
    }
  }

  loadUnidadesFuncionales(empresaId?: number | null): void {
    this.resetUnidadesBusqueda();
    this.isLoadingUnidadesFuncionales = true;
    this.solicitudService.getUnidadesFuncionales(empresaId, '', 1, this.PAGE_SIZE).subscribe({
      next: (data: UnidadFuncionalOption[]) => {
        this.hayMasUnidades = data.length === this.PAGE_SIZE;
        this.setUnidadFuncionalOptions(data, false);
        this.isLoadingUnidadesFuncionales = false;
      },
      error: () => {
        this.unidadFuncionalOptions = [];
        this.isLoadingUnidadesFuncionales = false;
      }
    });
  }

  loadNovedadesCatalogo(empresaId?: number | null): void {
    this.sinNovedadesEmpresa = false;

    this.solicitudService.getNovedadesCatalogo(empresaId).subscribe({
      next: (data) => {
        if (data.length === 0) {
          this.novedadOptions = [];
          this.sinNovedadesEmpresa = true;
          return;
        }

        this.sinNovedadesEmpresa = false;
        this.novedadOptions = data.map((n: any) => ({
          label: n.label,
          value: n.value,
          cubre: n.cubre ?? false
        }));

        if (this.editMode && this.formData.novedad_id) {
          this.onNovedadChange({ value: this.formData.novedad_id });
        }
      },
      error: () => {
        this.novedadOptions = [];
        this.sinNovedadesEmpresa = true;
      }
    });
  }

  loadNovedades(): void {
    this.isLoading = true;
    this.solicitudService.getSolicitudes({
      estado: this.selectedEstado,
      search: this.searchTerm.trim() || undefined,
      page: this.solicitudPage,
      per_page: this.solicitudPerPage
    }).subscribe({
      next: (res) => {
        this.novedades = res.data || [];
        this.novedadesFiltradas = this.novedades;
        this.solicitudTotal = res.total ?? this.novedades.length;
        this.isLoading = false;
      },
      error: () => {
        this.novedades = [];
        this.novedadesFiltradas = [];
        this.solicitudTotal = 0;
        this.isLoading = false;
      }
    });
  }

  onSolicitudesLazyLoad(event: TableLazyLoadEvent): void {
    const rows = event.rows ?? this.solicitudPerPage;
    const first = event.first ?? 0;
    this.solicitudPerPage = rows;
    this.solicitudFirst = first;
    this.solicitudPage = Math.floor(first / rows) + 1;
    this.loadNovedades();
  }

  aplicarFiltros(): void {
    this.solicitudPage = 1;
    this.solicitudFirst = 0;
    this.loadNovedades();
  }

  limpiarFiltros(): void {
    this.searchTerm = '';
    this.selectedEstado = null;
    this.aplicarFiltros();
  }

  abrirFormulario(): void {
    this.edicionRequestId++;
    this.editMode = false;
    this.currentId = undefined;
    this.submitted = false;
    this.isLoadingEdicion = false;
    this.hidratandoEdicion = false;
    this.sinNovedadesEmpresa = false;
    this.resetCamposFormulario();

    if (this.esTransversal) {
      this.novedadOptions = [];
    }

    this.showFormDialog = true;
  }

  editarNovedad(novedad: EventSolicitud): void {
    const requestId = ++this.edicionRequestId;
    this.editMode = true;
    this.currentId = novedad.id;
    this.submitted = false;
    this.sinNovedadesEmpresa = false;
    this.resetCamposFormulario();
    this.hidratandoEdicion = true;
    this.isLoadingEdicion = true;
    this.showFormDialog = true;

    this.solicitudService.getSolicitudById(novedad.id).subscribe({
      next: (detalle) => {
        if (requestId !== this.edicionRequestId) return;
        this.hidratarFormularioEdicion(detalle);
        this.isLoadingEdicion = false;
      },
      error: () => {
        if (requestId !== this.edicionRequestId) return;
        this.isLoadingEdicion = false;
        this.hidratandoEdicion = false;
        this.showFormDialog = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo cargar la solicitud para editar'
        });
      }
    });
  }

  cerrarFormulario(): void {
    this.edicionRequestId++;
    this.showFormDialog = false;
    this.editMode = false;
    this.currentId = undefined;
    this.submitted = false;
    this.isLoadingEdicion = false;
    this.hidratandoEdicion = false;
    this.resetCamposFormulario();
  }

  private resetCamposFormulario(): void {
    this.fechaInicialInvalida = false;
    this.mensajesSolapamiento = [];
    this.mostrarEmpleadoCubre = false;
    this.flujoPreview = null;
    this.formData = this.emptyForm();

    if (!this.esTransversal && this.empresaSeleccionada) {
      this.formData.empresa_id = this.empresaSeleccionada;
    }
  }

  private hidratarFormularioEdicion(novedad: EventSolicitud): void {
    const empleadoId = this.resolverEmpleadoId(novedad);
    const novedadId = this.resolverNovedadCatalogoId(novedad);
    const unidadId = this.toId(novedad.id_unidad_funcional);
    const empresaId = this.resolverEmpresaId(novedad);
    const empleadoCubreId = this.toId(novedad.empleado_cubre_id ?? novedad.id_user_cubre);

    this.formData = {
      empresa_id:          empresaId,
      empleado_id:         empleadoId,
      empleado_ids:        [],
      aprobador_id:        this.toId(novedad.aprobador_id ?? novedad.id_user_aprobador),
      unidad_funcional_id: unidadId,
      novedad_id:          novedadId,
      empleado_cubre_id:   empleadoCubreId,
      fecha_inicial:       new Date(novedad.fecha_nov_ini),
      fecha_final:         new Date(novedad.fecha_nov_fin),
      descripcion:         novedad.coment_solicitante ?? novedad.descripcion ?? ''
    };

    this.sembrarOpcionesEdicion(novedad);

    if (empresaId) {
      this.loadEmpleados(empresaId);
      this.loadUnidadesFuncionales(empresaId);
      this.loadNovedadesCatalogo(empresaId);
    }

    this.actualizarPreviewFlujo();
    this.validarSolapamiento();
    this.showFormDialog = true;
    setTimeout(() => { this.hidratandoEdicion = false; });
  }

  private toId(valor: unknown): number | null {
    if (valor === null || valor === undefined || valor === '') return null;
    const id = Number(valor);
    return Number.isFinite(id) ? id : null;
  }

  private resolverEmpleadoId(novedad: EventSolicitud): number | null {
    const desdeRelacion = typeof novedad.empleado === 'object' ? novedad.empleado?.id : null;
    return this.toId(novedad.empleado_id ?? novedad.id_user_nov ?? desdeRelacion);
  }

  private resolverNovedadCatalogoId(novedad: EventSolicitud): number | null {
    const desdeRelacion = typeof novedad.novedad === 'object' ? novedad.novedad?.id : null;
    return this.toId(novedad.novedad_id ?? novedad.id_motivo_evento ?? desdeRelacion);
  }

  private resolverEmpresaId(novedad: EventSolicitud): number | null {
    const desdeEmpleado = typeof novedad.empleado === 'object' ? novedad.empleado?.id_empresa : null;
    return this.toId(novedad.empresa_id ?? desdeEmpleado ?? this.empresaSeleccionada);
  }

  private sembrarOpcionesEdicion(novedad: EventSolicitud): void {
    const empleadoId = this.formData.empleado_id;
    if (empleadoId && !this.empleadoOptions.some(o => o.value === empleadoId)) {
      const emp = novedad.empleado;
      const label = typeof emp === 'object'
        ? formatEmpleadoLabel({ nombre: emp?.nombre || `Empleado #${empleadoId}`, numero_identificacion: emp?.numero_identificacion })
        : (emp || `Empleado #${empleadoId}`);
      this.empleadoOptions = [{ label, value: empleadoId }, ...this.empleadoOptions];
    }

    const unidadId = this.formData.unidad_funcional_id;
    if (unidadId && !this.unidadFuncionalOptions.some(o => o.value === unidadId)) {
      const nombre = novedad.unidad_funcional || `Unidad #${unidadId}`;
      const codigo = novedad.unidad_funcional_codigo;
      const label = codigo ? formatUnidadFuncionalLabel({ codigo, nombre }) : String(nombre);
      this.unidadFuncionalOptions = [{ label, value: unidadId }, ...this.unidadFuncionalOptions];
    }

    const novedadId = this.formData.novedad_id;
    if (novedadId && !this.novedadOptions.some((n: any) => Number(n.value) === Number(novedadId))) {
      const nov = novedad.novedad;
      let label = `Novedad #${novedadId}`;
      if (nov && typeof nov === 'object') {
        label = nov.codigo && nov.descripcion ? `${nov.codigo} - ${nov.descripcion}` : (nov.descripcion || label);
      } else if (typeof nov === 'string' && nov.trim()) {
        label = nov;
      }
      this.novedadOptions = [{ label, value: novedadId, cubre: false }, ...this.novedadOptions];
    }

    const cubreId = this.formData.empleado_cubre_id;
    if (cubreId && !this.empleadoCubreOptions.some(o => o.value === cubreId)) {
      const cubre = novedad.empleado_cubre;
      const label = typeof cubre === 'object'
        ? formatEmpleadoLabel({ nombre: cubre?.nombre || `Empleado #${cubreId}`, numero_identificacion: cubre?.numero_identificacion })
        : (cubre || `Empleado #${cubreId}`);
      this.empleadoCubreOptions = [{ label, value: cubreId }, ...this.empleadoCubreOptions];
    }

    const opt = this.novedadOptions.find((n: any) => Number(n.value) === Number(novedadId));
    this.mostrarEmpleadoCubre = !!(opt && (opt.cubre === true || opt.cubre == 1 || opt.cubre === '1'));
  }

  validarFechas(): void {
    const ini = this.formData.fecha_inicial;
    const fin = this.formData.fecha_final;

    if (!ini || !fin || isNaN(ini.getTime()) || isNaN(fin.getTime())) {
      this.fechaInicialInvalida = false;
      this.mensajesSolapamiento = [];
      return;
    }

    const duracionMs = fin.getTime() - ini.getTime();
    this.fechaInicialInvalida = duracionMs < 30 * 60 * 1000;
    this.validarSolapamiento();
  }

  onCambioEmpleado(): void {
    this.actualizarPreviewFlujo();
    this.validarSolapamiento();
  }

  private validarSolapamiento(): void {
    this.solapamientoCheck$.next();
  }

  private consultarSolapamientos$() {
    const ini = this.formData.fecha_inicial;
    const fin = this.formData.fecha_final;

    if (!ini || !fin || this.fechaInicialInvalida || isNaN(ini.getTime()) || isNaN(fin.getTime())) {
      return of([] as string[]);
    }
    if (!this.tieneEmpleadosSeleccionados()) {
      return of([] as string[]);
    }

    const idsAValidar = this.editMode
      ? (this.formData.empleado_id != null ? [this.formData.empleado_id] : [])
      : this.formData.empleado_ids;

    if (!idsAValidar.length) {
      return of([] as string[]);
    }

    const fechaInicial = this.formatearFechaParaAPI(ini);
    const fechaFinal = this.formatearFechaParaAPI(fin);

    const requests = idsAValidar.map(empId =>
      this.solicitudService.verificarSolapamiento({
        empleado_id: empId,
        fecha_inicial: fechaInicial,
        fecha_final: fechaFinal,
        excluir_id: this.editMode ? this.currentId : undefined
      }).pipe(
        map(conflicto => conflicto
          ? `${this.nombreEmpleadoPorId(empId)} ya tiene el evento ${conflicto.consecutivo} (${this.formatearFecha(conflicto.fecha_nov_ini)} – ${this.formatearFecha(conflicto.fecha_nov_fin)}) que se cruza con el rango seleccionado.`
          : null
        ),
        catchError(() => of(null))
      )
    );

    return forkJoin(requests).pipe(
      map(msgs => msgs.filter((m): m is string => !!m))
    );
  }

  private nombreEmpleadoPorId(id: number): string {
    const opt = this.empleadoOptions.find(o => Number(o.value) === Number(id));
    return opt?.label || `Empleado #${id}`;
  }

  mostrarEmpleadoCubre = false;

  // Preview del flujo que aplicará a la solicitud
  flujoPreview: FlujoPreview | null = null;
  isLoadingFlujo = false;

  get novedadSeleccionadaCubre(): boolean {
    return this.mostrarEmpleadoCubre;
  }

  get submitLabel(): string {
    if (this.editMode) return 'Actualizar Solicitud';
    const total = this.formData.empleado_ids.length;
    return total > 1 ? `Realizar ${total} solicitudes` : 'Realizar Solicitud';
  }

  tieneEmpleadosSeleccionados(): boolean {
    return this.editMode
      ? !!this.formData.empleado_id
      : this.formData.empleado_ids.length > 0;
  }

  /** Carga el preview del flujo según la UF donde se realizará el evento. */
  actualizarPreviewFlujo(): void {
    const empresaId = this.formData.empresa_id ?? this.empresaSeleccionada;
    if (!this.formData.unidad_funcional_id) {
      this.flujoPreview = null;
      return;
    }
    const empleadoId = this.editMode
      ? this.formData.empleado_id
      : (this.formData.empleado_ids[0] ?? null);
    this.isLoadingFlujo = true;
    this.solicitudService.getFlujoPreview({
      empresa_id: empresaId,
      empleado_id: empleadoId,
      unidad_funcional_id: this.formData.unidad_funcional_id,
      novedad_id: this.formData.novedad_id
    }).subscribe({
      next: (flujo) => { this.flujoPreview = flujo; this.isLoadingFlujo = false; },
      error: () => { this.flujoPreview = null; this.isLoadingFlujo = false; }
    });
  }

  onNovedadChange(event?: any): void {
    const id = event?.value ?? this.formData.novedad_id;
    const novedad = this.novedadOptions.find((n: any) => Number(n.value) === Number(id));

    if (novedad) {
      this.mostrarEmpleadoCubre = !!(novedad.cubre === true || novedad.cubre == 1 || novedad.cubre === '1');
    } else {
      this.mostrarEmpleadoCubre = false;
    }

    if (!this.mostrarEmpleadoCubre) {
      this.formData.empleado_cubre_id = null;
    }

    this.actualizarPreviewFlujo();
  }

  onSubmit(): void {
    this.submitted = true;
    this.validarFechas();

    if (!this.tieneEmpleadosSeleccionados() || !this.formData.fecha_inicial || !this.formData.fecha_final) return;

    if (this.fechaInicialInvalida) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Fechas inválidas',
        detail: 'La fecha de fin debe ser al menos 30 minutos posterior a la de inicio.'
      });
      return;
    }

    if (!this.formData.unidad_funcional_id) return;
    if (!this.sinNovedadesEmpresa && !this.formData.novedad_id) return;
    if (this.novedadSeleccionadaCubre && !this.formData.empleado_cubre_id) return;

    if (this.sinNovedadesEmpresa) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'No se puede crear la solicitud. La empresa seleccionada no tiene parámetros de novedades configurados.'
      });
      return;
    }

    if (!this.flujoPreview?.parametrizada) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Validación',
        detail: this.flujoPreview?.mensaje || 'Unidad Funcional No parametrizada para eventos'
      });
      return;
    }

    this.isSubmitting = true;
    this.consultarSolapamientos$().subscribe(msgs => {
      this.mensajesSolapamiento = msgs;
      if (msgs.length > 0) {
        this.isSubmitting = false;
        this.messageService.add({
          severity: 'warn',
          summary: 'Rango no disponible',
          detail: msgs[0],
          life: 6000
        });
        return;
      }
      this.enviarSolicitud();
    });
  }

  private enviarSolicitud(): void {
    const fechaInicialFormateada = this.formatearFechaParaAPI(this.formData.fecha_inicial!);
    const fechaFinalFormateada = this.formatearFechaParaAPI(this.formData.fecha_final!);

    const payloadBase: Omit<CreateEventSolicitudRequest, 'empleado_id'> = {
      unidad_funcional_id: this.formData.unidad_funcional_id ?? undefined,
      novedad_id:        this.formData.novedad_id ?? undefined,
      empleado_cubre_id: this.formData.empleado_cubre_id ?? undefined,
      fecha_inicial:     fechaInicialFormateada,
      fecha_final:       fechaFinalFormateada,
      descripcion:       this.formData.descripcion
    };

    if (this.editMode && this.currentId) {
      const payload: CreateEventSolicitudRequest = {
        ...payloadBase,
        empleado_id: this.formData.empleado_id!
      };

      this.solicitudService.updateSolicitud(this.currentId, payload).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Solicitud actualizada' });
          this.cerrarFormulario();
          this.isSubmitting = false;
          this.loadNovedades();
        },
        error: (err: { error?: { message?: string } }) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al guardar' });
          this.isSubmitting = false;
        }
      });
      return;
    }

    this.crearSolicitudesMultiples(this.formData.empleado_ids, payloadBase);
  }

  private crearSolicitudesMultiples(
    empleadoIds: number[],
    payloadBase: Omit<CreateEventSolicitudRequest, 'empleado_id'>
  ): void {
    const requests = empleadoIds.map(empleadoId =>
      this.solicitudService.createSolicitud({ ...payloadBase, empleado_id: empleadoId, estado: 1 }).pipe(
        map(() => ({ ok: true as const })),
        catchError(err => of({
          ok: false as const,
          message: (err as { error?: { message?: string } }).error?.message || 'Error al guardar'
        }))
      )
    );

    forkJoin(requests).subscribe({
      next: (results) => {
        const exitosas = results.filter(r => r.ok).length;
        const fallidas = results.length - exitosas;

        if (exitosas > 0) {
          const detail = fallidas > 0
            ? `${exitosas} solicitud(es) creada(s), ${fallidas} con error`
            : exitosas === 1
              ? 'Solicitud creada exitosamente'
              : `${exitosas} solicitudes creadas exitosamente`;

          this.messageService.add({
            severity: fallidas > 0 ? 'warn' : 'success',
            summary: fallidas > 0 ? 'Parcial' : 'Éxito',
            detail
          });
          this.cerrarFormulario();
          this.loadNovedades();
        } else {
          const primerError = results.find(r => !r.ok);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: primerError && 'message' in primerError ? primerError.message : 'Error al guardar'
          });
        }

        this.isSubmitting = false;
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al guardar las solicitudes' });
        this.isSubmitting = false;
      }
    });
  }

  puedeGestionarSolicitud(novedad: EventSolicitud): boolean {
    return this.getEstadoCodigo(novedad.estado) === 1;
  }

  anularNovedad(novedad: EventSolicitud): void {
    if (!this.puedeGestionarSolicitud(novedad)) {
      return;
    }

    this.confirmationService.confirm({
      message: `¿Anular la solicitud ${novedad.consecutivo}?`,
      header: 'Confirmar Anulación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, anular',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        const payloadAnulacion = { estado: 6 };

        this.solicitudService.updateSolicitud(novedad.id, payloadAnulacion).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Solicitud anulada correctamente' });
            this.loadNovedades();
          },
          error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al anular la solicitud' })
        });
      }
    });
  }

  getEstadoSeverity(estado: number | string): 'success' | 'danger' | 'warn' | 'info' {
    const codigo = this.getEstadoCodigo(estado);
    const map: Record<number, 'success' | 'danger' | 'warn' | 'info'> = {
      1: 'warn',    // Registrado
      2: 'success', // Aprobado
      3: 'info',    // Autorizado
      4: 'danger',  // Rechazado
      5: 'info',    // Digitalizado
      6: 'danger'   // Anulado
    };
    return map[codigo] ?? 'info';
  }

  getEstadoLabel(estado: number | string): string {
    const codigo = this.getEstadoCodigo(estado);
    const map: Record<number, string> = {
      1: 'Registrado',
      2: 'Aprobado',
      3: 'Autorizado',
      4: 'Rechazado',
      5: 'Digitalizado',
      6: 'Anulado'
    };
    return map[codigo] || String(estado || 'Sin estado');
  }

  private getEstadoCodigo(estado: number | string): number {
    if (typeof estado === 'number') return estado;

    const estadoTexto = (estado || '').toString().toLowerCase().trim();
    const mapTextoANumero: Record<string, number> = {
      registrado: 1,
      proceso: 1,
      aprobada: 2,
      aprobado: 2,
      autorizada: 3,
      autorizado: 3,
      rechazada: 4,
      rechazado: 4,
      digitalizada: 5,
      digitalizado: 5,
      anulado: 6,
      anulada: 6
    };

    return mapTextoANumero[estadoTexto] ?? 0;
  }

  formatearFechaParaAPI(fecha: Date): string {
    if (!fecha) return '';
    
    // Formatear fecha en formato YYYY-MM-DD HH:mm:ss (hora local, sin conversión UTC)
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    const hours = String(fecha.getHours()).padStart(2, '0');
    const minutes = String(fecha.getMinutes()).padStart(2, '0');
    const seconds = String(fecha.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  formatearFecha(fecha: any): string {
    if (!fecha) return '—';

    try {
      let date: Date;

      if (fecha instanceof Date) {
        date = fecha;
      } else if (typeof fecha === 'string') {
        date = new Date(fecha.includes(' ') ? fecha.replace(' ', 'T') : fecha);
      } else {
        return fecha.toString();
      }

      if (isNaN(date.getTime())) {
        return fecha.toString();
      }

      return date.toLocaleDateString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch {
      return fecha.toString();
    }
  }
}
