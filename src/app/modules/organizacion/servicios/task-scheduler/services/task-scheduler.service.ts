import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import {
  ScheduledTask,
  TaskTypeConfig,
  TaskStats,
  CreateTaskRequest,
  UpdateTaskRequest,
  TaskListParams,
  TaskListResponse
} from '../models/scheduled-task.model';

@Injectable({
  providedIn: 'root'
})
export class TaskSchedulerService {
  private readonly apiUrl = `${environment.URL_SERVICIOS}/v1/scheduled-tasks`;

  constructor(private http: HttpClient) {}

  /**
   * Obtener lista de tareas con filtros y paginación
   */
  getTasks(params?: TaskListParams): Observable<TaskListResponse> {
    let httpParams = new HttpParams();

    if (params) {
      Object.keys(params).forEach(key => {
        const value = params[key as keyof TaskListParams];
        if (value !== undefined && value !== null) {
          httpParams = httpParams.set(key, value.toString());
        }
      });
    }

    return this.http.get<TaskListResponse>(this.apiUrl, { params: httpParams });
  }

  /**
   * Obtener una tarea específica por ID
   */
  getTask(id: number): Observable<{ data: ScheduledTask }> {
    return this.http.get<{ data: ScheduledTask }>(`${this.apiUrl}/${id}`);
  }

  /**
   * Crear una nueva tarea programada
   */
  createTask(task: CreateTaskRequest): Observable<{ message: string; data: ScheduledTask }> {
    return this.http.post<{ message: string; data: ScheduledTask }>(this.apiUrl, task);
  }

  /**
   * Actualizar una tarea existente
   */
  updateTask(id: number, task: UpdateTaskRequest): Observable<{ message: string; data: ScheduledTask }> {
    return this.http.put<{ message: string; data: ScheduledTask }>(`${this.apiUrl}/${id}`, task);
  }

  /**
   * Eliminar una tarea
   */
  deleteTask(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }

  /**
   * Ejecutar una tarea inmediatamente
   */
  executeTask(id: number): Observable<{ message: string; data: ScheduledTask }> {
    return this.http.post<{ message: string; data: ScheduledTask }>(`${this.apiUrl}/${id}/execute`, {});
  }

  /**
   * Cancelar una tarea pendiente
   */
  cancelTask(id: number): Observable<{ message: string; data: ScheduledTask }> {
    return this.http.post<{ message: string; data: ScheduledTask }>(`${this.apiUrl}/${id}/cancel`, {});
  }

  /**
   * Reintentar una tarea fallida
   */
  retryTask(id: number): Observable<{ message: string; data: ScheduledTask }> {
    return this.http.post<{ message: string; data: ScheduledTask }>(`${this.apiUrl}/${id}/retry`, {});
  }

  /**
   * Obtener estadísticas del dashboard
   */
  getDashboardStats(): Observable<{ data: TaskStats }> {
    return this.http.get<{ data: TaskStats }>(`${this.apiUrl}/stats/dashboard`);
  }

  /**
   * Obtener tipos de tareas disponibles
   */
  getTaskTypes(): Observable<{ data: TaskTypeConfig[] }> {
    return this.http.get<{ data: TaskTypeConfig[] }>(`${this.apiUrl}/types`);
  }

  /**
   * Obtener tipos de recurrencia disponibles
   */
  getRecurrenceTypes(): Observable<{ data: any[] }> {
    return this.http.get<{ data: any[] }>(`${this.apiUrl}/recurrence-types`);
  }

  /**
   * Activar/Desactivar tarea recurrente
   */
  toggleTask(id: number): Observable<{ message: string; data: ScheduledTask }> {
    return this.http.post<{ message: string; data: ScheduledTask }>(`${this.apiUrl}/${id}/toggle`, {});
  }

  /**
   * Obtener color del badge según el estado
   */
  getStatusBadgeClass(status: string): string {
    const statusClasses: Record<string, string> = {
      'pending': 'badge-warning',
      'running': 'badge-info',
      'completed': 'badge-success',
      'failed': 'badge-danger',
      'cancelled': 'badge-secondary'
    };
    return statusClasses[status] || 'badge-secondary';
  }

  /**
   * Obtener icono según el tipo de tarea
   */
  getTaskTypeIcon(type: string): string {
    const typeIcons: Record<string, string> = {
      'sync_activos': 'bi-arrow-repeat',
      'cierre_automatico': 'bi-calendar-check',
      'mantenimiento_db': 'bi-database-gear',
      'envio_reportes': 'bi-file-earmark-text'
    };
    return typeIcons[type] || 'bi-gear';
  }

  /**
   * Formatear fecha para display
   */
  formatDate(dateString?: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /** Hora en que empezó la última ejecución. */
  comenzo(task: ScheduledTask): string {
    return this.formatDate(task.started_at);
  }

  /**
   * Recurrente: próxima ejecución. Una sola vez: hora programada.
   */
  programada(task: ScheduledTask): string {
    if (task.is_recurring) {
      return this.formatDate(task.next_run_at);
    }
    return this.formatDate(task.scheduled_at);
  }

  programadaDetalle(task: ScheduledTask): string {
    if (!task.is_recurring) {
      return '';
    }
    return task.recurrence_type_label || 'Próxima';
  }

  /**
   * Recurrente: duración de la última corrida. Una sola vez: lo que demoró.
   * En curso todavía no hay duración cerrada.
   */
  duracion(task: ScheduledTask): string {
    if (task.status === 'running' || task.run_state === 'running') {
      return 'en curso';
    }
    return task.duration_formatted || '-';
  }

  estadoFila(task: ScheduledTask): string {
    if (task.run_state === 'queued') {
      return task.next_run_at ? `En cola hasta ${this.formatDate(task.next_run_at)}` : 'En cola';
    }
    if (task.run_state === 'running') {
      return 'En curso';
    }
    if (task.run_state === 'paused') {
      return 'Pausada';
    }
    if (task.run_state === 'failed') {
      return 'Fallida';
    }
    if (task.run_state === 'due') {
      return 'Vencida, no encolada';
    }
    if (task.run_state === 'unscheduled') {
      return 'Sin encolar';
    }
    if (task.run_state === 'cancelled') {
      return 'Cancelada';
    }
    if (task.run_state === 'pending') {
      return 'Pendiente';
    }
    return task.status_label || 'Lista';
  }

  estadoSeverity(task: ScheduledTask): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary'> = {
      queued: 'info',
      running: 'info',
      paused: 'secondary',
      failed: 'danger',
      due: 'warn',
      unscheduled: 'warn',
      cancelled: 'secondary',
      pending: 'warn',
      done: 'success',
    };
    return map[task.run_state || ''] || 'secondary';
  }
}
