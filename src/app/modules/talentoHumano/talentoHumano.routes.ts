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
        canActivate: [moduleGuard],
        data: {moduleCode: 'TALHUM-EVENT-DASHBOA' }
      },
      {
        path: 'parametros',
        loadComponent: () => import('./eventos/parametros/parametros.component').then(m => m.ParametrosEventosComponent),
          canActivate: [moduleGuard],
        data: {moduleCode: 'TALHUM-EVENT-PARAM' }
      },
      {
        path: 'digitalizacion',
        loadComponent: () => import('./eventos/digitalizacion/digitalizacion.component').then(m => m.DigitalizacionEventosComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'TALHUM-EVENT-DIGIT', title: 'Digitalización de Eventos' }
      },
      { path: 'cargue', redirectTo: 'digitalizacion', pathMatch: 'full' }
    ]
  },

  // ── CUADRO DE TURNOS ───────────────────────────────────────────────────────
  {
    path: 'turnos',
    children: [

      //Modulo de reportes
      {
        path: 'dashboard',
        loadComponent: () => import('./CuadroDeTurnos/dashboard/dashboard.component')
          .then(m => m.DashboardCuadroDeTurnosComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'TUR', title: 'Cuadro de Turnos - Reportes' }
      },
      //modulo de grilla
      {
        path: 'cuadro/:id/grilla',
        loadComponent: () => import('./CuadroDeTurnos/cuadro-grilla/cuadro-grilla.component')
          .then(m => m.CuadroGrillaComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'TUR_CUA', title: 'Grilla de Turnos' }
      },
      //modulo de cuadro de turno
      {
        path: 'cuadro-empleado',
        loadComponent: () => import('./CuadroDeTurnos/cuadro-mes-empleado/cuadro-mes-empleado.component')
          .then(m => m.CuadroMesEmpleadoComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'TUR_CUA', title: 'Cuadro de Turno por Empleado' }
      },
      //modulo de plantillas
      {
        path: 'plantillas',
        loadComponent: () => import('./CuadroDeTurnos/plantillas/plantillas-list.component')
          .then(m => m.PlantillasListComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'TUR_CFG', title: 'Plantillas de Turnos' }
      },

      //modulo temporal se estara eliminando

      /*
      {
        path: 'unidades-funcionales',
        loadComponent: () => import('./CuadroDeTurnos/unidades-funcionales/unidades-funcionales-list.component')
          .then(m => m.UnidadesFuncionalesListComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'TUR_GRP', title: 'Unidades Funcionales' }
      },
      */
      //modulo de configuración unificado (jornada + cierre + conceptos)
      {
        path: 'configuracion',
        loadComponent: () => import('./CuadroDeTurnos/configuracion-turnos/configuracion-turnos.component')
          .then(m => m.ConfiguracionTurnosComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'TUR_CFG', title: 'Configuración de Turnos' }
      },
      { path: 'parametrizacion', redirectTo: 'configuracion', pathMatch: 'full' },
      { path: 'cierre-cuadro', redirectTo: 'configuracion', pathMatch: 'full' }
    ]
  }
];
