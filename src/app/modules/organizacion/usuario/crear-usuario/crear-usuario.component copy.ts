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
  
  // Datos principales
  usuarios: Usuario[] = [];
  empresas: Empresa[] = [];
  roles: Rol[] = [];
  usuarioForm!: FormGroup;
  
  // Estados de carga
  isLoading = false;
  isSubmitting = false;
  isLoadingSucursales = false;
  isLoadingSedes = false;
  isLoadingEmpresas = false;
  isLoadingRoles = false;
  isLoadingForEdit = false;
  
  // Estados de datos cargados
  empresasCargadas = false;
  rolesCargados = false;
  
  // Estados del modal
  showForm = false;
  editMode = false;
  currentUsuarioId?: number;
  activeTabIndex = 0;
  
  // Sistema multi-empresa
  tempEmpresa: number | null = null;
  tempSucursal: number | null = null;
  tempSede: number | null = null;
  tempRecursivo: boolean = false;
  empresasAsignadas: any[] = [];
  
  // Datos temporales y globales
  sucursales: Sucursal[] = [];
  sedes: Sede[] = [];
  todasSucursales: Sucursal[] = [];
  todasSedes: Sede[] = [];
  
  // Sincronización con tenant
  showSincronizarTenant = false;
  
  // Tipos de identificación
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
  }

  initForm(): void {
    this.usuarioForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      tipo_identificacion: ['', [Validators.required]],
      numero_identificacion: ['', [Validators.required]],
      direccion: ['', [Validators.required]],
      telefono: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: [''],
      password_confirmation: [''],
      roles: [[]]
    });
  }

  loadEmpresas(): void {
    // OPTIMIZACIÓN: Evitar cargas duplicadas
    if (this.isLoadingEmpresas || this.empresasCargadas) {
      console.log('⚠️ Empresas ya están cargándose o ya están cargadas');
      return;
    }
    
    console.log('🔄 Cargando empresas...');
    this.isLoadingEmpresas = true;
    
    this.empresaService.getEmpresas().subscribe({
      next: (empresas) => {
        this.empresas = empresas;
        this.empresasCargadas = true;
        this.isLoadingEmpresas = false;
        console.log('✅ Empresas cargadas:', this.empresas.length, this.empresas);
      },
      error: (error) => {
        console.error('❌ Error cargando empresas:', error);
        this.isLoadingEmpresas = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error al cargar las empresas',
          life: 3000
        });
      }
    });
  }

  loadRoles(): void {
    // OPTIMIZACIÓN: Evitar cargas duplicadas
    if (this.isLoadingRoles || this.rolesCargados) {
      console.log('⚠️ Roles ya están cargándose o ya están cargados');
      return;
    }
    
    console.log('🔄 Cargando roles...');
    this.isLoadingRoles = true;
    
    this.rolService.getRoles().subscribe({
      next: (response: any) => {
        this.roles = response.data || response;
        this.rolesCargados = true;
        this.isLoadingRoles = false;
        console.log('✅ Roles cargados:', this.roles.length);
      },
      error: (error) => {
        console.error('❌ Error cargando roles:', error);
        this.isLoadingRoles = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error al cargar los roles',
          life: 3000
        });
      }
    });
  }

  /**
   * Cargar roles filtrados por empresa y módulos con permisos
   */
  loadRolesPorEmpresa(empresaId: number): void {
    console.log('🔄 Cargando roles para empresa ID:', empresaId);
    this.rolService.getRolesPorEmpresaConModulos(empresaId).subscribe({
      next: (response: any) => {
        this.roles = response.data || response;
        console.log('✅ Roles filtrados cargados:', this.roles.length, this.roles);
        
        // Mostrar mensaje si el usuario es administrador
        if (response.is_admin) {
          this.messageService.add({
            severity: 'info',
            summary: 'Acceso Completo',
            detail: 'Como administrador, tienes acceso a todos los roles del sistema',
            life: 4000
          });
        }
        
        // Si estamos en modo edición, verificar que los roles seleccionados sigan siendo válidos
        if (this.editMode) {
          const rolesSeleccionados = this.usuarioForm.get('roles')?.value || [];
          const rolesValidosIds = this.roles.map(r => r.id);
          const rolesValidosSeleccionados = rolesSeleccionados.filter((rolId: number) => 
            rolesValidosIds.includes(rolId)
          );
          
          if (rolesValidosSeleccionados.length !== rolesSeleccionados.length && !response.is_admin) {
            console.log('⚠️ Algunos roles seleccionados no están disponibles para esta empresa');
            this.usuarioForm.patchValue({ roles: rolesValidosSeleccionados });
            this.messageService.add({
              severity: 'warn',
              summary: 'Roles Actualizados',
              detail: 'Algunos roles no están disponibles para esta empresa y fueron removidos',
              life: 4000
            });
          }
        }
      },
      error: (error) => {
        console.error('❌ Error cargando roles por empresa:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error al cargar los roles para esta empresa',
          life: 3000
        });
      }
    });
  }

  /**
   * Cargar roles filtrados por múltiples empresas
   */
  loadRolesPorEmpresas(): void {
    if (this.empresasAsignadas.length === 0) {
      // Si no hay empresas asignadas, cargar todos los roles
      this.loadRoles();
      return;
    }

    // Obtener IDs únicos de empresas asignadas
    const empresasIds = [...new Set(this.empresasAsignadas.map(a => a.empresa_id))];
    console.log('🔄 Cargando roles para empresas IDs:', empresasIds);

    if (empresasIds.length === 1) {
      // Si solo hay una empresa, usar el método existente
      this.loadRolesPorEmpresa(empresasIds[0]);
      return;
    }

    // Para múltiples empresas, usar el nuevo endpoint
    console.log('🔄 Cargando roles para múltiples empresas:', empresasIds);
    this.rolService.getRolesPorMultiplesEmpresas(empresasIds).subscribe({
      next: (response: any) => {
        this.roles = response.data || response;
        console.log('✅ Roles filtrados para múltiples empresas cargados:', this.roles.length, this.roles);
        
        // Mostrar mensaje si el usuario es administrador
        if (response.is_admin) {
          this.messageService.add({
            severity: 'info',
            summary: 'Acceso Completo',
            detail: 'Como administrador, tienes acceso a todos los roles del sistema',
            life: 4000
          });
        } else {
          // Mostrar mensaje informativo sobre el filtrado
          const empresasNombres = empresasIds.map(id => this.getEmpresaNombre(id)).join(', ');
          this.messageService.add({
            severity: 'info',
            summary: 'Roles Filtrados',
            detail: `Mostrando roles disponibles para: ${empresasNombres}`,
            life: 4000
          });
        }
        
        // Si estamos en modo edición, verificar que los roles seleccionados sigan siendo válidos
        if (this.editMode) {
          const rolesSeleccionados = this.usuarioForm.get('roles')?.value || [];
          const rolesValidosIds = this.roles.map(r => r.id);
          const rolesValidosSeleccionados = rolesSeleccionados.filter((rolId: number) => 
            rolesValidosIds.includes(rolId)
          );
          
          if (rolesValidosSeleccionados.length !== rolesSeleccionados.length && !response.is_admin) {
            console.log('⚠️ Algunos roles seleccionados no están disponibles para estas empresas');
            this.usuarioForm.patchValue({ roles: rolesValidosSeleccionados });
            this.messageService.add({
              severity: 'warn',
              summary: 'Roles Actualizados',
              detail: 'Algunos roles no están disponibles para estas empresas y fueron removidos',
              life: 4000
            });
          }
        }
      },
      error: (error) => {
        console.error('❌ Error cargando roles por múltiples empresas:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error al cargar los roles para estas empresas',
          life: 3000
        });
      }
    });
  }



  loadUsuarios(): void {
    console.log('🔄 Cargando usuarios...');
    this.isLoading = true;
    
    this.usuarioService.getUsuarios().subscribe({
      next: (usuarios) => {
        console.log('✅ Usuarios cargados:', usuarios);
        console.log('🔍 Primer usuario completo:', usuarios[0]);
        if (usuarios[0]) {
          console.log('🔍 Campo cargo del primer usuario:', usuarios[0].cargo);
        }
        this.usuarios = usuarios;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ Error cargando usuarios:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error al cargar los usuarios. Por favor, intenta nuevamente.',
          life: 5000
        });
        this.isLoading = false;
        this.usuarios = [];
      }
    });
  }

  toggleForm(): void {
    this.showForm = !this.showForm;
    if (!this.showForm) {
      this.usuarioForm.reset();
      this.editMode = false;
      this.currentUsuarioId = undefined;
      this.isLoadingForEdit = false; // Resetear indicador de carga para edición
      this.activeTabIndex = 0; // Resetear a la primera pestaña
      // Resetear validaciones de contraseña
      this.usuarioForm.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
      this.usuarioForm.get('password_confirmation')?.setValidators([Validators.required]);
      
      // Limpiar datos temporales de empresas
      this.tempEmpresa = null;
      this.tempSucursal = null;
      this.tempSede = null;
      this.tempRecursivo = false;
      this.empresasAsignadas = [];
      this.sucursales = [];
      this.sedes = [];
    } else {
      // OPTIMIZACIÓN: Cargar datos solo cuando se abre el modal y si no están cargados
      console.log('🚀 Abriendo modal - verificando datos necesarios...');
      
      // Cargar empresas solo si no están cargadas
      if (!this.empresasCargadas && !this.isLoadingEmpresas) {
        console.log('📦 Cargando empresas (lazy loading)...');
        this.loadEmpresas();
      }
      
      // Cargar roles solo si no están cargados
      if (!this.rolesCargados && !this.isLoadingRoles) {
        console.log('🔐 Cargando roles (lazy loading)...');
        this.loadRoles();
      }
      
      // Si hay empresas asignadas, cargar roles filtrados
      if (this.empresasAsignadas.length > 0) {
        this.loadRolesPorEmpresas();
      }
    }
  }

  editUsuario(usuario: Usuario): void {
    this.editMode = true;
    this.currentUsuarioId = usuario.id;
    this.isLoadingForEdit = true; // Indicar que estamos cargando para edición
    
    // En modo edición, la contraseña es opcional
    this.usuarioForm.get('password')?.clearValidators();
    this.usuarioForm.get('password_confirmation')?.clearValidators();
    this.usuarioForm.get('password')?.updateValueAndValidity();
    this.usuarioForm.get('password_confirmation')?.updateValueAndValidity();
    
    // OPTIMIZACIÓN: Asegurar que empresas y roles estén cargados antes de procesar
    const cargarDatosYProcesar = () => {
      // Obtener IDs de roles desde el backend
      const roleIds = usuario.roles?.map((r: any) => {
        // Si el rol es un string (nombre), buscar el ID en la lista de roles
        if (typeof r === 'string') {
          const rol = this.roles.find(role => role.nombre === r);
          return rol ? rol.id : null;
        }
        // Si ya es un objeto con ID, usar el ID
        return r.id || r;
      }).filter(id => id !== null) || [];
      
      console.log('Usuario a editar:', usuario);
      console.log('Campo cargo del usuario:', usuario.cargo);
      console.log('Tipo de campo cargo:', typeof usuario.cargo);
      console.log('¿Campo cargo es undefined?:', usuario.cargo === undefined);
      console.log('¿Campo cargo es null?:', usuario.cargo === null);
      console.log('¿Campo cargo es string vacío?:', usuario.cargo === '');
      console.log('Roles del usuario:', usuario.roles);
      console.log('IDs de roles mapeados:', roleIds);
      
      const cargoValue = usuario.cargo === null || usuario.cargo === undefined ? '' : usuario.cargo;
      console.log('🔍 Procesando cargo:', {
        original: usuario.cargo,
        processed: cargoValue,
        type: typeof cargoValue
      });

      this.usuarioForm.patchValue({
        name: usuario.name,
        cargo: cargoValue,
        tipo_identificacion: (usuario as any).tipo_identificacion || '',
        numero_identificacion: (usuario as any).numero_identificacion || '',
        direccion: (usuario as any).direccion || '',
        telefono: (usuario as any).telefono || '',
        email: usuario.email,
        password: '', // Limpiar campo de contraseña
        password_confirmation: '', // Limpiar campo de confirmación
        roles: roleIds
      });

      console.log('🔍 Valores después del patchValue:');
      console.log('  - cargo form value:', this.usuarioForm.get('cargo')?.value);
      console.log('  - cargo form control:', this.usuarioForm.get('cargo'));

      // Cargar empresas asignadas existentes
      if (usuario.empresas && usuario.empresas.length > 0) {
        this.empresasAsignadas = [];
        
        // Procesar cada empresa asignada
        for (const empresa of usuario.empresas) {
          const pivot = (empresa as any).pivot;
          const asignacion = {
            empresa_id: empresa.id,
            sucursal_id: pivot?.id_sucursal || null,
            sede_id: pivot?.id_sede || null,
            recursivo: pivot?.recursivo || false
          };
          
          this.empresasAsignadas.push(asignacion);
          
          // Cargar sucursales de esta empresa si no están ya cargadas
          if (!this.todasSucursales.find(s => s.id_Empresa === empresa.id)) {
            this.sucursalService.getSucursalesPorEmpresa(empresa.id).subscribe({
              next: (sucursales) => {
                sucursales.forEach(sucursal => {
                  if (!this.todasSucursales.find(s => s.id === sucursal.id)) {
                    this.todasSucursales.push(sucursal);
                  }
                });
              },
              error: (error) => {
                console.error('Error cargando sucursales en edición:', error);
              }
            });
          }
          
          // Cargar sedes de la sucursal si existe
          if (asignacion.sucursal_id && !this.todasSedes.find(s => s.id_Sucursal === asignacion.sucursal_id)) {
            this.sedeService.getSedesPorSucursal(asignacion.sucursal_id).subscribe({
              next: (sedes) => {
                sedes.forEach(sede => {
                  if (!this.todasSedes.find(s => s.id === sede.id)) {
                    this.todasSedes.push(sede);
                  }
                });
              },
              error: (error) => {
                console.error('Error cargando sedes en edición:', error);
              }
            });
          }
        }
        
        console.log('✅ Empresas asignadas cargadas para edición:', this.empresasAsignadas);
        
        // Cargar roles filtrados por las empresas asignadas
        this.loadRolesPorEmpresas();
      }
      
      this.isLoadingForEdit = false; // Terminar indicador de carga
      this.showForm = true;
    };

    // Verificar si necesitamos cargar empresas primero
    if (!this.empresasCargadas && !this.isLoadingEmpresas) {
      console.log('📦 Cargando empresas para edición...');
      this.empresaService.getEmpresas().subscribe({
        next: (empresas) => {
          this.empresas = empresas;
          this.empresasCargadas = true;
          console.log('✅ Empresas cargadas para edición:', this.empresas.length);
          
          // Ahora cargar roles si es necesario
          if (!this.rolesCargados && !this.isLoadingRoles) {
            console.log('🔐 Cargando roles para edición...');
            this.rolService.getRoles().subscribe({
              next: (response: any) => {
                this.roles = response.data || response;
                this.rolesCargados = true;
                console.log('✅ Roles cargados para edición:', this.roles.length);
                cargarDatosYProcesar();
              },
              error: (error) => {
                console.error('❌ Error cargando roles para edición:', error);
                this.isLoadingForEdit = false; // Resetear indicador en caso de error
                this.messageService.add({
                  severity: 'error',
                  summary: 'Error',
                  detail: 'Error al cargar los roles para edición',
                  life: 3000
                });
              }
            });
          } else {
            cargarDatosYProcesar();
          }
        },
        error: (error) => {
          console.error('❌ Error cargando empresas para edición:', error);
          this.isLoadingForEdit = false; // Resetear indicador en caso de error
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Error al cargar las empresas para edición',
            life: 3000
          });
        }
      });
    } else if (!this.rolesCargados && !this.isLoadingRoles) {
      // Las empresas están cargadas, pero necesitamos roles
      console.log('🔐 Cargando roles para edición...');
      this.rolService.getRoles().subscribe({
        next: (response: any) => {
          this.roles = response.data || response;
          this.rolesCargados = true;
          console.log('✅ Roles cargados para edición:', this.roles.length);
          cargarDatosYProcesar();
        },
        error: (error) => {
          console.error('❌ Error cargando roles para edición:', error);
          this.isLoadingForEdit = false; // Resetear indicador en caso de error
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Error al cargar los roles para edición',
            life: 3000
          });
        }
      });
    } else {
      // Tanto empresas como roles están cargados
      cargarDatosYProcesar();
    }
  }

  onSubmit(): void {
    // Validar formulario
    if (this.usuarioForm.invalid) {
      this.usuarioForm.markAllAsTouched();
      this.messageService.add({
        severity: 'warn',
        summary: 'Formulario Incompleto',
        detail: 'Por favor completa todos los campos obligatorios',
        life: 4000
      });
      return;
    }

    const { password, password_confirmation } = this.usuarioForm.value;
    
    // Validar contraseñas en modo creación
    if (!this.editMode) {
      if (!password || !password_confirmation) {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'La contraseña es obligatoria para crear un usuario',
          life: 4000
        });
        return;
      }
      
      if (password.length < 6) {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'La contraseña debe tener al menos 6 caracteres',
          life: 4000
        });
        return;
      }
    }
    
    // Validar contraseñas solo si se proporcionaron
    if (password || password_confirmation) {
      if (password !== password_confirmation) {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Las contraseñas no coinciden',
          life: 4000
        });
        return;
      }
    }

    // Esta validación se hace más abajo con empresasAsignadas

    // Validar empresas asignadas
    if (this.empresasAsignadas.length === 0) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Debes asignar al menos una empresa al usuario',
        life: 4000
      });
      return;
    }

    // Validar que cada asignación de empresa sea válida
    for (const asignacion of this.empresasAsignadas) {
      // Validar empresa
      const empresaValida = this.empresas.find(e => e.id === asignacion.empresa_id);
      if (!empresaValida) {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Una de las empresas asignadas no es válida',
          life: 4000
        });
        return;
      }

      // Validar sucursal (si se especificó)
      if (asignacion.sucursal_id) {
        const sucursalValida = this.todasSucursales.find(s => 
          s.id === asignacion.sucursal_id && s.id_Empresa === asignacion.empresa_id
        );
        if (!sucursalValida) {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Una de las sucursales asignadas no pertenece a su empresa correspondiente',
            life: 4000
          });
          return;
        }
      }

      // Validar sede (si se especificó)
      if (asignacion.sede_id) {
        if (!asignacion.sucursal_id) {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No puedes asignar una sede sin especificar una sucursal',
            life: 4000
          });
          return;
        }

        const sedeValida = this.todasSedes.find(s => 
          s.id === asignacion.sede_id && s.id_Sucursal === asignacion.sucursal_id
        );
        if (!sedeValida) {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Una de las sedes asignadas no pertenece a su sucursal correspondiente',
            life: 4000
          });
          return;
        }
      }
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.usuarioForm.value.email)) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'El formato del correo electrónico no es válido',
        life: 4000
      });
      return;
    }

    this.isSubmitting = true;

    const usuarioData: any = {
      name: this.usuarioForm.value.name.trim(),
      tipo_identificacion: this.usuarioForm.value.tipo_identificacion,
      numero_identificacion: this.usuarioForm.value.numero_identificacion.trim(),
      direccion: this.usuarioForm.value.direccion.trim(),
      telefono: this.usuarioForm.value.telefono.trim(),
      email: this.usuarioForm.value.email.trim().toLowerCase(),
      roles: this.usuarioForm.value.roles || [],
      empresasAsignadas: this.empresasAsignadas
    };

    // Solo incluir contraseña si se proporcionó
    if (password) {
      usuarioData.password = password;
      usuarioData.password_confirmation = password_confirmation;
    }

    console.log('📤 Datos a enviar:', usuarioData);
    console.log('🔧 Modo edición:', this.editMode);
    console.log('🆔 ID Usuario:', this.currentUsuarioId);

    if (this.editMode && this.currentUsuarioId) {
      // Actualizar usuario
      console.log('🔄 Actualizando usuario ID:', this.currentUsuarioId);
      this.usuarioService.updateUsuario(this.currentUsuarioId, usuarioData).subscribe({
        next: (response) => {
          console.log('✅ Usuario actualizado exitosamente:', response);
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Usuario actualizado exitosamente'
          });
          this.usuarioForm.reset();
          this.showForm = false;
          this.editMode = false;
          this.currentUsuarioId = undefined;
          this.loadUsuarios();
          this.isSubmitting = false;
        },
        error: (error) => {
          console.error('❌ Error actualizando usuario:', error);
          console.error('❌ Error completo:', JSON.stringify(error, null, 2));
          
          let errorMessage = 'Error al actualizar el usuario';
          
          if (error.error?.message) {
            errorMessage = error.error.message;
          } else if (error.error?.errors) {
            // Si hay errores de validación del backend
            const errors = Object.values(error.error.errors).flat();
            errorMessage = errors.join(', ');
          } else if (error.message) {
            errorMessage = error.message;
          }
          
          this.messageService.add({
            severity: 'error',
            summary: 'Error al Actualizar',
            detail: errorMessage,
            life: 5000
          });
          this.isSubmitting = false;
        }
      });
    } else {
      // Crear usuario
      this.usuarioService.createUsuario(usuarioData).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Usuario creado exitosamente'
          });
          this.usuarioForm.reset();
          this.showForm = false;
          this.loadUsuarios();
          this.isSubmitting = false;
        },
        error: (error) => {
          console.error('Error creando usuario:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: error.error?.message || 'Error al crear el usuario'
          });
          this.isSubmitting = false;
        }
      });
    }
  }

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
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: 'Usuario eliminado exitosamente'
            });
            this.loadUsuarios();
          },
          error: (error) => {
            console.error('Error eliminando usuario:', error);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Error al eliminar el usuario'
            });
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
          next: (response) => {
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: `Usuario ${accionPasado} exitosamente`
            });
            this.loadUsuarios();
          },
          error: (error) => {
            console.error(`Error ${accion}ndo usuario:`, error);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: error.error?.message || `Error al ${accion} el usuario`
            });
          }
        });
      }
    });
  }

  getInitials(name: string): string {
    const names = name.split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  // Obtener nombre del rol por ID
  getRoleName(rolId: number): string {
    const rol = this.roles.find(r => r.id === rolId);
    return rol ? rol.nombre : 'Rol desconocido';
  }

  // Obtener descripción del rol por ID
  getRoleDescription(rolId: number): string {
    const rol = this.roles.find(r => r.id === rolId);
    return rol?.descripcion || 'Sin descripción';
  }

  // ============================================
  // MÉTODOS PARA MULTI-EMPRESA SYSTEM
  // ============================================

  onTempEmpresaChange(empresaId: number | null): void {
    console.log('📍 Empresa temporal seleccionada:', empresaId);
    console.log('🔍 Tipo de empresaId:', typeof empresaId);
    console.log('🔍 Empresas disponibles:', this.empresas);
    
    // Actualizar tempEmpresa ANTES de hacer cualquier otra cosa
    this.tempEmpresa = empresaId;
    console.log('🔄 tempEmpresa actualizada a:', this.tempEmpresa);
    
    this.tempSucursal = null;
    this.tempSede = null;
    this.sucursales = [];
    this.sedes = [];

    if (empresaId) {
      this.isLoadingSucursales = true;
      console.log('🔄 Cargando sucursales para empresa temporal ID:', empresaId);
      console.log('🔍 SucursalService disponible:', !!this.sucursalService);
      
      this.sucursalService.getSucursalesPorEmpresa(empresaId).subscribe({
        next: (sucursales) => {
          console.log('📦 Respuesta del servidor (sucursales temporales):', sucursales);
          this.sucursales = sucursales;
          // Agregar a la lista completa si no existen
          sucursales.forEach(sucursal => {
            if (!this.todasSucursales.find(s => s.id === sucursal.id)) {
              this.todasSucursales.push(sucursal);
            }
          });
          this.isLoadingSucursales = false;
          console.log('✅ Sucursales cargadas para empresa temporal:', this.sucursales.length, this.sucursales);
          console.log('📋 Total sucursales en memoria:', this.todasSucursales.length);
          console.log('🔍 Estado después de cargar sucursales:');
          console.log('   - tempEmpresa:', this.tempEmpresa);
          console.log('   - sucursales.length:', this.sucursales.length);
          console.log('   - isLoadingSucursales:', this.isLoadingSucursales);
          
          if (this.sucursales.length === 0) {
            this.messageService.add({
              severity: 'info',
              summary: 'Información',
              detail: 'Esta empresa no tiene sucursales registradas',
              life: 3000
            });
          }
        },
        error: (error) => {
          console.error('❌ Error completo cargando sucursales temporales:', error);
          console.error('❌ Status:', error.status);
          console.error('❌ Message:', error.message);
          console.error('❌ Error object:', JSON.stringify(error, null, 2));
          this.isLoadingSucursales = false;
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: `Error al cargar las sucursales: ${error.error?.message || error.message || 'Error desconocido'}`,
            life: 5000
          });
        }
      });
    }
  }

  onTempSucursalChange(sucursalId: number | null): void {
    console.log('🏢 Sucursal temporal seleccionada:', sucursalId);
    
    // Actualizar tempSucursal ANTES de hacer cualquier otra cosa
    this.tempSucursal = sucursalId;
    console.log('🔄 tempSucursal actualizada a:', this.tempSucursal);
    
    this.tempSede = null;
    this.sedes = [];

    if (sucursalId) {
      this.isLoadingSedes = true;
      console.log('🔄 Cargando sedes para sucursal temporal ID:', sucursalId);
      
      this.sedeService.getSedesPorSucursal(sucursalId).subscribe({
        next: (sedes) => {
          console.log('📦 Respuesta del servidor (sedes temporales):', sedes);
          this.sedes = sedes;
          // Agregar a la lista completa si no existen
          sedes.forEach(sede => {
            if (!this.todasSedes.find(s => s.id === sede.id)) {
              this.todasSedes.push(sede);
            }
          });
          this.isLoadingSedes = false;
          console.log('✅ Sedes cargadas para sucursal temporal:', this.sedes.length, this.sedes);
          console.log('📋 Total sedes en memoria:', this.todasSedes.length);
          console.log('🔍 Estado después de cargar sedes:');
          console.log('   - tempSucursal:', this.tempSucursal);
          console.log('   - sedes.length:', this.sedes.length);
          console.log('   - isLoadingSedes:', this.isLoadingSedes);
          
          if (this.sedes.length === 0) {
            this.messageService.add({
              severity: 'info',
              summary: 'Información',
              detail: 'Esta sucursal no tiene sedes registradas',
              life: 3000
            });
          }
        },
        error: (error) => {
          console.error('❌ Error completo cargando sedes temporales:', error);
          console.error('❌ Status:', error.status);
          console.error('❌ Message:', error.message);
          console.error('❌ Error object:', JSON.stringify(error, null, 2));
          this.isLoadingSedes = false;
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: `Error al cargar las sedes: ${error.error?.message || error.message || 'Error desconocido'}`,
            life: 5000
          });
        }
      });
    }
  }

  onTempSedeChange(sedeId: number | null): void {
    console.log('🏛️ Sede temporal seleccionada:', sedeId);
    
    // Actualizar tempSede
    this.tempSede = sedeId;
    console.log('🔄 tempSede actualizada a:', this.tempSede);
    
    if (sedeId) {
      // Verificar que la sede existe en las listas
      const sedeEnSedes = this.sedes.find(s => s.id === sedeId);
      const sedeEnTodasSedes = this.todasSedes.find(s => s.id === sedeId);
      
      console.log('🔍 Verificando sede seleccionada:');
      console.log('  - Sede en this.sedes:', sedeEnSedes ? sedeEnSedes.nombre : 'NO ENCONTRADA');
      console.log('  - Sede en this.todasSedes:', sedeEnTodasSedes ? sedeEnTodasSedes.nombre : 'NO ENCONTRADA');
      
      // Si no está en todasSedes, agregarla
      if (sedeEnSedes && !sedeEnTodasSedes) {
        this.todasSedes.push(sedeEnSedes);
        console.log('➕ Sede agregada a todasSedes inmediatamente:', sedeEnSedes.nombre);
      }
    }
  }

  agregarEmpresaAsignacion(): void {
    if (!this.tempEmpresa) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'Debes seleccionar una empresa',
        life: 3000
      });
      return;
    }

    // Verificar si ya existe esta combinación
    const existe = this.empresasAsignadas.some(asignacion => 
      asignacion.empresa_id === this.tempEmpresa &&
      asignacion.sucursal_id === this.tempSucursal &&
      asignacion.sede_id === this.tempSede
    );

    if (existe) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'Esta combinación ya existe',
        life: 3000
      });
      return;
    }

    const nuevaAsignacion = {
      empresa_id: this.tempEmpresa,
      sucursal_id: this.tempSucursal,
      sede_id: this.tempSede,
      recursivo: this.tempRecursivo
    };

    console.log('📋 Nueva asignación creada:', nuevaAsignacion);
    console.log('📋 Tipos de datos:');
    console.log('  - empresa_id:', nuevaAsignacion.empresa_id, '(tipo:', typeof nuevaAsignacion.empresa_id, ')');
    console.log('  - sucursal_id:', nuevaAsignacion.sucursal_id, '(tipo:', typeof nuevaAsignacion.sucursal_id, ')');
    console.log('  - sede_id:', nuevaAsignacion.sede_id, '(tipo:', typeof nuevaAsignacion.sede_id, ')');

    // CRÍTICO: Sincronizar sedes ANTES de agregar la asignación
    if (this.tempSede && this.sedes.length > 0) {
      console.log('🏢 Sincronizando sedes antes de agregar asignación');
      console.log('🏢 Sedes en this.sedes:', this.sedes.map(s => ({id: s.id, nombre: s.nombre, tipo: typeof s.id})));
      
      this.sedes.forEach(sede => {
        if (!this.todasSedes.find(s => s.id === sede.id)) {
          this.todasSedes.push(sede);
          console.log('➕ Sede sincronizada a todasSedes:', sede.nombre, '(ID:', sede.id, ')');
        }
      });
      
      console.log('🏢 Total sedes en todasSedes después de sincronizar:', this.todasSedes.length);
    }

    this.empresasAsignadas.push(nuevaAsignacion);

    // Verificar INMEDIATAMENTE después de agregar
    console.log('🔍 Verificación inmediata:');
    if (nuevaAsignacion.sede_id) {
      const sedeEncontrada = this.todasSedes.find(s => s.id === nuevaAsignacion.sede_id);
      console.log('  - Buscando sede ID:', nuevaAsignacion.sede_id);
      console.log('  - Sede encontrada:', sedeEncontrada ? sedeEncontrada.nombre : 'NO ENCONTRADA');
      
      if (!sedeEncontrada) {
        console.log('  - Todas las sedes en todasSedes:');
        this.todasSedes.forEach(s => console.log(`    * ${s.id} (${typeof s.id}): ${s.nombre}`));
      }
    }

    // Actualizar roles disponibles basándose en todas las empresas asignadas
    this.loadRolesPorEmpresas();

    // Limpiar formulario temporal
    this.tempEmpresa = null;
    this.tempSucursal = null;
    this.tempSede = null;
    this.tempRecursivo = false;
    this.sucursales = [];
    this.sedes = [];

    console.log('✅ Empresa asignada:', nuevaAsignacion);
    console.log('📋 Total asignaciones:', this.empresasAsignadas.length);
  }

  eliminarEmpresaAsignacion(index: number): void {
    this.empresasAsignadas.splice(index, 1);
    console.log('🗑️ Asignación eliminada. Total restante:', this.empresasAsignadas.length);
    
    // Actualizar roles disponibles basándose en las empresas restantes
    this.loadRolesPorEmpresas();
    
    // Si no quedan empresas, limpiar roles seleccionados
    if (this.empresasAsignadas.length === 0) {
      this.usuarioForm.patchValue({ roles: [] });
    }
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
    console.log('🔍 getSucursalNombre llamado con ID:', sucursalId, '(tipo:', typeof sucursalId, ')');
    const sucursal = this.todasSucursales.find(s => {
      const match = s.id === sucursalId;
      console.log('  - Comparando sucursal:', s.id, '(tipo:', typeof s.id, ') === ', sucursalId, '(tipo:', typeof sucursalId, ') =', match);
      return match;
    });
    
    if (sucursal) {
      console.log('✅ Sucursal encontrada:', sucursal.nombre);
      return sucursal.nombre;
    } else {
      console.warn('❌ Sucursal NO encontrada para ID:', sucursalId);
      console.log('📋 Sucursales disponibles:', this.todasSucursales.map(s => ({id: s.id, nombre: s.nombre, tipo: typeof s.id})));
      return `Sucursal ID: ${sucursalId}`;
    }
  }

  getSedeNombre(sedeId: number): string {
    console.log('🔍 getSedeNombre llamado con ID:', sedeId, '(tipo:', typeof sedeId, ')');
    const sede = this.todasSedes.find(s => {
      const match = s.id === sedeId;
      console.log('  - Comparando sede:', s.id, '(tipo:', typeof s.id, ') === ', sedeId, '(tipo:', typeof sedeId, ') =', match);
      return match;
    });
    
    if (sede) {
      console.log('✅ Sede encontrada:', sede.nombre);
      return sede.nombre;
    } else {
      console.warn('❌ Sede NO encontrada para ID:', sedeId);
      console.log('📋 Sedes disponibles:', this.todasSedes.map(s => ({id: s.id, nombre: s.nombre, tipo: typeof s.id})));
      return `Sede ID: ${sedeId}`;
    }
  }



  /**
   * Verificar si el usuario actual es administrador
   */
  isCurrentUserAdmin(): boolean {
    const currentUser = this.authService.currentUser;
    if (!currentUser || !currentUser.roles) {
      return false;
    }
    
    // Verificar si tiene algún rol de administrador
    return currentUser.roles.some((rol: any) => rol.es_admin === true);
  }

  // Métodos para sincronización con tenant
  abrirSincronizarTenant(): void {
    this.showSincronizarTenant = true;
  }

  onUsuariosSincronizados(usuariosCreados: any[]): void {
    // Recargar la lista de usuarios
    this.loadUsuarios();
    
    // Mostrar mensaje de éxito
    this.messageService.add({
      severity: 'success',
      summary: 'Sincronización exitosa',
      detail: `Se sincronizaron ${usuariosCreados.length} usuario(s) del tenant`
    });
  }
}
