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
  /** Segundos que lleva ejecutando el job en Graph-Fabric (para la barra). */
  runningS?: number;
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
  private activePollInterval: ReturnType<typeof setInterval> | null = null;
  private activeJobId: string | null = null;
  /** Detiene el polling secuencial en curso (lo define pollExportStatusLegacy). */
  private stopActivePoll: (() => void) | null = null;

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
    // Detener el polling secuencial (setTimeout recursivo)
    if (this.stopActivePoll) {
      this.stopActivePoll();
      this.stopActivePoll = null;
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
    // Polling cada 3s — NO usar SSE porque bloquea un worker PHP-FPM
    // durante toda la duración del export (hasta 10 min por conexión).
    // Con polling cada request dura ~5ms y libera el worker inmediatamente.
    this.pollExportStatusLegacy(jobId, label, baseUrl);
  }

  /**
   * Polling ligero cada 3s — cada request dura ~5ms (lee de Redis y responde).
   * NO bloquea workers PHP-FPM (a diferencia del SSE que los ocupaba 10 min).
   */
  private pollExportStatusLegacy(jobId: string, label: string, baseUrl: string): void {
    this.activeJobId = jobId;

    // POLLING SECUENCIAL (no solapado): cada consulta se agenda SOLO cuando la
    // anterior respondio. Antes con setInterval se disparaba cada 3s sin esperar,
    // acumulando decenas de requests simultaneos que saturaban el backend.
    const POLL_MS  = 3000;
    const MAX_POLLS = 300; // ~15 min de techo duro
    let polls = 0;

    // Guarda para poder cancelar desde cancelExport()
    let cancelled = false;
    const timeoutRef = { id: null as ReturnType<typeof setTimeout> | null };

    const stop = (): void => {
      cancelled = true;
      if (timeoutRef.id) { clearTimeout(timeoutRef.id); timeoutRef.id = null; }
    };
    this.stopActivePoll = stop;

    const scheduleNext = (): void => {
      if (cancelled) return;
      if (++polls >= MAX_POLLS) {
        stop();
        this.exportProgressSubject.next(null);
        this.decrementPending();
        this.messageService.add({
          key: TOAST_KEY, severity: 'warn', summary: 'Exportacion muy lenta',
          detail: 'El servidor tardo demasiado. Intente con filtros para reducir los datos.', life: 8000
        });
        return;
      }
      timeoutRef.id = setTimeout(() => doPoll(), POLL_MS);
    };

    const doPoll = (): void => {
      if (cancelled) return;

      this.http.get<{ success: boolean; data: any }>(`${baseUrl}/status/${jobId}`).subscribe({
        next: (res) => {
          const d = res.data;

          if (d.status === 'processing' || d.status === 'pending') {
            this.exportProgressSubject.next({
              status: d.status,
              progress: d.progress ?? 0,
              rows: d.rows ?? 0,
              message: d.message ?? 'Procesando...',
              runningS: d.running_s ?? undefined
            });
            scheduleNext(); // agendar la siguiente SOLO ahora
            return;
          }

          if (d.status === 'completed') {
            stop();
            this.exportProgressSubject.next({
              status: 'completed',
              progress: 100,
              rows: d.rows ?? 0,
              message: 'Descarga lista',
              filename: d.filename,
              fileSize: d.file_size_human
            });

            // 3. Descargar como blob y CONVERTIR a .xlsx si viene crudo (ndjson.gz/csv.gz).
            //    Graph-Fabric devuelve DATOS comprimidos (ndjson/csv gzip), no un xlsx.
            //    Debemos descomprimir, parsear y armar el Excel. Antes se descargaba
            //    el .ndjson.gz crudo tal cual (usuario recibia un archivo inutil).
            this.http.get(`${baseUrl}/download/${jobId}`, { responseType: 'blob', observe: 'response' }).subscribe({
              next: async (resp) => {
                const blob   = resp.body as Blob;
                const fmt    = resp.headers.get('X-Export-Format') ?? d.format ?? '';
                const fname  = d.filename ?? `${label}.xlsx`;

                try {
                  await this.entregarComoExcel(blob, fmt, fname, label, options => options);
                  this.messageService.add({
                    key: TOAST_KEY, severity: 'success', summary: 'Excel descargado',
                    detail: `${(d.rows ?? 0).toLocaleString('es-CO')} filas`, life: 6000
                  });
                } catch (e) {
                  this.messageService.add({
                    key: TOAST_KEY, severity: 'error', summary: 'Error',
                    detail: 'No se pudo generar el Excel a partir de los datos.', life: 6000
                  });
                }
                setTimeout(() => this.exportProgressSubject.next(null), 3000);
                this.decrementPending();
              },
              error: () => {
                // Fallback: abrir con token en query param (window.open no envía headers)
                const token = localStorage.getItem('token') ?? '';
                window.open(`${baseUrl}/download/${jobId}?token=${encodeURIComponent(token)}`, '_blank');
                setTimeout(() => this.exportProgressSubject.next(null), 3000);
                this.decrementPending();
              }
            });
            return;
          }

          if (d.status === 'failed') {
            stop();
            this.exportProgressSubject.next(null);
            this.decrementPending();
            this.messageService.add({
              key: TOAST_KEY, severity: 'error', summary: 'Exportación fallida',
              detail: d.message ?? 'Error generando el Excel', life: 8000
            });
            return;
          }

          // Estado desconocido: seguir consultando
          scheduleNext();
        },
        error: () => {
          // Error de red puntual: reintentar unas veces antes de rendirse
          if (polls < 5) {
            scheduleNext();
            return;
          }
          stop();
          this.exportProgressSubject.next(null);
          this.decrementPending();
          this.messageService.add({
            key: TOAST_KEY, severity: 'error', summary: 'Error de conexion',
            detail: 'Se perdio la conexion con el servidor durante la exportacion.', life: 6000
          });
        }
      });
    };

    // Primera consulta inmediata (no esperar 3s)
    doPoll();
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

  /**
   * Entrega el archivo al usuario SIEMPRE como .xlsx.
   *
   * El backend puede devolver:
   *   - xlsx (ZIP)           → descargar directo
   *   - ndjson.gz / csv.gz   → descomprimir, parsear filas, armar .xlsx
   *   - ndjson / csv (plano) → parsear filas, armar .xlsx
   *
   * Graph-Fabric NUNCA devuelve el parquet: siempre datos comprimidos.
   * Esta funcion garantiza que el usuario reciba un Excel abrible, no un .gz crudo.
   */
  private async entregarComoExcel(
    blob: Blob, format: string, filename: string, label: string,
    _passthrough: (o: unknown) => unknown,
  ): Promise<void> {
    // Detectar por magic bytes (mas fiable que el header/extension)
    const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    const isZip  = head[0] === 0x50 && head[1] === 0x4B; // 'PK' = xlsx (ZIP)
    const isGzip = head[0] === 0x1F && head[1] === 0x8B; // gzip

    // Ya es un xlsx → descargar tal cual
    if (isZip || format === 'xlsx' || format === 'excel') {
      const safeName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
      this.triggerDownload(blob, safeName);
      return;
    }

    // Descomprimir si es gzip
    let text: string;
    if (isGzip || format.includes('gz')) {
      const ds = new DecompressionStream('gzip');
      const stream = blob.stream().pipeThrough(ds);
      text = await new Response(stream).text();
    } else {
      text = await blob.text();
    }

    // Parsear a filas segun formato (ndjson o csv)
    const rows = format.includes('ndjson') || text.trimStart().startsWith('{')
      ? this.parseNdjson(text)
      : this.parseCsv(text);

    if (rows.length === 0) {
      throw new Error('Sin datos');
    }

    // Normalizar fechas ISO: "1952-10-09T00:00:00" -> "1952-10-09" (o con hora si la tiene)
    this.normalizarFechas(rows);

    // Armar columnas desde la primera fila
    const cols: ExcelColumn[] = Object.keys(rows[0]).map(k => ({
      header: k, key: k, width: 16,
    }));

    const baseName = filename.replace(/\.(ndjson|csv)(\.gz)?$/i, '');
    await this.excelExportService.exportToExcel(
      rows, cols, label.substring(0, 31), baseName,
      { headerBackgroundColor: 'FF1E6B45', headerFontColor: 'FFFFFFFF', applyBorders: true },
      { title: label, subtitle: `${rows.length.toLocaleString('es-CO')} registros` },
    );
  }

  /**
   * Convierte valores de fecha ISO a formato legible antes de armar el Excel.
   *   "1952-10-09T00:00:00"       -> "1952-10-09"        (medianoche = solo fecha)
   *   "2026-08-27T14:30:00"       -> "2026-08-27 14:30"  (con hora real)
   *   "2026-08-27T14:30:00.000Z"  -> "2026-08-27 14:30"
   * No toca valores que no sean fechas ISO.
   */
  private normalizarFechas(rows: Record<string, unknown>[]): void {
    if (rows.length === 0) return;

    // Detectar columnas de fecha: revisar la primera fila con datos
    const isoRe = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;
    const sample = rows[0];
    const dateCols: string[] = [];
    for (const [key, val] of Object.entries(sample)) {
      if (typeof val === 'string' && isoRe.test(val)) {
        dateCols.push(key);
      }
    }
    if (dateCols.length === 0) return;

    for (const row of rows) {
      for (const col of dateCols) {
        const v = row[col];
        if (typeof v === 'string' && isoRe.test(v)) {
          row[col] = this.formatIsoDate(v);
        }
      }
    }
  }

  /** Formatea una fecha ISO: quita la T; si es medianoche deja solo la fecha. */
  private formatIsoDate(iso: string): string {
    // Separar fecha y hora
    const [datePart, timePartRaw] = iso.split('T');
    if (!timePartRaw) return datePart;

    // Quitar milisegundos y zona horaria
    const timePart = timePartRaw.replace(/(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/, '');
    const hhmm = timePart.slice(0, 5); // HH:MM

    // Medianoche -> solo fecha (típico de campos DATE sin hora)
    if (hhmm === '00:00' || timePart === '00:00:00') {
      return datePart;
    }
    return `${datePart} ${hhmm}`;
  }

  /** Parsea NDJSON (una fila JSON por linea). */
  private parseNdjson(text: string): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = [];
    for (const line of text.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      try { out.push(JSON.parse(t)); } catch { /* saltar linea corrupta */ }
    }
    return out;
  }

  /** Parsea CSV con soporte BOM, delimitador ; o , y comillas. */
  private parseCsv(text: string): Record<string, unknown>[] {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    if (text.startsWith('sep=')) text = text.slice(text.indexOf('\n') + 1);

    const lines = text.split('\n');
    if (lines.length < 2) return [];

    const firstLine = lines[0];
    const delim = firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';

    const parseLine = (line: string): string[] => {
      const res: string[] = []; let cur = ''; let q = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
        else if (ch === delim && !q) { res.push(cur); cur = ''; }
        else cur += ch;
      }
      res.push(cur);
      return res;
    };

    const headers = parseLine(lines[0]);
    const out: Record<string, unknown>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].replace(/\r$/, '');
      if (!line.trim()) continue;
      const vals = parseLine(line);
      const row: Record<string, unknown> = {};
      headers.forEach((h, j) => { row[h] = vals[j] ?? ''; });
      out.push(row);
    }
    return out;
  }
}
