import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TaskSchedulerService } from '../services/task-scheduler.service';
import { CreateTaskRequest, TaskTypeConfig, RecurrenceType, RecurrenceValue } from '../models/scheduled-task.model';

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

          <!-- ========== NUEVO: Checkbox Tarea Recurrente ========== -->
          <div class="form-group recurring-toggle">
            <div class="toggle-container">
              <label class="toggle-label">
                <input 
                  type="checkbox" 
                  class="toggle-input"
                  [(ngModel)]="task.is_recurring"
                  name="is_recurring"
                  (change)="onRecurringChange()"
                  id="isRecurring"
                />
                <span class="toggle-switch"></span>
                <span class="toggle-text">
                  <strong>¿Es tarea recurrente?</strong>
                  <small>{{ task.is_recurring ? 'Activado - Se ejecutará automáticamente' : 'Desactivado - Ejecución única' }}</small>
                </span>
              </label>
            </div>
            <div class="form-help">
              <i class="bi bi-info-circle me-2"></i>
              Las tareas recurrentes se ejecutan automáticamente según la frecuencia configurada
            </div>
          </div>

          <!-- SI NO ES RECURRENTE: Fecha y Hora -->
          <div class="form-group" *ngIf="!task.is_recurring">
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

          <!-- SI ES RECURRENTE: Tipo de Recurrencia -->
          <div class="form-group" *ngIf="task.is_recurring">
            <label class="form-label required">Tipo de Recurrencia</label>
            <select 
              class="form-select" 
              [(ngModel)]="task.recurrence_type"
              name="recurrence_type"
              required
              (change)="onRecurrenceTypeChange()">
              <option [value]="undefined">Seleccione frecuencia...</option>
              <option *ngFor="let type of recurrenceTypes" [value]="type.key">
                {{ type.name }}
              </option>
            </select>
            <div class="form-help" *ngIf="task.recurrence_type && recurrenceTypes.length > 0">
              <i class="bi bi-info-circle me-2"></i>
              {{ getRecurrenceDescription(task.recurrence_type) }}
            </div>
          </div>

          <!-- Si es DAILY -->
          <div class="form-group" *ngIf="task.is_recurring && task.recurrence_type === 'daily'">
            <label class="form-label required">Hora de Ejecución</label>
            <input 
              type="time" 
              class="form-control" 
              [(ngModel)]="recurrenceValue.time"
              name="recurrence_time"
              required
            />
            <div class="form-help">
              <i class="bi bi-info-circle me-2"></i>
              La tarea se ejecutará todos los días a esta hora
            </div>
          </div>

          <!-- Si es WEEKLY -->
          <div *ngIf="task.is_recurring && task.recurrence_type === 'weekly'">
            <div class="form-group">
              <label class="form-label required">Día de la Semana</label>
              <select 
                class="form-select" 
                [(ngModel)]="recurrenceValue.day_of_week"
                name="recurrence_day_of_week"
                required>
                <option [value]="0">Domingo</option>
                <option [value]="1">Lunes</option>
                <option [value]="2">Martes</option>
                <option [value]="3">Miércoles</option>
                <option [value]="4">Jueves</option>
                <option [value]="5">Viernes</option>
                <option [value]="6">Sábado</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label required">Hora de Ejecución</label>
              <input 
                type="time" 
                class="form-control" 
                [(ngModel)]="recurrenceValue.time"
                name="recurrence_time_weekly"
                required
              />
            </div>
          </div>

          <!-- Si es MONTHLY -->
          <div *ngIf="task.is_recurring && task.recurrence_type === 'monthly'">
            <div class="form-group">
              <label class="form-label required">Día del Mes</label>
              <select 
                class="form-select" 
                [(ngModel)]="recurrenceValue.day"
                name="recurrence_day"
                required>
                <option [value]="1">Día 1 (Inicio de mes)</option>
                <option [value]="15">Día 15 (Mitad de mes)</option>
                <option value="last">Último día del mes</option>
                <option *ngFor="let day of [2,3,4,5,6,7,8,9,10,11,12,13,14,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31]" [value]="day">
                  Día {{day}}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label required">Hora de Ejecución</label>
              <input 
                type="time" 
                class="form-control" 
                [(ngModel)]="recurrenceValue.time"
                name="recurrence_time_monthly"
                required
              />
            </div>
          </div>

          <!-- Si es CUSTOM_DAYS -->
          <div *ngIf="task.is_recurring && task.recurrence_type === 'custom_days'">
            <div class="form-group">
              <label class="form-label required">Días de la Semana</label>
              <div class="days-selector">
                <label class="day-checkbox">
                  <input type="checkbox" [checked]="selectedDays.has(1)" (change)="toggleDay(1)">
                  <span>Lunes</span>
                </label>
                <label class="day-checkbox">
                  <input type="checkbox" [checked]="selectedDays.has(2)" (change)="toggleDay(2)">
                  <span>Martes</span>
                </label>
                <label class="day-checkbox">
                  <input type="checkbox" [checked]="selectedDays.has(3)" (change)="toggleDay(3)">
                  <span>Miércoles</span>
                </label>
                <label class="day-checkbox">
                  <input type="checkbox" [checked]="selectedDays.has(4)" (change)="toggleDay(4)">
                  <span>Jueves</span>
                </label>
                <label class="day-checkbox">
                  <input type="checkbox" [checked]="selectedDays.has(5)" (change)="toggleDay(5)">
                  <span>Viernes</span>
                </label>
                <label class="day-checkbox">
                  <input type="checkbox" [checked]="selectedDays.has(6)" (change)="toggleDay(6)">
                  <span>Sábado</span>
                </label>
                <label class="day-checkbox">
                  <input type="checkbox" [checked]="selectedDays.has(0)" (change)="toggleDay(0)">
                  <span>Domingo</span>
                </label>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label required">Hora de Ejecución</label>
              <input 
                type="time" 
                class="form-control" 
                [(ngModel)]="recurrenceValue.time"
                name="recurrence_time_custom"
                required
              />
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
                <label>ID Empresa</label>
                <input 
                  type="number" 
                  class="form-control" 
                  [(ngModel)]="parameters.empresa_id"
                  name="param_empresa_id_cierre"
                  placeholder="Opcional (dejar vacío para todas)"
                />
                <small class="form-help">Dejar vacío para ejecutar en todas las empresas</small>
              </div>
              <div class="param-group">
                <label>Periodo</label>
                <input 
                  type="month" 
                  class="form-control" 
                  [(ngModel)]="parameters.periodo"
                  name="param_periodo"
                  placeholder="Opcional"
                />
                <small class="form-help">Dejar vacío para usar el mes actual automáticamente</small>
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
    
    /* Toggle Switch Mejorado */
    .recurring-toggle{background:#f8fafc;padding:1.25rem;border-radius:10px;border:2px solid #e2e8f0}
    .toggle-container{margin-bottom:.5rem}
    .toggle-label{display:flex;align-items:center;cursor:pointer;gap:1rem}
    .toggle-input{display:none}
    .toggle-switch{
      position:relative;
      width:52px;
      height:28px;
      background:#cbd5e1;
      border-radius:14px;
      transition:all .3s ease;
      flex-shrink:0;
    }
    .toggle-switch::before{
      content:'';
      position:absolute;
      width:22px;
      height:22px;
      border-radius:50%;
      background:#fff;
      top:3px;
      left:3px;
      transition:all .3s ease;
      box-shadow:0 2px 4px rgba(0,0,0,.2);
    }
    .toggle-input:checked + .toggle-switch{background:#3b82f6}
    .toggle-input:checked + .toggle-switch::before{transform:translateX(24px)}
    .toggle-text{display:flex;flex-direction:column;gap:.25rem}
    .toggle-text strong{color:#1e293b;font-size:.95rem}
    .toggle-text small{color:#64748b;font-size:.75rem}
    
    .parameters-grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem;padding:1rem;background:#f8fafc;border-radius:8px}
    .param-group{display:flex;flex-direction:column}
    .param-group label{font-size:.75rem;font-weight:500;color:#475569;margin-bottom:.5rem}
    .form-check{padding-left:0}
    .form-check-input{margin-right:.5rem;cursor:pointer}
    .form-switch .form-check-input{width:2.5rem;height:1.25rem;cursor:pointer}
    .form-check-label{cursor:pointer}
    
    .days-selector{display:flex;flex-wrap:wrap;gap:.75rem;padding:1rem;background:#f8fafc;border-radius:8px}
    .day-checkbox{display:flex;align-items:center;padding:.5rem 1rem;background:#fff;border:2px solid #e2e8f0;border-radius:8px;cursor:pointer;transition:all .2s}
    .day-checkbox:hover{border-color:#3b82f6;background:#eff6ff}
    .day-checkbox input[type="checkbox"]{margin-right:.5rem;cursor:pointer}
    .day-checkbox input[type="checkbox"]:checked + span{font-weight:600;color:#3b82f6}
    .day-checkbox span{font-size:.875rem;color:#475569}
    
    .form-actions{display:flex;gap:1rem;justify-content:flex-end;margin-top:2rem;padding-top:1.5rem;border-top:1px solid #f1f5f9}
    .btn{padding:.625rem 1.25rem;border-radius:8px;font-weight:500;transition:all .2s;border:none;cursor:pointer}
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
    parameters: {},
    is_recurring: false
  };
  
  taskTypes: TaskTypeConfig[] = [];
  selectedType: TaskTypeConfig | null = null;
  scheduledDateTime: string = '';
  parameters: any = {};
  recipientsString: string = '';
  submitting = false;
  error: string | null = null;

  // Propiedades para recurrencia
  recurrenceTypes: any[] = [];
  recurrenceValue: RecurrenceValue = {
    time: '00:00',
    day_of_week: 1,
    day: 1,
    days: []
  };
  selectedDays: Set<number> = new Set();

  constructor(
    private taskService: TaskSchedulerService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadTaskTypes();
    this.loadRecurrenceTypes();
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

  loadRecurrenceTypes(): void {
    this.taskService.getRecurrenceTypes().subscribe({
      next: (response) => {
        this.recurrenceTypes = response.data;
      },
      error: (err) => {
        console.error('Error loading recurrence types:', err);
      }
    });
  }

  onTypeChange(): void {
    this.selectedType = this.taskTypes.find(t => t.key === this.task.type) || null;
    this.parameters = {};
    this.recipientsString = '';
  }

  onRecurringChange(): void {
    if (!this.task.is_recurring) {
      this.task.recurrence_type = undefined;
      this.recurrenceValue = {
        time: '00:00',
        day_of_week: 1,
        day: 1,
        days: []
      };
      this.selectedDays.clear();
    } else {
      this.scheduledDateTime = '';
    }
  }

  onRecurrenceTypeChange(): void {
    this.recurrenceValue = {
      time: '00:00',
      day_of_week: 1,
      day: 1,
      days: []
    };
    this.selectedDays.clear();
  }

  toggleDay(day: number): void {
    if (this.selectedDays.has(day)) {
      this.selectedDays.delete(day);
    } else {
      this.selectedDays.add(day);
    }
    this.recurrenceValue.days = Array.from(this.selectedDays);
  }

  buildRecurrenceValue(): RecurrenceValue | undefined {
    if (!this.task.recurrence_type) return undefined;

    const type = this.task.recurrence_type;
    const value: RecurrenceValue = {};

    if (type === 'daily') {
      value.time = this.recurrenceValue.time;
    } else if (type === 'weekly') {
      value.day_of_week = this.recurrenceValue.day_of_week;
      value.time = this.recurrenceValue.time;
    } else if (type === 'monthly') {
      value.day = this.recurrenceValue.day;
      value.time = this.recurrenceValue.time;
    } else if (type === 'custom_days') {
      value.days = Array.from(this.selectedDays);
      value.time = this.recurrenceValue.time;
    }

    return Object.keys(value).length > 0 ? value : undefined;
  }

  getRecurrenceDescription(recurrenceType: string): string {
    const type = this.recurrenceTypes.find(t => t.key === recurrenceType);
    return type ? type.description : '';
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
      parameters: Object.keys(this.parameters).length > 0 ? this.parameters : undefined
    };

    // Si es recurrente
    if (this.task.is_recurring) {
      taskData.recurrence_type = this.task.recurrence_type;
      taskData.recurrence_value = this.buildRecurrenceValue();
    } else {
      // Si no es recurrente, agregar scheduled_at
      taskData.scheduled_at = this.scheduledDateTime || undefined;
    }

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
