import { Routes } from '@angular/router';
import { InteligenciaNegociosComponent } from './inteligenciaNegocios.component';
import { moduleGuard } from '../../core/guards/module.guard';

export const INTELIGENCIA_NEGOCIOS_ROUTES: Routes = [
  {
    path: '',
    component: InteligenciaNegociosComponent
  },
  {
    path: 'vistas',
    loadComponent: () => import('./vistas/listadoVistas/listadoVistas.component').then(m => m.ListadoVistasComponent),
    canActivate: [moduleGuard],
    data: { moduleCode: 'BI-VISTAS' }
  },
  {
    path: 'vistas/viewVistas/fullscreen/:schema/:viewName',
    loadComponent: () => import('./vistas/viewVistas/viewVistasFullscreen.component').then(m => m.ViewVistasFullscreenComponent),
    canActivate: [moduleGuard],
    data: { moduleCode: 'BI-VISTAS' }
  },
  {
    path: 'vistas/viewVistas/:schema/:viewName',
    loadComponent: () => import('./vistas/viewVistas/viewVistas.component').then(m => m.ViewVistasComponent),
    canActivate: [moduleGuard],
    data: { moduleCode: 'BI-VISTAS' }
  }
];
