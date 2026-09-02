import { Component, signal, computed, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IDoesFilterPassParams, IFilterComp, IFilterParams, ValueGetterParams } from 'ag-grid-community';

/**
 * Filtro tipo Excel para AG Grid: lista de valores únicos con checkboxes,
 * búsqueda interna, y aplicación al hacer clic en "Aceptar".
 *
 * Uso en columnDef:
 * ```typescript
 * {
 *   field: 'status',
 *   filter: ExcelColumnFilterComponent,
 *   filterParams: { maxDisplayedValues: 50 }
 * }
 * ```
 */
@Component({
  selector: 'app-excel-column-filter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div #filterContainer class="excel-filter">
      <!-- Búsqueda -->
      <div class="excel-filter__search">
        <input
          type="text"
          class="excel-filter__search-input"
          placeholder="Buscar..."
          [(ngModel)]="searchTerm"
          (ngModelChange)="onSearchChange($event)" />
        <button
          *ngIf="searchTerm()"
          class="excel-filter__search-clear"
          (click)="clearSearch()">
          ×
        </button>
      </div>

      <!-- Lista de valores -->
      <div class="excel-filter__list">
        <!-- Seleccionar todo -->
        <label class="excel-filter__item excel-filter__item--all">
          <input
            type="checkbox"
            [checked]="allSelected()"
            [indeterminate]="someSelected()"
            (change)="toggleSelectAll($event)" />
          <span>(Seleccionar todo)</span>
        </label>

        <!-- Valores individuales -->
        <label
          *ngFor="let item of displayedValues(); trackBy: trackByValue"
          class="excel-filter__item">
          <input
            type="checkbox"
            [checked]="item.selected"
            (change)="toggleValue(item.value, $event)" />
          <span [title]="item.label">{{ item.label }}</span>
        </label>

        <!-- Mensaje si no hay resultados -->
        <div *ngIf="displayedValues().length === 0" class="excel-filter__empty">
          No se encontraron valores
        </div>
      </div>

      <!-- Botones -->
      <div class="excel-filter__actions">
        <button class="excel-filter__btn excel-filter__btn--primary" (click)="applyFilter()">
          Aceptar
        </button>
        <button class="excel-filter__btn excel-filter__btn--secondary" (click)="cancel()">
          Cancelar
        </button>
      </div>
    </div>
  `,
  styles: [`
    .excel-filter {
      width: 220px;
      max-height: 320px;
      display: flex;
      flex-direction: column;
      background: #fff;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      font-family: 'Segoe UI', system-ui, sans-serif;
      font-size: 12px;
    }

    .excel-filter__search {
      position: relative;
      padding: 8px;
      border-bottom: 1px solid #e5e7eb;
    }

    .excel-filter__search-input {
      width: 100%;
      padding: 4px 24px 4px 8px;
      border: 1px solid #d1d5db;
      border-radius: 3px;
      font-size: 12px;
      font-family: inherit;
    }

    .excel-filter__search-input:focus {
      outline: none;
      border-color: #217346;
    }

    .excel-filter__search-clear {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      width: 18px;
      height: 18px;
      border: none;
      background: transparent;
      color: #9ca3af;
      font-size: 16px;
      line-height: 1;
      cursor: pointer;
      padding: 0;
    }

    .excel-filter__search-clear:hover {
      color: #374151;
    }

    .excel-filter__list {
      flex: 1;
      overflow-y: auto;
      padding: 4px 0;
      min-height: 120px;
      max-height: 200px;
    }

    .excel-filter__item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      cursor: pointer;
      user-select: none;
      transition: background 0.1s;
    }

    .excel-filter__item:hover {
      background: #f3f4f6;
    }

    .excel-filter__item--all {
      border-bottom: 1px solid #e5e7eb;
      margin-bottom: 2px;
      font-weight: 600;
    }

    .excel-filter__item input[type="checkbox"] {
      cursor: pointer;
      flex-shrink: 0;
    }

    .excel-filter__item span {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .excel-filter__empty {
      padding: 16px 12px;
      text-align: center;
      color: #9ca3af;
      font-style: italic;
    }

    .excel-filter__actions {
      display: flex;
      gap: 6px;
      padding: 8px;
      border-top: 1px solid #e5e7eb;
    }

    .excel-filter__btn {
      flex: 1;
      padding: 5px 12px;
      border: 1px solid #d1d5db;
      border-radius: 3px;
      font-size: 12px;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.15s;
    }

    .excel-filter__btn--primary {
      background: #217346;
      color: #fff;
      border-color: #217346;
    }

    .excel-filter__btn--primary:hover {
      background: #1a5c38;
    }

    .excel-filter__btn--secondary {
      background: #fff;
      color: #374151;
    }

    .excel-filter__btn--secondary:hover {
      background: #f3f4f6;
    }
  `],
})
export class ExcelColumnFilterComponent implements IFilterComp, AfterViewInit {
  @ViewChild('filterContainer', { static: true }) filterContainer!: ElementRef<HTMLDivElement>;

  private params!: IFilterParams;
  private valueGetter!: ((params: ValueGetterParams) => unknown) | undefined;

  // Estado interno
  private allUniqueValues: Set<string> = new Set();
  private pendingSelected: Set<string> = new Set(); // valores seleccionados temporales
  private appliedSelected: Set<string> = new Set(); // valores confirmados con "Aceptar"

  readonly searchTerm = signal('');
  readonly maxDisplayed = signal(50);

  // Valores únicos de la columna con estado de selección
  private readonly allItems = signal<Array<{ value: string; label: string; selected: boolean }>>([]);

  // Valores filtrados por búsqueda
  readonly displayedValues = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const items = this.allItems();

    if (!term) return items.slice(0, this.maxDisplayed());

    return items
      .filter(item => item.label.toLowerCase().includes(term))
      .slice(0, this.maxDisplayed());
  });

  readonly allSelected = computed(() => {
    const items = this.allItems();
    return items.length > 0 && items.every(i => i.selected);
  });

  readonly someSelected = computed(() => {
    const items = this.allItems();
    const selected = items.filter(i => i.selected).length;
    return selected > 0 && selected < items.length;
  });

  ngAfterViewInit(): void {
    // AG Grid llama getGui() antes de que Angular inicialice el ViewChild,
    // así que lo guardamos en una propiedad para devolverlo en getGui()
  }

  getGui(): HTMLElement {
    return this.filterContainer.nativeElement;
  }

  agInit(params: IFilterParams): void {
    this.params = params;
    this.valueGetter = params.valueGetter;
    this.maxDisplayed.set((params as { maxDisplayedValues?: number }).maxDisplayedValues ?? 50);

    // Extraer valores únicos de toda la data
    this.extractUniqueValues();
  }

  private extractUniqueValues(): void {
    this.allUniqueValues.clear();

    this.params.api.forEachNode(node => {
      let value: unknown;

      if (this.valueGetter) {
        value = this.valueGetter({
          node,
          data: node.data,
          column: this.params.column,
          colDef: this.params.colDef
        } as ValueGetterParams);
      } else {
        // Fallback: usar el field directamente
        const field = this.params.colDef.field;
        value = field ? node.data?.[field] : null;
      }

      const str = value != null ? String(value).trim() : '(Vacío)';
      this.allUniqueValues.add(str);
    });

    // Por defecto: todos seleccionados
    const sortedValues = Array.from(this.allUniqueValues).sort();
    this.pendingSelected = new Set(sortedValues);
    this.appliedSelected = new Set(sortedValues);

    this.allItems.set(
      sortedValues.map(v => ({ value: v, label: v, selected: true }))
    );
  }

  isFilterActive(): boolean {
    // El filtro está activo si NO todos están seleccionados
    return this.appliedSelected.size < this.allUniqueValues.size;
  }

  doesFilterPass(params: IDoesFilterPassParams): boolean {
    let value: unknown;

    if (this.valueGetter) {
      value = this.valueGetter({
        node: params.node,
        data: params.data,
        column: this.params.column,
        colDef: this.params.colDef
      } as ValueGetterParams);
    } else {
      // Fallback: usar el field directamente
      const field = this.params.colDef.field;
      value = field ? params.data?.[field] : null;
    }

    const str = value != null ? String(value).trim() : '(Vacío)';
    return this.appliedSelected.has(str);
  }

  getModel(): Set<string> | null {
    return this.isFilterActive() ? this.appliedSelected : null;
  }

  setModel(model: Set<string> | null): void {
    if (model === null) {
      // Reset: seleccionar todo
      this.pendingSelected = new Set(this.allUniqueValues);
      this.appliedSelected = new Set(this.allUniqueValues);
      this.allItems.update(items => items.map(i => ({ ...i, selected: true })));
    } else {
      this.appliedSelected = new Set(model);
      this.pendingSelected = new Set(model);
      this.allItems.update(items =>
        items.map(i => ({ ...i, selected: model.has(i.value) }))
      );
    }
  }

  // ── UI Events ────────────────────────────────────────────────────────────

  onSearchChange(_term: string): void {
    // computed displayedValues se actualiza automáticamente
  }

  clearSearch(): void {
    this.searchTerm.set('');
  }

  toggleSelectAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.pendingSelected.clear();

    if (checked) {
      this.allUniqueValues.forEach(v => this.pendingSelected.add(v));
    }

    this.allItems.update(items => items.map(i => ({ ...i, selected: checked })));
  }

  toggleValue(value: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;

    if (checked) {
      this.pendingSelected.add(value);
    } else {
      this.pendingSelected.delete(value);
    }

    this.allItems.update(items =>
      items.map(i => (i.value === value ? { ...i, selected: checked } : i))
    );
  }

  applyFilter(): void {
    // Confirmar selección temporal
    this.appliedSelected = new Set(this.pendingSelected);

    // Notificar AG Grid que el filtro cambió
    this.params.filterChangedCallback();
  }

  cancel(): void {
    // Cerrar sin aplicar cambios — restaurar estado previo
    this.pendingSelected = new Set(this.appliedSelected);
    this.allItems.update(items =>
      items.map(i => ({ ...i, selected: this.appliedSelected.has(i.value) }))
    );

    this.params.filterChangedCallback();
  }

  trackByValue(_index: number, item: { value: string }): string {
    return item.value;
  }
}