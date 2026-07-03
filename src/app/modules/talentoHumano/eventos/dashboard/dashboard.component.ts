import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject, debounceTime, distinctUntilChanged, forkJoin, of, switchMap } from 'rxjs';
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
      })
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
      })
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
      })
    ).subscribe({
      next: (data) => {
        this.hayMasUnidades = data.length === this.PAGE_SIZE;
        this.setUnidadFuncionalOptions(data, false);
        this.isSearchingUnidades = false;
      },
      error: () => { this.unidadFuncionalOptions = []; this.isSearchingUnidades = false; }
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
      { field: 'aprobador', header: 'Aprobador' },
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
    this.resetFormularioRechazo();
    this.loadMotivosRechazo();
    this.showRechazoDialog = true;
  }

  confirmarRechazo(): void {
    if (!this.rechazoTarget || !this.puedeConfirmarRechazo()) return;
    this.isProcesando = true;
    this.solicitudService.rechazarEvento(this.rechazoTarget.id, {
      id_motivo_rechazo: this.rechazoMotivoId!,
      comentario: this.rechazoComentario.trim() || undefined
    }).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Evento rechazado' });
        this.showRechazoDialog = false;
        this.isProcesando = false;
        this.loadPendientes();
        this.loadNovedades();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al rechazar' });
        this.isProcesando = false;
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
    console.log('=== Cargando empresas disponibles ===');
    this.contextoService.obtenerEmpresasDisponibles().subscribe({
      next: (empresas: Empresa[]) => {
        console.log('Empresas obtenidas:', empresas.length, empresas);
        
        if (empresas.length === 0) {
          console.log('Usuario transversal - sin empresas asignadas');
          this.esTransversal = true;
          this.http.get<{ success: boolean; data: { nombre: string; id: number }[] }>(
            `${environment.URL_SERVICIOS}/empresas-activas`
          ).subscribe({
            next: (r) => {
              console.log('Empresas activas obtenidas:', r.data?.length || 0);
              this.empresaOptions = (r.data || []).map(e => ({ label: e.nombre, value: e.id }));
            }
          });
        } else if (empresas.length === 1) {
          console.log('Usuario con una sola empresa:', empresas[0]);
          this.esTransversal = false;
          this.empresaSeleccionada = empresas[0].id;
          this.formData.empresa_id = empresas[0].id;
          this.loadEmpleados(empresas[0].id);
          this.loadUnidadesFuncionales(empresas[0].id);
          this.loadNovedadesCatalogo(empresas[0].id);
        } else {
          console.log('Usuario transversal - múltiples empresas');
          this.esTransversal = true;
          this.empresaOptions = empresas.map(e => ({ label: e.nombre, value: e.id }));
        }
      },
      error: (err) => { 
        console.error('Error cargando empresas:', err);
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
        console.log('=== COMPONENTE - Datos recibidos del servicio ===');
        console.log('Empresa ID:', empresaId);
        console.log('Total opciones:', data.length);
        
        if (data.length === 0) {
          console.log('No hay novedades para esta empresa');
          this.novedadOptions = [];
          this.sinNovedadesEmpresa = true;
          return;
        }
        
        this.sinNovedadesEmpresa = false;
        console.log('Primeras 3 opciones:', data.slice(0, 3));
        
        // Buscar novedad id:5
        const nov5 = data.find((n: any) => n.value === 5);
        console.log('Componente - Novedad id:5 recibida:', nov5);
        
        // Mapear manualmente para asegurar que cubre esté presente
        this.novedadOptions = data.map((n: any) => {
          const option = {
            label: n.label,
            value: n.value,
            cubre: n.cubre ?? false
          };
          
          // Log para novedades con cubre
          if (n.value === 5 || n.value === 6 || n.value === 15) {
            console.log(`Componente - Procesando opción ${n.value}:`, {
              cubreRecibido: n.cubre,
              cubreAsignado: option.cubre
            });
          }
          
          return option;
        });
        
        console.log('Componente - Novedades finales (primeras 3):', this.novedadOptions.slice(0, 3));
        console.log('Componente - Novedad id:5 final:', this.novedadOptions.find((n: any) => n.value === 5));
      },
      error: () => { 
        console.log('Error cargando novedades');
        this.novedadOptions = [];
        this.sinNovedadesEmpresa = true;
      }
    });
  }

  loadNovedades(): void {
    this.isLoading = true;
    this.solicitudService.getSolicitudes(this.selectedEstado ? String(this.selectedEstado) : undefined).subscribe({
      next: (res) => {
        console.log('=== Datos de solicitudes recibidos ===');
        console.log('Primera solicitud:', res.data?.[0]);
        this.novedades = res.data || [];
        this.aplicarFiltros();
        this.isLoading = false;
      },
      error: () => { this.novedades = []; this.novedadesFiltradas = []; this.isLoading = false; }
    });
  }

  aplicarFiltros(): void {
    let result = [...this.novedades];
    if (this.selectedEstado) {
      result = result.filter(n => this.getEstadoCodigo(n.estado) === this.selectedEstado);
    }
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(n => {
        const empleadoNombre = typeof n.empleado === 'object' ? n.empleado?.nombre : n.empleado;
        return empleadoNombre?.toLowerCase().includes(term) ||
               n.consecutivo?.toLowerCase().includes(term) ||
               (n.unidad_funcional ? String(n.unidad_funcional).toLowerCase().includes(term) : false);
      });
    }
    this.novedadesFiltradas = result;
  }

  limpiarFiltros(): void {
    this.searchTerm = '';
    this.selectedEstado = null;
    this.aplicarFiltros();
  }

  abrirFormulario(): void {
    console.log('=== Abriendo formulario ===');
    console.log('Es transversal:', this.esTransversal);
    console.log('Empresa seleccionada:', this.empresaSeleccionada);
    console.log('Opciones de novedad disponibles:', this.novedadOptions.length);
    
    this.editMode = false;
    this.currentId = undefined;
    this.submitted = false;
    this.fechaInicialInvalida = false;
    this.mostrarEmpleadoCubre = false;
    this.flujoPreview = null;
    this.formData = this.emptyForm();
    
    // Si no es transversal y hay empresa seleccionada, mantener la empresa en el formulario
    if (!this.esTransversal && this.empresaSeleccionada) {
      this.formData.empresa_id = this.empresaSeleccionada;
      console.log('Formulario iniciado con empresa:', this.empresaSeleccionada);
    } else {
      // Limpiar novedades hasta que se seleccione empresa
      this.novedadOptions = [];
      console.log('Formulario iniciado sin empresa - novedades limpiadas');
    }
    
    this.showFormDialog = true;
  }

  editarNovedad(novedad: EventSolicitud): void {
    this.editMode = true;
    this.currentId = novedad.id;
    this.submitted = false;
    this.fechaInicialInvalida = false;
    this.formData = {
      empresa_id:        null,
      empleado_id:       novedad.empleado_id,
      empleado_ids:      [],
      aprobador_id:      novedad.aprobador_id ?? null,
      unidad_funcional_id: novedad.id_unidad_funcional ?? null,
      novedad_id:        novedad.novedad_id ?? null,
      empleado_cubre_id: novedad.empleado_cubre_id ?? null,
      fecha_inicial:     new Date(novedad.fecha_nov_ini),
      fecha_final:       new Date(novedad.fecha_nov_fin),
      descripcion:       novedad.coment_solicitante ?? novedad.descripcion ?? ''
    };
    // Evaluar si la novedad guardada requiere cubrir
    const opt = this.novedadOptions.find((n: any) => Number(n.value) === Number(novedad.novedad_id));
    this.mostrarEmpleadoCubre = !!(opt && (opt.cubre === true || opt.cubre == 1 || opt.cubre === 1));
    this.showFormDialog = true;
  }

  validarFechas(): void {
    const ini = this.formData.fecha_inicial;
    const fin = this.formData.fecha_final;

    if (!ini || !fin || isNaN(ini.getTime()) || isNaN(fin.getTime())) {
      this.fechaInicialInvalida = false;
      return;
    }

    this.fechaInicialInvalida = fin < ini;
  }

  /** Convierte una fecha de la BD ("YYYY-MM-DD HH:mm:ss") o ISO a timestamp local. */
  private parsearFechaMs(valor: any): number {
    if (!valor) return NaN;
    if (valor instanceof Date) return valor.getTime();
    const texto = String(valor);
    const date = new Date(texto.includes(' ') ? texto.replace(' ', 'T') : texto);
    return date.getTime();
  }

  /** Normaliza un nombre (acepta string u objeto {nombre}) para comparar. */
  private nombreNormalizado(valor: any): string {
    if (!valor) return '';
    const nombre = typeof valor === 'object' ? (valor.nombre || '') : String(valor);
    return nombre.trim().toUpperCase();
  }

  /** Nombre del empleado seleccionado en el formulario (extrae de "doc - NOMBRE"). */
  private nombreEmpleadoFormPorId(id: number): string {
    const opt = this.empleadoOptions.find(o => Number(o.value) === Number(id));
    if (!opt?.label) return '';
    const idx = opt.label.indexOf(' - ');
    return (idx >= 0 ? opt.label.substring(idx + 3) : opt.label).trim().toUpperCase();
  }

  /**
   * Busca un evento ya registrado del mismo empleado cuyo rango de fechas
   * se cruce con [ini, fin]. Ignora eventos Rechazados/Anulados y, en edición,
   * el propio evento. Validación rápida en cliente (usa las novedades ya cargadas).
   * Compara por empleado_id y, como respaldo, por nombre (el id puede no venir en el listado).
   */
  private buscarSolapamiento(empleadoId: number, ini: Date, fin: Date): EventSolicitud | null {
    const iniMs = ini.getTime();
    const finMs = fin.getTime();
    if (isNaN(iniMs) || isNaN(finMs)) return null;

    const nombreObjetivo = this.nombreEmpleadoFormPorId(empleadoId);

    for (const nov of this.novedades) {
      if (this.editMode && this.currentId && nov.id === this.currentId) continue;

      const mismoPorId = nov.empleado_id != null && Number(nov.empleado_id) === Number(empleadoId);
      const mismoPorNombre = !!nombreObjetivo && this.nombreNormalizado(nov.empleado) === nombreObjetivo;
      if (!mismoPorId && !mismoPorNombre) continue;

      const codigo = this.getEstadoCodigo(nov.estado);
      if (codigo === 4 || codigo === 6) continue; // Rechazado / Anulado no bloquean

      const eIni = this.parsearFechaMs(nov.fecha_nov_ini);
      const eFin = this.parsearFechaMs(nov.fecha_nov_fin);
      if (isNaN(eIni) || isNaN(eFin)) continue;

      // Cruce de rangos (extremos que solo se tocan no se consideran cruce)
      if (iniMs < eFin && eIni < finMs) {
        return nov;
      }
    }
    return null;
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
    // Obtener el ID desde el evento o desde el modelo
    const id = event?.value ?? this.formData.novedad_id;
    
    console.log('=== onNovedadChange disparado ===');
    console.log('ID recibido:', id);
    console.log('Todas las opciones:', this.novedadOptions);
    
    const novedad = this.novedadOptions.find((n: any) => Number(n.value) === Number(id));
    
    console.log('Novedad encontrada:', novedad);
    
    if (novedad) {
      console.log('Valor de cubre:', novedad.cubre, 'Tipo:', typeof novedad.cubre);
      // cubre puede venir como boolean true, número 1, o string "1"
      this.mostrarEmpleadoCubre = !!(novedad.cubre === true || novedad.cubre == 1 || novedad.cubre === '1');
    } else {
      this.mostrarEmpleadoCubre = false;
    }
    
    console.log('Mostrar campo cubre:', this.mostrarEmpleadoCubre);
    
    if (!this.mostrarEmpleadoCubre) {
      this.formData.empleado_cubre_id = null;
    }

    this.actualizarPreviewFlujo();
  }

  onSubmit(): void {
    this.submitted = true;
    this.validarFechas();
    
    // Validaciones básicas
    if (!this.tieneEmpleadosSeleccionados() || !this.formData.fecha_inicial || !this.formData.fecha_final || this.fechaInicialInvalida) return;
    
    // Unidad funcional obligatoria: lugar donde se realiza el evento y de donde toma el flujo.
    if (!this.formData.unidad_funcional_id) return;

    // Validar que hay novedad seleccionada (solo si no es empresa sin novedades)
    if (!this.sinNovedadesEmpresa && !this.formData.novedad_id) return;
    
    // Validar empleado que cubre (solo si la novedad lo requiere)
    if (this.novedadSeleccionadaCubre && !this.formData.empleado_cubre_id) return;
    
    // Si la empresa no tiene novedades, mostrar mensaje y no enviar
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

    // Validación rápida (cliente): el empleado no puede tener eventos que se
    // crucen con el rango de fechas/horas seleccionado.
    const idsAValidar = this.editMode
      ? (this.formData.empleado_id != null ? [this.formData.empleado_id] : [])
      : this.formData.empleado_ids;

    for (const empId of idsAValidar) {
      const conflicto = this.buscarSolapamiento(empId, this.formData.fecha_inicial!, this.formData.fecha_final!);
      if (conflicto) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Rango no disponible',
          detail: `${this.nombreEmpleadoPorId(empId)} ya tiene el evento ${conflicto.consecutivo} (${this.formatearFecha(conflicto.fecha_nov_ini)} – ${this.formatearFecha(conflicto.fecha_nov_fin)}) que se cruza con el rango seleccionado.`,
          life: 6000
        });
        return;
      }
    }

    this.isSubmitting = true;
    
    console.log('=== Enviando solicitud ===');
    console.log('Fecha inicial seleccionada:', this.formData.fecha_inicial);
    console.log('Fecha final seleccionada:', this.formData.fecha_final);
    
    const fechaInicialFormateada = this.formatearFechaParaAPI(this.formData.fecha_inicial!);
    const fechaFinalFormateada = this.formatearFechaParaAPI(this.formData.fecha_final!);
    
    console.log('Fecha inicial formateada:', fechaInicialFormateada);
    console.log('Fecha final formateada:', fechaFinalFormateada);
    
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
          this.showFormDialog = false;
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
          this.showFormDialog = false;
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
    
    console.log('Formateando fecha:', fecha, 'Tipo:', typeof fecha);
    
    try {
      let date: Date;
      
      // Si ya es un objeto Date
      if (fecha instanceof Date) {
        date = fecha;
      }
      // Si es string, convertir a Date
      else if (typeof fecha === 'string') {
        // Para fechas en formato "YYYY-MM-DD HH:mm:ss" de la BD
        if (fecha.includes(' ')) {
          // Reemplazar espacio por T para formato ISO
          date = new Date(fecha.replace(' ', 'T'));
        } else {
          // Formato ISO estándar
          date = new Date(fecha);
        }
      }
      else {
        console.warn('Tipo de fecha no reconocido:', fecha);
        return fecha.toString();
      }
      
      // Verificar que la fecha es válida
      if (isNaN(date.getTime())) {
        console.warn('Fecha inválida:', fecha);
        return fecha.toString();
      }
      
      // Formatear en español (Colombia)
      const resultado = date.toLocaleDateString('es-CO', {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      
      console.log('Fecha formateada:', resultado);
      return resultado;
      
    } catch (error) {
      console.error('Error formateando fecha:', fecha, error);
      return fecha.toString();
    }
  }
}
