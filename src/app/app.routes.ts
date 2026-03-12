import { Routes } from '@angular/router';
import { LoginComponent } from './modules/auth/login/login.component';
import { DashboardComponent } from './modules/dashboard/dashboard.component';
import { authGuard } from './modules/auth/auth.guard';
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
      //{ path: 'ordenes', component: OrdenesComponent },
      //{ path: 'horas-extras', component: HorasExtrasComponent },
      // agrega más vistas aquí
    ]
  },

   // Redirección por defecto
  { path: '**', redirectTo: 'login' }
];


