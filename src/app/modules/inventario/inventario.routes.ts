import { Routes } from '@angular/router';
import { InventarioComponent } from './inventario.component';
import { moduleGuard } from '../../core/guards/module.guard';

export const INVENTARIO_ROUTES: Routes = [
  {
    path: '',
    component: InventarioComponent
  },
  {
    path: 'pedidos',
    loadComponent: () => import('./pedidos/pedidos.component').then(m => m.PedidosComponent)
  },
  {
    path: 'ordenes-compra',
    loadComponent: () => import('./ordenes-compra/ordenes-compra.component').then(m => m.OrdenesCompraComponent)
  },
  {
    path: 'recepciones-tecnicas',
    loadComponent: () => import('./recepciones-tecnicas/recepciones-tecnicas.component').then(m => m.RecepcionesTecnicasComponent)
  },
  {
    path: 'productos',
    loadComponent: () => import('./productos/productos.component').then(m => m.ProductosComponent)
  },
  {
    path: 'matrizObsolescencia',
    children: [
      {
        path: 'dashboardMaObsolescencia',
        loadComponent: () => import('./matrizObsolescencia/dashboardMaObsolescencia/dashboardMaObsolescencia.component').then(m => m.DashboardMaObsolescenciaComponent),
        canActivate: [moduleGuard],  // ⚠️ Desactivado temporalmente
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
        canActivate: [moduleGuard],  // ⚠️ Desactivado temporalmente
        data: { moduleCode: 'INV-FRACTTAL-GLPI' }
      }
    ]
  }
];
