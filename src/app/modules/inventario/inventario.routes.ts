import { Routes } from '@angular/router';
import { InventarioComponent } from './inventario.component';
import { moduleGuard } from '../../core/guards/module.guard';

export const INVENTARIO_ROUTES: Routes = [
  {
    path: '',
    component: InventarioComponent
  },
  {
    path: 'matrizObsolescencia',
    children: [
      {
        path: 'dashboardMaObsolescencia',
        loadComponent: () => import('./matrizObsolescencia/dashboardMaObsolescencia/dashboardMaObsolescencia.component').then(m => m.DashboardMaObsolescenciaComponent),
        // canActivate: [moduleGuard],  // ⚠️ Desactivado temporalmente
        // data: { moduleCode: 'INV-MATRIX-DAHSBOARD' }
      },
      {
        path: 'parametrosMaObsolescencia',
        loadComponent: () => import('./matrizObsolescencia/parametrosMaObsolescencia/parametrosMaObsolescencia.component').then(m => m.ParametrosMaObsolescenciaComponent),
        // canActivate: [moduleGuard],  // ⚠️ Desactivado temporalmente
        // data: { moduleCode: 'INV-MATRIX-PARMATRIZ' }
      }
    ]
  }
];
