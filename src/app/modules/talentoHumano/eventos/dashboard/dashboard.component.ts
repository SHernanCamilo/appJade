import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { EventSolicitudService, EventSolicitud, CreateEventSolicitudRequest, UnidadFuncionalOption, FlujoPreview, EmpleadoOption, formatEmpleadoLabel, formatUnidadFuncionalLabel } from '../services/event-solicitud.service';
import { ContextoService, Empresa } from '../../../../core/services/contexto.service';
import { environment } from '../../../../environments/environment';

// PrimeNG
import { TableModule } from 'primeng/table';
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
import { MessageService, ConfirmationService } from 'primeng/api';

@Component({
  selector: 'app-dashboard-eventos',
  standalone: true,
  imports: [
    CommonModule, RouterModule, FormsModule,
    TableModule, ButtonModule, InputTextModule, DialogModule,
    ToastModule, ConfirmDialogModule, TagModule, TooltipModule,
    DropdownModule, CalendarModule, TextareaModule, SkeletonModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardEventosComponent implements OnInit, OnDestroy {

  activeTab: 'Solicitar Evento' | 'gestionar' | 'configuracion' = 'Solicitar Evento';

  novedades: EventSolicitud[] = [];
  novedadesFiltradas: EventSolicitud[] = [];
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
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit(): void {
    this.loadNovedades();
    this.loadEmpresasDisponibles();

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

  setTab(tab: 'Solicitar Evento' | 'gestionar' | 'configuracion'): void {
    this.activeTab = tab;
    if (tab === 'gestionar') {
      this.loadPendientes();
    }
  }

  // ===== Bandeja de gestión (aprobaciones) =====
  pendientes: EventSolicitud[] = [];
  isLoadingPendientes = false;
  searchPendientes = '';

  showRechazoDialog = false;
  rechazoMotivo = '';
  rechazoTarget?: EventSolicitud;
  isProcesando = false;

  showHistorialDialog = false;
  historial: any[] = [];
  isLoadingHistorial = false;

  loadPendientes(): void {
    this.isLoadingPendientes = true;
    this.solicitudService.getPendientes(this.searchPendientes.trim() || undefined).subscribe({
      next: (res) => {
        this.pendientes = res.data || [];
        this.isLoadingPendientes = false;
      },
      error: () => { this.pendientes = []; this.isLoadingPendientes = false; }
    });
  }

  aprobarEvento(evento: EventSolicitud): void {
    this.confirmationService.confirm({
      message: `¿Aprobar el paso "${evento.paso_actual || ''}" del evento ${evento.consecutivo}?`,
      header: 'Confirmar aprobación',
      icon: 'pi pi-check-circle',
      acceptLabel: 'Sí, aprobar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-success',
      accept: () => {
        this.isProcesando = true;
        this.solicitudService.aprobarEvento(evento.id).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Evento aprobado' });
            this.isProcesando = false;
            this.loadPendientes();
            this.loadNovedades();
          },
          error: (err) => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al aprobar' });
            this.isProcesando = false;
          }
        });
      }
    });
  }

  abrirRechazo(evento: EventSolicitud): void {
    this.rechazoTarget = evento;
    this.rechazoMotivo = '';
    this.showRechazoDialog = true;
  }

  confirmarRechazo(): void {
    if (!this.rechazoTarget || this.rechazoMotivo.trim().length < 3) return;
    this.isProcesando = true;
    this.solicitudService.rechazarEvento(this.rechazoTarget.id, this.rechazoMotivo.trim()).subscribe({
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
    } else if (this.formData.empleado_id) {
      const selected = this.empleadoOptions.find(o => o.value === this.formData.empleado_id);
      if (selected) mapa.set(selected.value, selected);
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
      aprobador_id:      novedad.aprobador_id ?? null,
      unidad_funcional_id: novedad.id_unidad_funcional ?? null,
      novedad_id:        novedad.novedad_id ?? null,
      empleado_cubre_id: novedad.empleado_cubre_id ?? null,
      fecha_inicial:     new Date(novedad.fecha_nov_ini),
      fecha_final:       new Date(novedad.fecha_nov_fin),
      descripcion:       novedad.descripcion ?? ''
    };
    // Evaluar si la novedad guardada requiere cubrir
    const opt = this.novedadOptions.find((n: any) => Number(n.value) === Number(novedad.novedad_id));
    this.mostrarEmpleadoCubre = !!(opt && (opt.cubre === true || opt.cubre == 1 || opt.cubre === 1));
    this.showFormDialog = true;
  }

  validarFechas(): void {
    const ini = this.formData.fecha_inicial;
    const fin = this.formData.fecha_final;
    this.fechaInicialInvalida = !!(ini && fin && fin < ini);
  }

  mostrarEmpleadoCubre = false;

  // Preview del flujo que aplicará a la solicitud
  flujoPreview: FlujoPreview | null = null;
  isLoadingFlujo = false;

  get novedadSeleccionadaCubre(): boolean {
    return this.mostrarEmpleadoCubre;
  }

  /** Carga el preview del flujo cuando hay empresa + unidad funcional. */
  actualizarPreviewFlujo(): void {
    const empresaId = this.formData.empresa_id ?? this.empresaSeleccionada;
    if (!this.formData.unidad_funcional_id) {
      this.flujoPreview = null;
      return;
    }
    this.isLoadingFlujo = true;
    this.solicitudService.getFlujoPreview({
      empresa_id: empresaId,
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
    
    // Validaciones básicas
    if (!this.formData.empleado_id || !this.formData.fecha_inicial || !this.formData.fecha_final || this.fechaInicialInvalida) return;
    
    // Unidad funcional obligatoria: define el flujo de aprobación
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

    this.isSubmitting = true;
    
    console.log('=== Enviando solicitud ===');
    console.log('Fecha inicial seleccionada:', this.formData.fecha_inicial);
    console.log('Fecha final seleccionada:', this.formData.fecha_final);
    
    const fechaInicialFormateada = this.formatearFechaParaAPI(this.formData.fecha_inicial!);
    const fechaFinalFormateada = this.formatearFechaParaAPI(this.formData.fecha_final!);
    
    console.log('Fecha inicial formateada:', fechaInicialFormateada);
    console.log('Fecha final formateada:', fechaFinalFormateada);
    
    // El aprobador ya no se elige manualmente: lo resuelve el flujo por permiso/UF.
    const payload: CreateEventSolicitudRequest = {
      empleado_id:       this.formData.empleado_id!,
      unidad_funcional_id: this.formData.unidad_funcional_id ?? undefined,
      novedad_id:        this.formData.novedad_id ?? undefined,
      empleado_cubre_id: this.formData.empleado_cubre_id ?? undefined,
      fecha_inicial:     fechaInicialFormateada,
      fecha_final:       fechaFinalFormateada,
      descripcion:       this.formData.descripcion
    };

    // Estado inicial requerido por negocio: 1 = Registrado
    if (!this.editMode) {
      payload.estado = 1;
    }
    
    console.log('Payload completo:', payload);

    const req$ = this.editMode && this.currentId
      ? this.solicitudService.updateSolicitud(this.currentId, payload)
      : this.solicitudService.createSolicitud(payload);

    req$.subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: this.editMode ? 'Solicitud actualizada' : 'Solicitud creada exitosamente' });
        this.showFormDialog = false;
        this.isSubmitting = false;
        this.loadNovedades();
      },
      error: (err: { error?: { message?: string } }) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al guardar' });
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
