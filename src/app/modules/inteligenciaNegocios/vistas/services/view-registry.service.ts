import { Injectable, signal } from '@angular/core';

/**
 * Una vista cargada disponible para las formulas.
 * Las filas se guardan POR REFERENCIA: no se duplica el dataset.
 */
export interface RegisteredView {
  /** Nombre con el que se referencia en las formulas */
  name: string;
  /** Filas de la vista (referencia al array original, no una copia) */
  rows: Record<string, unknown>[];
  /** Nombres de columna disponibles */
  columns: string[];
}

/**
 * Almacen estatico que leen las funciones personalizadas de HyperFormula.
 *
 * Tiene que ser estatico (a nivel de modulo) porque HyperFormula comparte la
 * instancia del FunctionPlugin entre instancias del motor, asi que el plugin
 * no puede recibir dependencias por constructor.
 *
 * Los indices de busqueda se construyen de forma perezosa: solo cuando una
 * formula consulta una columna concreta. Un indice de 800.000 claves ocupa
 * decenas de MB, asi que no se crea ninguno hasta que hace falta.
 */
const REGISTRY = new Map<string, {
  rows: Record<string, unknown>[];
  columns: string[];
  indexes: Map<string, Map<string, Record<string, unknown>>>;
}>();

/** Codigos de error compatibles con Excel */
const ERR_VIEW = '#¡VISTA!';
const ERR_NA = '#N/D';

function normalizeKey(v: unknown): string {
  if (v === null || v === undefined) return '';
  // Los codigos de Fabric suelen venir con padding ('5956916   ')
  return String(v).trim();
}

function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Obtiene (o construye) el indice de una columna de una vista. */
function getIndex(viewName: string, keyCol: string) {
  const entry = REGISTRY.get(viewName);
  if (!entry) return null;

  let idx = entry.indexes.get(keyCol);
  if (!idx) {
    idx = new Map<string, Record<string, unknown>>();
    for (const row of entry.rows) {
      const k = normalizeKey(row[keyCol]);
      // Primera coincidencia gana, igual que BUSCARV con ordenado=FALSO
      if (k !== '' && !idx.has(k)) idx.set(k, row);
    }
    entry.indexes.set(keyCol, idx);
    console.log(`[ViewRegistry] Indice creado: ${viewName}.${keyCol} -> ${idx.size} claves`);
  }
  return idx;
}

// ─────────────────────────────────────────────────────────────────────────────
// API que consumen las funciones personalizadas de HyperFormula
// ─────────────────────────────────────────────────────────────────────────────

export function lookupInView(
  viewName: string, keyCol: string, keyValue: unknown, returnCol: string,
): string | number {
  const idx = getIndex(viewName, keyCol);
  if (!idx) return ERR_VIEW;

  const row = idx.get(normalizeKey(keyValue));
  if (!row) return ERR_NA;

  const v = row[returnCol];
  if (v === null || v === undefined) return '';
  return typeof v === 'number' ? v : String(v);
}

export function countInView(viewName: string, col: string, value: unknown): number | string {
  const entry = REGISTRY.get(viewName);
  if (!entry) return ERR_VIEW;

  const target = normalizeKey(value);
  let n = 0;
  for (const row of entry.rows) {
    if (normalizeKey(row[col]) === target) n++;
  }
  return n;
}

export function sumInView(
  viewName: string, sumCol: string, filterCol: string, filterValue: unknown,
): number | string {
  const entry = REGISTRY.get(viewName);
  if (!entry) return ERR_VIEW;

  const target = normalizeKey(filterValue);
  let total = 0;
  for (const row of entry.rows) {
    if (normalizeKey(row[filterCol]) !== target) continue;
    const n = toNumber(row[sumCol]);
    if (n !== null) total += n;
  }
  return total;
}

// ─────────────────────────────────────────────────────────────────────────────
// Servicio Angular: alta/baja de vistas y metadata para el autocompletado
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ViewRegistryService {
  /** Vistas disponibles para formulas (reactivo, alimenta el autocompletado) */
  readonly views = signal<RegisteredView[]>([]);

  /**
   * Registra o actualiza una vista. Las filas se guardan por referencia.
   * Si la vista ya existia, se descartan sus indices para que se reconstruyan
   * con los datos nuevos.
   */
  register(name: string, rows: Record<string, unknown>[], columns?: string[]): void {
    if (!name || rows.length === 0) return;

    const cols = columns && columns.length > 0
      ? columns
      : Object.keys(rows[0] ?? {}).filter(k => k !== '__ROW_NUMBER__');

    REGISTRY.set(name, { rows, columns: cols, indexes: new Map() });

    this.views.update(list => {
      const rest = list.filter(v => v.name !== name);
      return [...rest, { name, rows, columns: cols }];
    });

    console.log(`[ViewRegistry] Registrada "${name}": ${rows.length} filas, ${cols.length} columnas`);
  }

  /** Quita una vista del registro (al cerrar una hoja, por ejemplo). */
  unregister(name: string): void {
    REGISTRY.delete(name);
    this.views.update(list => list.filter(v => v.name !== name));
  }

  /** Invalida los indices de una vista sin quitarla (tras un refresh de datos). */
  invalidateIndexes(name: string): void {
    const entry = REGISTRY.get(name);
    if (entry) entry.indexes.clear();
  }

  /** Nombres de vistas registradas, para el autocompletado. */
  viewNames(): string[] {
    return this.views().map(v => v.name);
  }

  /** Mapa vista -> columnas, para el autocompletado. */
  columnsByView(): Map<string, string[]> {
    return new Map(this.views().map(v => [v.name, v.columns]));
  }

  /** Cuantos indices hay construidos (diagnostico de memoria). */
  indexStats(): Array<{ view: string; indexes: number; keys: number }> {
    const out: Array<{ view: string; indexes: number; keys: number }> = [];
    REGISTRY.forEach((entry, view) => {
      let keys = 0;
      entry.indexes.forEach(idx => { keys += idx.size; });
      out.push({ view, indexes: entry.indexes.size, keys });
    });
    return out;
  }
}
