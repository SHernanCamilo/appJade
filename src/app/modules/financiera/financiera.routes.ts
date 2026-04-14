import { Routes } from '@angular/router';
import { moduleGuard } from '../../core/guards/module.guard';

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
        data: { moduleCode: 'FIN_ANT_SOL' }
      },
      {
        path: 'parametros',
        loadComponent: () => import('./anticipos/parametros/parametros.component')
          .then(m => m.ParametrosAnticiposComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'FIN_ANT_PARAM' }
      },
      {
        path: 'configuracion',
        loadComponent: () => import('./anticipos/configuracion/configuracion.component')
          .then(m => m.ConfiguracionAnticiposComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'FIN_ANT_CONFIG' }
      }
    ]
  }
];
