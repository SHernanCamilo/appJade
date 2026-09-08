import { Routes } from '@angular/router';
import { moduleGuard } from '../../core/guards/module.guard';

/**
 * Rutas del módulo Contabilidad.
 *
 * El módulo raíz y cada sección hija tienen su moduleCode correspondiente
 * al código en seg_modulos, de modo que moduleGuard puede verificar acceso
 * contra el árbol del sidebar cargado desde el login.
 *
 *   CONT              → Contabilidad (raíz)
 *   CONT-PERSON       → Personas y Terceros
 *   CONT-FICHAS       → Fichas Técnicas (y sus sub-rutas delegan a fichas-tecnicas.routes.ts)
 */
export const CONTABILIDAD_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./contabilidad.component').then(m => m.ContabilidadComponent),
    canActivate: [moduleGuard],
    data: {
      moduleCode: 'CONT',
      pageTitle: 'Contabilidad',
      pageSubtitle: 'Gestión contable y financiera'
    }
  },
  {
    path: 'personas',
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard'
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./personas/dashboard/dashboard.component').then(m => m.DashboardPersonasComponent),
        canActivate: [moduleGuard],
        data: {
          moduleCode: 'CONT-PERSON',
          pageTitle: 'Personas y Terceros',
          pageSubtitle: 'Dashboard de personas y terceros'
        }
      }
    ]
  },
  {
    path: 'fichas-tecnicas',
    loadChildren: () =>
      import('./fichasTecnicas/fichas-tecnicas.routes').then(m => m.FICHAS_TECNICAS_ROUTES)
  }
];
