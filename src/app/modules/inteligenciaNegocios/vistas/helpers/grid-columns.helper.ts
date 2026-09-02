/**
 * Helpers compartidos de AG Grid para las vistas BI.
 *
 * Aqui vive lo que estaba copiado en varios sitios: la columna de numeros de
 * fila (repetida cinco veces entre buildColumnDefs, inferColumnDefs, los dos
 * generadores de pivot y la hoja de calculo) y el auto-ajuste de columnas
 * (duplicado entre viewVistasRefresh y viewVistasExcel). Un solo sitio para
 * cambiar el ancho de la columna de fila o los limites del autofit.
 */
import type { ColDef, GridApi } from 'ag-grid-community';

/** Campo de la columna de numeros de fila. No es un dato de la vista. */
export const ROW_NUMBER_FIELD = '__ROW_NUMBER__';

/** Limites del auto-ajuste: ni columnas ilegibles ni columnas de media pantalla. */
const AUTOSIZE_MIN_WIDTH = 100;
const AUTOSIZE_MAX_WIDTH = 400;

/**
 * Columna de numeros de fila, como la banda gris de Excel (1, 2, 3...).
 *
 * Va anclada a la izquierda y no se ordena ni se filtra: numera las filas
 * VISIBLES, asi que sigue el orden y los filtros que haya aplicados.
 *
 * @param width Ancho en px. Las hojas de datos usan 60; los pivots, 50.
 */
export function makeRowNumberColDef(width = 60): ColDef {
  return {
    headerName: '',
    field: ROW_NUMBER_FIELD,
    width,
    minWidth: width,
    maxWidth: width,
    resizable: false,
    sortable: false,
    filter: false,
    pinned: 'left',
    lockPinned: true,
    suppressMovable: true,
    cellClass: 'bi-cell-row-number',
    headerClass: 'excel-corner-header',
    valueGetter: params => (params.node?.rowIndex != null ? params.node.rowIndex + 1 : ''),
    cellStyle: {
      fontWeight: 'bold',
      color: '#666',
      textAlign: 'center',
      backgroundColor: '#f9fafb',
      borderRight: '1px solid #d1d5db',
    },
  };
}

/**
 * Ajusta todas las columnas al contenido y luego acota el resultado.
 *
 * autoSizeAllColumns por si solo deja columnas de 30px (celdas vacias) o de
 * 900px (observaciones largas), y en ambos casos la tabla queda inservible.
 */
export function autoSizeGridColumns(api: GridApi | undefined): void {
  if (!api) return;

  api.autoSizeAllColumns(false);

  const columns = api.getColumns();
  if (!columns) return;

  const ajustes: Array<{ key: string; newWidth: number }> = [];

  for (const col of columns) {
    if (col.getColId() === ROW_NUMBER_FIELD) continue;

    const actual = col.getActualWidth();
    const nuevo = Math.min(AUTOSIZE_MAX_WIDTH, Math.max(AUTOSIZE_MIN_WIDTH, actual));

    if (nuevo !== actual) ajustes.push({ key: col.getColId(), newWidth: nuevo });
  }

  // Una sola llamada: setColumnWidths por columna dispara un relayout cada vez
  if (ajustes.length > 0) api.setColumnWidths(ajustes);
}

/**
 * ¿El evento de teclado nacio dentro de un campo de texto?
 *
 * Los atajos globales (Ctrl+C, Ctrl+V, Ctrl+F, Delete, Escape) se registran en
 * `document`, asi que tambien capturan lo que el usuario escribe en el buscador
 * del filtro de columna o en un input del panel lateral. Sin esta guarda, pegar
 * un valor en el filtro disparaba la alerta "Esta vista es de solo lectura" y
 * el texto nunca llegaba al campo.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;

  return target.isContentEditable;
}

/**
 * Estadisticas de una columna, como la barra de estado de Excel al seleccionar
 * un rango: Promedio / Recuento / Suma / Min / Max.
 */
export interface ColumnStats {
  label: string;
  /** Celdas con algun valor (numericas o no) */
  count: number;
  /** Cuantas de esas celdas se pudieron leer como numero */
  numericCount: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  /** true si la columna es mayoritariamente numerica: habilita los calculos */
  isNumeric: boolean;
}

/**
 * Convierte un valor de celda a numero si se puede.
 *
 * Tolera lo que llega formateado desde la vista: "1.234.567" (miles con punto),
 * "1.234,56" (decimal con coma) y "$ 1.234". Devuelve null si no es un numero.
 */
export function toNumericValue(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined) return null;

  const raw = String(value).trim();
  if (raw === '') return null;

  // Se quita todo lo que no sea digito, signo o separador
  let limpio = raw.replace(/[^\d,.-]/g, '');
  if (limpio === '' || limpio === '-') return null;

  const ultimaComa  = limpio.lastIndexOf(',');
  const ultimoPunto = limpio.lastIndexOf('.');

  if (ultimaComa > -1 && ultimoPunto > -1) {
    // Ambos separadores: el ULTIMO es el decimal, el otro es de miles
    limpio = ultimaComa > ultimoPunto
      ? limpio.replace(/\./g, '').replace(',', '.')
      : limpio.replace(/,/g, '');
  } else if (ultimaComa > -1) {
    // Solo comas: decimal si hay 1 o 2 digitos detras, si no son miles
    const decimales = limpio.length - ultimaComa - 1;
    limpio = decimales > 0 && decimales <= 2
      ? limpio.replace(',', '.')
      : limpio.replace(/,/g, '');
  } else if (ultimoPunto > -1) {
    // Solo puntos: si hay mas de uno son separadores de miles (1.234.567)
    const puntos = (limpio.match(/\./g) ?? []).length;
    if (puntos > 1) limpio = limpio.replace(/\./g, '');
  }

  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

/**
 * Calcula los agregados de una columna sobre las filas dadas (las visibles, no
 * el dataset completo: si hay filtros, Excel tambien resume solo lo visible).
 */
export function computeColumnStats(
  rows: Record<string, unknown>[],
  colId: string,
  label: string,
): ColumnStats {
  let count = 0;
  let numericCount = 0;
  let sum = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const row of rows) {
    const value = row[colId];
    if (value === null || value === undefined || value === '') continue;

    count++;

    const n = toNumericValue(value);
    if (n === null) continue;

    numericCount++;
    sum += n;
    if (n < min) min = n;
    if (n > max) max = n;
  }

  // Se considera numerica si la mayoria de las celdas con dato son numeros. Una
  // columna de texto con algun codigo suelto no debe ofrecer "Suma".
  const isNumeric = count > 0 && numericCount / count >= 0.8;

  return {
    label,
    count,
    numericCount,
    sum,
    avg: numericCount > 0 ? sum / numericCount : 0,
    min: numericCount > 0 ? min : 0,
    max: numericCount > 0 ? max : 0,
    isNumeric,
  };
}
