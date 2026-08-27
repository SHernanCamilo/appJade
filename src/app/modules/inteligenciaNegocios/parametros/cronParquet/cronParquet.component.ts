import { Component, OnInit, OnDestroy, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressBarModule } from 'primeng/progressbar';
import { ChartModule } from 'primeng/chart';
import { TabViewModule } from 'primeng/tabview';
import { TimelineModule } from 'primeng/timeline';
import { MessageService, ConfirmationService } from 'primeng/api';
import { environment } from '../../../../environments/environment';

interface ParquetConfig {
  id: number;
  schema_name: string;
  view_name: string;
  refresh_interval_min: number;
  priority: string;
  group_name: string;
  enabled: boolean;
  last_synced_at: string | null;
  estimated_rows: number | null;
  created_at: string;
  updated_at: string;
}

interface ParquetStatus {
  schema?: string;
  view?: string;
  status?: string;
  age_hours?: number;
  age_minutes?: number;
  size_mb?: number;
  row_count?: number;
  avg_generation_s?: number;
  lane?: string;
  config?: {
    refresh_interval_min: number;
    priority: string;
    group_name: string;
    is_stale: boolean;
  };
}

interface DashboardData {
  success: boolean;
  stats: {
    total_active?: number;
    due_for_refresh?: number;
    by_status?: Record<string, number>;
    by_priority?: Record<string, number>;
    efficiency_pct?: number;
  };
  due_count: number;
  lanes: Record<string, number>;
  lane_stale: Record<string, number>;
  generated_at: string;
}

interface ParquetHistoryEntry {
  id: number;
  schema_name: string;
  view_name: string;
  status: string;
  lane: string | null;
  age_hours: number | null;
  avg_generation_s: number | null;
  size_mb: number | null;
  row_count: number | null;
  is_stale_by_config: boolean;
  error_message: string | null;
  captured_at: string;
}

type LaneKey = 'sprint' | 'standard' | 'heavy' | 'marathon' | 'nueva';

@Component({
  selector: 'app-cron-parquet',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TableModule, TagModule, ButtonModule,
    InputTextModule, TooltipModule, ConfirmDialogModule, ToastModule, DialogModule,
    ProgressBarModule, ChartModule, TabViewModule, TimelineModule,
  ],
  providers: [MessageService, ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cronParquet.component.html',
  styleUrl: './cronParquet.component.css',
})
export class CronParquetComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly msg  = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  private readonly baseUrl = `${environment.URL_SERVICIOS}/fabric/viewer/parquet-config`;

  readonly configs     = signal<ParquetConfig[]>([]);
  readonly statuses    = signal<ParquetStatus[]>([]);
  readonly dashboard   = signal<DashboardData | null>(null);
  readonly loading     = signal(true);
  readonly syncing     = signal(false);
  readonly importing   = signal(false);
  readonly runningCron = signal(false);
  readonly showDialog  = signal(false);
  readonly editMode    = signal(false);
  readonly autoRefresh = signal(false);
  readonly lastUpdate  = signal<Date | null>(null);

  // Historial (trazabilidad por vista)
  readonly showHistory     = signal(false);
  readonly historyLoading  = signal(false);
  readonly historyEntries  = signal<ParquetHistoryEntry[]>([]);
  readonly historyView     = signal<{ schema: string; view: string } | null>(null);

  private autoTimer: ReturnType<typeof setInterval> | null = null;

  // Busqueda / filtro
  searchTerm = '';
  statusFilter = signal<string>('all');

  // Chart data (donut de estados)
  readonly statusChartData = computed(() => {
    const d = this.dashboard();
    const by = d?.stats?.by_status ?? {};
    const labels = Object.keys(by);
    const data = Object.values(by);
    const colorMap: Record<string, string> = {
      ok: '#22c55e', stale: '#ef4444', pending: '#f59e0b',
      generating: '#3b82f6', error: '#dc2626', missing: '#9ca3af',
    };
    return {
      labels,
      datasets: [{
        data,
        backgroundColor: labels.map(l => colorMap[l] ?? '#c084fc'),
        borderWidth: 0,
      }],
    };
  });

  readonly chartOptions = {
    cutout: '65%',
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
    },
    responsive: true,
    maintainAspectRatio: false,
  };

  // KPIs derivados
  readonly kpiTotal    = computed(() => this.dashboard()?.stats?.total_active ?? this.configs().length);
  readonly kpiOk       = computed(() => this.dashboard()?.stats?.by_status?.['ok'] ?? 0);
  readonly kpiStale    = computed(() => this.dashboard()?.stats?.by_status?.['stale'] ?? 0);
  readonly kpiPending  = computed(() => this.dashboard()?.stats?.by_status?.['pending'] ?? 0);
  readonly kpiError    = computed(() => this.dashboard()?.stats?.by_status?.['error'] ?? 0);
  readonly kpiGenerating = computed(() => this.dashboard()?.stats?.by_status?.['generating'] ?? 0);
  readonly kpiEfficiency = computed(() => this.dashboard()?.stats?.efficiency_pct ?? 0);
  readonly kpiDue      = computed(() => this.dashboard()?.due_count ?? 0);

  readonly lanesList = computed<Array<{ key: LaneKey; label: string; total: number; stale: number; pct: number }>>(() => {
    const d = this.dashboard();
    if (!d) return [];
    const lanes = d.lanes ?? {};
    const stale = d.lane_stale ?? {};
    const labels: Record<LaneKey, string> = {
      sprint: 'Sprint (≤30s)', standard: 'Standard (30-180s)',
      heavy: 'Heavy (3-15m)', marathon: 'Marathon (>15m)', nueva: 'Nuevas',
    };
    return (Object.keys(labels) as LaneKey[]).map(k => {
      const total = lanes[k] ?? 0;
      const st = stale[k] ?? 0;
      return { key: k, label: labels[k], total, stale: st, pct: total > 0 ? Math.round((st / total) * 100) : 0 };
    }).filter(l => l.total > 0);
  });

  // Formulario
  form = this.emptyForm();

  private emptyForm() {
    return {
      id: 0,
      schema_name: 'dc',
      view_name: '',
      refresh_interval_min: 60,
      priority: 'medium',
      group_name: 'general',
      enabled: true,
    };
  }

  ngOnInit(): void {
    this.loadConfigs();
    this.loadStatus();
    this.loadDashboard();
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }

  // ─── Auto-refresh ────────────────────────────────────────────────────────

  toggleAutoRefresh(): void {
    if (this.autoRefresh()) {
      this.stopAutoRefresh();
    } else {
      this.autoRefresh.set(true);
      this.autoTimer = setInterval(() => {
        this.loadStatus();
        this.loadDashboard();
      }, 15000);
    }
  }

  private stopAutoRefresh(): void {
    this.autoRefresh.set(false);
    if (this.autoTimer) { clearInterval(this.autoTimer); this.autoTimer = null; }
  }

  // ─── Data loading ──────────────────────────────────────────────────────────

  loadConfigs(): void {
    this.loading.set(true);
    this.http.get<{ success: boolean; data: ParquetConfig[] }>(this.baseUrl).subscribe({
      next: res => { this.configs.set(res.data ?? []); this.loading.set(false); },
      error: () => { this.loading.set(false); this.msg.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las configuraciones' }); },
    });
  }

  loadStatus(): void {
    this.http.get<{ success: boolean; views: ParquetStatus[] }>(`${this.baseUrl}/status`).subscribe({
      next: res => { this.statuses.set(res.views ?? []); this.lastUpdate.set(new Date()); },
      error: () => this.msg.add({ severity: 'warn', summary: 'Aviso', detail: 'No se pudo obtener estado de Graph-Fabric' }),
    });
  }

  loadDashboard(): void {
    this.http.get<DashboardData>(`${this.baseUrl}/dashboard`).subscribe({
      next: res => this.dashboard.set(res),
      error: () => {},
    });
  }

  refreshAll(): void {
    this.loadConfigs();
    this.loadStatus();
    this.loadDashboard();
  }

  // ─── Filtro ────────────────────────────────────────────────────────────────

  get filteredConfigs(): ParquetConfig[] {
    let list = this.configs();

    // Filtro por estado
    const sf = this.statusFilter();
    if (sf !== 'all') {
      list = list.filter(c => {
        const st = this.getStatusForView(c.schema_name, c.view_name);
        if (sf === 'stale') return st?.status === 'stale' || st?.config?.is_stale;
        if (sf === 'error') return st?.status === 'error';
        if (sf === 'ok') return st?.status === 'ok' && !st?.config?.is_stale;
        if (sf === 'pending') return st?.status === 'pending' || !st;
        return true;
      });
    }

    // Filtro por busqueda
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      list = list.filter(c =>
        c.schema_name.toLowerCase().includes(term) ||
        c.view_name.toLowerCase().includes(term) ||
        c.priority.toLowerCase().includes(term) ||
        (c.group_name || '').toLowerCase().includes(term)
      );
    }

    return list;
  }

  setStatusFilter(status: string): void {
    this.statusFilter.set(this.statusFilter() === status ? 'all' : status);
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  openNew(): void {
    this.form = this.emptyForm();
    this.editMode.set(false);
    this.showDialog.set(true);
  }

  editConfig(config: ParquetConfig): void {
    this.form = {
      id: config.id,
      schema_name: config.schema_name,
      view_name: config.view_name,
      refresh_interval_min: config.refresh_interval_min,
      priority: config.priority,
      group_name: config.group_name,
      enabled: config.enabled,
    };
    this.editMode.set(true);
    this.showDialog.set(true);
  }

  saveConfig(): void {
    if (!this.form.schema_name || !this.form.view_name || !this.form.refresh_interval_min) {
      this.msg.add({ severity: 'warn', summary: 'Validacion', detail: 'Complete todos los campos requeridos' });
      return;
    }

    this.http.post<{ success: boolean; data: ParquetConfig; synced: boolean; message: string }>(
      this.baseUrl, this.form
    ).subscribe({
      next: res => {
        this.msg.add({
          severity: res.synced ? 'success' : 'warn',
          summary: 'Guardado',
          detail: res.message,
        });
        this.showDialog.set(false);
        this.loadConfigs();
        this.loadStatus();
      },
      error: err => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: err?.error?.message ?? 'Error al guardar' });
      },
    });
  }

  deleteConfig(config: ParquetConfig): void {
    this.confirm.confirm({
      message: `Eliminar la configuracion de ${config.schema_name}.${config.view_name}? La vista dejara de regenerarse por cron.`,
      header: 'Confirmar eliminacion',
      icon: 'pi pi-trash',
      accept: () => {
        this.http.delete<{ success: boolean }>(`${this.baseUrl}/${config.id}`).subscribe({
          next: () => {
            this.msg.add({ severity: 'success', summary: 'Eliminado', detail: 'Configuracion eliminada' });
            this.loadConfigs();
          },
          error: () => this.msg.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar' }),
        });
      },
    });
  }

  toggleEnabled(config: ParquetConfig): void {
    this.http.post<{ success: boolean }>(this.baseUrl, {
      schema_name: config.schema_name,
      view_name: config.view_name,
      refresh_interval_min: config.refresh_interval_min,
      priority: config.priority,
      group_name: config.group_name,
      enabled: !config.enabled,
    }).subscribe({
      next: () => this.loadConfigs(),
      error: () => this.msg.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cambiar el estado' }),
    });
  }

  // ─── Sync ─────────────────────────────────────────────────────────────────

  syncAll(): void {
    this.syncing.set(true);
    this.http.post<{ success: boolean; synced: number; failed: number; pending: number; errors: string[]; message: string }>(
      `${this.baseUrl}/sync`, {}
    ).subscribe({
      next: res => {
        this.syncing.set(false);
        this.msg.add({
          severity: res.failed === 0 ? 'success' : 'warn',
          summary: 'Sincronizacion',
          detail: res.message,
          life: 8000,
        });
        this.loadConfigs();
        this.loadStatus();
        if (res.pending > 0) {
          this.msg.add({
            severity: 'info',
            summary: 'Pendientes',
            detail: `Quedan ${res.pending} vistas sin sincronizar. Click "Sincronizar todo" de nuevo.`,
            life: 10000,
          });
        }
      },
      error: () => {
        this.syncing.set(false);
        this.msg.add({ severity: 'error', summary: 'Error', detail: 'No se pudo sincronizar con Graph-Fabric' });
      },
    });
  }

  // ─── Run Cron ────────────────────────────────────────────────────────────

  runCron(): void {
    this.runningCron.set(true);
    this.http.post<{ success: boolean; due_count: number; message: string }>(
      `${this.baseUrl}/run-cron`, {}
    ).subscribe({
      next: res => {
        this.runningCron.set(false);
        this.msg.add({
          severity: 'success',
          summary: 'Cron ejecutado',
          detail: res.message,
          life: 6000,
        });
        setTimeout(() => { this.loadStatus(); this.loadDashboard(); }, 5000);
      },
      error: err => {
        this.runningCron.set(false);
        this.msg.add({ severity: 'error', summary: 'Error', detail: err?.error?.message ?? 'No se pudo ejecutar el cron' });
      },
    });
  }

  // ─── Import from Graph ──────────────────────────────────────────────────

  importFromGraph(): void {
    this.confirm.confirm({
      message: 'Importar todas las vistas existentes en Graph-Fabric? Se asignaran intervalos por defecto segun el schema. Las ya configuradas no se sobreescriben.',
      header: 'Importar desde Graph-Fabric',
      icon: 'pi pi-cloud-download',
      accept: () => {
        this.importing.set(true);
        this.http.post<{ success: boolean; imported: number; skipped: number; total: number; message: string }>(
          `${this.baseUrl}/import-from-graph`, {}
        ).subscribe({
          next: res => {
            this.importing.set(false);
            this.msg.add({
              severity: 'success',
              summary: 'Importacion completada',
              detail: res.message,
              life: 8000,
            });
            this.loadConfigs();
            this.loadStatus();
            this.loadDashboard();
          },
          error: err => {
            this.importing.set(false);
            this.msg.add({ severity: 'error', summary: 'Error', detail: err?.error?.message ?? 'No se pudo importar' });
          },
        });
      },
    });
  }

  // ─── Force Refresh ──────────────────────────────────────────────────────

  forceRefresh(config: ParquetConfig): void {
    this.msg.add({ severity: 'info', summary: 'Regenerando...', detail: `Solicitando regeneracion de ${config.view_name}...` });

    this.http.post<{ success: boolean; r2_status?: string; message?: string }>(
      `${environment.URL_SERVICIOS}/fabric/viewer/export/start`,
      {
        schema_name: config.schema_name,
        view: config.view_name,
        format: 'xlsx',
        max_rows: 1,
        force_refresh: true,
      }
    ).subscribe({
      next: res => {
        const status = res.r2_status ?? 'enviado';
        this.msg.add({
          severity: status === 'generating' ? 'warn' : 'success',
          summary: 'Force Refresh',
          detail: res.message ?? `${config.view_name}: ${status}`,
          life: 5000,
        });
      },
      error: err => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: err?.error?.message ?? 'No se pudo forzar la regeneracion' });
      },
    });
  }

  // ─── Historial (trazabilidad por vista) ─────────────────────────────────

  openHistory(config: ParquetConfig): void {
    this.historyView.set({ schema: config.schema_name, view: config.view_name });
    this.showHistory.set(true);
    this.historyLoading.set(true);
    this.historyEntries.set([]);

    this.http.get<{ success: boolean; history: ParquetHistoryEntry[] }>(
      `${this.baseUrl}/${config.schema_name}/${config.view_name}/history`
    ).subscribe({
      next: res => {
        this.historyEntries.set(res.history ?? []);
        this.historyLoading.set(false);
      },
      error: () => {
        this.historyLoading.set(false);
        this.msg.add({ severity: 'warn', summary: 'Aviso', detail: 'No hay historial disponible todavia para esta vista.' });
      },
    });
  }

  historyDotColor(status: string): string {
    const map: Record<string, string> = {
      ok: '#22c55e', stale: '#ef4444', pending: '#f59e0b',
      generating: '#3b82f6', error: '#dc2626', missing: '#9ca3af',
    };
    return map[status] ?? '#c084fc';
  }

  historyDotIcon(status: string): string {
    const map: Record<string, string> = {
      ok: 'pi pi-check', stale: 'pi pi-clock', pending: 'pi pi-hourglass',
      generating: 'pi pi-spin pi-spinner', error: 'pi pi-times', missing: 'pi pi-minus',
    };
    return map[status] ?? 'pi pi-circle';
  }

  formatDateTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString('es-CO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  getPriorityTag(priority: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<string, any> = {
      realtime: 'danger', high: 'warn', medium: 'info', low: 'secondary', manual: 'secondary',
    };
    return map[priority] ?? 'info';
  }

  getStatusTag(status: ParquetStatus): 'success' | 'warn' | 'danger' | 'info' {
    if (status.config?.is_stale) return 'danger';
    if (status.status === 'ready') return 'success';
    if (status.status === 'generating') return 'warn';
    if (status.status === 'ok') return 'success';
    if (status.status === 'stale') return 'danger';
    if (status.status === 'missing') return 'info';
    return 'info';
  }

  getAgeDisplay(st: ParquetStatus): string {
    if (st.age_hours != null) {
      if (st.age_hours < 1) return `${Math.round(st.age_hours * 60)} min`;
      if (st.age_hours < 24) return `${st.age_hours.toFixed(1)}h`;
      return `${Math.floor(st.age_hours / 24)}d ${Math.round(st.age_hours % 24)}h`;
    }
    if (st.age_minutes != null) {
      if (st.age_minutes < 60) return `${st.age_minutes} min`;
      return `${(st.age_minutes / 60).toFixed(1)}h`;
    }
    return '';
  }

  timeAgo(iso: string | null): string {
    if (!iso) return 'Nunca';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Justo ahora';
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  }

  getStatusForView(schema: string, view: string): ParquetStatus | undefined {
    return this.statuses().find(s => s.schema === schema && s.view === view);
  }

  getLane(st: ParquetStatus): string {
    const avg = st.avg_generation_s;
    if (avg == null) return 'sprint (nueva)';
    if (avg <= 30) return 'sprint';
    if (avg <= 180) return 'standard';
    if (avg <= 900) return 'heavy';
    return 'marathon';
  }

  getLaneTag(st: ParquetStatus): 'success' | 'info' | 'warn' | 'danger' {
    const avg = st.avg_generation_s;
    if (avg == null) return 'success';
    if (avg <= 30) return 'success';
    if (avg <= 180) return 'info';
    if (avg <= 900) return 'warn';
    return 'danger';
  }

  laneBarColor(pct: number): string {
    if (pct >= 70) return '#ef4444';
    if (pct >= 40) return '#f59e0b';
    return '#22c55e';
  }
}
