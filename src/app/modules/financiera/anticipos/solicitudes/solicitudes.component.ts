import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

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
   * Abrir modal de nueva solicitud
   */
  abrirNuevaSolicitud(): void {
    this.displayNuevaSolicitud = true;
    this.resetFormulario();
    this.resolverEmpresaActual();
    this.cargarEmpleadosEmpresa();
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
    const contexto = this.contextoService.getContextoActual();
    this.actualizarEmpresa(contexto?.empresa_id || null);
    this.subscriptions.push(
      this.contextoService.contexto$.subscribe(ctx => {
        this.actualizarEmpresa(ctx?.empresa_id || null);
      })
    );
    this.resolverEmpresaActual();
  }

  private actualizarEmpresa(empresaId: number | null): void {
    const cambio = this.empresaIdActual !== empresaId;
    this.empresaIdActual = empresaId;
    if (cambio && this.empresaIdActual) {
      this.cargarEmpleadosEmpresa();
    }
  }

  private resolverEmpresaActual(): void {
    if (this.empresaIdActual) {
      return;
    }
    const contexto = this.contextoService.getContextoActual();
    const empresaContexto = contexto?.empresa_id || null;
    if (empresaContexto) {
      this.empresaIdActual = empresaContexto;
      return;
    }
    const usuario = this.authService.currentUser;
    const empresaUsuario = usuario?.empresa_id || usuario?.empresa?.id || usuario?.empresas?.[0]?.id || null;
    if (empresaUsuario) {
      this.empresaIdActual = empresaUsuario;
    }
  }

  private cargarEmpleadosEmpresa(): void {
    if (!this.empresaIdActual) {
      return;
    }
    this.isLoadingEmpleados = true;
    this.personaService.buscarEmpleados({
      empresaId: this.empresaIdActual,
      estado: true
    }).subscribe({
      next: (empleados) => {
        const empleadosUI = empleados
          .filter((empleado) => empleado.estado !== false)
          .map((empleado) => this.mapEmpleadoUI(empleado));
        this.empleadosOptions = empleadosUI.map(empleado => ({
          label: `${empleado.nombre} - ${empleado.cedula}`,
          value: empleado
        }));
        this.isLoadingEmpleados = false;
      },
      error: () => {
        this.isLoadingEmpleados = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los empleados de la empresa',
          life: 3000
        });
      }
    });
  }

  onBuscarEmpleado(termino: string): void {
    if (!termino || termino.trim() === '') {
      this.cargarEmpleadosEmpresa();
      return;
    }
    this.resolverEmpresaActual();
    if (!this.empresaIdActual) {
      return;
    }
    this.isLoadingEmpleados = true;
    this.personaService.buscarEmpleados({
      empresaId: this.empresaIdActual,
      termino: termino.trim(),
      estado: true
    }).subscribe({
      next: (empleados) => {
        const empleadosUI = empleados
          .filter((empleado) => empleado.estado !== false)
          .map((empleado) => this.mapEmpleadoUI(empleado));
        this.empleadosOptions = empleadosUI.map(empleado => ({
          label: `${empleado.nombre} - ${empleado.cedula}`,
          value: empleado
        }));
        this.isLoadingEmpleados = false;
      },
      error: () => {
        this.isLoadingEmpleados = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo buscar empleados',
          life: 3000
        });
      }
    });
  }

  private autocompletarEmpleadoActual(): void {
    this.resolverEmpresaActual();
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
    if (!this.empresaIdActual) {
      return;
    }
    const termino = usuario?.numero_identificacion || usuario?.documento || usuario?.email || usuario?.name;
    if (!termino) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'No se encontró información para identificar al empleado',
        life: 3000
      });
      this.esParaMi = false;
      return;
    }
    this.personaService.buscarEmpleados({
      empresaId: this.empresaIdActual,
      termino,
      estado: true
    }).subscribe({
      next: (empleados) => {
        if (empleados.length === 0) {
          this.messageService.add({
            severity: 'warn',
            summary: 'Advertencia',
            detail: 'No se encontró un empleado asociado al usuario',
            life: 3000
          });
          this.esParaMi = false;
          return;
        }
        const empleadoUI = this.mapEmpleadoUI(empleados[0]);
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
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo autocompletar el empleado',
          life: 3000
        });
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