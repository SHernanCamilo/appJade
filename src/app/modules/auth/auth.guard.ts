import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  console.log('🔒 AuthGuard: Verificando acceso a:', state.url);
  console.log('🔒 AuthGuard: isAuthenticated:', auth.isAuthenticated());

  if (auth.isAuthenticated()) {
    console.log('✅ AuthGuard: Acceso permitido');
    return true;
  }
  
  console.log('❌ AuthGuard: Acceso denegado, redirigiendo a login');
  // Guardar la URL a la que intentaba acceder
  router.navigate(['/login'], { 
    queryParams: { returnUrl: state.url }
  });
  return false;
};
