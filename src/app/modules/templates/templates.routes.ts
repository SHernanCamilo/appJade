import { Routes } from '@angular/router';

export const TEMPLATES_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'list',
    pathMatch: 'full'
  },
  {
    path: 'list',
    loadComponent: () => import('./template-list/template-list.component').then(m => m.TemplateListComponent),
    data: { title: 'Listado de Plantillas' }
  },
  {
    path: 'create',
    loadComponent: () => import('./template-editor/template-editor.component').then(m => m.TemplateEditorComponent),
    data: { title: 'Crear Plantilla' }
  },
  {
    path: 'edit/:id',
    loadComponent: () => import('./template-editor/template-editor.component').then(m => m.TemplateEditorComponent),
    data: { title: 'Editar Plantilla' }
  },
  {
    path: 'generate/:id',
    loadComponent: () => import('./document-generator/document-generator.component').then(m => m.DocumentGeneratorComponent),
    data: { title: 'Generar Documento' }
  }
];
