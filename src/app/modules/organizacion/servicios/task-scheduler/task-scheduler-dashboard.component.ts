import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TaskSchedulerService } from './services/task-scheduler.service';
import { TaskStats, ScheduledTask, TaskListParams } from './models/scheduled-task.model';
import { interval, Subscription } from 'rxjs';
import { switchMap, startWith } from 'rxjs/operators';

// PrimeNG Imports
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { SkeletonModule } from 'primeng/skeleton';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { ChartModule } from 'primeng/chart';
import { ProgressBarModule } from 'primeng/progressbar';
import { TabViewModule } from 'primeng/tabview';

@Component({
  selector: 'app-task-scheduler-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    FormsModule,
    ButtonModule,
    ToastModule,
    CardModule,
    TableModule,
    TagModule,
    InputTextModule,
    DropdownModule,
    SkeletonModule,
    DialogModule,
    TooltipModule,
    ChartModule,
    ProgressBarModule,
    TabViewModule
  ],
  providers: [MessageService],
  templateUrl: './task-scheduler-dashboard.component.html',
  styleUrls: ['./task-scheduler-dashboard.component.css']
})
export class TaskSchedulerDashboardComponent implements OnInit, OnDestroy {
  stats: TaskStats | null = null;
  recentTasks: ScheduledTask[] = [];
  loading = false;
  isLoadingChart = false;
  isLoadingTasks = false;
  error: string | null = null;
  private refreshSubscription?: Subscription;

  // Datos para el gráfico de Chart.js
  chartData: any = {};
  chartOptions: any = {};

  constructor(
    private taskService: TaskSchedulerService,
    private messageService: MessageService
  ) {
    this.initChartOptions();
  }

  ngOnInit(): void {
    this.loadStats();
    this.loadRecentTasks();
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    this.refreshSubscription?.unsubscribe();
  }

  /**
   * Inicializar opciones del gráfico
   */
  private initChartOptions(): void {
    try {
      this.chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              usePointStyle: true,
              padding: 20,
              font: {
                size: 12
              }
            }
          },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const label = context.label || '';
                const value = context.parsed || 0;
                const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                return `${label}: ${value} tareas (${percentage}%)`;
              }
            }
          }
        },
        cutout: '60%',
        onClick: (event: any, activeElements: any[]) => {
          if (activeElements && activeElements.length > 0) {
            const index = activeElements[0].index;
            const typeArray = this.getTypeArray();
            if (typeArray[index]) {
              this.navigateToList(undefined, typeArray[index].type);
            }
          }
        }
      };
    } catch (error) {
      console.error('Error inicializando opciones del gráfico:', error);
      this.chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%'
      };
    }
  }

  /**
   * Actualizar datos del gráfico
   */
  private updateChartData(): void {
    if (!this.stats?.by_type) {
      this.chartData = {};
      return;
    }

    const typeArray = this.getTypeArray();
    
    this.chartData = {
      labels: typeArray.map(item => `${this.getTypeName(item.type)} (${item.count})`),
      datasets: [
        {
          data: typeArray.map(item => item.count),
          backgroundColor: typeArray.map((_, index) => this.getColorForType(index)),
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverBorderWidth: 3
        }
      ]
    };
  }

  /**
   * Obtener el color para cada tipo de tarea
   */
  getColorForType(index: number): string {
    const colors = [
      '#10B981', // Verde esmeralda
      '#3B82F6', // Azul
      '#F59E0B', // Amarillo/Naranja
      '#EF4444', // Rojo
      '#8B5CF6', // Púrpura
      '#06B6D4', // Cian
      '#F97316', // Naranja
      '#84CC16'  // Lima
    ];
    return colors[index % colors.length];
  }

  loadStats(): void {
    this.loading = true;
    this.isLoadingChart = true;
    this.error = null;

    this.taskService.getDashboardStats().subscribe({
      next: (response) => {
        this.stats = response.data;
        this.updateChartData();
        this.loading = false;
        this.isLoadingChart = false;
      },
      error: (err) => {
        this.error = 'Error al cargar las estadísticas';
        this.loading = false;
        this.isLoadingChart = false;
        console.error('Error loading stats:', err);
        this.showError('Error al cargar las estadísticas del dashboard');
      }
    });
  }

  loadRecentTasks(): void {
    this.isLoadingTasks = true;
    
    const params: TaskListParams = {
      per_page: 5,
      page: 1,
      sort_by: 'created_at',
      sort_order: 'desc'
    };

    this.taskService.getTasks(params).subscribe({
      next: (response) => {
        this.recentTasks = response.data;
        this.isLoadingTasks = false;
      },
      error: (err) => {
        console.error('Error loading recent tasks:', err);
        this.isLoadingTasks = false;
        this.recentTasks = [];
      }
    });
  }

  refreshStats(): void {
    this.loadStats();
    this.loadRecentTasks();
    this.showInfo('Estadísticas actualizadas');
  }

  startAutoRefresh(): void {
    // Actualizar cada 30 segundos
    this.refreshSubscription = interval(30000)
      .pipe(
        startWith(0),
        switchMap(() => this.taskService.getDashboardStats())
      )
      .subscribe({
        next: (response) => {
          this.stats = response.data;
          this.updateChartData();
        },
        error: (err) => {
          console.error('Error in auto-refresh:', err);
        }
      });
  }

  getTypeArray(): Array<{ type: string; count: number }> {
    if (!this.stats?.by_type) return [];
    return Object.entries(this.stats.by_type).map(([type, count]) => ({
      type,
      count
    }));
  }

  getTotalTasksByType(): number {
    return this.getTypeArray().reduce((sum, item) => sum + item.count, 0);
  }

  getTypeName(type: string): string {
    const typeNames: Record<string, string> = {
      'sync_activos': 'Sincronización de Activos',
      'cierre_automatico': 'Cierre Automático',
      'mantenimiento_db': 'Mantenimiento DB',
      'envio_reportes': 'Envío de Reportes'
    };
    return typeNames[type] || type;
  }

  getTaskTypeIcon(type: string): string {
    return this.taskService.getTaskTypeIcon(type);
  }

  getStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const severityMap: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary'> = {
      'pending': 'warn',
      'running': 'info',
      'completed': 'success',
      'failed': 'danger',
      'cancelled': 'secondary'
    };
    return severityMap[status] || 'secondary';
  }

  formatDate(dateString?: string): string {
    return this.taskService.formatDate(dateString);
  }

  navigateToList(status?: string, type?: string): void {
    const queryParams: any = {};
    if (status) queryParams.status = status;
    if (type) queryParams.type = type;
    
    // Navegar con parámetros de consulta
    window.location.href = `/organizacion/servicios/task-scheduler/list${Object.keys(queryParams).length ? '?' + new URLSearchParams(queryParams).toString() : ''}`;
  }

  navigateToTask(taskId: number): void {
    // Por ahora solo mostrar info, más adelante se puede implementar modal de detalles
    this.showInfo(`Funcionalidad de detalles de tarea #${taskId} en desarrollo`);
  }

  executeTask(task: ScheduledTask): void {
    if (confirm(`¿Ejecutar la tarea "${task.name}" inmediatamente?`)) {
      this.taskService.executeTask(task.id).subscribe({
        next: () => {
          this.showSuccess('Tarea ejecutada exitosamente');
          this.refreshStats();
        },
        error: (err) => {
          this.showError('Error al ejecutar la tarea: ' + (err.error?.message || 'Error desconocido'));
        }
      });
    }
  }

  retryTask(task: ScheduledTask): void {
    if (confirm(`¿Reintentar la tarea "${task.name}"?`)) {
      this.taskService.retryTask(task.id).subscribe({
        next: () => {
          this.showSuccess('Tarea reintentada exitosamente');
          this.refreshStats();
        },
        error: (err) => {
          this.showError('Error al reintentar: ' + (err.error?.message || 'Error desconocido'));
        }
      });
    }
  }

  // Métodos de mensajes
  private showSuccess(message: string): void {
    this.messageService.add({
      severity: 'success',
      summary: 'Éxito',
      detail: message,
      life: 3000
    });
  }

  private showError(message: string): void {
    this.messageService.add({
      severity: 'error',
      summary: 'Error',
      detail: message,
      life: 5000
    });
  }

  private showInfo(message: string): void {
    this.messageService.add({
      severity: 'info',
      summary: 'Información',
      detail: message,
      life: 3000
    });
  }
}
