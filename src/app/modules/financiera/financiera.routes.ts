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
        path: 'conceptos',
        loadComponent: () => import('./anticipos/conceptos/conceptos.component')
          .then(m => m.ConceptosAnticiposComponent)
      },
      {
        path: 'parametros',
        loadComponent: () => import('./anticipos/parametros/parametros.component')
          .then(m => m.ParametrosAnticiposComponent)
      },
      {
        path: 'solicitudes',
        loadComponent: () => import('./anticipos/solicitudes/solicitudes.component')
          .then(m => m.SolicitudesAnticiposComponent)
      }
    ]
  }
];
