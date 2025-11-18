import { Routes } from '@angular/router';
import { OrganizacionComponent } from './organizacion.component';

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
        loadComponent: () => import('./empresa/maestro-empresa/maestro-empresa.component').then(m => m.MaestroEmpresaComponent)
      },
      {
        path: 'sucursales',
        loadComponent: () => import('./empresa/sucursales/sucursales.component').then(m => m.SucursalesComponent)
      },
      {
        path: 'sedes',
        loadComponent: () => import('./empresa/sedes/sedes.component').then(m => m.SedesComponent)
      }
    ]
  },
  {
    path: 'usuario',
    children: [
      {
        path: 'crear',
        loadComponent: () => import('./usuario/crear-usuario/crear-usuario.component').then(m => m.CrearUsuarioComponent)
      },
      {
        path: 'roles',
        loadComponent: () => import('./usuario/roles/roles.component').then(m => m.RolesComponent)
      },
      {
        path: 'perfiles',
        loadComponent: () => import('./usuario/perfiles/perfiles.component').then(m => m.PerfilesComponent)
      }
    ]
  },
  {
    path: 'servicios',
    children: [
      {
        path: 'modulos',
        loadComponent: () => import('./servicios/modulos/modulos.component').then(m => m.ModulosComponent)
      },
      {
        path: 'reportes',
        loadComponent: () => import('./servicios/reportes/reportes.component').then(m => m.ReportesComponent)
      },
      {
        path: 'configuracion',
        loadComponent: () => import('./servicios/configuracion/configuracion.component').then(m => m.ConfiguracionComponent)
      }
    ]
  }
];
