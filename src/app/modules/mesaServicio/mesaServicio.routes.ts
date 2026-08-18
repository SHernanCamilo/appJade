import { Routes } from '@angular/router';
import { MesaServicioComponent } from './mesaServicio.component';
import { moduleGuard } from '../../core/guards/module.guard';

const plantillasGuard = {
  canActivate: [moduleGuard],
  data: { moduleCode: 'MESA-GLPI-PLANTILLA' }
};

const validadorGuard = {
  canActivate: [moduleGuard],
  data: { moduleCode: 'MESA-GLPI-VALIDADOR' }
};

export const MESA_SERVICIO_ROUTES: Routes = [
  {
    path: '',
    component: MesaServicioComponent
  },
  {
    path: 'parametrizadorGLPI',
    children: [
      {
        path: 'plantillas',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./parametrizadorGLPI/plantillas/plantillas-list.component').then(
                (m) => m.GlpiPlantillasListComponent
              ),
            ...plantillasGuard,
            data: {
              ...plantillasGuard.data,
              pageTitle: 'Plantillas GLPI',
              pageSubtitle: 'Crear y editar plantillas de categorías, prioridades y tiempos ANS'
            }
          },
          {
            path: 'nueva',
            loadComponent: () =>
              import('./parametrizadorGLPI/plantillas/plantilla-editor.component').then(
                (m) => m.GlpiPlantillaEditorComponent
              ),
            ...plantillasGuard,
            data: {
              ...plantillasGuard.data,
              pageTitle: 'Nueva plantilla GLPI'
            }
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./parametrizadorGLPI/plantillas/plantilla-editor.component').then(
                (m) => m.GlpiPlantillaEditorComponent
              ),
            ...plantillasGuard,
            data: {
              ...plantillasGuard.data,
              pageTitle: 'Editar plantilla GLPI'
            }
          }
        ]
      },
      {
        path: 'validador',
        loadComponent: () =>
          import('./parametrizadorGLPI/validador/validador.component').then(
            (m) => m.GlpiValidadorComponent
          ),
        ...validadorGuard,
        data: {
          ...validadorGuard.data,
          pageTitle: 'Validador GLPI',
          pageSubtitle: 'Comparar plantillas ANS contra entidades y reglas de GLPI'
        }
      }
    ]
  }
];
