import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PersonificarService, UsuarioDisponible } from '../../services/personificar.service';

// PrimeNG Imports
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { AvatarModule } from 'primeng/avatar';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService, ConfirmationService } from 'primeng/api';

@Component({
  selector: 'app-personificar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    TableModule,
    InputTextModule,
    TagModule,
    ToastModule,
    ConfirmDialogModule,
    AvatarModule,
    TooltipModule
  ],
  providers: [MessageService, ConfirmationService],
  template: `
    <!-- Toast para notificaciones -->
    <p-toast></p-toast>
    
    <!-- Confirm Dialog -->
    <p-confirmDialog></p-confirmDialog>

    <div class="personificar-content">
      <!-- Información sobre personificación -->
      <div class="alert alert-info mb-4">
        <i class="pi pi-info-circle me-2"></i>
        <strong>¿Qué es personificar?</strong>
        <p class="mb-0 mt-1">
          Te permite actuar como otro usuario del sistema, viendo exactamente lo que ellos ven 
          y teniendo acceso a sus mismos permisos y empresas. Útil para soporte y resolución de problemas.
        </p>
      </div>

      <!-- Loading -->
      <div *ngIf="cargando" class="text-center py-5">
        <i class="pi pi-spin pi-spinner" style="font-size: 2rem;"></i>
        <p class="text-muted mt-3">Cargando usuarios...</p>
      </div>

      <!-- Tabla de usuarios -->
      <div *ngIf="!cargando">
        <p-table 
          [value]="usuarios" 
          [paginator]="true" 
          [rows]="8"
          [showCurrentPageReport]="true"
          [rowsPerPageOptions]="[8, 15, 25]"
          [globalFilterFields]="['name', 'email']"
          currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} usuarios"
          [tableStyle]="{'min-width': '50rem'}">
          
          <ng-template pTemplate="caption">
            <div class="d-flex justify-content-between align-items-center">
              <h6 class="mb-0">
                <i class="pi pi-users me-2"></i>
                Usuarios Disponibles
                <p-tag [value]="usuarios.length.toString()" styleClass="ml-2"></p-tag>
              </h6>
              <span class="p-input-icon-left">
                <i class="pi pi-search"></i>
                <input 
                  pInputText 
                  type="text" 
                  (input)="filtrarUsuarios($event)" 
                  placeholder="Buscar usuario..." />
              </span>
            </div>
          </ng-template>

          <ng-template pTemplate="header">
            <tr>
              <th>Usuario</th>
              <th>Empresas</th>
              <th>Roles</th>
              <th>Último Acceso</th>
              <th style="width: 120px">Acción</th>
            </tr>
          </ng-template>

          <ng-template pTemplate="body" let-usuario>
            <tr>
              <td>
                <div class="d-flex align-items-center gap-2">
                  <p-avatar 
                    [label]="getInitials(usuario.name)" 
                    styleClass="mr-2" 
                    size="normal"
                    [style]="{'background-color':'#667eea', 'color': '#ffffff'}">
                  </p-avatar>
                  <div>
                    <div class="fw-semibold">{{ usuario.name }}</div>
                    <div class="text-muted small">{{ usuario.email }}</div>
                  </div>
                </div>
              </td>
              <td>
                <div class="d-flex flex-wrap gap-1">
                  <p-tag 
                    *ngFor="let empresa of usuario.empresas.slice(0, 2)" 
                    [value]="empresa" 
                    severity="success"
                    styleClass="small">
                  </p-tag>
                  <p-tag 
                    *ngIf="usuario.empresas.length > 2"
                    [value]="'+' + (usuario.empresas.length - 2)" 
                    severity="success"
                    [style]="{'opacity': '0.7'}"
                    [pTooltip]="usuario.empresas.slice(2).join(', ')">
                  </p-tag>
                </div>
                <span class="text-muted small" *ngIf="usuario.empresas.length === 0">
                  Sin empresas
                </span>
              </td>
              <td>
                <div class="d-flex flex-wrap gap-1">
                  <p-tag 
                    *ngFor="let rol of usuario.roles.slice(0, 2)" 
                    [value]="rol" 
                    severity="info"
                    styleClass="small">
                  </p-tag>
                  <p-tag 
                    *ngIf="usuario.roles.length > 2"
                    [value]="'+' + (usuario.roles.length - 2)" 
                    severity="info"
                    [style]="{'opacity': '0.7'}"
                    [pTooltip]="usuario.roles.slice(2).join(', ')">
                  </p-tag>
                </div>
                <span class="text-muted small" *ngIf="usuario.roles.length === 0">
                  Sin roles
                </span>
              </td>
              <td>
                <span class="text-muted small">
                  {{ usuario.ultimo_acceso ? (usuario.ultimo_acceso | date:'dd/MM/yyyy HH:mm') : 'Nunca' }}
                </span>
              </td>
              <td>
                <p-button 
                  label="Personificar"
                  icon="pi pi-sign-in"
                  size="small"
                  severity="warn"
                  (onClick)="confirmarPersonificacion(usuario)"
                  [loading]="personificando === usuario.id">
                </p-button>
              </td>
            </tr>
          </ng-template>

          <ng-template pTemplate="emptymessage">
            <tr>
              <td colspan="5" class="text-center py-5">
                <i class="pi pi-users" style="font-size: 3rem; color: #94a3b8;"></i>
                <p class="text-muted mt-3">No hay usuarios disponibles para personificar</p>
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    </div>
  `,
  styles: [`
    .personificar-content {
      min-height: 500px;
      padding: 1.5rem;
    }

    .personificar-header h5 {
      color: #1e293b;
      font-weight: 600;
    }

    .alert {
      padding: 1rem;
      border-radius: 8px;
      border: 1px solid #bee5eb;
      background-color: #d1ecf1;
      color: #0c5460;
    }

    .alert-info {
      border-color: #bee5eb;
      background-color: #d1ecf1;
      color: #0c5460;
    }

    .small {
      font-size: 0.75rem;
    }

    ::ng-deep .p-tag.small {
      font-size: 0.7rem;
      padding: 0.25rem 0.5rem;
    }

    ::ng-deep .p-table .p-paginator {
      border: none;
      background: transparent;
    }
  `]
})
export class PersonificarComponent implements OnInit {
  @Output() onClose = new EventEmitter<void>();
  
  usuarios: UsuarioDisponible[] = [];
  cargando = false;
  personificando: number | null = null;

  constructor(
    private personificarService: PersonificarService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit(): void {
    this.cargarUsuarios();
  }



  cargarUsuarios(): void {
    this.cargando = true;
    console.log('🔄 Iniciando carga de usuarios para personificar...');
    
    this.personificarService.getUsuariosDisponibles().subscribe({
      next: (response) => {
        console.log('📦 Respuesta del servicio:', response);
        
        if (response.success) {
          this.usuarios = response.data;
          console.log('✅ Usuarios cargados:', this.usuarios.length, this.usuarios);
        } else {
          console.warn('⚠️ Respuesta no exitosa:', response.message);
          this.messageService.add({
            severity: 'warn',
            summary: 'Advertencia',
            detail: response.message || 'No se pudieron cargar los usuarios',
            life: 5000
          });
        }
        this.cargando = false;
      },
      error: (error) => {
        console.error('❌ Error cargando usuarios:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: error.error?.message || 'Error al cargar usuarios disponibles',
          life: 5000
        });
        this.cargando = false;
      }
    });
  }

  confirmarPersonificacion(usuario: UsuarioDisponible): void {
    this.confirmationService.confirm({
      message: `¿Estás seguro de que quieres personificar a <strong>${usuario.name}</strong>?<br><br>
                <small>Tendrás acceso a sus mismos permisos y empresas. Esta acción quedará registrada en los logs del sistema.</small>`,
      header: 'Confirmar Personificación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, personificar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-warn',
      accept: () => {
        this.iniciarPersonificacion(usuario);
      }
    });
  }

  iniciarPersonificacion(usuario: UsuarioDisponible): void {
    this.personificando = usuario.id;
    
    this.personificarService.iniciarPersonificacion(usuario.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.messageService.add({
            severity: 'success',
            summary: 'Personificación Iniciada',
            detail: response.message,
            life: 5000
          });
          
          this.onClose.emit();
          
          // Recargar la página para aplicar los cambios
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        }
        this.personificando = null;
      },
      error: (error) => {
        console.error('Error iniciando personificación:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: error.error?.message || 'Error al iniciar personificación',
          life: 5000
        });
        this.personificando = null;
      }
    });
  }

  filtrarUsuarios(event: Event): void {
    const input = event.target as HTMLInputElement;
    const filtro = input.value.toLowerCase();
    
    if (!filtro) {
      this.cargarUsuarios();
      return;
    }

    this.usuarios = this.usuarios.filter(usuario => 
      usuario.name.toLowerCase().includes(filtro) ||
      usuario.email.toLowerCase().includes(filtro)
    );
  }

  getInitials(name: string): string {
    const names = name.split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
}