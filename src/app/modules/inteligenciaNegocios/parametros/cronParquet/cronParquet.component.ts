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
  error?: string | null;
  error_message?: string | null;
  message?: string | null;
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

/** Una vista generandose AHORA, segun /parquet-monitor/live (dato real de Graph-Fabric). */
interface GeneratingNow {
  qualified_name: string;
  lane?: string | null;
  /** queued | fabric_query | writing_parquet | uploading_r2 */
  stage?: string | null;
  started_at?: string | null;
  running_s?: number | null;
  is_stuck?: boolean;
  stuck_threshold_s?: number | null;
  error_message?: string | null;
  avg_generation_s?: number | null;
}

/** Resumen de salud del pipeline (incluye `overdue` = riesgo de SLA). */
interface LiveSummary {
  total?: number;
  ok?: number;
  stale?: number;
  missing?: number;
  cooldown?: number;
  too_big?: number;
  generating?: number;
  stuck?: number;
  overdue?: number;
}

/** Estado en vivo de una regeneracion forzada (boton del rayo). */
interface RefreshJob {
  key: string;                 // "schema.view"
  view: string;
  jobId: string | null;
  phase: 'starting' | 'running' | 'done' | 'failed';
  progress: number;            // 0-100
  stage: string;               // texto que reporta Graph-Fabric
  rows: number;
  startedAt: number;           // epoch ms, para calcular transcurrido y detectar congelamiento
  message?: string;
}

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

  /**
   * Proxy interno de Laravel hacia Graph-Fabric.
   * El token de servicio nunca llega al navegador: estas rutas lo agregan en
   * el backend.
   */
  private readonly monitorUrl = `${environment.URL_SERVICIOS}/fabric/viewer/parquet-monitor`;

  readonly configs     = signal<ParquetConfig[]>([]);
  readonly statuses    = signal<ParquetStatus[]>([]);
  readonly dashboard   = signal<DashboardData | null>(null);
  readonly loading     = signal(true);
  readonly syncing     = signal(false);
  readonly importing   = signal(false);
  readonly runningCron = signal(false);
  readonly rebalancing = signal(false);
  readonly showDialog  = signal(false);
  readonly editMode    = signal(false);
  readonly autoRefresh = signal(false);
  readonly lastUpdate  = signal<Date | null>(null);

  // Historial (trazabilidad por vista)
  readonly showHistory     = signal(false);
  readonly historyLoading  = signal(false);
  readonly historyEntries  = signal<ParquetHistoryEntry[]>([]);
  readonly historyView     = signal<{ schema: string; view: string } | null>(null);

  // Seguimiento del "rayo" (force refresh) por vista: muestra loader + trazabilidad
  // en vivo mientras Graph-Fabric regenera, y avisa si termina o falla/se congela.
  readonly refreshJobs = signal<Record<string, RefreshJob>>({});
  private refreshTimers = new Map<string, ReturnType<typeof setInterval>>();

  // Estado en vivo que reporta Graph-Fabric (/parquet-monitor/live):
  // lo que se esta generando AHORA y el resumen de salud del pipeline.
  readonly generatingNow = signal<GeneratingNow[]>([]);
  readonly liveSummary   = signal<LiveSummary | null>(null);

  // Rastreo de "en proceso ahora": cuando el frontend ve por primera vez una
  // vista en estado generating, guarda el epoch ms. Asi puede mostrar cuanto
  // lleva generandose y marcar como "posible bloqueo" si tarda demasiado.
  private generatingSince = new Map<string, number>();

  // Umbral (segundos) sobre el que una generacion se considera atascada.
  private readonly STUCK_THRESHOLD_S = 300; // 5 min

  // "Reloj" que fuerza el recalculo del tiempo transcurrido cada segundo.
  readonly nowTick = signal(Date.now());
  private clockTimer: ReturnType<typeof setInterval> | null = null;

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

  /**
   * Vistas generandose AHORA (panel en vivo).
   *
   * Fuente primaria: `generating_now` de Graph-Fabric, que ya trae el `stage`
   * real (queued/fabric_query/writing_parquet/uploading_r2), `running_s` e
   * `is_stuck`. Si la API no reporta nada, cae al rastreo local sobre /status.
   *
   * Depende de nowTick para que el cronometro avance cada segundo entre
   * refrescos (que ocurren cada 15s con Auto ON).
   */
  readonly enProceso = computed<Array<{
    schema: string; view: string; elapsedS: number; stuck: boolean;
    rows: number | null; stage: string | null; lane: string | null; error: string | null;
  }>>(() => {
    const now  = this.nowTick();
    const live = this.generatingNow();

    if (live.length > 0) {
      return live.map(g => {
        const [schema, ...resto] = (g.qualified_name ?? '').split('.');
        const view = resto.join('.') || (g.qualified_name ?? '');

        // running_s es el dato autoritativo; si no viene, se calcula de started_at.
        let elapsedS = g.running_s != null ? Math.round(g.running_s) : 0;
        if (elapsedS === 0 && g.started_at) {
          const t = Date.parse(g.started_at);
          if (!Number.isNaN(t)) elapsedS = Math.max(0, Math.round((now - t) / 1000));
        }

        const umbral = g.stuck_threshold_s ?? this.STUCK_THRESHOLD_S;

        return {
          schema,
          view,
          elapsedS,
          stuck: g.is_stuck ?? (elapsedS >= umbral),
          rows: null,
          stage: g.stage ?? null,
          lane: g.lane ?? null,
          error: g.error_message ?? null,
        };
      }).sort((a, b) => b.elapsedS - a.elapsedS);
    }

    // Respaldo: deducirlo de /status con el rastreo local.
    return this.statuses()
      .filter(v => this.isGenerating(v))
      .map(v => {
        const key = `${v.schema}.${v.view}`;
        const since = this.generatingSince.get(key) ?? now;
        const elapsedS = Math.max(0, Math.round((now - since) / 1000));
        return {
          schema: v.schema ?? '',
          view: v.view ?? '',
          elapsedS,
          stuck: elapsedS >= this.STUCK_THRESHOLD_S,
          rows: v.row_count ?? null,
          stage: null as string | null,
          lane: null as string | null,
          error: null as string | null,
        };
      })
      .sort((a, b) => b.elapsedS - a.elapsedS);
  });

  /** Vistas en riesgo de SLA (muy atrasadas o nunca generadas). */
  readonly kpiOverdue = computed(() => this.liveSummary()?.overdue ?? 0);

  /** Vistas atascadas segun Graph-Fabric. */
  readonly kpiStuck = computed(() => this.liveSummary()?.stuck ?? 0);

  /** Etiqueta legible de la fase de generacion. */
  stageLabel(stage: string | null): string {
    if (!stage) return 'Procesando';
    const map: Record<string, string> = {
      queued:          'En cola',
      fabric_query:    'Consultando Fabric',
      writing_parquet: 'Escribiendo parquet',
      uploading_r2:    'Subiendo a R2',
    };
    return map[stage] ?? stage;
  }

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
    this.loadLive();

    // Reloj de 1s: recalcula el tiempo transcurrido del panel "En proceso".
    this.clockTimer = setInterval(() => this.nowTick.set(Date.now()), 1000);
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
    if (this.clockTimer) { clearInterval(this.clockTimer); this.clockTimer = null; }
    // Cortar cualquier polling de force refresh en curso.
    this.refreshTimers.forEach(t => clearInterval(t));
    this.refreshTimers.clear();
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
        this.loadLive();   // panel "Generando ahora" + riesgo de SLA
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
      next: res => {
        const views = res.views ?? [];
        this.trackGenerating(views);
        this.statuses.set(views);
        this.lastUpdate.set(new Date());
      },
      error: () => this.msg.add({ severity: 'warn', summary: 'Aviso', detail: 'No se pudo obtener estado de Graph-Fabric' }),
    });
  }

  /**
   * Mantiene el mapa de "desde cuando" cada vista esta generando.
   *
   * - Si una vista aparece generando y no estaba registrada → guarda ahora.
   * - Si una vista dejo de generar → se limpia su marca.
   * Asi el panel "En proceso" puede mostrar el tiempo transcurrido real y
   * detectar generaciones atascadas.
   */
  private trackGenerating(views: ParquetStatus[]): void {
    const ahora = Date.now();
    const generandoAhora = new Set<string>();

    for (const v of views) {
      if (this.isGenerating(v)) {
        const key = `${v.schema}.${v.view}`;
        generandoAhora.add(key);
        if (!this.generatingSince.has(key)) {
          // Si Graph ya reporta cuanto lleva (running_s), respetarlo; si no, ahora.
          const runningMs = (v as any).running_s != null ? (v as any).running_s * 1000 : 0;
          this.generatingSince.set(key, ahora - runningMs);
        }
      }
    }

    // Limpiar las que ya no estan generando.
    for (const key of Array.from(this.generatingSince.keys())) {
      if (!generandoAhora.has(key)) this.generatingSince.delete(key);
    }
  }

  loadDashboard(): void {
    this.http.get<DashboardData>(`${this.baseUrl}/dashboard`).subscribe({
      next: res => this.dashboard.set(res),
      error: () => {},
    });
  }

  /**
   * Estado en vivo desde Graph-Fabric: panel "Generando ahora" + resumen de
   * salud (summary.overdue = vistas en riesgo de SLA).
   */
  loadLive(): void {
    this.http.get<{ success: boolean; summary: LiveSummary; generating_now: GeneratingNow[]; message?: string }>(
      `${this.monitorUrl}/live`
    ).subscribe({
      next: res => {
        this.generatingNow.set(res.generating_now ?? []);
        this.liveSummary.set(res.summary ?? null);
      },
      error: () => {
        // Sin estado en vivo no se rompe la pantalla: se limpia el panel.
        this.generatingNow.set([]);
      },
    });
  }

  refreshAll(): void {
    this.loadConfigs();
    this.loadStatus();
    this.loadDashboard();
    this.loadLive();
  }

  // ─── Filtro ────────────────────────────────────────────────────────────────

  get filteredConfigs(): ParquetConfig[] {
    let list = this.configs();

    // Filtro por estado
    const sf = this.statusFilter();
    if (sf !== 'all') {
      list = list.filter(c => {
        const st = this.getStatusForView(c.schema_name, c.view_name);
        if (sf === 'stale')   return this.isStale(st);
        if (sf === 'error')   return this.isError(st);
        if (sf === 'ok')      return st?.status === 'ok' && !this.isStale(st);
        if (sf === 'pending') return this.isPending(st);
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

  /**
   * Ejecuta el cron manualmente. Graph-Fabric responde 202 y corre en
   * background: aqui solo se confirma que la corrida fue iniciada.
   */
  runCron(): void {
    this.runningCron.set(true);
    this.http.post<{ success: boolean; message: string }>(
      `${this.monitorUrl}/schedule/run`, {}
    ).subscribe({
      next: res => {
        this.runningCron.set(false);
        this.msg.add({
          severity: 'success',
          summary: 'Corrida iniciada',
          detail: res.message ?? 'La corrida del cron se ejecuta en segundo plano.',
          life: 6000,
        });
        // Dar tiempo a que arranquen las generaciones y mostrarlas en vivo.
        setTimeout(() => { this.loadStatus(); this.loadDashboard(); this.loadLive(); }, 5000);
      },
      error: err => {
        this.runningCron.set(false);
        this.msg.add({
          severity: 'error', summary: 'Error',
          detail: err?.error?.message ?? 'No se pudo iniciar la corrida del cron.',
          life: 8000,
        });
      },
    });
  }

  // ─── Rebalanceo inteligente ─────────────────────────────────────────────

  rebalance(): void {
    this.confirm.confirm({
      message: 'Rebalancear el scheduler? Desactivara las vistas pequenas (<10K filas) para que se exporten al vuelo, y subira los intervalos de las historicas. Solo las criticas (censos/urgencias) quedan frecuentes. Esto reduce la carga sobre Fabric.',
      header: 'Rebalanceo inteligente',
      icon: 'pi pi-sliders-h',
      accept: () => {
        this.rebalancing.set(true);
        this.http.post<{ success: boolean; message: string; output?: string }>(
          `${this.baseUrl}/rebalance`, { dry_run: false }
        ).subscribe({
          next: res => {
            this.rebalancing.set(false);
            this.msg.add({
              severity: res.success ? 'success' : 'warn',
              summary: 'Rebalanceo',
              detail: res.message,
              life: 8000,
            });
            this.refreshAll();
          },
          error: err => {
            this.rebalancing.set(false);
            this.msg.add({ severity: 'error', summary: 'Error', detail: err?.error?.message ?? 'No se pudo rebalancear' });
          },
        });
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

  /**
   * Boton rayo: prioriza la vista y la genera YA, sin bloquear el navegador.
   *
   * Flujo warm + polling (Graph-Fabric es dueño de la generacion y ya deduplica
   * si dos usuarios fuerzan la misma vista):
   *   1. POST /parquet-monitor/force  → responde en <200ms
   *   2. Si status == "generating" → polling a /force/status cada poll_interval_s
   *   3. Termina en ready | too_big | error, o al agotar el tope de intentos
   */
  forceRefresh(config: ParquetConfig): void {
    const key = `${config.schema_name}.${config.view_name}`;

    // Evitar doble disparo mientras ya hay uno corriendo para la misma vista.
    const actual = this.refreshJobs()[key];
    if (actual && (actual.phase === 'starting' || actual.phase === 'running')) {
      this.msg.add({ severity: 'info', summary: 'En curso', detail: `${config.view_name} ya se esta regenerando.` });
      return;
    }

    this.setRefreshJob(key, {
      key, view: config.view_name, jobId: null, phase: 'starting',
      progress: 0, stage: 'Priorizando y generando...', rows: 0, startedAt: Date.now(),
    });

    this.http.post<{
      success: boolean; status?: string; poll_interval_s?: number;
      estimated_s?: number; message?: string;
    }>(`${this.monitorUrl}/force`, {
      schema_name: config.schema_name,
      view: config.view_name,
    }).subscribe({
      next: res => {
        const estado = (res.status ?? 'generating').toLowerCase();
        const espera = Math.max(2, res.poll_interval_s ?? 5) * 1000;
        const estimado = res.estimated_s ?? 0;

        // Ya estaba fresco: nada que esperar.
        if (estado === 'ready') {
          this.patchRefreshJob(key, { phase: 'done', progress: 100, stage: 'El parquet ya esta actualizado' });
          this.finishRefresh(key, true, config);
          return;
        }

        // Supera el limite de filas: no se puede generar.
        if (estado === 'too_big') {
          this.patchRefreshJob(key, { phase: 'failed', stage: res.message ?? 'La vista supera el limite de filas' });
          this.clearRefreshTimer(key);
          this.msg.add({
            severity: 'warn', summary: 'Vista demasiado grande',
            detail: res.message ?? `${config.view_name} supera el limite de filas permitido.`,
            life: 9000,
          });
          setTimeout(() => this.removeRefreshJob(key), 6000);
          return;
        }

        // generating o ready_stale → seguir el progreso con polling.
        this.patchRefreshJob(key, {
          phase: 'running',
          stage: estimado > 0
            ? `Generando en Graph-Fabric (estimado ${this.formatElapsed(estimado)})...`
            : 'Generando en Graph-Fabric...',
        });

        this.pollForceStatus(key, config, espera);
      },
      error: err => {
        const detalle = err?.error?.message ?? 'No se pudo iniciar la regeneracion.';
        this.patchRefreshJob(key, { phase: 'failed', stage: 'Error al iniciar', message: detalle });
        this.msg.add({ severity: 'error', summary: 'Error', detail: detalle, life: 8000 });
        setTimeout(() => this.removeRefreshJob(key), 6000);
      },
    });
  }

  /**
   * Polling del warm mientras el estado sea "generating".
   *
   * Tope de intentos para no hacer polling infinito: 120 x poll_interval
   * (con 5s = 10 minutos).
   */
  private pollForceStatus(key: string, config: ParquetConfig, esperaMs: number): void {
    this.clearRefreshTimer(key);

    const MAX_INTENTOS = 120;
    let intentos = 0;

    const timer = setInterval(() => {
      intentos++;

      if (intentos > MAX_INTENTOS) {
        this.patchRefreshJob(key, {
          phase: 'failed',
          stage: 'Se agoto el tiempo de espera (10 min) sin completar',
        });
        this.finishRefresh(key, false, config);
        return;
      }

      const params = `?schema=${encodeURIComponent(config.schema_name)}&view=${encodeURIComponent(config.view_name)}`;

      this.http.get<{
        success: boolean; status?: string; row_count?: number | null;
        estimated_s?: number; message?: string; size_mb?: number | null;
      }>(`${this.monitorUrl}/force/status${params}`).subscribe({
        next: st => {
          const estado = (st.status ?? 'generating').toLowerCase();

          if (estado === 'ready' || estado === 'ready_stale') {
            this.patchRefreshJob(key, {
              phase: 'done',
              progress: 100,
              stage: 'Regeneracion completada',
              rows: st.row_count ?? 0,
            });
            this.finishRefresh(key, true, config);
            return;
          }

          if (estado === 'too_big') {
            this.patchRefreshJob(key, {
              phase: 'failed',
              stage: st.message ?? 'La vista supera el limite de filas',
            });
            this.finishRefresh(key, false, config);
            return;
          }

          if (estado === 'error' || estado === 'failed') {
            this.patchRefreshJob(key, {
              phase: 'failed',
              stage: st.message ?? 'Fallo la generacion en Graph-Fabric',
            });
            this.finishRefresh(key, false, config);
            return;
          }

          // Sigue generando: mostrar referencia de tiempo estimado.
          const estimado = st.estimated_s ?? 0;
          this.patchRefreshJob(key, {
            stage: estimado > 0
              ? `Generando... (estimado ${this.formatElapsed(estimado)})`
              : 'Generando en Graph-Fabric...',
          });
        },
        error: () => {
          // Un error puntual de red no corta el polling; el tope de intentos si.
        },
      });
    }, esperaMs);

    this.refreshTimers.set(key, timer);
  }

  private finishRefresh(key: string, ok: boolean, config: ParquetConfig): void {
    this.clearRefreshTimer(key);
    const job = this.refreshJobs()[key];
    this.msg.add({
      severity: ok ? 'success' : 'error',
      summary: ok ? 'Regeneracion lista' : 'Regeneracion fallida',
      detail: ok
        ? `${config.view_name}: parquet actualizado${job?.rows ? ` (${job.rows.toLocaleString()} filas)` : ''}.`
        : `${config.view_name}: ${job?.stage ?? 'fallo'}. ${job?.message ?? ''}`,
      life: ok ? 5000 : 9000,
    });
    // Refrescar estado/dashboard/en vivo para que la fila muestre el parquet nuevo.
    setTimeout(() => { this.loadStatus(); this.loadDashboard(); this.loadLive(); }, ok ? 1500 : 0);
    // Quitar el loader de la fila a los pocos segundos.
    setTimeout(() => this.removeRefreshJob(key), 6000);
  }

  private setRefreshJob(key: string, job: RefreshJob): void {
    this.refreshJobs.update(m => ({ ...m, [key]: job }));
  }

  private patchRefreshJob(key: string, patch: Partial<RefreshJob>): void {
    this.refreshJobs.update(m => {
      const cur = m[key];
      if (!cur) return m;
      return { ...m, [key]: { ...cur, ...patch } };
    });
  }

  private removeRefreshJob(key: string): void {
    this.refreshJobs.update(m => {
      const { [key]: _drop, ...rest } = m;
      return rest;
    });
  }

  private clearRefreshTimer(key: string): void {
    const t = this.refreshTimers.get(key);
    if (t) { clearInterval(t); this.refreshTimers.delete(key); }
  }

  /** Estado del rayo para una fila (usado por el template). */
  getRefreshJob(schema: string, view: string): RefreshJob | undefined {
    return this.refreshJobs()[`${schema}.${view}`];
  }

  isRefreshing(schema: string, view: string): boolean {
    const j = this.getRefreshJob(schema, view);
    return !!j && (j.phase === 'starting' || j.phase === 'running');
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
      realtime: 'danger', high: 'warn', operativo: 'warn', medium: 'info',
      analitico: 'info', low: 'secondary', manual: 'secondary',
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
    // Match tolerante: Graph puede devolver el nombre con distinto casing.
    const s = schema.toLowerCase();
    const v = view.toLowerCase();
    return this.statuses().find(x =>
      (x.schema ?? '').toLowerCase() === s && (x.view ?? '').toLowerCase() === v
    );
  }

  /** ¿La vista está en error? Reconoce variantes de Graph y presencia de mensaje de error. */
  isError(st?: ParquetStatus): boolean {
    if (!st) return false;
    const s = (st.status ?? '').toLowerCase();
    if (['error', 'failed', 'expired'].includes(s)) return true;
    return !!this.getErrorMessage(st);
  }

  /** ¿La vista está en cola / pendiente de generarse? */
  isPending(st?: ParquetStatus): boolean {
    if (!st) return true; // sin estado aún = en cola
    const s = (st.status ?? '').toLowerCase();
    return ['pending', 'queued', 'generating', 'processing', 'nueva', 'missing'].includes(s);
  }

  /** ¿La vista está desactualizada (stale)? */
  isStale(st?: ParquetStatus): boolean {
    if (!st) return false;
    return (st.status ?? '').toLowerCase() === 'stale' || !!st.config?.is_stale;
  }

  /** ¿La vista se está generando en este momento? */
  isGenerating(st?: ParquetStatus): boolean {
    if (!st) return false;
    return ['generating', 'processing'].includes((st.status ?? '').toLowerCase());
  }

  /** Formatea segundos como "45s" o "2m 10s". */
  formatElapsed(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  }

  /** Mensaje de error de Graph, si lo hay (acepta varios nombres de campo). */
  getErrorMessage(st?: ParquetStatus): string {
    if (!st) return '';
    return (st.error_message || st.error || st.message || '').toString().trim();
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
