import { Routes } from '@angular/router';

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
          .then(m => m.SolicitudesAnticiposComponent)
      }
    ]
  }
];
