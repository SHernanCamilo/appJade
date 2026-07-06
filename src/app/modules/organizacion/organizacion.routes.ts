import { Routes } from '@angular/router';
import { OrganizacionComponent } from './organizacion.component';
import { moduleGuard } from '../../core/guards/module.guard';

export const ORGANIZACION_ROUTES: Routes = [
  {
    path: '',
    component: OrganizacionComponent
  },
  {
    path: 'empresa',
    children: [
      {
        path: 'maestro',
        loadComponent: () => import('./empresa/maestro-empresa/maestro-empresa.component').then(m => m.MaestroEmpresaComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'ORG_EMP' }
      },
      {
        path: 'sucursales',
        loadComponent: () => import('./empresa/sucursales/sucursales.component').then(m => m.SucursalesComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'ORG_SUC' }
      },
      {
        path: 'sedes',
        loadComponent: () => import('./empresa/sedes/sedes.component').then(m => m.SedesComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'ORG_SED' }
      },
      {
        path: 'modulos',
        loadComponent: () => import('./empresa/modulos/modulos.component').then(m => m.ModulosComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'EMP' }
      },
      {
        path: 'unidad-funcional',
        loadComponent: () => import('./empresa/unidad-funcional/unidad-funcional.component').then(m => m.UnidadFuncionalComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'ORG_UNI_FUN' }
      }
    ]
  },
  {
    path: 'usuario',
    children: [
      {
        path: 'crear',
        loadComponent: () => import('./usuario/crear-usuario/crear-usuario.component').then(m => m.CrearUsuarioComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'USU_ADMIN' }
      },
      {
        path: 'roles',
        loadComponent: () => import('./usuario/roles/roles.component').then(m => m.RolesComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'USU_ADMIN' }
      },
      {
        path: 'perfiles',
        loadComponent: () => import('./usuario/perfiles/perfiles.component').then(m => m.PerfilesComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'USU_ADMIN' }
      },
      {
        path: 'permisos',
        loadComponent: () => import('./usuario/permisos/permisos-modulo.component').then(m => m.PermisosModuloComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'USU_ADMIN' }
      }
    ]
  },
  {
    path: 'servicios',
    children: [
      {
        path: 'reportes',
        loadComponent: () => import('./servicios/reportes/reportes.component').then(m => m.ReportesComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'ORG_SERV' }
      },
      {
        path: 'configuracion',
        loadComponent: () => import('./servicios/configuracion/configuracion.component').then(m => m.ConfiguracionComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'ORG_SERV' }
      },
      {
        path: 'task-scheduler',
        loadChildren: () => import('./servicios/task-scheduler/task-scheduler.routes').then(m => m.TASK_SCHEDULER_ROUTES),
        canActivate: [moduleGuard],
        data: { moduleCode: 'ORG-SERV-TAREA' }
      },
      {
        path: 'secuenciaNumerica',
        loadComponent: () => import('./servicios/secuenciaNumerica/secuenciaNumerica.component').then(m => m.SecuenciaNumericaComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'ORG-SERV-SECUENCIA' }
      },
      {
        path: 'notificaciones',
        loadComponent: () => import('./servicios/notificaciones/notificaciones.component').then(m => m.NotificacionesComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'ORG-SERV-NOTIF' }
      }
    ]
  }
];

