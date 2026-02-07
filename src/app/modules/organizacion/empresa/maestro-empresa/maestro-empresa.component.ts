import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { EmpresaService, Empresa, CreateEmpresaRequest } from '../services/empresa.service';
import { AllowedDomainService, AllowedDomain } from '../services/allowed-domain.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';

// PrimeNG Imports
import { TableModule, Table } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TagModule } from 'primeng/tag';
import { AvatarModule } from 'primeng/avatar';
import { TooltipModule } from 'primeng/tooltip';
import { DropdownModule } from 'primeng/dropdown';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageService, ConfirmationService } from 'primeng/api';

@Component({
  selector: 'app-maestro-empresa',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    ReactiveFormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    DialogModule,
    ToastModule,
    ConfirmDialogModule,
    TagModule,
    AvatarModule,
    TooltipModule,
    DropdownModule,
    CheckboxModule,
    HasPermissionDirective
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './maestro-empresa.component.html',
  styleUrl: './maestro-empresa.component.css'
})
export class MaestroEmpresaComponent implements OnInit {
  @ViewChild('dt') dt!: Table;
  @ViewChild('dtDomains') dtDomains!: Table;
  
  activeTab: 'empresas' | 'dominios' = 'empresas';
  
  empresas: Empresa[] = [];
  empresaForm!: FormGroup;
  isLoading = false;
  isSubmitting = false;
  showForm = false;
  editMode = false;
  currentEmpresaId?: number;

  // Dominios
  domains: AllowedDomain[] = [];
  loadingDomains = false;
  showDomainDialog = false;
  editingDomain: AllowedDomain | null = null;
  domainForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private empresaService: EmpresaService,
    private allowedDomainService: AllowedDomainService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    public permissionService: PermissionService
  ) {
    this.initForm();
    this.initDomainForm();
  }

  // Métodos de verificación de permisos
  canCreate(): boolean {
    return this.permissionService.hasPermission('org-emp-crear');
  }

  canEdit(): boolean {
    return this.permissionService.hasPermission('org-emp-editar');
  }

  canDelete(): boolean {
    return this.permissionService.hasPermission('org-emp-eliminar');
  }

  canToggleStatus(): boolean {
    return this.permissionService.hasPermission('org-emp-toggle-estado');
  }

  canView(): boolean {
    return this.permissionService.hasPermission('org-emp-ver');
  }

  canExport(): boolean {
    return this.permissionService.hasPermission('org-emp-exportar');
  }

  canSearch(): boolean {
    return this.permissionService.hasPermission('org-emp-buscar');
  }

  ngOnInit(): void {
    this.loadEmpresas();
  }

  initForm(): void {
    this.empresaForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      prefijo: ['', [Validators.required]],
      nit: [null, [Validators.required]],
      telefono: [null, [Validators.required]],
      direccion: ['', [Validators.required]],
      rep_legal: ['', [Validators.required]],
      cc_rep_legal: [null, [Validators.required]],
      logo: [''],
      estado: [1]
    });
  }

  initDomainForm(): void {
    this.domainForm = this.fb.group({
      domain: ['', [Validators.required, Validators.pattern(/^@?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)]],
      tenant_id: ['', Validators.required],
      tenant_name: ['', [Validators.required, Validators.maxLength(255)]],
      id_empresa: [null],
      descripcion: [''],
      activo: [true]
    });
  }

  loadEmpresas(): void {
    this.isLoading = true;
    
    this.empresaService.getEmpresas().subscribe({
      next: (empresas) => {
        this.empresas = empresas;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error cargando empresas:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error al cargar las empresas'
        });
        this.isLoading = false;
        this.empresas = [];
      }
    });
  }

  toggleForm(): void {
    this.showForm = !this.showForm;
    if (!this.showForm) {
      this.empresaForm.reset({ estado: 1 });
      this.editMode = false;
      this.currentEmpresaId = undefined;
    }
  }

  onSubmit(): void {
    if (this.empresaForm.invalid) {
      this.empresaForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;

    const empresaData: CreateEmpresaRequest = this.empresaForm.value;

    if (this.editMode && this.currentEmpresaId) {
      this.empresaService.updateEmpresa(this.currentEmpresaId, empresaData).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Empresa actualizada exitosamente'
          });
          this.empresaForm.reset({ estado: 1 });
          this.showForm = false;
          this.editMode = false;
          this.loadEmpresas();
          this.isSubmitting = false;
        },
        error: (error) => {
          console.error('Error actualizando empresa:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: error.error?.message || 'Error al actualizar la empresa'
          });
          this.isSubmitting = false;
        }
      });
    } else {
      this.empresaService.createEmpresa(empresaData).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Empresa creada exitosamente'
          });
          this.empresaForm.reset({ estado: 1 });
          this.showForm = false;
          this.loadEmpresas();
          this.isSubmitting = false;
        },
        error: (error) => {
          console.error('Error creando empresa:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: error.error?.message || 'Error al crear la empresa'
          });
          this.isSubmitting = false;
        }
      });
    }
  }

  editEmpresa(empresa: Empresa): void {
    this.editMode = true;
    this.currentEmpresaId = empresa.id;
    this.empresaForm.patchValue(empresa);
    this.showForm = true;
  }

  toggleEstado(empresa: Empresa): void {
    this.confirmationService.confirm({
      message: `¿Estás seguro de ${empresa.estado === 1 ? 'desactivar' : 'activar'} la empresa "${empresa.nombre}"?`,
      header: 'Confirmar Cambio de Estado',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, continuar',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.empresaService.toggleEstado(empresa.id).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: 'Estado actualizado exitosamente'
            });
            this.loadEmpresas();
          },
          error: (error) => {
            console.error('Error cambiando estado:', error);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Error al cambiar el estado'
            });
          }
        });
      }
    });
  }

  deleteEmpresa(empresa: Empresa): void {
    this.confirmationService.confirm({
      message: `¿Estás seguro de eliminar la empresa "${empresa.nombre}"?`,
      header: 'Confirmar Eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.empresaService.deleteEmpresa(empresa.id).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: 'Empresa eliminada exitosamente'
            });
            this.loadEmpresas();
          },
          error: (error) => {
            console.error('Error eliminando empresa:', error);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Error al eliminar la empresa'
            });
          }
        });
      }
    });
  }

  getInitials(name: string): string {
    const words = name.split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  onGlobalFilter(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.dt.filterGlobal(input.value, 'contains');
  }

  reloadPermissions(): void {
    console.log('🔄 Recargando permisos manualmente...');
    this.permissionService.reloadPermissions();
    this.messageService.add({
      severity: 'info',
      summary: 'Recargando',
      detail: 'Revisa la consola para ver los logs'
    });
  }

  // ========== GESTIÓN DE DOMINIOS ==========

  loadDomains(): void {
    this.loadingDomains = true;
    this.allowedDomainService.getAll().subscribe({
      next: (response) => {
        console.log('Dominios cargados:', response);
        this.domains = response.domains || [];
        this.loadingDomains = false;
      },
      error: (error) => {
        console.error('Error al cargar dominios:', error);
        this.loadingDomains = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error al cargar los dominios permitidos'
        });
      }
    });
  }

  onGlobalFilterDomains(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.dtDomains.filterGlobal(input.value, 'contains');
  }

  openDomainDialog(domain?: AllowedDomain): void {
    this.editingDomain = domain || null;

    if (domain) {
      // Editar dominio existente
      this.domainForm.patchValue({
        domain: domain.domain,
        tenant_id: domain.tenant_id,
        tenant_name: domain.tenant_name,
        id_empresa: domain.id_empresa,
        descripcion: domain.descripcion,
        activo: domain.activo
      });
    } else {
      // Nuevo dominio
      this.domainForm.reset({
        activo: true
      });
    }

    this.showDomainDialog = true;
  }

  closeDomainDialog(): void {
    this.showDomainDialog = false;
    this.editingDomain = null;
    this.domainForm.reset();
  }

  saveDomain(): void {
    if (this.domainForm.invalid) {
      this.domainForm.markAllAsTouched();
      return;
    }

    const domainData = this.domainForm.value;

    // Asegurar que el dominio tenga @
    if (domainData.domain && !domainData.domain.startsWith('@')) {
      domainData.domain = '@' + domainData.domain;
    }

    if (this.editingDomain) {
      // Actualizar
      this.allowedDomainService.update(this.editingDomain.id, domainData).subscribe({
        next: (response) => {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Dominio actualizado exitosamente'
          });
          this.closeDomainDialog();
          this.loadDomains();
        },
        error: (error) => {
          console.error('Error al actualizar dominio:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: error.error?.message || 'Error al actualizar el dominio'
          });
        }
      });
    } else {
      // Crear
      this.allowedDomainService.create(domainData).subscribe({
        next: (response) => {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Dominio creado exitosamente'
          });
          this.closeDomainDialog();
          this.loadDomains();
        },
        error: (error) => {
          console.error('Error al crear dominio:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: error.error?.message || 'Error al crear el dominio'
          });
        }
      });
    }
  }

  deleteDomain(domain: AllowedDomain): void {
    this.confirmationService.confirm({
      message: `¿Estás seguro de eliminar el dominio "${domain.domain}"?`,
      header: 'Confirmar Eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.allowedDomainService.delete(domain.id).subscribe({
          next: (response) => {
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: 'Dominio eliminado exitosamente'
            });
            this.loadDomains();
          },
          error: (error) => {
            console.error('Error al eliminar dominio:', error);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: error.error?.message || 'Error al eliminar el dominio'
            });
          }
        });
      }
    });
  }

  toggleDomainStatus(domain: AllowedDomain): void {
    this.confirmationService.confirm({
      message: `¿Estás seguro de ${domain.activo ? 'desactivar' : 'activar'} el dominio "${domain.domain}"?`,
      header: 'Confirmar Cambio de Estado',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, continuar',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.allowedDomainService.toggleStatus(domain.id).subscribe({
          next: (response) => {
            const status = !domain.activo ? 'activado' : 'desactivado';
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: `Dominio ${status} exitosamente`
            });
            this.loadDomains();
          },
          error: (error) => {
            console.error('Error al cambiar estado del dominio:', error);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Error al cambiar el estado del dominio'
            });
          }
        });
      }
    });
  }
}
