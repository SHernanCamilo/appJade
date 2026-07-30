import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../modules/auth/auth.service';

/**
 * Guard del tablero de urgencias.
 *
 * Dos modos de acceso:
 *   1. PÚBLICO (TV): si la URL tiene ?t=TOKEN → permite sin login.
 *      El token se valida del lado del servidor (SSE endpoint).
 *   2. PRIVADO (usuario logueado): valida autenticación + rol "Tablero".
 */
export const tableroGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  // Modo público: si hay token en la URL, dejar pasar sin login.
  // La validación real del token la hace el backend al conectar el SSE.
  const token = route.queryParamMap.get('t');
  if (token && token.length >= 10) {
    return true;
  }

  // Modo privado: requiere autenticación + rol
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    router.navigate(['/login'], { queryParams: { returnUrl: '/tableroUrgencias' } });
    return false;
  }

  const user = auth.currentUser;
  const roles: string[] = user?.roles ?? [];
  const tieneRol = roles.some((r: string) => r.toLowerCase() === 'tablero');

  if (!tieneRol) {
    router.navigate(['/dashboard']);
    return false;
  }

  return true;
};
