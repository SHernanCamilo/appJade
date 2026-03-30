import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  // Agregar URL base solo a rutas relativas (que empiezan con /)
  if (req.url.startsWith('/')) {
    req = req.clone({ url: `${environment.URL_SERVICIOS}${req.url}` });
  }

  // Agregar token si existe — se lee directamente de localStorage para evitar
  // dependencia circular con AuthService (que a su vez usa HttpClient)
  const token = localStorage.getItem('token');
  if (token) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        console.warn('⚠️ Token inválido o expirado. Cerrando sesión...');
        // Limpiar sesión sin depender de AuthService
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('sidebar_modules');
        router.navigate(['/login'], {
          queryParams: { returnUrl: router.url, reason: 'session_expired' }
        });
      }
      return throwError(() => error);
    })
  );
};
