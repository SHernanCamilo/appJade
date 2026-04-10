import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { UsuarioService, Usuario } from '../services/usuario.service';
import { EmpresaService, Empresa } from '../../empresa/services/empresa.service';
import { SucursalService, Sucursal } from '../../empresa/services/sucursal.service';
import { SedeService, Sede } from '../../empresa/services/sede.service';
import { RolService, Rol } from '../services/rol.service';
import { AuthService } from '../../../auth/auth.service';
import { SincronizarTenantComponent } from '../components/sincronizar-tenant/sincronizar-tenant.component';

// PrimeNG Imports
import { TableModule, Table } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TagModule } from 'primeng/tag';
import { AvatarModule } from 'primeng/avatar';
import { TooltipModule } from 'primeng/tooltip';
import { DropdownModule } from 'primeng/dropdown';
import { MultiSelectModule } from 'primeng/multiselect';
import { TabViewModule } from 'primeng/tabview';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageService, ConfirmationService } from 'primeng/api';

interface EmpresaAsignacion {
  empresa_id: number;
  sucursal_id: number | null;
  sede_id: number | null;
  recursivo: boolean;
}

@Component({
  selector: 'app-crear-usuario',
  standalone: true,
  imports: [
    CommonModule, RouterModule, ReactiveFormsModule, FormsModule,
    TableModule, ButtonModule, InputTextModule, DialogModule, ToastModule,
    ConfirmDialogModule, TagModule, AvatarModule, TooltipModule, DropdownModule,
    MultiSelectModule, TabViewModule, CheckboxModule, SincronizarTenantComponent
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './crear-usuario.component.html',
  styleUrl: './crear-usuario.component.css'
})
export class CrearUsuarioComponent implements OnInit {
  @ViewChild('dt') dt!: Table;
  
  // Core data
  usuarios: Usuario[] = [];
  empresas: Empresa[] = [];
  roles: Rol[] = [];
  usuarioForm!: FormGroup;
  
  // Loading states
  isLoading = false;
  isSubmitting = false;
  isLoadingSucursales = false;
  isLoadingSedes = false;
  isLoadingEmpresas = false;
  isLoadingRoles = false;
  isLoadingForEdit = false;
  
  // Data loaded flags
  empresasCargadas = false;
  rolesCargados = false;
  
  // Modal states
  showForm = false;
  editMode = false;
  currentUsuarioId?: number;
  activeTabIndex = 0;
  
  // Multi-empresa system
  tempEmpresa: number | null = null;
  tempSucursal: number | null = null;
  tempSede: number | null = null;
  tempRecursivo: boolean = false;
  empresasAsignadas: EmpresaAsignacion[] = [];
  
  // Data collections
  sucursales: Sucursal[] = [];
  sedes: Sede[] = [];
  todasSucursales: Sucursal[] = [];
  todasSedes: Sede[] = [];
  
  // Tenant sync
  showSincronizarTenant = false;
  
  // Constants
  readonly tiposIdentificacion = [
    { label: 'Cédula de Ciudadanía', value: 'CC' },
    { label: 'Cédula de Extranjería', value: 'CE' },
    { label: 'Pasaporte', value: 'PA' },
    { label: 'NIT', value: 'NIT' },
    { label: 'Tarjeta de Identidad', value: 'TI' }
  ];

  constructor(
    private fb: FormBuilder,
    private usuarioService: UsuarioService,
    private empresaService: EmpresaService,
    private sucursalService: SucursalService,
    private sedeService: SedeService,
    private rolService: RolService,
    private authService: AuthService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    this.loadUsuarios();
    this.setupEmailValidation();
  }

  // ============================================
  // FORM INITIALIZATION
  // ============================================

  initForm(): void {
    this.usuarioForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      cargo: ['', [Validators.required]],
      tipo_identificacion: ['', [Validators.required]],
      numero_identificacion: ['', [Validators.required]],
      direccion: ['', [Validators.required]],
      telefono: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      password_confirmation: ['', [Validators.required]],
      roles: [[], []] // Array vacío por defecto
    });
  }

  private setupEmailValidation(): void {
    this.usuarioForm.get('email')?.valueChanges.subscribe(email => {
      if (email && this.usuarioForm.get('email')?.valid && !this.editMode) {
        // Debounce para evitar muchas peticiones
        setTimeout(() => {
          if (email === this.usuarioForm.get('email')?.value) {
            this.checkEmailAvailability(email);
          }
        }, 500);
      }
    });
  }

  // ============================================
  // DATA LOADING METHODS
  // ============================================

  loadUsuarios(): void {
    this.isLoading = true;
    this.usuarioService.getUsuarios().subscribe({
      next: (usuarios) => {
        this.usuarios = usuarios;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error cargando usuarios:', error);
        this.showError('Error al cargar los usuarios. Por favor, intenta nuevamente.');
        this.isLoading = false;
        this.usuarios = [];
      }
    });
  }

  loadEmpresas(): Promise<void> {
    if (this.empresasCargadas || this.isLoadingEmpresas) {
      return Promise.resolve();
    }
    
    this.isLoadingEmpresas = true;
    return new Promise((resolve, reject) => {
      this.empresaService.getEmpresas().subscribe({
        next: (empresas) => {
          this.empresas = empresas;
          this.empresasCargadas = true;
          this.isLoadingEmpresas = false;
          resolve();
        },
        error: (error) => {
          console.error('Error cargando empresas:', error);
          this.showError('Error al cargar las empresas');
          this.isLoadingEmpresas = false;
          reject(error);
        }
      });
    });
  }

  loadRoles(): Promise<void> {
    if (this.rolesCargados || this.isLoadingRoles) {
      return Promise.resolve();
    }
    
    this.isLoadingRoles = true;
    return new Promise((resolve, reject) => {
      this.rolService.getRoles().subscribe({
        next: (response: any) => {
          this.roles = response.data || response;
          this.rolesCargados = true;
          this.isLoadingRoles = false;
          resolve();
        },
        error: (error) => {
          console.error('Error cargando roles:', error);
          this.showError('Error al cargar los roles');
          this.isLoadingRoles = false;
          reject(error);
        }
      });
    });
  }

  loadRolesPorEmpresas(): void {
    if (this.empresasAsignadas.length === 0) {
      this.loadRoles();
      return;
    }

    const empresasIds = [...new Set(this.empresasAsignadas.map(a => a.empresa_id))];
    
    if (empresasIds.length === 1) {
      this.loadRolesPorEmpresa(empresasIds[0]);
      return;
    }

    this.rolService.getRolesPorMultiplesEmpresas(empresasIds).subscribe({
      next: (response: any) => {
        this.roles = response.data || response;
        this.handleRolesResponse(response);
      },
      error: (error) => {
        console.error('Error cargando roles por múltiples empresas:', error);
        this.showError('Error al cargar los roles para estas empresas');
      }
    });
  }

  private loadRolesPorEmpresa(empresaId: number): void {
    this.rolService.getRolesPorEmpresaConModulos(empresaId).subscribe({
      next: (response: any) => {
        this.roles = response.data || response;
        this.handleRolesResponse(response);
      },
      error: (error) => {
        console.error('Error cargando roles por empresa:', error);
        this.showError('Error al cargar los roles para esta empresa');
      }
    });
  }

  private handleRolesResponse(response: any): void {
    if (response.is_admin) {
      this.showInfo('Como administrador, tienes acceso a todos los roles del sistema');
    }
    
    if (this.editMode) {
      this.validateSelectedRoles(response.is_admin);
    }
  }

  private validateSelectedRoles(isAdmin: boolean): void {
    const rolesSeleccionados = this.usuarioForm.get('roles')?.value || [];
    const rolesValidosIds = this.roles.map(r => r.id);
    const rolesValidosSeleccionados = rolesSeleccionados.filter((rolId: number) => 
      rolesValidosIds.includes(rolId)
    );
    
    if (rolesValidosSeleccionados.length !== rolesSeleccionados.length && !isAdmin) {
      this.usuarioForm.patchValue({ roles: rolesValidosSeleccionados });
      this.showWarning('Algunos roles no están disponibles para estas empresas y fueron removidos');
    }
  }

  // ============================================
  // MODAL MANAGEMENT
  // ============================================

  toggleForm(): void {
    this.showForm = !this.showForm;
    
    if (!this.showForm) {
      this.resetForm();
    } else {
      this.loadRequiredData();
    }
  }

  private resetForm(): void {
    this.usuarioForm.reset();
    this.editMode = false;
    this.currentUsuarioId = undefined;
    this.isLoadingForEdit = false;
    this.activeTabIndex = 0;
    this.resetPasswordValidators();
    this.clearTempData();
  }

  private resetPasswordValidators(): void {
    this.usuarioForm.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
    this.usuarioForm.get('password_confirmation')?.setValidators([Validators.required]);
  }

  private clearTempData(): void {
    this.tempEmpresa = null;
    this.tempSucursal = null;
    this.tempSede = null;
    this.tempRecursivo = false;
    this.empresasAsignadas = [];
    this.sucursales = [];
    this.sedes = [];
  }

  private async loadRequiredData(): Promise<void> {
    try {
      await Promise.all([
        this.loadEmpresas(),
        this.loadRoles()
      ]);
      
      if (this.empresasAsignadas.length > 0) {
        this.loadRolesPorEmpresas();
      }
    } catch (error) {
      console.error('Error loading required data:', error);
    }
  }

  // ============================================
  // EDIT USER
  // ============================================

  async editUsuario(usuario: Usuario): Promise<void> {
    this.editMode = true;
    this.currentUsuarioId = usuario.id;
    this.isLoadingForEdit = true;
    
    this.clearPasswordValidators();
    
    try {
      await this.loadRequiredData();
      this.populateForm(usuario);
      await this.loadUserAssignments(usuario);
      this.showForm = true;
    } catch (error) {
      console.error('Error en editUsuario:', error);
      this.showError('Error al cargar los datos para edición');
    } finally {
      this.isLoadingForEdit = false;
    }
  }

  private clearPasswordValidators(): void {
    this.usuarioForm.get('password')?.clearValidators();
    this.usuarioForm.get('password_confirmation')?.clearValidators();
    this.usuarioForm.get('password')?.updateValueAndValidity();
    this.usuarioForm.get('password_confirmation')?.updateValueAndValidity();
  }

  private populateForm(usuario: Usuario): void {
    const roleIds = this.extractRoleIds(usuario.roles);
    const cargoValue = usuario.cargo || '';

    this.usuarioForm.patchValue({
      name: usuario.name,
      cargo: cargoValue,
      tipo_identificacion: (usuario as any).tipo_identificacion || '',
      numero_identificacion: (usuario as any).numero_identificacion || '',
      direccion: (usuario as any).direccion || '',
      telefono: (usuario as any).telefono || '',
      email: usuario.email,
      password: '',
      password_confirmation: '',
      roles: roleIds
    });
  }

  private extractRoleIds(roles: any[] | undefined): number[] {
    if (!roles) return [];
    
    return roles.map((r: any) => {
      if (typeof r === 'string') {
        const rol = this.roles.find(role => role.nombre === r);
        return rol ? rol.id : null;
      }
      return r.id || r;
    }).filter(id => id !== null);
  }

  private async loadUserAssignments(usuario: Usuario): Promise<void> {
    if (!usuario.empresas?.length) return;

    this.empresasAsignadas = [];
    const loadPromises: Promise<void>[] = [];

    for (const empresa of usuario.empresas) {
      const pivot = (empresa as any).pivot;
      const asignacion: EmpresaAsignacion = {
        empresa_id: empresa.id,
        sucursal_id: pivot?.id_sucursal || null,
        sede_id: pivot?.id_sede || null,
        recursivo: Boolean(pivot?.recursivo) // Asegurar que sea booleano
      };
      
      this.empresasAsignadas.push(asignacion);
      
      // Solo cargar sucursales/sedes si NO es recursivo y hay IDs específicos
      if (!asignacion.recursivo) {
        // Load sucursales if needed
        if (!this.todasSucursales.find(s => s.id_Empresa === empresa.id)) {
          loadPromises.push(this.loadSucursalesForEmpresa(empresa.id));
        }
        
        // Load sedes if needed
        if (asignacion.sucursal_id && !this.todasSedes.find(s => s.id_Sucursal === asignacion.sucursal_id)) {
          loadPromises.push(this.loadSedesForSucursal(asignacion.sucursal_id));
        }
      } else {
        // Si es recursivo, cargar todas las sucursales de la empresa para mostrar información completa
        if (!this.todasSucursales.find(s => s.id_Empresa === empresa.id)) {
          loadPromises.push(this.loadSucursalesForEmpresa(empresa.id));
        }
      }
    }

    await Promise.all(loadPromises);
    
    // DEBUG: Verificar las asignaciones cargadas
    // console.log('📋 Asignaciones cargadas en edición:', this.empresasAsignadas);
    this.empresasAsignadas.forEach((asig, index) => {
      // console.log(`  ${index}: empresa=${asig.empresa_id}, sucursal=${asig.sucursal_id}, sede=${asig.sede_id}, recursivo=${asig.recursivo}`);
    });
    
    this.loadRolesPorEmpresas();
  }

  private loadSucursalesForEmpresa(empresaId: number): Promise<void> {
    return new Promise((resolve) => {
      this.sucursalService.getSucursalesPorEmpresa(empresaId).subscribe({
        next: (sucursales) => {
          this.addToCollection(sucursales, this.todasSucursales);
          resolve();
        },
        error: (error) => {
          console.error('Error cargando sucursales en edición:', error);
          resolve();
        }
      });
    });
  }

  private loadSedesForSucursal(sucursalId: number): Promise<void> {
    return new Promise((resolve) => {
      this.sedeService.getSedesPorSucursal(sucursalId).subscribe({
        next: (sedes) => {
          this.addToCollection(sedes, this.todasSedes);
          resolve();
        },
        error: (error) => {
          console.error('Error cargando sedes en edición:', error);
          resolve();
        }
      });
    });
  }

  private addToCollection<T extends { id: number }>(newItems: T[], collection: T[]): void {
    newItems.forEach(item => {
      if (!collection.find(existing => existing.id === item.id)) {
        collection.push(item);
      }
    });
  }

  // ============================================
  // FORM SUBMISSION
  // ============================================

  onSubmit(): void {
    if (!this.validateForm()) return;

    this.isSubmitting = true;
    const usuarioData = this.buildUsuarioData();

    // DEBUG: Mostrar datos que se van a enviar
    // console.log('📤 Datos a enviar al backend:', usuarioData);
    // console.log('🔍 Empresas asignadas:', this.empresasAsignadas);
    // console.log('🔍 Valores del formulario:', this.usuarioForm.value);

    const operation = this.editMode && this.currentUsuarioId
      ? this.usuarioService.updateUsuario(this.currentUsuarioId, usuarioData)
      : this.usuarioService.createUsuario(usuarioData);

    operation.subscribe({
      next: (response) => {
        // console.log('✅ Respuesta exitosa del servidor:', response);
        const message = this.editMode ? 'Usuario actualizado exitosamente' : 'Usuario creado exitosamente';
        this.showSuccess(message);
        this.resetAfterSubmit();
      },
      error: (error) => {
        console.error('❌ Error completo:', error);
        console.error('❌ Error response:', error.error);
        console.error('❌ Error status:', error.status);
        console.error('❌ Error message:', error.message);
        
        // Log específico para errores 500
        if (error.status === 500) {
          console.error('🔥 Error 500 - Internal Server Error');
          console.error('🔍 Request que causó el error:', usuarioData);
          console.error('🔍 URL del request:', error.url);
        }
        
        // Mostrar error específico al usuario
        const errorMessage = this.getErrorMessage(error);
        this.showError(errorMessage);
        
        // Si hay errores de validación específicos, marcar los campos
        if (error.error?.errors) {
          this.markFieldErrors(error.error.errors);
        }
        
        this.isSubmitting = false;
      }
    });
  }

  private markFieldErrors(errors: any): void {
    Object.keys(errors).forEach(field => {
      const control = this.usuarioForm.get(field);
      if (control) {
        control.setErrors({ serverError: errors[field] });
        control.markAsTouched();
      }
    });
  }

  private validateForm(): boolean {
    if (this.usuarioForm.invalid) {
      this.usuarioForm.markAllAsTouched();
      this.showWarning('Por favor completa todos los campos obligatorios');
      return false;
    }

    // Validación específica para cargo
    const cargoValue = this.usuarioForm.get('cargo')?.value;
    if (!cargoValue || cargoValue.toString().trim() === '') {
      this.showError('El campo Cargo del Usuario es obligatorio');
      this.usuarioForm.get('cargo')?.setErrors({ required: true });
      return false;
    }

    if (!this.validatePasswords()) return false;
    if (!this.validateEmpresasAsignadas()) return false;
    if (!this.validateEmail()) return false;

    return true;
  }

  private validatePasswords(): boolean {
    const { password, password_confirmation } = this.usuarioForm.value;
    
    if (!this.editMode) {
      if (!password || !password_confirmation) {
        this.showError('La contraseña es obligatoria para crear un usuario');
        return false;
      }
      
      if (password.length < 6) {
        this.showError('La contraseña debe tener al menos 6 caracteres');
        return false;
      }
    }
    
    if (password || password_confirmation) {
      if (password !== password_confirmation) {
        this.showError('Las contraseñas no coinciden');
        return false;
      }
    }

    return true;
  }

  private validateEmpresasAsignadas(): boolean {
    if (this.empresasAsignadas.length === 0) {
      this.showError('Debes asignar al menos una empresa al usuario');
      return false;
    }

    for (const asignacion of this.empresasAsignadas) {
      if (!this.validateAsignacion(asignacion)) {
        return false;
      }
    }

    return true;
  }

  private validateAsignacion(asignacion: EmpresaAsignacion): boolean {
    const empresaValida = this.empresas.find(e => e.id === asignacion.empresa_id);
    if (!empresaValida) {
      this.showError('Una de las empresas asignadas no es válida');
      return false;
    }

    // Validación según el tipo de recursividad
    if (asignacion.recursivo) {
      // Si es recursivo, validar según el nivel
      if (!asignacion.sucursal_id) {
        // Recursivo a nivel empresa: empresa_id + recursivo=true + sucursal_id=null + sede_id=null
        if (asignacion.sede_id !== null) {
          this.showError('Una asignación recursiva de empresa no puede tener sede específica');
          return false;
        }
      } else {
        // Recursivo a nivel sucursal: empresa_id + sucursal_id + recursivo=true + sede_id=null
        if (asignacion.sede_id !== null) {
          this.showError('Una asignación recursiva de sucursal no puede tener sede específica');
          return false;
        }
        
        // Validar que la sucursal pertenezca a la empresa
        const sucursalValida = this.todasSucursales.find(s => 
          s.id === asignacion.sucursal_id && s.id_Empresa === asignacion.empresa_id
        );
        if (!sucursalValida) {
          this.showError('Una de las sucursales asignadas no pertenece a su empresa correspondiente');
          return false;
        }
      }
    } else {
      // Si NO es recursivo, validar asignaciones específicas
      if (asignacion.sucursal_id) {
        const sucursalValida = this.todasSucursales.find(s => 
          s.id === asignacion.sucursal_id && s.id_Empresa === asignacion.empresa_id
        );
        if (!sucursalValida) {
          this.showError('Una de las sucursales asignadas no pertenece a su empresa correspondiente');
          return false;
        }
      }

      if (asignacion.sede_id) {
        if (!asignacion.sucursal_id) {
          this.showError('No puedes asignar una sede sin especificar una sucursal');
          return false;
        }

        const sedeValida = this.todasSedes.find(s => 
          s.id === asignacion.sede_id && s.id_Sucursal === asignacion.sucursal_id
        );
        if (!sedeValida) {
          this.showError('Una de las sedes asignadas no pertenece a su sucursal correspondiente');
          return false;
        }
      }
    }

    return true;
  }

  private validateEmail(): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.usuarioForm.value.email)) {
      this.showError('El formato del correo electrónico no es válido');
      return false;
    }
    return true;
  }

  private buildUsuarioData(): any {
    const formValue = this.usuarioForm.value;
    
    // Asegurar que todos los campos sean strings válidos
    const usuarioData: any = {
      name: (formValue.name || '').toString().trim(),
      cargo: (formValue.cargo || '').toString().trim(),
      tipo_identificacion: (formValue.tipo_identificacion || '').toString(),
      numero_identificacion: (formValue.numero_identificacion || '').toString().trim(),
      direccion: (formValue.direccion || '').toString().trim(),
      telefono: (formValue.telefono || '').toString().trim(),
      email: (formValue.email || '').toString().trim().toLowerCase(),
      roles: Array.isArray(formValue.roles) ? formValue.roles : [],
      empresasAsignadas: this.empresasAsignadas.map(asignacion => {
        const empresaAsignada: any = {
          empresa_id: Number(asignacion.empresa_id),
          sucursal_id: asignacion.sucursal_id ? Number(asignacion.sucursal_id) : null,
          sede_id: null, // Inicializar como null
          recursivo: Boolean(asignacion.recursivo)
        };

        // Lógica de asignación según recursividad
        if (asignacion.recursivo) {
          // Si es recursivo, sede_id siempre es null
          // sucursal_id puede ser null (recursivo empresa) o tener valor (recursivo sucursal)
          empresaAsignada.sede_id = null;
        } else {
          // Si NO es recursivo, asignar sede_id si existe
          if (asignacion.sede_id !== null && asignacion.sede_id !== undefined) {
            empresaAsignada.sede_id = Number(asignacion.sede_id);
          }
        }

        return empresaAsignada;
      })
    };

    // Solo agregar contraseña si existe
    if (formValue.password && formValue.password.trim()) {
      usuarioData.password = formValue.password.trim();
      usuarioData.password_confirmation = formValue.password_confirmation?.trim() || '';
    }

    // DEBUG: Verificar datos procesados
    /* console.log('🔍 Datos procesados para envío:', {
      cargo: usuarioData.cargo,
      cargoType: typeof usuarioData.cargo,
      empresasAsignadas: usuarioData.empresasAsignadas,
      roles: usuarioData.roles
    });*/

    // DEBUG específico para empresas asignadas
    // console.log('📋 Empresas asignadas detalladas:');
    usuarioData.empresasAsignadas.forEach((emp: any, index: number) => {
      /* console.log(`  ${index}:`, {
        empresa_id: emp.empresa_id,
        sucursal_id: emp.sucursal_id,
        sede_id: emp.sede_id,
        recursivo: emp.recursivo,
        tipos: {
          empresa_id: typeof emp.empresa_id,
          sucursal_id: typeof emp.sucursal_id,
          sede_id: typeof emp.sede_id,
          recursivo: typeof emp.recursivo
        }
      });*/
    });

    return usuarioData;
  }

  private resetAfterSubmit(): void {
    this.usuarioForm.reset();
    this.showForm = false;
    this.editMode = false;
    this.currentUsuarioId = undefined;
    this.loadUsuarios();
    this.isSubmitting = false;
  }

  // ============================================
  // USER ACTIONS
  // ============================================

  deleteUsuario(usuario: Usuario): void {
    this.confirmationService.confirm({
      message: `¿Estás seguro de eliminar al usuario "${usuario.name}"?`,
      header: 'Confirmar Eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.usuarioService.deleteUsuario(usuario.id).subscribe({
          next: () => {
            this.showSuccess('Usuario eliminado exitosamente');
            this.loadUsuarios();
          },
          error: (error) => {
            console.error('Error eliminando usuario:', error);
            this.showError('Error al eliminar el usuario');
          }
        });
      }
    });
  }

  cambiarEstadoUsuario(usuario: Usuario): void {
    const nuevoEstado = !usuario.estado;
    const accion = nuevoEstado ? 'activar' : 'inactivar';
    const accionPasado = nuevoEstado ? 'activado' : 'inactivado';

    this.confirmationService.confirm({
      message: `¿Estás seguro de ${accion} al usuario "${usuario.name}"?`,
      header: `Confirmar ${accion.charAt(0).toUpperCase() + accion.slice(1)}`,
      icon: nuevoEstado ? 'pi pi-check-circle' : 'pi pi-times-circle',
      acceptLabel: `Sí, ${accion}`,
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: nuevoEstado ? 'p-button-success' : 'p-button-warning',
      accept: () => {
        this.usuarioService.cambiarEstadoUsuario(usuario.id, nuevoEstado).subscribe({
          next: () => {
            this.showSuccess(`Usuario ${accionPasado} exitosamente`);
            this.loadUsuarios();
          },
          error: (error) => {
            console.error(`Error ${accion}ndo usuario:`, error);
            this.showError(error.error?.message || `Error al ${accion} el usuario`);
          }
        });
      }
    });
  }

  // ============================================
  // MULTI-EMPRESA SYSTEM
  // ============================================

  onTempEmpresaChange(empresaId: number | null): void {
    this.tempEmpresa = empresaId;
    this.tempSucursal = null;
    this.tempSede = null;
    this.sucursales = [];
    this.sedes = [];

    if (empresaId) {
      this.loadSucursalesForTempEmpresa(empresaId);
    }
  }

  private loadSucursalesForTempEmpresa(empresaId: number): void {
    this.isLoadingSucursales = true;
    this.sucursalService.getSucursalesPorEmpresa(empresaId).subscribe({
      next: (sucursales) => {
        this.sucursales = sucursales;
        this.addToCollection(sucursales, this.todasSucursales);
        this.isLoadingSucursales = false;
        
        if (sucursales.length === 0) {
          this.showInfo('Esta empresa no tiene sucursales registradas');
        }
      },
      error: (error) => {
        console.error('Error cargando sucursales:', error);
        this.isLoadingSucursales = false;
        this.showError('Error al cargar las sucursales');
      }
    });
  }

  onTempSucursalChange(sucursalId: number | null): void {
    this.tempSucursal = sucursalId;
    this.tempSede = null;
    this.sedes = [];

    if (sucursalId) {
      this.loadSedesForTempSucursal(sucursalId);
    }
  }

  private loadSedesForTempSucursal(sucursalId: number): void {
    this.isLoadingSedes = true;
    this.sedeService.getSedesPorSucursal(sucursalId).subscribe({
      next: (sedes) => {
        this.sedes = sedes;
        this.addToCollection(sedes, this.todasSedes);
        this.isLoadingSedes = false;
        
        if (sedes.length === 0) {
          this.showInfo('Esta sucursal no tiene sedes registradas');
        }
      },
      error: (error) => {
        console.error('Error cargando sedes:', error);
        this.isLoadingSedes = false;
        this.showError('Error al cargar las sedes');
      }
    });
  }

  onTempSedeChange(sedeId: number | null): void {
    this.tempSede = sedeId;
  }

  agregarEmpresaAsignacion(): void {
    if (!this.tempEmpresa) {
      this.showWarning('Debes seleccionar una empresa');
      return;
    }

    // Verificar duplicación con lógica mejorada
    if (this.isAsignacionDuplicated()) {
      return; // El método ya muestra el mensaje apropiado
    }

    // Asegurar que recursivo sea un booleano válido
    const recursivo = Boolean(this.tempRecursivo);

    // DEBUG: Verificar el valor de tempRecursivo
    // console.log('🔍 DEBUG - Valores antes de crear asignación:');
    // console.log('  - tempEmpresa:', this.tempEmpresa);
    // console.log('  - tempSucursal:', this.tempSucursal);
    // console.log('  - tempSede:', this.tempSede);
    // console.log('  - tempRecursivo (original):', this.tempRecursivo);
    // console.log('  - recursivo (procesado):', recursivo);

    const nuevaAsignacion: EmpresaAsignacion = {
      empresa_id: Number(this.tempEmpresa),
      sucursal_id: this.tempSucursal ? Number(this.tempSucursal) : null,
      sede_id: (!recursivo && this.tempSede) ? Number(this.tempSede) : null, // Solo asignar sede si NO es recursivo
      recursivo: recursivo
    };

    // console.log('✅ Nueva asignación creada:', nuevaAsignacion);
    
    this.empresasAsignadas.push(nuevaAsignacion);
    
    this.loadRolesPorEmpresas();
    this.clearTempSelections();
  }

  private isAsignacionDuplicated(): boolean {
    // Verificar duplicación exacta
    const existeExacta = this.empresasAsignadas.some(asignacion => {
      return asignacion.empresa_id === this.tempEmpresa &&
             asignacion.sucursal_id === this.tempSucursal &&
             asignacion.sede_id === this.tempSede &&
             asignacion.recursivo === this.tempRecursivo;
    });

    if (existeExacta) {
      this.showWarning('Esta combinación ya existe');
      return true;
    }

    // Verificar conflictos de recursividad
    if (this.tempRecursivo) {
      // Si quiero agregar recursivo a nivel empresa (sin sucursal)
      if (!this.tempSucursal) {
        const existeEmpresaCompleta = this.empresasAsignadas.some(a => 
          a.empresa_id === this.tempEmpresa && a.recursivo && !a.sucursal_id
        );
        
        if (existeEmpresaCompleta) {
          this.showWarning('Ya existe una asignación recursiva completa para esta empresa');
          return true;
        }

        // Verificar si hay asignaciones específicas que serían redundantes
        const asignacionesEspecificas = this.empresasAsignadas.filter(a => 
          a.empresa_id === this.tempEmpresa && !a.recursivo
        );
        
        if (asignacionesEspecificas.length > 0) {
          this.showWarning('No puedes agregar recursivo completo cuando ya existen asignaciones específicas para esta empresa. Las asignaciones específicas serían redundantes.');
          return true;
        }
      } else {
        // Si quiero agregar recursivo a nivel sucursal
        const existeSucursalRecursiva = this.empresasAsignadas.some(a => 
          a.empresa_id === this.tempEmpresa && 
          a.sucursal_id === this.tempSucursal && 
          a.recursivo
        );
        
        if (existeSucursalRecursiva) {
          this.showWarning('Ya existe una asignación recursiva para esta sucursal');
          return true;
        }

        // Verificar si ya existe recursivo completo de empresa
        const existeEmpresaCompleta = this.empresasAsignadas.some(a => 
          a.empresa_id === this.tempEmpresa && a.recursivo && !a.sucursal_id
        );
        
        if (existeEmpresaCompleta) {
          this.showWarning('Ya existe una asignación recursiva completa para esta empresa que incluye todas las sucursales');
          return true;
        }
      }
    } else {
      // Si quiero agregar asignación específica (no recursiva)
      
      // Verificar si ya existe recursivo completo de empresa
      const existeEmpresaCompleta = this.empresasAsignadas.some(a => 
        a.empresa_id === this.tempEmpresa && a.recursivo && !a.sucursal_id
      );
      
      if (existeEmpresaCompleta) {
        this.showWarning('Ya existe una asignación recursiva completa para esta empresa que incluye todas las sucursales y sedes');
        return true;
      }

      // Si especifico sucursal, verificar si ya existe recursivo para esa sucursal
      if (this.tempSucursal) {
        const existeSucursalRecursiva = this.empresasAsignadas.some(a => 
          a.empresa_id === this.tempEmpresa && 
          a.sucursal_id === this.tempSucursal && 
          a.recursivo
        );
        
        if (existeSucursalRecursiva) {
          this.showWarning('Ya existe una asignación recursiva para esta sucursal que incluye todas las sedes');
          return true;
        }
      }
    }

    return false;
  }

  private clearTempSelections(): void {
    // console.log('🧹 Limpiando selecciones temporales...');
    // console.log('  - Antes: tempRecursivo =', this.tempRecursivo);
    
    this.tempEmpresa = null;
    this.tempSucursal = null;
    this.tempSede = null;
    this.tempRecursivo = false; // Resetear después de usar
    this.sucursales = [];
    this.sedes = [];
    
    // console.log('  - Después: tempRecursivo =', this.tempRecursivo);
  }

  eliminarEmpresaAsignacion(index: number): void {
    this.empresasAsignadas.splice(index, 1);
    this.loadRolesPorEmpresas();
    
    if (this.empresasAsignadas.length === 0) {
      this.usuarioForm.patchValue({ roles: [] });
    }
  }

  // ============================================
  // EMAIL VALIDATION
  // ============================================

  public onEmailBlur(): void {
    const emailControl = this.usuarioForm.get('email');
    const email = emailControl?.value;
    
    if (email && emailControl?.valid && !this.editMode) {
      this.checkEmailAvailability(email);
    }
  }

  private checkEmailAvailability(email: string): void {
    this.usuarioService.checkEmailExists(email).subscribe({
      next: (response) => {
        if (response.exists) {
          this.showWarning('Este correo electrónico ya está registrado. Por favor, usa un correo diferente.');
          // Marcar el campo como inválido
          this.usuarioForm.get('email')?.setErrors({ emailExists: true });
        } else {
          // Limpiar errores previos de email duplicado
          const emailControl = this.usuarioForm.get('email');
          if (emailControl?.hasError('emailExists')) {
            emailControl.setErrors(null);
          }
        }
      },
      error: (error) => {
        console.error('Error verificando email:', error);
      }
    });
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  getInitials(name: string): string {
    const names = name.split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  getRoleName(rolId: number): string {
    const rol = this.roles.find(r => r.id === rolId);
    return rol ? rol.nombre : 'Rol desconocido';
  }

  getRoleDescription(rolId: number): string {
    const rol = this.roles.find(r => r.id === rolId);
    return rol?.descripcion || 'Sin descripción';
  }

  getEmpresaNombre(empresaId: number): string {
    const empresa = this.empresas.find(e => e.id === empresaId);
    return empresa ? empresa.nombre : 'Empresa desconocida';
  }

  getEmpresasNombres(): string {
    const empresasIds = [...new Set(this.empresasAsignadas.map(a => a.empresa_id))];
    const nombres = empresasIds.map(id => this.getEmpresaNombre(id));
    
    if (nombres.length <= 2) {
      return nombres.join(' y ');
    } else {
      return nombres.slice(0, -1).join(', ') + ' y ' + nombres[nombres.length - 1];
    }
  }

  getSucursalNombre(sucursalId: number): string {
    const sucursal = this.todasSucursales.find(s => s.id === sucursalId);
    return sucursal ? sucursal.nombre : `Sucursal ID: ${sucursalId}`;
  }

  getSedeNombre(sedeId: number): string {
    const sede = this.todasSedes.find(s => s.id === sedeId);
    return sede ? sede.nombre : `Sede ID: ${sedeId}`;
  }

  isCurrentUserAdmin(): boolean {
    const currentUser = this.authService.currentUser;
    if (!currentUser?.roles) return false;
    
    return currentUser.roles.some((rol: any) => rol.es_admin === true);
  }

  // ============================================
  // TENANT SYNC
  // ============================================

  abrirSincronizarTenant(): void {
    this.showSincronizarTenant = true;
  }

  onUsuariosSincronizados(usuariosCreados: any[]): void {
    this.loadUsuarios();
    this.showSuccess(`Se sincronizaron ${usuariosCreados.length} usuario(s) del tenant`);
  }

  // ============================================
  // MESSAGE HELPERS
  // ============================================

  private showSuccess(message: string): void {
    this.messageService.add({
      severity: 'success',
      summary: 'Éxito',
      detail: message
    });
  }

  private showError(message: string): void {
    this.messageService.add({
      severity: 'error',
      summary: 'Error',
      detail: message,
      life: 5000
    });
  }

  private showWarning(message: string): void {
    this.messageService.add({
      severity: 'warn',
      summary: 'Advertencia',
      detail: message,
      life: 4000
    });
  }

  private showInfo(message: string): void {
    this.messageService.add({
      severity: 'info',
      summary: 'Información',
      detail: message,
      life: 3000
    });
  }

  private getErrorMessage(error: any): string {
    if (error.error?.message) {
      return error.error.message;
    } else if (error.error?.errors) {
      const errors = error.error.errors;
      // console.log('🔍 Errores de validación detallados:', errors);
      
      // Manejar específicamente el error de email duplicado
      if (errors.email) {
        const emailErrors = Array.isArray(errors.email) ? errors.email : [errors.email];
        if (emailErrors.some((err: string) => err.includes('already been taken') || err.includes('ya ha sido tomado') || err.includes('unique'))) {
          return 'Este correo electrónico ya está registrado. Por favor, usa un correo diferente.';
        }
        return `Error en el correo: ${emailErrors.join(', ')}`;
      }
      
      // Manejar otros errores de validación específicos
      if (errors.cargo) {
        return `Error en el cargo: ${Array.isArray(errors.cargo) ? errors.cargo.join(', ') : errors.cargo}`;
      }
      
      if (errors.empresasAsignadas) {
        // console.log('🔍 Error específico en empresasAsignadas:', errors.empresasAsignadas);
        
        // Si es un objeto con índices, extraer los errores específicos
        if (typeof errors.empresasAsignadas === 'object' && !Array.isArray(errors.empresasAsignadas)) {
          const empresaErrors: string[] = [];
          Object.keys(errors.empresasAsignadas).forEach(key => {
            const error = errors.empresasAsignadas[key];
            if (Array.isArray(error)) {
              empresaErrors.push(`Empresa ${key}: ${error.join(', ')}`);
            } else {
              empresaErrors.push(`Empresa ${key}: ${error}`);
            }
          });
          return `Errores en empresas asignadas:\n${empresaErrors.join('\n')}`;
        }
        
        return `Error en las empresas asignadas: ${Array.isArray(errors.empresasAsignadas) ? errors.empresasAsignadas.join(', ') : errors.empresasAsignadas}`;
      }
      
      // Para otros errores, mostrar todos
      const allErrors = Object.entries(errors).map(([field, fieldErrors]) => {
        const errorList = Array.isArray(fieldErrors) ? fieldErrors : [fieldErrors];
        return `${field}: ${errorList.join(', ')}`;
      });
      
      return `Errores de validación: ${allErrors.join(' | ')}`;
    } else if (error.message) {
      return error.message;
    }
    return 'Error desconocido';
  }
}
