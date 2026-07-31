import { Injectable } from '@angular/core';
import * as ExcelJS from 'exceljs';

export interface PerfilExportPaciente {
  nombre: string;
  edad: string;
  sexo: string;
  peso: string;
  historia: string;
  ingreso: string;
  diagnostico: string;
  servicio: string;
  cama: string;
  alergias: '' | 'si' | 'no' | 'no_esp';
  alergiasCual: string;
  mesReferencia: Date;
}

export interface PerfilExportMedicamento {
  cuenta: string;
  producto: string;
  concentracion: string;
  presentacion: string;
  dosis: string;
  unidad: string;
  viaAdm: string;
  frecuencia: string;
  unidadFrecuencia: string;
  peso: string;
  dias: Record<number, string>;
}

export interface PerfilExportOptions {
  paciente: PerfilExportPaciente;
  medicamentos: PerfilExportMedicamento[];
  diasDelMes: number[];
  documento: string;
  empresaNombre?: string;
  logoDataUrl?: string | null;
}

interface Segmento {
  text: string;
  weight: number;
  label?: boolean;
  fill?: string;
  align?: 'left' | 'center';
}

const COLOR_BORDE = 'FF1F2937';
const COLOR_HEADER = 'FF002060';
const COLOR_SECCION = 'FF002060';
const COLOR_AMARILLO = 'FFFDE047';
const COLOR_LABEL = 'FFF3F4F6';

const MEDS_HEADERS = [
  'Cuenta',
  'Producto',
  'Concentracion',
  'Presentacion',
  'Dosis',
  'Unidad',
  'ViaAdm',
  'Frecuencia',
  'UnidadFrecuencia',
  'Peso'
];

@Injectable({ providedIn: 'root' })
export class PerfilFarmacoterapeuticoExportService {
  private readonly thin: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: COLOR_BORDE } };

  private get borde(): Partial<ExcelJS.Borders> {
    return { top: this.thin, left: this.thin, bottom: this.thin, right: this.thin };
  }

  async exportar(options: PerfilExportOptions): Promise<string> {
    const { paciente, medicamentos, diasDelMes, documento, empresaNombre, logoDataUrl } = options;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = empresaNombre || 'Clínica Medilaser S.A.S.';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Perfil Farmacoterapéutico');
    const last = MEDS_HEADERS.length + diasDelMes.length;

    sheet.pageSetup = {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 }
    };

    // A y B: bloque del logo (como en el aplicativo). B también es Producto en la grilla.
    sheet.getColumn(1).width = 12;
    sheet.getColumn(2).width = 36;
    for (let c = 3; c <= last; c++) {
      sheet.getColumn(c).width = c <= MEDS_HEADERS.length ? 13 : 4;
    }

    let row = this.escribirEncabezado(sheet, last, empresaNombre, logoDataUrl);
    row = this.escribirPaciente(sheet, row, last, paciente);

    // Las dos filas de encabezado de la grilla quedan congeladas junto con el bloque superior
    const filasCongeladas = row + 1;
    this.escribirTablaMedicamentos(sheet, row, last, diasDelMes, medicamentos);

    sheet.views = [{ state: 'frozen', xSplit: 2, ySplit: filasCongeladas }];

    return this.descargar(workbook, documento);
  }

  private escribirEncabezado(
    sheet: ExcelJS.Worksheet,
    last: number,
    empresaNombre?: string,
    logoDataUrl?: string | null
  ): number {
    // Logo fijo en A1:B4 (celdas A y B)
    sheet.mergeCells(1, 1, 4, 2);
    const celdaLogo = sheet.getCell(1, 1);
    celdaLogo.alignment = { horizontal: 'center', vertical: 'middle' };

    const logoOk = this.insertarLogo(sheet, logoDataUrl);
    if (!logoOk) {
      celdaLogo.value = empresaNombre || 'Clínica Medilaser S.A.S.';
      celdaLogo.font = { bold: true, size: 11 };
    }

    // Título: C1:X2 / C3:X4  ·  Meta a la derecha
    const metaCols = Math.min(4, Math.max(2, Math.floor(last * 0.12)));
    const metaValorEnd = last;
    const metaValorStart = Math.max(4, last - Math.floor(metaCols / 2) + 1);
    const metaLabelStart = Math.max(3, metaValorStart - Math.ceil(metaCols / 2));
    const tituloEnd = Math.max(3, metaLabelStart - 1);

    sheet.mergeCells(1, 3, 2, tituloEnd);
    const celdaTitulo = sheet.getCell(1, 3);
    celdaTitulo.value = 'FORMATO DE SEGUIMIENTO Y CONTROL FARMACOTERAPÉUTICO';
    celdaTitulo.font = { bold: true, size: 12 };
    celdaTitulo.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

    sheet.mergeCells(3, 3, 4, tituloEnd);
    const celdaSub = sheet.getCell(3, 3);
    celdaSub.value = 'PERFIL FARMACOTERAPÉUTICO';
    celdaSub.font = { bold: true, size: 11 };
    celdaSub.alignment = { horizontal: 'center', vertical: 'middle' };

    const meta: Array<[string, string]> = [
      ['VERSIÓN', '4'],
      ['VIGENCIA', 'Feb-24'],
      ['CÓDIGO', 'F-SF-770 MD'],
      ['PÁGINA', '1 de 1']
    ];

    meta.forEach(([etiqueta, valor], i) => {
      const r = i + 1;
      if (metaLabelStart < metaValorStart) {
        sheet.mergeCells(r, metaLabelStart, r, metaValorStart - 1);
      }
      const celdaEtiqueta = sheet.getCell(r, metaLabelStart);
      celdaEtiqueta.value = etiqueta;
      celdaEtiqueta.font = { bold: true, size: 9 };
      celdaEtiqueta.alignment = { horizontal: 'center', vertical: 'middle' };
      celdaEtiqueta.fill = this.relleno(COLOR_LABEL);

      if (metaValorStart < metaValorEnd) {
        sheet.mergeCells(r, metaValorStart, r, metaValorEnd);
      }
      const celdaValor = sheet.getCell(r, metaValorStart);
      celdaValor.value = valor;
      celdaValor.font = { size: 9 };
      celdaValor.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    for (let r = 1; r <= 4; r++) {
      // Alto suficiente para el logo horizontal sin aplastarlo
      sheet.getRow(r).height = 18;
      for (let c = 1; c <= last; c++) {
        sheet.getCell(r, c).border = this.borde;
      }
    }

    return 5;
  }

  /** Inserta el logo en A1:B4 respetando la proporción (sin estirar). */
  private insertarLogo(sheet: ExcelJS.Worksheet, logoDataUrl: string | null | undefined): boolean {
    const parsed = this.parseDataUrl(logoDataUrl);
    if (!parsed) {
      return false;
    }

    const natural = this.readImageSize(parsed.buffer, parsed.extension);
    // Caja A1:B4 ≈ 48 chars × 4 filas; tamaño objetivo sin deformar
    const maxW = 200;
    const maxH = 64;
    const srcW = natural?.width || 400;
    const srcH = natural?.height || 140;
    const scale = Math.min(maxW / srcW, maxH / srcH);
    const width = Math.max(1, Math.round(srcW * scale));
    const height = Math.max(1, Math.round(srcH * scale));

    // Posición con tamaño fijo (ext) → Excel no estira el logo
    const posicion = {
      tl: { col: 0.2, row: 0.45 },
      ext: { width, height }
    };

    try {
      const imageId = sheet.workbook.addImage({
        buffer: parsed.buffer as unknown as ExcelJS.Buffer,
        extension: parsed.extension
      });
      sheet.addImage(imageId, posicion as unknown as ExcelJS.ImageRange);
      return true;
    } catch {
      try {
        const imageId = sheet.workbook.addImage({
          base64: parsed.base64,
          extension: parsed.extension
        });
        sheet.addImage(imageId, posicion as unknown as ExcelJS.ImageRange);
        return true;
      } catch {
        return false;
      }
    }
  }

  private parseDataUrl(
    logoDataUrl: string | null | undefined
  ): { base64: string; buffer: Uint8Array; extension: 'png' | 'jpeg' | 'gif' } | null {
    if (!logoDataUrl) {
      return null;
    }

    let mime = 'image/png';
    let base64 = logoDataUrl.trim();

    const match = base64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
    if (match) {
      mime = match[1].toLowerCase();
      base64 = match[2].replace(/\s+/g, '');
    } else if (/^[A-Za-z0-9+/=]+$/.test(base64) && base64.length > 100) {
      // base64 crudo
    } else {
      return null;
    }

    if (mime.includes('svg')) {
      // Excel no soporta SVG embebido
      return null;
    }

    const extension: 'png' | 'jpeg' | 'gif' =
      mime.includes('jpeg') || mime.includes('jpg')
        ? 'jpeg'
        : mime.includes('gif')
          ? 'gif'
          : 'png';

    try {
      const binary = atob(base64);
      const buffer = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        buffer[i] = binary.charCodeAt(i);
      }
      return { base64, buffer, extension };
    } catch {
      return null;
    }
  }

  /** Lee ancho/alto natural del PNG o JPEG para no deformar el logo. */
  private readImageSize(
    buffer: Uint8Array,
    extension: 'png' | 'jpeg' | 'gif'
  ): { width: number; height: number } | null {
    try {
      if (extension === 'png' && buffer.length >= 24) {
        // IHDR: bytes 16-23
        const width = (buffer[16] << 24) | (buffer[17] << 16) | (buffer[18] << 8) | buffer[19];
        const height = (buffer[20] << 24) | (buffer[21] << 16) | (buffer[22] << 8) | buffer[23];
        if (width > 0 && height > 0) {
          return { width, height };
        }
      }

      if (extension === 'jpeg') {
        let i = 2;
        while (i < buffer.length - 8) {
          if (buffer[i] !== 0xff) {
            i++;
            continue;
          }
          const marker = buffer[i + 1];
          if (marker === 0xc0 || marker === 0xc2) {
            const height = (buffer[i + 5] << 8) | buffer[i + 6];
            const width = (buffer[i + 7] << 8) | buffer[i + 8];
            if (width > 0 && height > 0) {
              return { width, height };
            }
            break;
          }
          const len = (buffer[i + 2] << 8) | buffer[i + 3];
          i += 2 + len;
        }
      }

      if (extension === 'gif' && buffer.length >= 10) {
        const width = buffer[6] | (buffer[7] << 8);
        const height = buffer[8] | (buffer[9] << 8);
        if (width > 0 && height > 0) {
          return { width, height };
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  private escribirPaciente(
    sheet: ExcelJS.Worksheet,
    inicio: number,
    last: number,
    paciente: PerfilExportPaciente
  ): number {
    let row = inicio;

    sheet.mergeCells(row, 1, row, last);
    const barra = sheet.getCell(row, 1);
    barra.value = 'DATOS DEL PACIENTE';
    barra.fill = this.relleno(COLOR_SECCION);
    barra.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    barra.alignment = { horizontal: 'left', vertical: 'middle' };
    for (let c = 1; c <= last; c++) {
      sheet.getCell(row, c).border = this.borde;
    }
    sheet.getRow(row).height = 16;
    row++;

    this.escribirFilaInfo(sheet, row++, last, [
      { text: 'Nombre:', weight: 1, label: true },
      { text: paciente.nombre, weight: 3.2, align: 'left' },
      { text: 'Edad:', weight: 0.8, label: true },
      { text: paciente.edad, weight: 1, align: 'left' },
      { text: 'Sexo:', weight: 0.8, label: true },
      { text: paciente.sexo, weight: 1, align: 'left' },
      { text: 'Peso(Kg.):', weight: 1, label: true },
      { text: paciente.peso, weight: 0.9, align: 'left' },
      { text: 'Historia Nº:', weight: 1.1, label: true },
      { text: paciente.historia, weight: 1.4, align: 'left', fill: COLOR_AMARILLO }
    ]);

    this.escribirFilaInfo(sheet, row++, last, [
      { text: 'Ingreso:', weight: 1, label: true },
      { text: paciente.ingreso, weight: 3.2, align: 'left' },
      { text: 'Diagnóstico:', weight: 1.2, label: true },
      { text: paciente.diagnostico, weight: 4, align: 'left' },
      { text: 'Servicio:', weight: 1, label: true },
      { text: paciente.servicio, weight: 2, align: 'left' }
    ]);

    this.escribirFilaInfo(sheet, row++, last, [
      { text: 'N. Cama:', weight: 1, label: true },
      { text: paciente.cama, weight: 3.2, align: 'left' },
      { text: 'Antecedentes alérgicos:', weight: 2, label: true },
      { text: this.marcasAlergias(paciente.alergias), weight: 2.4, align: 'left' },
      { text: 'Cual:', weight: 0.8, label: true },
      { text: paciente.alergiasCual, weight: 3, align: 'left' }
    ]);

    const mes = paciente.mesReferencia.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
    sheet.mergeCells(row, 1, row, last);
    const celdaMes = sheet.getCell(row, 1);
    celdaMes.value = `Mes de referencia: ${mes}`;
    celdaMes.font = { size: 9, bold: true };
    celdaMes.alignment = { horizontal: 'left', vertical: 'middle' };
    for (let c = 1; c <= last; c++) {
      sheet.getCell(row, c).border = this.borde;
    }
    row++;

    return row;
  }

  private escribirTablaMedicamentos(
    sheet: ExcelJS.Worksheet,
    inicio: number,
    last: number,
    diasDelMes: number[],
    medicamentos: PerfilExportMedicamento[]
  ): number {
    let row = inicio;
    const fijas = MEDS_HEADERS.length;
    const filaGrupo = row;
    const filaDias = row + 1;

    MEDS_HEADERS.forEach((titulo, i) => {
      const col = i + 1;
      sheet.mergeCells(filaGrupo, col, filaDias, col);
      const cell = sheet.getCell(filaGrupo, col);
      cell.value = titulo.toUpperCase();
      cell.fill = this.relleno(COLOR_HEADER);
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });

    if (diasDelMes.length) {
      sheet.mergeCells(filaGrupo, fijas + 1, filaGrupo, last);
      const grupo = sheet.getCell(filaGrupo, fijas + 1);
      grupo.value = 'DIA/MES';
      grupo.fill = this.relleno(COLOR_HEADER);
      grupo.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
      grupo.alignment = { horizontal: 'center', vertical: 'middle' };

      diasDelMes.forEach((dia, i) => {
        const cell = sheet.getCell(filaDias, fijas + 1 + i);
        cell.value = dia;
        cell.fill = this.relleno(COLOR_HEADER);
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 8 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
    }

    for (const r of [filaGrupo, filaDias]) {
      sheet.getRow(r).height = r === filaGrupo ? 20 : 14;
      for (let c = 1; c <= last; c++) {
        const cell = sheet.getCell(r, c);
        cell.border = this.borde;
        if (!cell.fill) {
          cell.fill = this.relleno(COLOR_HEADER);
        }
      }
    }

    row = filaDias + 1;

    if (!medicamentos.length) {
      sheet.mergeCells(row, 1, row, last);
      const vacio = sheet.getCell(row, 1);
      vacio.value = 'Sin medicamentos registrados para esta consulta.';
      vacio.alignment = { horizontal: 'center', vertical: 'middle' };
      vacio.font = { italic: true, size: 9 };
      for (let c = 1; c <= last; c++) {
        sheet.getCell(row, c).border = this.borde;
      }
      return row + 1;
    }

    for (const med of medicamentos) {
      const valores: Array<string | number> = [
        med.cuenta,
        med.producto,
        med.concentracion,
        med.presentacion,
        med.dosis,
        med.unidad,
        med.viaAdm,
        med.frecuencia,
        med.unidadFrecuencia,
        med.peso,
        ...diasDelMes.map(d => med.dias[d] ?? '')
      ];

      const fila = sheet.getRow(row);
      valores.forEach((valor, i) => {
        const cell = fila.getCell(i + 1);
        cell.value = valor === '' ? null : valor;
        cell.border = this.borde;
        cell.font = { size: 9, bold: i === 1 };
        cell.alignment = {
          horizontal: i === 1 ? 'left' : 'center',
          vertical: 'middle',
          wrapText: i === 1 || i === 3
        };
      });
      fila.height = 22;
      row++;
    }

    return row;
  }

  private escribirFilaInfo(
    sheet: ExcelJS.Worksheet,
    row: number,
    last: number,
    segmentos: Segmento[]
  ): void {
    const rangos = this.repartir(last, segmentos.map(s => s.weight));

    segmentos.forEach((segmento, i) => {
      const [c1, c2] = rangos[i];
      if (c2 > c1) {
        sheet.mergeCells(row, c1, row, c2);
      }
      const cell = sheet.getCell(row, c1);
      cell.value = segmento.text || '';
      cell.font = { bold: !!segmento.label || segmento.fill === COLOR_AMARILLO, size: 9 };
      cell.alignment = {
        horizontal: segmento.align ?? 'left',
        vertical: 'middle',
        wrapText: true
      };
      if (segmento.label) {
        cell.fill = this.relleno(COLOR_LABEL);
      }
      if (segmento.fill) {
        cell.fill = this.relleno(segmento.fill);
      }
    });

    for (let c = 1; c <= last; c++) {
      sheet.getCell(row, c).border = this.borde;
    }
    sheet.getRow(row).height = 18;
  }

  private marcasAlergias(valor: PerfilExportPaciente['alergias']): string {
    const marca = (opcion: string) => (valor === opcion ? '(X)' : '(  )');
    return `${marca('si')} Si    ${marca('no')} No    ${marca('no_esp')} No esp.`;
  }

  /** Reparte `last` columnas entre los segmentos según su peso relativo. */
  private repartir(last: number, pesos: number[]): Array<[number, number]> {
    const total = pesos.reduce((acc, p) => acc + p, 0);
    const spans = pesos.map(p => Math.max(1, Math.floor((p / total) * last)));

    let usado = spans.reduce((acc, s) => acc + s, 0);
    while (usado < last) {
      spans[spans.length - 1]++;
      usado++;
    }
    let i = spans.length - 1;
    while (usado > last && i >= 0) {
      if (spans[i] > 1) {
        spans[i]--;
        usado--;
      } else {
        i--;
      }
    }

    const rangos: Array<[number, number]> = [];
    let col = 1;
    for (const span of spans) {
      rangos.push([col, col + span - 1]);
      col += span;
    }
    return rangos;
  }

  private relleno(argb: string): ExcelJS.Fill {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
  }

  private async descargar(workbook: ExcelJS.Workbook, documento: string): Promise<string> {
    const safeDoc = documento.replace(/\D/g, '') || 'sin_documento';
    const fecha = new Date().toISOString().slice(0, 10);
    const filename = `Perfil_Farmacoterapeutico_${safeDoc}_${fecha}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);

    return filename;
  }
}
