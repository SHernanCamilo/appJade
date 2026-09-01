/**
 * Seleccion de rango de celdas estilo Excel para AG Grid COMMUNITY.
 *
 * Por que existe: la seleccion de rango arrastrando el mouse (Cell Selection)
 * es una funcion de AG Grid ENTERPRISE. Este proyecto usa ag-grid-community
 * 32.3.3 sin licencia, asi que `cellSelection` / `enableRangeSelection` no
 * hacen nada. Ref: https://www.ag-grid.com/javascript-data-grid/cell-selection/
 * (marcada como Enterprise) y la pagina de Community vs Enterprise.
 *
 * Solucion sin licencia: se escucha mousedown/mouseover/mouseup sobre el cuerpo
 * de la grilla, se calcula el rectangulo fila×columna y se marca cada celda con
 * una clase CSS. AG Grid aplica cellClass como funcion en cada render, asi que
 * el rango se repinta al hacer scroll (virtual scroll) sin trabajo extra.
 *
 * Da: seleccionar arrastrando, Shift+clic para extender, Ctrl/Cmd+C para copiar
 * el rango como TSV (pegable en Excel) y los agregados del rango. No pretende
 * replicar todo Enterprise (multi-rango con Ctrl, relleno, etc.), solo lo que
 * el usuario necesita a diario.
 */
import type { GridApi } from 'ag-grid-community';

/** Una celda del rango, por indice de fila y id de columna. */
export interface RangeCell {
  rowIndex: number;
  colId: string;
}

/** Rectangulo seleccionado, normalizado (inicio <= fin). */
export interface CellRange {
  fromRow: number;
  toRow: number;
  /** Ids de columna en el orden en que se muestran, de izquierda a derecha. */
  colIds: string[];
}

/**
 * Gestiona la seleccion de rango sobre una instancia de AG Grid.
 *
 * Se instancia una vez (en onGridReady) y se destruye en ngOnDestroy. No guarda
 * estado de Angular: expone el rango actual y notifica por callback para que el
 * componente actualice la barra de estado.
 */
export class CellRangeSelection {
  private anchor: RangeCell | null = null;   // celda donde empezo el arrastre
  private focus: RangeCell | null = null;    // celda actual bajo el mouse
  private dragging = false;

  /** Ids de columnas seleccionables (excluye la banda de numeros de fila). */
  private selectableColIds: string[] = [];

  private readonly onMouseDown = (e: MouseEvent) => this.handleMouseDown(e);
  private readonly onMouseOver = (e: MouseEvent) => this.handleMouseOver(e);
  private readonly onMouseUp = () => this.handleMouseUp();

  constructor(
    private readonly api: GridApi,
    private readonly gridRoot: HTMLElement,
    /** Se llama cada vez que el rango cambia (para refrescar agregados). */
    private readonly onChange: () => void,
  ) {
    this.gridRoot.addEventListener('mousedown', this.onMouseDown);
    this.gridRoot.addEventListener('mouseover', this.onMouseOver);
    // mouseup en document: el usuario puede soltar fuera de la grilla
    document.addEventListener('mouseup', this.onMouseUp);
  }

  destroy(): void {
    this.gridRoot.removeEventListener('mousedown', this.onMouseDown);
    this.gridRoot.removeEventListener('mouseover', this.onMouseOver);
    document.removeEventListener('mouseup', this.onMouseUp);
  }

  /** Vacia la seleccion y repinta. */
  clear(): void {
    this.anchor = null;
    this.focus = null;
    this.dragging = false;
    this.refresh();
  }

  /** ¿La celda (fila, columna) esta dentro del rango actual? Lo usa cellClass. */
  isSelected(rowIndex: number, colId: string): boolean {
    const range = this.getRange();
    if (!range) return false;
    if (rowIndex < range.fromRow || rowIndex > range.toRow) return false;
    return range.colIds.includes(colId);
  }

  /** Rango normalizado actual, o null si no hay seleccion. */
  getRange(): CellRange | null {
    if (!this.anchor || !this.focus) return null;

    const fromRow = Math.min(this.anchor.rowIndex, this.focus.rowIndex);
    const toRow = Math.max(this.anchor.rowIndex, this.focus.rowIndex);

    const orderedIds = this.currentColumnOrder();
    const a = orderedIds.indexOf(this.anchor.colId);
    const f = orderedIds.indexOf(this.focus.colId);
    if (a === -1 || f === -1) return null;

    const colIds = orderedIds.slice(Math.min(a, f), Math.max(a, f) + 1);
    return { fromRow, toRow, colIds };
  }

  /**
   * Selecciona una columna entera por su id (clic en el encabezado).
   * Va de la primera a la ultima fila visible.
   */
  selectWholeColumn(colId: string): void {
    const last = this.api.getDisplayedRowCount() - 1;
    if (last < 0) return;
    this.anchor = { rowIndex: 0, colId };
    this.focus = { rowIndex: last, colId };
    this.dragging = false;
    this.refresh();
  }

  /** Copia el rango al portapapeles como TSV, listo para pegar en Excel. */
  async copyToClipboard(withHeaders: boolean): Promise<number> {
    const range = this.getRange();
    if (!range) return 0;

    const lines: string[] = [];

    if (withHeaders) {
      lines.push(range.colIds.map(id => this.headerName(id)).join('\t'));
    }

    for (let r = range.fromRow; r <= range.toRow; r++) {
      const node = this.api.getDisplayedRowAtIndex(r);
      if (!node?.data) continue;
      const fila = range.colIds.map(id => {
        const v = (node.data as Record<string, unknown>)[id];
        return v === null || v === undefined ? '' : String(v);
      });
      lines.push(fila.join('\t'));
    }

    await navigator.clipboard.writeText(lines.join('\n'));
    return range.toRow - range.fromRow + 1;
  }

  /** Valores del rango como lista plana, para calcular agregados. */
  rangeValues(): unknown[] {
    const range = this.getRange();
    if (!range) return [];

    const out: unknown[] = [];
    for (let r = range.fromRow; r <= range.toRow; r++) {
      const node = this.api.getDisplayedRowAtIndex(r);
      if (!node?.data) continue;
      for (const id of range.colIds) {
        out.push((node.data as Record<string, unknown>)[id]);
      }
    }
    return out;
  }

  // ── Manejo del mouse ──────────────────────────────────────────────────────

  private handleMouseDown(e: MouseEvent): void {
    // Solo boton izquierdo; el derecho abre el menu contextual
    if (e.button !== 0) return;

    const cell = this.cellFromEvent(e);
    if (!cell) return;

    // Shift+clic extiende desde el ancla existente
    if (e.shiftKey && this.anchor) {
      this.focus = cell;
    } else {
      this.anchor = cell;
      this.focus = cell;
    }
    this.dragging = true;
    // Evita que el navegador seleccione texto mientras se arrastra el rango
    this.gridRoot.classList.add('vr-range-dragging');
    this.refresh();
  }

  private handleMouseOver(e: MouseEvent): void {
    if (!this.dragging) return;
    const cell = this.cellFromEvent(e);
    if (!cell) return;
    // Evitar repintar si seguimos en la misma celda
    if (this.focus && cell.rowIndex === this.focus.rowIndex && cell.colId === this.focus.colId) return;
    this.focus = cell;
    this.refresh();
  }

  private handleMouseUp(): void {
    this.dragging = false;
    this.gridRoot.classList.remove('vr-range-dragging');
  }

  // ── Utilidades ────────────────────────────────────────────────────────────

  /** Deduce fila y columna desde el elemento DOM de una celda de AG Grid. */
  private cellFromEvent(e: MouseEvent): RangeCell | null {
    const cellEl = (e.target as HTMLElement).closest('.ag-cell') as HTMLElement | null;
    if (!cellEl) return null;

    const colId = cellEl.getAttribute('col-id');
    if (!colId || colId === '__ROW_NUMBER__') return null;

    // El rowIndex vive en la fila padre
    const rowEl = cellEl.closest('.ag-row') as HTMLElement | null;
    const rowIndexAttr = rowEl?.getAttribute('row-index');
    if (rowIndexAttr === null || rowIndexAttr === undefined) return null;

    const rowIndex = Number(rowIndexAttr);
    return Number.isNaN(rowIndex) ? null : { rowIndex, colId };
  }

  /** Ids de columnas visibles en orden, sin la banda de numeros de fila. */
  private currentColumnOrder(): string[] {
    const cols = this.api.getAllDisplayedColumns?.() ?? [];
    this.selectableColIds = cols
      .map(c => c.getColId())
      .filter(id => id !== '__ROW_NUMBER__');
    return this.selectableColIds;
  }

  private headerName(colId: string): string {
    const col = this.api.getColumn(colId);
    return (col?.getColDef().headerName as string) || colId;
  }

  /** Repinta las celdas y notifica al componente. */
  private refresh(): void {
    this.api.refreshCells({ force: true });
    this.onChange();
  }
}
