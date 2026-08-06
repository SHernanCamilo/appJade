import { Routes } from '@angular/router';
import { moduleGuard } from '../../../core/guards/module.guard';

/**
 * Rutas lazy del módulo Fichas Técnicas.
 *
 * Cada pantalla se carga bajo demanda, de forma que el bundle principal no
 * incluye código del módulo hasta que el usuario navegue a él.
 *
 * Códigos de módulo para permisos:
 *   CONT-FT           → Dashboard + Bandeja (acceso general fichas)
 *   CONT-FT-FORM      → Crear / editar fichas
 *   CONT-FT-DETALLE   → Ver detalle y validar
 *   CONT-FT-PARAM     → Administración de catálogos
 *   CONT-FT-CUPS      → Buscador CUPS / Tarifarios
 */
export const FICHAS_TECNICAS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./dashboard/fichas-dashboard.component').then((m) => m.FichasDashboardComponent),
    canActivate: [moduleGuard],
    data: {
      moduleCode: 'CONT-FT',
      pageTitle: 'Fichas Técnicas',
      pageSubtitle: 'Dashboard de fichas técnicas médicas'
    }
  },
  {
    path: 'bandeja/:bandeja',
    loadComponent: () =>
      import('./bandeja/bandeja-fichas.component').then((m) => m.BandejaFichasComponent),
    canActivate: [moduleGuard],
    data: {
      moduleCode: 'CONT-FT',
      pageTitle: 'Bandeja de Fichas',
      pageSubtitle: 'Gestión de fichas técnicas por estado'
    }
  },
  {
    // Un solo componente para crear / editar / actualizar.
    // mode se determina por la presencia de :id y queryParam ?modo=
    //   sin :id         → crear nueva
    //   :id + editar    → editar borrador
    //   :id + os        → crear actualización (OS)
    path: 'formulario',
    loadComponent: () =>
      import('./generador/generador-ficha.component').then((m) => m.GeneradorFichaComponent),
    canActivate: [moduleGuard],
    data: {
      moduleCode: 'CONT-FT-FORM',
      pageTitle: 'Crear Ficha Técnica',
      pageSubtitle: 'Formulario de nueva ficha técnica'
    }
  },
  {
    path: 'formulario/:id',
    loadComponent: () =>
      import('./generador/generador-ficha.component').then((m) => m.GeneradorFichaComponent),
    canActivate: [moduleGuard],
    data: {
      moduleCode: 'CONT-FT-FORM',
      pageTitle: 'Editar Ficha Técnica',
      pageSubtitle: 'Edición de ficha técnica existente'
    }
  },
  {
    // Detalle + validación unificados: si el usuario tiene rol validador,
    // el componente muestra el panel de validación contextual automáticamente.
    path: 'ficha/:id',
    loadComponent: () =>
      import('./detalle/detalle-ficha.component').then((m) => m.DetalleFichaComponent),
    canActivate: [moduleGuard],
    data: {
      moduleCode: 'CONT-FT-DETALLE',
      pageTitle: 'Detalle Ficha Técnica',
      pageSubtitle: 'Visualización y validación de ficha técnica'
    }
  },
  {
    path: 'parametros',
    loadComponent: () =>
      import('./parametros/parametros-ficha.component').then((m) => m.ParametrosFichaComponent),
    canActivate: [moduleGuard],
    data: {
      moduleCode: 'CONT-FT-PARAM',
      pageTitle: 'Parámetros Fichas Técnicas',
      pageSubtitle: 'Administración de catálogos y configuración'
    }
  },
  {
    path: 'cups',
    loadComponent: () =>
      import('./cups/buscador-cups.component').then((m) => m.BuscadorCupsComponent),
    canActivate: [moduleGuard],
    data: {
      moduleCode: 'CONT-FT-CUPS',
      pageTitle: 'Buscador CUPS',
      pageSubtitle: 'Consulta de procedimientos y tarifarios'
    }
  },
];
