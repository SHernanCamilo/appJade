import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: HttpHandlerFn) => {
  const router = inject(Router);
  const token = localStorage.getItem('token');
  
  // Agregar token si existe
  if (token) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }
  
  // Manejar respuesta y errores
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Si el error es 401 (No autorizado) o token expirado
      if (error.status === 401) {
        console.warn('⚠️ Error 401: Token inválido o expirado');
        
        // Limpiar sesión
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Redirigir al login
        router.navigate(['/login'], {
          queryParams: { 
            returnUrl: router.url,
            reason: 'session_expired'
          }
        });
      }
      
      return throwError(() => error);
    })
  );
};
