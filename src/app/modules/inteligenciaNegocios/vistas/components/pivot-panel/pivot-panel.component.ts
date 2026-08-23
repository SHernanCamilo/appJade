import { Component, Input, Output, EventEmitter, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { humanizeColumnName } from '../../../helpers/column-type.helper';

export interface PivotConfig {
  rowFields: string[];
  columnFields: string[];
  valueFields: Array<{ column: string; operation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct'; label?: string }>;
  filterFields: string[];
}

export interface PivotResult {
  rows: Record<string, unknown>[];
  columns: Array<{ field: string; headerName: string; type?: string }>;
}

export interface PivotSheet {
  id: string;
  label: string;
  hasData: boolean;
}

@Component({
  selector: 'app-pivot-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pivot-panel.component.html',
  styleUrl: './pivot-panel.component.css',
})
export class PivotPanelComponent {
  /** Columnas disponibles para arrastrar */
  @Input() availableColumns: Array<{ name: string; type: string }> = [];
  
  /** Hojas con datos disponibles */
  @Input() sheets: PivotSheet[] = [];
  
  /** Datos fuente para el pivot */
  @Input() sourceData: Record<string, unknown>[] = [];

  /** Emite cuando se genera/actualiza la tabla dinamica */
  @Output() pivotGenerated = new EventEmitter<PivotResult>();
  
  /** Emite cuando se cierra el panel */
  @Output() closed = new EventEmitter<void>();
  
  /** Emite cuando se limpia todo */
  @Output() cleared = new EventEmitter<void>();

  /** Emite cuando se selecciona una hoja fuente */
  @Output() sheetSelected = new EventEmitter<string>();

  readonly humanize = humanizeColumnName;
  
  /** Hoja seleccionada como fuente */
  selectedSheetId = '';
  
  /** Configuracion actual del pivot */
  config: PivotConfig = {
    rowFields: [],
    columnFields: [],
    valueFields: [],
    filterFields: [],
  };

  /** Busqueda de campos */
  fieldSearch = '';

  /** Drag state */
  private dragData: { field: string; sourceZone?: string; sourceIndex?: number } | null = null;

  get filteredColumns(): Array<{ name: string; type: string }> {
    if (!this.fieldSearch.trim()) return this.availableColumns;
    const term = this.fieldSearch.toLowerCase();
    return this.availableColumns.filter(c => 
      c.name.toLowerCase().includes(term) || 
      humanizeColumnName(c.name).toLowerCase().includes(term)
    );
  }

  // --- Sheet selection ---

  onSheetChange(): void {
    if (this.selectedSheetId) {
      this.sheetSelected.emit(this.selectedSheetId);
    }
  }

  // --- Drag & Drop ---

  onDragStart(event: DragEvent, field: string): void {
    this.dragData = { field };
    event.dataTransfer?.setData('text/plain', field);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onChipDragStart(event: DragEvent, zone: string, index: number, field: string): void {
    this.dragData = { field, sourceZone: zone, sourceIndex: index };
    event.dataTransfer?.setData('text/plain', field);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onDrop(event: DragEvent, targetZone: 'row' | 'column' | 'value' | 'filter'): void {
    event.preventDefault();
    if (!this.dragData) return;

    const { field, sourceZone, sourceIndex } = this.dragData;

    // Si viene de otra zona, remover
    if (sourceZone && sourceIndex != null) {
      this.removeField(sourceZone as any, sourceIndex);
    }

    this.addField(targetZone, field);
    this.dragData = null;
    this.autoGenerate();
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }

  // --- Add/Remove fields ---

  addField(zone: 'row' | 'column' | 'value' | 'filter', field: string): void {
    switch (zone) {
      case 'row':
        if (!this.config.rowFields.includes(field)) this.config.rowFields.push(field);
        break;
      case 'column':
        if (!this.config.columnFields.includes(field)) this.config.columnFields.push(field);
        break;
      case 'value':
        this.config.valueFields.push({ column: field, operation: 'sum' });
        break;
      case 'filter':
        if (!this.config.filterFields.includes(field)) this.config.filterFields.push(field);
        break;
    }
  }

  addFieldAuto(zone: 'row' | 'column' | 'value' | 'filter', field: string): void {
    this.addField(zone, field);
    this.autoGenerate();
  }

  removeField(zone: 'row' | 'column' | 'value' | 'filter', index: number): void {
    switch (zone) {
      case 'row': this.config.rowFields.splice(index, 1); break;
      case 'column': this.config.columnFields.splice(index, 1); break;
      case 'value': this.config.valueFields.splice(index, 1); break;
      case 'filter': this.config.filterFields.splice(index, 1); break;
    }
  }

  removeFieldAuto(zone: 'row' | 'column' | 'value' | 'filter', index: number): void {
    this.removeField(zone, index);
    this.autoGenerate();
  }

  changeValueOperation(index: number, op: string): void {
    this.config.valueFields[index].operation = op as any;
    this.autoGenerate();
  }

  // --- Auto-generate ---

  /**
   * Genera la tabla dinamica real (cross-tabulation).
   *
   * Logica de Excel:
   *  - rowFields: los valores unicos de estas columnas se convierten en FILAS
   *  - columnFields: los valores unicos se convierten en ENCABEZADOS DE COLUMNA
   *  - valueFields: la operacion aplicada en cada celda de la interseccion
   *  - Si no hay valueFields: se usa CONTEO por defecto
   *  - Si solo hay rowFields (sin columnFields): tabla plana con totales
   *  - Si hay columnFields: cross-tab donde cada valor unico es una columna
   *
   * Agrupacion de fechas: si una columna de tipo date esta en rowFields,
   * se agrupa por Ano > Mes (no por valor exacto, que daria miles de filas).
   */
  autoGenerate(): void {
    // Se genera si hay al menos filas o columnas definidas
    if (this.config.rowFields.length === 0 && this.config.columnFields.length === 0) {
      return;
    }

    const data = this.sourceData;
    if (!data || data.length === 0) return;

    const hasColumns = this.config.columnFields.length > 0;

    if (hasColumns) {
      this.generateCrossTab(data);
    } else {
      this.generateFlatPivot(data);
    }
  }

  /**
   * Tabla dinamica plana (solo rowFields + values, sin columnas cruzadas).
   * Es la version sencilla cuando no hay columnFields.
   */
  private generateFlatPivot(data: Record<string, unknown>[]): void {
    const grouped = new Map<string, Record<string, unknown>[]>();
    data.forEach(row => {
      const key = this.config.rowFields.length > 0
        ? this.config.rowFields.map(f => this.getGroupedValue(row, f)).join(' | ')
        : 'Total';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    });

    const pivotRows: Record<string, unknown>[] = [];
    grouped.forEach((rows) => {
      const pivotRow: Record<string, unknown> = {};

      this.config.rowFields.forEach(f => {
        pivotRow[f] = this.getGroupedValue(rows[0], f);
      });

      if (this.config.valueFields.length > 0) {
        this.config.valueFields.forEach(vf => {
          const label = `${this.opLabel(vf.operation)} ${humanizeColumnName(vf.column)}`;
          pivotRow[label] = this.aggregate(rows, vf.column, vf.operation);
        });
      } else {
        pivotRow['Conteo'] = rows.length;
      }

      pivotRows.push(pivotRow);
    });

    // Ordenar por la primera columna de valor (descendente)
    const sortKey = this.config.valueFields.length > 0
      ? `${this.opLabel(this.config.valueFields[0].operation)} ${humanizeColumnName(this.config.valueFields[0].column)}`
      : 'Conteo';
    pivotRows.sort((a, b) => (Number(b[sortKey]) || 0) - (Number(a[sortKey]) || 0));

    // Construir columnas del resultado
    const resultCols: Array<{ field: string; headerName: string; type?: string }> = [];
    this.config.rowFields.forEach(f => {
      resultCols.push({ field: f, headerName: humanizeColumnName(f) });
    });
    if (this.config.valueFields.length > 0) {
      this.config.valueFields.forEach(vf => {
        const label = `${this.opLabel(vf.operation)} ${humanizeColumnName(vf.column)}`;
        resultCols.push({ field: label, headerName: label, type: 'numericColumn' });
      });
    } else {
      resultCols.push({ field: 'Conteo', headerName: 'Conteo', type: 'numericColumn' });
    }

    this.pivotGenerated.emit({ rows: pivotRows, columns: resultCols });
  }

  /**
   * Cross-tabulation real (como Excel): los valores unicos del columnField
   * se convierten en columnas de la tabla resultado.
   *
   * Ejemplo:
   *   rowFields: [Sede], columnFields: [Entidad], valueFields: [count TipoIdentificacion]
   *   Resultado:
   *     | Sede  | EPS SURA | EPS SANITAS | ... |
   *     | Norte |       12 |           8 | ... |
   */
  private generateCrossTab(data: Record<string, unknown>[]): void {
    const colField = this.config.columnFields[0]; // Solo primer columnField por ahora
    const valueOp = this.config.valueFields[0]?.operation ?? 'count';
    const valueCol = this.config.valueFields[0]?.column ?? colField;

    // 1. Obtener valores unicos de la columna (se convierten en headers)
    const uniqueColValues = new Set<string>();
    data.forEach(row => {
      const v = String(row[colField] ?? '(vacio)').trim();
      if (v) uniqueColValues.add(v);
    });
    const colValues = [...uniqueColValues].sort();

    // Limitar a 50 columnas para no reventar la grilla
    const maxCols = 50;
    const truncated = colValues.length > maxCols;
    const displayCols = colValues.slice(0, maxCols);

    // 2. Agrupar filas por rowFields
    const grouped = new Map<string, Record<string, unknown>[]>();
    data.forEach(row => {
      const key = this.config.rowFields.length > 0
        ? this.config.rowFields.map(f => this.getGroupedValue(row, f)).join(' | ')
        : 'Total';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    });

    // 3. Para cada grupo de filas, calcular el valor en cada columna cruzada
    const pivotRows: Record<string, unknown>[] = [];
    grouped.forEach((rows) => {
      const pivotRow: Record<string, unknown> = {};

      // Campos de fila
      this.config.rowFields.forEach(f => {
        pivotRow[f] = this.getGroupedValue(rows[0], f);
      });

      // Para cada valor unico del colField, filtrar las filas y agregar
      displayCols.forEach(colVal => {
        const subset = rows.filter(r => String(r[colField] ?? '(vacio)').trim() === colVal);
        pivotRow[colVal] = this.aggregate(subset, valueCol, valueOp);
      });

      // Total de la fila
      pivotRow['Total'] = this.aggregate(rows, valueCol, valueOp);

      pivotRows.push(pivotRow);
    });

    // Fila de totales generales
    const totalRow: Record<string, unknown> = {};
    this.config.rowFields.forEach(f => { totalRow[f] = 'Total general'; });
    displayCols.forEach(colVal => {
      const subset = data.filter(r => String(r[colField] ?? '(vacio)').trim() === colVal);
      totalRow[colVal] = this.aggregate(subset, valueCol, valueOp);
    });
    totalRow['Total'] = this.aggregate(data, valueCol, valueOp);
    pivotRows.push(totalRow);

    // 4. Construir definicion de columnas
    const resultCols: Array<{ field: string; headerName: string; type?: string }> = [];
    this.config.rowFields.forEach(f => {
      resultCols.push({ field: f, headerName: humanizeColumnName(f) });
    });
    displayCols.forEach(colVal => {
      resultCols.push({ field: colVal, headerName: colVal, type: 'numericColumn' });
    });
    resultCols.push({ field: 'Total', headerName: 'Total', type: 'numericColumn' });

    if (truncated) {
      console.warn(`[Pivot] Cross-tab truncada: ${colValues.length} valores unicos en "${colField}", mostrando ${maxCols}`);
    }

    this.pivotGenerated.emit({ rows: pivotRows, columns: resultCols });
  }

  // --- Helpers ---

  /**
   * Obtiene el valor agrupado de un campo. Si es fecha, agrupa por Ano-Mes.
   */
  private getGroupedValue(row: Record<string, unknown>, field: string): string {
    const raw = row[field];
    if (raw === null || raw === undefined || raw === '') return '(vacio)';

    const colMeta = this.availableColumns.find(c => c.name === field);
    const isDate = colMeta && /date|datetime|timestamp/i.test(colMeta.type ?? '');

    if (isDate) {
      const s = String(raw);
      // Intentar parsear como fecha: YYYY-MM-DD o DD/MM/YYYY
      const isoMatch = s.match(/^(\d{4})-(\d{2})/);
      if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}`; // "2026-08"

      const esMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
      if (esMatch) return `${esMatch[3]}-${esMatch[2]}`; // "2026-08"

      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      }
    }

    return String(raw).trim();
  }

  /** Calcula la operacion de agregacion sobre un conjunto de filas */
  private aggregate(
    rows: Record<string, unknown>[],
    column: string,
    operation: string,
  ): number {
    if (rows.length === 0) return 0;

    if (operation === 'count') return rows.length;
    if (operation === 'distinct') {
      return new Set(rows.map(r => String(r[column] ?? ''))).size;
    }

    const nums = rows
      .map(r => Number(r[column]))
      .filter(n => Number.isFinite(n));

    if (nums.length === 0) return operation === 'count' ? rows.length : 0;

    switch (operation) {
      case 'sum': return nums.reduce((a, b) => a + b, 0);
      case 'avg': return nums.reduce((a, b) => a + b, 0) / nums.length;
      case 'min': return Math.min(...nums);
      case 'max': return Math.max(...nums);
      default:    return rows.length;
    }
  }

  private opLabel(op: string): string {
    const labels: Record<string, string> = {
      sum: 'SUMA', avg: 'PROMEDIO', count: 'CONTAR',
      min: 'MIN', max: 'MAX', distinct: 'DISTINTOS',
    };
    return labels[op] ?? op.toUpperCase();
  }

  // --- Clear ---

  clearAll(): void {
    this.config = { rowFields: [], columnFields: [], valueFields: [], filterFields: [] };
    this.cleared.emit();
  }

  close(): void {
    this.closed.emit();
  }
}
