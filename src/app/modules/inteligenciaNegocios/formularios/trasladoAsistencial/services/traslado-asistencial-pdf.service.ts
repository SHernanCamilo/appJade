import { Injectable } from '@angular/core';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';

import {
  CAUSAS_ATENCION,
  GRUPOS_SERVICIO_TRASLADO,
  HistoriaTrasladoAsistencial,
  TipoTrasladoAsistencial,
  glasgowTotal
} from '../models/traslado-asistencial.model';
import { TrasladoExportOptions } from './traslado-asistencial-export.service';

(pdfMake as unknown as { vfs: Record<string, string> }).vfs =
  (pdfFonts as unknown as { vfs: Record<string, string> }).vfs;

const NAVY = '#002060';
const BORDER = '#1f2937';
const LABEL_BG = '#f9fafb';
const SUB_BG = '#f8fafc';
const GLASGOW_SEL = '#dbeafe';
const GLASGOW_TOTAL = '#fffbeb';

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
export class TrasladoAsistencialPdfService {
  async exportar(options: TrasladoExportOptions): Promise<string> {
    const { tipo, form, titulo, codigo, empresaNombre, logoDataUrl } = options;
    const content: Content[] = [
      this.encabezado(titulo, codigo, empresaNombre, logoDataUrl),
      ...this.cuerpo(tipo, form)
    ];

    const doc: TDocumentDefinitions = {
      pageSize: 'LETTER',
      pageMargins: [28, 24, 28, 32],
      content,
      footer: (currentPage, pageCount) => ({
        text: `Página ${currentPage} de ${pageCount}`,
        alignment: 'right',
        fontSize: 7,
        color: '#6b7280',
        margin: [28, 0, 28, 0]
      }),
      styles: {
        titulo: { fontSize: 10, bold: true, color: '#111827', alignment: 'center' },
        metaLabel: { fontSize: 6.5, bold: true, color: '#111827', alignment: 'center' },
        metaValor: { fontSize: 7, color: '#111827', alignment: 'center' },
        section: { fontSize: 8, bold: true, color: '#ffffff' },
        label: { fontSize: 7.5, bold: true, color: '#111827' },
        value: { fontSize: 8, color: '#111827' },
        sub: { fontSize: 7.5, bold: true, color: '#111827' },
        glasgowHead: { fontSize: 7, bold: true, color: '#ffffff', alignment: 'center' },
        glasgowItem: { fontSize: 7, color: '#111827' }
      },
      defaultStyle: { font: 'Roboto' }
    };

    const fileName = this.nombreArchivo(tipo, form.numeroIdentificacion);
    pdfMake.createPdf(doc).download(fileName);
    return fileName;
  }

  private cuerpo(tipo: TipoTrasladoAsistencial, form: HistoriaTrasladoAsistencial): Content[] {
    if (tipo === 'primario') {
      return this.primario(form);
    }
    if (tipo === 'secundario') {
      return this.secundario(form);
    }
    return this.completo(form, tipo === 'secundarioCompleto');
  }

  private primario(form: HistoriaTrasladoAsistencial): Content[] {
    return [
      this.seccion('DATOS DE LA PERSONA'),
      this.fila('Nombres y apellidos', form.nombresApellidos),
      this.fila2(
        'Tipo de documento',
        this.radios([['as', 'AS'], ['ms', 'MS'], ['rc', 'RC'], ['ti', 'TI'], ['cc', 'CC'], ['ce', 'CE'], ['otro', 'Otros']], form.tipoIdentificacion, form.tipoIdentificacionOtro),
        'Número de documento',
        form.numeroIdentificacion
      ),
      this.fila2('Lugar de expedición', form.lugarExpedicion, 'Fecha de nacimiento', form.fechaNacimiento),
      this.fila2(
        'Edad',
        this.conRadios(`${this.dato(form.edad)}   `, this.radios([['anos', 'Años'], ['meses', 'Meses'], ['dias', 'Días']], form.edadUnidad)),
        'Sexo biológico',
        this.radios([['femenino', 'Femenino'], ['masculino', 'Masculino']], form.sexo)
      ),
      this.fila2('Ocupación', form.ocupacion, 'Teléfono', form.telefono),
      this.fila2('Estado civil', form.estadoCivil, 'Correo email', form.correoEmail),
      this.fila2(
        'Dirección de residencia',
        form.direccionResidencia,
        'Zona de residencia',
        this.radios([['urbano', 'Urbana'], ['rural', 'Rural']], form.zonaResidencia)
      ),
      this.seccion('TIEMPOS DEL SERVICIO Y ESCENA'),
      this.fila2('Hora del despacho', form.horaDespacho, 'Hora de llegada al lugar de la escena', form.horaLlegadaEscena),
      this.fila2('Triage del paciente en escena', form.signosInicio.triage, 'Hora de salida del lugar de la escena', form.horaSalidaEscena),
      ...this.procedimientos(form),
      ...this.examenFisico(form),
      this.seccion('ORIGEN, DESTINO Y ESTADO'),
      this.lugar('Lugar de origen', {
        Departamento: form.origenDepartamento,
        Municipio: form.origenMunicipio,
        Localidad: form.origenLocalidad,
        Barrio: form.origenBarrio,
        Dirección: form.origenDireccion
      }),
      this.fila2('Hora de llegada de la ambulancia al servicio', form.horaLlegadaServicio, 'Código REPS de la institución receptora', form.destino1Reps),
      this.fila2(
        'Hora de recepción del paciente por la institución',
        form.horaRecepcion,
        'Estado del paciente al ingreso',
        this.radios([['vivo', 'Vivo'], ['muerto', 'Muerto']], form.estadoFinal)
      ),
      ...this.acompanante(form),
      ...this.tripulacion(form, false),
      ...this.profesional(form)
    ];
  }

  private secundario(form: HistoriaTrasladoAsistencial): Content[] {
    return [
      this.seccion('DATOS DE LA PERSONA'),
      this.fila('Nombres y apellidos', form.nombresApellidos),
      this.fila2(
        'Tipo de documento',
        this.radios([['msi', 'MSI'], ['rc', 'RC'], ['ti', 'TI'], ['cc', 'CC'], ['ce', 'CE'], ['otro', 'Otro']], form.tipoIdentificacion, form.tipoIdentificacionOtro),
        'Número de documento',
        form.numeroIdentificacion
      ),
      this.fila2(
        'Edad',
        this.conRadios(`${this.dato(form.edad)}   `, this.radios([['anos', 'Años'], ['meses', 'Meses'], ['dias', 'Días'], ['horas', 'Horas']], form.edadUnidad)),
        'Sexo biológico',
        this.radios([['femenino', 'Femenino'], ['masculino', 'Masculino']], form.sexo)
      ),
      this.fila('Grupo de servicio al cual es trasladada la persona', this.checks(GRUPOS_SERVICIO_TRASLADO, form.gruposServicio)),
      ...this.procedimientos(form),
      this.seccion('RECORRIDO, ORIGEN Y DESTINO'),
      this.fila2('Fecha y hora de inicio del recorrido', this.fmtFechaHora(form.fechaHoraInicioRecorrido), 'Fecha y hora de finalización del recorrido', this.fmtFechaHora(form.fechaHoraFinRecorrido)),
      this.lugar('Lugar de origen', {
        REPS: form.origenReps,
        Departamento: form.origenDepartamento,
        Municipio: form.origenMunicipio,
        Localidad: form.origenLocalidad,
        Barrio: form.origenBarrio,
        Dirección: form.origenDireccion
      }),
      this.lugar('Lugar de destino', {
        REPS: form.destino1Reps,
        Departamento: form.destinoDepartamento,
        Municipio: form.destinoMunicipio,
        Localidad: form.destinoLocalidad,
        Barrio: form.destinoBarrio,
        Dirección: form.destinoDireccion
      }),
      this.fila2(
        'Estado al finalizar el traslado',
        this.radios([['vivo', 'Vivo'], ['muerto', 'Muerto']], form.estadoFinal),
        'Traslado redondo',
        this.conRadios('', this.radios([['si', 'Sí'], ['no', 'No']], form.trasladoRedondo), `    Horas de espera: ${this.dato(form.horasEspera)}`)
      ),
      this.fila(
        'Distancia del recorrido',
        this.conRadios('', this.radios([['km', 'Kilómetros'], ['millas', 'Millas']], form.unidadDistancia), `    Iniciales: ${this.dato(form.kmInicio)}    Finales: ${this.dato(form.kmFinales)}`)
      ),
      ...this.acompanante(form),
      ...this.tripulacion(form, true),
      ...this.profesional(form),
      this.seccion('INGRESO A PRESTADOR DURANTE EL RECORRIDO'),
      this.fila('Causa (complicación o deterioro)', form.causaDesvio),
      this.fila2('Nombre del prestador', form.prestadorDesvio, 'Kilómetros de desviación', form.kmDesviacion),
      this.fila('Tiempo utilizado', form.tiempoAtencionDesvio)
    ];
  }

  private completo(form: HistoriaTrasladoAsistencial, esSecundario: boolean): Content[] {
    const extraServicio: Content[] = esSecundario
      ? [
          this.fila2('IPS origen', form.ipsOrigen, 'Servicio origen', form.servicioOrigen),
          this.fila2('Médico que remite', form.medicoRemite, 'Médico que recibe', form.medicoRecibe)
        ]
      : [];

    return [
      this.seccion('RÉCORD DE TRASLADO E IDENTIFICACIÓN'),
      this.fila2('Número de récord', form.recordNumero, 'Identificación', form.identificacionNumero),
      this.fila2('Autorización número', form.autorizacionNumero, 'Unidad', form.unidad),
      this.fila2('Recibo de caja', form.reciboCajaNumero, 'Fecha atención', form.fechaAtencion),
      this.seccion('DATOS DEL SERVICIO'),
      this.fila('Convenio', form.convenio),
      ...extraServicio,
      this.fila2('Origen', form.origen, 'Código REPS origen', form.origenReps),
      this.fila2('Destino 1', form.destino1, 'Código REPS destino 1', form.destino1Reps),
      this.fila2('Destino 2', form.destino2, 'Código REPS destino 2', form.destino2Reps),
      this.fila('Complejidad', this.radios([['baja', 'Complejidad baja'], ['mediana', 'Complejidad mediana']], form.complejidad)),
      this.fila2(
        'Tipo de transporte',
        this.radios([['terrestre', 'Terrestre'], ['aereo', 'Aéreo']], form.tipoTransporte),
        'Tipo de traslado',
        this.radios([['local', 'Local'], ['intermunicipal', 'Intermunicipal']], form.tipoTraslado)
      ),
      this.fila('Grupo de servicio', this.checks(GRUPOS_SERVICIO_TRASLADO, form.gruposServicio)),
      this.seccion('DATOS DEL PACIENTE'),
      this.fila('Nombres y apellidos', form.nombresApellidos),
      this.fila2(
        'Edad',
        this.conRadios(`${this.dato(form.edad)}   `, this.radios([['anos', 'Años'], ['meses', 'Meses'], ['dias', 'Días'], ['horas', 'Horas']], form.edadUnidad)),
        'Sexo',
        this.radios([['femenino', 'Femenino'], ['masculino', 'Masculino']], form.sexo)
      ),
      this.fila2('Número de identificación', form.numeroIdentificacion, 'Diagnóstico principal', form.diagnosticoPrincipal),
      ...this.examenFisico(form, esSecundario),
      ...this.procedimientos(form),
      this.fila('Estado al finalizar el traslado', this.radios([['vivo', 'Vivo'], ['muerto', 'Muerto']], form.estadoFinal)),
      ...this.tripulacion(form, true),
      ...this.profesional(form)
    ];
  }

  private procedimientos(form: HistoriaTrasladoAsistencial): Content[] {
    const procs = form.procedimientos.length
      ? form.procedimientos.map(f => [this.dato(f.cupsProcedimientos), this.dato(f.procedimientos)])
      : [['Sin dato', 'Sin dato']];
    const meds = form.medicamentos.length
      ? form.medicamentos.map(m => [this.dato(m.codigoCumIum), this.dato(m.nombre)])
      : [['Sin dato', 'Sin dato']];

    return [
      this.seccion('PROCEDIMIENTOS, MEDICAMENTOS Y CÓDIGO DE TRASLADO'),
      this.sub('Procedimientos realizados durante el traslado (CUPS)'),
      this.tabla(['CÓDIGO CUPS', 'PROCEDIMIENTOS'], procs, [90, '*']),
      this.sub('Medicamentos (CUMS o IUMS) y dispositivos médicos utilizados'),
      this.tabla(['CÓDIGO CUM O IUM', 'NOMBRE DEL MEDICAMENTO'], meds, [90, '*']),
      this.fila('Dispositivos médicos', form.insumos),
      this.fila('Código de traslado (CUPS)', form.cupsTraslado)
    ];
  }

  private examenFisico(form: HistoriaTrasladoAsistencial, esSecundario = false): Content[] {
    const s = form.signosInicio;
    return [
      this.seccion('EXAMEN FÍSICO'),
      this.causasAtencion(form),
      this.sub('Signos vitales al inicio del traslado:'),
      this.vitales([
        `Tensión arterial  ${this.dato(s.taSistolica)}  /  ${this.dato(s.taDiastolica)}  mmHg`,
        `TAM  ${this.dato(s.tamSistolica)}  /  ${this.dato(s.tamDiastolica)}  mmHg`,
        `FC  ${this.dato(s.fc)}  lpm`,
        `FR  ${this.dato(s.fr)}  rpm`
      ]),
      this.vitales([
        `Temperatura  ${this.dato(s.temperatura)}  °C`,
        `FCF  ${this.dato(s.fcf)}  lpm`,
        `Pupila der.  ${this.dato(s.pupilaDerecha)}  mm`,
        `Pupila izq.  ${this.dato(s.pupilaIzquierda)}  mm`
      ]),
      this.vitales([
        `SPO2  ${this.dato(s.spo2)}  %`,
        `Triage del paciente en escena:  ${this.dato(s.triage)}`
      ]),
      this.glasgow(form),
      this.fila(esSecundario ? 'Resumen clínico' : 'Motivo de consulta', esSecundario ? form.resumenClinico : form.motivoConsulta),
      this.fila('Enfermedad actual', form.enfermedadActual)
    ];
  }

  private acompanante(form: HistoriaTrasladoAsistencial): Content[] {
    return [
      this.seccion('ACOMPAÑANTE'),
      this.fila('Nombres y apellidos', form.nombreAcompanante),
      this.fila2(
        'Tipo de documento',
        this.radios([['cc', 'CC'], ['ti', 'TI'], ['ce', 'CE'], ['otro', 'Otro']], form.acompananteTipoId),
        'Número',
        form.acompananteNumeroId
      ),
      this.fila('Relación / parentesco', form.parentesco)
    ];
  }

  private tripulacion(form: HistoriaTrasladoAsistencial, incluirMedico: boolean): Content[] {
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

    const header = roles.map(r => this.celda(r.titulo, { style: 'label', alignment: 'center', fillColor: LABEL_BG }));
    const nombres = roles.map(r => this.celda(this.dato(r.persona.nombre), { style: 'value' }));
    const docs = roles.map(r =>
      this.celda(`Tipo  ${this.dato(r.persona.tipoDocumento)}      N°  ${this.dato(r.persona.documento)}`, { style: 'value' })
    );

    return [
      this.seccion('TRIPULACIÓN'),
      this.sub('Nombres, tipo y número de documento de la tripulación'),
      {
        table: {
          widths: roles.map(() => '*'),
          body: [header, nombres, docs]
        },
        layout: this.grid(),
        margin: [0, 0, 0, 4]
      }
    ];
  }

  private profesional(form: HistoriaTrasladoAsistencial): Content[] {
    return [
      this.seccion('PROFESIONAL QUE RECIBE'),
      this.fila('Nombres y apellidos', form.profesionalDestino1),
      this.fila2(
        'Tipo de documento',
        this.radios([['cc', 'CC'], ['ce', 'CE'], ['otro', 'Otro']], form.profesionalRecibeTipoId),
        'Número de documento',
        form.profesionalDestino1Cc
      )
    ];
  }

  private encabezado(
    titulo: string,
    codigo: string,
    empresaNombre?: string,
    logoDataUrl?: string | null
  ): Content {
    const logo: TableCell = logoDataUrl
      ? { image: logoDataUrl, fit: [72, 24], alignment: 'center', margin: [4, 8, 4, 8] }
      : { text: empresaNombre || 'Clínica Medilaser S.A.S.', style: 'label', alignment: 'center', color: '#1d4ed8', margin: [4, 10, 4, 10] };

    return {
      table: {
        widths: [88, '*', 118],
        body: [[
          logo,
          { text: titulo, style: 'titulo', margin: [6, 10, 6, 10] },
          {
            table: {
              widths: [48, '*'],
              body: [
                [this.celda('VERSIÓN', { style: 'metaLabel', fillColor: '#f3f4f6' }), this.celda('4', { style: 'metaValor' })],
                [this.celda('VIGENCIA', { style: 'metaLabel', fillColor: '#f3f4f6' }), this.celda('mar-24', { style: 'metaValor' })],
                [this.celda('CÓDIGO', { style: 'metaLabel', fillColor: '#f3f4f6' }), this.celda(codigo, { style: 'metaValor' })],
                [this.celda('PÁGINA', { style: 'metaLabel', fillColor: '#f3f4f6' }), this.celda('1 de 1', { style: 'metaValor' })]
              ]
            },
            layout: this.grid()
          }
        ]]
      },
      layout: this.grid(),
      margin: [0, 0, 0, 0]
    };
  }

  private seccion(titulo: string): Content {
    return {
      table: {
        widths: ['*'],
        body: [[{ text: titulo, style: 'section', fillColor: NAVY, margin: [6, 4, 6, 4] }]]
      },
      layout: this.grid(),
      margin: [0, 6, 0, 0]
    };
  }

  private sub(texto: string): Content {
    return {
      table: {
        widths: ['*'],
        body: [[{ text: texto, style: 'sub', fillColor: SUB_BG, margin: [6, 3, 6, 3] }]]
      },
      layout: this.grid()
    };
  }

  private fila(label: string, valor: string | Content[]): Content {
    return {
      table: {
        widths: [110, '*'],
        body: [[
          this.celda(label, { style: 'label', fillColor: LABEL_BG }),
          this.valorCelda(valor)
        ]]
      },
      layout: this.grid()
    };
  }

  private fila2(label1: string, valor1: string | Content[], label2: string, valor2: string | Content[]): Content {
    return {
      table: {
        widths: [110, '*', 110, '*'],
        body: [[
          this.celda(label1, { style: 'label', fillColor: LABEL_BG }),
          this.valorCelda(valor1),
          this.celda(label2, { style: 'label', fillColor: LABEL_BG }),
          this.valorCelda(valor2)
        ]]
      },
      layout: this.grid()
    };
  }

  private causasAtencion(form: HistoriaTrasladoAsistencial): Content {
    const seleccionado = form.causaAtencion[0] || '';
    const primera = CAUSAS_ATENCION.slice(0, 4).map(op => [op, op] as [string, string]);
    const segunda = CAUSAS_ATENCION.slice(4).map(op => [op, op] as [string, string]);
    const linea2 = this.radios(segunda, seleccionado);
    if (seleccionado === 'Otra') {
      linea2.push({
        text: `  ${form.causaAtencionOtra?.trim() || 'Sin dato'}`,
        fontSize: 8,
        color: '#111827'
      });
    }

    return {
      table: {
        widths: [110, '*'],
        body: [[
          this.celda('Causa de la atención', { style: 'label', fillColor: LABEL_BG }),
          {
            stack: [
              { text: this.radios(primera, seleccionado), margin: [4, 3, 4, 2] },
              { text: linea2, margin: [4, 2, 4, 3] }
            ]
          }
        ]]
      },
      layout: this.grid()
    };
  }

  private lugar(titulo: string, campos: Record<string, string>): Content {
    const extras = Object.entries(campos).filter(([k]) => k !== 'Dirección');
    const lineas = extras.map(([k, v]) => `${k}: ${this.dato(v)}`).join('    ');
    const direccion = campos['Dirección'];
    const valor = direccion !== undefined ? `${lineas}\nDirección: ${this.dato(direccion)}` : lineas;
    return this.fila(titulo, valor);
  }

  private vitales(items: string[]): Content {
    return {
      table: {
        widths: items.map(() => '*'),
        body: [items.map(item => this.celda(item, { style: 'value' }))]
      },
      layout: this.grid()
    };
  }

  private glasgow(form: HistoriaTrasladoAsistencial): Content {
    const total = glasgowTotal(form.glasgow);
    const max = Math.max(GLASGOW_MOTORA.length, GLASGOW_VERBAL.length, GLASGOW_OCULAR.length);
    const header: TableCell[] = [
      { text: 'Respuesta motora', style: 'glasgowHead', fillColor: NAVY, colSpan: 2, margin: [4, 3, 4, 3] },
      {},
      { text: 'Respuesta verbal', style: 'glasgowHead', fillColor: NAVY, colSpan: 2, margin: [4, 3, 4, 3] },
      {},
      { text: 'Apertura ocular', style: 'glasgowHead', fillColor: NAVY, colSpan: 2, margin: [4, 3, 4, 3] },
      {},
      {
        text: `Total\n\nGlasgow: ${total === '' ? 'Sin dato' : total} / 15 puntos`,
        rowSpan: max + 1,
        bold: true,
        fontSize: 8,
        alignment: 'center',
        fillColor: GLASGOW_TOTAL,
        margin: [4, 22, 4, 8]
      }
    ];

    const body: TableCell[][] = [header];
    for (let i = 0; i < max; i++) {
      body.push([
        ...this.glasgowCeldas(GLASGOW_MOTORA[i], form.glasgow.motora),
        ...this.glasgowCeldas(GLASGOW_VERBAL[i], form.glasgow.verbal),
        ...this.glasgowCeldas(GLASGOW_OCULAR[i], form.glasgow.ocular),
        {}
      ]);
    }

    return {
      unbreakable: true,
      table: {
        widths: ['*', 16, '*', 16, '*', 16, 88],
        dontBreakRows: true,
        body
      },
      layout: this.grid()
    };
  }

  private glasgowCeldas(
    op: { valor: number; label: string } | undefined,
    seleccionado: number | null
  ): TableCell[] {
    if (!op) {
      return [
        this.celda('', { style: 'glasgowItem' }),
        this.celda('', { style: 'glasgowItem' })
      ];
    }
    const sel = seleccionado === op.valor;
    return [
      this.celda(op.label, { style: 'glasgowItem', bold: sel, fillColor: sel ? GLASGOW_SEL : undefined }),
      this.celda(String(op.valor), { style: 'glasgowItem', bold: true, alignment: 'center', fillColor: sel ? GLASGOW_SEL : undefined })
    ];
  }

  private tabla(headers: string[], rows: string[][], widths: Array<string | number>): Content {
    return {
      table: {
        widths,
        headerRows: 1,
        body: [
          headers.map(h => this.celda(h, { style: 'label', fillColor: LABEL_BG, alignment: 'center' })),
          ...rows.map(r => r.map(c => this.celda(c, { style: 'value' })))
        ]
      },
      layout: this.grid()
    };
  }

  private celda(text: string, extra: Record<string, unknown> = {}): TableCell {
    return {
      text,
      margin: [4, 3, 4, 3],
      ...extra
    } as TableCell;
  }

  private grid() {
    return {
      hLineWidth: () => 0.6,
      vLineWidth: () => 0.6,
      hLineColor: () => BORDER,
      vLineColor: () => BORDER,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0
    };
  }

  private radios(opciones: Array<[string, string]>, seleccionado: string, otro?: string): Content[] {
    const partes: Content[] = [];
    opciones.forEach(([valor, label], i) => {
      if (i > 0) {
        partes.push({ text: '   ', fontSize: 8 });
      }
      const marcado = seleccionado === valor;
      partes.push({
        text: marcado ? '●' : '○',
        fontSize: marcado ? 14 : 12,
        bold: true,
        color: '#111827'
      });
      partes.push({ text: ` ${label}`, fontSize: 8, color: '#111827' });
    });
    if (seleccionado === 'otro' && otro) {
      partes.push({ text: `  ${otro}`, fontSize: 8, color: '#111827' });
    }
    return partes;
  }

  private conRadios(antes: string, radios: Content[], despues = ''): Content[] {
    const partes: Content[] = [];
    if (antes) {
      partes.push({ text: antes, fontSize: 8, color: '#111827' });
    }
    partes.push(...radios);
    if (despues) {
      partes.push({ text: despues, fontSize: 8, color: '#111827' });
    }
    return partes;
  }

  private valorCelda(valor: string | Content[]): TableCell {
    if (Array.isArray(valor)) {
      return { text: valor, margin: [4, 2, 4, 2] } as TableCell;
    }
    return this.celda(this.dato(valor), { style: 'value' });
  }

  private checks(opciones: readonly string[], seleccionados: string[]): string {
    return opciones.map(op => `${op} ${seleccionados.includes(op) ? '_X_' : '___'}`).join('     ');
  }

  private dato(valor: string | null | undefined): string {
    return valor?.trim() ? valor.trim() : 'Sin dato';
  }

  private fmtFechaHora(valor: string): string {
    return valor ? valor.replace('T', ' ') : '';
  }

  private nombreArchivo(tipo: TipoTrasladoAsistencial, documento: string): string {
    const kind = tipo.includes('secundario') ? 'secundario' : 'primario';
    const doc = (documento || 'sin-documento').replace(/\W+/g, '_');
    const fecha = new Date().toISOString().slice(0, 10);
    return `Traslado_${kind}_${doc}_${fecha}.pdf`;
  }
}
