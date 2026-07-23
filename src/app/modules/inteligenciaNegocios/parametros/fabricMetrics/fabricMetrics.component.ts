import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';
import { Subscription, interval } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import {
  FabricMetricsService,
  ServiceMetrics,
  TopView,
  TopUser,
  SlowQuery
} from '../../services/fabric-metrics.service';

@Component({
  selector: 'app-fabric-metrics',
  standalone: true,
  imports: [CommonModule, ChartModule, TableModule, TooltipModule, ProgressBarModule, TagModule],
  templateUrl: './fabricMetrics.component.html',
  styleUrl: './fabricMetrics.component.css'
})
export class FabricMetricsComponent implements OnInit, OnDestroy {
  // Datos en vivo
  metrics: ServiceMetrics | null = null;
  topViews: TopView[] = [];
  topUsers: TopUser[] = [];
  slowQueries: SlowQuery[] = [];
  isLoading = true;
  lastUpdate = '';

  // Datos para gráficos de línea (últimos 60 puntos = 5 min)
  timeLabels: string[] = [];
  queriesPerMinData: number[] = [];
  cacheHitData: number[] = [];
  avgElapsedData: number[] = [];

  // Chart.js config
  lineChartData: unknown = {};
  lineChartOptions: unknown = {};
  cacheChartData: unknown = {};
  topViewsChartData: unknown = {};
  topViewsChartOptions: unknown = {};

  private pollSub?: Subscription;
  private readonly MAX_POINTS = 60;
  private readonly POLL_INTERVAL_MS = 5000;

  constructor(private metricsService: FabricMetricsService) {}

  ngOnInit(): void {
    this.setupChartOptions();
    this.loadInitial();
    this.startPolling();
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
  }

  private loadInitial(): void {
    this.metricsService.getServiceMetrics().subscribe({
      next: data => {
        this.metrics = data;
        this.topViews = data.top_views ?? [];
        this.topUsers = data.top_users ?? [];
        this.slowQueries = data.slow_queries ?? [];
        this.isLoading = false;
        this.pushDataPoint(data);
        this.updateCharts();
      },
      error: () => { this.isLoading = false; }
    });
  }

  private startPolling(): void {
    this.pollSub = interval(this.POLL_INTERVAL_MS).pipe(
      switchMap(() => this.metricsService.getServiceMetrics())
    ).subscribe({
      next: data => {
        this.metrics = data;
        this.topViews = data.top_views ?? [];
        this.topUsers = data.top_users ?? [];
        this.slowQueries = data.slow_queries ?? [];
        this.lastUpdate = new Date().toLocaleTimeString();
        this.pushDataPoint(data);
        this.updateCharts();
      }
    });
  }

  private pushDataPoint(data: ServiceMetrics): void {
    const now = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this.timeLabels.push(now);
    this.queriesPerMinData.push(data.queries?.queries_per_minute ?? 0);
    this.cacheHitData.push(data.queries?.cache_hit_rate ?? 0);
    this.avgElapsedData.push(data.queries?.avg_elapsed_ms ?? 0);

    if (this.timeLabels.length > this.MAX_POINTS) {
      this.timeLabels.shift();
      this.queriesPerMinData.shift();
      this.cacheHitData.shift();
      this.avgElapsedData.shift();
    }
  }

  private updateCharts(): void {
    this.lineChartData = {
      labels: [...this.timeLabels],
      datasets: [
        {
          label: 'Queries/min',
          data: [...this.queriesPerMinData],
          borderColor: '#10b981',
          backgroundColor: 'rgba(16,185,129,0.1)',
          fill: true,
          tension: 0.4
        },
        {
          label: 'Tiempo prom. (ms ÷ 100)',
          data: this.avgElapsedData.map(v => v / 100),
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245,158,11,0.1)',
          fill: false,
          tension: 0.4
        }
      ]
    };

    this.cacheChartData = {
      labels: [...this.timeLabels],
      datasets: [{
        label: 'Cache Hit Rate %',
        data: [...this.cacheHitData],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,0.15)',
        fill: true,
        tension: 0.4
      }]
    };

    this.topViewsChartData = {
      labels: this.topViews.slice(0, 10).map(v => v.view.split('.').pop() ?? v.view),
      datasets: [{
        label: 'Consultas',
        data: this.topViews.slice(0, 10).map(v => v.count),
        backgroundColor: [
          '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
          '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1'
        ]
      }]
    };
  }

  private setupChartOptions(): void {
    this.lineChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: {
        x: { display: false },
        y: { beginAtZero: true }
      },
      animation: { duration: 300 }
    };

    this.topViewsChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true } }
    };
  }

  formatMs(ms: number): string {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  formatNumber(n: number): string {
    return n?.toLocaleString('es-CO') ?? '0';
  }
}
