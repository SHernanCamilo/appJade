import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

// PrimeNG Imports
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { TooltipModule } from 'primeng/tooltip';
import { CheckboxModule } from 'primeng/checkbox';
import { FileUploadModule } from 'primeng/fileupload';
import { ContextoService } from '../../../../core/services/contexto.service';
import { AuthService } from '../../../auth/auth.service';
import { PersonaService, Empleado } from '../../../contabilidad/personas/services/persona.service';
import { AnticipoSolicitudService } from '../services/anticipo-solicitud.service';
import { AnticipoC iudadService } from '../services/anticipo-ciudad.service';
import { Ciudad, CalculoTopesResponse } from '../models/anticipo.models';

interface EmpleadoUI {
  id: number;
  nombre: string;
  cedula: string;
  cargo: string;
  area: string;
  email?: string | null;
  raw: Empleado;
}

@Component({
  selector: 'app-solicitudes-anticipos',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ButtonModule,
    ToastModule,
    CardModule,
    TableModule,
    TagModule,
    SkeletonModule,
    InputTextModule,
    DropdownModule,
    CalendarModule,
    DialogModule,
    InputNumberModule,
    TooltipModule,
    CheckboxModule,
    FileUploadModule
  ],
  providers: [MessageService],
  templateUrl: './solicitudes.component.html',
  styleUrl: './solicitudes.component.css'
})
export class SolicitudesAnticiposComponent implements OnInit, OnDestroy {

  // Estados de carga
  isLoading = false;
  isLoadingEmpleados = false;

  // Datos
  solicitudes: any[] = [];
  totalRecords = 0;
  empleadosOptions: { label: string; value: EmpleadoUI }[] = [];

  // Filtros
  searchTerm = '';
  selectedEstado: string | null = null;

  // Modal Nueva Solicitud
  displayNuevaSolicitud = false;
  esParaMi = false;
  usuarioSeleccionado: EmpleadoUI | null = null;
  usuarioActual: EmpleadoUI | null = null;
  private empresaIdActual: number | null = null;
  private subscriptions: Subscription[] = [];

  // Búsqueda de empleados con debounce
  private busquedaEmpleado$ = new Subject<string>();
  private empleadosPagina = 1;
  private empleadosPerPage = 30;
  private empleadosTotalPages = 1;
  private empleadosCargados = false;

  // Motivo del anticipo
  motivoSeleccionado: 'viaje' | 'otros' | null = null;

  // Ciudades disponibles
  ciudadesOptions: Ciudad[] = [];
  ciudadSeleccionada: Ciudad | null = null;

  // Topes calculados
  topesCalculados: CalculoTopesResponse | null = null;
  isCalculandoTopes = false;

  // Formulario Viaje
  formularioViaje = {
    pasajeIntermunicipal: { cantidad: 1, valor: 0 },
    transporteInterno: { cantidad: 1, valor: 0 },
    alimentacion: { cantidad: 1, valor: 0 },
    hospedaje: { cantidad: 1, valor: 0 },
    motivo: '',
    fechaSalida: null as Date | null,
    fechaRegreso: null as Date | null,
    cobertura: 'nacional' as 'nacional' | 'internacional'
  };

  // Formulario Otros Conceptos
  formularioOtros = {
    moneda: 'pesos',
    valor: 0,
    descripcion: '',
    archivos: [] as File[]
  };

  // Opciones
  estadosOptions = [
    { label: 'Todos', value: null },
    { label: 'Pendiente', value: 'pendiente' },
    { label: 'Aprobado', value: 'aprobado' },
    { label: 'Rechazado', value: 'rechazado' }
  ];

  monedasOptions = [
    { label: 'Pesos', value: 'pesos' },
    { label: 'Dólares', value: 'dolares' },
    { label: 'Euros', value: 'euros' }
  ];

  constructor(
    private messageService: MessageService,
    private contextoService: ContextoService,
    private authService: AuthService,
    private personaService: PersonaService,
    private anticipoSolicitudService: AnticipoSolicitudService,
    private ciudadService: AnticipoC iudadService
  ) { }

  ngOnInit(): void {
    this.iniciarContexto();
    this.loadSolicitudes();
    this.cargarCiudades();
    
    // Debounce en búsqueda de empleados
    this.subscriptions.push(
      this.busquedaEmpleado$.pipe(
        debounceTime(400),
        distinctUntilChanged(),
        switchMap((termino) => {
          this.isLoadingEmpleados = true;
          this.empleadosPagina = 1;
          return this.personaService.buscarEmpleadosPaginados({
            empresaId: this.empresaIdActual!,
            termino: termino || undefined,
            estado: true,
            page: 1,
            perPage: this.empleadosPerPage
          });
        })
      ).subscribe({
        next: (resultado) => {
          this.empleadosTotalPages = resultado.last_page;
          this.empleadosOptions = resultado.data
            .filter(e => e.estado !== false)
            .map(e => ({ label: `${e.nombre} - ${e.numero_identificacion}`, value: this.mapEmpleadoUI(e) }));
          this.isLoadingEmpleados = false;
        },
        error: () => {
          this.isLoadingEmpleados = false;
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los empleados', life: 3000 });
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Cargar ciudades disponibles
   */
  cargarCiudades(): void {
    this.ciudadService.getCiudades().subscribe({
      next: (response) => {
        if (response.success) {
          this.ciudadesOptions = response.data.filter(c => c.estado);
        }
      },
      error: (error) => {
        console.error('Error cargando ciudades:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar las ciudades',
          life: 3000
        });
      }
    });
  }

  /**
   * Cargar solicitudes
   */
  loadSolicitudes(): void {
    this.isLoading = true;

    this.anticipoSolicitudService.listarSolicitudes({
      estado: this.selectedEstado || undefined,
      page: 1,
      per_page: 20
    }).subscribe({
      next: (response) => {
        if (response.success) {
          this.solicitudes = response.data;
          this.totalRecords = response.total;
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error cargando solicitudes:', error);
        this.solicitudes = [];
        this.totalRecords = 0;
        this.isLoading = false;
      }
    });
  }

  aplicarFiltros(): void {
    this.loadSolicitudes();
  }

  limpiarFiltros(): void {
    this.selectedEstado = null;
    this.searchTerm = '';
    this.loadSolicitudes();
  }

  abrirNuevaSolicitud(): void {
    this.displayNuevaSolicitud = true;
    this.resetFormulario();

    if (!this.empresaIdActual) {
      this.resolverEmpresaActual();
    }

    if (this.empleadosOptions.length === 0 && this.empresaIdActual && !this.isLoadingEmpleados) {
      this.empleadosCargados = false;
      this.cargarEmpleadosEmpresa();
    }
  }

  cerrarNuevaSolicitud(): void {
    this.displayNuevaSolicitud = false;
    this.resetFormulario();
  }

  resetFormulario(): void {
    this.esParaMi = false;
    this.usuarioSeleccionado = null;
    this.motivoSeleccionado = null;
    this.ciudadSeleccionada = null;
    this.topesCalculados = null;

    this.formularioViaje = {
      pasajeIntermunicipal: { cantidad: 1, valor: 0 },
      transporteInterno: { cantidad: 1, valor: 0 },
      alimentacion: { cantidad: 1, valor: 0 },
      hospedaje: { cantidad: 1, valor: 0 },
      motivo: '',
      fechaSalida: null,
      fechaRegreso: null,
      cobertura: 'nacional'
    };

    this.formularioOtros = {
      moneda: 'pesos',
      valor: 0,
      descripcion: '',
      archivos: []
    };
  }

  onEsParaMiChange(): void {
    if (this.esParaMi) {
      this.autocompletarEmpleadoActual();
    } else {
      this.usuarioSeleccionado = null;
    }
  }

  seleccionarMotivo(motivo: 'viaje' | 'otros'): void {
    this.motivoSeleccionado = motivo;
  }

  calcularTotalViaje(): number {
    const { pasajeIntermunicipal, transporteInterno, alimentacion, hospedaje } = this.formularioViaje;
    return (
      (pasajeIntermunicipal.cantidad * pasajeIntermunicipal.valor) +
      (transporteInterno.cantidad * transporteInterno.valor) +
      (alimentacion.cantidad * alimentacion.valor) +
      (hospedaje.cantidad * hospedaje.valor)
    );
  }

  incrementarCantidad(concepto: 'pasajeIntermunicipal' | 'transporteInterno' | 'alimentacion' | 'hospedaje'): void {
    this.formularioViaje[concepto].cantidad++;
  }

  decrementarCantidad(concepto: 'pasajeIntermunicipal' | 'transporteInterno' | 'alimentacion' | 'hospedaje'): void {
    if (this.formularioViaje[concepto].cantidad > 1) {
      this.formularioViaje[concepto].cantidad--;
    }
  }

  onFechaSalidaChange(): void {
    if (this.formularioViaje.fechaRegreso && this.formularioViaje.fechaSalida) {
      if (this.formularioViaje.fechaRegreso < this.formularioViaje.fechaSalida) {
        this.formularioViaje.fechaRegreso = null;
        this.messageService.add({
          severity: 'info',
          summary: 'Fecha actualizada',
          detail: 'La fecha de regreso debe ser posterior a la fecha de salida',
          life: 3000
        });
      }
    }
    this.calcularTopesAutomatico();
  }

  onFechaRegresoChange(): void {
    this.calcularTopesAutomatico();
  }

  onCiudadChange(ciudad: Ciudad | null): void {
    this.ciudadSeleccionada = ciudad;
    this.calcularTopesAutomatico();
  }

  private calcularTopesAutomatico(): void {
    if (
      this.usuarioSeleccionado &&
      this.ciudadSeleccionada &&
      this.formularioViaje.fechaSalida &&
      this.formularioViaje.fechaRegreso
    ) {
      this.calcularTopes();
    }
  }

  calcularTopes(): void {
    if (!this.usuarioSeleccionado || !this.ciudadSeleccionada) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'Debe seleccionar empleado y ciudad destino',
        life: 3000
      });
      return;
    }

    if (!this.formularioViaje.fechaSalida || !this.formularioViaje.fechaRegreso) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'Debe seleccionar fechas de salida y regreso',
        life: 3000
      });
      return;
    }

    this.isCalculandoTopes = true;

    const request = {
      id_empleado: this.usuarioSeleccionado.id,
      id_ciudad_destino: this.ciudadSeleccionada.id,
      fecha_salida: this.formatDate(this.formularioViaje.fechaSalida),
      fecha_regreso: this.formatDate(this.formularioViaje.fechaRegreso),
      cobertura: this.formularioViaje.cobertura
    };

    this.anticipoSolicitudService.calcularTopes(request).subscribe({
      next: (response) => {
        if (response.success) {
          this.topesCalculados = response.data;
          
          this.formularioViaje.alimentacion.cantidad = this.topesCalculados.dias_viaje;
          this.formularioViaje.alimentacion.valor = this.topesCalculados.topes_alimentacion.total_diario;
          
          this.formularioViaje.transporteInterno.cantidad = this.topesCalculados.dias_viaje;
          this.formularioViaje.transporteInterno.valor = this.topesCalculados.topes_transporte.transporte_interno_diario;

          this.messageService.add({
            severity: 'success',
            summary: 'Topes calculados',
            detail: `Monto estimado: ${this.formatCurrency(this.topesCalculados.monto_total_estimado)}`,
            life: 4000
          });
        }
        this.isCalculandoTopes = false;
      },
      error: (error) => {
        console.error('Error calculando topes:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: error.error?.message || 'No se pudieron calcular los topes',
          life: 3000
        });
        this.isCalculandoTopes = false;
      }
    });
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
  }

  guardarSolicitud(): void {
    if (!this.usuarioSeleccionado) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'Debe seleccionar un responsable',
        life: 3000
      });
      return;
    }

    if (!this.motivoSeleccionado) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'Debe seleccionar un motivo',
        life: 3000
      });
      return;
    }

    if (this.motivoSeleccionado === 'viaje') {
      if (!this.ciudadSeleccionada) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Advertencia',
          detail: 'Debe seleccionar una ciudad destino',
          life: 3000
        });
        return;
      }

      if (!this.formularioViaje.fechaSalida || !this.formularioViaje.fechaRegreso) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Advertencia',
          detail: 'Debe seleccionar fechas de salida y regreso',
          life: 3000
        });
        return;
      }

      if (!this.formularioViaje.motivo || this.formularioViaje.motivo.trim() === '') {
        this.messageService.add({
          severity: 'warn',
          summary: 'Advertencia',
          detail: 'Debe ingresar el motivo del viaje',
          life: 3000
        });
        return;
      }

      this.crearSolicitudViaje();
    } else {
      this.crearSolicitudOtros();
    }
  }

  private crearSolicitudViaje(): void {
    const items = [];

    if (this.formularioViaje.pasajeIntermunicipal.valor > 0) {
      items.push({
        id_concepto: 1,
        descripcion: 'Pasaje Intermunicipal',
        cantidad: this.formularioViaje.pasajeIntermunicipal.cantidad,
        valor_unitario: this.formularioViaje.pasajeIntermunicipal.valor,
        valor_total: this.formularioViaje.pasajeIntermunicipal.cantidad * this.formularioViaje.pasajeIntermunicipal.valor
      });
    }

    if (this.formularioViaje.transporteInterno.valor > 0) {
      items.push({
        id_concepto: 2,
        descripcion: 'Transporte Interno',
        cantidad: this.formularioViaje.transporteInterno.cantidad,
        valor_unitario: this.formularioViaje.transporteInterno.valor,
        valor_total: this.formularioViaje.transporteInterno.cantidad * this.formularioViaje.transporteInterno.valor
      });
    }

    if (this.formularioViaje.alimentacion.valor > 0) {
      items.push({
        id_concepto: 3,
        descripcion: 'Alimentación',
        cantidad: this.formularioViaje.alimentacion.cantidad,
        valor_unitario: this.formularioViaje.alimentacion.valor,
        valor_total: this.formularioViaje.alimentacion.cantidad * this.formularioViaje.alimentacion.valor
      });
    }

    if (this.formularioViaje.hospedaje.valor > 0) {
      items.push({
        id_concepto: 4,
        descripcion: 'Hospedaje',
        cantidad: this.formularioViaje.hospedaje.cantidad,
        valor_unitario: this.formularioViaje.hospedaje.valor,
        valor_total: this.formularioViaje.hospedaje.cantidad * this.formularioViaje.hospedaje.valor
      });
    }

    if (items.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'Debe agregar al menos un concepto con valor mayor a 0',
        life: 3000
      });
      return;
    }

    const request = {
      id_empleado: this.usuarioSeleccionado!.id,
      id_ciudad_destino: this.ciudadSeleccionada!.id,
      fecha_salida: this.formatDate(this.formularioViaje.fechaSalida!),
      fecha_regreso: this.formatDate(this.formularioViaje.fechaRegreso!),
      motivo: this.formularioViaje.motivo,
      cobertura: this.formularioViaje.cobertura,
      items
    };

    this.anticipoSolicitudService.crearSolicitud(request).subscribe({
      next: (response) => {
        if (response.success) {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: response.message || 'Solicitud creada correctamente',
            life: 3000
          });
          this.cerrarNuevaSolicitud();
          this.loadSolicitudes();
        }
      },
      error: (error) => {
        console.error('Error creando solicitud:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: error.error?.message || 'No se pudo crear la solicitud',
          life: 3000
        });
      }
    });
  }

  private crearSolicitudOtros(): void {
    this.messageService.add({
      severity: 'info',
      summary: 'En desarrollo',
      detail: 'Funcionalidad de otros conceptos en desarrollo',
      life: 3000
    });
  }

  onFileSelect(event: any): void {
    const files = event.target.files;
    if (files && files.length > 0) {
      this.formularioOtros.archivos = Array.from(files);
      this.messageService.add({
        severity: 'success',
        summary: 'Archivos cargados',
        detail: `${files.length} archivo(s) seleccionado(s)`,
        life: 3000
      });
    }
  }

  onEmpleadoSeleccionado(empleado: EmpleadoUI | null): void {
    if (empleado) {
      if (!this.esEmpleadoActivo(empleado)) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Advertencia',
          detail: 'El empleado seleccionado está inactivo',
          life: 3000
        });
        this.usuarioSeleccionado = null;
        return;
      }
      this.usuarioSeleccionado = empleado;
      this.calcularTopesAutomatico();
    }
  }

  private iniciarContexto(): void {
    this.subscriptions.push(
      this.contextoService.contexto$.subscribe(ctx => {
        if (ctx === null) return;
        this.resolverEmpresaDesdeContexto(ctx);
      })
    );

    this.subscriptions.push(
      this.authService.currentUser$.subscribe(usuario => {
        if (!usuario) return;
        const ctx = this.contextoService.getContextoActual();
        if (ctx) this.resolverEmpresaDesdeContexto(ctx);
      })
    );
  }

  private resolverEmpresaDesdeContexto(ctx: any): void {
    const usuario = this.authService.currentUser;
    const empresasUsuario: number[] = (usuario?.empresas ?? []).map((e: any) => e.id);
    const empresaDelContexto = ctx?.empresa_id ?? null;

    let empresaResuelta: number | null = null;

    if (empresaDelContexto && (empresasUsuario.length === 0 || empresasUsuario.includes(empresaDelContexto))) {
      empresaResuelta = empresaDelContexto;
    } else {
      empresaResuelta = empresasUsuario[0] ?? usuario?.empresa?.id ?? null;
    }

    if (empresaResuelta && empresaResuelta !== this.empresaIdActual) {
      this.empresaIdActual = empresaResuelta;
      this.empleadosOptions = [];
      this.empleadosCargados = false;
      this.cargarEmpleadosEmpresa();
    }
  }

  private resolverEmpresaActual(): void {
    if (this.empresaIdActual) return;
    const contexto = this.contextoService.getContextoActual();
    if (contexto?.empresa_id) {
      this.empresaIdActual = contexto.empresa_id;
      return;
    }
    const usuario = this.authService.currentUser;
    this.empresaIdActual = usuario?.empresa?.id ?? null;
  }

  private cargarEmpleadosEmpresa(): void {
    if (!this.empresaIdActual) return;
    if (this.isLoadingEmpleados || this.empleadosCargados) return;
    this.isLoadingEmpleados = true;
    this.empleadosPagina = 1;
    this.personaService.buscarEmpleadosPaginados({
      empresaId: this.empresaIdActual,
      estado: true,
      page: 1,
      perPage: this.empleadosPerPage
    }).subscribe({
      next: (resultado) => {
        this.empleadosTotalPages = resultado.last_page;
        this.empleadosOptions = resultado.data
          .filter(e => e.estado !== false)
          .map(e => ({ label: `${e.nombre} - ${e.numero_identificacion}`, value: this.mapEmpleadoUI(e) }));
        this.isLoadingEmpleados = false;
        this.empleadosCargados = true;
      },
      error: () => {
        this.isLoadingEmpleados = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los empleados de la empresa', life: 3000 });
      }
    });
  }

  onBuscarEmpleado(termino: string): void {
    if (!this.empresaIdActual) {
      this.resolverEmpresaActual();
      if (!this.empresaIdActual) return;
    }
    this.busquedaEmpleado$.next(termino ?? '');
  }

  private autocompletarEmpleadoActual(): void {
    if (!this.empresaIdActual) {
      this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'No se pudo determinar la empresa del usuario', life: 3000 });
      this.esParaMi = false;
      return;
    }
    this.personaService.obtenerEmpleadoActual().subscribe({
      next: (empleado) => {
        if (empleado) {
          const empleadoUI = this.mapEmpleadoUI(empleado);
          if (!this.esEmpleadoActivo(empleadoUI)) {
            this.messageService.add({
              severity: 'warn',
              summary: 'Advertencia',
              detail: 'El empleado asociado al usuario está inactivo',
              life: 3000
            });
            this.esParaMi = false;
            return;
          }
          this.usuarioActual = empleadoUI;
          this.usuarioSeleccionado = { ...empleadoUI };
          return;
        }
        this.autocompletarPorDatosUsuario();
      },
      error: () => {
        this.autocompletarPorDatosUsuario();
      }
    });
  }

  private autocompletarPorDatosUsuario(): void {
    const usuario = this.authService.currentUser;
    if (!usuario) {
      this.authService.me().subscribe({
        next: (user) => {
          this.buscarEmpleadoPorTermino(user);
        }
      });
      return;
    }
    this.buscarEmpleadoPorTermino(usuario);
  }

  private buscarEmpleadoPorTermino(usuario: any): void {
    if (!this.empresaIdActual) return;
    const termino = usuario?.numero_identificacion || usuario?.documento || usuario?.email || usuario?.name;
    if (!termino) {
      this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'No se encontró información para identificar al empleado', life: 3000 });
      this.esParaMi = false;
      return;
    }
    this.personaService.buscarEmpleadosPaginados({
      empresaId: this.empresaIdActual,
      termino,
      estado: true,
      page: 1,
      perPage: 5
    }).subscribe({
      next: (resultado) => {
        if (resultado.data.length === 0) {
          this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'No se encontró un empleado asociado al usuario', life: 3000 });
          this.esParaMi = false;
          return;
        }
        const empleadoUI = this.mapEmpleadoUI(resultado.data[0]);
        if (!this.esEmpleadoActivo(empleadoUI)) {
          this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'El empleado asociado al usuario está inactivo', life: 3000 });
          this.esParaMi = false;
          return;
        }
        this.usuarioActual = empleadoUI;
        this.usuarioSeleccionado = { ...empleadoUI };
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo autocompletar el empleado', life: 3000 });
        this.esParaMi = false;
      }
    });
  }

  private mapEmpleadoUI(empleado: Empleado): EmpleadoUI {
    return {
      id: empleado.id,
      nombre: empleado.nombre,
      cedula: empleado.numero_identificacion,
      cargo: empleado.cargo_relacion?.nombre_cargo || 'Sin cargo',
      area: empleado.unidad || 'Sin unidad',
      email: empleado.email,
      raw: empleado
    };
  }

  private esEmpleadoActivo(empleado: EmpleadoUI): boolean {
    return empleado.raw.estado !== false;
  }

  getSeverity(estado: string): 'success' | 'warn' | 'danger' | 'info' {
    switch (estado) {
      case 'aprobado':
        return 'success';
      case 'pendiente':
        return 'warn';
      case 'rechazado':
        return 'danger';
      default:
        return 'info';
    }
  }
}
