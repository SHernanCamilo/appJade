import { Injectable } from '@angular/core';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

(pdfMake as any).vfs = (pdfFonts as any).vfs;

export interface PdfColumn {
  header: string;
  key: string;
  width?: number | string; // '*' | 'auto' | number
}

export interface PdfReportConfig {
  title: string;
  subtitle?: string;
  fileName: string;
  columns: PdfColumn[];
  data: any[];
  stats?: { label: string; value: string | number }[];
  orientation?: 'portrait' | 'landscape';
}

// Colores corporativos
const COLORS = {
  primary:   '#1e3a5f',
  secondary: '#2d6a9f',
  accent:    '#3b9ddd',
  success:   '#27ae60',
  warning:   '#f39c12',
  danger:    '#e74c3c',
  light:     '#f4f6f9',
  white:     '#ffffff',
  gray:      '#7f8c8d',
  border:    '#dce3ea',
};

@Injectable({ providedIn: 'root' })
export class PdfExportService {

  async exportReport(config: PdfReportConfig): Promise<void> {
    const fecha = new Date().toLocaleDateString('es-CO', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
    const hora = new Date().toLocaleTimeString('es-CO', {
      hour: '2-digit', minute: '2-digit'
    });

    const docDefinition: any = {
      pageOrientation: config.orientation || 'landscape',
      pageMargins: [30, 30, 30, 40],
      pageSize: 'A4',

      footer: (currentPage: number, pageCount: number) => ({
        columns: [
          { text: `Generado: ${fecha} ${hora}`, style: 'footer', alignment: 'left' },
          { text: `Página ${currentPage} de ${pageCount}`, style: 'footer', alignment: 'right' }
        ],
        margin: [30, 10]
      }),

      content: [
        // ── Header ──────────────────────────────────────────────
        {
          columns: [
            {
              stack: [
                { text: config.title, style: 'reportTitle' },
                config.subtitle
                  ? { text: config.subtitle, style: 'reportSubtitle' }
                  : {},
                { text: fecha, style: 'reportDate' }
              ]
            },
            {
              stack: [
                { text: 'JadeOne', style: 'brandName' },
                { text: 'Sistema de Gestión', style: 'brandSub' }
              ],
              alignment: 'right'
            }
          ],
          margin: [0, 0, 0, 8]
        },

        // Línea divisoria
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 780, y2: 0, lineWidth: 2, lineColor: COLORS.primary }], margin: [0, 0, 0, 12] },

        // ── Tarjetas de estadísticas ─────────────────────────────
        ...(config.stats && config.stats.length > 0 ? [this.buildStatsRow(config.stats)] : []),

        // ── Tabla de datos ───────────────────────────────────────
        this.buildTable(config.columns, config.data),
      ],

      styles: {
        reportTitle:    { fontSize: 18, bold: true, color: COLORS.primary },
        reportSubtitle: { fontSize: 10, color: COLORS.gray, margin: [0, 2, 0, 0] },
        reportDate:     { fontSize: 9,  color: COLORS.gray, margin: [0, 2, 0, 0] },
        brandName:      { fontSize: 16, bold: true, color: COLORS.secondary },
        brandSub:       { fontSize: 8,  color: COLORS.gray },
        tableHeader:    { fontSize: 8,  bold: true, color: COLORS.white, fillColor: COLORS.primary },
        tableCell:      { fontSize: 7.5, color: '#2c3e50' },
        tableCellAlt:   { fontSize: 7.5, color: '#2c3e50', fillColor: COLORS.light },
        statValue:      { fontSize: 16, bold: true, color: COLORS.primary },
        statLabel:      { fontSize: 7,  color: COLORS.gray },
        footer:         { fontSize: 7,  color: COLORS.gray, italics: true },
      }
    };

    const fileName = `${config.fileName}_${new Date().toISOString().split('T')[0]}.pdf`;
    pdfMake.createPdf(docDefinition).download(fileName);
  }

  // ── Fila de tarjetas de estadísticas ──────────────────────────
  private buildStatsRow(stats: { label: string; value: string | number }[]): any {
    const cards = stats.map(s => ({
      stack: [
        { text: String(s.value), style: 'statValue', alignment: 'center' },
        { text: s.label,         style: 'statLabel',  alignment: 'center' }
      ],
      fillColor: COLORS.light,
      border: [false, false, false, false],
      margin: [6, 8, 6, 8]
    }));

    return {
      table: {
        widths: Array(stats.length).fill('*'),
        body: [cards]
      },
      layout: {
        hLineWidth: () => 0,
        vLineWidth: (i: number, node: any) => (i === 0 || i === node.table.widths.length ? 0 : 1),
        vLineColor: () => COLORS.border,
      },
      margin: [0, 0, 0, 14]
    };
  }

  // ── Tabla de datos ─────────────────────────────────────────────
  private buildTable(columns: PdfColumn[], data: any[]): any {
    const widths = columns.map(c => c.width ?? '*');

    const headerRow = columns.map(c => ({
      text: c.header.toUpperCase(),
      style: 'tableHeader',
      alignment: 'center',
      margin: [2, 5, 2, 5]
    }));

    const dataRows = data.map((row, i) =>
      columns.map(c => ({
        text: row[c.key] !== null && row[c.key] !== undefined ? String(row[c.key]) : '-',
        style: i % 2 === 0 ? 'tableCell' : 'tableCellAlt',
        fillColor: i % 2 !== 0 ? COLORS.light : COLORS.white,
        margin: [2, 4, 2, 4]
      }))
    );

    return {
      table: {
        headerRows: 1,
        widths,
        body: [headerRow, ...dataRows]
      },
      layout: {
        hLineWidth: (i: number) => (i === 0 || i === 1 ? 1 : 0.3),
        vLineWidth: () => 0.3,
        hLineColor: (i: number) => (i === 0 || i === 1 ? COLORS.primary : COLORS.border),
        vLineColor: () => COLORS.border,
        paddingLeft:   () => 4,
        paddingRight:  () => 4,
        paddingTop:    () => 3,
        paddingBottom: () => 3,
      }
    };
  }

  // ── Helper: color de concepto ──────────────────────────────────
  getConceptoColor(puntaje: number): string {
    const p = Number(puntaje);
    if (!p || p === 0)              return COLORS.danger;
    if (p > 0   && p < 60)         return COLORS.warning;
    if (p >= 60 && p < 100)        return COLORS.accent;
    if (p >= 100)                  return COLORS.success;
    return COLORS.gray;
  }

  getConceptoLabel(puntaje: number): string {
    const p = Number(puntaje);
    if (!p || p === 0)              return 'Obsoleto';
    if (p > 0   && p < 60)         return 'Potencializar';
    if (p >= 60 && p < 100)        return 'Funcional';
    if (p >= 100)                  return 'Óptimo';
    return 'Sin clasificar';
  }
}
