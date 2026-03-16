import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subscription } from 'rxjs';

// PrimeNG Imports
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService, ConfirmationService } from 'primeng/api';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { CheckboxModule } from 'primeng/checkbox';
import { TabViewModule } from 'primeng/tabview';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { ConfirmDialogModule } from 'primeng/confirmdialog';

// Service
import { 
  AnticipoConceptoService, 
  AntiConcepto, 
  AntiTipo, 
  AntiClase, 
  AntiModalidad,
  AntiRegla 
} from '../services/anticipo-concepto.service';
import { ContextoService } from '../../../../core/services/contexto.service';
import { AuthService } from '../../../auth/auth.service';
import { environment } from '../../../../environments/environment';

interface ConceptoForm {
  id_tipo: number | null;
  id_clase: number | null;
  id_modalidad: number | null;
  estado: boolean;
}

interface Empleado {
  id: number;
  id_empresa: number;
  id_cargo: number;
  numero_identificacion: string;
  nombre: string;
  email?: string | null;
  tipo_identificacion?: string | null;
  unidad?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  estado?: boolean;
  caso_glpi?: string | null;
  usuario_crea_id?: number | null;
  usuario_actualiza_id?: number | null;
  empresa?: {
    id: number;
    nombre: string;
  };
  cargo_relacion?: {
    id_cargo: number;
    nombre_cargo: string;
  };
}

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
  selector: 'app-conceptos-anticipos',
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
    DialogModule,
    TooltipModule,
    CheckboxModule,
    TabViewModule,
    DropdownModule,
    InputNumberModule,
    ConfirmDialogModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './conceptos.component.html',
  styleUrl: './conceptos.component.css'
})
export class ConceptosAnticiposComponent implements OnInit, OnDestroy {
  
  // Estados de carga
  isLoading = false;
  isSaving = false;
  
  // Datos
  conceptos: AntiConcepto[] = [];
  totalRecords = 0;
  currentPage = 1;
  perPage = 10;
  
  // Formulario actual
  conceptoActual: ConceptoForm = this.getEmptyConcepto();
  modoEdicion = false;
  conceptoEditandoId: number | null = null;
  
  // Opciones para dropdowns (cargadas desde backend)
  tiposOptions: AntiTipo[] = [];
  clasesOptions: AntiClase[] = [];
  modalidadesOptions: AntiModalidad[] = [];
  
  // Reglas del concepto
  reglas: AntiRegla[] = [];
  nuevaRegla: AntiRegla = { descripcion: '', valor_tope: 0 };
  empleadoActual: EmpleadoUI | null = null;
  private empresaIdActual: number | null = null;
  private subscriptions: Subscription[] = [];

  constructor(
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private anticipoService: AnticipoConceptoService,
    private http: HttpClient,
    private contextoService: ContextoService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.iniciarContexto();
    this.loadTipos();
    this.loadConceptos();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Obtener concepto vacío
   */
  private getEmptyConcepto(): ConceptoForm {
    return {
      id_tipo: null,
      id_clase: null,
      id_modalidad: null,
      estado: true
    };
  }

  /**
   * Cargar tipos desde backend
   */
  loadTipos(): void {
    this.anticipoService.getTipos().subscribe({
      next: (response) => {
        if (response.success) {
          this.tiposOptions = response.data;
        }
      },
      error: (error) => {
        console.error('Error cargando tipos:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los tipos de anticipos',
          life: 3000
        });
      }
    });
  }

  private iniciarContexto(): void {
    const contexto = this.contextoService.getContextoActual();
    this.actualizarEmpresa(contexto?.empresa_id || null);
    this.subscriptions.push(
      this.contextoService.contexto$.subscribe(ctx => {
        this.actualizarEmpresa(ctx?.empresa_id || null);
      })
    );
  }

  private actualizarEmpresa(empresaId: number | null): void {
    const cambio = this.empresaIdActual !== empresaId;
    this.empresaIdActual = empresaId;
    if (cambio && this.empresaIdActual) {
      this.cargarEmpleadoActual();
    }
  }

  private cargarEmpleadoActual(): void {
    const usuario = this.authService.currentUser;
    if (!usuario) {
      this.authService.me().subscribe({
        next: (user) => {
          this.buscarEmpleadoPorUsuario(user);
        }
      });
      return;
    }
    this.buscarEmpleadoPorUsuario(usuario);
  }

  private buscarEmpleadoPorUsuario(usuario: any): void {
    if (!this.empresaIdActual) {
      return;
    }
    const termino = usuario?.numero_identificacion || usuario?.documento || usuario?.email || usuario?.name;
    if (!termino) {
      return;
    }
    const params = new HttpParams()
      .set('id_empresa', this.empresaIdActual.toString())
      .set('buscar', termino);
    this.http.get<any>(`${environment.URL_SERVICIOS}/empleados`, { params }).subscribe({
      next: (response) => {
        const empleados = this.normalizarEmpleados(response);
        if (empleados.length > 0) {
          this.empleadoActual = this.mapEmpleadoUI(empleados[0]);
        }
      }
    });
  }

  private normalizarEmpleados(response: any): Empleado[] {
    if (Array.isArray(response)) {
      return response as Empleado[];
    }
    if (response?.data && Array.isArray(response.data)) {
      return response.data as Empleado[];
    }
    return [];
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

  /**
   * Cargar conceptos desde backend
   */
  loadConceptos(): void {
    this.isLoading = true;
    
    this.anticipoService.getConceptos({
      page: this.currentPage,
      per_page: this.perPage
    }).subscribe({
      next: (response) => {
        if (response.success) {
          this.conceptos = response.data;
          this.totalRecords = response.total;
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error cargando conceptos:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los conceptos',
          life: 3000
        });
        this.isLoading = false;
      }
    });
  }

  /**
   * Cambio en el tipo de anticipo
   */
  onTipoChange(): void {
    this.conceptoActual.id_clase = null;
    this.conceptoActual.id_modalidad = null;
    this.clasesOptions = [];
    this.modalidadesOptions = [];
    
    if (this.conceptoActual.id_tipo) {
      this.anticipoService.getClasesPorTipo(this.conceptoActual.id_tipo).subscribe({
        next: (response) => {
          if (response.success) {
            this.clasesOptions = response.data;
          }
        },
        error: (error) => {
          console.error('Error cargando clases:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudieron cargar las clases',
            life: 3000
          });
        }
      });
    }
  }

  /**
   * Cambio en la clase de anticipo
   */
  onClaseChange(): void {
    this.conceptoActual.id_modalidad = null;
    this.modalidadesOptions = [];
    
    if (this.conceptoActual.id_clase) {
      this.anticipoService.getModalidadesPorClase(this.conceptoActual.id_clase).subscribe({
        next: (response) => {
          if (response.success) {
            this.modalidadesOptions = response.data;
          }
        },
        error: (error) => {
          console.error('Error cargando modalidades:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudieron cargar las modalidades',
            life: 3000
          });
        }
      });
    }
  }

  /**
   * Agregar nueva regla
   */
  agregarRegla(): void {
    if (!this.nuevaRegla.descripcion || this.nuevaRegla.descripcion.trim() === '') {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'La descripción de la regla es obligatoria',
        life: 3000
      });
      return;
    }

    if (this.nuevaRegla.valor_tope <= 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'El valor tope debe ser mayor a 0',
        life: 3000
      });
      return;
    }

    this.reglas.push({
      descripcion: this.nuevaRegla.descripcion,
      valor_tope: this.nuevaRegla.valor_tope
    });

    this.nuevaRegla = { descripcion: '', valor_tope: 0 };

    this.messageService.add({
      severity: 'success',
      summary: 'Éxito',
      detail: 'Regla agregada correctamente',
      life: 3000
    });
  }

  /**
   * Eliminar regla
   */
  eliminarRegla(regla: AntiRegla): void {
    this.reglas = this.reglas.filter(r => r !== regla);
    this.messageService.add({
      severity: 'info',
      summary: 'Regla eliminada',
      detail: 'La regla se eliminó correctamente',
      life: 3000
    });
  }

  /**
   * Agregar concepto a la tabla
   */
  agregarConcepto(): void {
    // Primero, si hay una regla en el formulario sin agregar, agregarla automáticamente
    if (this.nuevaRegla.descripcion && this.nuevaRegla.descripcion.trim() !== '' && this.nuevaRegla.valor_tope > 0) {
      this.reglas.push({
        descripcion: this.nuevaRegla.descripcion,
        valor_tope: this.nuevaRegla.valor_tope
      });
      this.nuevaRegla = { descripcion: '', valor_tope: 0 };
    }

    // Validaciones
    if (!this.conceptoActual.id_tipo) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'El tipo de anticipo es obligatorio',
        life: 3000
      });
      return;
    }

    if (!this.conceptoActual.id_clase) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'La clase de anticipo es obligatoria',
        life: 3000
      });
      return;
    }

    if (!this.conceptoActual.id_modalidad) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'La modalidad es obligatoria',
        life: 3000
      });
      return;
    }

    if (this.reglas.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'Debe agregar al menos una regla',
        life: 3000
      });
      return;
    }

    this.isSaving = true;

    const conceptoData = {
      id_tipo: this.conceptoActual.id_tipo,
      id_clase: this.conceptoActual.id_clase,
      id_modalidad: this.conceptoActual.id_modalidad,
      estado: this.conceptoActual.estado,
      reglas: this.reglas
    };

    if (this.modoEdicion && this.conceptoEditandoId) {
      // Actualizar concepto existente
      this.anticipoService.updateConcepto(this.conceptoEditandoId, conceptoData).subscribe({
        next: (response) => {
          if (response.success) {
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: 'Concepto actualizado correctamente',
              life: 3000
            });
            this.loadConceptos();
            this.limpiarFormulario();
          }
          this.isSaving = false;
        },
        error: (error) => {
          console.error('Error actualizando concepto:', error);
          const mensaje = error.error?.message || 'No se pudo actualizar el concepto';
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: mensaje,
            life: 3000
          });
          this.isSaving = false;
        }
      });
    } else {
      // Crear nuevo concepto
      this.anticipoService.createConcepto(conceptoData).subscribe({
        next: (response) => {
          if (response.success) {
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: 'Concepto agregado correctamente',
              life: 3000
            });
            this.loadConceptos();
            this.limpiarFormulario();
          }
          this.isSaving = false;
        },
        error: (error) => {
          console.error('Error creando concepto:', error);
          const mensaje = error.error?.message || 'No se pudo crear el concepto';
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: mensaje,
            life: 3000
          });
          this.isSaving = false;
        }
      });
    }
  }

  /**
   * Editar concepto
   */
  editarConcepto(concepto: AntiConcepto): void {
    this.modoEdicion = true;
    this.conceptoEditandoId = concepto.id || null;
    
    this.conceptoActual = {
      id_tipo: concepto.id_tipo,
      id_clase: concepto.id_clase,
      id_modalidad: concepto.id_modalidad,
      estado: concepto.estado
    };
    
    this.reglas = concepto.reglas ? [...concepto.reglas] : [];
    
    // Cargar clases del tipo seleccionado
    if (concepto.id_tipo) {
      this.anticipoService.getClasesPorTipo(concepto.id_tipo).subscribe({
        next: (response) => {
          if (response.success) {
            this.clasesOptions = response.data;
          }
        }
      });
    }
    
    // Cargar modalidades de la clase seleccionada
    if (concepto.id_clase) {
      this.anticipoService.getModalidadesPorClase(concepto.id_clase).subscribe({
        next: (response) => {
          if (response.success) {
            this.modalidadesOptions = response.data;
          }
        }
      });
    }

    // Scroll al formulario
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * Cancelar edición
   */
  cancelarEdicion(): void {
    this.limpiarFormulario();
    this.messageService.add({
      severity: 'info',
      summary: 'Cancelado',
      detail: 'Edición cancelada',
      life: 3000
    });
  }

  /**
   * Limpiar formulario
   */
  limpiarFormulario(): void {
    this.conceptoActual = this.getEmptyConcepto();
    this.reglas = [];
    this.clasesOptions = [];
    this.modalidadesOptions = [];
    this.modoEdicion = false;
    this.conceptoEditandoId = null;
    this.nuevaRegla = { descripcion: '', valor_tope: 0 };
  }

  /**
   * Eliminar concepto
   */
  eliminarConcepto(concepto: AntiConcepto): void {
    this.confirmationService.confirm({
      message: '¿Está seguro de eliminar este concepto?',
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      accept: () => {
        if (concepto.id) {
          this.anticipoService.deleteConcepto(concepto.id).subscribe({
            next: (response) => {
              if (response.success) {
                this.messageService.add({
                  severity: 'success',
                  summary: 'Éxito',
                  detail: 'Concepto eliminado correctamente',
                  life: 3000
                });
                this.loadConceptos();
              }
            },
            error: (error) => {
              console.error('Error eliminando concepto:', error);
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'No se pudo eliminar el concepto',
                life: 3000
              });
            }
          });
        }
      }
    });
  }

  /**
   * Cambiar estado del concepto
   */
  cambiarEstado(concepto: AntiConcepto): void {
    if (concepto.id) {
      this.anticipoService.toggleEstado(concepto.id).subscribe({
        next: (response) => {
          if (response.success) {
            const accion = response.data.estado ? 'activado' : 'desactivado';
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: `Concepto ${accion} correctamente`,
              life: 3000
            });
            this.loadConceptos();
          }
        },
        error: (error) => {
          console.error('Error cambiando estado:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo cambiar el estado',
            life: 3000
          });
        }
      });
    }
  }

  /**
   * Cambio de página en la tabla
   */
  onPageChange(event: any): void {
    this.currentPage = event.page + 1;
    this.perPage = event.rows;
    this.loadConceptos();
  }

  /**
   * Obtener severidad según estado
   */
  getSeverity(estado: boolean): 'success' | 'danger' {
    return estado ? 'success' : 'danger';
  }

  /**
   * Obtener texto del estado
   */
  getEstadoTexto(estado: boolean): string {
    return estado ? 'Activo' : 'Inactivo';
  }

  /**
   * Obtener label del tipo
   */
  getTipoLabel(concepto: AntiConcepto): string {
    return concepto.tipo?.nombre || '';
  }

  /**
   * Obtener label de la clase
   */
  getClaseLabel(concepto: AntiConcepto): string {
    return concepto.clase?.nombre || '';
  }

  /**
   * Obtener label de la modalidad
   */
  getModalidadLabel(concepto: AntiConcepto): string {
    return concepto.modalidad?.nombre || '';
  }
}
