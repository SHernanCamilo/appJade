import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TaskSchedulerService } from '../services/task-scheduler.service';
import { CreateTaskRequest, TaskTypeConfig } from '../models/scheduled-task.model';

@Component({
  selector: 'app-task-create',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="page-container">
      <!-- Header -->
      <div class="page-header">
        <button class="btn btn-back" routerLink="../list">
          <i class="bi bi-arrow-left me-2"></i>Volver a la Lista
        </button>
        <h1 class="page-title">
          <i class="bi bi-plus-circle me-2"></i>Nueva Tarea Programada
        </h1>
      </div>

      <!-- Form -->
      <div class="content-card">
        <form (ngSubmit)="onSubmit()" #taskForm="ngForm">
          <!-- Nombre -->
          <div class="form-group">
            <label class="form-label required">Nombre de la Tarea</label>
            <input 
              type="text" 
              class="form-control" 
              [(ngModel)]="task.name"
              name="name"
              required
              placeholder="Ej: Sincronización Diaria de Activos"
            />
          </div>

          <!-- Tipo -->
          <div class="form-group">
            <label class="form-label required">Tipo de Tarea</label>
            <select 
              class="form-select" 
              [(ngModel)]="task.type"
              name="type"
              required
              (change)="onTypeChange()">
              <option [value]="undefined">Seleccione un tipo...</option>
              <option *ngFor="let type of taskTypes" [value]="type.key">
                {{ type.name }}
              </option>
            </select>
            <div class="form-help" *ngIf="selectedType">
              <i class="bi bi-info-circle me-2"></i>
              {{ selectedType.description }}
            </div>
          </div>

          <!-- Descripción -->
          <div class="form-group">
            <label class="form-label">Descripción</label>
            <textarea 
              class="form-control" 
              [(ngModel)]="task.description"
              name="description"
              rows="3"
              placeholder="Descripción opcional de la tarea...">
            </textarea>
          </div>

          <!-- Fecha de Programación -->
          <div class="form-group">
            <label class="form-label">Fecha y Hora de Ejecución</label>
            <input 
              type="datetime-local" 
              class="form-control" 
              [(ngModel)]="scheduledDateTime"
              name="scheduled_at"
            />
            <div class="form-help">
              <i class="bi bi-info-circle me-2"></i>
              Dejar vacío para ejecutar inmediatamente
            </div>
          </div>

          <!-- Parámetros según tipo -->
          <div class="form-group" *ngIf="task.type">
            <label class="form-label">Parámetros</label>
            
            <!-- Parámetros para sync_activos -->
            <div *ngIf="task.type === 'sync_activos'" class="parameters-grid">
              <div class="param-group">
                <label>ID Empresa</label>
                <input 
                  type="number" 
                  class="form-control" 
                  [(ngModel)]="parameters.empresa_id"
                  name="param_empresa_id"
                  placeholder="Opcional"
                />
              </div>
              <div class="param-group">
                <label>Sincronización Completa</label>
                <div class="form-check form-switch">
                  <input 
                    class="form-check-input" 
                    type="checkbox" 
                    [(ngModel)]="parameters.force_full_sync"
                    name="param_force_full_sync"
                  />
                  <label class="form-check-label">Forzar sincronización completa</label>
                </div>
              </div>
            </div>

            <!-- Parámetros para cierre_automatico -->
            <div *ngIf="task.type === 'cierre_automatico'" class="parameters-grid">
              <div class="param-group">
                <label class="required">ID Empresa</label>
                <input 
                  type="number" 
                  class="form-control" 
                  [(ngModel)]="parameters.empresa_id"
                  name="param_empresa_id_cierre"
                  required
                />
              </div>
              <div class="param-group">
                <label class="required">Periodo</label>
                <input 
                  type="month" 
                  class="form-control" 
                  [(ngModel)]="parameters.periodo"
                  name="param_periodo"
                  required
                />
              </div>
            </div>

            <!-- Parámetros para mantenimiento_db -->
            <div *ngIf="task.type === 'mantenimiento_db'" class="parameters-grid">
              <div class="param-group">
                <div class="form-check">
                  <input 
                    class="form-check-input" 
                    type="checkbox" 
                    [(ngModel)]="parameters.clean_logs"
                    name="param_clean_logs"
                  />
                  <label class="form-check-label">Limpiar logs antiguos</label>
                </div>
              </div>
              <div class="param-group">
                <div class="form-check">
                  <input 
                    class="form-check-input" 
                    type="checkbox" 
                    [(ngModel)]="parameters.optimize_tables"
                    name="param_optimize_tables"
                  />
                  <label class="form-check-label">Optimizar tablas</label>
                </div>
              </div>
            </div>

            <!-- Parámetros para envio_reportes -->
            <div *ngIf="task.type === 'envio_reportes'" class="parameters-grid">
              <div class="param-group">
                <label class="required">Tipo de Reporte</label>
                <input 
                  type="text" 
                  class="form-control" 
                  [(ngModel)]="parameters.report_type"
                  name="param_report_type"
                  required
                />
              </div>
              <div class="param-group">
                <label class="required">Destinatarios (emails separados por coma)</label>
                <input 
                  type="text" 
                  class="form-control" 
                  [(ngModel)]="recipientsString"
                  name="param_recipients"
                  placeholder="email1@example.com, email2@example.com"
                  required
                />
              </div>
            </div>
          </div>

          <!-- Máximo de Intentos -->
          <div class="form-group">
            <label class="form-label">Máximo de Intentos</label>
            <input 
              type="number" 
              class="form-control" 
              [(ngModel)]="task.max_attempts"
              name="max_attempts"
              min="1"
              max="10"
              placeholder="3"
            />
            <div class="form-help">
              <i class="bi bi-info-circle me-2"></i>
              Número de veces que se reintentará la tarea en caso de fallo
            </div>
          </div>

          <!-- Actions -->
          <div class="form-actions">
            <button type="button" class="btn btn-outline-secondary" routerLink="../list">
              <i class="bi bi-x-circle me-2"></i>Cancelar
            </button>
            <button type="submit" class="btn btn-primary" [disabled]="!taskForm.valid || submitting">
              <i class="bi bi-check-circle me-2"></i>
              {{ submitting ? 'Creando...' : 'Crear Tarea' }}
            </button>
          </div>
        </form>
      </div>

      <!-- Error Alert -->
      <div class="alert alert-danger" *ngIf="error">
        <i class="bi bi-exclamation-triangle me-2"></i>
        {{ error }}
      </div>
    </div>
  `,
  styles: [`
    .page-container{padding:2rem;max-width:900px;margin:0 auto}
    .page-header{margin-bottom:2rem}
    .btn-back{background:#f1f5f9;border:none;padding:.5rem 1rem;border-radius:8px;color:#475569;margin-bottom:1rem}
    .page-title{font-size:1.75rem;font-weight:700;color:#1e293b}
    
    .content-card{background:#fff;border-radius:12px;padding:2rem;box-shadow:0 2px 8px rgba(0,0,0,.08)}
    .form-group{margin-bottom:1.5rem}
    .form-label{display:block;font-weight:500;color:#475569;margin-bottom:.5rem;font-size:.875rem}
    .form-label.required::after{content:" *";color:#ef4444}
    .form-control,.form-select{width:100%;padding:.625rem .875rem;border:1px solid #e2e8f0;border-radius:8px;font-size:.875rem}
    .form-control:focus,.form-select:focus{outline:none;border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.1)}
    .form-help{font-size:.75rem;color:#64748b;margin-top:.5rem}
    
    .parameters-grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem;padding:1rem;background:#f8fafc;border-radius:8px}
    .param-group{display:flex;flex-direction:column}
    .param-group label{font-size:.75rem;font-weight:500;color:#475569;margin-bottom:.5rem}
    .form-check{padding-left:0}
    .form-check-input{margin-right:.5rem}
    .form-switch .form-check-input{width:2.5rem;height:1.25rem}
    
    .form-actions{display:flex;gap:1rem;justify-content:flex-end;margin-top:2rem;padding-top:1.5rem;border-top:1px solid #f1f5f9}
    .btn{padding:.625rem 1.25rem;border-radius:8px;font-weight:500;transition:all .2s;border:none}
    .btn-primary{background:#3b82f6;color:#fff}
    .btn-primary:hover:not(:disabled){background:#2563eb}
    .btn-primary:disabled{opacity:.5;cursor:not-allowed}
    .btn-outline-secondary{background:#fff;border:1px solid #e2e8f0;color:#475569}
    
    .alert{padding:1rem;border-radius:8px;margin-top:1rem}
  `]
})
export class TaskCreateComponent implements OnInit {
  task: CreateTaskRequest = {
    name: '',
    type: undefined as any,
    description: '',
    parameters: {}
  };
  
  taskTypes: TaskTypeConfig[] = [];
  selectedType: TaskTypeConfig | null = null;
  scheduledDateTime: string = '';
  parameters: any = {};
  recipientsString: string = '';
  submitting = false;
  error: string | null = null;

  constructor(
    private taskService: TaskSchedulerService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadTaskTypes();
  }

  loadTaskTypes(): void {
    this.taskService.getTaskTypes().subscribe({
      next: (response) => {
        this.taskTypes = response.data;
      },
      error: (err) => {
        console.error('Error loading task types:', err);
      }
    });
  }

  onTypeChange(): void {
    this.selectedType = this.taskTypes.find(t => t.key === this.task.type) || null;
    this.parameters = {};
    this.recipientsString = '';
  }

  onSubmit(): void {
    this.error = null;
    this.submitting = true;

    // Preparar parámetros según el tipo
    if (this.task.type === 'envio_reportes' && this.recipientsString) {
      this.parameters.recipients = this.recipientsString.split(',').map(e => e.trim());
    }

    // Preparar la tarea
    const taskData: CreateTaskRequest = {
      ...this.task,
      scheduled_at: this.scheduledDateTime || undefined,
      parameters: Object.keys(this.parameters).length > 0 ? this.parameters : undefined
    };

    this.taskService.createTask(taskData).subscribe({
      next: (response) => {
        alert('Tarea creada exitosamente');
        this.router.navigate(['/organizacion/servicios/task-scheduler/list']);
      },
      error: (err) => {
        this.error = err.error?.message || 'Error al crear la tarea';
        this.submitting = false;
      }
    });
  }
}
