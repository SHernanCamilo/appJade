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

    // El teclado del popup NO debe llegar al documento: el visor tiene atajos
    // globales (Ctrl+C, Ctrl+V, Delete, Escape) y al escribir en el buscador
    // saltaba la alerta de "solo lectura" o se borraba el filtro de la columna.
    this.filterContainer?.nativeElement.addEventListener('keydown', (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Enter') this.applyFilter();
    });
  }

  /**
   * AG Grid avisa cuando llegan filas nuevas (recarga, paginacion, refresco).
   *
   * Sin esto la lista de valores quedaba congelada con la de la primera carga:
   * tras "Actualizar todo" el filtro ofrecia valores que ya no existian y
   * ocultaba los nuevos.
   */
  onNewRowsLoaded(): void {
    const previos = new Set(this.appliedSelected);
    const eraActivo = this.isFilterActive();

    this.extractUniqueValues();

    if (!eraActivo) return;

    // Conservar la seleccion del usuario, quedandose solo con los valores que
    // siguen existiendo.
    const vigentes = new Set([...previos].filter(v => this.allUniqueValues.has(v)));
    if (vigentes.size === 0) return; // todo lo elegido desaparecio: mostrar todo

    this.appliedSelected = vigentes;
    this.pendingSelected = new Set(vigentes);
    this.allItems.update(items => items.map(i => ({ ...i, selected: vigentes.has(i.value) })));
  }

  private extractUniqueValues(): void {
    this.allUniqueValues.clear();

    this.params.api.forEachNode(node => {
      const str = this.cellText(node.data, node);
      this.allUniqueValues.add(str);
    });

    // Orden natural: los numeros como numeros, no como texto ("2" antes de "10")
    const sortedValues = Array.from(this.allUniqueValues).sort(compareNatural);

    // Por defecto: todos seleccionados
    this.pendingSelected = new Set(sortedValues);
    this.appliedSelected = new Set(sortedValues);

    this.allItems.set(
      sortedValues.map(v => ({ value: v, label: v, selected: true }))
    );
  }

  /**
   * Texto por el que se agrupa y compara una celda.
   *
   * Se usa el MISMO criterio al construir la lista y al filtrar; si difieren,
   * marcar un valor no deja pasar ninguna fila (el filtro parecia roto).
   */
  private cellText(data: unknown, node: unknown): string {
    let value: unknown;

    if (this.valueGetter) {
      value = this.valueGetter({
        node,
        data,
        column: this.params.column,
        colDef: this.params.colDef,
      } as unknown as ValueGetterParams);
    } else {
      const field = this.params.colDef.field;
      value = field ? (data as Record<string, unknown> | undefined)?.[field] : null;
    }

    if (value === null || value === undefined || value === '') return '(Vacío)';
    return String(value).trim();
  }

  isFilterActive(): boolean {
    // El filtro está activo si NO todos están seleccionados
    return this.appliedSelected.size < this.allUniqueValues.size;
  }

  doesFilterPass(params: IDoesFilterPassParams): boolean {
    return this.appliedSelected.has(this.cellText(params.data, params.node));
  }

  /**
   * Modelo del filtro. Es un OBJETO PLANO a proposito.
   *
   * Antes devolvia un `Set`, y eso rompia a todo el que lo consumiera:
   *  - `api.getFilterModel()` entregaba `{ Banco: Set }`, asi que el codigo que
   *    leia `m.filter` / `m.type` (para traducirlo a filtros del backend) no
   *    encontraba nada y la consulta salia SIN filtro.
   *  - un Set no sobrevive a JSON, asi que tampoco se podia guardar el estado
   *    del workbook ni restaurarlo.
   */
  getModel(): ExcelColumnFilterModel | null {
    if (!this.isFilterActive()) return null;
    return {
      filterType: 'excelValues',
      values: [...this.appliedSelected],
    };
  }

  /** Acepta el formato nuevo `{values}`, un array suelto o el Set antiguo. */
  setModel(model: ExcelColumnFilterModel | string[] | Set<string> | null): void {
    if (model === null || model === undefined) {
      // Reset: seleccionar todo
      this.pendingSelected = new Set(this.allUniqueValues);
      this.appliedSelected = new Set(this.allUniqueValues);
      this.allItems.update(items => items.map(i => ({ ...i, selected: true })));
      return;
    }

    const values: string[] = Array.isArray(model)
      ? model
      : model instanceof Set
        ? [...model]
        : (model.values ?? []);

    const selected = new Set(values);
    this.appliedSelected = selected;
    this.pendingSelected = new Set(selected);
    this.allItems.update(items =>
      items.map(i => ({ ...i, selected: selected.has(i.value) }))
    );
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
    // Sin nada marcado el resultado seria una tabla vacia: Excel no lo permite
    // y deja el boton Aceptar inactivo. Aqui se avisa y no se aplica.
    if (this.pendingSelected.size === 0) {
      this.searchTerm.set('');
      return;
    }

    // Confirmar selección temporal
    this.appliedSelected = new Set(this.pendingSelected);

    // Notificar AG Grid que el filtro cambió
    this.params.filterChangedCallback();

    // Y cerrar el desplegable, como Excel al pulsar Aceptar.
    this.closePopup();
  }

  cancel(): void {
    // Cerrar sin aplicar cambios: se restaura la seleccion confirmada.
    //
    // Antes llamaba a filterChangedCallback(), que dispara onFilterChanged en el
    // visor (y en la vista paginada, una recarga al servidor) aunque el usuario
    // no hubiera cambiado nada. Cancelar no debe tocar el filtro.
    this.pendingSelected = new Set(this.appliedSelected);
    this.allItems.update(items =>
      items.map(i => ({ ...i, selected: this.appliedSelected.has(i.value) }))
    );
    this.searchTerm.set('');

    this.closePopup();
  }

  /**
   * Cierra el desplegable, como Excel al pulsar Aceptar.
   *
   * `hidePopupMenu()` existe en el GridApi de la v32, pero se registra por
   * modulo: si no estuviera disponible solo deja un aviso en consola. Por eso hay
   * un respaldo que simula el clic fuera, que es como AG Grid cierra sus popups.
   */
  private closePopup(): void {
    const api = this.params.api as unknown as { hidePopupMenu?: () => void };
    try {
      api.hidePopupMenu?.();
      return;
    } catch { /* sin el modulo del menu: usar el respaldo */ }

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  }

  trackByValue(_index: number, item: { value: string }): string {
    return item.value;
  }
}

/** Modelo serializable del filtro de valores (compatible con JSON) */
export interface ExcelColumnFilterModel {
  filterType: 'excelValues';
  values: string[];
}

/** Orden natural: "2" antes de "10", y el texto por locale español */
function compareNatural(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb) && a.trim() !== '' && b.trim() !== '') {
    return na - nb;
  }
  return a.localeCompare(b, 'es');
}