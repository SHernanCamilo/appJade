import { Routes } from '@angular/router';
import { LoginComponent } from './modules/auth/login/login.component';
import { DashboardComponent } from './modules/dashboard/dashboard.component';
import { authGuard } from './modules/auth/auth.guard';
import { tableroGuard } from './core/guards/tablero.guard';
import { MainLayoutComponent } from './complements/layout/main-layout/main-layout.component';

export const routes: Routes = [
  // Rutas públicas - Auth
  { 
    path: 'login', 
    component: LoginComponent 
  },
  {
    path: 'auth/microsoft/callback',
    loadComponent: () => import('./modules/auth/microsoft-callback/microsoft-callback.component').then(m => m.MicrosoftCallbackComponent)
  },

  // Tablero de Urgencias — requiere login + rol "Tablero"
  {
    path: 'tableroUrgencias',
    loadComponent: () => import('./modules/tableroUrgencias/tablero-urgencias.component').then(m => m.TableroUrgenciasComponent),
    canActivate: [tableroGuard]
  },

  // Vista Excel de Recepción Técnica — pantalla completa sin layout (se abre en pestaña nueva)
  {
    path: 'recepcionExcel/:compraId',
    loadComponent: () => import('./modules/inventario/recepciones-tecnicas/recepcion-excel/recepcion-excel.component').then(m => m.RecepcionExcelComponent),
    canActivate: [authGuard]
  },

  // Vista Excel "Actualizar datos" de BI — pantalla completa sin layout (se abre en pestaña nueva)
  // Ruta genérica nueva (recomendada)
  {
    path: 'inteligenciaNegocios/viewVistaExcel',
    loadComponent: () => import('./modules/inteligenciaNegocios/vistas/components/view-vistas-refresh/viewVistasRefresh.component').then(m => m.ViewVistasRefreshComponent),
    canActivate: [authGuard],
    data: { listPath: '/inteligenciaNegocios/vistas' }
  },
  
  // Ruta legacy (mantener por compatibilidad)
  {
    path: 'vistaBI-refresh/:schema/:viewName',
    loadComponent: () => import('./modules/inteligenciaNegocios/vistas/components/view-vistas-refresh/viewVistasRefresh.component').then(m => m.ViewVistasRefreshComponent),
    canActivate: [authGuard],
    data: { listPath: '/inteligenciaNegocios/vistas' }
  },
  
  
  // Rutas protegidas con layout
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard], // Protege todas las rutas hijas
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent },
      { 
        path: 'organizacion', 
        loadChildren: () => import('./modules/organizacion/organizacion.routes').then(m => m.ORGANIZACION_ROUTES)
      },
      { 
        path: 'inventario', 
        loadChildren: () => import('./modules/inventario/inventario.routes').then(m => m.INVENTARIO_ROUTES)
      },
      { 
        path: 'financiera', 
        loadChildren: () => import('./modules/financiera/financiera.routes').then(m => m.FINANCIERA_ROUTES)
      },
      { 
        path: 'contabilidad', 
        loadChildren: () => import('./modules/contabilidad/contabilidad.routes').then(m => m.CONTABILIDAD_ROUTES)
      },
      { 
        path: 'templates', 
        loadChildren: () => import('./modules/templates/templates.routes').then(m => m.TEMPLATES_ROUTES)
      },
      {
        path: 'sistema',
        loadChildren: () => import('./modules/sistema/sistema.routes').then(m => m.SISTEMA_ROUTES)
      },
      { 
        path: 'talentoHumano', 
        loadChildren: () => import('./modules/talentoHumano/talentoHumano.routes').then(m => m.TALENTOHUMANO_ROUTES)
      },
      {
        path: 'inteligenciaNegocios',
        loadChildren: () => import('./modules/inteligenciaNegocios/inteligenciaNegocios.routes').then(m => m.INTELIGENCIA_NEGOCIOS_ROUTES)
      },
      {
        path: 'mesaServicio',
        loadChildren: () => import('./modules/mesaServicio/mesaServicio.routes').then(m => m.MESA_SERVICIO_ROUTES)
      },
      //{ path: 'ordenes', component: OrdenesComponent },
      //{ path: 'horas-extras', component: HorasExtrasComponent },
      // agrega más vistas aquí
    ]
  },

   // Redirección por defecto
  { path: '**', redirectTo: 'login' }
];


