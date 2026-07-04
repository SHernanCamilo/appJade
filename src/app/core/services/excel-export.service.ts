import { Injectable } from '@angular/core';
import * as ExcelJS from 'exceljs';

export interface ExcelColumn {
  header: string;
  key: string;
  width: number;
}

export interface ExcelStyleConfig {
  headerBackgroundColor?: string;
  headerFontColor?: string;
  headerFontSize?: number;
  headerHeight?: number;
  dataBorderColor?: string;
  applyBorders?: boolean;
}

export interface ExcelReportHeader {
  title: string;
  subtitle?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ExcelExportService {

  constructor() { }

  /**
   * Exportar datos a Excel con estilos personalizados y devolver el worksheet para personalizaciones adicionales
   * @param data Array de objetos con los datos a exportar
   * @param columns Configuración de columnas
   * @param sheetName Nombre de la hoja
   * @param fileName Nombre del archivo (sin extensión)
   * @param styleConfig Configuración de estilos (opcional)
   * @param customizeWorksheet Función opcional para personalizar el worksheet antes de descargar
   */
  async exportToExcelWithCustomization(
    data: any[],
    columns: ExcelColumn[],
    sheetName: string,
    fileName: string,
    styleConfig?: ExcelStyleConfig,
    customizeWorksheet?: (worksheet: ExcelJS.Worksheet) => void,
    reportHeader?: ExcelReportHeader
  ): Promise<void> {
    const workbook = await this.buildWorkbook(
      data,
      columns,
      sheetName,
      styleConfig,
      customizeWorksheet,
      reportHeader
    );

    await this.downloadExcel(workbook, fileName);
  }

  /**
   * Genera el buffer del Excel sin descargarlo (útil para Excel Online)
   */
  async buildExcelBuffer(
    data: any[],
    columns: ExcelColumn[],
    sheetName: string,
    styleConfig?: ExcelStyleConfig,
    customizeWorksheet?: (worksheet: ExcelJS.Worksheet) => void,
    reportHeader?: ExcelReportHeader
  ): Promise<ArrayBuffer> {
    const workbook = await this.buildWorkbook(
      data,
      columns,
      sheetName,
      styleConfig,
      customizeWorksheet,
      reportHeader
    );

    return workbook.xlsx.writeBuffer() as Promise<ArrayBuffer>;
  }

  private async buildWorkbook(
    data: any[],
    columns: ExcelColumn[],
    sheetName: string,
    styleConfig?: ExcelStyleConfig,
    customizeWorksheet?: (worksheet: ExcelJS.Worksheet) => void,
    reportHeader?: ExcelReportHeader
  ): Promise<ExcelJS.Workbook> {
    const defaultStyle: ExcelStyleConfig = {
      headerBackgroundColor: 'FF4472C4',
      headerFontColor: 'FFFFFFFF',
      headerFontSize: 11,
      headerHeight: 20,
      dataBorderColor: 'FFD3D3D3',
      applyBorders: true
    };

    const styles = { ...defaultStyle, ...styleConfig };

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    // Número de filas que ocupa la cabecera del reporte
    const headerRowCount = reportHeader ? 5 : 0; // título, subtítulo, fecha+marca, separador, vacío

    if (reportHeader) {
      this.addReportHeader(worksheet, reportHeader, columns.length);
    }

    // Configurar anchos de columnas sin resetear filas existentes
    columns.forEach((col, i) => {
      const wsCol = worksheet.getColumn(i + 1);
      wsCol.key = col.key;
      wsCol.width = col.width;
    });

    // Agregar fila de encabezados de columna en la posición correcta
    const colHeaderRow = worksheet.getRow(headerRowCount + 1);
    columns.forEach((col, i) => {
      colHeaderRow.getCell(i + 1).value = col.header;
    });
    colHeaderRow.commit();

    // Agregar datos
    data.forEach(row => {
      const dataRow = worksheet.addRow(columns.map(col => row[col.key]));
      dataRow.commit();
    });

    this.applyHeaderStyles(worksheet, styles, headerRowCount + 1);

    if (styles.applyBorders) {
      this.applyDataBorders(worksheet, styles.dataBorderColor!, headerRowCount + 1);
    }

    if (customizeWorksheet) {
      customizeWorksheet(worksheet);
    }

    return workbook;
  }

  /**
   * Exportar datos a Excel con estilos personalizados
   * @param data Array de objetos con los datos a exportar
   * @param columns Configuración de columnas
   * @param sheetName Nombre de la hoja
   * @param fileName Nombre del archivo (sin extensión)
   * @param styleConfig Configuración de estilos (opcional)
   */
  async exportToExcel(
    data: any[],
    columns: ExcelColumn[],
    sheetName: string,
    fileName: string,
    styleConfig?: ExcelStyleConfig,
    reportHeader?: ExcelReportHeader
  ): Promise<void> {
    await this.exportToExcelWithCustomization(data, columns, sheetName, fileName, styleConfig, undefined, reportHeader);
  }

  /**
   * Agregar cabecera del reporte (título, subtítulo, fecha, marca)
   */
  private addReportHeader(worksheet: ExcelJS.Worksheet, header: ExcelReportHeader, colCount: number): void {
    const fecha = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
    const PRIMARY   = 'FF1E3A5F';
    const SECONDARY = 'FF2D6A9F';
    const GRAY      = 'FF7F8C8D';
    const WHITE     = 'FFFFFFFF';

    // Fila 1: Título (izquierda) + "JadeOne" (derecha)
    const row1 = worksheet.getRow(1);
    row1.height = 28;
    const titleCell = row1.getCell(1);
    titleCell.value = header.title;
    titleCell.font = { bold: true, size: 16, color: { argb: PRIMARY } };
    titleCell.alignment = { vertical: 'middle' };

    const brandCell = row1.getCell(colCount);
    brandCell.value = 'JadeOne';
    brandCell.font = { bold: true, size: 14, color: { argb: SECONDARY } };
    brandCell.alignment = { vertical: 'middle', horizontal: 'right' };
    row1.commit();

    // Fila 2: Subtítulo (izquierda) + "Sistema de Gestión" (derecha)
    const row2 = worksheet.getRow(2);
    row2.height = 16;
    const subtitleCell = row2.getCell(1);
    subtitleCell.value = header.subtitle || '';
    subtitleCell.font = { size: 9, color: { argb: GRAY } };
    subtitleCell.alignment = { vertical: 'middle' };

    const brandSubCell = row2.getCell(colCount);
    brandSubCell.value = 'Sistema de Gestión';
    brandSubCell.font = { size: 8, color: { argb: GRAY } };
    brandSubCell.alignment = { vertical: 'middle', horizontal: 'right' };
    row2.commit();

    // Fila 3: Fecha generación
    const row3 = worksheet.getRow(3);
    row3.height = 14;
    const dateCell = row3.getCell(1);
    dateCell.value = `Generado: ${fecha}`;
    dateCell.font = { size: 8, color: { argb: GRAY }, italic: true };
    dateCell.alignment = { vertical: 'middle' };
    row3.commit();

    // Fila 4: Línea separadora (fondo azul oscuro)
    const row4 = worksheet.getRow(4);
    row4.height = 3;
    for (let i = 1; i <= colCount; i++) {
      const cell = row4.getCell(i);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIMARY } };
    }
    row4.commit();

    // Fila 5: Espacio vacío
    worksheet.getRow(5).height = 4;
    worksheet.getRow(5).commit();
  }

  /**
   * Aplicar estilos a la fila de encabezados
   */
  private applyHeaderStyles(worksheet: ExcelJS.Worksheet, styles: ExcelStyleConfig, headerRowNumber: number = 1): void {
    const headerRow = worksheet.getRow(headerRowNumber);
    headerRow.height = styles.headerHeight || 20;
    headerRow.font = {
      bold: true,
      color: { argb: styles.headerFontColor || 'FFFFFFFF' },
      size: styles.headerFontSize || 11
    };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: styles.headerBackgroundColor || 'FF4472C4' }
    };
    headerRow.alignment = {
      vertical: 'middle',
      horizontal: 'center'
    };

    // Aplicar bordes a los encabezados
    headerRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
    });
  }

  /**
   * Aplicar bordes a todas las celdas de datos
   */
  private applyDataBorders(worksheet: ExcelJS.Worksheet, borderColor: string, startFromRow: number = 1): void {
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > startFromRow) {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: borderColor } },
            left: { style: 'thin', color: { argb: borderColor } },
            bottom: { style: 'thin', color: { argb: borderColor } },
            right: { style: 'thin', color: { argb: borderColor } }
          };
        });
      }
    });
  }

  /**
   * Descargar el archivo Excel
   */
  private async downloadExcel(workbook: ExcelJS.Workbook, fileName: string): Promise<void> {
    const fecha = new Date().toISOString().split('T')[0];
    const fullFileName = `${fileName}_${fecha}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fullFileName;
    link.click();

    // Limpiar
    URL.revokeObjectURL(link.href);
  }

  /**
   * Exportar datos simples a Excel (sin estilos personalizados)
   * @param data Array de objetos con los datos
   * @param fileName Nombre del archivo
   */
  async exportSimple(data: any[], fileName: string): Promise<void> {
    if (!data || data.length === 0) {
      throw new Error('No hay datos para exportar');
    }

    // Generar columnas automáticamente desde las claves del primer objeto
    const columns: ExcelColumn[] = Object.keys(data[0]).map(key => ({
      header: key.toUpperCase().replace(/_/g, ' '),
      key: key,
      width: 20
    }));

    await this.exportToExcel(data, columns, 'Datos', fileName);
  }

  /**
   * Aplicar formato condicional basado en valores
   * @param worksheet Hoja de trabajo
   * @param columnKey Clave de la columna
   * @param rules Reglas de formato condicional
   */
  applyConditionalFormatting(
    worksheet: ExcelJS.Worksheet,
    columnKey: string,
    rules: { condition: (value: any) => boolean; style: Partial<ExcelJS.Style> }[]
  ): void {
    const columnIndex = worksheet.columns.findIndex(col => col.key === columnKey);
    if (columnIndex === -1) return;

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) { // Saltar encabezados
        const cell = row.getCell(columnIndex + 1);
        const value = cell.value;

        for (const rule of rules) {
          if (rule.condition(value)) {
            Object.assign(cell, rule.style);
            break;
          }
        }
      }
    });
  }

  /**
   * Agregar filtros automáticos a la primera fila
   */
  addAutoFilter(worksheet: ExcelJS.Worksheet): void {
    const lastColumn = worksheet.columns.length;
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: lastColumn }
    };
  }

  /**
   * Congelar la primera fila (encabezados)
   */
  freezeHeader(worksheet: ExcelJS.Worksheet): void {
    worksheet.views = [
      { state: 'frozen', xSplit: 0, ySplit: 1 }
    ];
  }
}
