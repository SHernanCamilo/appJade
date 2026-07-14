import { Routes } from '@angular/router';
import { InteligenciaNegociosComponent } from './inteligenciaNegocios.component';
import { moduleGuard } from '../../core/guards/module.guard';

/** Rutas de listado + detalle reutilizando los componentes de vistas. */
function vistasReporteRoutes(config: {
  path: string;
  moduleCode: string;
  grupoTipo: 1 | 2 | 3;
  pageTitle: string;
  pageSubtitle: string;
}): Routes {
  const listPath = `/inteligenciaNegocios/${config.path}`;
  const routeData = {
    moduleCode: config.moduleCode,
    grupoTipo: config.grupoTipo,
    vistaAgrupada: true,
    listPath,
    pageTitle: config.pageTitle,
    pageSubtitle: config.pageSubtitle
  };

  return [
    {
      path: config.path,
      loadComponent: () =>
        import('./vistas/listadoVistas/listadoVistas.component').then(m => m.ListadoVistasComponent),
      canActivate: [moduleGuard],
      data: routeData
    },
    {
      path: `${config.path}/viewVistas/fullscreen/:schema/:viewName`,
      loadComponent: () =>
        import('./vistas/viewVistas/viewVistasFullscreen.component').then(m => m.ViewVistasFullscreenComponent),
      data: { listPath }
    },
    {
      path: `${config.path}/viewVistas/:schema/:viewName`,
      loadComponent: () =>
        import('./vistas/viewVistas/viewVistas.component').then(m => m.ViewVistasComponent),
      canActivate: [moduleGuard],
      data: routeData
    }
  ];
}

export const INTELIGENCIA_NEGOCIOS_ROUTES: Routes = [
  {
    path: '',
    component: InteligenciaNegociosComponent
  },
  {
    path: 'vistas',
    loadComponent: () =>
      import('./vistas/listadoVistas/listadoVistas.component').then(m => m.ListadoVistasComponent),
    canActivate: [moduleGuard],
    data: {
      moduleCode: 'BI-VISTAS',
      listPath: '/inteligenciaNegocios/vistas',
      pageTitle: 'Reportes e Información',
      pageSubtitle: 'Consulta de fuentes de datos disponibles según tus permisos'
    }
  },
  {
    path: 'vistas/viewVistas/fullscreen/:schema/:viewName',
    loadComponent: () =>
      import('./vistas/viewVistas/viewVistasFullscreen.component').then(m => m.ViewVistasFullscreenComponent),
    data: { listPath: '/inteligenciaNegocios/vistas' }
  },
  {
    path: 'vistas/viewVistas/:schema/:viewName',
    loadComponent: () =>
      import('./vistas/viewVistas/viewVistas.component').then(m => m.ViewVistasComponent),
    canActivate: [moduleGuard],
    data: {
      moduleCode: 'BI-VISTAS',
      listPath: '/inteligenciaNegocios/vistas',
      pageTitle: 'Reportes e Información',
      pageSubtitle: 'Consulta de fuentes de datos disponibles según tus permisos'
    }
  },
  ...vistasReporteRoutes({
    path: 'reportes-administrativos',
    moduleCode: 'BI-VISTAS-REPORTE_AD',
    grupoTipo: 3,
    pageTitle: 'Reportes Administrativos',
    pageSubtitle: 'Consulta de reportes administrativos según tus permisos'
  }),
  { path: 'reportes-administrativo', redirectTo: 'reportes-administrativos', pathMatch: 'full' },
  ...vistasReporteRoutes({
    path: 'reportes-asistenciales',
    moduleCode: 'BI-VISTAS-REPORTE_AS',
    grupoTipo: 1,
    pageTitle: 'Reportes Asistenciales',
    pageSubtitle: 'Consulta de reportes asistenciales según tus permisos'
  }),
  ...vistasReporteRoutes({
    path: 'reportes-financieros',
    moduleCode: 'BI-VISTAS-REPORTE_FI',
    grupoTipo: 2,
    pageTitle: 'Reportes Financieros',
    pageSubtitle: 'Consulta de reportes financieros según tus permisos'
  }),
  {
    path: 'parametros/esquemas',
    loadComponent: () =>
      import('./parametros/esquemas/esquemas.component').then(m => m.EsquemasComponent),
    canActivate: [moduleGuard],
    data: {
      moduleCode: 'BI-PARAMETROS-ESQ',
      pageTitle: 'Esquemas BI',
      pageSubtitle: 'Configuración del catálogo de esquemas por empresa'
    }
  },
  {
    path: 'parametros/odata-links',
    loadComponent: () =>
      import('./parametros/odataLinks/odataLinks.component').then(m => m.OdataLinksComponent),
    canActivate: [moduleGuard],
    data: {
      moduleCode: 'BI-ODATA-LINKS',
      pageTitle: 'Links OData — Excel',
      pageSubtitle: 'Generación de URLs dinámicas y permisos de actualización desde Excel'
    }
  },
  {
    path: 'parametros/usuariosBI',
    loadComponent: () =>
      import('./parametros/usuariosBI/usuarios-bi.component').then(m => m.UsuariosBiComponent),
    canActivate: [moduleGuard],
    data: {
      moduleCode: 'BI-PARAMETROS-USU',
      pageTitle: 'Usuarios BI',
      pageSubtitle: 'Consulta de grupos Azure y permisos delegados por usuario'
    }
  }
];