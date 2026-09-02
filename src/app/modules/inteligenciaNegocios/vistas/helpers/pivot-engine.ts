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
 * visor la llama al restaurar un workbook o al refrescar los datos de la vista.
 *
 * Funciones de Excel implementadas:
 *  - Filas / Columnas / Valores / Filtros de informe (los 4 cuadrantes)
 *  - Varias medidas a la vez (SUMA, PROMEDIO, CONTAR, MIN, MAX, DISTINTOS)
 *  - Agrupar (fechas por Año/Trimestre/Mes/Dia, numeros por rangos)
 *  - Subtotales por campo de fila y Total general
 *  - Contraer / Expandir el primer campo de fila
 *  - "Mostrar valores como": % del total general, de la fila o de la columna
 *  - Ordenar por etiqueta o por la primera medida
 */

export type PivotOperation = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct';

/** Equivalente a "Mostrar valores como" de Excel */
export type PivotShowAs = 'value' | 'pctGrandTotal' | 'pctRow' | 'pctCol';

/** Equivalente al dialogo "Agrupar" de Excel sobre un campo de fecha */
export type PivotDateGroup = 'none' | 'year' | 'quarter' | 'month' | 'day';

export interface PivotValueField {
  column: string;
  operation: PivotOperation;
  label?: string;
  /** Como se presenta el numero (valor crudo o porcentaje) */
  showAs?: PivotShowAs;
}

/** Ajustes por campo: es el "Agrupar..." y "Configuracion de campo" de Excel */
export interface PivotFieldSetting {
  /** Agrupacion de fechas. 'none' = valor exacto */
  dateGroup?: PivotDateGroup;
  /** Agrupacion numerica por rangos de este tamaño (ej. 100 -> "0 - 99") */
  numericStep?: number | null;
  /** Contraer: solo aplica al primer campo de fila (muestra solo sus totales) */
  collapsed?: boolean;
}

export interface PivotConfig {
  rowFields: string[];
  columnFields: string[];
  valueFields: PivotValueField[];
  filterFields: string[];
  /** Valores elegidos en cada filtro de informe. Vacio o ausente = todos */
  filterValues?: Record<string, string[]>;
  /** Agrupaciones y estado contraido por campo */
  fieldSettings?: Record<string, PivotFieldSetting>;
  /** Subtotales por campo de fila (con 2+ campos de fila) */
  showSubtotals?: boolean;
  /** Fila y columna de Total general */
  showGrandTotals?: boolean;
  /** Criterio de orden de las filas */
  sortBy?: 'label' | 'value';
  sortDir?: 'asc' | 'desc';
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

/**
 * Campo tecnico que marca el tipo de fila del resultado.
 * La grilla lo usa para resaltar subtotales y el total general; no se muestra.
 */
export const PIVOT_KIND_FIELD = '__PIVOT_KIND__';
/** Nivel de fila (0 = primer campo de fila). Tambien tecnico. */
export const PIVOT_LEVEL_FIELD = '__PIVOT_LEVEL__';

export type PivotRowKind = 'data' | 'subtotal' | 'grand';

/** Campos tecnicos que nunca se pintan como columna */
export const PIVOT_META_FIELDS = [PIVOT_KIND_FIELD, PIVOT_LEVEL_FIELD];

export function emptyPivotConfig(): PivotConfig {
  return {
    rowFields: [],
    columnFields: [],
    valueFields: [],
    filterFields: [],
    filterValues: {},
    fieldSettings: {},
    showSubtotals: true,
    showGrandTotals: true,
    sortBy: 'value',
    sortDir: 'desc',
  };
}

/** Copia profunda de una config (evita compartir arrays entre panel y estado) */
export function clonePivotConfig(config: PivotConfig): PivotConfig {
  const settings: Record<string, PivotFieldSetting> = {};
  Object.entries(config?.fieldSettings ?? {}).forEach(([k, v]) => { settings[k] = { ...v }; });

  const values: Record<string, string[]> = {};
  Object.entries(config?.filterValues ?? {}).forEach(([k, v]) => { values[k] = [...(v ?? [])]; });

  return {
    rowFields: [...(config?.rowFields ?? [])],
    columnFields: [...(config?.columnFields ?? [])],
    valueFields: (config?.valueFields ?? []).map(v => ({ ...v })),
    filterFields: [...(config?.filterFields ?? [])],
    filterValues: values,
    fieldSettings: settings,
    showSubtotals: config?.showSubtotals ?? true,
    showGrandTotals: config?.showGrandTotals ?? true,
    sortBy: config?.sortBy ?? 'value',
    sortDir: config?.sortDir ?? 'desc',
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
  rawConfig: PivotConfig,
  availableColumns: PivotColumnMeta[] = [],
): PivotResult | null {
  if (!isPivotConfigUsable(rawConfig)) return null;
  if (!data || data.length === 0) return null;

  const config = clonePivotConfig(rawConfig);

  // 1. Filtros de informe (cuadrante FILTROS): recortan el dataset entero,
  //    igual que los desplegables que Excel pone encima de la tabla.
  const filtered = applyReportFilters(data, config, availableColumns);
  if (filtered.length === 0) {
    return { rows: [], columns: rowLabelColumns(config), config };
  }

  // 2. Contraer: si el primer campo de fila esta contraido, se dinamiza solo por
  //    el, como al pulsar el "-" de Excel.
  const collapsed = !!config.fieldSettings?.[config.rowFields[0]]?.collapsed;
  const rowFields = collapsed && config.rowFields.length > 0
    ? [config.rowFields[0]]
    : config.rowFields;

  return (config.columnFields.length > 0)
    ? crossTab(filtered, config, rowFields, availableColumns)
    : flatPivot(filtered, config, rowFields, availableColumns);
}

/**
 * Valores distintos de un campo, ya agrupados segun sus ajustes.
 * El panel los usa para poblar los desplegables de los filtros de informe.
 */
export function distinctFieldValues(
  data: Record<string, unknown>[],
  field: string,
  cols: PivotColumnMeta[] = [],
  setting?: PivotFieldSetting,
  max = 500,
): string[] {
  const set = new Set<string>();
  for (const row of data) {
    set.add(groupedValue(row, field, cols, setting));
    if (set.size >= max) break;
  }
  return [...set].sort();
}

// ── Filtros de informe ─────────────────────────────────────────────────────

function applyReportFilters(
  data: Record<string, unknown>[],
  config: PivotConfig,
  cols: PivotColumnMeta[],
): Record<string, unknown>[] {
  const activos = (config.filterFields ?? []).filter(f => (config.filterValues?.[f]?.length ?? 0) > 0);
  if (activos.length === 0) return data;

  const permitidos = new Map<string, Set<string>>();
  activos.forEach(f => permitidos.set(f, new Set(config.filterValues![f])));

  return data.filter(row => activos.every(f => {
    const val = groupedValue(row, f, cols, config.fieldSettings?.[f]);
    return permitidos.get(f)!.has(val);
  }));
}

// ── Pivot plano (sin columnas cruzadas) ────────────────────────────────────

function flatPivot(
  data: Record<string, unknown>[],
  config: PivotConfig,
  rowFields: string[],
  cols: PivotColumnMeta[],
): PivotResult {
  const measures = effectiveMeasures(config);
  const groups   = groupByRowFields(data, rowFields, config, cols);

  // Valor de cada grupo por medida
  const valuesOf = (rows: Record<string, unknown>[]): Record<string, number> => {
    const out: Record<string, number> = {};
    measures.forEach(m => { out[measureLabel(m)] = aggregate(rows, m.column, m.operation); });
    return out;
  };

  const ordered = sortGroups(groups, config, measures, valuesOf);
  const pivotRows = emitRowsWithSubtotals(ordered, rowFields, config, valuesOf, data, measures);

  // Columnas: etiquetas de fila + una por medida
  const resultCols = rowLabelColumns({ ...config, rowFields });
  measures.forEach(m => {
    const label = measureLabel(m);
    resultCols.push({ field: label, headerName: label, type: 'numericColumn' });
  });

  // "Mostrar valores como" en tabla plana: solo % del total general tiene sentido
  applyShowAsFlat(pivotRows, measures, data);

  return { rows: pivotRows, columns: resultCols, config };
}

// ── Cross-tab (los valores de una columna se vuelven encabezados) ───────────

function crossTab(
  data: Record<string, unknown>[],
  config: PivotConfig,
  rowFields: string[],
  cols: PivotColumnMeta[],
): PivotResult {
  const colField = config.columnFields[0]; // Excel tambien anida varios; aqui el primero
  const colSetting = config.fieldSettings?.[colField];
  const measures = effectiveMeasures(config);

  // 1. Valores unicos del campo de columna -> encabezados
  const unique = new Set<string>();
  data.forEach(row => unique.add(groupedValue(row, colField, cols, colSetting)));
  const colValues  = [...unique].sort(compareLabels);
  const truncated  = colValues.length > PIVOT_MAX_CROSS_COLUMNS;
  const displayCols = colValues.slice(0, PIVOT_MAX_CROSS_COLUMNS);

  // Con una sola medida el encabezado es el valor ("EPS SURA"); con varias se
  // desdobla en "EPS SURA · SUMA Valor", como hace Excel.
  const cellField = (colVal: string, m: PivotValueField) =>
    measures.length === 1 ? colVal : `${colVal} · ${measureLabel(m)}`;
  const totalField = (m: PivotValueField) =>
    measures.length === 1 ? 'Total' : `Total · ${measureLabel(m)}`;

  const valuesOf = (rows: Record<string, unknown>[]): Record<string, number> => {
    const out: Record<string, number> = {};

    // Indexar el subconjunto por valor de columna una sola vez: antes se hacia
    // un filter() por cada columna cruzada, lo que era O(filas x columnas).
    const porColumna = new Map<string, Record<string, unknown>[]>();
    for (const row of rows) {
      const key = groupedValue(row, colField, cols, colSetting);
      const bucket = porColumna.get(key);
      if (bucket) bucket.push(row); else porColumna.set(key, [row]);
    }

    measures.forEach(m => {
      displayCols.forEach(colVal => {
        out[cellField(colVal, m)] = aggregate(porColumna.get(colVal) ?? [], m.column, m.operation);
      });
      if (config.showGrandTotals !== false) {
        out[totalField(m)] = aggregate(rows, m.column, m.operation);
      }
    });

    return out;
  };

  const groups    = groupByRowFields(data, rowFields, config, cols);
  const ordered   = sortGroups(groups, config, measures, valuesOf, totalField);
  const pivotRows = emitRowsWithSubtotals(ordered, rowFields, config, valuesOf, data, measures);

  // 4. Definicion de columnas
  const resultCols = rowLabelColumns({ ...config, rowFields });
  measures.forEach(m => {
    displayCols.forEach(colVal => {
      const field = cellField(colVal, m);
      resultCols.push({ field, headerName: field, type: 'numericColumn' });
    });
  });
  if (config.showGrandTotals !== false) {
    measures.forEach(m => {
      const field = totalField(m);
      resultCols.push({ field, headerName: field, type: 'numericColumn' });
    });
  }

  applyShowAsCross(pivotRows, measures, displayCols, cellField, totalField, config);

  if (truncated) {
    console.warn(
      `[Pivot] Cross-tab truncada: ${colValues.length} valores unicos en "${colField}", ` +
      `mostrando ${PIVOT_MAX_CROSS_COLUMNS}`
    );
  }

  return { rows: pivotRows, columns: resultCols, config };
}

// ── Agrupacion de filas y subtotales ───────────────────────────────────────

interface RowGroup {
  keys: string[];
  rows: Record<string, unknown>[];
}

function groupByRowFields(
  data: Record<string, unknown>[],
  rowFields: string[],
  config: PivotConfig,
  cols: PivotColumnMeta[],
): RowGroup[] {
  if (rowFields.length === 0) {
    return [{ keys: ['Total'], rows: data }];
  }

  const map = new Map<string, RowGroup>();

  for (const row of data) {
    const keys = rowFields.map(f => groupedValue(row, f, cols, config.fieldSettings?.[f]));
    const id   = keys.join('\u0000');
    const g    = map.get(id);
    if (g) g.rows.push(row);
    else map.set(id, { keys, rows: [row] });
  }

  return [...map.values()];
}

/**
 * Ordena los grupos respetando la jerarquia: primero por los campos padre
 * (siempre por etiqueta, para que los subtotales agrupen bien) y en el ultimo
 * nivel por el criterio elegido (etiqueta o primera medida).
 */
function sortGroups(
  groups: RowGroup[],
  config: PivotConfig,
  measures: PivotValueField[],
  valuesOf: (rows: Record<string, unknown>[]) => Record<string, number>,
  totalField?: (m: PivotValueField) => string,
): RowGroup[] {
  const dir = config.sortDir === 'asc' ? 1 : -1;
  const porValor = config.sortBy === 'value' && measures.length > 0;

  const metric = porValor
    ? new Map(groups.map(g => {
        const vals = valuesOf(g.rows);
        const key  = totalField ? totalField(measures[0]) : measureLabel(measures[0]);
        return [g, Number(vals[key] ?? 0)];
      }))
    : null;

  return [...groups].sort((a, b) => {
    const last = Math.max(a.keys.length, b.keys.length) - 1;

    for (let i = 0; i < last; i++) {
      const cmp = compareLabels(a.keys[i] ?? '', b.keys[i] ?? '');
      if (cmp !== 0) return cmp;
    }

    if (metric) {
      const diff = (metric.get(b)! - metric.get(a)!) * (dir === 1 ? -1 : 1);
      if (diff !== 0) return diff;
      return compareLabels(a.keys[last] ?? '', b.keys[last] ?? '');
    }

    return compareLabels(a.keys[last] ?? '', b.keys[last] ?? '') * dir;
  });
}

/**
 * Convierte los grupos en filas del resultado, insertando subtotales al cerrar
 * cada grupo de un campo padre y el Total general al final (como Excel).
 */
function emitRowsWithSubtotals(
  groups: RowGroup[],
  rowFields: string[],
  config: PivotConfig,
  valuesOf: (rows: Record<string, unknown>[]) => Record<string, number>,
  allData: Record<string, unknown>[],
  measures: PivotValueField[],
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const conSubtotales = config.showSubtotals !== false && rowFields.length > 1;
  const niveles = rowFields.length;

  // Filas acumuladas por prefijo, para calcular subtotales sin recorrer de nuevo
  const acumulado = new Map<string, Record<string, unknown>[]>();
  const prefijo = (keys: string[], hasta: number) => keys.slice(0, hasta + 1).join('\u0000');

  if (conSubtotales) {
    for (const g of groups) {
      for (let lvl = 0; lvl < niveles - 1; lvl++) {
        const id = prefijo(g.keys, lvl);
        const acc = acumulado.get(id);
        if (acc) acc.push(...g.rows); else acumulado.set(id, [...g.rows]);
      }
    }
  }

  let previo: string[] | null = null;

  const emitirSubtotales = (desdeNivel: number, keys: string[]) => {
    for (let lvl = niveles - 2; lvl >= desdeNivel; lvl--) {
      const rows = acumulado.get(prefijo(keys, lvl)) ?? [];
      const fila: Record<string, unknown> = {};
      rowFields.forEach((f, i) => {
        fila[f] = i < lvl ? keys[i] : (i === lvl ? `${keys[i]} — Total` : '');
      });
      Object.assign(fila, valuesOf(rows));
      fila[PIVOT_KIND_FIELD] = 'subtotal' as PivotRowKind;
      fila[PIVOT_LEVEL_FIELD] = lvl;
      out.push(fila);
    }
  };

  for (const g of groups) {
    if (conSubtotales && previo) {
      // Nivel mas alto en el que cambio la clave: se cierran sus subtotales
      let cambio = -1;
      for (let i = 0; i < niveles - 1; i++) {
        if ((previo[i] ?? '') !== (g.keys[i] ?? '')) { cambio = i; break; }
      }
      if (cambio >= 0) emitirSubtotales(cambio, previo);
    }

    const fila: Record<string, unknown> = {};
    rowFields.forEach((f, i) => { fila[f] = g.keys[i] ?? ''; });
    Object.assign(fila, valuesOf(g.rows));
    fila[PIVOT_KIND_FIELD] = 'data' as PivotRowKind;
    fila[PIVOT_LEVEL_FIELD] = niveles - 1;
    out.push(fila);

    previo = g.keys;
  }

  if (conSubtotales && previo) emitirSubtotales(0, previo);

  // Total general
  if (config.showGrandTotals !== false && measures.length >= 0) {
    const fila: Record<string, unknown> = {};
    rowFields.forEach((f, i) => { fila[f] = i === 0 ? 'Total general' : ''; });
    Object.assign(fila, valuesOf(allData));
    fila[PIVOT_KIND_FIELD] = 'grand' as PivotRowKind;
    fila[PIVOT_LEVEL_FIELD] = -1;
    out.push(fila);
  }

  return out;
}

// ── "Mostrar valores como" ─────────────────────────────────────────────────

function applyShowAsFlat(
  rows: Record<string, unknown>[],
  measures: PivotValueField[],
  allData: Record<string, unknown>[],
): void {
  measures.forEach(m => {
    if (!m.showAs || m.showAs === 'value') return;

    const label = measureLabel(m);
    const total = aggregate(allData, m.column, m.operation);
    if (!total) return;

    rows.forEach(r => {
      const v = Number(r[label] ?? 0);
      r[label] = round2((v / total) * 100);
    });
  });
}

function applyShowAsCross(
  rows: Record<string, unknown>[],
  measures: PivotValueField[],
  displayCols: string[],
  cellField: (colVal: string, m: PivotValueField) => string,
  totalField: (m: PivotValueField) => string,
  config: PivotConfig,
): void {
  measures.forEach(m => {
    const modo = m.showAs ?? 'value';
    if (modo === 'value') return;

    const campos = displayCols.map(c => cellField(c, m));
    const campoTotal = totalField(m);

    if (modo === 'pctRow') {
      // % sobre el total de la fila
      rows.forEach(r => {
        const total = Number(r[campoTotal] ?? campos.reduce((a, f) => a + Number(r[f] ?? 0), 0));
        if (!total) return;
        campos.forEach(f => { r[f] = round2((Number(r[f] ?? 0) / total) * 100); });
        if (config.showGrandTotals !== false) r[campoTotal] = 100;
      });
      return;
    }

    // pctCol y pctGrandTotal necesitan los totales de columna: la fila de Total
    // general los tiene ya calculados.
    const grand = rows.find(r => r[PIVOT_KIND_FIELD] === 'grand');
    if (!grand) return;

    if (modo === 'pctCol') {
      campos.concat(campoTotal).forEach(f => {
        const total = Number(grand[f] ?? 0);
        if (!total) return;
        rows.forEach(r => { r[f] = round2((Number(r[f] ?? 0) / total) * 100); });
      });
      return;
    }

    // pctGrandTotal: todo contra el total general de la medida
    const total = Number(grand[campoTotal] ?? 0);
    if (!total) return;
    campos.concat(campoTotal).forEach(f => {
      rows.forEach(r => { r[f] = round2((Number(r[f] ?? 0) / total) * 100); });
    });
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Si no hay medidas, Excel usa CONTAR: aqui igual. */
function effectiveMeasures(config: PivotConfig): PivotValueField[] {
  if (config.valueFields.length > 0) return config.valueFields;
  return [{ column: '*', operation: 'count', label: 'Conteo' }];
}

/** Etiqueta visible de una medida: "SUMA Total Facturado" */
export function measureLabel(vf: PivotValueField): string {
  if (vf.label) return vf.label;
  if (vf.column === '*') return 'Conteo';

  const base = `${operationLabel(vf.operation)} ${humanizeColumnName(vf.column)}`;
  switch (vf.showAs) {
    case 'pctGrandTotal': return `${base} (% total)`;
    case 'pctRow':        return `${base} (% fila)`;
    case 'pctCol':        return `${base} (% columna)`;
    default:              return base;
  }
}

/** Columnas de etiquetas de fila del resultado */
function rowLabelColumns(config: PivotConfig): PivotResultColumn[] {
  if (config.rowFields.length === 0) {
    return [{ field: 'Total', headerName: 'Etiquetas de fila' }];
  }
  return config.rowFields.map((f, i) => ({
    field: f,
    headerName: i === 0 ? `Etiquetas de fila: ${humanizeColumnName(f)}` : humanizeColumnName(f),
  }));
}

/** Orden natural: los numeros comparan como numeros, no como texto */
function compareLabels(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb) && a.trim() !== '' && b.trim() !== '') {
    return na - nb;
  }
  return a.localeCompare(b, 'es');
}

/**
 * Valor por el que se agrupa un campo.
 *
 * Aplica el "Agrupar" de Excel:
 *  - fechas: Año, Trimestre, Mes o Dia (por defecto Mes, para no generar miles
 *    de grupos de una sola fila con un timestamp exacto)
 *  - numeros: rangos de tamaño fijo ("0 - 99", "100 - 199")
 */
function groupedValue(
  row: Record<string, unknown>,
  field: string,
  cols: PivotColumnMeta[],
  setting?: PivotFieldSetting,
): string {
  const raw = row?.[field];
  if (raw === null || raw === undefined || raw === '') return '(vacio)';

  // Agrupacion numerica por rangos
  const step = setting?.numericStep ?? null;
  if (step && step > 0) {
    const n = Number(raw);
    if (Number.isFinite(n)) {
      const desde = Math.floor(n / step) * step;
      return `${desde} - ${desde + step - 1}`;
    }
  }

  const meta = cols.find(c => c.name === field);
  const esFecha = (!!meta && /date|datetime|timestamp/i.test(meta.type ?? ''))
    || (setting?.dateGroup != null && setting.dateGroup !== 'none');

  if (!esFecha) return String(raw).trim();

  const parsed = parseDateParts(String(raw));
  if (!parsed) return String(raw).trim();

  const { y, m, d } = parsed;

  switch (setting?.dateGroup ?? 'month') {
    case 'none':    return String(raw).trim();
    case 'year':    return String(y);
    case 'quarter': return `${y}-T${Math.floor((m - 1) / 3) + 1}`;
    case 'day':     return `${y}-${pad(m)}-${pad(d)}`;
    default:        return `${y}-${pad(m)}`;
  }
}

function parseDateParts(s: string): { y: number; m: number; d: number } | null {
  const iso = s.match(/^(\d{4})-(\d{2})-?(\d{2})?/);
  if (iso) return { y: +iso[1], m: +iso[2], d: +(iso[3] ?? 1) };

  const es = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (es) return { y: +es[3], m: +es[2], d: +es[1] };

  const dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() };
  }

  return null;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function aggregate(
  rows: Record<string, unknown>[],
  column: string,
  operation: PivotOperation | string,
): number {
  if (rows.length === 0) return 0;

  if (operation === 'count' || column === '*') return rows.length;
  if (operation === 'distinct') {
    return new Set(rows.map(r => String(r[column] ?? ''))).size;
  }

  const nums = rows.map(r => Number(r[column])).filter(n => Number.isFinite(n));
  if (nums.length === 0) return 0;

  switch (operation) {
    case 'sum': return nums.reduce((a, b) => a + b, 0);
    case 'avg': return round2(nums.reduce((a, b) => a + b, 0) / nums.length);
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

/** true si la columna es de fecha segun los metadatos (para ofrecer "Agrupar") */
export function isDateField(field: string, cols: PivotColumnMeta[]): boolean {
  const meta = cols.find(c => c.name === field);
  return !!meta && /date|datetime|timestamp/i.test(meta.type ?? '');
}

/** true si la columna es numerica (para ofrecer agrupacion por rangos) */
export function isNumericField(field: string, cols: PivotColumnMeta[]): boolean {
  const meta = cols.find(c => c.name === field);
  return !!meta && /int|decimal|numeric|float|double|money|real/i.test(meta.type ?? '');
}

// ── Exportacion de la tabla dinamica ─────────────────────────────────────────

/**
 * Convierte el resultado de un pivot a CSV listo para abrir en Excel.
 *
 * Se hace aparte del `exportDataAsCsv` de AG Grid a proposito:
 *  - AG Grid exportaba tambien las columnas tecnicas (__PIVOT_KIND__,
 *    __PIVOT_LEVEL__), que no deben salir.
 *  - No respetaba el formato: los porcentajes salian como el numero crudo y los
 *    subtotales sin su etiqueta.
 *
 * El CSV usa `;` como separador (Excel en español lo abre en columnas) y numeros
 * con coma decimal, coherente con el resto del visor.
 */
export function pivotResultToCsv(result: PivotResult): string {
  const cols = result.columns.filter(c => !PIVOT_META_FIELDS.includes(c.field));

  // Que medidas van en porcentaje, para anadir el "%" en la celda
  const pctLabels = new Set(
    result.config.valueFields
      .filter(v => v.showAs && v.showAs !== 'value')
      .map(v => measureLabel(v)),
  );
  const esPct = (field: string) =>
    pctLabels.size > 0 && [...pctLabels].some(l => field === l || field.endsWith(`· ${l}`));

  const esc = (s: string) => /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;

  const fmt = (field: string, type: string | undefined, value: unknown): string => {
    if (value === null || value === undefined || value === '') return '';
    if (type === 'numericColumn') {
      const n = Number(value);
      if (!Number.isFinite(n)) return String(value);
      const txt = n.toLocaleString('es-CO', { maximumFractionDigits: 2 });
      return esPct(field) ? `${txt} %` : txt;
    }
    return String(value);
  };

  const lineas: string[] = [];
  lineas.push(cols.map(c => esc(c.headerName)).join(';'));

  for (const row of result.rows) {
    lineas.push(cols.map(c => esc(fmt(c.field, c.type, row[c.field]))).join(';'));
  }

  // BOM para que Excel respete los acentos al abrir el CSV.
  return '\uFEFF' + lineas.join('\r\n');
}
