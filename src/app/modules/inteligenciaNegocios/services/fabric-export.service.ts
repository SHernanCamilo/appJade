import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ColDef } from 'ag-grid-community';
import {
  ExcelColumn,
  ExcelExportService,
  ExcelReportHeader
} from '../../../core/services/excel-export.service';
import { VistasService } from './vistas.service';

const TOAST_KEY = 'global-export';

export interface FabricExportOptions {
  schema: string;
  viewName: string;
  label?: string;
  max_rows?: number;
  filters?: Record<string, string>;
  sort_col?: string;
  sort_dir?: 'asc' | 'desc';
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

  constructor(
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

  exportarExcelEnSegundoPlano(options: FabricExportOptions): void {
    const label = options.label ?? `${options.schema}.${options.viewName}`;
    const filename = `${options.schema}_${options.viewName}_${new Date().toISOString().slice(0, 10)}.xlsx`;

    this.pendingCountSubject.next(this.pendingCountSubject.value + 1);

    this.messageService.add({
      key: TOAST_KEY,
      severity: 'info',
      summary: 'Exportación en segundo plano',
      detail: `Consultando Fabric para ${label}. Puede seguir navegando.`,
      life: 5000
    });

    this.vistasService.exportExcel(options.schema, options.viewName, {
      max_rows: options.max_rows ?? 50000,
      filters: options.filters,
      sort_col: options.sort_col,
      sort_dir: options.sort_dir
    }).subscribe({
      next: (blob) => {
        this.triggerDownload(blob, filename);
        this.messageService.add({
          key: TOAST_KEY,
          severity: 'success',
          summary: 'Excel listo',
          detail: `Descarga iniciada: ${label}`,
          life: 6000
        });
        this.decrementPending();
      },
      error: (err) => {
        this.messageService.add({
          key: TOAST_KEY,
          severity: 'error',
          summary: 'Error en exportación',
          detail: err?.error?.message || `No se pudo exportar ${label} desde Fabric.`,
          life: 8000
        });
        this.decrementPending();
      }
    });
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
        width: Math.max(12, Math.round((col.width || 120) / 7))
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
