import { Injectable } from '@angular/core';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';

import { HistoriaTrasladoAsistencial } from '../models/traslado-asistencial.model';
import { TrasladoExportOptions } from './traslado-asistencial-export.service';

(pdfMake as unknown as { vfs: Record<string, string> }).vfs =
  (pdfFonts as unknown as { vfs: Record<string, string> }).vfs;

const NAVY = '#002060';
const BORDER = '#1f2937';
const LABEL_BG = '#f3f4f6';
const LINEA = '____________________';

const RIESGOS = [
  'Los generales que implica la atención asistencial de personas en el área de salud, como: desplazamiento de dispositivos médicos como tubos endotraqueal, vías venosas periféricas, catéteres venosos centrales, sondas de alimentación, sondas vesicales y/o uretrales, drenajes pleurales, entre otros; fallas de equipos, reacciones adversas a medicamentos o insumos, y otros que aun estando bajo vigilancia y control de calidad permanente, son un riesgo inevitable dentro del quehacer asistencial.',
  'Los generales de índole médico dependientes de la enfermedad de base y de los requerimientos de monitorización y tratamiento que ésta determina. Así como aquellos asociados a otros factores de la condición de salud y patologías previas que pueden o no haber sido diagnosticadas y que pueden generar riesgos o complicaciones de un modo inevitable e imprevisible durante la realización del procedimiento como en la etapa posterior a éste.',
  'Molestias propias de un traslado vía terrestre: sensación de abombamiento o dolor de oídos, sequedad ambiental, mareos, náuseas, sensaciones térmicas de frío o calor, aquellas producidas por el ruido y vibraciones propias del vehículo de transporte utilizado.',
  'Incumplimiento en itinerarios como retrasos, suspensiones o cambios de destino por razones de índole médicas, de tráfico, climatológicas u otras de fuerza mayor.'
];

@Injectable({ providedIn: 'root' })
export class TrasladoConsentimientoPdfService {
  async exportar(options: TrasladoExportOptions): Promise<string> {
    const { form, empresaNombre, logoDataUrl } = options;
    const fecha = this.fechaDocumento(form.fechaAtencion);
    const doc: TDocumentDefinitions = {
      pageSize: 'LETTER',
      pageMargins: [28, 78, 28, 32],
      header: (currentPage, pageCount) =>
        this.encabezado(empresaNombre, logoDataUrl, currentPage, pageCount),
      content: this.cuerpo(form, fecha),
      footer: () => ({
        text: 'Clínica Medilaser S.A.S.  ·  F-AU-1171 MD  ·  Consentimiento informado para traslado asistencial',
        alignment: 'center',
        fontSize: 7,
        color: '#6b7280',
        margin: [28, 4, 28, 0]
      }),
      defaultStyle: { font: 'Roboto', fontSize: 8, color: '#111827' }
    };

    const fileName = this.nombreArchivo(form.numeroIdentificacion);
    pdfMake.createPdf(doc).download(fileName);
    return fileName;
  }

  private cuerpo(form: HistoriaTrasladoAsistencial, fecha: string): Content[] {
    const firmante = this.firmante(form);
    const profesional = this.profesional(form);
    return [
      this.lineaCabecera(fecha),
      this.datosUsuario(form),
      this.parrafo(
        'La información que le vamos a suministrar a continuación está relacionada con su estado de salud y el traslado de paciente; este documento sirve para que usted, o quien lo represente, dé o no su consentimiento para realizar este procedimiento, eso significa que nos autoriza o no a realizarlo. Antes de firmar, es importante que lea despacio y entienda toda la información aquí registrada y si tiene alguna duda o necesita más información no dude en preguntarnos, lo atenderemos con mucho gusto.'
      ),
      this.seccion('INFORMACIÓN'),
      this.declaracion(firmante.nombre, form.nombresApellidos),
      this.parrafo('Además, declaro voluntariamente:', { bold: true, margin: [0, 4, 0, 2] }),
      this.parrafo('1. Haber entregado al médico tratante y/o equipo de salud de manera verídica, completa y fidedigna toda la información requerida y necesaria para el manejo de mi estado de salud (o del paciente) e historia clínica.'),
      this.parrafo('2. Que tras la valoración médica se decide el traslado dada la gravedad de la situación clínica y/o por necesidad terapéutica y/o realización de pruebas diagnósticas.'),
      this.parrafo('3. Haber sido debida y completamente informado(a) sobre todos los aspectos relacionados al procedimiento de traslado y sus riesgos, entre otros:'),
      ...RIESGOS.map(texto => this.parrafo(texto, { margin: [10, 1, 0, 2] })),
      this.parrafo('4. Haber sido informado de la necesidad de intercambio de información clínica y de aseguramiento, necesaria para la atención y obtención de beneficios entre los equipos médicos tratantes de la Clínica Medilaser S.A.S., de traslado, así como con mi aseguradora.'),
      this.seccion('DESCRIPCIÓN GRÁFICA DEL PROCEDIMIENTO (Aplica solo cuando sea necesario ampliar o complementar la información)'),
      this.cajaVacia(36),
      this.seccion('OBSERVACIONES ADICIONALES (diligenciado por el personal de la Clínica)'),
      this.cajaVacia(28),
      this.seccion('OBTENCIÓN DE LA VOLUNTAD DEL PACIENTE'),
      this.parrafo(
        'Doy constancia de que se me han explicado en lenguaje sencillo, claro y totalmente entendible para mí, los aspectos relacionados con el transporte asistencial y se me ha permitido hacer todas las preguntas necesarias, las cuales han sido resueltas satisfactoriamente. También comprendo que, en cualquier momento y sin necesidad de dar ninguna explicación, puedo solicitar la revocación de este consentimiento. Entiendo que aunque los resultados no pueden garantizarse, la Clínica Medilaser S.A.S. y los profesionales usarán todos los medios necesarios para obtener el mejor de los resultados.'
      ),
      this.opcion('Expreso mi decisión libre y voluntaria: para que me efectúen el procedimiento descrito anteriormente y los procedimientos complementarios que sean necesarios o convenientes durante la realización de este, a juicio de los profesionales que lo lleven a cabo.'),
      this.opcion('Aun habiendo comprendido, manifiesto abiertamente mi deseo voluntario de desistir de este procedimiento.'),
      this.parrafo(
        'Dejo constancia de que he sido informado, que la Clínica Medilaser S.A.S. es un centro de práctica docente, por lo cual en mi proceso de atención puede llegar a participar personal en formación, bajo la estricta supervisión y vigilancia de mi médico tratante, que actúa como docente. Ante lo cual manifiesto que SI _____  NO _____ ACEPTO, mi atención en estos términos.'
      ),
      this.parrafo(
        'Declaro que he sido informado sobre la posibilidad que la información correspondiente a mi historia clínica sea utilizada en estudios de investigación. Los datos que sean obtenidos en el estudio pueden ser publicados o difundidos con fines científicos, guardando total reserva de mi identidad. Ante lo cual manifiesto que SI _____  NO _____ ACEPTO, mi atención en estos términos.'
      ),
      this.parrafo(
        'Nota: En caso de que el paciente presente incapacidad física, mental o sea menor de edad, que le impida tomar la decisión sobre el procedimiento a seguir, esta decisión será tomada por el familiar responsable del paciente respetando, de ser posible, el siguiente orden: 1. Cónyuge o compañero permanente. 2. A falta de cónyuge, los hijos. 3. A falta de cónyuge e hijos, los padres. 4. A falta de 1, 2 y 3, los hermanos. 5. Otros familiares.',
        { italics: true, margin: [0, 4, 0, 6] }
      ),
      this.firmas(firmante, profesional, form.auxiliar1)
    ];
  }

  private encabezado(
    empresaNombre: string | undefined,
    logoDataUrl: string | null | undefined,
    pagina: number,
    total: number
  ): Content {
    const logo: TableCell = logoDataUrl
      ? { image: logoDataUrl, fit: [78, 26], alignment: 'center', margin: [2, 6, 2, 6] }
      : {
          text: empresaNombre || 'Clínica Medilaser S.A.S.',
          bold: true,
          fontSize: 7,
          color: '#1d4ed8',
          alignment: 'center',
          margin: [2, 8, 2, 8]
        };

    return {
      margin: [28, 10, 28, 0],
      table: {
        widths: [86, '*', 108],
        body: [[
          logo,
          {
            text: 'CONSENTIMIENTO INFORMADO PARA EL TRASLADO DE PACIENTES EN TRANSPORTE ASISTENCIAL Y ATENCIÓN PRE-HOSPITALARIA',
            bold: true,
            fontSize: 8,
            alignment: 'center',
            margin: [4, 6, 4, 6]
          },
          {
            table: {
              widths: [46, '*'],
              body: [
                [this.meta('VERSIÓN'), this.metaValor('1')],
                [this.meta('VIGENCIA'), this.metaValor('Nov. 2022')],
                [this.meta('CÓDIGO'), this.metaValor('F-AU-1171 MD')],
                [this.meta('PÁGINA'), this.metaValor(`${pagina} DE ${total}`)]
              ]
            },
            layout: this.grid()
          }
        ]]
      },
      layout: this.grid()
    };
  }

  private lineaCabecera(fecha: string): Content {
    return {
      margin: [0, 2, 0, 4],
      text: [
        { text: 'SUCURSAL: ', bold: true },
        { text: LINEA },
        { text: '    SEDE: ', bold: true },
        { text: LINEA },
        { text: '    FECHA: ', bold: true },
        { text: fecha, bold: true, decoration: 'underline' }
      ]
    };
  }

  private datosUsuario(form: HistoriaTrasladoAsistencial): Content {
    return {
      table: {
        widths: [130, '*', 70, '*'],
        body: [
          [
            this.etiqueta('NOMBRES Y APELLIDOS DEL USUARIO'),
            this.valor(form.nombresApellidos, 3),
            {},
            {}
          ],
          [
            this.etiqueta('HISTORIA CLÍNICA N°'),
            this.valor(this.historiaClinica(form)),
            this.etiqueta('EDAD'),
            this.valor(this.edad(form))
          ],
          [
            this.etiqueta('UNIDAD FUNCIONAL'),
            this.valor(this.unidadFuncional(form), 3),
            {},
            {}
          ],
          [
            this.etiqueta('DIAGNÓSTICO'),
            this.valor(this.diagnostico(form), 3),
            {},
            {}
          ]
        ]
      },
      layout: this.grid(),
      margin: [0, 0, 0, 6]
    };
  }

  private declaracion(quien: string, paciente: string): Content {
    return {
      text: [
        { text: 'Yo ' },
        this.nombreSubrayado(quien),
        { text: ', mayor de edad, identificado(a) como aparece al pie de mi firma, actuando en mi propio nombre o en mi calidad de representante/acudiente del paciente ' },
        this.nombreSubrayado(paciente),
        { text: ', por medio del presente documento, de manera expresa, libre, en pleno uso de mis facultades mentales, manifiesto que se me ha informado el requerimiento de traslado en la modalidad de transporte asistencial, con el fin de que se proporcione la atención médica y paramédica requerida, de acuerdo con la condición clínica. Otorgo mi autorización para que se realicen todas las intervenciones y procedimientos médicos que puedan llegar a ser necesarios durante el recorrido, según la condición clínica.' }
      ],
      alignment: 'justify',
      margin: [0, 4, 0, 2]
    };
  }

  private firmas(
    firmante: { nombre: string; documento: string; parentesco: string },
    profesional: { nombre: string; registro: string },
    auxiliar: HistoriaTrasladoAsistencial['auxiliar1'] | null
  ): Content {
    const auxiliarSeguro = this.tripulante(auxiliar);
    const auxRegistro = this.doc(auxiliarSeguro.tipoDocumento, auxiliarSeguro.documento);
    return {
      unbreakable: true,
      margin: [0, 4, 0, 8],
      table: {
        widths: [58, '*', 58, '*'],
        body: [
          [
            this.huella(),
            this.bloqueFirma('Firma del paciente o responsable', [
              ['Nombre', firmante.nombre],
              ['N° de documento de identidad', firmante.documento],
              ['Parentesco', firmante.parentesco]
            ]),
            this.huella(),
            this.bloqueFirma('Firma del médico o profesional', [
              ['Nombre', profesional.nombre],
              ['Registro N°', profesional.registro]
            ])
          ],
          [
            this.huella(),
            this.bloqueFirma('Firma del testigo', [
              ['Nombre', ''],
              ['N° de documento de identidad', ''],
              ['Calidad del testigo', '']
            ]),
            this.huella(),
            this.bloqueFirma('Firma de auxiliar de enfermería o técnico de atención prehospitalaria', [
              ['Nombre', auxiliarSeguro.nombre],
              ['Registro N°', auxRegistro]
            ])
          ]
        ]
      },
      layout: this.grid()
    };
  }

  private opcion(texto: string): Content {
    return {
      columnGap: 6,
      margin: [0, 3, 0, 3],
      columns: [
        {
          width: 12,
          table: {
            widths: [10],
            body: [[{ text: ' ', margin: [0, 3, 0, 3] }]]
          },
          layout: this.grid()
        },
        { width: '*', text: texto, alignment: 'justify' }
      ]
    };
  }

  private bloqueFirma(titulo: string, lineas: Array<[string, string]>): TableCell {
    const detalle: Content[] = lineas.map(([label, valor]) => ({
      text: [
        { text: `${label}: `, bold: true },
        { text: this.texto(valor) || LINEA }
      ],
      fontSize: 7.5,
      margin: [4, 1, 4, 1] as [number, number, number, number]
    }));

    return {
      stack: [
        { text: titulo, bold: true, fontSize: 7.5, margin: [4, 4, 4, 3] },
        ...detalle,
        { text: ' ', margin: [4, 8, 4, 2] }
      ]
    };
  }

  private huella(): TableCell {
    return {
      text: 'HUELLA',
      alignment: 'center',
      color: '#9ca3af',
      bold: true,
      fontSize: 7,
      margin: [2, 28, 2, 28]
    };
  }

  private seccion(titulo: string): Content {
    return {
      table: {
        widths: ['*'],
        body: [[{
          text: titulo,
          bold: true,
          color: '#ffffff',
          fillColor: NAVY,
          fontSize: 7.5,
          margin: [4, 3, 4, 3]
        }]]
      },
      layout: this.grid(),
      margin: [0, 6, 0, 0]
    };
  }

  private cajaVacia(alto: number): Content {
    return {
      table: {
        widths: ['*'],
        body: [[{ text: ' ', margin: [4, alto, 4, 4] }]]
      },
      layout: this.grid()
    };
  }

  private parrafo(
    texto: string,
    extra: { bold?: boolean; italics?: boolean; margin?: [number, number, number, number] } = {}
  ): Content {
    return {
      text: texto,
      alignment: 'justify',
      bold: extra.bold,
      italics: extra.italics,
      margin: extra.margin ?? [0, 2, 0, 2]
    };
  }

  private etiqueta(texto: string, centro = false): TableCell {
    return {
      text: texto,
      bold: true,
      fontSize: 7,
      fillColor: LABEL_BG,
      alignment: centro ? 'center' : 'left',
      margin: [4, 3, 4, 3]
    };
  }

  private valor(texto: unknown, colSpan = 1): TableCell {
    const lleno = this.texto(texto);
    return {
      text: lleno || LINEA,
      bold: !!lleno,
      colSpan,
      margin: [4, 3, 4, 3]
    };
  }

  private meta(texto: string): TableCell {
    return {
      text: texto,
      bold: true,
      fontSize: 6,
      alignment: 'center',
      fillColor: LABEL_BG,
      margin: [2, 2, 2, 2]
    };
  }

  private metaValor(texto: string): TableCell {
    return {
      text: texto,
      fontSize: 6.5,
      alignment: 'center',
      margin: [2, 2, 2, 2]
    };
  }

  private nombreSubrayado(nombre: unknown): Content {
    const texto = this.texto(nombre);
    return {
      text: texto || LINEA,
      bold: !!texto,
      decoration: 'underline'
    };
  }

  private texto(valor: unknown): string {
    if (valor == null) {
      return '';
    }
    return String(valor).trim();
  }

  private tripulante(
    persona: { nombre?: string | null; tipoDocumento?: string | null; documento?: string | null } | null | undefined
  ): { nombre: string; tipoDocumento: string; documento: string } {
    return {
      nombre: this.texto(persona?.nombre),
      tipoDocumento: this.texto(persona?.tipoDocumento),
      documento: this.texto(persona?.documento)
    };
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

  private firmante(form: HistoriaTrasladoAsistencial): { nombre: string; documento: string; parentesco: string } {
    const acompanante = this.texto(form.nombreAcompanante);
    if (acompanante) {
      return {
        nombre: acompanante,
        documento: this.doc(form.acompananteTipoId, form.acompananteNumeroId),
        parentesco: this.texto(form.parentesco)
      };
    }
    const paciente = this.texto(form.nombresApellidos);
    return {
      nombre: paciente,
      documento: this.doc(form.tipoIdentificacion, form.numeroIdentificacion, form.tipoIdentificacionOtro),
      parentesco: paciente ? 'Paciente' : ''
    };
  }

  private profesional(form: HistoriaTrasladoAsistencial): { nombre: string; registro: string } {
    const medico = this.tripulante(form.medico1);
    if (medico.nombre || medico.documento) {
      return {
        nombre: medico.nombre,
        registro: this.doc(medico.tipoDocumento, medico.documento)
      };
    }
    return {
      nombre: this.texto(form.profesionalDestino1),
      registro: this.doc(form.profesionalRecibeTipoId, form.profesionalDestino1Cc)
    };
  }

  private historiaClinica(form: HistoriaTrasladoAsistencial): string {
    return this.texto(form.recordNumero) || this.texto(form.identificacionNumero) || this.texto(form.numeroIdentificacion);
  }

  private edad(form: HistoriaTrasladoAsistencial): string {
    const valor = this.texto(form.edad);
    if (!valor) {
      return '';
    }
    const unidades: Record<string, string> = {
      anos: 'años',
      meses: 'meses',
      dias: 'días',
      horas: 'horas'
    };
    const unidad = unidades[this.texto(form.edadUnidad)] ?? '';
    return unidad ? `${valor} ${unidad}` : valor;
  }

  private unidadFuncional(form: HistoriaTrasladoAsistencial): string {
    const unidad = this.texto(form.unidad);
    if (unidad) {
      return unidad;
    }
    const servicio = this.texto(form.servicioOrigen);
    if (servicio) {
      return servicio;
    }
    const grupos = Array.isArray(form.gruposServicio) ? form.gruposServicio : [];
    return grupos.map(grupo => this.texto(grupo)).filter(Boolean).join(', ');
  }

  private diagnostico(form: HistoriaTrasladoAsistencial): string {
    const principal = this.texto(form.diagnosticoPrincipal);
    const cie = this.texto(form.cie10);
    if (principal && cie) {
      return `${principal} (${cie})`;
    }
    return principal || cie || this.texto(form.motivoConsulta) || this.texto(form.resumenClinico);
  }

  private doc(tipo: unknown, numero: unknown, otro: unknown = ''): string {
    const n = this.texto(numero);
    const tipoTexto = this.texto(tipo);
    const t = (tipoTexto === 'otro' ? this.texto(otro) : tipoTexto).toUpperCase();
    return [t, n].filter(Boolean).join(' ');
  }

  private fechaDocumento(fechaAtencion: unknown): string {
    const fecha = this.texto(fechaAtencion);
    const iso = fecha.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      return `${iso[3]}/${iso[2]}/${iso[1]}`;
    }
    if (fecha) {
      return fecha;
    }
    const hoy = new Date();
    const d = String(hoy.getDate()).padStart(2, '0');
    const m = String(hoy.getMonth() + 1).padStart(2, '0');
    return `${d}/${m}/${hoy.getFullYear()}`;
  }

  private nombreArchivo(documento: unknown): string {
    const doc = (this.texto(documento) || 'sin-documento').replace(/\W+/g, '_');
    const fecha = new Date().toISOString().slice(0, 10);
    return `Consentimiento_F-AU-1171_${doc}_${fecha}.pdf`;
  }
}
