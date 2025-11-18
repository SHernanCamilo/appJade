import { Routes } from '@angular/router';
import { LoginComponent } from './modules/auth/login/login.component';
import { DashboardComponent } from './modules/dashboard/dashboard.component';
import { authGuard } from './modules/auth/auth.guard';
import { MainLayoutComponent } from './complements/layout/main-layout/main-layout.component';

export const routes: Routes = [
  // Ruta pública - Login
  { 
    path: 'login', 
    component: LoginComponent 
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
      //{ path: 'ordenes', component: OrdenesComponent },
      //{ path: 'horas-extras', component: HorasExtrasComponent },
      // agrega más vistas aquí
    ]
  },
  
  // Redirección por defecto
  { path: '**', redirectTo: 'login' }
];


