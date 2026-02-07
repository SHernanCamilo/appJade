import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  // Guardar la URL a la que intentaba acceder
  router.navigate(['/login'], { 
    queryParams: { returnUrl: state.url }
  });
  return false;
};
