/**
 * Utilidades de clasificación para la Matriz de Obsolescencia.
 * Única fuente de verdad para los umbrales de puntaje, etiquetas,
 * clases CSS, severities de PrimeNG y formato de valoraciones.
 */

export type TagSeverity = 'success' | 'info' | 'warn' | 'danger';

export type EstadoObsolescenciaKey = 'optimo' | 'funcional' | 'potencial' | 'obsoleto';

export interface ClasificacionPuntaje {
  key: EstadoObsolescenciaKey;
  label: string;
  cssClass: string;
  severity: TagSeverity;
}

/** Umbrales de puntaje de la matriz de obsolescencia. */
export const UMBRAL_OPTIMO = 100;
export const UMBRAL_FUNCIONAL = 60;

/**
 * Clasifica un puntaje en su estado de obsolescencia.
 * Devuelve la etiqueta, la clase CSS y el severity del tag asociados.
 *
 * - Óptimo:        puntaje >= 100
 * - Funcional:     60 <= puntaje < 100
 * - Potencializar: 0 < puntaje < 60
 * - Obsoleto:      null / 0 / negativo
 */
export function clasificarPuntaje(puntaje: number | null | undefined): ClasificacionPuntaje {
  const p = Number(puntaje);

  if (!p || p <= 0) {
    return { key: 'obsoleto', label: 'Obsoleto', cssClass: 'obsoleto', severity: 'danger' };
  }
  if (p >= UMBRAL_OPTIMO) {
    return { key: 'optimo', label: 'Óptimo', cssClass: 'optimo', severity: 'success' };
  }
  if (p >= UMBRAL_FUNCIONAL) {
    return { key: 'funcional', label: 'Funcional', cssClass: 'funcional', severity: 'info' };
  }
  return { key: 'potencial', label: 'Potencializar', cssClass: 'potencial', severity: 'warn' };
}

/**
 * Severity para valoraciones textuales (Excelente / Bueno / Regular / ...).
 */
export function severityValoracionTexto(valoracion: string | null | undefined): TagSeverity {
  if (!valoracion) return 'info';

  const val = valoracion.toLowerCase();
  if (val.includes('excelente') || val.includes('muy bueno')) return 'success';
  if (val.includes('bueno') || val.includes('aceptable')) return 'info';
  if (val.includes('regular') || val.includes('medio')) return 'warn';
  return 'danger';
}

/**
 * Formatea una valoración de la tabla:
 * número -> su representación, texto -> tal cual, vacío -> 'Sin datos'.
 */
export function formatValoracion(valoracion: any): string {
  if (valoracion !== null && valoracion !== undefined && valoracion !== '') {
    const numValue = parseFloat(valoracion);
    return isNaN(numValue) ? valoracion : numValue.toString();
  }
  return 'Sin datos';
}

/**
 * Severity para una valoración numérica de la tabla:
 * verde si hay un número válido, rojo si no hay dato.
 */
export function severityValoracionNumerica(valoracion: any): 'success' | 'danger' {
  if (valoracion !== null && valoracion !== undefined && valoracion !== '') {
    const numValue = parseFloat(valoracion);
    if (!isNaN(numValue)) {
      return 'success';
    }
  }
  return 'danger';
}
