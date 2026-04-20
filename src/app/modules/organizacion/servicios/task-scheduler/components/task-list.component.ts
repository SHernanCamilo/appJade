import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TaskSchedulerService } from '../services/task-scheduler.service';
import { ScheduledTask, TaskListParams, TaskStatus, TaskType } from '../models/scheduled-task.model';
import { interval, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-task-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="page-container">
      <!-- Header -->
      <div class="page-header">
        <button class="btn btn-back" routerLink="../">
          <i class="bi bi-arrow-left me-2"></i>Volver al Dashboard
        </button>
        <h1 class="page-title">
          <i class="bi bi-list-ul me-2"></i>Lista de Tareas
        </h1>
      </div>

      <!-- Filters -->
      <div class="filters-card">
        <div class="filters-row">
          <div class="filter-group">
            <label>Estado</label>
            <select class="form-select" [(ngModel)]="filters.status" (change)="applyFilters()">
              <option [value]="undefined">Todos</option>
              <option value="pending">Pendiente</option>
              <option value="running">En Ejecución</option>
              <option value="completed">Completada</option>
              <option value="failed">Fallida</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </div>

          <div class="filter-group">
            <label>Tipo</label>
            <select class="form-select" [(ngModel)]="filters.type" (change)="applyFilters()">
              <option [value]="undefined">Todos</option>
              <option value="sync_activos">Sincronización Activos</option>
              <option value="cierre_automatico">Cierre Automático</option>
              <option value="mantenimiento_db">Mantenimiento DB</option>
              <option value="envio_reportes">Envío Reportes</option>
            </select>
          </div>

          <div class="filter-group flex-grow">
            <label>Buscar</label>
            <input 
              type="text" 
              class="form-control" 
              placeholder="Buscar por nombre..."
              [(ngModel)]="filters.search"
              (keyup.enter)="applyFilters()"
            />
          </div>

          <div class="filter-actions">
            <button class="btn btn-primary" (click)="applyFilters()">
              <i class="bi bi-search me-2"></i>Buscar
            </button>
            <button class="btn btn-outline-secondary" (click)="clearFilters()">
              <i class="bi bi-x-circle me-2"></i>Limpiar
            </button>
          </div>
        </div>
      </div>

      <!-- Actions Bar -->
      <div class="action-bar">
        <button class="btn btn-success" routerLink="../create">
          <i class="bi bi-plus-circle me-2"></i>Nueva Tarea
        </button>
        <button class="btn btn-outline-secondary" (click)="refreshList()">
          <i class="bi bi-arrow-clockwise me-2"></i>Actualizar
        </button>
      </div>

      <!-- Tasks Table -->
      <div class="content-card">
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Programada</th>
                <th>Duración</th>
                <th>Intentos</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let task of tasks">
                <td>{{ task.id }}</td>
                <td>
                  <div class="task-name">{{ task.name }}</div>
                  <div class="task-description" *ngIf="task.description">
                    {{ task.description }}
                  </div>
                </td>
                <td>
                  <i class="bi {{ getTaskTypeIcon(task.type) }} me-2"></i>
                  {{ task.type_name }}
                </td>
                <td>
                  <span class="badge {{ getStatusBadgeClass(task.status) }}">
                    {{ task.status_label }}
                  </span>
                  <span class="badge badge-danger ms-1" *ngIf="task.is_overdue">
                    Vencida
                  </span>
                </td>
                <td>{{ formatDate(task.scheduled_at) }}</td>
                <td>{{ task.duration_formatted || '-' }}</td>
                <td>{{ task.attempts }}/{{ task.max_attempts }}</td>
                <td>
                  <div class="action-buttons">
                    <button 
                      class="btn btn-sm btn-outline-primary"
                      (click)="viewTask(task)"
                      title="Ver detalles">
                      <i class="bi bi-eye"></i>
                    </button>
                    <button 
                      class="btn btn-sm btn-outline-success"
                      *ngIf="task.status === 'pending'"
                      (click)="executeTask(task)"
                      title="Ejecutar ahora">
                      <i class="bi bi-play-fill"></i>
                    </button>
                    <button 
                      class="btn btn-sm btn-outline-warning"
                      *ngIf="task.status === 'failed' && task.can_retry"
                      (click)="retryTask(task)"
                      title="Reintentar">
                      <i class="bi bi-arrow-clockwise"></i>
                    </button>
                    <button 
                      class="btn btn-sm btn-outline-secondary"
                      *ngIf="task.status === 'pending'"
                      (click)="cancelTask(task)"
                      title="Cancelar">
                      <i class="bi bi-x-circle"></i>
                    </button>
                    <button 
                      class="btn btn-sm btn-outline-danger"
                      *ngIf="task.status !== 'running'"
                      (click)="deleteTask(task)"
                      title="Eliminar">
                      <i class="bi bi-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>
              <tr *ngIf="tasks.length === 0 && !loading">
                <td colspan="8" class="text-center text-muted py-4">
                  No se encontraron tareas
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div class="pagination-container" *ngIf="pagination">
          <div class="pagination-info">
            Mostrando {{ pagination.from }} a {{ pagination.to }} de {{ pagination.total }} tareas
          </div>
          <div class="pagination-controls">
            <button 
              class="btn btn-sm btn-outline-secondary"
              [disabled]="pagination.current_page === 1"
              (click)="goToPage(pagination.current_page - 1)">
              <i class="bi bi-chevron-left"></i>
            </button>
            <span class="pagination-current">
              Página {{ pagination.current_page }} de {{ pagination.last_page }}
            </span>
            <button 
              class="btn btn-sm btn-outline-secondary"
              [disabled]="pagination.current_page === pagination.last_page"
              (click)="goToPage(pagination.current_page + 1)">
              <i class="bi bi-chevron-right"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div class="loading-overlay" *ngIf="loading">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Cargando...</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-container{padding:2rem;max-width:1600px;margin:0 auto}
    .page-header{margin-bottom:2rem}
    .btn-back{background:#f1f5f9;border:none;padding:.5rem 1rem;border-radius:8px;color:#475569;margin-bottom:1rem}
    .page-title{font-size:1.75rem;font-weight:700;color:#1e293b}
    
    .filters-card{background:#fff;border-radius:12px;padding:1.5rem;margin-bottom:1.5rem;box-shadow:0 2px 8px rgba(0,0,0,.08)}
    .filters-row{display:grid;grid-template-columns:150px 200px 1fr auto;gap:1rem;align-items:end}
    .filter-group{display:flex;flex-direction:column}
    .filter-group label{font-size:.875rem;font-weight:500;color:#475569;margin-bottom:.5rem}
    .filter-actions{display:flex;gap:.5rem}
    .form-select,.form-control{padding:.5rem .75rem;border:1px solid #e2e8f0;border-radius:8px}
    
    .action-bar{display:flex;gap:1rem;margin-bottom:1.5rem}
    .btn{padding:.625rem 1.25rem;border-radius:8px;font-weight:500;transition:all .2s;border:none}
    .btn-success{background:#10b981;color:#fff}
    .btn-outline-secondary{background:#fff;border:1px solid #e2e8f0;color:#475569}
    
    .content-card{background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.08)}
    .table{margin:0}
    .table thead{background:#f8fafc;border-bottom:2px solid #e2e8f0}
    .table th{padding:1rem;font-weight:600;color:#475569;font-size:.875rem;text-transform:uppercase}
    .table td{padding:1rem;vertical-align:middle}
    .task-name{font-weight:500;color:#1e293b}
    .task-description{font-size:.875rem;color:#64748b;margin-top:.25rem}
    
    .badge{padding:.375rem .75rem;border-radius:6px;font-size:.75rem;font-weight:500}
    .badge-warning{background:#fef3c7;color:#f59e0b}
    .badge-info{background:#dbeafe;color:#3b82f6}
    .badge-success{background:#d1fae5;color:#10b981}
    .badge-danger{background:#fee2e2;color:#ef4444}
    .badge-secondary{background:#f1f5f9;color:#64748b}
    
    .action-buttons{display:flex;gap:.5rem}
    .btn-sm{padding:.375rem .625rem;font-size:.875rem}
    .btn-outline-primary{border:1px solid #3b82f6;color:#3b82f6}
    .btn-outline-success{border:1px solid #10b981;color:#10b981}
    .btn-outline-warning{border:1px solid #f59e0b;color:#f59e0b}
    .btn-outline-danger{border:1px solid #ef4444;color:#ef4444}
    
    .pagination-container{display:flex;justify-content:space-between;align-items:center;padding:1.5rem;border-top:1px solid #f1f5f9}
    .pagination-info{color:#64748b;font-size:.875rem}
    .pagination-controls{display:flex;align-items:center;gap:1rem}
    .pagination-current{color:#475569;font-weight:500}
    
    .loading-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(255,255,255,.8);display:flex;align-items:center;justify-content:center;z-index:1000}
  `]
})
export class TaskListComponent implements OnInit, OnDestroy {
  tasks: ScheduledTask[] = [];
  pagination: any = null;
  loading = false;
  filters: TaskListParams = {
    per_page: 15,
    page: 1
  };
  private refreshSubscription?: Subscription;

  constructor(private taskService: TaskSchedulerService) {}

  ngOnInit(): void {
    this.loadTasks();
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    this.refreshSubscription?.unsubscribe();
  }

  loadTasks(): void {
    this.loading = true;
    this.taskService.getTasks(this.filters).subscribe({
      next: (response) => {
        this.tasks = response.data;
        this.pagination = response.meta;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading tasks:', err);
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    this.filters.page = 1;
    this.loadTasks();
  }

  clearFilters(): void {
    this.filters = { per_page: 15, page: 1 };
    this.loadTasks();
  }

  refreshList(): void {
    this.loadTasks();
  }

  goToPage(page: number): void {
    this.filters.page = page;
    this.loadTasks();
  }

  startAutoRefresh(): void {
    this.refreshSubscription = interval(10000)
      .pipe(switchMap(() => this.taskService.getTasks(this.filters)))
      .subscribe({
        next: (response) => {
          this.tasks = response.data;
          this.pagination = response.meta;
        }
      });
  }

  viewTask(task: ScheduledTask): void {
    console.log('View task:', task);
    // Implementar modal o navegación
  }

  executeTask(task: ScheduledTask): void {
    if (confirm(`¿Ejecutar la tarea "${task.name}" inmediatamente?`)) {
      this.taskService.executeTask(task.id).subscribe({
        next: () => {
          alert('Tarea ejecutada exitosamente');
          this.loadTasks();
        },
        error: (err) => alert('Error al ejecutar la tarea: ' + err.error?.message)
      });
    }
  }

  retryTask(task: ScheduledTask): void {
    if (confirm(`¿Reintentar la tarea "${task.name}"?`)) {
      this.taskService.retryTask(task.id).subscribe({
        next: () => {
          alert('Tarea reintentada exitosamente');
          this.loadTasks();
        },
        error: (err) => alert('Error al reintentar: ' + err.error?.message)
      });
    }
  }

  cancelTask(task: ScheduledTask): void {
    if (confirm(`¿Cancelar la tarea "${task.name}"?`)) {
      this.taskService.cancelTask(task.id).subscribe({
        next: () => {
          alert('Tarea cancelada exitosamente');
          this.loadTasks();
        },
        error: (err) => alert('Error al cancelar: ' + err.error?.message)
      });
    }
  }

  deleteTask(task: ScheduledTask): void {
    if (confirm(`¿Eliminar la tarea "${task.name}"? Esta acción no se puede deshacer.`)) {
      this.taskService.deleteTask(task.id).subscribe({
        next: () => {
          alert('Tarea eliminada exitosamente');
          this.loadTasks();
        },
        error: (err) => alert('Error al eliminar: ' + err.error?.message)
      });
    }
  }

  getStatusBadgeClass(status: string): string {
    return this.taskService.getStatusBadgeClass(status);
  }

  getTaskTypeIcon(type: string): string {
    return this.taskService.getTaskTypeIcon(type);
  }

  formatDate(dateString?: string): string {
    return this.taskService.formatDate(dateString);
  }
}
