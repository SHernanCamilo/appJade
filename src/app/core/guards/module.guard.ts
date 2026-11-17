import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { filter, map, take } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { SidebarService } from '../../complements/shared/sidebar/sidebar.service';
import { MessageService } from 'primeng/api';

/** Espera el sidebar del token actual. En recarga y al personificar la lista llega por HTTP. */
function cuandoModulosListos(sidebarService: SidebarService): Observable<boolean> {
  return sidebarService.modulosListos$.pipe(
    filter((listos) => listos),
    take(1)
  );
}

/**
 * Guard que verifica si el usuario tiene acceso a un módulo específico
 * 
 * Uso en rutas:
 * {
 *   path: 'usuario/crear',
 *   loadComponent: () => import('./crear-usuario.component'),
 *   canActivate: [moduleGuard],
 *   data: { moduleCode: 'USU_ADMIN' }
 * }
 */
export const moduleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const sidebarService = inject(SidebarService);
  const router = inject(Router);
  const messageService = inject(MessageService);

  // Obtener el código del módulo requerido desde la configuración de la ruta
  const moduleCode = route.data['moduleCode'] as string;
  
  // Si no se especifica un módulo, permitir acceso
  if (!moduleCode) {
    console.warn('⚠️ moduleGuard: No se especificó moduleCode en la ruta');
    return true;
  }

  return cuandoModulosListos(sidebarService).pipe(
    map(() => {
      const tieneAcceso = sidebarService.tieneAccesoModulo(moduleCode);

      if (!tieneAcceso) {
        console.warn(`🚫 Acceso denegado al módulo: ${moduleCode}`);

        messageService.add({
          severity: 'error',
          summary: 'Acceso Denegado',
          detail: 'No tienes permisos para acceder a esta sección',
          life: 5000
        });

        router.navigate(['/dashboard'], {
          queryParams: {
            accessDenied: true,
            module: moduleCode
          }
        });
        return false;
      }

      return true;
    })
  );
};

/**
 * Guard que verifica acceso a múltiples módulos (cualquiera de ellos)
 * 
 * Uso en rutas:
 * {
 *   path: 'admin',
 *   canActivate: [anyModuleGuard],
 *   data: { moduleCodes: ['USU_ADMIN', 'ORG_EMP'] }
 * }
 */
export const anyModuleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const sidebarService = inject(SidebarService);
  const router = inject(Router);
  const messageService = inject(MessageService);

  const moduleCodes = route.data['moduleCodes'] as string[];
  
  if (!moduleCodes || moduleCodes.length === 0) {
    console.warn('⚠️ anyModuleGuard: No se especificaron moduleCodes');
    return true;
  }

  return cuandoModulosListos(sidebarService).pipe(
    map(() => {
      const tieneAcceso = moduleCodes.some(code => sidebarService.tieneAccesoModulo(code));

      if (!tieneAcceso) {
        console.warn(`🚫 Acceso denegado. Se requiere uno de: ${moduleCodes.join(', ')}`);

        messageService.add({
          severity: 'warn',
          summary: 'Acceso Restringido',
          detail: 'No tienes permisos para acceder a esta funcionalidad',
          life: 5000
        });

        router.navigate(['/dashboard'], {
          queryParams: { accessDenied: true }
        });
        return false;
      }

      return true;
    })
  );
};

/**
 * Guard que verifica acceso a todos los módulos especificados
 * 
 * Uso en rutas:
 * {
 *   path: 'super-admin',
 *   canActivate: [allModulesGuard],
 *   data: { moduleCodes: ['USU_ADMIN', 'ORG_EMP'] }
 * }
 */
export const allModulesGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const sidebarService = inject(SidebarService);
  const router = inject(Router);
  const messageService = inject(MessageService);

  const moduleCodes = route.data['moduleCodes'] as string[];
  
  if (!moduleCodes || moduleCodes.length === 0) {
    return true;
  }

  return cuandoModulosListos(sidebarService).pipe(
    map(() => {
      const tieneAcceso = moduleCodes.every(code => sidebarService.tieneAccesoModulo(code));

      if (!tieneAcceso) {
        console.warn(`🚫 Acceso denegado. Se requieren todos: ${moduleCodes.join(', ')}`);

        messageService.add({
          severity: 'error',
          summary: 'Permisos Insuficientes',
          detail: 'Necesitas permisos adicionales para acceder a esta área',
          life: 5000
        });

        router.navigate(['/dashboard'], {
          queryParams: { accessDenied: true }
        });
        return false;
      }

      return true;
    })
  );
};