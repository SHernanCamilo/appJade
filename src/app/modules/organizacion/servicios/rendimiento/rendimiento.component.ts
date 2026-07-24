import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ProgressBarModule } from 'primeng/progressbar';
import { TooltipModule } from 'primeng/tooltip';
import { Subscription, interval } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

interface QueueStatus {
  name: string;
  pending: number;
  status: 'idle' | 'busy' | 'saturated';
}

interface PerformanceData {
  horizon: {
    status: string;
    supervisors: number;
    queue_sizes: Record<string, number>;
    total_pending: number;
  };
  redis: {
    connected_clients: number;
    used_memory_human: string;
    total_commands: number;
    keys: number;
    uptime_days: number;
  };
  queues: QueueStatus[];
  jobs: {
    completed_count: number;
    failed_count: number;
    recent: { id: string; name: string; status: string; at: string }[];
  };
  system: {
    load_avg_1m: number;
    load_avg_5m: number;
    load_avg_15m: number;
    memory_total_gb: number;
    memory_free_gb: number;
    memory_used_pct: number;
    php_memory_limit: string;
    php_version: string;
    laravel_version: string;
  };
}

interface FailedJob {
  id: number;
  uuid: string;
  queue: string;
  job_class: string;
  error: string;
  failed_at: string;
}

@Component({
  selector: 'app-rendimiento',
  standalone: true,
  imports: [CommonModule, ChartModule, TableModule, TagModule, ProgressBarModule, TooltipModule],
  templateUrl: './rendimiento.component.html',
  styleUrl: './rendimiento.component.css'
})
export class RendimientoComponent implements OnInit, OnDestroy {
  data: PerformanceData | null = null;
  failedJobs: FailedJob[] = [];
  isLoading = true;
  lastUpdate = '';

  // Gráficos
  queueChartData: unknown = {};
  queueChartOptions: unknown = {};
  memoryChartData: unknown = {};
  loadChartData: unknown = {};
  loadHistory: number[] = [];
  loadLabels: string[] = [];

  private pollSub?: Subscription;
  private readonly baseUrl = `${environment.URL_SERVICIOS}/system/performance`;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.setupCharts();
    this.loadData();
    this.loadFailedJobs();
    this.startPolling();
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
  }

  private loadData(): void {
    this.http.get<PerformanceData>(this.baseUrl).subscribe({
      next: d => {
        this.data = d;
        this.isLoading = false;
        this.lastUpdate = new Date().toLocaleTimeString();
        this.updateCharts(d);
      },
      error: () => { this.isLoading = false; }
    });
  }

  private loadFailedJobs(): void {
    this.http.get<{ total: number; recent: FailedJob[] }>(`${this.baseUrl}/failed-jobs`).subscribe({
      next: r => { this.failedJobs = r.recent ?? []; }
    });
  }

  private startPolling(): void {
    this.pollSub = interval(10000).pipe(
      switchMap(() => this.http.get<PerformanceData>(this.baseUrl))
    ).subscribe({
      next: d => {
        this.data = d;
        this.lastUpdate = new Date().toLocaleTimeString();
        this.updateCharts(d);
      }
    });
  }

  private updateCharts(d: PerformanceData): void {
    // Queue sizes bar chart
    const queues = d.queues ?? [];
    this.queueChartData = {
      labels: queues.map(q => q.name),
      datasets: [{
        label: 'Jobs pendientes',
        data: queues.map(q => q.pending),
        backgroundColor: queues.map(q =>
          q.status === 'saturated' ? '#ef4444' : q.status === 'busy' ? '#f59e0b' : '#10b981'
        )
      }]
    };

    // Memory gauge
    this.memoryChartData = {
      labels: ['Usada', 'Libre'],
      datasets: [{
        data: [d.system.memory_used_pct, 100 - d.system.memory_used_pct],
        backgroundColor: [d.system.memory_used_pct > 80 ? '#ef4444' : '#3b82f6', '#e2e8f0']
      }]
    };

    // Load average history
    const now = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this.loadHistory.push(d.system.load_avg_1m);
    this.loadLabels.push(now);
    if (this.loadHistory.length > 30) {
      this.loadHistory.shift();
      this.loadLabels.shift();
    }
    this.loadChartData = {
      labels: [...this.loadLabels],
      datasets: [{
        label: 'Load Avg (1m)',
        data: [...this.loadHistory],
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139,92,246,0.1)',
        fill: true,
        tension: 0.4
      }]
    };
  }

  private setupCharts(): void {
    this.queueChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    };
  }

  getQueueSeverity(status: string): 'success' | 'warn' | 'danger' {
    if (status === 'saturated') return 'danger';
    if (status === 'busy') return 'warn';
    return 'success';
  }

  getHorizonSeverity(): 'success' | 'warn' | 'danger' {
    if (!this.data) return 'warn';
    if (this.data.horizon.status === 'running') return 'success';
    return 'danger';
  }
}
