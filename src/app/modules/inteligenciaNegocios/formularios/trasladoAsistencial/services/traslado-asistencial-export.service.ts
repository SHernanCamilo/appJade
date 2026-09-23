import { Injectable } from '@angular/core';
import * as ExcelJS from 'exceljs';

import {
  CAUSAS_ATENCION,
  GRUPOS_SERVICIO_TRASLADO,
  HistoriaTrasladoAsistencial,
  TipoTrasladoAsistencial,
  glasgowTotal
} from '../models/traslado-asistencial.model';

export interface TrasladoExportOptions {
  tipo: TipoTrasladoAsistencial;
  form: HistoriaTrasladoAsistencial;
  titulo: string;
  codigo: string;
  empresaNombre?: string;
  logoDataUrl?: string | null;
}

const LAST = 12;
const COLOR_BORDE = 'FF1F2937';
const COLOR_SECCION = 'FF002060';
const COLOR_LABEL = 'FFF9FAFB';
const COLOR_SUB = 'FFF8FAFC';
const COLOR_GLASGOW_SEL = 'FFDBEAFE';
const COLOR_GLASGOW_TOTAL = 'FFFFFBEB';
const COLOR_SIN_DATO = 'FF9CA3AF';
const COLOR_TEXTO = 'FF111827';
const COLOR_ASTERISCO = 'FFDC2626';

const GLASGOW_MOTORA = [
  { valor: 6, label: 'Órdenes' },
  { valor: 5, label: 'Localiza' },
  { valor: 4, label: 'Retira' },
  { valor: 3, label: 'Flexión anormal' },
  { valor: 2, label: 'Extensión anormal' },
  { valor: 1, label: 'No hay' }
];
const GLASGOW_VERBAL = [
  { valor: 5, label: 'Orientada' },
  { valor: 4, label: 'Confusa' },
  { valor: 3, label: 'Inapropiado' },
  { valor: 2, label: 'Incomprensible' },
  { valor: 1, label: 'No hay' }
];
const GLASGOW_OCULAR = [
  { valor: 4, label: 'Espontánea' },
  { valor: 3, label: 'Al llamado' },
  { valor: 2, label: 'Al dolor' },
  { valor: 1, label: 'No hay' }
];

@Injectable({ providedIn: 'root' })
export class TrasladoAsistencialExportService {
  private readonly thin: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: COLOR_BORDE } };

  private get borde(): Partial<ExcelJS.Borders> {
    return { top: this.thin, left: this.thin, bottom: this.thin, right: this.thin };
  }

  async exportar(options: TrasladoExportOptions): Promise<string> {
    const { tipo, form, titulo, codigo, empresaNombre, logoDataUrl } = options;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = empresaNombre || 'Clínica Medilaser S.A.S.';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(this.nombreHoja(tipo));
    sheet.pageSetup = {
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
      margins: { left: 0.35, right: 0.35, top: 0.35, bottom: 0.35, header: 0.15, footer: 0.15 }
    };

    const widths = [20, 14, 12, 12, 12, 11, 12, 12, 10, 10, 10, 12];
    widths.forEach((w, i) => {
      sheet.getColumn(i + 1).width = w;
    });

    let row = this.escribirEncabezado(sheet, titulo, codigo, empresaNombre, logoDataUrl);

    if (tipo === 'primario') {
      row = this.escribirPrimario(sheet, row, form);
    } else if (tipo === 'secundario') {
      row = this.escribirSecundario(sheet, row, form);
    } else {
      row = this.escribirCompleto(sheet, row, form, tipo === 'secundarioCompleto');
    }

    return this.descargar(workbook, tipo, form.numeroIdentificacion);
  }

  private nombreHoja(tipo: TipoTrasladoAsistencial): string {
    if (tipo === 'secundario' || tipo === 'secundarioCompleto') {
      return 'Traslado secundario';
    }
    return 'Traslado primario';
  }

  private escribirEncabezado(
    sheet: ExcelJS.Worksheet,
    titulo: string,
    codigo: string,
    empresaNombre?: string,
    logoDataUrl?: string | null
  ): number {
    this.merge(sheet, 1, 1, 4, 2);
    const celdaLogo = sheet.getCell(1, 1);
    celdaLogo.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

    const logoOk = this.insertarLogo(sheet, logoDataUrl);
    if (!logoOk) {
      celdaLogo.value = empresaNombre || 'Clínica Medilaser S.A.S.';
      celdaLogo.font = { bold: true, size: 11, color: { argb: 'FF1D4ED8' } };
    }

    this.merge(sheet, 1, 3, 4, 8);
    const celdaTitulo = sheet.getCell(1, 3);
    celdaTitulo.value = titulo;
    celdaTitulo.font = { bold: true, size: 13, color: { argb: COLOR_TEXTO } };
    celdaTitulo.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

    const meta: Array<[string, string]> = [
      ['VERSIÓN', '4'],
      ['VIGENCIA', 'mar-24'],
      ['CÓDIGO', codigo],
      ['PÁGINA', '1 de 1']
    ];
    meta.forEach(([etiqueta, valor], i) => {
      const r = i + 1;
      this.estiloLabel(sheet.getCell(r, 9), etiqueta, false);
      sheet.getCell(r, 9).alignment = { horizontal: 'center', vertical: 'middle' };
      this.merge(sheet, r, 10, r, LAST);
      const celdaValor = sheet.getCell(r, 10);
      celdaValor.value = valor;
      celdaValor.font = { size: 8, color: { argb: COLOR_TEXTO } };
      celdaValor.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    for (let r = 1; r <= 4; r++) {
      sheet.getRow(r).height = 16;
      this.bordes(sheet, r);
    }
    return 5;
  }

  private escribirPrimario(sheet: ExcelJS.Worksheet, row: number, form: HistoriaTrasladoAsistencial): number {
    row = this.seccion(sheet, row, 'DATOS DE LA PERSONA');
    row = this.campo(sheet, row, 'Nombres y apellidos:', form.nombresApellidos, true);
    row = this.campo2(
      sheet, row,
      'Tipo de documento:',
      this.radios([
        ['as', 'AS'], ['ms', 'MS'], ['rc', 'RC'], ['ti', 'TI'],
        ['cc', 'CC'], ['ce', 'CE'], ['otro', 'Otros']
      ], form.tipoIdentificacion, form.tipoIdentificacionOtro),
      false,
      'Número de documento:',
      form.numeroIdentificacion,
      false
    );
    row = this.campo2(
      sheet, row,
      'Edad:',
      `${this.dato(form.edad)}   ${this.radios([['anos', 'Años'], ['meses', 'Mes'], ['dias', 'Días']], form.edadUnidad)}`,
      true,
      'Sexo biológico:',
      this.radios([['femenino', 'Femenino'], ['masculino', 'Masculino']], form.sexo),
      false
    );

    row = this.seccion(sheet, row, 'TIEMPOS DEL SERVICIO Y ESCENA');
    row = this.campo2(sheet, row, 'Hora del despacho:', form.horaDespacho, true, 'Hora de llegada al lugar de la escena:', form.horaLlegadaEscena, true);
    row = this.campo2(sheet, row, 'Triage del paciente en escena:', form.signosInicio.triage, true, 'Hora de salida del lugar de la escena:', form.horaSalidaEscena, true);

    row = this.escribirBloqueProcedimientos(sheet, row, form);
    row = this.escribirExamenFisico(sheet, row, form);

    row = this.seccion(sheet, row, 'ORIGEN, DESTINO Y ESTADO');
    row = this.escribirLugarOrigen(sheet, row, form);
    row = this.campo2(
      sheet, row,
      'Hora de llegada de la ambulancia al servicio:',
      form.horaLlegadaServicio,
      true,
      'Código REPS de la institución receptora:',
      form.destino1Reps,
      true
    );
    row = this.campo2(
      sheet, row,
      'Hora de recepción del paciente por la institución:',
      form.horaRecepcion,
      true,
      'Estado del paciente al ingreso:',
      this.radios([['vivo', 'Vivo'], ['muerto', 'Muerto']], form.estadoFinal),
      true
    );

    row = this.escribirAcompanante(sheet, row, form);
    row = this.escribirTripulacion(sheet, row, form, false);
    row = this.escribirProfesionalRecibe(sheet, row, form);
    return row;
  }

  private escribirSecundario(sheet: ExcelJS.Worksheet, row: number, form: HistoriaTrasladoAsistencial): number {
    row = this.seccion(sheet, row, 'DATOS DE LA PERSONA');
    row = this.campo(sheet, row, 'Nombres y apellidos:', form.nombresApellidos, true);
    row = this.campo2(
      sheet, row,
      'Tipo de documento:',
      this.radios([
        ['msi', 'MSI'], ['rc', 'RC'], ['ti', 'TI'],
        ['cc', 'CC'], ['ce', 'CE'], ['otro', 'Otro']
      ], form.tipoIdentificacion, form.tipoIdentificacionOtro),
      true,
      'Número de documento:',
      form.numeroIdentificacion,
      false
    );
    row = this.campo2(
      sheet, row,
      'Edad:',
      `${this.dato(form.edad)}   ${this.radios([['anos', 'Años'], ['meses', 'Meses'], ['dias', 'Días'], ['horas', 'Horas']], form.edadUnidad)}`,
      true,
      'Sexo biológico:',
      this.radios([['femenino', 'Femenino'], ['masculino', 'Masculino']], form.sexo),
      false
    );
    row = this.campo(sheet, row, 'Grupo de servicio al cual es trasladada la persona:', this.checks(GRUPOS_SERVICIO_TRASLADO, form.gruposServicio), true);

    row = this.escribirBloqueProcedimientos(sheet, row, form);

    row = this.seccion(sheet, row, 'RECORRIDO, ORIGEN Y DESTINO');
    row = this.campo2(
      sheet, row,
      'Fecha y hora de inicio del recorrido:',
      this.fmtFechaHora(form.fechaHoraInicioRecorrido),
      true,
      'Fecha y hora de finalización del recorrido:',
      this.fmtFechaHora(form.fechaHoraFinRecorrido),
      true
    );
    row = this.escribirLugarOrigen(sheet, row, form, true);
    row = this.escribirLugarDestino(sheet, row, form);
    row = this.campo2(
      sheet, row,
      'Estado al finalizar el traslado:',
      this.radios([['vivo', 'Vivo'], ['muerto', 'Muerto']], form.estadoFinal),
      true,
      'Traslado redondo:',
      `${this.radios([['si', 'Sí'], ['no', 'No']], form.trasladoRedondo)}    Horas de espera: ${this.dato(form.horasEspera)}`,
      true
    );
    row = this.campo(
      sheet, row,
      'Distancia del recorrido:',
      `${this.radios([['km', 'Kilómetros'], ['millas', 'Millas']], form.unidadDistancia)}    Iniciales: ${this.dato(form.kmInicio)}    Finales: ${this.dato(form.kmFinales)}`,
      true
    );

    row = this.escribirAcompanante(sheet, row, form);
    row = this.escribirTripulacion(sheet, row, form, true);
    row = this.escribirProfesionalRecibe(sheet, row, form);

    row = this.seccion(sheet, row, 'INGRESO A PRESTADOR DURANTE EL RECORRIDO');
    row = this.area(sheet, row, 'Causa (complicación o deterioro):', form.causaDesvio, false);
    row = this.campo2(sheet, row, 'Nombre del prestador:', form.prestadorDesvio, false, 'Kilómetros de desviación:', form.kmDesviacion, false);
    row = this.campo(sheet, row, 'Tiempo utilizado:', form.tiempoAtencionDesvio, false);
    return row;
  }

  private escribirCompleto(
    sheet: ExcelJS.Worksheet,
    row: number,
    form: HistoriaTrasladoAsistencial,
    esSecundario: boolean
  ): number {
    row = this.seccion(sheet, row, 'RÉCORD DE TRASLADO E IDENTIFICACIÓN');
    row = this.campo2(sheet, row, 'Número de récord:', form.recordNumero, false, 'Identificación:', form.identificacionNumero, false);
    row = this.campo2(sheet, row, 'Autorización número:', form.autorizacionNumero, false, 'Unidad:', form.unidad, false);
    row = this.campo2(sheet, row, 'Recibo de caja:', form.reciboCajaNumero, false, 'Fecha atención:', form.fechaAtencion, false);

    row = this.seccion(sheet, row, 'DATOS DEL SERVICIO');
    row = this.campo(sheet, row, 'Convenio:', form.convenio, false);
    if (esSecundario) {
      row = this.campo2(sheet, row, 'IPS origen:', form.ipsOrigen, false, 'Servicio origen:', form.servicioOrigen, false);
      row = this.campo2(sheet, row, 'Médico que remite:', form.medicoRemite, false, 'Médico que recibe:', form.medicoRecibe, false);
    }
    row = this.campo2(sheet, row, 'Origen:', form.origen, false, 'Código REPS origen:', form.origenReps, false);
    row = this.campo2(sheet, row, 'Destino 1:', form.destino1, false, 'Código REPS destino 1:', form.destino1Reps, false);
    row = this.campo2(sheet, row, 'Destino 2:', form.destino2, false, 'Código REPS destino 2:', form.destino2Reps, false);
    row = this.campo(sheet, row, 'Complejidad:', this.radios([['baja', 'Complejidad baja'], ['mediana', 'Complejidad mediana']], form.complejidad), false);
    row = this.campo2(
      sheet, row,
      'Tipo de transporte:',
      this.radios([['terrestre', 'Terrestre'], ['aereo', 'Aéreo']], form.tipoTransporte),
      false,
      'Tipo de traslado:',
      this.radios([['local', 'Local'], ['intermunicipal', 'Intermunicipal']], form.tipoTraslado),
      false
    );
    row = this.campo(sheet, row, 'Grupo de servicio:', this.checks(GRUPOS_SERVICIO_TRASLADO, form.gruposServicio), false);

    row = this.seccion(sheet, row, 'DATOS DEL PACIENTE');
    row = this.campo(sheet, row, 'Nombres y apellidos:', form.nombresApellidos, false);
    row = this.campo2(
      sheet, row,
      'Edad:',
      `${this.dato(form.edad)}   ${this.radios([['anos', 'Años'], ['meses', 'Meses'], ['dias', 'Días'], ['horas', 'Horas']], form.edadUnidad)}`,
      false,
      'Sexo:',
      this.radios([['femenino', 'Femenino'], ['masculino', 'Masculino']], form.sexo),
      false
    );
    row = this.campo2(sheet, row, 'Número de identificación:', form.numeroIdentificacion, false, 'Diagnóstico principal:', form.diagnosticoPrincipal, false);

    row = this.escribirExamenFisico(sheet, row, form, esSecundario);
    row = this.escribirBloqueProcedimientos(sheet, row, form, true);
    row = this.campo(sheet, row, 'Estado al finalizar el traslado:', this.radios([['vivo', 'Vivo'], ['muerto', 'Muerto']], form.estadoFinal), false);
    row = this.escribirTripulacion(sheet, row, form, true);
    row = this.escribirProfesionalRecibe(sheet, row, form);
    return row;
  }

  private escribirBloqueProcedimientos(
    sheet: ExcelJS.Worksheet,
    row: number,
    form: HistoriaTrasladoAsistencial,
    incluirRecomendaciones = false
  ): number {
    row = this.seccion(sheet, row, 'PROCEDIMIENTOS, MEDICAMENTOS Y CÓDIGO DE TRASLADO');
    row = this.subLabel(sheet, row, 'Procedimientos realizados durante el traslado (CUPS)', true);

    if (incluirRecomendaciones) {
      row = this.tablaPlain(
        sheet, row,
        [
          { titulo: 'RECOMENDACIONES', span: 3 },
          { titulo: 'PROCEDIMIENTOS', span: 3 },
          { titulo: 'CÓDIGO CUPS', span: 2 },
          { titulo: 'PARACLÍNICOS', span: 2 },
          { titulo: 'CÓDIGO CUPS', span: 2 }
        ],
        form.procedimientos.map(f => [f.recomendaciones, f.procedimientos, f.cupsProcedimientos, f.paraclinicos, f.cupsParaclinicos])
      );
    } else {
      row = this.tablaPlain(
        sheet, row,
        [
          { titulo: 'PROCEDIMIENTOS', span: 8 },
          { titulo: 'CÓDIGO CUPS', span: 4 }
        ],
        form.procedimientos.map(f => [f.procedimientos, f.cupsProcedimientos])
      );
    }

    row = this.subLabel(sheet, row, 'Medicamentos (CUMS o IUMS) y dispositivos médicos utilizados', true);
    row = this.tablaPlain(
      sheet, row,
      [
        { titulo: 'CÓDIGO CUM O IUM', span: 4 },
        { titulo: 'NOMBRE DEL MEDICAMENTO', span: 8 }
      ],
      form.medicamentos.map(m => [m.codigoCumIum, m.nombre])
    );

    row = this.area(sheet, row, 'Dispositivos médicos:', form.insumos, false);
    row = this.campo(sheet, row, 'Código de traslado (CUPS):', form.cupsTraslado, true);
    return row;
  }

  private escribirExamenFisico(
    sheet: ExcelJS.Worksheet,
    row: number,
    form: HistoriaTrasladoAsistencial,
    esSecundario = false
  ): number {
    row = this.seccion(sheet, row, 'EXAMEN FÍSICO');
    row = this.campo(
      sheet, row,
      'Causa de la atención:',
      `${this.checks(CAUSAS_ATENCION, form.causaAtencion)}    ${this.dato(form.causaAtencionOtra)}`,
      false,
      26
    );
    row = this.escribirSignosInicio(sheet, row, form);
    row = this.escribirGlasgow(sheet, row, form);
    row = this.area(sheet, row, esSecundario ? 'Resumen clínico:' : 'Motivo de consulta:', esSecundario ? form.resumenClinico : form.motivoConsulta, false);
    row = this.area(sheet, row, 'Enfermedad actual:', form.enfermedadActual, false);
    return row;
  }

  private escribirSignosInicio(sheet: ExcelJS.Worksheet, row: number, form: HistoriaTrasladoAsistencial): number {
    const s = form.signosInicio;
    row = this.subLabel(sheet, row, 'Signos vitales al inicio del traslado:');
    row = this.vitales(sheet, row, [
      `Tensión arterial  ${this.dato(s.taSistolica)}  /  ${this.dato(s.taDiastolica)}  mmHg`,
      `TAM  ${this.dato(s.tamSistolica)}  /  ${this.dato(s.tamDiastolica)}  mmHg`,
      `FC  ${this.dato(s.fc)}  lpm`,
      `FR  ${this.dato(s.fr)}  rpm`
    ]);
    row = this.vitales(sheet, row, [
      `Temperatura  ${this.dato(s.temperatura)}  °C`,
      `FCF  ${this.dato(s.fcf)}  lpm`,
      `Pupila der.  ${this.dato(s.pupilaDerecha)}  mm`,
      `Pupila izq.  ${this.dato(s.pupilaIzquierda)}  mm`
    ]);
    row = this.vitales(sheet, row, [
      `SPO2  ${this.dato(s.spo2)}  %`,
      `Triage del paciente en escena:  ${this.dato(s.triage)}`
    ], [3, 9]);
    return row;
  }

  private escribirGlasgow(sheet: ExcelJS.Worksheet, row: number, form: HistoriaTrasladoAsistencial): number {
    const total = glasgowTotal(form.glasgow);
    const filas = 7;
    const inicio = row;

    this.glasgowColumna(sheet, inicio, 1, 3, 'Respuesta motora', GLASGOW_MOTORA, form.glasgow.motora);
    this.glasgowColumna(sheet, inicio, 4, 6, 'Respuesta verbal', GLASGOW_VERBAL, form.glasgow.verbal);
    this.glasgowColumna(sheet, inicio, 7, 9, 'Apertura ocular', GLASGOW_OCULAR, form.glasgow.ocular);

    this.merge(sheet, inicio, 10, inicio + filas - 1, LAST);
    const totalCell = sheet.getCell(inicio, 10);
    totalCell.value = `Total\nGlasgow: ${total === '' ? 'Sin dato' : total} / 15 puntos`;
    totalCell.fill = this.relleno(COLOR_GLASGOW_TOTAL);
    totalCell.font = { bold: true, size: 10, color: { argb: COLOR_TEXTO } };
    totalCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

    for (let r = inicio; r < inicio + filas; r++) {
      this.bordes(sheet, r);
      sheet.getRow(r).height = 16;
    }
    return inicio + filas;
  }

  private glasgowColumna(
    sheet: ExcelJS.Worksheet,
    inicio: number,
    c1: number,
    c2: number,
    titulo: string,
    opciones: Array<{ valor: number; label: string }>,
    seleccionado: number | null
  ): void {
    this.merge(sheet, inicio, c1, inicio, c2);
    const head = sheet.getCell(inicio, c1);
    head.value = titulo;
    head.fill = this.relleno(COLOR_SECCION);
    head.font = { bold: true, size: 8, color: { argb: 'FFFFFFFF' } };
    head.alignment = { horizontal: 'center', vertical: 'middle' };

    for (let i = 0; i < 6; i++) {
      const r = inicio + 1 + i;
      const op = opciones[i];
      this.merge(sheet, r, c1, r, c2 - 1);
      const label = sheet.getCell(r, c1);
      const score = sheet.getCell(r, c2);
      if (op) {
        const sel = seleccionado === op.valor;
        label.value = op.label;
        score.value = op.valor;
        label.font = { size: 8, bold: sel, color: { argb: COLOR_TEXTO } };
        score.font = { size: 8, bold: true, color: { argb: COLOR_TEXTO } };
        if (sel) {
          label.fill = this.relleno(COLOR_GLASGOW_SEL);
          score.fill = this.relleno(COLOR_GLASGOW_SEL);
        }
      }
      label.alignment = { horizontal: 'left', vertical: 'middle' };
      score.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  }

  private escribirLugarOrigen(
    sheet: ExcelJS.Worksheet,
    row: number,
    form: HistoriaTrasladoAsistencial,
    conReps = false
  ): number {
    this.merge(sheet, row, 1, row + 1, 2);
    this.estiloLabel(sheet.getCell(row, 1), 'Lugar de origen:', false);

    if (conReps) {
      this.miniLabelValor(sheet, row, 3, 4, 'REPS', form.origenReps);
      this.miniLabelValor(sheet, row, 5, 6, 'Departamento', form.origenDepartamento);
      this.miniLabelValor(sheet, row, 7, 8, 'Municipio', form.origenMunicipio);
      this.miniLabelValor(sheet, row, 9, 10, 'Localidad', form.origenLocalidad);
      this.miniLabelValor(sheet, row, 11, LAST, 'Barrio', form.origenBarrio);
    } else {
      this.miniLabelValor(sheet, row, 3, 4, 'Departamento', form.origenDepartamento);
      this.miniLabelValor(sheet, row, 5, 6, 'Municipio', form.origenMunicipio);
      this.miniLabelValor(sheet, row, 7, 8, 'Localidad', form.origenLocalidad);
      this.miniLabelValor(sheet, row, 9, LAST, 'Barrio', form.origenBarrio);
    }

    this.estiloLabel(sheet.getCell(row + 1, 3), 'Dirección', false);
    this.merge(sheet, row + 1, 4, row + 1, LAST);
    this.estiloValor(sheet.getCell(row + 1, 4), form.origenDireccion);

    this.bordes(sheet, row);
    this.bordes(sheet, row + 1);
    sheet.getRow(row).height = 20;
    sheet.getRow(row + 1).height = 18;
    return row + 2;
  }

  private escribirLugarDestino(sheet: ExcelJS.Worksheet, row: number, form: HistoriaTrasladoAsistencial): number {
    this.merge(sheet, row, 1, row + 1, 2);
    this.estiloLabel(sheet.getCell(row, 1), 'Lugar de destino:', true);
    this.miniLabelValor(sheet, row, 3, 4, 'REPS', form.destino1Reps);
    this.miniLabelValor(sheet, row, 5, 6, 'Departamento', form.destinoDepartamento);
    this.miniLabelValor(sheet, row, 7, 8, 'Municipio', form.destinoMunicipio);
    this.miniLabelValor(sheet, row, 9, 10, 'Localidad', form.destinoLocalidad);
    this.miniLabelValor(sheet, row, 11, LAST, 'Barrio', form.destinoBarrio);
    this.estiloLabel(sheet.getCell(row + 1, 3), 'Dirección', false);
    this.merge(sheet, row + 1, 4, row + 1, LAST);
    this.estiloValor(sheet.getCell(row + 1, 4), form.destinoDireccion);
    this.bordes(sheet, row);
    this.bordes(sheet, row + 1);
    sheet.getRow(row).height = 20;
    sheet.getRow(row + 1).height = 18;
    return row + 2;
  }

  private escribirAcompanante(sheet: ExcelJS.Worksheet, row: number, form: HistoriaTrasladoAsistencial): number {
    row = this.seccion(sheet, row, 'ACOMPAÑANTE');
    row = this.campo(sheet, row, 'Nombres y apellidos del acompañante:', form.nombreAcompanante, true);

    this.merge(sheet, row, 1, row, 2);
    this.estiloLabel(sheet.getCell(row, 1), 'Tipo de documento del acompañante:', false);
    this.merge(sheet, row, 3, row, 5);
    this.estiloValor(
      sheet.getCell(row, 3),
      this.radios([['cc', 'CC'], ['ti', 'TI'], ['ce', 'CE'], ['otro', 'Otro']], form.acompananteTipoId),
      false
    );
    this.merge(sheet, row, 6, row, 7);
    this.estiloLabel(sheet.getCell(row, 6), 'Número de documento del acompañante:', false);
    this.merge(sheet, row, 8, row, 9);
    this.estiloValor(sheet.getCell(row, 8), form.acompananteNumeroId);
    this.merge(sheet, row, 10, row, 10);
    this.estiloLabel(sheet.getCell(row, 10), 'Relación / parentesco:', false);
    this.merge(sheet, row, 11, row, LAST);
    this.estiloValor(sheet.getCell(row, 11), form.parentesco);
    this.bordes(sheet, row);
    sheet.getRow(row).height = 22;
    return row + 1;
  }

  private escribirTripulacion(
    sheet: ExcelJS.Worksheet,
    row: number,
    form: HistoriaTrasladoAsistencial,
    incluirMedico: boolean
  ): number {
    row = this.seccion(sheet, row, 'TRIPULACIÓN');
    row = this.subLabel(sheet, row, 'Nombres, tipo y número de documento de la tripulación');

    const roles = incluirMedico
      ? [
          { titulo: 'Médico', persona: form.medico1 },
          { titulo: 'Auxiliar de Enfermería', persona: form.auxiliar1 },
          { titulo: 'Comandante / Conductor', persona: form.comandante1 }
        ]
      : [
          { titulo: 'Auxiliar de Enfermería', persona: form.auxiliar1 },
          { titulo: 'Comandante / Conductor', persona: form.comandante1 }
        ];

    const span = Math.floor(LAST / roles.length);
    roles.forEach((rol, i) => {
      const c1 = i * span + 1;
      const c2 = i === roles.length - 1 ? LAST : c1 + span - 1;
      this.merge(sheet, row, c1, row, c2);
      const head = sheet.getCell(row, c1);
      head.value = rol.titulo;
      head.font = { bold: true, size: 9, color: { argb: COLOR_TEXTO } };
      head.alignment = { horizontal: 'center', vertical: 'middle' };

      this.merge(sheet, row + 1, c1, row + 1, c2);
      this.estiloValor(sheet.getCell(row + 1, c1), rol.persona.nombre);

      this.merge(sheet, row + 2, c1, row + 2, c2);
      this.estiloValor(
        sheet.getCell(row + 2, c1),
        `Tipo  ${this.dato(rol.persona.tipoDocumento)}      N°  ${this.dato(rol.persona.documento)}`,
        false
      );
    });

    for (let r = row; r <= row + 2; r++) {
      this.bordes(sheet, r);
    }
    sheet.getRow(row).height = 18;
    sheet.getRow(row + 1).height = 22;
    sheet.getRow(row + 2).height = 20;
    return row + 3;
  }

  private escribirProfesionalRecibe(sheet: ExcelJS.Worksheet, row: number, form: HistoriaTrasladoAsistencial): number {
    row = this.seccion(sheet, row, 'PROFESIONAL QUE RECIBE');
    row = this.campo(sheet, row, 'Nombres y apellidos:', form.profesionalDestino1, true);
    row = this.campo2(
      sheet, row,
      'Tipo de documento:',
      this.radios([['cc', 'CC'], ['ce', 'CE'], ['otro', 'Otro']], form.profesionalRecibeTipoId),
      false,
      'Número de documento:',
      form.profesionalDestino1Cc,
      false
    );
    return row;
  }

  private seccion(sheet: ExcelJS.Worksheet, row: number, titulo: string): number {
    this.merge(sheet, row, 1, row, LAST);
    const cell = sheet.getCell(row, 1);
    cell.value = titulo;
    cell.fill = this.relleno(COLOR_SECCION);
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
    this.bordes(sheet, row);
    sheet.getRow(row).height = 16;
    return row + 1;
  }

  private subLabel(sheet: ExcelJS.Worksheet, row: number, texto: string, requerido = false): number {
    this.merge(sheet, row, 1, row, LAST);
    this.estiloLabel(sheet.getCell(row, 1), texto, requerido, COLOR_SUB);
    this.bordes(sheet, row);
    sheet.getRow(row).height = 16;
    return row + 1;
  }

  private campo(
    sheet: ExcelJS.Worksheet,
    row: number,
    label: string,
    valor: string,
    requerido = false,
    alto = 18
  ): number {
    this.merge(sheet, row, 1, row, 2);
    this.estiloLabel(sheet.getCell(row, 1), label, requerido);
    this.merge(sheet, row, 3, row, LAST);
    this.estiloValor(sheet.getCell(row, 3), valor);
    this.bordes(sheet, row);
    sheet.getRow(row).height = alto;
    return row + 1;
  }

  private campo2(
    sheet: ExcelJS.Worksheet,
    row: number,
    label1: string,
    valor1: string,
    req1: boolean,
    label2: string,
    valor2: string,
    req2: boolean
  ): number {
    this.merge(sheet, row, 1, row, 2);
    this.estiloLabel(sheet.getCell(row, 1), label1, req1);
    this.merge(sheet, row, 3, row, 6);
    this.estiloValor(sheet.getCell(row, 3), valor1, false);
    this.merge(sheet, row, 7, row, 8);
    this.estiloLabel(sheet.getCell(row, 7), label2, req2);
    this.merge(sheet, row, 9, row, LAST);
    this.estiloValor(sheet.getCell(row, 9), valor2);
    this.bordes(sheet, row);
    sheet.getRow(row).height = 22;
    return row + 1;
  }

  private area(sheet: ExcelJS.Worksheet, row: number, label: string, valor: string, requerido = false): number {
    this.merge(sheet, row, 1, row, 2);
    this.estiloLabel(sheet.getCell(row, 1), label, requerido);
    this.merge(sheet, row, 3, row, LAST);
    this.estiloValor(sheet.getCell(row, 3), valor);
    sheet.getCell(row, 1).alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
    this.bordes(sheet, row);
    sheet.getRow(row).height = Math.max(36, Math.min(72, 20 + Math.ceil((valor || '').length / 70) * 12));
    return row + 1;
  }

  private vitales(sheet: ExcelJS.Worksheet, row: number, celdas: string[], spans?: number[]): number {
    const anchos = spans ?? celdas.map(() => Math.floor(LAST / celdas.length));
    let col = 1;
    celdas.forEach((texto, i) => {
      const span = i === celdas.length - 1 ? LAST - col + 1 : anchos[i];
      const c2 = col + span - 1;
      this.merge(sheet, row, col, row, c2);
      this.estiloValor(sheet.getCell(row, col), texto, false);
      col = c2 + 1;
    });
    this.bordes(sheet, row);
    sheet.getRow(row).height = 20;
    return row + 1;
  }

  private tablaPlain(
    sheet: ExcelJS.Worksheet,
    row: number,
    headers: Array<{ titulo: string; span: number }>,
    filas: string[][]
  ): number {
    let col = 1;
    const rangos: Array<[number, number]> = [];
    headers.forEach((h, i) => {
      const c2 = i === headers.length - 1 ? LAST : col + h.span - 1;
      this.merge(sheet, row, col, row, c2);
      const cell = sheet.getCell(row, col);
      cell.value = h.titulo;
      cell.font = { bold: true, size: 8, color: { argb: COLOR_TEXTO } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      rangos.push([col, c2]);
      col = c2 + 1;
    });
    this.bordes(sheet, row);
    sheet.getRow(row).height = 16;
    row++;

    const data = filas.length ? filas : [headers.map(() => '')];
    for (const valores of data) {
      valores.forEach((valor, i) => {
        const [c1, c2] = rangos[i];
        this.merge(sheet, row, c1, row, c2);
        this.estiloValor(sheet.getCell(row, c1), valor ?? '');
      });
      this.bordes(sheet, row);
      sheet.getRow(row).height = 18;
      row++;
    }
    return row;
  }

  private miniLabelValor(
    sheet: ExcelJS.Worksheet,
    row: number,
    c1: number,
    c2: number,
    label: string,
    valor: string
  ): void {
    this.estiloLabel(sheet.getCell(row, c1), label, false);
    if (c2 > c1) {
      this.merge(sheet, row, c1 + 1, row, c2);
      this.estiloValor(sheet.getCell(row, c1 + 1), valor);
    } else {
      sheet.getCell(row, c1).value = `${label}  ${this.dato(valor)}`;
    }
  }

  private estiloLabel(cell: ExcelJS.Cell, texto: string, requerido: boolean, fill = COLOR_LABEL): void {
    cell.fill = this.relleno(fill);
    cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    if (requerido) {
      cell.value = {
        richText: [
          { text: '* ', font: { bold: true, size: 8, color: { argb: COLOR_ASTERISCO } } },
          { text: texto, font: { bold: true, size: 8, color: { argb: COLOR_TEXTO } } }
        ]
      };
    } else {
      cell.value = texto;
      cell.font = { bold: true, size: 8, color: { argb: COLOR_TEXTO } };
    }
  }

  private estiloValor(cell: ExcelJS.Cell, valor: string, wrap = true): void {
    const vacio = !valor || !valor.trim() || valor.trim() === 'Sin dato';
    const esOpcion = /[○●☐☑]/.test(valor || '');
    if (vacio && !esOpcion) {
      cell.value = 'Sin dato';
      cell.font = { italic: true, size: 9, color: { argb: COLOR_SIN_DATO } };
    } else {
      cell.value = valor;
      cell.font = { size: 9, color: { argb: COLOR_TEXTO } };
    }
    cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: wrap };
  }

  private radios(opciones: Array<[string, string]>, seleccionado: string, otro?: string): string {
    const partes = opciones.map(([valor, label]) => `${seleccionado === valor ? '●' : '○'} ${label}`);
    const extra = seleccionado === 'otro' && otro ? `  ${otro}` : '';
    return partes.join('   ') + extra;
  }

  private checks(opciones: readonly string[], seleccionados: string[]): string {
    return opciones
      .map(op => `${seleccionados.includes(op) ? '☑' : '☐'} ${op}`)
      .join('   ');
  }

  private dato(valor: string): string {
    return valor?.trim() ? valor.trim() : 'Sin dato';
  }

  private fmtFechaHora(valor: string): string {
    return valor ? valor.replace('T', ' ') : '';
  }

  private merge(sheet: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number): void {
    if (r1 === r2 && c1 === c2) {
      return;
    }
    sheet.mergeCells(r1, c1, r2, c2);
  }

  private bordes(sheet: ExcelJS.Worksheet, row: number): void {
    for (let c = 1; c <= LAST; c++) {
      sheet.getCell(row, c).border = this.borde;
    }
  }

  private relleno(argb: string): ExcelJS.Fill {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
  }

  private insertarLogo(sheet: ExcelJS.Worksheet, logoDataUrl: string | null | undefined): boolean {
    const parsed = this.parseDataUrl(logoDataUrl);
    if (!parsed) {
      return false;
    }

    const natural = this.readImageSize(parsed.buffer, parsed.extension);
    const maxW = 160;
    const maxH = 52;
    const srcW = natural?.width || 400;
    const srcH = natural?.height || 140;
    const scale = Math.min(maxW / srcW, maxH / srcH);
    const width = Math.max(1, Math.round(srcW * scale));
    const height = Math.max(1, Math.round(srcH * scale));
    const posicion = {
      tl: { col: 0.25, row: 0.35 },
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
    } else if (!(/^[A-Za-z0-9+/=]+$/.test(base64) && base64.length > 100)) {
      return null;
    }

    if (mime.includes('svg')) {
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

  private readImageSize(
    buffer: Uint8Array,
    extension: 'png' | 'jpeg' | 'gif'
  ): { width: number; height: number } | null {
    try {
      if (extension === 'png' && buffer.length >= 24) {
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

  private async descargar(
    workbook: ExcelJS.Workbook,
    tipo: TipoTrasladoAsistencial,
    documento: string
  ): Promise<string> {
    const safeDoc = (documento || '').replace(/\W/g, '') || 'sin_documento';
    const fecha = new Date().toISOString().slice(0, 10);
    const prefijo = tipo === 'secundario' || tipo === 'secundarioCompleto'
      ? 'Hoja_Traslado_Secundario'
      : 'Hoja_Traslado_Primario';
    const filename = `${prefijo}_${safeDoc}_${fecha}.xlsx`;

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
