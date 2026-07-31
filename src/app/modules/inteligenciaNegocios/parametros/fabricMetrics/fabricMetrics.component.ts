import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { TabViewModule } from 'primeng/tabview';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { Subscription, interval } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import {
  FabricMetricsService,
  ServiceMetrics,
  TopView,
  TopUser,
  SlowQuery,
  ErrorLog,
  ErrorLogSummary,
  ErrorByView
} from '../../services/fabric-metrics.service';

@Component({
  selector: 'app-fabric-metrics',
  standalone: true,
  imports: [CommonModule, FormsModule, ChartModule, TableModule, TooltipModule, TagModule, SkeletonModule, TabViewModule, CalendarModule, DropdownModule, ButtonModule, ToastModule],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fabricMetrics.component.html',
  styleUrl: './fabricMetrics.component.css'
})
export class FabricMetricsComponent implements OnInit, OnDestroy {
  // Signals para estado reactivo
  metrics = signal<ServiceMetrics | null>(null);
  topViews = signal<TopView[]>([]);
  topUsers = signal<TopUser[]>([]);
  slowQueries = signal<SlowQuery[]>([]);
  isLoading = signal(true);
  lastUpdate = signal('');
  connectionStatus = signal<'connected' | 'disconnected' | 'connecting'>('connecting');

  // Computed
  cacheHitPct = computed(() => this.metrics()?.queries?.cache_hit_rate ?? 0);
  totalQueries = computed(() => this.metrics()?.queries?.total_queries ?? 0);
  avgTime = computed(() => this.metrics()?.queries?.avg_elapsed_ms ?? 0);
  queriesPerMin = computed(() => this.metrics()?.queries?.queries_per_minute ?? 0);
  rowsServed = computed(() => this.metrics()?.queries?.total_rows_served ?? 0);
  errorCount = computed(() => this.metrics()?.queries?.total_errors ?? 0);
  uptimeHours = computed(() => this.metrics()?.queries?.uptime_hours ?? 0);

  // Chart data signals
  lineChartData = signal<unknown>({});
  cacheChartData = signal<unknown>({});
  topViewsChartData = signal<unknown>({});

  // Chart options
  readonly lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    plugins: {
      legend: { position: 'top', labels: { usePointStyle: true, padding: 15, font: { size: 11 } } },
      tooltip: { backgroundColor: 'rgba(15,23,42,0.9)', titleFont: { size: 12 }, bodyFont: { size: 11 }, padding: 10, cornerRadius: 8 }
    },
    scales: {
      x: { display: false },
      y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 } } }
    },
    elements: { point: { radius: 0, hoverRadius: 4 }, line: { tension: 0.4, borderWidth: 2 } },
    animation: { duration: 600, easing: 'easeOutQuart' }
  };

  readonly barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: 'rgba(15,23,42,0.9)', padding: 10, cornerRadius: 8 }
    },
    scales: {
      x: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 } } },
      y: { grid: { display: false }, ticks: { font: { size: 10, weight: '500' } } }
    },
    animation: { duration: 800, easing: 'easeOutQuart' }
  };

  readonly doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '75%',
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: 'rgba(15,23,42,0.9)', padding: 10, cornerRadius: 8 }
    },
    animation: { animateRotate: true, duration: 1000 }
  };

  // Historial para gráficos de línea
  private timeLabels: string[] = [];
  private queriesData: number[] = [];
  private cacheData: number[] = [];
  private elapsedData: number[] = [];
  private readonly MAX_POINTS = 60;
  private readonly POLL_MS = 300_000; // 5 minutos
  private pollSub?: Subscription;

  ngOnInit(): void {
    this.loadInitial();
    this.startPolling();
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
  }

  /** Botón de refresh manual */
  refresh(): void {
    this.connectionStatus.set('connecting');
    this.metricsService.getServiceMetrics().subscribe({
      next: data => this.processData(data),
      error: () => this.connectionStatus.set('disconnected')
    });
  }

  private loadInitial(): void {
    this.metricsService.getServiceMetrics().subscribe({
      next: data => this.processData(data),
      error: () => {
        this.isLoading.set(false);
        this.connectionStatus.set('disconnected');
      }
    });
  }

  private startPolling(): void {
    this.pollSub = interval(this.POLL_MS).pipe(
      switchMap(() => this.metricsService.getServiceMetrics())
    ).subscribe({
      next: data => this.processData(data),
      error: () => this.connectionStatus.set('disconnected')
    });
  }

  private processData(data: ServiceMetrics): void {
    this.metrics.set(data);
    this.topViews.set(data.top_views ?? []);
    this.topUsers.set(data.top_users ?? []);
    this.slowQueries.set(data.slow_queries ?? []);
    this.isLoading.set(false);
    this.connectionStatus.set('connected');
    this.lastUpdate.set(new Date().toLocaleTimeString('es-CO'));

    this.pushHistory(data);
    this.buildCharts(data);
  }

  private pushHistory(data: ServiceMetrics): void {
    const now = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this.timeLabels.push(now);
    this.queriesData.push(data.queries?.queries_per_minute ?? 0);
    this.cacheData.push(data.queries?.cache_hit_rate ?? 0);
    this.elapsedData.push(data.queries?.avg_elapsed_ms ?? 0);

    if (this.timeLabels.length > this.MAX_POINTS) {
      this.timeLabels.shift();
      this.queriesData.shift();
      this.cacheData.shift();
      this.elapsedData.shift();
    }
  }

  private buildCharts(data: ServiceMetrics): void {
    this.lineChartData.set({
      labels: [...this.timeLabels],
      datasets: [
        {
          label: 'Queries/min',
          data: [...this.queriesData],
          borderColor: '#10b981',
          backgroundColor: 'rgba(16,185,129,0.08)',
          fill: true,
        },
        {
          label: 'Tiempo prom. (ms ÷ 100)',
          data: this.elapsedData.map(v => +(v / 100).toFixed(1)),
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245,158,11,0.08)',
          fill: false,
        }
      ]
    });

    this.cacheChartData.set({
      labels: ['Cache Hit', 'Fabric'],
      datasets: [{
        data: [data.queries?.cache_hit_rate ?? 0, 100 - (data.queries?.cache_hit_rate ?? 0)],
        backgroundColor: ['#10b981', '#e2e8f0'],
        borderWidth: 0,
        hoverOffset: 4
      }]
    });

    const views = (data.top_views ?? []).slice(0, 8);
    this.topViewsChartData.set({
      labels: views.map(v => (v.view.split('.').pop() ?? v.view).replace('VW_', '')),
      datasets: [{
        label: 'Consultas',
        data: views.map(v => v.count),
        backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'],
        borderRadius: 4,
        barThickness: 18,
      }]
    });
  }

  // Helpers para template
  formatMs(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
  }

  formatNumber(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n?.toLocaleString('es-CO') ?? '0';
  }

  getElapsedSeverity(ms: number): 'success' | 'warn' | 'danger' {
    if (ms > 30000) return 'danger';
    if (ms > 5000) return 'warn';
    return 'success';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB: LOGS DE ERRORES
  // ═══════════════════════════════════════════════════════════════════════════

  errorLogs = signal<ErrorLog[]>([]);
  errorSummary = signal<ErrorLogSummary | null>(null);
  errorsByView = signal<ErrorByView[]>([]);
  isLoadingLogs = signal(false);

  // Filtros
  logFilterType = '';
  logFilterSchema = '';
  logFilterView = '';
  logDateRange: Date[] = [];
  logShowUnresolved = false;

  readonly errorTypeOptions = [
    { label: 'Todos', value: '' },
    { label: 'Timeout', value: 'timeout' },
    { label: 'Fabric Error', value: 'fabric_error' },
    { label: 'Permiso', value: 'permission' },
  ];

  loadErrorLogs(): void {
    this.isLoadingLogs.set(true);

    const params: Record<string, unknown> = { limit: 100 };
    if (this.logFilterType) params['error_type'] = this.logFilterType;
    if (this.logFilterSchema) params['schema'] = this.logFilterSchema;
    if (this.logFilterView) params['view'] = this.logFilterView;
    if (this.logShowUnresolved) params['unresolved'] = true;
    if (this.logDateRange?.length === 2 && this.logDateRange[0] && this.logDateRange[1]) {
      params['from'] = this.logDateRange[0].toISOString().slice(0, 10);
      params['to'] = this.logDateRange[1].toISOString().slice(0, 10) + ' 23:59:59';
    }

    this.metricsService.getErrorLogs(params as any).subscribe({
      next: res => {
        this.errorLogs.set(res.data ?? []);
        this.errorSummary.set(res.summary ?? null);
        this.isLoadingLogs.set(false);
      },
      error: () => this.isLoadingLogs.set(false)
    });

    this.metricsService.getErrorsByView(7).subscribe({
      next: views => this.errorsByView.set(views)
    });
  }

  resolveError(log: ErrorLog): void {
    this.metricsService.resolveError(log.id).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Resuelto', detail: `Error #${log.id} marcado como resuelto`, life: 3000 });
        this.loadErrorLogs();
      },
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo resolver', life: 4000 })
    });
  }

  resolveView(schema: string, view: string): void {
    this.metricsService.resolveView(schema, view).subscribe({
      next: res => {
        this.messageService.add({ severity: 'success', summary: 'Vista reactivada', detail: res.message, life: 4000 });
        this.loadErrorLogs();
      },
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo reactivar', life: 4000 })
    });
  }

  onTabChange(event: { index: number }): void {
    if (event.index === 1 && this.errorLogs().length === 0) {
      this.loadErrorLogs();
    }
  }

  constructor(private metricsService: FabricMetricsService, private messageService: MessageService) {}
}
