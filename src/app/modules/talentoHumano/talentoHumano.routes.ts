import { Routes } from '@angular/router';
import { moduleGuard } from '../../core/guards/module.guard';

export const TALENTOHUMANO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./talentoHumano.component').then(m => m.talentoHumanoComponent),
    data: { title: 'Talento Humano' }
  },

  // ── EVENTOS ───────────────────────────────────────────────────────────────
  {
    path: 'eventos',
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./eventos/dashboard/dashboard.component').then(m => m.DashboardEventosComponent),
        //canActivate: [moduleGuard],
        data: {moduleCode: 'TALHUM-EVENT-DASHBOA' }
      },
      /*
      {
        path: 'cargue',
        loadComponent: () => import('./eventos/cargue/cargue.component')
          .then(m => m.CargueEventosComponent)
      },*/
      {
        path: 'parametros',
        loadComponent: () => import('./eventos/parametros/parametros.component').then(m => m.ParametrosEventosComponent),
          canActivate: [moduleGuard],
        data: {moduleCode: 'TALHUM-EVENT-PARAM' }
      }
    ]
  },

  // ── CUADRO DE TURNOS ───────────────────────────────────────────────────────
  {
    path: 'turnos',
    children: [

      //Modulo en proceso
      {
        path: 'dashboard',
        loadComponent: () => import('./CuadroDeTurnos/dashboard/dashboard.component')
          .then(m => m.DashboardCuadroDeTurnosComponent),
        data: { title: 'Cuadro de Turnos - Dashboard' }
      },
      //modulo en proceso
      {
        path: 'cuadro/:id/grilla',
        loadComponent: () => import('./CuadroDeTurnos/cuadro-grilla/cuadro-grilla.component')
          .then(m => m.CuadroGrillaComponent),
        data: { title: 'Grilla de Turnos' }
      },
      //modulo de cuadro de turno
      {
        path: 'cuadro-empleado',
        loadComponent: () => import('./CuadroDeTurnos/cuadro-mes-empleado/cuadro-mes-empleado.component')
          .then(m => m.CuadroMesEmpleadoComponent),
        data: { title: 'Cuadro de Turno por Empleado' }
      },
      //modulo de plantillas
      {
        path: 'plantillas',
        loadComponent: () => import('./CuadroDeTurnos/plantillas/plantillas-list.component')
          .then(m => m.PlantillasListComponent),
        data: { title: 'Plantillas de Turnos' }
      },

      //modulo temporal se estara eliminando
      {
        path: 'unidades-funcionales',
        loadComponent: () => import('./CuadroDeTurnos/unidades-funcionales/unidades-funcionales-list.component')
          .then(m => m.UnidadesFuncionalesListComponent),
        data: { title: 'Unidades Funcionales' }
      }
    ]
  }
];
