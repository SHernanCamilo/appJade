import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { MesaServicioComponent } from './mesaServicio.component';
import { moduleGuard } from '../../core/guards/module.guard';
import { PermissionService } from '../../core/services/permission.service';

const puedeNotificarTeams: CanActivateFn = () => {
  const permisos = inject(PermissionService);
  const router = inject(Router);
  if (permisos.hasPermission('mesa-glpi-tablero-notificar')) {
    return true;
  }

  return router.createUrlTree(['/mesaServicio/tableros/tic']);
};

const plantillasGuard = {
  canActivate: [moduleGuard],
  data: { moduleCode: 'MESA-GLPI-PLANTILLA' }
};

const validadorGuard = {
  canActivate: [moduleGuard],
  data: { moduleCode: 'MESA-GLPI-VALIDADOR' }
};

const tableroTicGuard = {
  canActivate: [moduleGuard],
  data: { moduleCode: 'MESA-GLPI-TABLERO' }
};

const loadPlantillaEditor = () =>
  import('./parametrizadorGLPI/plantillas/plantilla-editor.component').then(
    (m) => m.GlpiPlantillaEditorComponent
  );

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
            loadComponent: loadPlantillaEditor,
            ...plantillasGuard,
            data: {
              ...plantillasGuard.data,
              pageTitle: 'Nueva plantilla GLPI'
            }
          },
          {
            path: ':id',
            loadComponent: loadPlantillaEditor,
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
  },
  {
    path: 'tableros/tic/notificaciones',
    loadComponent: () =>
      import('./tableros/tic/notificaciones/teams-destinos.component').then(
        (m) => m.TeamsDestinosComponent
      ),
    canActivate: [moduleGuard, puedeNotificarTeams],
    data: {
      ...tableroTicGuard.data,
      pageTitle: 'Notificaciones Teams',
      pageSubtitle: 'Avisos del tablero TIC a canales de Teams'
    }
  },
  {
    path: 'tableros/tic',
    loadComponent: () =>
      import('./tableros/tic/tablero-tic.component').then((m) => m.TableroTicComponent),
    ...tableroTicGuard,
    data: {
      ...tableroTicGuard.data,
      pageTitle: 'Tablero TIC',
      pageSubtitle: 'Tickets abiertos de Nivel 1 Nacional y alerta ANS'
    }
  }
];
