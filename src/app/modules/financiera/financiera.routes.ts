import { Routes } from '@angular/router';
import { moduleGuard } from '../../core/guards/module.guard';

/**
 * Rutas del módulo Financiera.
 *
 * IMPORTANTE: los `moduleCode` deben coincidir EXACTAMENTE con el campo
 * `codigo` de la tabla `seg_modulos` en la BD, de lo contrario el `moduleGuard`
 * niega el acceso y redirige al dashboard.
 *
 * Códigos reales (seg_modulos):
 *   FINAN                 → /financiera
 *   FINAN-ANTICIPOS       → /financiera/anticipos
 *   FINAN-ANTICIPOS-SOLI  → /financiera/anticipos/solicitudes
 *   FINAN-ANTICIPOS-CONC  → /financiera/anticipos/conceptos
 *   FINAN-ANTICIPOS-PARA  → /financiera/anticipos/parametros
 *   FINAN-ANT-CONFIG      → /financiera/anticipos/configuracion
 */
export const FINANCIERA_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./financiera.component').then(m => m.FinancieraComponent)
  },
  {
    path: 'anticipos',
    children: [
      {
        path: 'solicitudes',
        loadComponent: () => import('./anticipos/solicitudes/solicitudes.component')
          .then(m => m.SolicitudesAnticiposComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'FINAN-ANTICIPOS-SOLI', title: 'Solicitudes de Anticipos' }
      },
      {
        path: 'solicitudes/:id',
        loadComponent: () => import('./anticipos/solicitudes/detalle/detalle-solicitud.component')
          .then(m => m.DetalleSolicitudComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'FINAN-ANTICIPOS-SOLI', title: 'Detalle de Solicitud' }
      },
      {
        path: 'conceptos',
        loadComponent: () => import('./anticipos/conceptos/conceptos.component')
          .then(m => m.ConceptosAnticiposComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'FINAN-ANTICIPOS-CONC', title: 'Conceptos de Anticipos' }
      },
      {
        path: 'parametros',
        loadComponent: () => import('./anticipos/parametros/parametros.component')
          .then(m => m.ParametrosAnticiposComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'FINAN-ANTICIPOS-PARA', title: 'Parámetros de Anticipos' }
      },
      {
        path: 'configuracion',
        loadComponent: () => import('./anticipos/configuracion/configuracion.component')
          .then(m => m.ConfiguracionAnticiposComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'FINAN-ANT-CONFIG', title: 'Configuración de Flujos' }
      }
    ]
  }
];
