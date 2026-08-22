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

  autoGenerate(): void {
    if (this.config.rowFields.length === 0 && this.config.valueFields.length === 0) {
      return;
    }

    const data = this.sourceData;
    if (!data || data.length === 0) return;

    // Agrupar
    const grouped = new Map<string, Record<string, unknown>[]>();
    data.forEach(row => {
      const key = this.config.rowFields.length > 0
        ? this.config.rowFields.map(f => String(row[f] ?? '(vacio)')).join(' | ')
        : 'Total';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    });

    // Calcular
    const pivotRows: Record<string, unknown>[] = [];
    grouped.forEach((rows) => {
      const pivotRow: Record<string, unknown> = {};

      this.config.rowFields.forEach(f => {
        pivotRow[f] = rows[0][f] ?? '(vacio)';
      });

      this.config.valueFields.forEach(vf => {
        const values = rows.map(r => r[vf.column]).filter(v => v != null);
        const nums = values.map(v => Number(v)).filter(n => !isNaN(n));
        let result: number = 0;

        switch (vf.operation) {
          case 'sum': result = nums.reduce((a, b) => a + b, 0); break;
          case 'avg': result = nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0; break;
          case 'count': result = values.length; break;
          case 'min': result = nums.length > 0 ? Math.min(...nums) : 0; break;
          case 'max': result = nums.length > 0 ? Math.max(...nums) : 0; break;
          case 'distinct': result = new Set(values.map(v => String(v))).size; break;
        }

        const label = `${vf.operation.toUpperCase()} ${humanizeColumnName(vf.column)}`;
        pivotRow[label] = result;
      });

      if (this.config.valueFields.length === 0) {
        pivotRow['Conteo'] = rows.length;
      }

      pivotRows.push(pivotRow);
    });

    // Construir columnas del resultado
    const resultCols: Array<{ field: string; headerName: string; type?: string }> = [];

    this.config.rowFields.forEach(f => {
      resultCols.push({ field: f, headerName: humanizeColumnName(f) });
    });

    this.config.valueFields.forEach(vf => {
      const label = `${vf.operation.toUpperCase()} ${humanizeColumnName(vf.column)}`;
      resultCols.push({ field: label, headerName: label, type: 'numericColumn' });
    });

    if (this.config.valueFields.length === 0) {
      resultCols.push({ field: 'Conteo', headerName: 'Conteo', type: 'numericColumn' });
    }

    // Emitir resultado
    this.pivotGenerated.emit({ rows: pivotRows, columns: resultCols });
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
