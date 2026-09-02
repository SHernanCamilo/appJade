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
  distinctFieldValues,
  isDateField,
  isNumericField,
  type PivotConfig,
  type PivotResult,
  type PivotDateGroup,
} from '../../helpers/pivot-engine';

// Se re-exportan para no romper los imports existentes del visor.
export type { PivotConfig, PivotResult } from '../../helpers/pivot-engine';

export interface PivotSheet {
  id: string;
  label: string;
  hasData: boolean;
}

/** Zonas del panel, iguales a los 4 cuadrantes de Excel */
type PivotZone = 'row' | 'column' | 'value' | 'filter';

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

  /** Campo cuyo panel de opciones ("Configuracion de campo") esta abierto */
  openSettingsField = '';

  /** Drag state */
  private dragData: { field: string; sourceZone?: string; sourceIndex?: number } | null = null;

  /** Cache de valores distintos por campo de filtro (se recalcula al cambiar datos) */
  private valuesCache = new Map<string, string[]>();

  ngOnChanges(changes: SimpleChanges): void {
    // Hidratar la config guardada al abrir el panel sobre un pivot existente.
    if (changes['initialConfig']) {
      this.config = this.initialConfig
        ? { ...emptyPivotConfig(), ...clonePivotConfig(this.initialConfig) }
        : emptyPivotConfig();
    }
    if (changes['initialSheetId'] && this.initialSheetId) {
      this.selectedSheetId = this.initialSheetId;
    }
    // Los valores de los filtros dependen del dataset: al cambiar de hoja fuente
    // hay que olvidarlos o se ofrecerian los de la vista anterior.
    if (changes['sourceData'] || changes['initialSheetId']) {
      this.valuesCache.clear();
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
      this.valuesCache.clear();
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

  onDrop(event: DragEvent, targetZone: PivotZone): void {
    event.preventDefault();
    if (!this.dragData) return;

    const { field, sourceZone, sourceIndex } = this.dragData;

    // Si viene de otra zona, remover
    if (sourceZone && sourceIndex != null) {
      this.removeField(sourceZone as PivotZone, sourceIndex);
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

  addField(zone: PivotZone, field: string): void {
    switch (zone) {
      case 'row':
        if (!this.config.rowFields.includes(field)) this.config.rowFields.push(field);
        break;
      case 'column':
        if (!this.config.columnFields.includes(field)) this.config.columnFields.push(field);
        break;
      case 'value':
        // Excel elige SUMA para numeros y CONTAR para texto: mismo criterio.
        this.config.valueFields.push({
          column: field,
          operation: isNumericField(field, this.availableColumns) ? 'sum' : 'count',
          showAs: 'value',
        });
        break;
      case 'filter':
        if (!this.config.filterFields.includes(field)) this.config.filterFields.push(field);
        break;
    }
  }

  addFieldAuto(zone: PivotZone, field: string): void {
    this.addField(zone, field);
    this.autoGenerate();
  }

  removeField(zone: PivotZone, index: number): void {
    switch (zone) {
      case 'row': {
        const [f] = this.config.rowFields.splice(index, 1);
        if (f && this.config.fieldSettings) delete this.config.fieldSettings[f];
        break;
      }
      case 'column': this.config.columnFields.splice(index, 1); break;
      case 'value': this.config.valueFields.splice(index, 1); break;
      case 'filter': {
        const [f] = this.config.filterFields.splice(index, 1);
        if (f && this.config.filterValues) delete this.config.filterValues[f];
        break;
      }
    }
  }

  removeFieldAuto(zone: PivotZone, index: number): void {
    this.removeField(zone, index);
    this.autoGenerate();
  }

  changeValueOperation(index: number, op: string): void {
    this.config.valueFields[index].operation = op as any;
    this.autoGenerate();
  }

  /** "Mostrar valores como" de Excel */
  changeValueShowAs(index: number, showAs: string): void {
    this.config.valueFields[index].showAs = showAs as any;
    this.autoGenerate();
  }

  // --- Configuracion de campo: agrupar / contraer ---

  toggleFieldSettings(field: string): void {
    this.openSettingsField = this.openSettingsField === field ? '' : field;
  }

  fieldSetting(field: string) {
    this.config.fieldSettings ??= {};
    this.config.fieldSettings[field] ??= {};
    return this.config.fieldSettings[field];
  }

  isDate(field: string): boolean {
    return isDateField(field, this.availableColumns);
  }

  isNumeric(field: string): boolean {
    return isNumericField(field, this.availableColumns);
  }

  /** Agrupar fechas: Año / Trimestre / Mes / Dia (o valor exacto) */
  changeDateGroup(field: string, group: string): void {
    this.fieldSetting(field).dateGroup = group as PivotDateGroup;
    this.autoGenerate();
  }

  /** Agrupar numeros por rangos de tamaño fijo, como el dialogo Agrupar de Excel */
  changeNumericStep(field: string, step: string): void {
    const n = Number(step);
    this.fieldSetting(field).numericStep = Number.isFinite(n) && n > 0 ? n : null;
    this.autoGenerate();
  }

  /** Desagrupar: quita agrupacion de fecha y de rangos numericos */
  ungroupField(field: string): void {
    const s = this.fieldSetting(field);
    s.dateGroup = 'none';
    s.numericStep = null;
    this.autoGenerate();
  }

  /** Contraer / Expandir el primer campo de fila (el +/- de Excel) */
  toggleCollapse(): void {
    const first = this.config.rowFields[0];
    if (!first) return;
    const s = this.fieldSetting(first);
    s.collapsed = !s.collapsed;
    this.autoGenerate();
  }

  get isCollapsed(): boolean {
    const first = this.config.rowFields[0];
    return !!first && !!this.config.fieldSettings?.[first]?.collapsed;
  }

  get canCollapse(): boolean {
    return this.config.rowFields.length > 1;
  }

  toggleSubtotals(): void {
    this.config.showSubtotals = !(this.config.showSubtotals !== false);
    this.autoGenerate();
  }

  toggleGrandTotals(): void {
    this.config.showGrandTotals = !(this.config.showGrandTotals !== false);
    this.autoGenerate();
  }

  changeSort(value: string): void {
    const [by, dir] = value.split(':');
    this.config.sortBy = by as 'label' | 'value';
    this.config.sortDir = dir as 'asc' | 'desc';
    this.autoGenerate();
  }

  get sortValue(): string {
    return `${this.config.sortBy ?? 'value'}:${this.config.sortDir ?? 'desc'}`;
  }

  // --- Filtros de informe ---

  /** Valores distintos disponibles para un campo de filtro (cacheados) */
  filterOptions(field: string): string[] {
    const cached = this.valuesCache.get(field);
    if (cached) return cached;

    const vals = distinctFieldValues(
      this.sourceData, field, this.availableColumns,
      this.config.fieldSettings?.[field],
    );
    this.valuesCache.set(field, vals);
    return vals;
  }

  filterSelection(field: string): string[] {
    return this.config.filterValues?.[field] ?? [];
  }

  isFilterValueSelected(field: string, value: string): boolean {
    const sel = this.filterSelection(field);
    return sel.length === 0 || sel.includes(value);
  }

  /** Marca/desmarca un valor del filtro de informe */
  toggleFilterValue(field: string, value: string): void {
    this.config.filterValues ??= {};
    const actual = this.config.filterValues[field] ?? [];

    // Vacio significa "todos": al desmarcar uno hay que materializar el resto.
    const base = actual.length === 0 ? this.filterOptions(field) : actual;
    const next = base.includes(value)
      ? base.filter(v => v !== value)
      : [...base, value];

    // Todos marcados vuelve a significar "sin filtro"
    this.config.filterValues[field] =
      next.length === this.filterOptions(field).length ? [] : next;

    this.autoGenerate();
  }

  clearFilterValues(field: string): void {
    this.config.filterValues ??= {};
    this.config.filterValues[field] = [];
    this.autoGenerate();
  }

  filterBadge(field: string): string {
    const sel = this.filterSelection(field);
    return sel.length === 0 ? '(Todas)' : `${sel.length} sel.`;
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

  /** Boton "Actualizar" del panel: recalcula con los datos que haya ahora */
  refresh(): void {
    this.valuesCache.clear();
    this.autoGenerate();
  }

  // --- Clear ---

  clearAll(): void {
    this.config = emptyPivotConfig();
    this.valuesCache.clear();
    this.openSettingsField = '';
    this.cleared.emit();
  }

  close(): void {
    this.closed.emit();
  }
}
