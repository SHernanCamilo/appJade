import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MicrosoftAuthService } from '../microsoft-auth.service';
import { AuthService } from '../auth.service';

import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';

@Component({
  selector: 'app-microsoft-callback',
  standalone: true,
  imports: [CommonModule, ProgressSpinnerModule, CardModule, MessageModule],
  template: `
    <div class="callback-container">
      <p-card styleClass="callback-card">
        <div class="text-center">
          <div *ngIf="isProcessing">
            <p-progressSpinner styleClass="w-4rem h-4rem"></p-progressSpinner>
            <h3 class="mt-4">Procesando autenticación...</h3>
            <p class="text-600">Por favor espera mientras verificamos tu cuenta</p>
          </div>

          <div *ngIf="hasError">
            <p-message severity="error" [text]="errorMessage" styleClass="w-full"></p-message>
            <button 
              class="p-button p-component mt-4" 
              (click)="goToLogin()">
              Volver al login
            </button>
          </div>
        </div>
      </p-card>
    </div>
  `,
  styles: [`
    .callback-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 2rem;
    }

    .callback-card {
      max-width: 500px;
      width: 100%;
    }
  `]
})
export class MicrosoftCallbackComponent implements OnInit {
  isProcessing = true;
  hasError = false;
  errorMessage = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private microsoftAuth: MicrosoftAuthService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Obtener el código de la URL
    this.route.queryParams.subscribe(params => {
      const code = params['code'];
      const error = params['error'];
      const errorDescription = params['error_description'];

      if (error) {
        this.handleError(errorDescription || error);
        return;
      }

      if (!code) {
        this.handleError('No se recibió código de autorización');
        return;
      }

      // Procesar el código
      this.processCallback(code);
    });
  }

  private processCallback(code: string): void {
    this.microsoftAuth.handleCallback(code).subscribe({
      next: (response) => {
        console.log('✅ Autenticación con Microsoft exitosa');
        
        // Actualizar el usuario en AuthService
        this.authService['currentUserSubject'].next(response.user);
        
        // Si es un popup, enviar mensaje al padre
        if (window.opener) {
          window.opener.postMessage({
            type: 'microsoft-auth-success',
            payload: response
          }, window.location.origin);
          window.close();
        } else {
          // Si es redirect, navegar al dashboard
          const returnUrl = localStorage.getItem('microsoft_return_url') || '/dashboard';
          localStorage.removeItem('microsoft_return_url');
          this.router.navigate([returnUrl]);
        }
      },
      error: (error) => {
        console.error('❌ Error en autenticación con Microsoft:', error);
        
        let errorMsg = 'Error al procesar la autenticación';
        if (error.status === 403) {
          errorMsg = 'Tu dominio de correo no tiene acceso a esta aplicación';
        } else if (error.error?.message) {
          errorMsg = error.error.message;
        }
        
        // Si es un popup, enviar error al padre
        if (window.opener) {
          window.opener.postMessage({
            type: 'microsoft-auth-error',
            error: errorMsg
          }, window.location.origin);
          window.close();
        } else {
          this.handleError(errorMsg);
        }
      }
    });
  }

  private handleError(message: string): void {
    this.isProcessing = false;
    this.hasError = true;
    this.errorMessage = message;
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
