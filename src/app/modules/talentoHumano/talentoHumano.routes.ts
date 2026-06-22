import { Routes } from '@angular/router';

export const TALENTOHUMANO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./talentoHumano.component').then(m => m.talentoHumanoComponent)
  },

  // ── EVENTOS ───────────────────────────────────────────────────────────────
  {
    path: 'eventos',
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./eventos/dashboard/dashboard.component')
          .then(m => m.DashboardEventosComponent)
      },
      {
        path: 'parametros',
        loadComponent: () => import('./eventos/parametros/parametros.component')
          .then(m => m.ParametrosEventosComponent)
      }
    ]
  },

  // ── CUADRO DE TURNOS ──────────────────────────────────────────────────────
  {
    path: 'cuadro-turnos',
    children: [
      {
        path: '',
        redirectTo: 'cuadros',
        pathMatch: 'full'
      },
      {
        path: 'plantillas',
        loadComponent: () => import('./cuadro-turnos/plantillas/plantillas-list.component')
          .then(m => m.PlantillasListComponent)
      },
      {
        path: 'grupos',
        loadComponent: () => import('./cuadro-turnos/grupos/grupos-list.component')
          .then(m => m.GruposListComponent)
      },
      {
        path: 'grupos/:id',
        loadComponent: () => import('./cuadro-turnos/grupos/grupo-detalle.component')
          .then(m => m.GrupoDetalleComponent)
      },
      {
        path: 'cuadros',
        loadComponent: () => import('./cuadro-turnos/cuadros/cuadros-list.component')
          .then(m => m.CuadrosListComponent)
      },
      {
        path: 'cuadros/:id/grilla',
        loadComponent: () => import('./cuadro-turnos/cuadros/cuadro-grilla.component')
          .then(m => m.CuadroGrillaComponent)
      },
      {
        path: 'novedades',
        loadComponent: () => import('./cuadro-turnos/novedades/novedades-list.component')
          .then(m => m.NovedadesListComponent)
      }
    ]
  }
];
