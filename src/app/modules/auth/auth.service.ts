import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, catchError } from 'rxjs/operators';
import { throwError, BehaviorSubject, Observable } from 'rxjs';
import { PermissionService } from '../../core/services/permission.service';
import { TokenService } from '../../core/services/token.service';
import { SidebarService, ModuloSidebar } from '../../complements/shared/sidebar/sidebar.service';

interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user?: any;
  sidebar?: ModuloSidebar[];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = '/auth';
  private currentUserSubject = new BehaviorSubject<any>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router,
    private permissionService: PermissionService,
    private tokenService: TokenService,
    private sidebarService: SidebarService
  ) {
    // Cargar usuario si existe token y es válido
    if (this.token) {
      if (this.tokenService.isTokenExpired(this.token)) {
        console.warn('⚠️ Token expirado al iniciar. Limpiando sesión...');
        this.clearSession();
      } else {
        this.loadUserData();
        this.startTokenValidation();
      }
    }
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, { email, password }).pipe(
      tap((resp: LoginResponse) => {
        localStorage.setItem('token', resp.access_token);
        localStorage.setItem('session_start', Date.now().toString());
        
        if (resp.user) {
          localStorage.setItem('user', JSON.stringify(resp.user));
          this.currentUserSubject.next(resp.user);
          // Cargar permisos del usuario
          if (resp.user.permissions) {
            this.permissionService.setPermissions(resp.user.permissions);
          }
        }

        // Cargar módulos del sidebar si vienen en la respuesta
        if (resp.sidebar && resp.sidebar.length > 0) {
          // console.log('✅ Módulos del sidebar recibidos en login:', resp.sidebar);
          this.sidebarService.cargarModulosDesdeLogin(resp.sidebar);
        } else {
          // console.log('⚠️ No se recibieron módulos en login, cargando con endpoint separado');
          // Si no vienen en el login, cargarlos con endpoint separado
          this.loadSidebarModules();
        }

        // Iniciar validación de token
        this.startTokenValidation();
        // Iniciar validación de sesión máxima (8 horas)
        this.startMaxSessionCheck();
        
        // Mostrar información del token
        const tokenInfo = this.tokenService.getTokenInfo(resp.access_token);
      }),
      catchError(error => {
        console.error('Error en login:', error);
        return throwError(() => error);
      })
    );
  }

  private maxSessionTimer: any;

  private startMaxSessionCheck(): void {
    const maxSessionTime = 8 * 60 * 60 * 1000; // 8 horas en milisegundos
    
    // Limpiar timer anterior si existe
    if (this.maxSessionTimer) {
      clearTimeout(this.maxSessionTimer);
    }

    // Configurar timer para cerrar sesión después de 8 horas
    this.maxSessionTimer = setTimeout(() => {
      console.warn('⏰ Sesión máxima alcanzada (8 horas). Cerrando sesión...');
      alert('Tu sesión ha alcanzado el tiempo máximo de 8 horas. Por favor, inicia sesión nuevamente.');
      this.clearSession();
    }, maxSessionTime);
  }

  /**
   * Carga los módulos del sidebar con permisos básicos
   * Se ejecuta si no vienen en el login
   */
  private loadSidebarModules(): void {
    this.http.get<any>(`${this.apiUrl}/sidebar-modules`).subscribe({
      next: (response) => {
        if (response.data || response.sidebar) {
          const modulos = response.data || response.sidebar;
          this.sidebarService.cargarModulosDesdeLogin(modulos);
        }
      },
      error: (error) => {
        console.error('❌ Error cargando módulos del sidebar:', error);
      }
    });
  }

  logout(): void {
    const token = this.token;
    
    if (!token) {
      this.clearSession();
      return;
    }
    
    // Llamar al endpoint de logout en el backend
    this.http.post(`${this.apiUrl}/logout`, {}).subscribe({
      next: (response) => {
        this.clearSession();
      },
      error: (error) => {
        this.clearSession();
      }
    });
  }

  private clearSession(): void {
    // Detener validación de token
    this.tokenService.stopTokenCheck();
    // Limpiar localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('sidebar_modules');
    // Actualizar el subject
    this.currentUserSubject.next(null);
    // Limpiar permisos
    this.permissionService.clearPermissions();
    // Limpiar sidebar
    this.sidebarService.limpiarModulos();
    this.router.navigate(['/login']);
  }

  private startTokenValidation(): void {
    // Iniciar verificación cada minuto
    this.tokenService.startTokenCheck(() => {
      console.warn('🔒 Token expirado. Cerrando sesión automáticamente...');
      alert('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
      this.clearSession();
    }, 60000); // Verificar cada 60 segundos
  }

  private loadUserData(): void {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        this.currentUserSubject.next(user);
        // Cargar permisos si existen
        if (user.permissions) {
          this.permissionService.setPermissions(user.permissions);
        }
        // Cargar módulos del sidebar
        this.loadSidebarModules();
      } catch (e) {
        console.error('Error parsing user data:', e);
      }
    } else {
      // Si no hay usuario en localStorage, obtenerlo del backend
      this.me().subscribe({
        next: () => {
          this.loadSidebarModules();
        },
        error: (error) => {
          console.error('❌ Error obteniendo usuario:', error);
        }
      });
    }
  }

  get token(): string | null {
    return localStorage.getItem('token');
  }

  get currentUser(): any {
    return this.currentUserSubject.value;
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  // Método para obtener datos del usuario actual desde el backend
  me(): Observable<any> {
    return this.http.post(`${this.apiUrl}/me`, {}).pipe(
      tap((user: any) => {
        localStorage.setItem('user', JSON.stringify(user));
        this.currentUserSubject.next(user);
        // Cargar permisos
        if (user.permissions) {
          this.permissionService.setPermissions(user.permissions);
        }
      })
    );
  }
}
