import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ColDef } from 'ag-grid-community';
import {
  ExcelColumn,
  ExcelExportService,
  ExcelReportHeader
} from '../../../core/services/excel-export.service';

export interface ExcelOnlineResponse {
  success: boolean;
  message?: string;
  hint?: string;
  data?: {
    office_url: string;
    office_embed_url: string;
    file_url: string;
    expires_in: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class BiExcelOnlineService {
  private readonly apiUrl = '/bi/vistas/excel-online';

  constructor(
    private http: HttpClient,
    private excelExportService: ExcelExportService
  ) {}

  async abrirVistaEnExcelOnline(options: {
    datos: Record<string, unknown>[];
    columnDefs: ColDef[];
    nombreHoja: string;
    nombreArchivo: string;
    reportHeader?: ExcelReportHeader;
    filaEncabezados?: number;
  }): Promise<ExcelOnlineResponse> {
    const columns = this.mapColumns(options.columnDefs);
    const filaEncabezados = options.filaEncabezados ?? 6;

    const buffer = await this.excelExportService.buildExcelBuffer(
      options.datos,
      columns,
      options.nombreHoja,
      {
        headerBackgroundColor: 'FF1E6B45',
        headerFontColor: 'FFFFFFFF'
      },
      (worksheet) => {
        worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: filaEncabezados }];
        worksheet.autoFilter = {
          from: { row: filaEncabezados, column: 1 },
          to: { row: filaEncabezados, column: columns.length }
        };
      },
      options.reportHeader
    );

    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const formData = new FormData();
    formData.append('file', blob, `${options.nombreArchivo}.xlsx`);
    formData.append('file_name', options.nombreArchivo);

    return firstValueFrom(this.http.post<ExcelOnlineResponse>(this.apiUrl, formData));
  }

  private mapColumns(columnDefs: ColDef[]): ExcelColumn[] {
    return columnDefs
      .filter((col): col is ColDef & { field: string } => !!col.field)
      .map(col => ({
        header: col.headerName || col.field,
        key: col.field,
        width: Math.max(12, Math.round((col.width || 120) / 7))
      }));
  }
}
