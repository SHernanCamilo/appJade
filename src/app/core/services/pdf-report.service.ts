import { Injectable } from '@angular/core';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

// Configurar fuentes
(pdfMake as any).vfs = (pdfFonts as any).vfs;

export interface ReportData {
  titulo: string;
  fechaGeneracion: string;
  filtrosAplicados: string;
  totalEquipos: number;
  resumenGeneral: {
    total: number;
    optimo: number;
    funcional: number;
    potencial: number;
    obsoleto: number;
    puntajePromedio: number;
  };
  resumenPorEmpresa: Array<{
    empresa: string;
    total: number;
    optimo: number;
    funcional: number;
    potencial: number;
    obsoleto: number;
    puntajePromedio: number;
    porcentajeOptimo: number;
  }>;
  adquisicionesPorAnio: Array<{
    anio: number;
    cantidad: number;
    porcentaje: number;
  }>;
  equiposPorEdad: Array<{
    rangoEdad: string;
    cantidad: number;
    estadoPredominante: string;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class PdfReportService {

  constructor() { }

  generarReporteMatrizObsolescencia(data: ReportData): void {
    const docDefinition: any = {
      pageSize: 'LETTER',
      pageMargins: [40, 60, 40, 60],
      
      header: (currentPage: number, pageCount: number) => {
        if (currentPage === 1) return null;
        return {
          text: 'Reporte Matriz de Obsolescencia',
          alignment: 'center',
          fontSize: 10,
          color: '#666',
          margin: [0, 20, 0, 0]
        };
      },

      footer: (currentPage: number, pageCount: number) => {
        return {
          columns: [
            {
              text: `Generado: ${data.fechaGeneracion}`,
              alignment: 'left',
              fontSize: 8,
              color: '#666',
              margin: [40, 0, 0, 0]
            },
            {
              text: `Página ${currentPage} de ${pageCount}`,
              alignment: 'right',
              fontSize: 8,
              color: '#666',
              margin: [0, 0, 40, 0]
            }
          ]
        };
      },

      content: [
        // ═══════════════════════════════════════════════════════════════════
        // PORTADA
        // ═══════════════════════════════════════════════════════════════════
        {
          text: 'REPORTE',
          style: 'portadaTitulo',
          margin: [0, 100, 0, 10]
        },
        {
          text: 'Matriz de Obsolescencia',
          style: 'portadaSubtitulo',
          margin: [0, 0, 0, 20]
        },
        {
          text: 'Parque Tecnológico',
          style: 'portadaSeccion',
          margin: [0, 0, 0, 60]
        },
        {
          canvas: [
            {
              type: 'line',
              x1: 0, y1: 0,
              x2: 515, y2: 0,
              lineWidth: 2,
              lineColor: '#3B82F6'
            }
          ],
          margin: [0, 0, 0, 20]
        },
        {
          columns: [
            {
              width: '50%',
              stack: [
                { text: 'Fecha de Generación:', style: 'portadaLabel' },
                { text: data.fechaGeneracion, style: 'portadaValor' }
              ]
            },
            {
              width: '50%',
              stack: [
                { text: 'Total de Equipos:', style: 'portadaLabel' },
                { text: data.totalEquipos.toString(), style: 'portadaValor' }
              ]
            }
          ],
          margin: [0, 0, 0, 20]
        },
        {
          text: 'Filtros Aplicados:',
          style: 'portadaLabel',
          margin: [0, 0, 0, 5]
        },
        {
          text: data.filtrosAplicados,
          style: 'portadaFiltros',
          margin: [0, 0, 0, 0]
        },
        { text: '', pageBreak: 'after' },

        // ═══════════════════════════════════════════════════════════════════
        // RESUMEN EJECUTIVO
        // ═══════════════════════════════════════════════════════════════════
        {
          text: '1. RESUMEN EJECUTIVO',
          style: 'seccionTitulo',
          margin: [0, 0, 0, 20]
        },

        // Tarjetas de resumen
        {
          columns: [
            this.crearTarjetaResumen('Total Equipos', data.resumenGeneral.total, '#6366F1'),
            this.crearTarjetaResumen('Óptimo', data.resumenGeneral.optimo, '#10B981'),
            this.crearTarjetaResumen('Funcional', data.resumenGeneral.funcional, '#3B82F6')
          ],
          margin: [0, 0, 0, 10]
        },
        {
          columns: [
            this.crearTarjetaResumen('Potencializar', data.resumenGeneral.potencial, '#F59E0B'),
            this.crearTarjetaResumen('Obsoleto', data.resumenGeneral.obsoleto, '#EF4444'),
            this.crearTarjetaResumen('Puntaje Prom.', data.resumenGeneral.puntajePromedio + '%', '#8B5CF6')
          ],
          margin: [0, 0, 0, 20]
        },

        // Distribución porcentual
        {
          text: 'Distribución por Estado',
          style: 'subseccionTitulo',
          margin: [0, 10, 0, 10]
        },
        {
          table: {
            widths: ['*', 'auto', 'auto'],
            body: [
              [
                { text: 'Estado', style: 'tableHeader' },
                { text: 'Cantidad', style: 'tableHeader', alignment: 'center' },
                { text: 'Porcentaje', style: 'tableHeader', alignment: 'center' }
              ],
              ...this.crearFilasDistribucion(data.resumenGeneral)
            ]
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 20]
        },

        { text: '', pageBreak: 'after' },

        // ═══════════════════════════════════════════════════════════════════
        // ANÁLISIS POR EMPRESA
        // ═══════════════════════════════════════════════════════════════════
        {
          text: '2. ANÁLISIS POR EMPRESA',
          style: 'seccionTitulo',
          margin: [0, 0, 0, 20]
        },

        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
            body: [
              [
                { text: 'Empresa', style: 'tableHeader' },
                { text: 'Total', style: 'tableHeader', alignment: 'center' },
                { text: 'Óptimo', style: 'tableHeader', alignment: 'center' },
                { text: 'Funcional', style: 'tableHeader', alignment: 'center' },
                { text: 'Potencial', style: 'tableHeader', alignment: 'center' },
                { text: 'Obsoleto', style: 'tableHeader', alignment: 'center' },
                { text: 'Puntaje', style: 'tableHeader', alignment: 'center' },
                { text: 'Salud', style: 'tableHeader', alignment: 'center' }
              ],
              ...data.resumenPorEmpresa.map(emp => [
                { text: emp.empresa, style: 'tableCell' },
                { text: emp.total.toString(), style: 'tableCell', alignment: 'center', bold: true },
                { text: emp.optimo.toString(), style: 'tableCell', alignment: 'center', color: '#10B981' },
                { text: emp.funcional.toString(), style: 'tableCell', alignment: 'center', color: '#3B82F6' },
                { text: emp.potencial.toString(), style: 'tableCell', alignment: 'center', color: '#F59E0B' },
                { text: emp.obsoleto.toString(), style: 'tableCell', alignment: 'center', color: '#EF4444' },
                { text: emp.puntajePromedio + '%', style: 'tableCell', alignment: 'center' },
                { text: emp.porcentajeOptimo + '%', style: 'tableCell', alignment: 'center', bold: true }
              ])
            ]
          },
          layout: {
            fillColor: (rowIndex: number) => rowIndex === 0 ? '#F3F4F6' : (rowIndex % 2 === 0 ? '#FAFAFA' : null)
          },
          margin: [0, 0, 0, 20]
        },

        { text: '', pageBreak: 'after' },

        // ═══════════════════════════════════════════════════════════════════
        // ANÁLISIS DE ADQUISICIONES POR AÑO
        // ═══════════════════════════════════════════════════════════════════
        {
          text: '3. ANÁLISIS DE ADQUISICIONES',
          style: 'seccionTitulo',
          margin: [0, 0, 0, 20]
        },

        {
          text: '3.1 Adquisiciones por Año',
          style: 'subseccionTitulo',
          margin: [0, 0, 0, 10]
        },

        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto'],
            body: [
              [
                { text: 'Año', style: 'tableHeader', alignment: 'center' },
                { text: 'Equipos Adquiridos', style: 'tableHeader', alignment: 'center' },
                { text: '% del Total', style: 'tableHeader', alignment: 'center' }
              ],
              ...data.adquisicionesPorAnio.map(adq => [
                { text: adq.anio.toString(), style: 'tableCell', alignment: 'center', bold: true },
                { text: adq.cantidad.toString(), style: 'tableCell', alignment: 'center' },
                { text: adq.porcentaje.toFixed(1) + '%', style: 'tableCell', alignment: 'center' }
              ])
            ]
          },
          layout: {
            fillColor: (rowIndex: number) => rowIndex === 0 ? '#F3F4F6' : (rowIndex % 2 === 0 ? '#FAFAFA' : null)
          },
          margin: [0, 0, 0, 30]
        },

        {
          text: '3.2 Distribución por Edad de Equipos',
          style: 'subseccionTitulo',
          margin: [0, 0, 0, 10]
        },

        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', '*'],
            body: [
              [
                { text: 'Rango de Edad', style: 'tableHeader' },
                { text: 'Cantidad', style: 'tableHeader', alignment: 'center' },
                { text: 'Estado Predominante', style: 'tableHeader' }
              ],
              ...data.equiposPorEdad.map(edad => [
                { text: edad.rangoEdad, style: 'tableCell' },
                { text: edad.cantidad.toString(), style: 'tableCell', alignment: 'center', bold: true },
                { text: edad.estadoPredominante, style: 'tableCell', alignment: 'center' }
              ])
            ]
          },
          layout: {
            fillColor: (rowIndex: number) => rowIndex === 0 ? '#F3F4F6' : (rowIndex % 2 === 0 ? '#FAFAFA' : null)
          },
          margin: [0, 0, 0, 20]
        },

        // ═══════════════════════════════════════════════════════════════════
        // CONCLUSIONES Y RECOMENDACIONES
        // ═══════════════════════════════════════════════════════════════════
        { text: '', pageBreak: 'after' },

        {
          text: '4. CONCLUSIONES Y RECOMENDACIONES',
          style: 'seccionTitulo',
          margin: [0, 0, 0, 20]
        },

        ...this.generarConclusiones(data)
      ],

      styles: {
        portadaTitulo: {
          fontSize: 32,
          bold: true,
          alignment: 'center',
          color: '#1F2937'
        },
        portadaSubtitulo: {
          fontSize: 24,
          alignment: 'center',
          color: '#3B82F6'
        },
        portadaSeccion: {
          fontSize: 18,
          alignment: 'center',
          color: '#6B7280'
        },
        portadaLabel: {
          fontSize: 11,
          color: '#6B7280',
          margin: [0, 0, 0, 5]
        },
        portadaValor: {
          fontSize: 14,
          bold: true,
          color: '#1F2937'
        },
        portadaFiltros: {
          fontSize: 10,
          color: '#4B5563',
          italics: true
        },
        seccionTitulo: {
          fontSize: 18,
          bold: true,
          color: '#1F2937',
          decoration: 'underline',
          decorationColor: '#3B82F6'
        },
        subseccionTitulo: {
          fontSize: 14,
          bold: true,
          color: '#374151'
        },
        tableHeader: {
          fontSize: 10,
          bold: true,
          color: '#1F2937',
          fillColor: '#F3F4F6'
        },
        tableCell: {
          fontSize: 9,
          color: '#374151'
        },
        tarjetaTitulo: {
          fontSize: 9,
          color: '#6B7280',
          margin: [0, 0, 0, 5]
        },
        tarjetaValor: {
          fontSize: 20,
          bold: true,
          color: '#1F2937'
        },
        conclusion: {
          fontSize: 11,
          color: '#374151',
          margin: [0, 0, 0, 10],
          lineHeight: 1.4
        },
        recomendacion: {
          fontSize: 10,
          color: '#4B5563',
          margin: [15, 0, 0, 8],
          lineHeight: 1.3
        }
      }
    };

    pdfMake.createPdf(docDefinition).download(`Reporte-Matriz-Obsolescencia-${Date.now()}.pdf`);
  }

  private crearTarjetaResumen(titulo: string, valor: string | number, color: string): any {
    return {
      stack: [
        {
          canvas: [
            {
              type: 'rect',
              x: 0, y: 0,
              w: 160, h: 60,
              r: 4,
              lineColor: '#E5E7EB',
              lineWidth: 1
            }
          ]
        },
        {
          text: titulo,
          style: 'tarjetaTitulo',
          margin: [10, -50, 0, 0]
        },
        {
          text: valor.toString(),
          style: 'tarjetaValor',
          color: color,
          margin: [10, 0, 0, 0]
        }
      ],
      width: 'auto'
    };
  }

  private crearFilasDistribucion(resumen: any): any[] {
    const estados = [
      { label: 'Óptimo', valor: resumen.optimo, color: '#10B981' },
      { label: 'Funcional', valor: resumen.funcional, color: '#3B82F6' },
      { label: 'Potencializar', valor: resumen.potencial, color: '#F59E0B' },
      { label: 'Obsoleto', valor: resumen.obsoleto, color: '#EF4444' }
    ];

    return estados.map(estado => {
      const porcentaje = resumen.total > 0 ? ((estado.valor / resumen.total) * 100).toFixed(1) : '0.0';
      return [
        { text: estado.label, style: 'tableCell', color: estado.color, bold: true },
        { text: estado.valor.toString(), style: 'tableCell', alignment: 'center' },
        { text: porcentaje + '%', style: 'tableCell', alignment: 'center' }
      ];
    });
  }

  private generarConclusiones(data: ReportData): any[] {
    const conclusiones: any[] = [];
    const porcentajeObsoleto = data.resumenGeneral.total > 0 
      ? (data.resumenGeneral.obsoleto / data.resumenGeneral.total) * 100 
      : 0;
    const porcentajeOptimo = data.resumenGeneral.total > 0 
      ? (data.resumenGeneral.optimo / data.resumenGeneral.total) * 100 
      : 0;

    // Conclusión general
    conclusiones.push({
      text: '4.1 Conclusiones Generales',
      style: 'subseccionTitulo',
      margin: [0, 0, 0, 10]
    });

    conclusiones.push({
      ul: [
        `El parque tecnológico cuenta con un total de ${data.resumenGeneral.total} equipos analizados.`,
        `El ${porcentajeOptimo.toFixed(1)}% de los equipos se encuentran en estado óptimo (${data.resumenGeneral.optimo} equipos).`,
        `Se identificaron ${data.resumenGeneral.obsoleto} equipos obsoletos (${porcentajeObsoleto.toFixed(1)}% del total).`,
        `El puntaje promedio general es de ${data.resumenGeneral.puntajePromedio}%.`
      ],
      style: 'conclusion'
    });

    // Recomendaciones
    conclusiones.push({
      text: '4.2 Recomendaciones',
      style: 'subseccionTitulo',
      margin: [0, 20, 0, 10]
    });

    const recomendaciones: string[] = [];

    if (porcentajeObsoleto > 20) {
      recomendaciones.push('⚠️ URGENTE: Más del 20% de los equipos están obsoletos. Se recomienda iniciar un plan de renovación inmediato.');
    }

    if (data.resumenGeneral.potencial > data.resumenGeneral.optimo) {
      recomendaciones.push('📊 Considerar actualización de equipos en estado "Potencializar" para mejorar el rendimiento general.');
    }

    if (porcentajeOptimo < 30) {
      recomendaciones.push('💡 El porcentaje de equipos óptimos es bajo. Evaluar inversión en renovación tecnológica.');
    }

    recomendaciones.push('📅 Realizar auditorías periódicas del parque tecnológico cada 6 meses.');
    recomendaciones.push('🔄 Implementar un plan de renovación escalonado basado en prioridades por área.');
    recomendaciones.push('📈 Monitorear el rendimiento de equipos en estado funcional para prevenir obsolescencia.');

    conclusiones.push({
      ul: recomendaciones,
      style: 'recomendacion'
    });

    return conclusiones;
  }
}
