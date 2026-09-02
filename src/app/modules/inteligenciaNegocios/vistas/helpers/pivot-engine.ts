import { humanizeColumnName } from '../../helpers/column-type.helper';

/**
 * Motor de tablas dinamicas — logica PURA, sin Angular.
 *
 * Vivia dentro de `PivotPanelComponent`, asi que la unica forma de calcular un
 * pivot era tener el panel abierto y que el usuario arrastrara campos. Eso hacia
 * imposible reconstruir un pivot guardado al reabrir un workbook: la hoja se
 * restauraba vacia y no habia manera de regenerarla.
 *
 * Ahora el calculo es una funcion: el panel la llama al arrastrar campos y el
 * visor la llama al restaurar un workbook.
 */

export type PivotOperation = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct';

export interface PivotValueField {
  column: string;
  operation: PivotOperation;
  label?: string;
}

export interface PivotConfig {
  rowFields: string[];
  columnFields: string[];
  valueFields: PivotValueField[];
  filterFields: string[];
}

export interface PivotResultColumn {
  field: string;
  headerName: string;
  type?: string;
}

export interface PivotResult {
  rows: Record<string, unknown>[];
  columns: PivotResultColumn[];
  /**
   * Configuracion con la que se genero este resultado.
   * Se propaga para poder persistirla en el workbook y reconstruir el pivot.
   */
  config: PivotConfig;
}

/** Metadatos minimos de columna que necesita el motor (para detectar fechas) */
export interface PivotColumnMeta {
  name: string;
  type: string;
}

/** Maximo de columnas cruzadas que se pintan en la grilla */
export const PIVOT_MAX_CROSS_COLUMNS = 50;

export function emptyPivotConfig(): PivotConfig {
  return { rowFields: [], columnFields: [], valueFields: [], filterFields: [] };
}

/** Copia profunda de una config (evita compartir arrays entre panel y estado) */
export function clonePivotConfig(config: PivotConfig): PivotConfig {
  return {
    rowFields: [...(config.rowFields ?? [])],
    columnFields: [...(config.columnFields ?? [])],
    valueFields: (config.valueFields ?? []).map(v => ({ ...v })),
    filterFields: [...(config.filterFields ?? [])],
  };
}

/** true si la config tiene lo minimo para producir un resultado */
export function isPivotConfigUsable(config: PivotConfig | null | undefined): boolean {
  if (!config) return false;
  return (config.rowFields?.length ?? 0) > 0 || (config.columnFields?.length ?? 0) > 0;
}

/**
 * Calcula la tabla dinamica.
 *
 * Devuelve `null` cuando no hay nada que calcular (config vacia o sin datos),
 * en vez de lanzar: quien llama decide si avisa al usuario o lo ignora.
 */
export function computePivot(
  data: Record<string, unknown>[],
  config: PivotConfig,
  availableColumns: PivotColumnMeta[] = [],
): PivotResult | null {
  if (!isPivotConfigUsable(config)) return null;
  if (!data || data.length === 0) return null;

  return (config.columnFields.length > 0)
    ? crossTab(data, config, availableColumns)
    : flatPivot(data, config, availableColumns);
}

/**
 * Tabla dinamica plana (solo rowFields + values, sin columnas cruzadas).
 */
function flatPivot(
  data: Record<string, unknown>[],
  config: PivotConfig,
  cols: PivotColumnMeta[],
): PivotResult {
  const grouped = groupRows(data, config.rowFields, cols);

  const pivotRows: Record<string, unknown>[] = [];
  grouped.forEach((rows) => {
    const pivotRow: Record<string, unknown> = {};

    config.rowFields.forEach(f => {
      pivotRow[f] = groupedValue(rows[0], f, cols);
    });

    if (config.valueFields.length > 0) {
      config.valueFields.forEach(vf => {
        pivotRow[valueFieldLabel(vf)] = aggregate(rows, vf.column, vf.operation);
      });
    } else {
      pivotRow['Conteo'] = rows.length;
    }

    pivotRows.push(pivotRow);
  });

  // Ordenar por la primera columna de valor (descendente), como Excel
  const sortKey = config.valueFields.length > 0
    ? valueFieldLabel(config.valueFields[0])
    : 'Conteo';
  pivotRows.sort((a, b) => (Number(b[sortKey]) || 0) - (Number(a[sortKey]) || 0));

  const resultCols: PivotResultColumn[] = config.rowFields.map(f => ({
    field: f,
    headerName: humanizeColumnName(f),
  }));

  if (config.valueFields.length > 0) {
    config.valueFields.forEach(vf => {
      const label = valueFieldLabel(vf);
      resultCols.push({ field: label, headerName: label, type: 'numericColumn' });
    });
  } else {
    resultCols.push({ field: 'Conteo', headerName: 'Conteo', type: 'numericColumn' });
  }

  return { rows: pivotRows, columns: resultCols, config: clonePivotConfig(config) };
}

/**
 * Cross-tabulation (como Excel): los valores unicos del primer columnField se
 * convierten en columnas del resultado.
 */
function crossTab(
  data: Record<string, unknown>[],
  config: PivotConfig,
  cols: PivotColumnMeta[],
): PivotResult {
  const colField = config.columnFields[0]; // solo el primero, por ahora
  const valueOp: PivotOperation = config.valueFields[0]?.operation ?? 'count';
  const valueCol = config.valueFields[0]?.column ?? colField;

  // 1. Valores unicos del colField -> encabezados
  const unique = new Set<string>();
  data.forEach(row => {
    const v = String(row[colField] ?? '(vacio)').trim();
    if (v) unique.add(v);
  });
  const colValues = [...unique].sort();
  const truncated = colValues.length > PIVOT_MAX_CROSS_COLUMNS;
  const displayCols = colValues.slice(0, PIVOT_MAX_CROSS_COLUMNS);

  // 2. Agrupar por rowFields
  const grouped = groupRows(data, config.rowFields, cols);

  // 3. Valor de cada celda cruzada
  const pivotRows: Record<string, unknown>[] = [];
  grouped.forEach((rows) => {
    const pivotRow: Record<string, unknown> = {};

    config.rowFields.forEach(f => {
      pivotRow[f] = groupedValue(rows[0], f, cols);
    });

    displayCols.forEach(colVal => {
      const subset = rows.filter(r => String(r[colField] ?? '(vacio)').trim() === colVal);
      pivotRow[colVal] = aggregate(subset, valueCol, valueOp);
    });

    pivotRow['Total'] = aggregate(rows, valueCol, valueOp);
    pivotRows.push(pivotRow);
  });

  // Fila de totales generales
  const totalRow: Record<string, unknown> = {};
  config.rowFields.forEach(f => { totalRow[f] = 'Total general'; });
  displayCols.forEach(colVal => {
    const subset = data.filter(r => String(r[colField] ?? '(vacio)').trim() === colVal);
    totalRow[colVal] = aggregate(subset, valueCol, valueOp);
  });
  totalRow['Total'] = aggregate(data, valueCol, valueOp);
  pivotRows.push(totalRow);

  const resultCols: PivotResultColumn[] = config.rowFields.map(f => ({
    field: f,
    headerName: humanizeColumnName(f),
  }));
  displayCols.forEach(colVal => {
    resultCols.push({ field: colVal, headerName: colVal, type: 'numericColumn' });
  });
  resultCols.push({ field: 'Total', headerName: 'Total', type: 'numericColumn' });

  if (truncated) {
    console.warn(
      `[Pivot] Cross-tab truncada: ${colValues.length} valores unicos en "${colField}", ` +
      `mostrando ${PIVOT_MAX_CROSS_COLUMNS}`
    );
  }

  return { rows: pivotRows, columns: resultCols, config: clonePivotConfig(config) };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function groupRows(
  data: Record<string, unknown>[],
  rowFields: string[],
  cols: PivotColumnMeta[],
): Map<string, Record<string, unknown>[]> {
  const grouped = new Map<string, Record<string, unknown>[]>();
  data.forEach(row => {
    const key = rowFields.length > 0
      ? rowFields.map(f => groupedValue(row, f, cols)).join(' | ')
      : 'Total';
    const bucket = grouped.get(key);
    if (bucket) bucket.push(row);
    else grouped.set(key, [row]);
  });
  return grouped;
}

/** Etiqueta visible de un campo de valor: "SUMA Total Facturado" */
export function valueFieldLabel(vf: PivotValueField): string {
  return `${operationLabel(vf.operation)} ${humanizeColumnName(vf.column)}`;
}

/**
 * Valor por el que se agrupa un campo. Las fechas se agrupan por Ano-Mes:
 * agrupar por el timestamp exacto daria miles de grupos de una fila.
 */
function groupedValue(
  row: Record<string, unknown>,
  field: string,
  cols: PivotColumnMeta[],
): string {
  const raw = row?.[field];
  if (raw === null || raw === undefined || raw === '') return '(vacio)';

  const meta = cols.find(c => c.name === field);
  const isDate = !!meta && /date|datetime|timestamp/i.test(meta.type ?? '');

  if (isDate) {
    const s = String(raw);

    const iso = s.match(/^(\d{4})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}`;          // "2026-08"

    const es = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (es) return `${es[3]}-${es[2]}`;             // "2026-08"

    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
  }

  return String(raw).trim();
}

function aggregate(
  rows: Record<string, unknown>[],
  column: string,
  operation: PivotOperation | string,
): number {
  if (rows.length === 0) return 0;

  if (operation === 'count') return rows.length;
  if (operation === 'distinct') {
    return new Set(rows.map(r => String(r[column] ?? ''))).size;
  }

  const nums = rows.map(r => Number(r[column])).filter(n => Number.isFinite(n));
  if (nums.length === 0) return 0;

  switch (operation) {
    case 'sum': return nums.reduce((a, b) => a + b, 0);
    case 'avg': return nums.reduce((a, b) => a + b, 0) / nums.length;
    case 'min': return Math.min(...nums);
    case 'max': return Math.max(...nums);
    default:    return rows.length;
  }
}

export function operationLabel(op: string): string {
  const labels: Record<string, string> = {
    sum: 'SUMA', avg: 'PROMEDIO', count: 'CONTAR',
    min: 'MIN', max: 'MAX', distinct: 'DISTINTOS',
  };
  return labels[op] ?? op.toUpperCase();
}
