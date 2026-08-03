import { Injectable } from '@angular/core';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import {
  formatearFechaCorta,
  formatearMonedaCop,
  numeroALetrasPesos
} from '../helpers/numero-a-letras.helper';

(pdfMake as any).vfs = (pdfFonts as any).vfs;

const MEDILASER_LOGO =
  'https://ticketprocess.medilaser.com.co/assets/images/Logo-Medilaser-grande.png';
const MEDILASER_EMPRESA = 'Clínica Medilaser SAS';

export interface ConstanciaSoatExportOptions {
  identificacion: string;
  rows: Record<string, unknown>[];
  firmanteNombre?: string;
  firmanteCargo?: string;
  clinicaTexto?: string;
  empresaNombre?: string;
  /** URL del logo (se intenta cargar en el cliente). */
  logoUrl?: string | null;
  /** Preferido: data URL ya resuelta desde backend (evita CORS). */
  logoBase64?: string | null;
  ciudadEmision?: string;
  /** Valor de atenciones facturadas en otras IPS (opcional). */
  valorOtrasIps?: number | null;
}

interface FilaConstancia {
  nroPoliza: string;
  nroFact: string;
  ingreso: string;
  suc: string;
  fechaFact: string;
  valorFact: number;
  entidad: string;
}

const COL_ALIASES: Record<keyof FilaConstancia | 'nombrePaciente' | 'identificacion', string[]> = {
  nroPoliza: ['NumeroPolizaSOAT', 'Numero_Poliza_SOAT', 'NroPolizaSOAT', 'NroPoliza', 'NumeroPoliza', 'PolizaSOAT', 'Poliza'],
  nroFact: ['NroDocumento', 'Nro_Documento', 'NumeroDocumento', 'NroFact', 'Nro_Fact', 'NumeroFactura', 'NoFactura', 'NroFactura', 'DocumentoFactura', 'Factura'],
  ingreso: ['Ingreso', 'NoIngreso', 'NumeroIngreso', 'NroIngreso', 'CodIngreso'],
  suc: ['Suc', 'Sucursal', 'CodSucursal', 'CodigoSucursal', 'Sede', 'CodSede'],
  fechaFact: ['FechaFactura', 'Fecha_Factura', 'FechaFact', 'Fecha_Fact'],
  valorFact: ['VrFactura', 'ValorFactura', 'Valor_Factura', 'Vr_Factura', 'ValorFact'],
  entidad: ['Entidad', 'NombreEntidad', 'EntidadNombre'],
  nombrePaciente: ['NombrePaciente', 'Nombre_Paciente', 'Nombre', 'Paciente', 'NombreCompleto'],
  identificacion: ['Identificacion', 'Identificación', 'Documento', 'DocumentoPaciente', 'CC']
};

@Injectable({ providedIn: 'root' })
export class ConstanciaSoatExportService {
  /** Números de póliza únicos presentes en los registros. */
  listarPolizas(rows: Record<string, unknown>[]): string[] {
    const set = new Set<string>();
    for (const row of rows) {
      const poliza = String(this.pick(row, COL_ALIASES.nroPoliza) ?? '').trim();
      if (poliza) {
        set.add(poliza);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
  }

  /** Filtra registros por número de póliza SOAT. */
  filtrarPorPoliza(rows: Record<string, unknown>[], nroPoliza: string): Record<string, unknown>[] {
    const target = nroPoliza.trim();
    if (!target) {
      return [];
    }
    return rows.filter(row => String(this.pick(row, COL_ALIASES.nroPoliza) ?? '').trim() === target);
  }

  async exportar(options: ConstanciaSoatExportOptions): Promise<void> {
    if (!options.rows.length) {
      throw new Error('No hay registros para exportar.');
    }

    const filas = options.rows.map(row => this.mapFila(row));
    const nombrePaciente = String(
      this.pick(options.rows[0], COL_ALIASES.nombrePaciente) || 'PACIENTE'
    ).trim().toUpperCase();
    const identificacion = options.identificacion.trim();
    const totalLocal = filas.reduce((acc, f) => acc + (Number.isFinite(f.valorFact) ? f.valorFact : 0), 0);
    const valorOtrasIps = Math.max(0, Number(options.valorOtrasIps) || 0);
    const totalFacturado = totalLocal + valorOtrasIps;

    const empresaNombre = MEDILASER_EMPRESA;
    const clinica = empresaNombre;
    const firmante = (options.firmanteNombre || '').trim().toUpperCase() || 'USUARIO';
    const cargo = (options.firmanteCargo || '').trim() || 'Sin cargo';

    const ahora = new Date();
    const dia = ahora.getDate();
    const mes = ahora.toLocaleDateString('es-CO', { month: 'long' });
    const anio = ahora.getFullYear();
    const hora = ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
    const textoExpedicion =
      `La presente constancia se expide a los ${dia} días del mes de ${mes} de ${anio} a las ${hora}`;

    const logoDataUrl = await this.resolveLogoDataUrl(options.logoBase64 || options.logoUrl);

    const cellFija = (text: string, fillColor: string, alignment: 'left' | 'center' | 'right' = 'center') => ({
      text,
      style: 'tableCell',
      alignment,
      fillColor,
      noWrap: true
    });

    const tableBody = [
      [
        { text: 'Numero Poliza', style: 'tableHeader', alignment: 'center' },
        { text: 'Numero Factura', style: 'tableHeader', alignment: 'center' },
        { text: 'Ingreso', style: 'tableHeader', alignment: 'center' },
        { text: 'Sucursal', style: 'tableHeader', alignment: 'center' },
        { text: 'Fecha Factura', style: 'tableHeader', alignment: 'center' },
        { text: 'Valor Factura', style: 'tableHeader', alignment: 'center' },
        { text: 'Entidad', style: 'tableHeader', alignment: 'center' }
      ],
      ...filas.map((fila, index) => {
        const fillColor = index % 2 === 0 ? '#DDEBF7' : '#FFFFFF';
        return [
          cellFija(fila.nroPoliza, fillColor),
          cellFija(fila.nroFact, fillColor),
          cellFija(fila.ingreso, fillColor),
          cellFija(fila.suc, fillColor),
          cellFija(fila.fechaFact, fillColor),
          cellFija(formatearMonedaCop(fila.valorFact, false), fillColor, 'right'),
          { text: fila.entidad, style: 'tableCell', alignment: 'left', fillColor }
        ];
      })
    ];

    const headerContent: any[] = logoDataUrl
      ? [
          {
            columns: [
              {
                width: 110,
                image: 'empresaLogo',
                fit: [110, 48],
                margin: [0, 0, 12, 0]
              },
              {
                width: '*',
                text: 'CONSTANCIA DE VALORES FACTURADOS A USUARIOS SOAT',
                style: 'title',
                margin: [0, 12, 0, 0]
              }
            ],
            margin: [0, 0, 0, 16]
          }
        ]
      : [
          {
            text: 'CONSTANCIA DE VALORES FACTURADOS A USUARIOS SOAT',
            style: 'title',
            margin: [0, 0, 0, 16]
          }
        ];

    const docDefinition: any = {
      pageSize: 'LETTER',
      pageOrientation: 'portrait',
      // Margen inferior para firma (última página) y número de hoja
      pageMargins: [40, 40, 40, 120],

      images: logoDataUrl ? { empresaLogo: logoDataUrl } : {},

      content: [
        ...headerContent,
        {
          text:
            `${clinica}, hace constar que el usuario (a) ${nombrePaciente}, ` +
            `identificado (a) con el No. ${identificacion} presenta las siguientes atenciones facturadas en nuestra base de datos así:`,
          style: 'body',
          margin: [0, 0, 0, 14]
        },
        {
          table: {
            headerRows: 1,
            // LETTER útil ~532pt: Numero Poliza primero; Entidad toma el resto
            widths: [72, 70, 52, 50, 62, 62, '*'],
            body: tableBody
          },
          layout: {
            hLineWidth: () => 0.6,
            vLineWidth: () => 0.6,
            hLineColor: () => '#8FAADC',
            vLineColor: () => '#8FAADC'
          },
          margin: [0, 0, 0, 14]
        },
        {
          columns: [
            { text: 'Para un total de:', style: 'resumenPie', width: 110 },
            { text: formatearMonedaCop(totalLocal, false), style: 'resumenPie', width: '*' }
          ],
          margin: [0, 0, 0, valorOtrasIps > 0 ? 8 : 4]
        },
        ...(valorOtrasIps > 0
          ? [
              {
                text:
                  `Adicionalmente, presentó atenciones facturadas en otras IPS por valor de: ${formatearMonedaCop(valorOtrasIps, false)}`,
                style: 'resumenPie',
                margin: [0, 0, 0, 8]
              },
              {
                columns: [
                  { text: 'Total Facturado:', style: 'resumenPie', width: 110 },
                  { text: formatearMonedaCop(totalFacturado, false), style: 'resumenPie', width: '*' }
                ],
                margin: [0, 0, 0, 4]
              }
            ]
          : []),
        {
          columns: [
            { text: 'Valor en letras:', style: 'resumenPie', width: 110 },
            { text: numeroALetrasPesos(totalFacturado), style: 'resumenPie', width: '*' }
          ],
          margin: [0, 0, 0, 14]
        },
        {
          text: textoExpedicion,
          style: 'resumenPie',
          margin: [0, 0, 0, 0]
        }
      ],

      footer: (currentPage: number, pageCount: number) => {
        const esUltima = currentPage === pageCount;
        const stack: any[] = [];

        if (esUltima) {
          stack.push({
            stack: [
              { text: '________________________________', style: 'firmaLinea', margin: [0, 0, 0, 6] },
              { text: firmante, style: 'firmaNombre' },
              { text: cargo, style: 'firmaCargo' },
              { text: empresaNombre, style: 'firmaEmpresa' }
            ],
            alignment: 'center'
          });
        }

        if (pageCount > 1) {
          stack.push({
            text: `Página ${currentPage} de ${pageCount}`,
            alignment: 'center',
            fontSize: 8,
            color: '#595959',
            margin: [0, esUltima ? 10 : 4, 0, 0]
          });
        }

        if (!stack.length) {
          return { text: '' };
        }

        return {
          margin: [40, esUltima ? 16 : 20, 40, 20],
          stack
        };
      },

      styles: {
        title: {
          fontSize: 13,
          bold: true,
          alignment: 'center',
          color: '#1F4E79'
        },
        body: {
          fontSize: 10,
          alignment: 'justify',
          color: '#222222'
        },
        resumenPie: {
          fontSize: 10,
          color: '#000000'
        },
        label: {
          fontSize: 10,
          bold: true,
          color: '#222222'
        },
        totalValue: {
          fontSize: 12,
          bold: true,
          color: '#1F4E79'
        },
        totalLetras: {
          fontSize: 9,
          bold: true,
          color: '#222222'
        },
        tableHeader: {
          fontSize: 8,
          bold: true,
          color: '#FFFFFF',
          fillColor: '#2F75B5'
        },
        tableCell: {
          fontSize: 8,
          color: '#222222'
        },
        firmaLinea: {
          fontSize: 10,
          color: '#222222'
        },
        firmaNombre: {
          fontSize: 11,
          bold: true,
          color: '#222222'
        },
        firmaCargo: {
          fontSize: 9,
          color: '#333333',
          margin: [0, 2, 0, 0]
        },
        firmaEmpresa: {
          fontSize: 8,
          color: '#595959',
          margin: [0, 2, 0, 0]
        }
      },

      defaultStyle: {
        font: 'Roboto'
      }
    };

    const fecha = new Date().toISOString().split('T')[0];
    const fileName = `Constancia_SOAT_${identificacion}_${fecha}.pdf`;
    pdfMake.createPdf(docDefinition).download(fileName);
  }

  /** Logo de Clínica Medilaser; si falla, usa URL fija de Medilaser. */
  private async resolveLogoDataUrl(logoUrl?: string | null): Promise<string | null> {
    const candidates = [
      ...(logoUrl ? [logoUrl.trim()] : []),
      MEDILASER_LOGO
    ].filter(Boolean);

    for (const candidate of candidates) {
      const dataUrl = await this.loadImageAsDataUrl(candidate);
      if (dataUrl) {
        return dataUrl;
      }
    }

    return null;
  }

  private async loadImageAsDataUrl(url: string): Promise<string | null> {
    try {
      if (url.startsWith('data:image')) {
        return url;
      }

      const absolute = /^https?:\/\//i.test(url)
        ? url
        : `${window.location.origin}/${url.replace(/^\//, '')}`;

      const response = await fetch(absolute, {
        mode: 'cors',
        credentials: /^https?:\/\//i.test(url) ? 'omit' : 'same-origin'
      });

      if (!response.ok) {
        return null;
      }

      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) {
        return null;
      }

      return await this.blobToDataUrl(blob);
    } catch {
      return null;
    }
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  private mapFila(row: Record<string, unknown>): FilaConstancia {
    return {
      nroPoliza: String(this.pick(row, COL_ALIASES.nroPoliza) ?? ''),
      nroFact: String(this.pick(row, COL_ALIASES.nroFact) ?? ''),
      ingreso: String(this.pick(row, COL_ALIASES.ingreso) ?? ''),
      suc: String(this.pick(row, COL_ALIASES.suc) ?? ''),
      fechaFact: formatearFechaCorta(this.pick(row, COL_ALIASES.fechaFact)),
      valorFact: this.toNumber(this.pick(row, COL_ALIASES.valorFact)),
      entidad: this.limpiarCodigoPrefijo(String(this.pick(row, COL_ALIASES.entidad) ?? ''))
    };
  }

  /** Quita prefijos tipo "FLA00026 - DESCRIPCION" → "DESCRIPCION". */
  private limpiarCodigoPrefijo(value: string): string {
    const trimmed = value.trim();
    const match = trimmed.match(/^[A-Z0-9._-]+\s*[-–]\s*(.+)$/i);
    return match ? match[1].trim() : trimmed;
  }

  private toNumber(value: unknown): number {
    if (typeof value === 'number') return value;
    if (value == null || value === '') return 0;

    let s = String(value).trim().replace(/\$/g, '').replace(/\s/g, '');
    if (s.includes(',') && s.includes('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (s.includes(',')) {
      s = s.replace(',', '.');
    }

    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  private pick(row: Record<string, unknown>, aliases: string[]): unknown {
    const entries = Object.entries(row);
    const normalized = new Map(
      entries.map(([k, v]) => [k.toLowerCase().replace(/[_\s]/g, ''), { key: k, value: v }])
    );

    for (const alias of aliases) {
      const key = alias.toLowerCase().replace(/[_\s]/g, '');
      const exact = normalized.get(key);
      if (exact && exact.value != null && exact.value !== '') {
        return exact.value;
      }
    }

    for (const alias of aliases) {
      const key = alias.toLowerCase().replace(/[_\s]/g, '');
      for (const [norm, item] of normalized) {
        if ((norm.includes(key) || key.includes(norm)) && item.value != null && item.value !== '') {
          return item.value;
        }
      }
    }

    return null;
  }
}
