import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../modules/auth/auth.service';

/**
 * Guard que verifica si el usuario tiene el rol "Tablero".
 * Si no está autenticado → redirige a /login
 * Si está autenticado pero no tiene rol → redirige a /dashboard
 */
export const tableroGuard: CanActivateFn = () => {
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
