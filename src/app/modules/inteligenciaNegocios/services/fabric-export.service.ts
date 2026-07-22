import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ColDef } from 'ag-grid-community';
import {
  ExcelColumn,
  ExcelExportService,
  ExcelReportHeader
} from '../../../core/services/excel-export.service';
import { VistasService } from './vistas.service';
import { handleFabricError } from '../helpers/fabric-error.helper';
import { environment } from '../../../environments/environment';

const TOAST_KEY = 'global-export';

export interface ExportProgress {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  rows: number;
  message: string;
  filename?: string;
  fileSize?: string;
}

export interface FabricExportOptions {
  schema: string;
  viewName: string;
  label?: string;
  max_rows?: number;
  filters?: Record<string, string>;
  sort_col?: string;
  sort_dir?: 'asc' | 'desc';
  format?: 'gzip' | 'excel';
}

export interface FabricExportDesdeGrillaOptions extends FabricExportOptions {
  rowData: Record<string, unknown>[];
  columnDefs: ColDef[];
  codigo?: string;
  fuente?: string;
  /** false si aún llegan más filas desde Fabric */
  cargaCompleta?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class FabricExportService {
  private pendingCountSubject = new BehaviorSubject(0);
  readonly pendingCount$ = this.pendingCountSubject.asObservable();

  private exportProgressSubject = new BehaviorSubject<ExportProgress | null>(null);
  readonly exportProgress$ = this.exportProgressSubject.asObservable();

  /** Referencia activa para poder cancelar */
  private activeEventSource: EventSource | null = null;
  private activePollInterval: ReturnType<typeof setInterval> | null = null;
  private activeJobId: string | null = null;

  constructor(
    private http: HttpClient,
    private vistasService: VistasService,
    private excelExportService: ExcelExportService,
    private messageService: MessageService
  ) {}

  get hasPendingExports(): boolean {
    return this.pendingCountSubject.value > 0;
  }

  /**
   * Exporta usando los datos ya cargados en la grilla (instantáneo vs Fabric).
   * Si no hay filas en memoria, cae al export del servidor.
   */
  exportarExcel(options: FabricExportDesdeGrillaOptions): void {
    if (options.rowData.length > 0 && options.columnDefs.length > 0) {
      void this.exportarExcelLocal(options);
      return;
    }
    this.exportarExcelEnSegundoPlano(options);
  }

  /**
   * Cancela el export en progreso:
   * - Cierra EventSource o clearInterval
   * - Limpia el estado de progreso
   * - No detiene el job en el server (se completará solo en background)
   */
  cancelExport(): void {
    if (this.activeEventSource) {
      this.activeEventSource.close();
      this.activeEventSource = null;
    }
    if (this.activePollInterval) {
      clearInterval(this.activePollInterval);
      this.activePollInterval = null;
    }
    this.activeJobId = null;
    this.exportProgressSubject.next(null);
    this.decrementPending();
    this.messageService.add({
      key: TOAST_KEY, severity: 'info', summary: 'Exportación cancelada',
      detail: 'Se canceló la descarga. El servidor liberará los recursos.', life: 4000
    });
  }

  exportarExcelEnSegundoPlano(options: FabricExportOptions): void {
    const label = options.label ?? `${options.schema}.${options.viewName}`;
    const baseUrl = `${environment.URL_SERVICIOS}/fabric/viewer/export`;

    this.pendingCountSubject.next(this.pendingCountSubject.value + 1);
    this.exportProgressSubject.next({ status: 'pending', progress: 0, rows: 0, message: 'Iniciando exportación...' });

    // 1. Iniciar export async
    this.http.post<{ success: boolean; job_id: string; message?: string }>(`${baseUrl}/start`, {
      schema_name: options.schema,
      view: options.viewName,
      filters: options.filters ?? {},
      sort_col: options.sort_col ?? '',
      sort_dir: options.sort_dir ?? 'asc',
      max_rows: options.max_rows ?? 500_000,
      format: options.format ?? 'excel'
    }).subscribe({
      next: (res: any) => {
        // Normalizar respuesta — el job_id puede venir en diferentes formatos
        const jobId = res?.job_id ?? res?.data?.job_id;
        if (!jobId) {
          this.exportProgressSubject.next(null);
          this.decrementPending();
          this.messageService.add({ key: TOAST_KEY, severity: 'error', summary: 'Error', detail: res?.message ?? 'No se pudo iniciar la exportación', life: 5000 });
          return;
        }
        // 2. Polling
        this.pollExportStatus(jobId, label, baseUrl);
      },
      error: (err) => {
        this.exportProgressSubject.next(null);
        this.decrementPending();
        const detail = err instanceof HttpErrorResponse ? handleFabricError(err) : 'Error al iniciar exportación';
        this.messageService.add({ key: TOAST_KEY, severity: 'error', summary: 'Error', detail, life: 6000 });
      }
    });
  }

  private pollExportStatus(jobId: string, label: string, baseUrl: string): void {
    // Intentar SSE primero, fallback a polling si no soportado
    if (typeof EventSource !== 'undefined') {
      this.streamExportSSE(jobId, label, baseUrl);
    } else {
      this.pollExportStatusLegacy(jobId, label, baseUrl);
    }
  }

  /**
   * SSE: conexión persistente al endpoint de streaming.
   * Reduce de 20+ requests a 1 sola conexión por export.
   */
  private streamExportSSE(jobId: string, label: string, baseUrl: string): void {
    const sseUrl = `${environment.URL_SERVICIOS}/fabric/viewer/export/stream/${jobId}`;
    const eventSource = new EventSource(sseUrl);
    this.activeEventSource = eventSource;
    this.activeJobId = jobId;

    eventSource.onmessage = (event: MessageEvent) => {
      let data: ExportProgress & { file_size_human?: string };
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      if (data.status === 'processing' || data.status === 'pending') {
        this.exportProgressSubject.next({
          status: data.status,
          progress: data.progress ?? 0,
          rows: data.rows ?? 0,
          message: data.message ?? 'Procesando...'
        });
        return;
      }

      if (data.status === 'completed') {
        eventSource.close();
        this.exportProgressSubject.next({
          status: 'completed',
          progress: 100,
          rows: data.rows ?? 0,
          message: 'Descarga lista',
          filename: data.filename,
          fileSize: data.file_size_human ?? data.fileSize
        });

        // Descargar archivo
        this.http.get(`${baseUrl}/download/${jobId}`, { responseType: 'blob' }).subscribe({
          next: (blob) => {
            this.triggerDownload(blob, data.filename ?? `${label}.xlsx`);
            setTimeout(() => this.exportProgressSubject.next(null), 3000);
            this.decrementPending();
            this.messageService.add({
              key: TOAST_KEY, severity: 'success', summary: 'Excel descargado',
              detail: `${(data.rows ?? 0).toLocaleString('es-CO')} filas · ${data.file_size_human ?? ''}`, life: 6000
            });
          },
          error: () => {
            window.open(`${baseUrl}/download/${jobId}`, '_blank');
            setTimeout(() => this.exportProgressSubject.next(null), 3000);
            this.decrementPending();
          }
        });
        return;
      }

      if (data.status === 'failed') {
        eventSource.close();
        this.exportProgressSubject.next(null);
        this.decrementPending();
        this.messageService.add({
          key: TOAST_KEY, severity: 'error', summary: 'Exportación fallida',
          detail: data.message ?? 'Error generando el Excel', life: 8000
        });
      }
    };

    eventSource.onerror = () => {
      // SSE se reconecta automáticamente, pero si se cierra definitivamente, fallback
      if (eventSource.readyState === EventSource.CLOSED) {
        this.pollExportStatusLegacy(jobId, label, baseUrl);
      }
      // Si readyState === CONNECTING, SSE está reconectando automáticamente (no hacer nada)
    };
  }

  /**
   * Fallback: polling clásico cada 2s (para navegadores sin SSE o si falla).
   */
  private pollExportStatusLegacy(jobId: string, label: string, baseUrl: string): void {
    this.activeJobId = jobId;
    const poll = setInterval(() => {
      this.http.get<{ success: boolean; data: any }>(`${baseUrl}/status/${jobId}`).subscribe({
        next: (res) => {
          const d = res.data;

          if (d.status === 'processing' || d.status === 'pending') {
            this.exportProgressSubject.next({
              status: d.status,
              progress: d.progress ?? 0,
              rows: d.rows ?? 0,
              message: d.message ?? 'Procesando...'
            });
            return;
          }

          if (d.status === 'completed') {
            clearInterval(poll);
            this.exportProgressSubject.next({
              status: 'completed',
              progress: 100,
              rows: d.rows ?? 0,
              message: 'Descarga lista',
              filename: d.filename,
              fileSize: d.file_size_human
            });

            // 3. Descargar — intentar con HttpClient, fallback a window.open
            this.http.get(`${baseUrl}/download/${jobId}`, { responseType: 'blob' }).subscribe({
              next: (blob) => {
                this.triggerDownload(blob, d.filename ?? `${label}.xlsx`);
                setTimeout(() => this.exportProgressSubject.next(null), 3000);
                this.decrementPending();
                this.messageService.add({
                  key: TOAST_KEY, severity: 'success', summary: 'Excel descargado',
                  detail: `${(d.rows ?? 0).toLocaleString('es-CO')} filas · ${d.file_size_human ?? ''}`, life: 6000
                });
              },
              error: () => {
                // Fallback: abrir en nueva pestaña (el navegador manejará la descarga)
                window.open(`${baseUrl}/download/${jobId}`, '_blank');
                setTimeout(() => this.exportProgressSubject.next(null), 3000);
                this.decrementPending();
              }
            });
            return;
          }

          if (d.status === 'failed') {
            clearInterval(poll);
            this.exportProgressSubject.next(null);
            this.decrementPending();
            this.messageService.add({
              key: TOAST_KEY, severity: 'error', summary: 'Exportación fallida',
              detail: d.message ?? 'Error generando el Excel', life: 8000
            });
          }
        },
        error: () => {
          clearInterval(poll);
          this.exportProgressSubject.next(null);
          this.decrementPending();
        }
      });
    }, 2000); // Poll cada 2 segundos
    this.activePollInterval = poll;
  }

  private async exportarExcelLocal(options: FabricExportDesdeGrillaOptions): Promise<void> {
    const label = options.label ?? `${options.schema}.${options.viewName}`;
    const rowCount = options.rowData.length;
    const filename = `${options.schema}_${options.viewName}_${new Date().toISOString().slice(0, 10)}`;
    const sheetName = label.substring(0, 31);
    const columns = this.mapColumnDefs(options.columnDefs);
    const cargaCompleta = options.cargaCompleta !== false;

    this.pendingCountSubject.next(this.pendingCountSubject.value + 1);

    this.messageService.add({
      key: TOAST_KEY,
      severity: 'info',
      summary: 'Generando Excel',
      detail: cargaCompleta
        ? `Exportando ${rowCount.toLocaleString('es-CO')} filas desde la grilla...`
        : `Exportando ${rowCount.toLocaleString('es-CO')} filas cargadas hasta ahora...`,
      life: 4000
    });

    const reportHeader: ExcelReportHeader = {
      title: label,
      subtitle: [
        options.codigo,
        options.fuente,
        `${rowCount.toLocaleString('es-CO')} registros`,
        cargaCompleta ? undefined : '(carga parcial)'
      ].filter(Boolean).join(' · ')
    };

    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      await this.excelExportService.exportToExcel(
        options.rowData,
        columns,
        sheetName,
        filename,
        {
          headerBackgroundColor: 'FF1E6B45',
          headerFontColor: 'FFFFFFFF',
          applyBorders: true
        },
        reportHeader
      );

      this.messageService.add({
        key: TOAST_KEY,
        severity: 'success',
        summary: 'Excel listo',
        detail: `${rowCount.toLocaleString('es-CO')} filas exportadas: ${label}`,
        life: 6000
      });
    } catch {
      this.messageService.add({
        key: TOAST_KEY,
        severity: 'warn',
        summary: 'Exportación local fallida',
        detail: 'Intentando exportar desde Fabric...',
        life: 5000
      });
      this.decrementPending();
      this.exportarExcelEnSegundoPlano(options);
      return;
    }

    this.decrementPending();
  }

  private mapColumnDefs(columnDefs: ColDef[]): ExcelColumn[] {
    return columnDefs
      .filter((col): col is ColDef & { field: string } => !!col.field)
      .map(col => ({
        header: col.headerName || col.field,
        key: col.field,
        width: Math.max(12, Math.round((col.width || 120) / 7)),
        // Marcar como texto si el filtro es texto o si el cellDataType es 'text'
        // Esto preserva ceros iniciales en Excel (Placa, Código, etc.)
        isText: col.filter === 'agTextColumnFilter' || col.cellDataType === 'text'
      }));
  }

  private decrementPending(): void {
    this.pendingCountSubject.next(Math.max(0, this.pendingCountSubject.value - 1));
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.URL.revokeObjectURL(url);
  }
}
