import { Routes } from '@angular/router';

export const TALENTOHUMANO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./talentoHumano.component').then(m => m.talentoHumanoComponent)
  },
  {
    path: 'eventos',
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./eventos/dashboard/dashboard.component')
          .then(m => m.DashboardEventosComponent)
      },
      {
        path: 'cargue',
        loadComponent: () => import('./eventos/cargue/cargue.component')
          .then(m => m.CargueEventosComponent)
      },
      {
        path: 'parametros',
        loadComponent: () => import('./eventos/parametros/parametros.component')
          .then(m => m.ParametrosEventosComponent)
      }
    ]
  }
];
