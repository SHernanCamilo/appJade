import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RolService, Rol, CreateRolRequest } from '../services/rol.service';
import { EmpresaService, Empresa } from '../../empresa/services/empresa.service';
import { PerfilService, Perfil } from '../services/perfil.service';
import { PermisoService } from '../services/permiso.service';

// PrimeNG Imports
import { TableModule, Table } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { DropdownModule } from 'primeng/dropdown';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageService, ConfirmationService } from 'primeng/api';
import { MultiSelectModule } from 'primeng/multiselect';
import { AccordionModule } from 'primeng/accordion';

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    DialogModule,
    ToastModule,
    ConfirmDialogModule,
    TagModule,
    TooltipModule,
    DropdownModule,
    CheckboxModule,
    MultiSelectModule,
    AccordionModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './roles.component.html',
  styleUrl: './roles.component.css'
})
export class RolesComponent implements OnInit {
  @ViewChild('dt') dt!: Table;

  roles: Rol[] = [];
  empresas: Empresa[] = [];
  perfilesPorModulo: any[] = [];
  todosLosPerfiles: Perfil[] = [];
  modulos: any[] = [];
  modulosMap: Map<number, any> = new Map();
  perfilesSeleccionados: number[] = [];
  rolForm!: FormGroup;
  isLoading = false;
  isLoadingPerfiles = false;
  isSubmitting = false;
  showForm = false;
  showPerfilesDialog = false;
  editMode = false;
  currentRolId?: number;
  currentRolForPerfiles?: Rol;

  // Opciones para filtros
  tipoRolOptions = [
    { label: 'Todos', value: null },
    { label: 'Globales', value: 'global' },
    { label: 'Por Empresa', value: 'empresa' }
  ];

  constructor(
    private fb: FormBuilder,
    private rolService: RolService,
    private empresaService: EmpresaService,
    private perfilService: PerfilService,
    private permisoService: PermisoService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    this.loadRoles();
    this.loadEmpresas();
    this.loadModulos();
  }

  loadModulos(): void {
    this.permisoService.getModulos().subscribe({
      next: (response: any) => {
        this.modulos = response.data || response;
        // Crear mapa para búsqueda rápida
        this.modulos.forEach((modulo: any) => {
          this.modulosMap.set(modulo.id, modulo);
        });
      },
      error: (error) => {
        console.error('Error cargando módulos:', error);
      }
    });
  }

  initForm(): void {
    this.rolForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50)]],
      codigo: ['', [Validators.maxLength(20)]],
      id_empresa: [null],
      descripcion: ['', [Validators.maxLength(255)]],
      es_admin: [false],
      estado: [true]
    });
  }

  loadRoles(): void {
    this.isLoading = true;

    this.rolService.getRoles().subscribe({
      next: (response: any) => {
        this.roles = response.data || response;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error cargando roles:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error al cargar los roles'
        });
        this.isLoading = false;
        this.roles = [];
      }
    });
  }

  loadEmpresas(): void {
    this.empresaService.getEmpresas().subscribe({
      next: (empresas) => {
        this.empresas = empresas;
      },
      error: (error) => {
        console.error('Error cargando empresas:', error);
      }
    });
  }

  toggleForm(): void {
    this.showForm = !this.showForm;
    if (!this.showForm) {
      this.rolForm.reset({ estado: true, es_admin: false });
      this.editMode = false;
      this.currentRolId = undefined;
    }
  }

  onSubmit(): void {
    if (this.rolForm.invalid) {
      this.rolForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;

    const rolData: CreateRolRequest = {
      ...this.rolForm.value,
      id_empresa: this.rolForm.value.id_empresa || null
    };

    if (this.editMode && this.currentRolId) {
      this.rolService.updateRol(this.currentRolId, rolData).subscribe({
        next: (response: any) => {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: response.message || 'Rol actualizado exitosamente'
          });
          this.rolForm.reset({ estado: true, es_admin: false });
          this.showForm = false;
          this.editMode = false;
          this.loadRoles();
          this.isSubmitting = false;
        },
        error: (error) => {
          console.error('Error actualizando rol:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: error.error?.message || 'Error al actualizar el rol'
          });
          this.isSubmitting = false;
        }
      });
    } else {
      this.rolService.createRol(rolData).subscribe({
        next: (response: any) => {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: response.message || 'Rol creado exitosamente'
          });
          this.rolForm.reset({ estado: true, es_admin: false });
          this.showForm = false;
          this.loadRoles();
          this.isSubmitting = false;
        },
        error: (error) => {
          console.error('Error creando rol:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: error.error?.message || 'Error al crear el rol'
          });
          this.isSubmitting = false;
        }
      });
    }
  }

  editRol(rol: Rol): void {
    this.editMode = true;
    this.currentRolId = rol.id;
    this.rolForm.patchValue({
      nombre: rol.nombre,
      codigo: rol.codigo,
      id_empresa: rol.id_empresa,
      descripcion: rol.descripcion,
      es_admin: rol.es_admin,
      estado: rol.estado
    });
    this.showForm = true;
  }

  deleteRol(rol: Rol): void {
    this.confirmationService.confirm({
      message: `¿Estás seguro de eliminar el rol "${rol.nombre}"?`,
      header: 'Confirmar Eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.rolService.deleteRol(rol.id).subscribe({
          next: (response: any) => {
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: response.message || 'Rol eliminado exitosamente'
            });
            this.loadRoles();
          },
          error: (error) => {
            console.error('Error eliminando rol:', error);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: error.error?.message || 'Error al eliminar el rol'
            });
          }
        });
      }
    });
  }

  onGlobalFilter(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.dt.filterGlobal(input.value, 'contains');
  }

  getRolType(rol: Rol): string {
    if (rol.es_admin) return 'Administrador';
    if (rol.id_empresa) return 'Empresa';
    return 'Global';
  }

  getRolTypeSeverity(rol: Rol): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' {
    if (rol.es_admin) return 'danger';
    if (rol.id_empresa) return 'info';
    return 'success';
  }

  getPerfilesCount(rol: Rol): number {
    return rol.perfiles?.length || 0;
  }

  getUsuariosCount(rol: Rol): number {
    return rol.usuarios?.length || 0;
  }

  // Métodos para asignación de perfiles
  openPerfilesDialog(rol: Rol): void {
    this.currentRolForPerfiles = rol;
    this.perfilesSeleccionados = rol.perfiles?.map(p => p.id) || [];
    this.todosLosPerfiles = []; // Limpiar lista anterior
    this.loadPerfilesPorModulo();
    this.showPerfilesDialog = true;
  }

  loadPerfilesPorModulo(): void {
    // console.log('🔄 Cargando perfiles...');
    this.isLoadingPerfiles = true;
    this.perfilService.getPerfiles().subscribe({
      next: (response: any) => {
        // console.log('✅ Respuesta de perfiles:', response);
        
        // Manejar diferentes formatos de respuesta
        let perfiles: Perfil[] = [];
        
        if (Array.isArray(response)) {
          perfiles = response;
        } else if (response.data && Array.isArray(response.data)) {
          perfiles = response.data;
        } else if (response.success && response.data) {
          perfiles = Array.isArray(response.data) ? response.data : [];
        }
        
        // console.log('📋 Perfiles procesados:', perfiles.length);
        this.todosLosPerfiles = perfiles;
        this.isLoadingPerfiles = false;
      },
      error: (error) => {
        console.error('❌ Error cargando perfiles:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error al cargar los perfiles'
        });
        this.todosLosPerfiles = [];
        this.isLoadingPerfiles = false;
      }
    });
  }

  getModuloNombre(idModulo: number): string {
    const modulo = this.modulosMap.get(idModulo);
    return modulo ? modulo.nombre : 'Desconocido';
  }

  onPerfilChange(perfilId: number, event: any): void {
    if (event.checked) {
      if (!this.perfilesSeleccionados.includes(perfilId)) {
        this.perfilesSeleccionados.push(perfilId);
      }
    } else {
      const index = this.perfilesSeleccionados.indexOf(perfilId);
      if (index > -1) {
        this.perfilesSeleccionados.splice(index, 1);
      }
    }
  }

  isPerfilSelected(perfilId: number): boolean {
    return this.perfilesSeleccionados.includes(perfilId);
  }

  guardarPerfiles(): void {
    if (!this.currentRolForPerfiles) return;

    this.isSubmitting = true;

    this.rolService.asignarPerfiles(this.currentRolForPerfiles.id, this.perfilesSeleccionados).subscribe({
      next: (response: any) => {
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: response.message || 'Perfiles asignados exitosamente'
        });
        this.showPerfilesDialog = false;
        this.loadRoles();
        this.isSubmitting = false;
      },
      error: (error) => {
        console.error('Error asignando perfiles:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: error.error?.message || 'Error al asignar perfiles'
        });
        this.isSubmitting = false;
      }
    });
  }

  cancelarAsignacion(): void {
    this.showPerfilesDialog = false;
    this.currentRolForPerfiles = undefined;
    this.perfilesSeleccionados = [];
  }

  getRolesActivos(): number {
    return this.roles.filter(r => r.estado).length;
  }

  getTotalRoles(): number {
    return this.roles.length;
  }
}
