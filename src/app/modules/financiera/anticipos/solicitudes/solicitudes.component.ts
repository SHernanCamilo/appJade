import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

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
export class SolicitudesAnticiposComponent implements OnInit {
  
  // Estados de carga
  isLoading = false;
  isLoadingUsuario = false;
  
  // Datos
  solicitudes: any[] = [];
  totalRecords = 0;
  
  // Filtros
  searchTerm = '';
  selectedEstado: string | null = null;
  
  // Modal Nueva Solicitud
  displayNuevaSolicitud = false;
  esParaMi = false;
  cedulaBusqueda = '';
  usuarioSeleccionado: any = null;
  usuarioActual: any = null;
  
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
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadSolicitudes();
    this.cargarUsuarioActual();
  }

  /**
   * Cargar usuario actual del sistema
   */
  cargarUsuarioActual(): void {
    // Simulación - aquí deberías obtener el usuario del servicio de autenticación
    this.usuarioActual = {
      nombre: 'JUAN PEREZ',
      cedula: '123456789',
      cargo: 'DIRECTOR ADMINISTRATIVO',
      area: 'FINANCIERA'
    };
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
    this.cedulaBusqueda = '';
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
      this.usuarioSeleccionado = { ...this.usuarioActual };
      this.cedulaBusqueda = '';
    } else {
      this.usuarioSeleccionado = null;
    }
  }

  /**
   * Buscar usuario por cédula
   */
  buscarUsuarioPorCedula(): void {
    if (!this.cedulaBusqueda || this.cedulaBusqueda.trim() === '') {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'Ingrese un número de cédula',
        life: 3000
      });
      return;
    }

    this.isLoadingUsuario = true;

    // Simulación de búsqueda - aquí deberías llamar al servicio
    setTimeout(() => {
      // Simulación de usuario encontrado
      this.usuarioSeleccionado = {
        nombre: 'MARIA GARCIA',
        cedula: this.cedulaBusqueda,
        cargo: 'ANALISTA FINANCIERO',
        area: 'CONTABILIDAD'
      };
      
      this.isLoadingUsuario = false;
      
      this.messageService.add({
        severity: 'success',
        summary: 'Usuario encontrado',
        detail: `${this.usuarioSeleccionado.nombre}`,
        life: 3000
      });
    }, 1000);
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
