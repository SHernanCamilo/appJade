import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { PersonificarService, PersonificacionData } from '../../services/personificar.service';
import { environment } from '../../environments/environment';

// PrimeNG Imports
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-personificar-banner',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    ToastModule
  ],
  providers: [MessageService],
  template: `
    <!-- Toast para notificaciones -->
    <p-toast></p-toast>

    <!-- Banner de personificación activa -->
    <div 
      *ngIf="personificacionData.activa" 
      class="personificar-banner">
      <div class="banner-content">
        <div class="banner-info">
          <i class="pi pi-user-edit banner-icon"></i>
          <div class="banner-text">
            <strong>Personificando a otro usuario</strong>
            <span class="banner-details">
              Cuenta original: <strong>{{ personificacionData.original_user?.name }}</strong>
              <span class="separator">•</span>
              Duración: {{ formatearDuracion(personificacionData.duration || 0) }}
            </span>
          </div>
        </div>
        
        <div class="banner-actions">
          <p-button 
            label="Volver a mi cuenta"
            icon="pi pi-sign-out"
            size="small"
            severity="danger"
            [outlined]="true"
            (onClick)="finalizarPersonificacion()"
            [loading]="finalizando">
          </p-button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .personificar-banner {
      background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
      color: white;
      height: 60px;
      display: flex;
      align-items: center;
      padding: 0 1.5rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 1100;
      animation: slideDown 0.3s ease-out;
    }

    .banner-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      max-width: 100%;
    }

    .banner-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .banner-icon {
      font-size: 1.25rem;
    }

    .banner-text {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .banner-text strong {
      font-size: 0.9rem;
    }

    .banner-details {
      font-size: 0.85rem;
      opacity: 0.9;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .separator {
      opacity: 0.7;
    }

    .banner-actions {
      display: flex;
      gap: 0.5rem;
    }

    @keyframes slideDown {
      from {
        transform: translateY(-100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    /* Responsive */
    @media (max-width: 768px) {
      .personificar-banner {
        height: auto;
        min-height: 60px;
        padding: 0.5rem 1rem;
      }

      .banner-content {
        flex-direction: column;
        gap: 0.5rem;
      }

      .banner-text {
        flex-direction: column;
        gap: 0.25rem;
        text-align: center;
      }

      .banner-details {
        justify-content: center;
      }

      .separator {
        display: none;
      }
    }

    /* Estilos para el botón en el banner */
    ::ng-deep .personificar-banner .p-button {
      background: rgba(255, 255, 255, 0.2) !important;
      border-color: rgba(255, 255, 255, 0.5) !important;
      color: white !important;
    }

    ::ng-deep .personificar-banner .p-button:hover {
      background: rgba(255, 255, 255, 0.3) !important;
      border-color: rgba(255, 255, 255, 0.7) !important;
    }

    ::ng-deep .personificar-banner .p-button:focus {
      box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.3) !important;
    }
  `]
})
export class PersonificarBannerComponent implements OnInit, OnDestroy {
  personificacionData: PersonificacionData = { activa: false };
  finalizando = false;
  private subscription?: Subscription;

  constructor(
    private personificarService: PersonificarService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    // Suscribirse a cambios en el estado de personificación
    this.subscription = this.personificarService.personificacion$.subscribe(
      data => {
        this.personificacionData = data;
      }
    );

    // Escuchar evento de finalización para ocultar inmediatamente
    window.addEventListener('personificacion-finalizada', () => {
      this.personificacionData = { activa: false };
    });

    // Escuchar evento de inicio de personificación
    window.addEventListener('personificacion-iniciada', () => {
      // Verificar estado después de iniciar personificación
      this.personificarService.verificarEstadoSiNecesario();
    });

    // Solo verificar estado si hay indicios de personificación activa
    // (esto evita llamadas innecesarias al backend en login normal)
    this.personificarService.verificarEstadoSiNecesario();
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  finalizarPersonificacion(): void {
    this.finalizando = true;
    
    this.personificarService.finalizarPersonificacion().subscribe({
      next: (response) => {
        if (response.success && response.data?.token) {
          this.personificacionData = { activa: false };

          // Limpiar sesión personificada; el usuario original se recarga con /auth/me
          localStorage.removeItem('user');
          localStorage.removeItem('sidebar_modules');
          localStorage.setItem('token', response.data.token);
          this.personificarService.resetearVerificacion();

          this.messageService.add({
            severity: 'success',
            summary: 'Personificación Finalizada',
            detail: response.message,
            life: 1500
          });

          // Redirección al dashboard respetando el base path (/plataform en prod)
          setTimeout(() => {
            const base = (environment.URL_FRONTEND || window.location.origin).replace(/\/$/, '');
            window.location.href = `${base}/dashboard`;
          }, 300);
          return;
        }

        this.finalizando = false;
        this.messageService.add({
          severity: 'warn',
          summary: 'Aviso',
          detail: response.message || 'No se pudo finalizar la personificación',
          life: 4000
        });
      },
      error: (error) => {
        console.error('Error finalizando personificación:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: error.error?.message || 'Error al finalizar personificación',
          life: 5000
        });
        this.finalizando = false;
      }
    });
  }

  formatearDuracion(segundos: number): string {
    if (segundos < 60) {
      return `${segundos}s`;
    } else if (segundos < 3600) {
      const minutos = Math.floor(segundos / 60);
      return `${minutos}m`;
    } else {
      const horas = Math.floor(segundos / 3600);
      const minutos = Math.floor((segundos % 3600) / 60);
      return `${horas}h ${minutos}m`;
    }
  }
}