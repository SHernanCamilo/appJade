import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

/**
 * Auth Interceptor (Funcional)
 *
 * Interceptor HTTP que agrega automáticamente el token JWT a todas las peticiones
 * que van hacia la API del backend.
 *
 * Funcionalidad:
 * - Agrega header Authorization: Bearer {token} a peticiones /api/
 * - Maneja errores 401 Unauthorized redirigiendo al login
 * - Maneja errores 403 Forbidden mostrando advertencia
 * - Permite peticiones públicas (sin token) para endpoints que no lo requieren
 *
 * Uso:
 * - Se registra automáticamente en app.config.ts
 * - No requiere decoradores @Injectable ni constructores
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  // Obtener token del localStorage
  const token = getToken();

  // Solo agregar token si:
  // 1. El token existe
  // 2. La URL es de la API backend (/api/)
  // 3. No es una petición a servicios externos
  const shouldAddToken = token && isApiRequest(req.url);

  if (shouldAddToken) {
    // Clonar la petición y agregar el header Authorization
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });

    // Log para debugging (remover en producción si no es necesario)
    if (req.url.includes('/export/') || req.url.includes('/r2/')) {
      console.log('[AuthInterceptor] Token agregado a:', req.url);
    }
  }

  // Enviar petición y capturar errores
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Si recibimos 401 Unauthorized, el token expiró o es inválido
      if (error.status === 401 && isApiRequest(req.url)) {
        console.warn('[AuthInterceptor] 401 Unauthorized - Token inválido o expirado');
        console.warn('[AuthInterceptor] URL:', req.url);
        
        // Limpiar token y redirigir al login
        handleUnauthorized(router);
      }

      // Si es 403 Forbidden, el usuario no tiene permisos
      if (error.status === 403) {
        console.warn('[AuthInterceptor] 403 Forbidden - Sin permisos para:', req.url);
      }

      // Log para debugging de errores de export
      if (req.url.includes('/fabric/viewer/')) {
        console.error('[AuthInterceptor] Error en Fabric Viewer:', {
          url: req.url,
          status: error.status,
          message: error.message,
          error: error.error
        });
      }

      // Re-lanzar el error para que el componente lo maneje
      return throwError(() => error);
    })
  );
};

/**
 * Obtiene el token JWT del localStorage
 */
function getToken(): string | null {
  return localStorage.getItem('token');
}

/**
 * Verifica si la URL es una petición a la API del backend
 */
function isApiRequest(url: string): boolean {
  // Considera peticiones a /api/ como peticiones de la API
  // Esto incluye:
  // - http://127.0.0.1:8000/api/...
  // - http://localhost:8000/api/...
  // - /api/... (URLs relativas)
  return url.includes('/api/');
}

/**
 * Maneja error 401 Unauthorized
 */
function handleUnauthorized(router: Router): void {
  // Limpiar token del localStorage
  localStorage.removeItem('token');
  
  // Limpiar otros datos de sesión si existen
  localStorage.removeItem('user');
  localStorage.removeItem('permisos');
  
  // Redirigir al login
  // Guardar la URL actual para redireccionar después del login
  const currentUrl = window.location.pathname;
  if (currentUrl !== '/login' && currentUrl !== '/') {
    localStorage.setItem('redirectUrl', currentUrl);
  }
  
  router.navigate(['/login']);
}
