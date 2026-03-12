import { Routes } from '@angular/router';

export const CONTABILIDAD_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./contabilidad.component').then(m => m.ContabilidadComponent)
  },
  {
    path: 'personas',
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./personas/dashboard/dashboard.component')
          .then(m => m.DashboardPersonasComponent)
      }
    ]
  }
];
