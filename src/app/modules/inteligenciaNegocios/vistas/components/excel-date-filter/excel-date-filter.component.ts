import { Component, signal, computed, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IDoesFilterPassParams, IFilterComp, IFilterParams, ValueGetterParams } from 'ag-grid-community';

/**
 * Filtro de fechas tipo Excel para AG Grid: agrupación jerárquica año → mes → día
 * con checkboxes expandibles, búsqueda, y aplicación al hacer clic en "Aceptar".
 *
 * Uso en columnDef:
 * ```typescript
 * {
 *   field: 'fecha',
 *   filter: ExcelDateFilterComponent,
 *   filterParams: { maxDisplayedValues: 50 }
 * }
 * ```
 */

interface DateHierarchyNode {
  value: string;           // '2024' | '2024-07' | '2024-07-15'
  label: string;           // 'Año 2024' | 'Julio 2024' | '15 Julio 2024'
  level: 'year' | 'month' | 'day';
  selected: boolean;
  expanded: boolean;
  children?: DateHierarchyNode[];
  parentKey?: string;
}

const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

@Component({
  selector: 'app-excel-date-filter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div #filterContainer class="excel-date-filter">
      <!-- Tabs: Jerarquía vs Rango -->
      <div class="excel-filter__tabs">
        <button 
          class="excel-filter__tab"
          [class.excel-filter__tab--active]="filterMode() === 'hierarchy'"
          (click)="filterMode.set('hierarchy')">
          Jerarquía
        </button>
        <button 
          class="excel-filter__tab"
          [class.excel-filter__tab--active]="filterMode() === 'range'"
          (click)="filterMode.set('range')">
          Rango
        </button>
      </div>

      <!-- Modo Jerarquía -->
      <div *ngIf="filterMode() === 'hierarchy'" class="excel-filter__content">
        <!-- Búsqueda -->
        <div class="excel-filter__search">
          <input
            type="text"
            class="excel-filter__search-input"
            placeholder="Buscar fecha..."
            [(ngModel)]="searchTerm"
            (ngModelChange)="onSearchChange($event)" />
          <button
            *ngIf="searchTerm()"
            class="excel-filter__search-clear"
            (click)="clearSearch()">
            ×
          </button>
        </div>

      <!-- Lista jerárquica de fechas -->
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

        <!-- Años con jerarquía expandible -->
        <ng-container *ngFor="let year of displayedHierarchy(); trackBy: trackByValue">
          <label class="excel-filter__item excel-filter__item--year">
            <i class="excel-filter__expand-icon pi" 
               [class.pi-chevron-right]="!year.expanded"
               [class.pi-chevron-down]="year.expanded"
               (click)="toggleExpand(year); $event.stopPropagation()"></i>
            <input
              type="checkbox"
              [checked]="year.selected"
              [indeterminate]="isIndeterminate(year)"
              (change)="toggleNode(year, $event)" />
            <span [title]="year.label">{{ year.label }}</span>
          </label>

          <!-- Meses (segundo nivel) -->
          <ng-container *ngIf="year.expanded && year.children">
            <ng-container *ngFor="let month of year.children; trackBy: trackByValue">
              <label class="excel-filter__item excel-filter__item--month">
                <i class="excel-filter__expand-icon pi" 
                   [class.pi-chevron-right]="!month.expanded"
                   [class.pi-chevron-down]="month.expanded"
                   (click)="toggleExpand(month); $event.stopPropagation()"></i>
                <input
                  type="checkbox"
                  [checked]="month.selected"
                  [indeterminate]="isIndeterminate(month)"
                  (change)="toggleNode(month, $event)" />
                <span [title]="month.label">{{ month.label }}</span>
              </label>

              <!-- Días (tercer nivel) -->
              <ng-container *ngIf="month.expanded && month.children">
                <label *ngFor="let day of month.children; trackBy: trackByValue"
                       class="excel-filter__item excel-filter__item--day">
                  <span class="excel-filter__spacer"></span>
                  <input
                    type="checkbox"
                    [checked]="day.selected"
                    (change)="toggleNode(day, $event)" />
                  <span [title]="day.label">{{ day.label }}</span>
                </label>
              </ng-container>
            </ng-container>
          </ng-container>
        </ng-container>

        <!-- Mensaje si no hay resultados -->
        <div *ngIf="displayedHierarchy().length === 0" class="excel-filter__empty">
          No se encontraron fechas
        </div>
      </div>
      </div>

      <!-- Modo Rango -->
      <div *ngIf="filterMode() === 'range'" class="excel-filter__content excel-filter__range">
        <div class="excel-filter__range-inputs">
          <label class="excel-filter__range-label">
            <span>Desde:</span>
            <input 
              type="date" 
              class="excel-filter__date-input"
              [(ngModel)]="rangeFrom"
              [max]="rangeTo() || undefined"
              (ngModelChange)="onRangeChange()" />
          </label>

          <label class="excel-filter__range-label">
            <span>Hasta:</span>
            <input 
              type="date" 
              class="excel-filter__date-input"
              [(ngModel)]="rangeTo"
              [min]="rangeFrom() || undefined"
              (ngModelChange)="onRangeChange()" />
          </label>
        </div>

        <!-- Atajos de rango -->
        <div class="excel-filter__range-shortcuts">
          <button 
            class="excel-filter__shortcut-btn"
            (click)="applyRangeShortcut('today')">
            Hoy
          </button>
          <button 
            class="excel-filter__shortcut-btn"
            (click)="applyRangeShortcut('yesterday')">
            Ayer
          </button>
          <button 
            class="excel-filter__shortcut-btn"
            (click)="applyRangeShortcut('thisWeek')">
            Esta semana
          </button>
          <button 
            class="excel-filter__shortcut-btn"
            (click)="applyRangeShortcut('lastWeek')">
            Semana pasada
          </button>
          <button 
            class="excel-filter__shortcut-btn"
            (click)="applyRangeShortcut('thisMonth')">
            Este mes
          </button>
          <button 
            class="excel-filter__shortcut-btn"
            (click)="applyRangeShortcut('lastMonth')">
            Mes pasado
          </button>
          <button 
            class="excel-filter__shortcut-btn"
            (click)="applyRangeShortcut('thisYear')">
            Este año
          </button>
          <button 
            class="excel-filter__shortcut-btn"
            (click)="applyRangeShortcut('lastYear')">
            Año pasado
          </button>
        </div>

        <div *ngIf="rangeFrom() && rangeTo()" class="excel-filter__range-summary">
          Filtrando: {{ formatDateES(rangeFrom()) }} - {{ formatDateES(rangeTo()) }}
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
    .excel-date-filter {
      width: 260px;
      max-height: 400px;
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
      min-height: 150px;
      max-height: 280px;
    }

    .excel-filter__item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 3px 8px;
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
      padding-left: 12px;
    }

    .excel-filter__item--year {
      font-weight: 600;
      padding-left: 4px;
    }

    .excel-filter__item--month {
      padding-left: 20px;
      font-weight: 500;
    }

    .excel-filter__item--day {
      padding-left: 36px;
    }

    .excel-filter__expand-icon {
      width: 14px;
      height: 14px;
      font-size: 10px;
      flex-shrink: 0;
      color: #6b7280;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .excel-filter__expand-icon:hover {
      color: #217346;
    }

    .excel-filter__spacer {
      width: 14px;
      flex-shrink: 0;
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

    /* Tabs */
    .excel-filter__tabs {
      display: flex;
      border-bottom: 1px solid #e5e7eb;
      background: #f9fafb;
    }

    .excel-filter__tab {
      flex: 1;
      padding: 8px 12px;
      border: none;
      background: transparent;
      color: #6b7280;
      font-size: 12px;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.15s;
      border-bottom: 2px solid transparent;
    }

    .excel-filter__tab:hover {
      background: #f3f4f6;
      color: #374151;
    }

    .excel-filter__tab--active {
      color: #217346;
      border-bottom-color: #217346;
      font-weight: 500;
    }

    .excel-filter__content {
      display: flex;
      flex-direction: column;
    }

    /* Rango */
    .excel-filter__range {
      padding: 12px;
      gap: 12px;
    }

    .excel-filter__range-inputs {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .excel-filter__range-label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
      color: #374151;
    }

    .excel-filter__date-input {
      padding: 6px 8px;
      border: 1px solid #d1d5db;
      border-radius: 3px;
      font-size: 12px;
      font-family: inherit;
    }

    .excel-filter__date-input:focus {
      outline: none;
      border-color: #217346;
    }

    .excel-filter__range-shortcuts {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 6px;
      margin-top: 8px;
    }

    .excel-filter__shortcut-btn {
      padding: 6px 8px;
      border: 1px solid #d1d5db;
      border-radius: 3px;
      background: #fff;
      color: #374151;
      font-size: 11px;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.15s;
      text-align: center;
    }

    .excel-filter__shortcut-btn:hover {
      background: #f3f4f6;
      border-color: #217346;
      color: #217346;
    }

    .excel-filter__range-summary {
      margin-top: 8px;
      padding: 8px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 3px;
      font-size: 11px;
      color: #166534;
      text-align: center;
    }
  `],
})
export class ExcelDateFilterComponent implements IFilterComp, AfterViewInit {
  @ViewChild('filterContainer', { static: true }) filterContainer!: ElementRef<HTMLDivElement>;

  private params!: IFilterParams;
  private valueGetter!: ((params: ValueGetterParams) => unknown) | undefined;

  // Estado interno
  private allDateStrings: Set<string> = new Set(); // '2024-07-15'
  private pendingSelected: Set<string> = new Set(); // fechas seleccionadas temporales
  private appliedSelected: Set<string> = new Set(); // fechas confirmadas con "Aceptar"

  readonly searchTerm = signal('');

  // Modo de filtro: jerarquía o rango
  readonly filterMode = signal<'hierarchy' | 'range'>('hierarchy');

  // Propiedades para modo rango
  readonly rangeFrom = signal<string>('');
  readonly rangeTo = signal<string>('');

  // Jerarquía de fechas año → mes → día
  private readonly dateHierarchy = signal<DateHierarchyNode[]>([]);

  // Jerarquía filtrada por búsqueda
  readonly displayedHierarchy = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const hierarchy = this.dateHierarchy();

    if (!term) return hierarchy;

    // Filtrar jerarquía recursivamente
    return hierarchy
      .map(year => this.filterNodeByTerm(year, term))
      .filter(node => node !== null) as DateHierarchyNode[];
  });

  readonly allSelected = computed(() => {
    return this.pendingSelected.size === this.allDateStrings.size && this.allDateStrings.size > 0;
  });

  readonly someSelected = computed(() => {
    const selected = this.pendingSelected.size;
    return selected > 0 && selected < this.allDateStrings.size;
  });

  ngAfterViewInit(): void {
    // ViewChild ya está inicializado
  }

  getGui(): HTMLElement {
    return this.filterContainer.nativeElement;
  }

  agInit(params: IFilterParams): void {
    this.params = params;
    this.valueGetter = params.valueGetter;

    // Extraer fechas únicas de toda la data
    this.extractUniqueDates();
  }

  private extractUniqueDates(): void {
    this.allDateStrings.clear();

    // Obtener TODA la data sin importar filtros
    const allRowData: any[] = [];
    this.params.api.forEachNode(node => {
      if (node.data) allRowData.push(node.data);
    });

    // Iterar sobre toda la data
    const field = this.params.colDef.field;
    if (!field) return;

    let validDateCount = 0;
    
    for (const data of allRowData) {
      // Leer valor directamente del campo
      const value: unknown = data[field];
      
      if (value == null) continue;
      
      // Si es un Date object, convertir a string DD/MM/YYYY
      let valueString: string;
      if (value instanceof Date) {
        const day = value.getDate().toString().padStart(2, '0');
        const month = (value.getMonth() + 1).toString().padStart(2, '0');
        const year = value.getFullYear();
        valueString = `${day}/${month}/${year} 00:00`;
      } else {
        valueString = String(value);
      }
      
      const dateStr = this.normalizeDateString(valueString);
      if (dateStr) {
        this.allDateStrings.add(dateStr);
        validDateCount++;
      }
    }

    // Construir jerarquía año → mes → día
    this.buildHierarchy();
  }

  /** Normaliza fecha a formato YYYY-MM-DD */
  private normalizeDateString(value: string): string | null {
    if (!value || typeof value !== 'string') {
      return null;
    }

    // Trim espacios en blanco
    value = value.trim();

    // Intenta varios formatos comunes:
    
    // 1. Formato ISO: '2024-07-15', '2024-07-15T10:30:00', '2024-07-15 10:30:00'
    let match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
    
    // 2. Formato DD/MM/YYYY con o sin hora: '15/07/2024', '15/07/2024 10:30:00', '15/07/2024 00:00'
    match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
      const day = match[1].padStart(2, '0');
      const month = match[2].padStart(2, '0');
      const year = match[3];
      
      // Validar que día y mes sean válidos
      const dayNum = parseInt(day, 10);
      const monthNum = parseInt(month, 10);
      
      if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12) {
        return null;
      }
      
      return `${year}-${month}-${day}`;
    }
    
    // 3. Formato YYYY/MM/DD: '2024/07/15', '2024/07/15 10:30'
    match = value.match(/^(\d{4})\/(\d{2})\/(\d{2})/);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
    
    return null;
  }

  private buildHierarchy(): void {
    const sortedDates = Array.from(this.allDateStrings).sort();
    
    // Por defecto: todas seleccionadas
    this.pendingSelected = new Set(sortedDates);
    this.appliedSelected = new Set(sortedDates);

    // Agrupar por año → mes → día
    const yearMap = new Map<string, Map<string, string[]>>();

    for (const dateStr of sortedDates) {
      const [year, month] = dateStr.split('-');
      
      if (!yearMap.has(year)) yearMap.set(year, new Map());
      const monthMap = yearMap.get(year)!;
      
      if (!monthMap.has(month)) monthMap.set(month, []);
      monthMap.get(month)!.push(dateStr);
    }

    // Construir nodos jerárquicos
    const hierarchy: DateHierarchyNode[] = [];

    for (const [year, monthMap] of Array.from(yearMap.entries()).sort()) {
      const yearNode: DateHierarchyNode = {
        value: year,
        label: `Año ${year}`,
        level: 'year',
        selected: true,
        expanded: false,
        children: [],
      };

      for (const [month, days] of Array.from(monthMap.entries()).sort()) {
        const monthNum = parseInt(month, 10);
        const monthNode: DateHierarchyNode = {
          value: `${year}-${month}`,
          label: `${MONTHS_ES[monthNum - 1]} ${year}`,
          level: 'month',
          selected: true,
          expanded: false,
          parentKey: year,
          children: [],
        };

        for (const dateStr of days.sort()) {
          const [, , day] = dateStr.split('-');
          monthNode.children!.push({
            value: dateStr,
            label: `${parseInt(day, 10)} ${MONTHS_ES[monthNum - 1]} ${year}`,
            level: 'day',
            selected: true,
            expanded: false,
            parentKey: `${year}-${month}`,
          });
        }

        yearNode.children!.push(monthNode);
      }

      hierarchy.push(yearNode);
    }

    this.dateHierarchy.set(hierarchy);
  }

  private filterNodeByTerm(node: DateHierarchyNode, term: string): DateHierarchyNode | null {
    // Si el nodo coincide, devolver todo su subárbol
    if (node.label.toLowerCase().includes(term)) {
      return { ...node, expanded: true };
    }

    // Si tiene hijos, filtrarlos recursivamente
    if (node.children && node.children.length > 0) {
      const filteredChildren = node.children
        .map(child => this.filterNodeByTerm(child, term))
        .filter(child => child !== null) as DateHierarchyNode[];

      if (filteredChildren.length > 0) {
        return { ...node, children: filteredChildren, expanded: true };
      }
    }

    return null;
  }

  isFilterActive(): boolean {
    // Range mode: active if from or to are set
    if (this.filterMode() === 'range' && (this.rangeFrom() || this.rangeTo())) {
      return true;
    }
    // Hierarchy mode: active if not all selected
    return this.appliedSelected.size < this.allDateStrings.size && this.allDateStrings.size > 0;
  }

  doesFilterPass(params: IDoesFilterPassParams): boolean {
    // En modo rango con paginacion server-side, el filtrado lo hace el backend.
    // Si allDateStrings tiene pocas fechas (<=pageSize), es paginado → no filtrar local.
    // Si tiene muchas (>pageSize), es client-side → filtrar local.
    if (this.filterMode() === 'range') {
      // En server-side solo hay 50 filas: dejar pasar todo, el backend filtra
      if (this.allDateStrings.size <= 100) return true;
      // En client-side (Excel viewer con todos los datos): filtrar por rango
      const from = this.rangeFrom();
      const to = this.rangeTo();
      if (!from && !to) return true;
      let value: unknown;
      if (this.valueGetter) {
        value = this.valueGetter({ node: params.node, data: params.data, column: this.params.column, colDef: this.params.colDef } as ValueGetterParams);
      } else {
        const field = this.params.colDef.field;
        value = field ? params.data?.[field] : null;
      }
      const dateStr = value != null ? this.normalizeDateString(String(value)) : null;
      if (!dateStr) return false;
      if (from && dateStr < from) return false;
      if (to && dateStr > to) return false;
      return true;
    }

    // Hierarchy mode: check if date is in the selected set
    let value: unknown;
    if (this.valueGetter) {
      value = this.valueGetter({ node: params.node, data: params.data, column: this.params.column, colDef: this.params.colDef } as ValueGetterParams);
    } else {
      const field = this.params.colDef.field;
      value = field ? params.data?.[field] : null;
    }
    const dateStr = value != null ? this.normalizeDateString(String(value)) : null;

    // Server-side (few dates): don't filter locally
    if (this.allDateStrings.size <= 100 && this.appliedSelected.size === 0) return true;

    return dateStr ? this.appliedSelected.has(dateStr) : false;
  }

  getModel(): any {
    if (this.filterMode() === 'range' && (this.rangeFrom() || this.rangeTo())) {
      // Return range info for the grid component to read
      return {
        filterType: 'dateRange',
        dateFrom: this.rangeFrom() || null,
        dateTo: this.rangeTo() || null,
      };
    }
    if (this.appliedSelected.size < this.allDateStrings.size && this.allDateStrings.size > 0) {
      return this.appliedSelected;
    }
    return null;
  }

  setModel(model: Set<string> | null): void {
    if (model === null) {
      // Reset: seleccionar todo
      this.pendingSelected = new Set(this.allDateStrings);
      this.appliedSelected = new Set(this.allDateStrings);
      this.updateHierarchySelection(true);
    } else {
      this.appliedSelected = new Set(model);
      this.pendingSelected = new Set(model);
      this.updateHierarchySelection(false);
    }
  }

  private updateHierarchySelection(selectAll: boolean): void {
    const updateNode = (node: DateHierarchyNode): void => {
      if (node.level === 'day') {
        node.selected = selectAll || this.pendingSelected.has(node.value);
      } else {
        node.children?.forEach(updateNode);
        node.selected = node.children?.every(c => c.selected) ?? false;
      }
    };

    this.dateHierarchy.update(hierarchy => {
      hierarchy.forEach(updateNode);
      return [...hierarchy];
    });
  }

  // ── UI Events ────────────────────────────────────────────────────────────

  onSearchChange(_term: string): void {
    // computed displayedHierarchy se actualiza automáticamente
  }

  clearSearch(): void {
    this.searchTerm.set('');
  }

  toggleSelectAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.pendingSelected.clear();

    if (checked) {
      this.allDateStrings.forEach(d => this.pendingSelected.add(d));
    }

    this.updateHierarchySelection(checked);
  }

  toggleExpand(node: DateHierarchyNode): void {
    node.expanded = !node.expanded;
    this.dateHierarchy.update(h => [...h]); // Trigger change detection
  }

  toggleNode(node: DateHierarchyNode, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    
    if (node.level === 'day') {
      // Día: solo afecta a sí mismo
      if (checked) {
        this.pendingSelected.add(node.value);
      } else {
        this.pendingSelected.delete(node.value);
      }
      node.selected = checked;
    } else {
      // Año o mes: afecta a todos sus hijos recursivamente
      this.toggleNodeRecursive(node, checked);
    }

    // Actualizar padres para reflejar estado "indeterminate"
    this.updateParentSelection();
    this.dateHierarchy.update(h => [...h]);
  }

  private toggleNodeRecursive(node: DateHierarchyNode, checked: boolean): void {
    node.selected = checked;
    
    if (node.level === 'day') {
      if (checked) {
        this.pendingSelected.add(node.value);
      } else {
        this.pendingSelected.delete(node.value);
      }
    }

    node.children?.forEach(child => this.toggleNodeRecursive(child, checked));
  }

  private updateParentSelection(): void {
    const hierarchy = this.dateHierarchy();

    const updateNode = (node: DateHierarchyNode): void => {
      if (node.children && node.children.length > 0) {
        node.children.forEach(updateNode);
        const allSelected = node.children.every(c => c.selected);
        const someSelected = node.children.some(c => c.selected || this.isIndeterminate(c));
        node.selected = allSelected || (someSelected && !allSelected);
      }
    };

    hierarchy.forEach(updateNode);
  }

  isIndeterminate(node: DateHierarchyNode): boolean {
    if (!node.children || node.children.length === 0) return false;
    const selectedCount = node.children.filter(c => c.selected).length;
    return selectedCount > 0 && selectedCount < node.children.length;
  }

  applyFilter(): void {
    if (this.filterMode() === 'range') {
      // Modo rango: aplicar filtro de rango
      if (this.rangeFrom() && this.rangeTo()) {
        this.applyRangeFilter();
      }
    } else {
      // Modo jerarquía: confirmar selección temporal
      this.appliedSelected = new Set(this.pendingSelected);
    }

    // Notificar AG Grid que el filtro cambió
    this.params.filterChangedCallback();
  }

  cancel(): void {
    // Cerrar sin aplicar cambios — restaurar estado previo
    this.pendingSelected = new Set(this.appliedSelected);
    this.updateHierarchySelection(false);
    this.params.filterChangedCallback();
  }

  // =========================================================================
  // MODO RANGO
  // =========================================================================

  onRangeChange(): void {
    // Rango cambiado, sin logs
  }

  applyRangeShortcut(shortcut: string): void {
    const today = new Date();
    const getDateString = (date: Date) => date.toISOString().split('T')[0];

    switch (shortcut) {
      case 'today':
        this.rangeFrom.set(getDateString(today));
        this.rangeTo.set(getDateString(today));
        break;

      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        this.rangeFrom.set(getDateString(yesterday));
        this.rangeTo.set(getDateString(yesterday));
        break;

      case 'thisWeek':
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        this.rangeFrom.set(getDateString(startOfWeek));
        this.rangeTo.set(getDateString(today));
        break;

      case 'lastWeek':
        const lastWeekStart = new Date(today);
        lastWeekStart.setDate(today.getDate() - today.getDay() - 7);
        const lastWeekEnd = new Date(lastWeekStart);
        lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
        this.rangeFrom.set(getDateString(lastWeekStart));
        this.rangeTo.set(getDateString(lastWeekEnd));
        break;

      case 'thisMonth':
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        this.rangeFrom.set(getDateString(startOfMonth));
        this.rangeTo.set(getDateString(today));
        break;

      case 'lastMonth':
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        this.rangeFrom.set(getDateString(lastMonthStart));
        this.rangeTo.set(getDateString(lastMonthEnd));
        break;

      case 'thisYear':
        const startOfYear = new Date(today.getFullYear(), 0, 1);
        this.rangeFrom.set(getDateString(startOfYear));
        this.rangeTo.set(getDateString(today));
        break;

      case 'lastYear':
        const lastYearStart = new Date(today.getFullYear() - 1, 0, 1);
        const lastYearEnd = new Date(today.getFullYear() - 1, 11, 31);
        this.rangeFrom.set(getDateString(lastYearStart));
        this.rangeTo.set(getDateString(lastYearEnd));
        break;
    }
  }

  private applyRangeFilter(): void {
    const from = this.rangeFrom();
    const to = this.rangeTo();

    if (!from || !to) return;

    // Seleccionar todas las fechas dentro del rango
    const selected = new Set<string>();

    for (const dateStr of this.allDateStrings) {
      if (dateStr >= from && dateStr <= to) {
        selected.add(dateStr);
      }
    }

    this.appliedSelected = selected;
    this.pendingSelected = new Set(selected);
  }

  formatDateES(dateStr: string): string {
    if (!dateStr) return '';

    const [year, month, day] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }

  trackByValue(_index: number, item: DateHierarchyNode): string {
    return item.value;
  }
}
