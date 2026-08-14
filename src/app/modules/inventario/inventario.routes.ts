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
        path: 'recepcionTecnica/excel/:compraId',
        loadComponent: () => import('./recepciones-tecnicas/recepcion-excel/recepcion-excel.component').then(m => m.RecepcionExcelComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'INV-RECEPCIONES' }
      },
      {
        path: 'productos',
        loadComponent: () => import('./productos/productos.component').then(m => m.ProductosComponent),
        canActivate: [moduleGuard],
        data: { moduleCode: 'INV-PRODUCTOS' }
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
    path: 'activosFijos',
    children: [
      {
        path: 'tomaInventario',
        loadComponent: () =>
          import('./activosFijos/tomaInventario/tomaInventario.component').then(m => m.TomaInventarioComponent),
        canActivate: [moduleGuard],
        data: {
          moduleCode: 'INV-ACTIVOS-TOMA',
          pageTitle: 'Toma de Inventario — Activos Fijos',
          pageSubtitle: 'Consulta del maestro de activos y registro de novedades'
        }
      },
      {
        path: 'trazabilidad',
        loadComponent: () =>
          import('./activosFijos/trazabilidadActivo/trazabilidadActivo.component').then(m => m.TrazabilidadActivoComponent),
        canActivate: [moduleGuard],
        data: {
          moduleCode: 'INV-ACTIVOS-TRAZ',
          pageTitle: 'Trazabilidad de Activos Fijos',
          pageSubtitle: 'Historial de tomas de inventario y cambios reportados'
        }
      },
      { path: '', redirectTo: 'tomaInventario', pathMatch: 'full' }
    ]
  }
];
