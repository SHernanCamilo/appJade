import { Routes } from '@angular/router';

export const SISTEMA_ROUTES: Routes = [
  {
    path: 'flujos',
    loadComponent: () => import('./flujos/flujos.component').then(m => m.FlujosComponent)
  }
];
