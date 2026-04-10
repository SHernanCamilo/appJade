import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, from } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

interface MicrosoftAuthResponse {
  message: string;
  access_token: string;
  token_type: string;
  expires_in: number;
  user: {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    auth_type: string;
    tenant_id?: string;
    tipo_identificacion?: string;
    numero_identificacion?: string;
    direccion?: string;
    telefono?: string;
    estado?: boolean;
    roles?: string[];
    empresas?: any[];
    sucursal?: any;
    sede?: any;
    permissions?: string[];
  };
  sidebar?: any[];
}

interface MicrosoftAuthUrlResponse {
  auth_url: string;
}

@Injectable({
  providedIn: 'root'
})
export class MicrosoftAuthService {
  private apiUrl = '/auth/microsoft';
  private popupWindow: Window | null = null;

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  /**
   * Obtener URL de autenticación de Microsoft
   */
  getAuthUrl(): Observable<MicrosoftAuthUrlResponse> {
    return this.http.get<MicrosoftAuthUrlResponse>(this.apiUrl);
  }

  /**
   * Login con Microsoft usando popup
   */
  loginWithPopup(): Observable<MicrosoftAuthResponse> {
    return from(this.openAuthPopup());
  }

  /**
   * Login con Microsoft usando redirect
   */
  loginWithRedirect(): void {
    this.getAuthUrl().subscribe({
      next: (response) => {
        // Guardar la URL de retorno
        const returnUrl = this.router.url;
        localStorage.setItem('microsoft_return_url', returnUrl);
        
        // Redirigir a Microsoft
        window.location.href = response.auth_url;
      },
      error: (error) => {
        console.error('Error al obtener URL de Microsoft:', error);
        throw error;
      }
    });
  }

  /**
   * Abrir popup de autenticación
   */
  private openAuthPopup(): Promise<MicrosoftAuthResponse> {
    return new Promise((resolve, reject) => {
      this.getAuthUrl().subscribe({
        next: (response) => {
          const width = 500;
          const height = 600;
          const left = window.screen.width / 2 - width / 2;
          const top = window.screen.height / 2 - height / 2;

          this.popupWindow = window.open(
            response.auth_url,
            'Microsoft Login',
            `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
          );

          if (!this.popupWindow) {
            reject(new Error('No se pudo abrir la ventana de autenticación. Verifica que los popups estén permitidos.'));
            return;
          }

          // Escuchar mensajes del popup
          const messageHandler = (event: MessageEvent) => {
            // Verificar origen del mensaje
            if (event.origin !== window.location.origin) {
              return;
            }

            if (event.data.type === 'microsoft-auth-success') {
              window.removeEventListener('message', messageHandler);
              if (this.popupWindow) {
                this.popupWindow.close();
              }
              resolve(event.data.payload);
            } else if (event.data.type === 'microsoft-auth-error') {
              window.removeEventListener('message', messageHandler);
              if (this.popupWindow) {
                this.popupWindow.close();
              }
              reject(new Error(event.data.error));
            }
          };

          window.addEventListener('message', messageHandler);

          // Verificar si el popup fue cerrado manualmente
          const checkPopupClosed = setInterval(() => {
            if (this.popupWindow && this.popupWindow.closed) {
              clearInterval(checkPopupClosed);
              window.removeEventListener('message', messageHandler);
              reject(new Error('Autenticación cancelada'));
            }
          }, 500);
        },
        error: (error) => {
          reject(error);
        }
      });
    });
  }

  /**
   * Manejar callback de Microsoft (para redirect flow)
   */
  handleCallback(code: string): Observable<MicrosoftAuthResponse> {
    return this.http.post<MicrosoftAuthResponse>(`${this.apiUrl}/token`, { code }).pipe(
      tap((response) => {
        // Guardar token y datos de sesión (igual que el login normal)
        localStorage.setItem('access_token', response.access_token);
        localStorage.setItem('token', response.access_token);
        localStorage.setItem('session_start', Date.now().toString());
        
        if (response.user) {
          localStorage.setItem('user', JSON.stringify(response.user));
        }
        
        // console.log('✅ Login con Microsoft exitoso (callback)');
      })
    );
  }

  /**
   * Verificar si un email está permitido
   */
  checkEmail(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/check-email`, { email });
  }

  /**
   * Verificar configuración de Microsoft
   */
  checkConfiguration(): Observable<any> {
    return this.http.get(`${this.apiUrl}/check-config`);
  }
}
