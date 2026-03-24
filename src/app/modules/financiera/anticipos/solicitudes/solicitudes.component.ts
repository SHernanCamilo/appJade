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
  private empleadosCargados = false; // guard para evitar cargas duplicadas

  // Motivo del anticipo
  motivoSeleccionado: 'viaje' | 'otros' | null = null;

  // Formulario Viaje
  formularioViaje = {
    pasajeIntermunicipal: { cantidad: 1, valor: 0 },
    transporteInterno: { cantidad: 1, valor: 0 },
    alimentacion: { cantidad: 1, valor: 0 },
    hospedaje: { cantidad: 1, valor: 0 },
    motivo: '',
    destino: '',
    fechaSalida: null as Date | null,
    fechaRegreso: null as Date | null
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
    private personaService: PersonaService
  ) { }

  ngOnInit(): void {
    this.iniciarContexto();
    this.loadSolicitudes();
    // Debounce en búsqueda de empleados: espera 400ms antes de llamar al backend
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
   * Cargar solicitudes
   */
  loadSolicitudes(): void {
    this.isLoading = true;

    // Simulación de carga de datos
    setTimeout(() => {
      this.solicitudes = [];
      this.totalRecords = 0;
      this.isLoading = false;
    }, 1000);
  }

  /**
   * Aplicar filtros
   */
  aplicarFiltros(): void {
    this.loadSolicitudes();
  }

  /**
   * Limpiar filtros
   */
  limpiarFiltros(): void {
    this.selectedEstado = null;
    this.searchTerm = '';
    this.loadSolicitudes();
  }

  /**
   * Abrir modal de nueva solicitud.
   * La empresa ya fue resuelta por iniciarContexto() via contexto$.
   * Si aún no hay empresa (contexto tardó), intentar resolverla ahora.
   */
  abrirNuevaSolicitud(): void {
    this.displayNuevaSolicitud = true;
    this.resetFormulario();

    if (!this.empresaIdActual) {
      this.resolverEmpresaActual();
    }

    // Solo cargar si no hay empleados y no está en proceso de carga
    if (this.empleadosOptions.length === 0 && this.empresaIdActual && !this.isLoadingEmpleados) {
      this.empleadosCargados = false;
      this.cargarEmpleadosEmpresa();
    }
  }

  /**
   * Cerrar modal de nueva solicitud
   */
  cerrarNuevaSolicitud(): void {
    this.displayNuevaSolicitud = false;
    this.resetFormulario();
  }

  /**
   * Reset formulario
   */
  resetFormulario(): void {
    this.esParaMi = false;
    this.usuarioSeleccionado = null;
    this.motivoSeleccionado = null;

    // Reset formulario viaje
    this.formularioViaje = {
      pasajeIntermunicipal: { cantidad: 1, valor: 0 },
      transporteInterno: { cantidad: 1, valor: 0 },
      alimentacion: { cantidad: 1, valor: 0 },
      hospedaje: { cantidad: 1, valor: 0 },
      motivo: '',
      destino: '',
      fechaSalida: null,
      fechaRegreso: null
    };

    // Reset formulario otros
    this.formularioOtros = {
      moneda: 'pesos',
      valor: 0,
      descripcion: '',
      archivos: []
    };
  }

  /**
   * Cambio en checkbox "Es para mi"
   */
  onEsParaMiChange(): void {
    if (this.esParaMi) {
      this.autocompletarEmpleadoActual();
    } else {
      this.usuarioSeleccionado = null;
    }
  }

  /**
   * Seleccionar motivo
   */
  seleccionarMotivo(motivo: 'viaje' | 'otros'): void {
    this.motivoSeleccionado = motivo;
  }

  /**
   * Calcular total viaje
   */
  calcularTotalViaje(): number {
    const { pasajeIntermunicipal, transporteInterno, alimentacion, hospedaje } = this.formularioViaje;
    return (
      (pasajeIntermunicipal.cantidad * pasajeIntermunicipal.valor) +
      (transporteInterno.cantidad * transporteInterno.valor) +
      (alimentacion.cantidad * alimentacion.valor) +
      (hospedaje.cantidad * hospedaje.valor)
    );
  }

  /**
   * Incrementar cantidad de un concepto
   */
  incrementarCantidad(concepto: 'pasajeIntermunicipal' | 'transporteInterno' | 'alimentacion' | 'hospedaje'): void {
    this.formularioViaje[concepto].cantidad++;
  }

  /**
   * Decrementar cantidad de un concepto
   */
  decrementarCantidad(concepto: 'pasajeIntermunicipal' | 'transporteInterno' | 'alimentacion' | 'hospedaje'): void {
    if (this.formularioViaje[concepto].cantidad > 1) {
      this.formularioViaje[concepto].cantidad--;
    }
  }

  /**
   * Manejar cambio de fecha de salida
   */
  onFechaSalidaChange(): void {
    // Si hay una fecha de regreso y es menor que la fecha de salida, limpiarla
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
  }

  /**
   * Manejar selección de archivos
   */
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

  /**
   * Guardar solicitud
   */
  guardarSolicitud(): void {
    // Validaciones
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
        detail: 'Debe seleccionar un motivo (Viaje u Otros Conceptos)',
        life: 3000
      });
      return;
    }

    // Aquí iría la lógica para guardar en el backend
    this.messageService.add({
      severity: 'success',
      summary: 'Éxito',
      detail: 'Solicitud creada correctamente',
      life: 3000
    });

    this.cerrarNuevaSolicitud();
    this.loadSolicitudes();
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
    }
  }

  private iniciarContexto(): void {
    // Combinar contexto + usuario para resolver empresa correctamente
    this.subscriptions.push(
      this.contextoService.contexto$.subscribe(ctx => {
        if (ctx === null) return; // Aún cargando
        this.resolverEmpresaDesdeContexto(ctx);
      })
    );

    // Si el usuario llega después (carga async), reintentar con el contexto actual
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
      // Empresa del contexto no pertenece al usuario → usar la del usuario
      empresaResuelta = empresasUsuario[0] ?? usuario?.empresa?.id ?? null;
    }

    if (empresaResuelta && empresaResuelta !== this.empresaIdActual) {
      this.empresaIdActual = empresaResuelta;
      this.empleadosOptions = [];
      this.empleadosCargados = false; // nueva empresa → permitir recarga
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
    // Último recurso: empresa del usuario (solo si el contexto ya cargó y no tiene empresa)
    const usuario = this.authService.currentUser;
    this.empresaIdActual = usuario?.empresa?.id ?? null;
  }

  private cargarEmpleadosEmpresa(): void {
    if (!this.empresaIdActual) return;
    if (this.isLoadingEmpleados || this.empleadosCargados) return; // evitar duplicados
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
    // Emitir al Subject — el debounce en ngOnInit maneja la petición
    this.busquedaEmpleado$.next(termino ?? '');
  }

  private autocompletarEmpleadoActual(): void {
    // No llamar resolverEmpresaActual aquí — puede sobreescribir con empresa incorrecta
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

  /**
   * Obtener severidad según estado
   */
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