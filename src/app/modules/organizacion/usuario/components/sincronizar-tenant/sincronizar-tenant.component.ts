import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageService } from 'primeng/api';
import { UsuarioService } from '../../services/usuario.service';

interface UsuarioTenant {
  microsoft_id: string;
  name: string;
  email: string;
  job_title: string;
  department: string;
  account_enabled: boolean;
  exists_in_app: boolean;
  selected?: boolean;
}

@Component({
  selector: 'app-sincronizar-tenant',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    TableModule,
    CheckboxModule,
    InputTextModule,
    TagModule,
    ToastModule,
    ProgressSpinnerModule
  ],
  providers: [MessageService],
  template: `
    <p-toast></p-toast>
    
    <p-dialog 
      [(visible)]="visible" 
      [header]="'Sincronizar Usuarios del Tenant'" 
      [modal]="true" 
      [style]="{width: '90vw', maxWidth: '1200px'}"
      [breakpoints]="{'960px': '95vw'}"
      [contentStyle]="{height: '70vh', overflow: 'auto'}"
      (onHide)="onClose()">
      
      <div class="p-fluid">
        <!-- Botón para cargar usuarios -->
        <div class="row mb-4">
          <div class="col-12 d-flex justify-content-center">
            <p-button 
              label="Cargar Usuarios del Tenant"
              icon="pi pi-refresh"
              (onClick)="cargarUsuariosTenant()"
              [loading]="isLoadingUsers"
              size="large">
            </p-button>
          </div>
        </div>

        <!-- Loading spinner -->
        <div class="text-center py-5" *ngIf="isLoadingUsers">
          <p-progressSpinner></p-progressSpinner>
          <p class="mt-3 text-muted">Obteniendo usuarios del tenant...</p>
        </div>

        <!-- Tabla de usuarios del tenant -->
        <div *ngIf="usuariosTenant.length > 0 && !isLoadingUsers">
          <p-table 
            #dt
            [value]="usuariosTenant"
            [paginator]="true"
            [rows]="10"
            [showCurrentPageReport]="true"
            [rowsPerPageOptions]="[10, 25, 50, 100]"
            [globalFilterFields]="['name', 'email', 'job_title', 'department']"
            currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} usuarios"
            [tableStyle]="{'min-width': '50rem'}">
            
            <ng-template pTemplate="caption">
              <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div class="d-flex align-items-center gap-2">
                  <h6 class="mb-0">
                    <i class="pi pi-users me-2"></i>
                    Usuarios Disponibles ({{ usuariosTenant.length }})
                  </h6>
                  <span class="badge bg-success">Todos cargados</span>
                </div>
                <div class="d-flex align-items-center gap-2">
                  <p-button 
                    label="Seleccionar Todos"
                    icon="pi pi-check"
                    size="small"
                    styleClass="p-button-text"
                    (onClick)="seleccionarTodos(true)">
                  </p-button>
                  <p-button 
                    label="Deseleccionar Todos"
                    icon="pi pi-times"
                    size="small"
                    styleClass="p-button-text"
                    (onClick)="seleccionarTodos(false)">
                  </p-button>
                  <span class="p-input-icon-left">
                    <input 
                      pInputText 
                      type="text" 
                      (input)="dt.filterGlobal($any($event.target).value, 'contains')"
                      placeholder="Buscar ..." />
                  </span>
                  
                </div>
              </div>
            </ng-template>
            
            <ng-template pTemplate="header">
              <tr>
                <th style="width: 50px">
                  <p-checkbox 
                    [(ngModel)]="selectAll"
                    (onChange)="onSelectAllChange($event)">
                  </p-checkbox>
                </th>
                <th pSortableColumn="name">Usuario <p-sortIcon field="name"></p-sortIcon></th>
                <th pSortableColumn="email">Email <p-sortIcon field="email"></p-sortIcon></th>
                <th pSortableColumn="job_title">Cargo <p-sortIcon field="job_title"></p-sortIcon></th>
                <th pSortableColumn="department">Departamento <p-sortIcon field="department"></p-sortIcon></th>
                <th>Estado</th>
              </tr>
            </ng-template>

            <ng-template pTemplate="body" let-usuario>
              <tr>
                <td>
                  <p-checkbox 
                    [(ngModel)]="usuario.selected"
                    (onChange)="onUserSelectionChange()">
                  </p-checkbox>
                </td>
                <td>
                  <div class="d-flex align-items-center gap-2">
                    <i class="pi pi-user text-primary"></i>
                    <span class="fw-semibold">{{ usuario.name }}</span>
                  </div>
                </td>
                <td>
                  <span class="text-muted">{{ usuario.email }}</span>
                </td>
                <td>
                  <span>{{ usuario.job_title || 'Sin cargo' }}</span>
                </td>
                <td>
                  <span>{{ usuario.department || 'Sin departamento' }}</span>
                </td>
                <td>
                  <p-tag 
                    [value]="usuario.account_enabled ? 'Activo' : 'Inactivo'"
                    [severity]="usuario.account_enabled ? 'success' : 'danger'">
                  </p-tag>
                </td>
              </tr>
            </ng-template>

            <ng-template pTemplate="emptymessage">
              <tr>
                <td colspan="6" class="text-center py-4">
                  <i class="pi pi-users" style="font-size: 2rem; color: #94a3b8;"></i>
                  <p class="text-muted mt-2 mb-0">No hay usuarios disponibles para sincronizar</p>
                </td>
              </tr>
            </ng-template>
          </p-table>
        </div>

        <!-- Mensaje cuando no hay usuarios -->
        <div class="alert alert-warning" *ngIf="usuariosTenant.length === 0 && !isLoadingUsers && tenantInfo">
          <i class="pi pi-exclamation-triangle me-2"></i>
          No hay usuarios nuevos disponibles para sincronizar. Todos los usuarios del tenant ya existen en la aplicación.
        </div>
      </div>

      <ng-template pTemplate="footer">
        <div class="d-flex justify-content-between align-items-center">
          <div *ngIf="usuariosSeleccionados.length > 0">
            <span class="text-muted">
              <i class="pi pi-check-circle me-1"></i>
              {{ usuariosSeleccionados.length }} usuario(s) seleccionado(s)
            </span>
          </div>
          <div class="d-flex gap-2">
            <p-button 
              label="Cancelar" 
              icon="pi pi-times" 
              styleClass="p-button-text p-button-secondary"
              (onClick)="onClose()">
            </p-button>
            <p-button 
              label="Sincronizar Usuarios" 
              icon="pi pi-download" 
              [disabled]="usuariosSeleccionados.length === 0 || isSyncing"
              [loading]="isSyncing"
              (onClick)="sincronizarUsuarios()">
            </p-button>
          </div>
        </div>
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    .alert {
      padding: 1rem;
      border-radius: 0.375rem;
      border: 1px solid transparent;
    }
    
    .alert-info {
      background-color: #e7f3ff;
      border-color: #b8daff;
      color: #004085;
    }
    
    .alert-warning {
      background-color: #fff3cd;
      border-color: #ffeaa7;
      color: #856404;
    }

    .alert-link {
      color: inherit;
      text-decoration: underline;
      font-weight: 600;
    }

    .alert-link:hover {
      color: inherit;
      text-decoration: none;
    }

    .p-input-icon-left > input {
      padding-left: 2.5rem;
    }

    .p-input-icon-left > i {
      left: 0.75rem;
      color: #6b7280;
    }

    .badge {
      display: inline-block;
      padding: 0.25em 0.6em;
      font-size: 0.75em;
      font-weight: 700;
      line-height: 1;
      text-align: center;
      white-space: nowrap;
      vertical-align: baseline;
      border-radius: 0.375rem;
    }

    .bg-warning {
      background-color: #f59e0b !important;
      color: #ffffff;
    }

    .bg-success {
      background-color: #10b981 !important;
      color: #ffffff;
    }

    .bg-info {
      background-color: #3b82f6 !important;
      color: #ffffff;
    }
  `]
})
export class SincronizarTenantComponent {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() usuariosSincronizados = new EventEmitter<any[]>();

  usuariosTenant: UsuarioTenant[] = [];
  selectAll = false;
  isLoadingUsers = false;
  isSyncing = false;
  tenantInfo: any = null;
  
  constructor(
    private usuarioService: UsuarioService,
    private messageService: MessageService
  ) {}

  get usuariosSeleccionados(): UsuarioTenant[] {
    return this.usuariosTenant.filter(u => u.selected);
  }

  updateSelectAllState(): void {
    const totalVisible = this.usuariosTenant.length;
    const totalSeleccionados = this.usuariosTenant.filter(u => u.selected).length;
    this.selectAll = totalVisible > 0 && totalSeleccionados === totalVisible;
  }

  cargarUsuariosTenant(): void {
    this.isLoadingUsers = true;
    this.usuariosTenant = [];
    this.tenantInfo = null;

    // Cargar todos los usuarios del tenant (el backend ahora trae todos)
    this.usuarioService.obtenerUsuariosTenant().subscribe({
      next: (response) => {
        this.isLoadingUsers = false;
        this.usuariosTenant = response.available_users || [];
        this.tenantInfo = {
          tenant_id: response.tenant_id,
          total_tenant_users: response.total_tenant_users,
          total_available: response.total_available,
          total_loaded: this.usuariosTenant.length
        };

        if (this.usuariosTenant.length === 0) {
          this.messageService.add({
            severity: 'info',
            summary: 'Sin usuarios nuevos',
            detail: 'No hay usuarios nuevos para sincronizar del tenant'
          });
        } else {
          this.messageService.add({
            severity: 'success',
            summary: 'Usuarios cargados',
            detail: `Se cargaron ${this.usuariosTenant.length} usuarios disponibles del tenant`
          });
        }
      },
      error: (error) => {
        this.isLoadingUsers = false;
        console.error('Error al cargar usuarios del tenant:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: error.error?.message || 'Error al cargar usuarios del tenant'
        });
      }
    });
  }

  seleccionarTodos(seleccionar: boolean): void {
    this.usuariosTenant.forEach(usuario => {
      usuario.selected = seleccionar;
    });
    this.selectAll = seleccionar;
  }

  onSelectAllChange(event: any): void {
    this.seleccionarTodos(event.checked);
  }

  onUserSelectionChange(): void {
    this.updateSelectAllState();
  }

  sincronizarUsuarios(): void {
    if (this.usuariosSeleccionados.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Sin selección',
        detail: 'Selecciona al menos un usuario para sincronizar'
      });
      return;
    }

    this.isSyncing = true;

    this.usuarioService.sincronizarUsuariosTenant(this.usuariosSeleccionados).subscribe({
      next: (response) => {
        this.isSyncing = false;
        
        if (response.total_creados > 0) {
          this.messageService.add({
            severity: 'success',
            summary: 'Sincronización exitosa',
            detail: `Se sincronizaron ${response.total_creados} usuario(s) correctamente`
          });

          // Emitir evento con usuarios sincronizados
          this.usuariosSincronizados.emit(response.usuarios_creados);
          
          // Cerrar modal
          this.onClose();
        }

        if (response.total_errores > 0) {
          this.messageService.add({
            severity: 'warn',
            summary: 'Errores en sincronización',
            detail: `${response.total_errores} usuario(s) no pudieron sincronizarse`
          });
        }
      },
      error: (error) => {
        this.isSyncing = false;
        console.error('Error en sincronización:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error en sincronización',
          detail: error.error?.message || 'Error al sincronizar usuarios'
        });
      }
    });
  }

  onClose(): void {
    this.visible = false;
    this.visibleChange.emit(false);
    
    // Limpiar datos
    this.usuariosTenant = [];
    this.selectAll = false;
    this.tenantInfo = null;
  }
}