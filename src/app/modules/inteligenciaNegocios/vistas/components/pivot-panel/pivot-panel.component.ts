import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy,
  OnChanges, SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { humanizeColumnName } from '../../../helpers/column-type.helper';
import {
  computePivot,
  clonePivotConfig,
  emptyPivotConfig,
  type PivotConfig,
  type PivotResult,
} from '../../helpers/pivot-engine';

// Se re-exportan para no romper los imports existentes del visor.
export type { PivotConfig, PivotResult } from '../../helpers/pivot-engine';

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
export class PivotPanelComponent implements OnChanges {
  /** Columnas disponibles para arrastrar */
  @Input() availableColumns: Array<{ name: string; type: string }> = [];

  /** Hojas con datos disponibles */
  @Input() sheets: PivotSheet[] = [];

  /** Datos fuente para el pivot */
  @Input() sourceData: Record<string, unknown>[] = [];

  /**
   * Config con la que abrir el panel (pivot ya existente para la hoja fuente).
   * Sin esto, al reabrir el panel de un pivot guardado las zonas salian vacias
   * y parecia que la configuracion se habia perdido.
   */
  @Input() initialConfig: PivotConfig | null = null;

  /** Hoja fuente preseleccionada en el desplegable */
  @Input() initialSheetId = '';

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
  config: PivotConfig = emptyPivotConfig();

  /** Busqueda de campos */
  fieldSearch = '';

  /** Drag state */
  private dragData: { field: string; sourceZone?: string; sourceIndex?: number } | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    // Hidratar la config guardada al abrir el panel sobre un pivot existente.
    if (changes['initialConfig']) {
      this.config = this.initialConfig
        ? clonePivotConfig(this.initialConfig)
        : emptyPivotConfig();
    }
    if (changes['initialSheetId'] && this.initialSheetId) {
      this.selectedSheetId = this.initialSheetId;
    }
  }

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
   * Recalcula la tabla dinamica con la config actual.
   *
   * El calculo vive en `helpers/pivot-engine.ts` (funcion pura) para que el visor
   * pueda reconstruir un pivot guardado sin abrir este panel.
   */
  autoGenerate(): void {
    const result = computePivot(this.sourceData, this.config, this.availableColumns);
    if (result) this.pivotGenerated.emit(result);
  }

  // --- Clear ---

  clearAll(): void {
    this.config = emptyPivotConfig();
    this.cleared.emit();
  }

  close(): void {
    this.closed.emit();
  }
}
