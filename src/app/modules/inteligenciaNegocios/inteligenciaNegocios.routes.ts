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
        import('./vistas/components/view-vistas-excel/viewVistasExcel.component').then(m => m.ViewVistasExcelComponent),
      data: { listPath }
    },
    {
      path: `${config.path}/viewVistas/pivot/:schema/:viewName`,
      loadComponent: () =>
        import('./vistas/components/view-vistas-pivot/viewVistasPivot.component').then(m => m.ViewVistasPivotComponent),
      data: { listPath }
    },
    {
      path: `${config.path}/viewVistas/:schema/:viewName`,
      loadComponent: () =>
        import('./vistas/components/view-vistas-grid/viewVistas.component').then(m => m.ViewVistasComponent),
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
    path: 'excelSheets',
    loadComponent: () =>
      import('./vistas/components/mis-excels/mis-excels.component').then(m => m.MisExcelsComponent),
    canActivate: [moduleGuard],
    data: {
      moduleCode: 'BI-VISTAS',
      pageTitle: 'Excel Sheets',
      pageSubtitle: 'Workbooks guardados con tus vistas, formulas y configuracion'
    }
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
      import('./vistas/components/view-vistas-excel/viewVistasExcel.component').then(m => m.ViewVistasExcelComponent),
    data: { listPath: '/inteligenciaNegocios/vistas' }
  },
  {
    path: 'vistas/viewVistas/pivot/:schema/:viewName',
    loadComponent: () =>
      import('./vistas/components/view-vistas-pivot/viewVistasPivot.component').then(m => m.ViewVistasPivotComponent),
    data: { listPath: '/inteligenciaNegocios/vistas' }
  },
  {
    path: 'vistas/viewVistas/:schema/:viewName',
    loadComponent: () =>
      import('./vistas/components/view-vistas-grid/viewVistas.component').then(m => m.ViewVistasComponent),
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
    path: 'parametros/fabric-metrics',
    loadComponent: () =>
      import('./parametros/fabricMetrics/fabricMetrics.component').then(m => m.FabricMetricsComponent),
    canActivate: [moduleGuard],
    data: {
      moduleCode: 'BI-FABRIC-METRICS',
      pageTitle: 'Monitoreo Fabric',
      pageSubtitle: 'Dashboard de métricas en tiempo real de Graph-Fabric'
    }
  },
  {
    path: 'parametros/cron-parquet',
    loadComponent: () =>
      import('./parametros/cronParquet/cronParquet.component').then(m => m.CronParquetComponent),
    canActivate: [moduleGuard],
    data: {
      moduleCode: 'BI-CRON-PARQUET',
      pageTitle: 'Cron Parquet',
      pageSubtitle: 'Configuración de intervalos de regeneración de parquets por vista'
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
  },
  {
    path: 'formularios/cruceCuentaSoat',
    loadComponent: () =>
      import('./formularios/cruceCuentaSoat/cruceCuentaSoat.component').then(
        m => m.CruceCuentaSoatComponent
      ),
    canActivate: [moduleGuard],
    data: {
      moduleCode: 'BI-FORM-CRUCE-SOAT',
      pageSubtitle: 'Consulta de facturación SOAT por cédula'
    }
  },
  {
    path: 'formularios/lecturas',
    loadComponent: () =>
      import('./formularios/lecturas/lecturas.component').then(
        m => m.LecturasComponent
      ),
    canActivate: [moduleGuard],
    data: {
      moduleCode: 'BI-FORMULARIOS-LECTU',
      pageTitle: 'Lecturas Imagenologia',
      pageSubtitle: 'Consulta de lecturas radiologicas por paciente o profesional'
    }
  },
  {
    path: 'formularios/perfilFarmacoterapeutico',
    loadComponent: () =>
      import('./formularios/perfilFarmacoterapeutico/perfilFarmacoterapeutico.component').then(
        m => m.PerfilFarmacoterapeuticoComponent
      ),
    canActivate: [moduleGuard],
    data: {
      moduleCode: 'BI-FORM-PFARMA',
      pageSubtitle: 'Consulta de perfil farmacoterapéutico por cédula'
    }
  },
  {
    path: 'formularios/trasladoAsistencial',
    loadComponent: () =>
      import('./formularios/trasladoAsistencial/trasladoAsistencial.component').then(
        m => m.TrasladoAsistencialComponent
      ),
    canActivate: [moduleGuard],
    data: {
      moduleCode: 'BI-FORM-TRASLADO-ASI',
      pageTitle: 'Traslado Asistencial',
      pageSubtitle: 'Historia clínica de traslado primario o secundario asistencial'
    }
  },
  {
    path: 'tableros/Egresos',
    loadComponent: () =>
      import('./tableros/egresos/egresos.component').then(m => m.EgresosTableroComponent),
    canActivate: [moduleGuard],
    data: {
      moduleCode: 'BI-TABLERO-EGRESOS',
      pageTitle: 'Tablero de Egresos',
      pageSubtitle: 'Cuenta de ingresos por sucursal y unidad funcional (dc.VW_HC_Egresos_Conteo)'
    }
  },
  {
    path: 'chatbot',
    loadComponent: () =>
      import('./chatbot/chatbot.component').then(m => m.ChatBotComponent),
    canActivate: [moduleGuard],
    data: {
      moduleCode: 'BI-CHATBOT',
      pageTitle: 'Asistente de Datos IA',
      pageSubtitle: 'Consulta información de las vistas disponibles mediante lenguaje natural'
    }
  }
];
