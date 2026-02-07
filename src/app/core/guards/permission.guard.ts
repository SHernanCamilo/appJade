import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { PermissionService } from '../services/permission.service';

export const permissionGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const permissionService = inject(PermissionService);
  const router = inject(Router);

  // Obtener el permiso requerido de los datos de la ruta
  const requiredPermission = route.data['permission'] as string;
  const requiredPermissions = route.data['permissions'] as string[];

  // Si no se especifica permiso, permitir acceso
  if (!requiredPermission && !requiredPermissions) {
    return true;
  }

  // Verificar permiso único
  if (requiredPermission) {
    if (permissionService.hasPermission(requiredPermission)) {
      return true;
    }
  }

  // Verificar múltiples permisos (OR logic - al menos uno)
  if (requiredPermissions && requiredPermissions.length > 0) {
    if (permissionService.hasAnyPermission(requiredPermissions)) {
      return true;
    }
  }

  // No tiene permisos, redirigir
  console.warn('Acceso denegado. Permiso requerido:', requiredPermission || requiredPermissions);
  router.navigate(['/acceso-denegado'], {
    queryParams: { returnUrl: state.url }
  });
  
  return false;
};
