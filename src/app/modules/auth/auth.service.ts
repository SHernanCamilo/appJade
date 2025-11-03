import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, catchError } from 'rxjs/operators';
import { throwError, BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user?: any;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = environment.URL_SERVICIOS + '/auth';
  private currentUserSubject = new BehaviorSubject<any>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    // Cargar usuario si existe token
    if (this.token) {
      this.loadUserData();
    }
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, { email, password }).pipe(
      tap((resp: LoginResponse) => {
        localStorage.setItem('token', resp.access_token);
        if (resp.user) {
          localStorage.setItem('user', JSON.stringify(resp.user));
          this.currentUserSubject.next(resp.user);
        }
      }),
      catchError(error => {
        console.error('Error en login:', error);
        return throwError(() => error);
      })
    );
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
    // Limpiar localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Actualizar el subject
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  private loadUserData(): void {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        this.currentUserSubject.next(user);
      } catch (e) {
        console.error('Error parsing user data:', e);
      }
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
      })
    );
  }
}
