import { Routes } from '@angular/router';
import { moduleGuard } from '../../../core/guards/module.guard';

/**
 * Rutas lazy del módulo Fichas Técnicas.
 *
 * Cada pantalla se carga bajo demanda y está protegida por moduleGuard, que
 * verifica que el código del módulo exista en el árbol de módulos del sidebar
 * cargado desde el login (seg_modulos).
 *
 * Los moduleCode corresponden exactamente a los códigos de seg_modulos:
 *   CONT-FICHAS         → Fichas Técnicas (raíz / dashboard)
 *   CONT-FICHAS-GEN     → Generar Ficha (formulario)
 *   CONT-FICHAS-BANDEJA → Bandeja de Fichas
 *   CONT-FICHAS-PARAM   → Parámetros de Fichas
 *   CONT-FICHAS-CUPS    → Buscador CUPS
 */
export const FICHAS_TECNICAS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./dashboard/fichas-dashboard.component').then((m) => m.FichasDashboardComponent),
    canActivate: [moduleGuard],
    data: {
      moduleCode: 'CONT-FICHAS',
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
      moduleCode: 'CONT-FICHAS-BANDEJA',
      pageTitle: 'Bandeja de Fichas',
      pageSubtitle: 'Gestión de fichas técnicas por estado'
    }
  },
  {
    // Crear nueva ficha (sin :id).
    path: 'formulario',
    loadComponent: () =>
      import('./generador/generador-ficha.component').then((m) => m.GeneradorFichaComponent),
    canActivate: [moduleGuard],
    data: {
      moduleCode: 'CONT-FICHAS-GEN',
      pageTitle: 'Crear Ficha Técnica',
      pageSubtitle: 'Formulario de nueva ficha técnica'
    }
  },
  {
    // Editar borrador o crear actualización (OS) sobre ficha existente.
    path: 'formulario/:id',
    loadComponent: () =>
      import('./generador/generador-ficha.component').then((m) => m.GeneradorFichaComponent),
    canActivate: [moduleGuard],
    data: {
      moduleCode: 'CONT-FICHAS-GEN',
      pageTitle: 'Editar Ficha Técnica',
      pageSubtitle: 'Edición de ficha técnica existente'
    }
  },
  {
    // Detalle + validación unificados: el componente muestra el panel de
    // validación según el rol del usuario autenticado (autorizar / aprobar).
    path: 'ficha/:id',
    loadComponent: () =>
      import('./detalle/detalle-ficha.component').then((m) => m.DetalleFichaComponent),
    canActivate: [moduleGuard],
    data: {
      moduleCode: 'CONT-FICHAS-BANDEJA',
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
      moduleCode: 'CONT-FICHAS-PARAM',
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
      moduleCode: 'CONT-FICHAS-CUPS',
      pageTitle: 'Buscador CUPS',
      pageSubtitle: 'Consulta de procedimientos y tarifarios'
    }
  },
];
