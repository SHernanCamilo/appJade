import { Injectable } from '@angular/core';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import {
  formatearFechaCorta,
  formatearFechaLarga,
  formatearMonedaCop,
  numeroALetrasPesos
} from '../helpers/numero-a-letras.helper';

(pdfMake as any).vfs = (pdfFonts as any).vfs;

const JADEONE_LOGO = 'assets/media/logos/jade-one-horizontal-dark.png';

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
  observaciones?: string;
}

interface FilaConstancia {
  nroFact: string;
  ingreso: string;
  suc: string;
  fechaFact: string;
  valorFact: number;
  estado: string;
  grupoAtencion: string;
  entidad: string;
}

const COL_ALIASES: Record<keyof FilaConstancia | 'nombrePaciente' | 'identificacion', string[]> = {
  nroFact: ['NroDocumento', 'Nro_Documento', 'NumeroDocumento', 'NroFact', 'Nro_Fact', 'NumeroFactura', 'NoFactura', 'NroFactura', 'DocumentoFactura', 'Factura'],
  ingreso: ['Ingreso', 'NoIngreso', 'NumeroIngreso', 'NroIngreso', 'CodIngreso'],
  suc: ['Suc', 'Sucursal', 'CodSucursal', 'CodigoSucursal', 'Sede', 'CodSede'],
  fechaFact: ['FechaFactura', 'Fecha_Factura', 'FechaFact', 'Fecha_Fact'],
  valorFact: ['VrFactura', 'ValorFactura', 'Valor_Factura', 'Vr_Factura', 'ValorFact'],
  estado: ['EstadoDocumento', 'Estado_Documento', 'Estado'],
  grupoAtencion: ['GrupoAtencion', 'Grupo_Atencion', 'GrupoAten', 'GrupoAtencionNombre', 'NombreGrupoAtencion'],
  entidad: ['Entidad', 'NombreEntidad', 'EntidadNombre'],
  nombrePaciente: ['NombrePaciente', 'Nombre_Paciente', 'Nombre', 'Paciente', 'NombreCompleto'],
  identificacion: ['Identificacion', 'Identificación', 'Documento', 'DocumentoPaciente', 'CC']
};

@Injectable({ providedIn: 'root' })
export class ConstanciaSoatExportService {
  async exportar(options: ConstanciaSoatExportOptions): Promise<void> {
    if (!options.rows.length) {
      throw new Error('No hay registros para exportar.');
    }

    const filas = options.rows.map(row => this.mapFila(row));
    const nombrePaciente = String(
      this.pick(options.rows[0], COL_ALIASES.nombrePaciente) || 'PACIENTE'
    ).trim().toUpperCase();
    const identificacion = options.identificacion.trim();
    const total = filas.reduce((acc, f) => acc + (Number.isFinite(f.valorFact) ? f.valorFact : 0), 0);

    const empresaNombre = (options.empresaNombre || options.clinicaTexto || 'Clínica Medilaser S.A.')
      .replace(/\s*Sucursal\s+Florencia\s*/gi, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    const clinica = options.clinicaTexto
      ? options.clinicaTexto.replace(/\s*Sucursal\s+Florencia\s*/gi, ' ').replace(/\s{2,}/g, ' ').trim()
      : `La ${empresaNombre}`;
    const observaciones =
      options.observaciones ??
      'ANEXAR ESTE ESTADO DE CUENTA PARA UNA NUEVA SOLICITUD';
    const firmante = (options.firmanteNombre || '').trim().toUpperCase() || 'USUARIO';
    const cargo = (options.firmanteCargo || '').trim() || 'Sin cargo';

    const logoDataUrl = await this.resolveLogoDataUrl(options.logoBase64 || options.logoUrl);

    const tableBody = [
      [
        { text: 'Nro Fact', style: 'tableHeader', alignment: 'center' },
        { text: 'Ingreso', style: 'tableHeader', alignment: 'center' },
        { text: 'Suc.', style: 'tableHeader', alignment: 'center' },
        { text: 'Fecha Fact', style: 'tableHeader', alignment: 'center' },
        { text: 'Valor Fact', style: 'tableHeader', alignment: 'center' },
        { text: 'Estado', style: 'tableHeader', alignment: 'center' },
        { text: 'GrupoAtencion', style: 'tableHeader', alignment: 'center' },
        { text: 'Entidad', style: 'tableHeader', alignment: 'center' }
      ],
      ...filas.map((fila, index) => {
        const fillColor = index % 2 === 0 ? '#DDEBF7' : '#FFFFFF';
        return [
          { text: fila.nroFact, style: 'tableCell', alignment: 'center', fillColor },
          { text: fila.ingreso, style: 'tableCell', alignment: 'center', fillColor },
          { text: fila.suc, style: 'tableCell', alignment: 'center', fillColor },
          { text: fila.fechaFact, style: 'tableCell', alignment: 'center', fillColor },
          { text: formatearMonedaCop(fila.valorFact), style: 'tableCell', alignment: 'right', fillColor },
          { text: fila.estado, style: 'tableCell', alignment: 'center', fillColor },
          { text: fila.grupoAtencion, style: 'tableCell', alignment: 'left', fillColor },
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
      pageMargins: [40, 40, 40, 40],

      images: logoDataUrl ? { empresaLogo: logoDataUrl } : {},

      content: [
        ...headerContent,
        {
          text:
            `${clinica}, hace constar que el Señor (a) ${nombrePaciente}, ` +
            `identificado (a) con número ${identificacion} presenta unos valores facturados en nuestra base de datos así:`,
          style: 'body',
          margin: [0, 0, 0, 14]
        },
        {
          columns: [
            { text: 'Un total de:', style: 'label', width: 90 },
            { text: formatearMonedaCop(total), style: 'totalValue', width: '*' }
          ],
          margin: [0, 0, 0, 4]
        },
        {
          columns: [
            { text: 'Valor en letras:', style: 'label', width: 90 },
            { text: numeroALetrasPesos(total), style: 'totalLetras', width: '*' }
          ],
          margin: [0, 0, 0, 14]
        },
        {
          table: {
            headerRows: 1,
            widths: [52, 48, 28, 42, 52, 48, '*', '*'],
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
          text: `OBSERVACIONES: ${observaciones}`,
          style: 'observaciones',
          margin: [0, 0, 0, 12]
        },
        {
          text: 'Se expide a solicitud de quien se certifica en este documento,',
          style: 'body',
          margin: [0, 0, 0, 4]
        },
        {
          text: formatearFechaLarga(new Date()),
          style: 'fechaEmision',
          margin: [0, 0, 0, 28]
        },
        {
          stack: [
            { text: firmante, style: 'firmaNombre' },
            { text: cargo, style: 'firmaCargo' },
            { text: empresaNombre, style: 'firmaEmpresa' }
          ],
          alignment: 'center',
          width: 260
        }
      ],

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
        observaciones: {
          fontSize: 9,
          italics: true,
          color: '#333333'
        },
        fechaEmision: {
          fontSize: 10,
          bold: true,
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

  /** Logo de empresa; si falla o no existe, usa JadeOne. */
  private async resolveLogoDataUrl(logoUrl?: string | null): Promise<string | null> {
    const candidates = [
      ...(logoUrl ? [logoUrl.trim()] : []),
      JADEONE_LOGO
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
      nroFact: String(this.pick(row, COL_ALIASES.nroFact) ?? ''),
      ingreso: String(this.pick(row, COL_ALIASES.ingreso) ?? ''),
      suc: String(this.pick(row, COL_ALIASES.suc) ?? ''),
      fechaFact: formatearFechaCorta(this.pick(row, COL_ALIASES.fechaFact)),
      valorFact: this.toNumber(this.pick(row, COL_ALIASES.valorFact)),
      estado: String(this.pick(row, COL_ALIASES.estado) ?? ''),
      grupoAtencion: this.limpiarCodigoPrefijo(String(this.pick(row, COL_ALIASES.grupoAtencion) ?? '')),
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
