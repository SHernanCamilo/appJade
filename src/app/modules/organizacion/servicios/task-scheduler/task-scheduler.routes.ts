import { Routes } from '@angular/router';

export const TASK_SCHEDULER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./task-scheduler-dashboard.component').then(m => m.TaskSchedulerDashboardComponent)
  },
  {
    path: 'list',
    loadComponent: () => import('./components/task-list.component').then(m => m.TaskListComponent)
  },
  {
    path: 'create',
    loadComponent: () => import('./components/task-create.component').then(m => m.TaskCreateComponent)
  }
];
