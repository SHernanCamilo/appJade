import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../modules/auth/auth.service';

/**
 * Guard del tablero de urgencias.
 *
 * Siempre permite el acceso a /tableroUrgencias:
 *   - TV sin emparejar → muestra pantalla de código
 *   - TV emparejada (device_secret en localStorage) → muestra datos
 *   - Usuario logueado → muestra datos con polling JWT
 *
 * La seguridad real está en el backend (token/device_secret), no en el guard.
 * El guard solo redirige a login si la ruta necesita protección y no hay
 * ninguna señal de que sea un tablero público.
 */
export const tableroGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  // Si tiene token en URL → es un tablero público legacy
  const token = route.queryParamMap.get('t');
  if (token && token.length >= 10) {
    return true;
  }

  // Si tiene device_secret en localStorage → TV ya emparejada
  if (typeof localStorage !== 'undefined' && localStorage.getItem('tablero_device_secret')) {
    return true;
  }

  // Si el usuario está logueado → modo privado
  const auth = inject(AuthService);
  if (auth.isAuthenticated()) {
    const user = auth.currentUser;
    const roles: string[] = user?.roles ?? [];
    const tieneRol = roles.some((r: string) => r.toLowerCase() === 'tablero');

    if (!tieneRol) {
      const router = inject(Router);
      router.navigate(['/dashboard']);
      return false;
    }
    return true;
  }

  // Sin login ni device_secret → mostrar pantalla de emparejamiento
  // (el componente detecta mode='pairing' y muestra el input de código)
  return true;
};
