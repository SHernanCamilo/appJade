import { Routes } from '@angular/router';
import { InventarioComponent } from './inventario.component';
import { moduleGuard } from '../../core/guards/module.guard';

export const INVENTARIO_ROUTES: Routes = [
  {
    path: '',
    component: InventarioComponent
  },
  {
    path: 'farmacia',
    children: [
      {
        path: 'pedidos',
        loadComponent: () => import('./pedidos/pedidos.component').then(m => m.PedidosComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'INV-PEDIDOS' }
      },
      {
        path: 'ordenCompra',
        loadComponent: () => import('./ordenes-compra/ordenes-compra.component').then(m => m.OrdenesCompraComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'INV-ORDENES' }
      },
      {
        path: 'recepcionTecnica',
        loadComponent: () => import('./recepciones-tecnicas/recepciones-tecnicas.component').then(m => m.RecepcionesTecnicasComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'INV-RECEPCIONES' }
      },
      {
        path: 'productos',
        loadComponent: () => import('./productos/productos.component').then(m => m.ProductosComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'INV-PRODUCTOS' }
      },
      {
        // Tablero unificado: Pedidos + Órdenes de Compra + Recepciones Técnicas.
        path: 'reportes',
        loadComponent: () => import('./reportes/reportes.component').then(m => m.ReportesComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'INV-REPORTES' }
      }
    ]
  },
  {
    path: 'matrizObsolescencia',
    children: [
      {
        path: 'dashboardMaObsolescencia',
        loadComponent: () => import('./matrizObsolescencia/dashboardMaObsolescencia/dashboardMaObsolescencia.component').then(m => m.DashboardMaObsolescenciaComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'INV-MATRIX-DAHSBOARD' }
      },
      {
        path: 'parametrosMaObsolescencia',
        loadComponent: () => import('./matrizObsolescencia/parametrosMaObsolescencia/parametrosMaObsolescencia.component').then(m => m.ParametrosMaObsolescenciaComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'INV-MATRIX-PARMATRIZ' }
      },
      {
        path: 'reporteMaObsolescencia',
        loadComponent: () => import('./matrizObsolescencia/reporteMaObsolescencia/reporteMaObsolescencia.component').then(m => m.ReporteMaObsolescenciaComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'INV-MATRIX-REPORTE' }
      },
      {
        path: 'cierreInventario',
        loadComponent: () => import('./matrizObsolescencia/cierreInventario/cierreInventario.component').then(m => m.CierreInventarioComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'INV-MATRIX-CIERRE' }
      },
      {
        path: 'comparar',
        loadComponent: () => import('./matrizObsolescencia/comparadorMaObsolescencia/comparadorMaObsolescencia.component').then(m => m.ComparadorMaObsolescenciaComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'INV-MATRIX-COMPARAR' }
      },
      {
        path: 'comparadorMaObsolescencia',
        redirectTo: 'comparar',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: 'interfazFracttal',
    children: [
      {
        path: 'dashboardFracttal',
        loadComponent: () => import('./interfazFracttal/dashboardFracttal/dashboardFracttal.component').then(m => m.DashboardFracttalComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'INV-FRACTTAL-GLPI' }
      }
    ]
  },
  {
    // Activo Fijos (padre) con sus hijos
    path: 'activosFijos',
    children: [
      {
        path: '',
        redirectTo: 'controlActivo',
        pathMatch: 'full'
      },
      {
        path: 'controlActivo',
        loadComponent: () =>
          import('./activosFijos/controlActivo/controlActivo.component').then(m => m.ControlActivoComponent),
        canActivate: [moduleGuard],
        data: {
          moduleCode: 'INV-ACTIVOS-CTRL',
          pageTitle: 'Control de Activos Fijos',
          pageSubtitle: 'Registro de novedades y trazabilidad'
        }
      },
      {
        path: 'tiposInventario',
        loadComponent: () =>
          import('./activosFijos/parametrosTiposInventario/parametrosTiposInventario.component')
            .then(m => m.ParametrosTiposInventarioComponent),
        canActivate: [moduleGuard],
        data: {
          moduleCode: 'INV-ACTIVOS-TIPOS',
          pageTitle: 'Tipos de Inventario',
          pageSubtitle: 'Parametrización de tipos y periodicidad'
        }
      }
    ]
  },
  {
    path: 'ropaHospitalaria',
    children: [
      { path: '', redirectTo: 'parametros', pathMatch: 'full' },
      {
        path: 'parametros',
        loadComponent: () => import('./ropaHospitalaria/parametros/parametros-ropa.component').then(m => m.ParametrosRopaComponent),
        canActivate: [moduleGuard],
        data: {
          moduleCode: 'INV-ROPA-PARAM',
          pageTitle: 'Parámetros de ropa hospitalaria',
          pageSubtitle: 'Prendas, cupos por unidad y constantes'
        }
      },
      {
        path: 'inventario',
        loadComponent: () => import('./ropaHospitalaria/inventario/tomar-inventario.component').then(m => m.TomarInventarioComponent),
        canActivate: [moduleGuard],
        data: {
          moduleCode: 'INV-ROPA-TOMA',
          pageTitle: 'Nuevo inventario',
          pageSubtitle: 'Toma del conteo físico'
        }
      },
      {
        path: 'inventario/nuevo',
        redirectTo: 'inventario',
        pathMatch: 'full'
      },
      {
        path: 'reporte',
        loadComponent: () => import('./ropaHospitalaria/reporte/reporte-propio.component').then(m => m.ReportePropioComponent),
        canActivate: [moduleGuard],
        data: {
          moduleCode: 'INV-ROPA-REP',
          pageTitle: 'Reportes',
          pageSubtitle: 'Inventarios de ropa que usted cerró'
        }
      },
      {
        path: 'inventario/:id',
        loadComponent: () => import('./ropaHospitalaria/inventario/tomar-inventario.component').then(m => m.TomarInventarioComponent),
        canActivate: [moduleGuard],
        data: {
          moduleCode: 'INV-ROPA-TOMA',
          pageTitle: 'Inventario de ropa',
          pageSubtitle: 'Conteo físico'
        }
      }
    ]
  },
  // Compatibilidad con los enlaces previos
  { path: 'activosFijos/tomaInventario', redirectTo: 'activosFijos/controlActivo', pathMatch: 'full' },
  { path: 'activosFijos/trazabilidad',   redirectTo: 'activosFijos/controlActivo', pathMatch: 'full' }
];