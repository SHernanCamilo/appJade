import { Component, OnInit, signal, inject, ChangeDetectionStrategy } from '@angular/core';
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
  age_minutes?: number;
  size_mb?: number;
  row_count?: number;
  config?: {
    refresh_interval_min: number;
    priority: string;
    group_name: string;
    is_stale: boolean;
  };
}

@Component({
  selector: 'app-cron-parquet',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TableModule, TagModule, ButtonModule,
    InputTextModule, TooltipModule, ConfirmDialogModule, ToastModule, DialogModule,
  ],
  providers: [MessageService, ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cronParquet.component.html',
  styleUrl: './cronParquet.component.css',
})
export class CronParquetComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly msg  = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  private readonly baseUrl = `${environment.URL_SERVICIOS}/fabric/viewer/parquet-config`;

  readonly configs     = signal<ParquetConfig[]>([]);
  readonly statuses    = signal<ParquetStatus[]>([]);
  readonly loading     = signal(true);
  readonly syncing     = signal(false);
  readonly showDialog  = signal(false);
  readonly editMode    = signal(false);

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

  readonly priorities = [
    { label: 'Realtime (5 min)', value: 'realtime' },
    { label: 'Alta (15 min)',    value: 'high' },
    { label: 'Media (1 hora)',   value: 'medium' },
    { label: 'Baja (2 horas)',   value: 'low' },
    { label: 'Manual',           value: 'manual' },
  ];

  readonly groups = [
    { label: 'Censos',      value: 'censos' },
    { label: 'Operativo',   value: 'operativo' },
    { label: 'Financiero',  value: 'financiero' },
    { label: 'Analitico',   value: 'analitico' },
    { label: 'General',     value: 'general' },
  ];

  ngOnInit(): void {
    this.loadConfigs();
    this.loadStatus();
  }

  loadConfigs(): void {
    this.loading.set(true);
    this.http.get<{ success: boolean; data: ParquetConfig[] }>(this.baseUrl).subscribe({
      next: res => { this.configs.set(res.data ?? []); this.loading.set(false); },
      error: () => { this.loading.set(false); this.msg.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las configuraciones' }); },
    });
  }

  loadStatus(): void {
    this.http.get<{ success: boolean; views: ParquetStatus[] }>(`${this.baseUrl}/status`).subscribe({
      next: res => this.statuses.set(res.views ?? []),
      error: () => {},
    });
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
    this.http.post<{ success: boolean; synced: number; failed: number; message: string }>(
      `${this.baseUrl}/sync`, {}
    ).subscribe({
      next: res => {
        this.syncing.set(false);
        this.msg.add({
          severity: res.failed === 0 ? 'success' : 'warn',
          summary: 'Sincronizacion',
          detail: res.message,
        });
        this.loadConfigs();
        this.loadStatus();
      },
      error: () => {
        this.syncing.set(false);
        this.msg.add({ severity: 'error', summary: 'Error', detail: 'No se pudo sincronizar con Graph-Fabric' });
      },
    });
  }

  // ─── Force Refresh (regenerar un solo parquet) ──────────────────────────

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
    return 'info';
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
}
