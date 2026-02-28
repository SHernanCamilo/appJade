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
    customizeWorksheet?: (worksheet: ExcelJS.Worksheet) => void
  ): Promise<void> {
    // Configuración de estilos por defecto
    const defaultStyle: ExcelStyleConfig = {
      headerBackgroundColor: 'FF4472C4',
      headerFontColor: 'FFFFFFFF',
      headerFontSize: 11,
      headerHeight: 20,
      dataBorderColor: 'FFD3D3D3',
      applyBorders: true
    };

    const styles = { ...defaultStyle, ...styleConfig };

    // Crear libro de trabajo
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    // Configurar columnas
    worksheet.columns = columns;

    // Agregar datos
    data.forEach(row => {
      worksheet.addRow(row);
    });

    // Aplicar estilos a los encabezados
    this.applyHeaderStyles(worksheet, styles);

    // Aplicar bordes a las celdas de datos
    if (styles.applyBorders) {
      this.applyDataBorders(worksheet, styles.dataBorderColor!);
    }

    // Aplicar personalizaciones adicionales si se proporcionan
    if (customizeWorksheet) {
      customizeWorksheet(worksheet);
    }

    // Descargar archivo
    await this.downloadExcel(workbook, fileName);
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
    styleConfig?: ExcelStyleConfig
  ): Promise<void> {
    await this.exportToExcelWithCustomization(data, columns, sheetName, fileName, styleConfig);
  }

  /**
   * Aplicar estilos a la fila de encabezados
   */
  private applyHeaderStyles(worksheet: ExcelJS.Worksheet, styles: ExcelStyleConfig): void {
    const headerRow = worksheet.getRow(1);
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
  private applyDataBorders(worksheet: ExcelJS.Worksheet, borderColor: string): void {
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) { // Saltar la fila de encabezados
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
