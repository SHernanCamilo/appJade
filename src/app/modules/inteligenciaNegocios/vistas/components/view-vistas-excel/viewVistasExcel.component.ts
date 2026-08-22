/**
 * BI Vistas — Vista Excel Fullscreen
 *
 * Reemplaza viewVistasFullscreen usando el shell ExcelSheetComponent.
 * Preserva toda la lógica de carga de Fabric (paginación, filtros, vistas pesadas)
 * y añade la cinta de Excel con acciones de datos, formato y exportación.
 */
import {
  Component, OnInit, OnDestroy, signal, computed, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import type { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { HttpErrorResponse } from '@angular/common/http';

import {
  FabricDataMeta, FabricColumn, VistasService, VistaBi,
} from '../../../services/vistas.service';
import { AG_GRID_LOCALE } from '../../../../../core/config/ag-grid.config';
import { GridLoaderComponent } from '../../../../../complements/shared/grid-loader/grid-loader.component';
import {
  getColumnType, humanizeColumnName,
} from '../../../helpers/column-type.helper';
import {
  handleFabricError, isFiltersRequiredError, isMaintenanceError,
  isVistaEnMantenimiento, FabricFiltersRequiredError,
} from '../../../helpers/fabric-error.helper';

import {
  ExcelSheetComponent,
  ExcelSheetConfig,
  FormulaCellInfo,
  RibbonActionEvent,
  RibbonTab,
  FormulaCommitEvent,
  RIBBON_BI_VISTAS,
} from '../../../../../complements/shared/excel-sheet';
import { ExcelColumnFilterComponent } from '../excel-column-filter/excel-column-filter.component';
import { ExcelDateFilterComponent } from '../excel-date-filter/excel-date-filter.component';

// ─── Ribbon adicional para BI Vistas ──────────────────────────────────────

const RIBBON_BI_EXTRA: RibbonTab[] = [
  ...RIBBON_BI_VISTAS,
  {
    id: 'datos',
    label: 'Datos',
    groups: [
      {
        title: 'Paginación',
        items: [
          { type: 'button', id: 'prev-page', label: 'Anterior', icon: 'pi pi-arrow-left', size: 'lg' },
          { type: 'button', id: 'next-page', label: 'Siguiente', icon: 'pi pi-arrow-right', size: 'lg' },
          {
            type: 'dropdown', id: 'page-size', tooltip: 'Filas por página', size: 'sm',
            value: '50',
            options: ['25', '50', '100', '250', '500', '1000'].map(v => ({ label: v + ' filas', value: v })),
          },
        ],
      },
      {
        title: 'Ordenar y filtrar',
        items: [
          { type: 'button', id: 'sort-asc', label: 'A → Z', icon: 'pi pi-sort-alpha-down', size: 'lg' },
          { type: 'button', id: 'sort-desc', label: 'Z → A', icon: 'pi pi-sort-alpha-up', size: 'lg' },
          { type: 'button', id: 'clear-filters', label: 'Limpiar\nfiltros', icon: 'pi pi-filter-slash', size: 'lg' },
        ],
      },
      {
        title: 'Exportar',
        items: [
          { type: 'button', id: 'export-csv', label: 'CSV', icon: 'pi pi-file-export', size: 'lg' },
          { type: 'button', id: 'export-excel', label: 'Excel', icon: 'pi pi-file-excel', size: 'lg' },
        ],
      },
    ],
  },
  {
    id: 'vista',
    label: 'Vista',
    groups: [
      {
        title: 'Columnas',
        items: [
          { type: 'button', id: 'autofit', label: 'Ajustar\ntodo', icon: 'pi pi-arrows-h', size: 'lg' },
          { type: 'button', id: 'zoom-fit', label: 'Ajustar\nancho', icon: 'pi pi-expand', size: 'lg' },
        ],
      },
      {
        title: 'Densidad de filas',
        items: [
          {
            type: 'dropdown', id: 'row-height', tooltip: 'Alto de fila', size: 'sm',
            value: 'normal',
            options: [
              { label: 'Compacto (21px)', value: 'compact' },
              { label: 'Normal (28px)', value: 'normal' },
              { label: 'Cómodo (36px)', value: 'comfortable' },
            ],
          },
        ],
      },
    ],
  },
];

@Component({
  selector: 'app-view-vistas-excel',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridAngular, GridLoaderComponent, ExcelSheetComponent],
  templateUrl: './viewVistasExcel.component.html',
  styleUrl: './viewVistasExcel.component.css',
})
export class ViewVistasExcelComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly vistasService = inject(VistasService);

  // ── State ──
  schema = '';
  viewName = '';
  vista: VistaBi | null = null;

  readonly isLoading = signal(false);
  readonly rowData = signal<Record<string, unknown>[]>([]);
  readonly columnDefs = signal<ColDef[]>([]);
  readonly meta = signal<FabricDataMeta>({ total: 0, limit: 50, offset: 0, has_next: false });

  readonly errorMessage = signal('');
  readonly isHeavyView = signal(false);
  readonly isMaintenanceMode = signal(false);
  readonly maintenanceMessage = signal('Esta vista está en mantenimiento.');
  readonly showFilterRequired = signal(false);
  readonly filterRequiredMessage = signal('');
  readonly filterColumns = signal<FabricColumn[]>([]);

  paginaActual = 1;
  pageSize = 50;
  sortCol = '';
  sortDir: 'asc' | 'desc' = 'asc';
  filters: Record<string, string> = {};
  suggestedFilterValues: Record<string, string> = {};

  readonly cellInfo = signal<FormulaCellInfo>({ reference: 'A1', value: '', editable: false });
  readonly zoom = signal(100);

  private gridApi?: GridApi;
  private filterDebounce: ReturnType<typeof setTimeout> | null = null;

  readonly localeText = AG_GRID_LOCALE;

  // ── Computed: total label ──
  readonly totalLabel = computed(() => {
    const m = this.meta();
    if (m.total === -1) return 'Muchos registros';
    return `${m.total.toLocaleString('es-CO')} registros`;
  });

  readonly totalPaginas = computed(() => {
    const m = this.meta();
    if (m.total === -1) return 0;
    return Math.ceil(m.total / this.pageSize) || 1;
  });

  readonly canGoNext = computed(() => {
    const m = this.meta();
    return m.total === -1 ? m.has_next : this.paginaActual < this.totalPaginas();
  });

  // ── ExcelSheetConfig ──
  readonly excelConfig = computed<ExcelSheetConfig>(() => ({
    title: {
      documentName: this.vista?.nombre || 'Vista',
      subtitle: `${this.schema} · ${this.totalLabel()}  ${this.paginaActual > 1 ? '· Pág. ' + this.paginaActual : ''}`,
      saveState: 'saved',
      secondaryActions: [{ label: 'Cerrar', icon: 'pi pi-times', action: 'close' }],
    },
    ribbonTabs: RIBBON_BI_EXTRA,
    sheets: [{ id: 'datos', label: this.vista?.nombre || 'Datos', active: true }],
    statusBar: {
      readyText: this.isLoading() ? 'Cargando…' : 'Listo',
      items: [
        { key: 'total', label: 'registros', value: this.meta().total === -1 ? '∞' : this.meta().total.toLocaleString('es-CO') },
        { key: 'page', label: `/ pág. ${this.paginaActual}`, value: this.rowData().length },
      ],
      hint: 'Filtros activos · Tab navega · Enter selecciona',
      showZoom: true,
    },
  }));

  // ── Default col def for BI data ──
  readonly defaultColDef: ColDef = {
    sortable: true,
    filter: ExcelColumnFilterComponent,
    filterParams: { maxDisplayedValues: 50 },
    resizable: true,
    minWidth: 90,
    floatingFilter: false, // sin floating filter, solo el menú con checkboxes
    cellClass: 'bi-cell',
  };

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.schema = this.route.snapshot.paramMap.get('schema') ?? '';
    this.viewName = this.route.snapshot.paramMap.get('viewName') ?? '';
    if (!this.schema || !this.viewName) { window.close(); return; }
    this.loadVista();
  }

  ngOnDestroy(): void {
    if (this.filterDebounce) clearTimeout(this.filterDebounce);
  }

  // ─── Data loading ─────────────────────────────────────────────────────────

  private loadVista(): void {
    this.isLoading.set(true);
    this.vistasService.getVista(this.schema, this.viewName).subscribe({
      next: (res) => {
        this.vista = res.data;
        if (!this.vista) { window.close(); return; }
        if (isVistaEnMantenimiento(this.vista)) {
          this.isMaintenanceMode.set(true);
          this.maintenanceMessage.set(`La vista '${this.vista.nombre}' está en mantenimiento.`);
          this.isLoading.set(false);
          return;
        }
        this.cargarDatos();
      },
      error: () => window.close(),
    });
  }

  /**
   * Post-procesa columnDefs del servicio para asignar filtros específicos por tipo
   */
  private assignDateFiltersToColumns(columnDefs: ColDef[]): ColDef[] {
    return columnDefs.map(colDef => {
      // Detectar si es columna de fecha por el valueFormatter
      // El servicio asigna un valueFormatter específico para fechas que contiene lógica de formato
      const isDateCol = colDef.valueFormatter && 
                       String(colDef.valueFormatter).includes('T]') ||
                       String(colDef.valueFormatter).includes('datePart');
      
      return {
        ...colDef,
        filter: isDateCol ? ExcelDateFilterComponent : ExcelColumnFilterComponent,
        filterParams: { maxDisplayedValues: 50 },
      };
    });
  }

  private cargarDatos(): void {
    if (!this.vista) return;
    this.isLoading.set(true);
    this.errorMessage.set('');
    const offset = (this.paginaActual - 1) * this.pageSize;
    const skipCount = this.pageSize > 1000 || this.meta().total === -1 || this.isHeavyView();

    this.vistasService.getVistaDatos(this.schema, this.viewName, {
      limit: this.pageSize, offset,
      sort_col: this.sortCol, sort_dir: this.sortDir,
      filters: this.filters, skip_count: skipCount,
    }).subscribe({
      next: (res) => {
        // Aplicar filtros específicos por tipo de columna
        this.columnDefs.set(this.assignDateFiltersToColumns(res.columnDefs));
        this.rowData.set(res.rowData);
        this.meta.set(res.meta);
        this.isHeavyView.set(!!res.meta.heavy_view);
        this.showFilterRequired.set(false);
        this.isLoading.set(false);
        this.refreshGrid();
      },
      error: (err) => {
        this.rowData.set([]);
        this.isLoading.set(false);

        if (isFiltersRequiredError(err)) {
          this.showFilterRequired.set(true);
          this.isHeavyView.set(true);
          this.filterRequiredMessage.set(err.error.message);
          this.filterColumns.set((err.error.columns ?? []).map((c: NonNullable<FabricFiltersRequiredError['columns']>[number]) => ({
            name: c.name, type: c.type, nullable: c.nullable ?? true,
          })));
          return;
        }
        if (isMaintenanceError(err)) {
          this.isMaintenanceMode.set(true);
          this.maintenanceMessage.set(err.error.message ?? this.maintenanceMessage());
          return;
        }
        this.errorMessage.set(err instanceof HttpErrorResponse ? handleFabricError(err) : 'No se pudieron cargar los datos.');
      },
    });
  }

  private refreshGrid(): void {
    if (!this.gridApi) return;
    this.gridApi.setGridOption('columnDefs', this.columnDefs());
    this.gridApi.setGridOption('rowData', this.rowData());
    this.gridApi.sizeColumnsToFit();
  }

  // ─── Grid events ──────────────────────────────────────────────────────────

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
    this.refreshGrid();
    // Auto-ajustar columnas al contenido después de renderizar
    setTimeout(() => this.autoSizeColumns(), 100);
  }

  /** Auto-ajusta columnas al contenido con límites razonables */
  private autoSizeColumns(): void {
    if (!this.gridApi) return;
    
    // Ajustar todas las columnas al contenido
    this.gridApi.autoSizeAllColumns(false);
    
    // Aplicar límites min/max para evitar columnas muy anchas o estrechas
    const allColumns = this.gridApi.getColumns();
    if (!allColumns) return;

    allColumns.forEach(col => {
      const currentWidth = col.getActualWidth();
      let newWidth = currentWidth;
      
      // Mínimo 100px, máximo 400px
      if (currentWidth < 100) newWidth = 100;
      if (currentWidth > 400) newWidth = 400;
      
      if (newWidth !== currentWidth) {
        this.gridApi!.setColumnWidths([{ key: col.getColId(), newWidth }]);
      }
    });
  }

  onSortChanged(): void {
    const state = this.gridApi?.getColumnState()?.find(c => c.sort);
    this.sortCol = state?.colId ?? '';
    this.sortDir = (state?.sort as 'asc' | 'desc') ?? 'asc';
    this.paginaActual = 1;
    this.cargarDatos();
  }

  onFilterChanged(): void {
    if (this.filterDebounce) clearTimeout(this.filterDebounce);
    this.filterDebounce = setTimeout(() => {
      if (!this.gridApi) return;
      const model = this.gridApi.getFilterModel() as Record<string, any>;
      const result: Record<string, string> = {};
      for (const [col, m] of Object.entries(model)) {
        if (m.filter !== undefined && m.filter !== null && m.filter !== '') {
          const val = m.filter instanceof Date ? m.filter.toISOString().split('T')[0] : String(m.filter);
          result[col] = m.type === 'contains' ? `%${val}%` : m.type === 'startsWith' ? `${val}%` : m.type === 'endsWith' ? `%${val}` : val;
        }
      }
      this.filters = result;
      this.paginaActual = 1;
      this.cargarDatos();
    }, 600);
  }

  // ─── Shell events ─────────────────────────────────────────────────────────

  onSecondaryAction(action: string): void {
    if (action === 'close') { window.opener ? window.close() : history.back(); }
  }

  onRibbonAction(event: RibbonActionEvent): void {
    switch (event.actionId) {
      case 'prev-page': if (this.paginaActual > 1) { this.paginaActual--; this.cargarDatos(); } break;
      case 'next-page': if (this.canGoNext()) { this.paginaActual++; this.cargarDatos(); } break;
      case 'page-size':
        if (event.value) { this.pageSize = Number(event.value); this.paginaActual = 1; this.cargarDatos(); }
        break;
      case 'sort-asc':
        this.gridApi?.applyColumnState({ state: [{ colId: this.gridApi.getFocusedCell()?.column.getColId() ?? '', sort: 'asc' }] });
        break;
      case 'sort-desc':
        this.gridApi?.applyColumnState({ state: [{ colId: this.gridApi.getFocusedCell()?.column.getColId() ?? '', sort: 'desc' }] });
        break;
      case 'clear-filters':
        this.gridApi?.setFilterModel(null);
        this.filters = {};
        this.paginaActual = 1;
        this.cargarDatos();
        break;
      case 'autofit': 
        this.autoSizeColumns();
        break;
      case 'zoom-fit': 
        this.gridApi?.sizeColumnsToFit();
        break;
      case 'export-csv': this.gridApi?.exportDataAsCsv({ fileName: `${this.viewName}.csv` }); break;
      case 'export-excel': this.gridApi?.exportDataAsExcel?.({ fileName: `${this.viewName}.xlsx` }); break;
      case 'row-height':
        const heights: Record<string, number> = { compact: 21, normal: 28, comfortable: 36 };
        const h = heights[event.value ?? 'normal'] ?? 28;
        this.gridApi?.setGridOption('rowHeight', h);
        this.gridApi?.resetRowHeights();
        break;
      case 'font-family':
        if (event.value) {
          const el = document.querySelector('.bi-grid') as HTMLElement | null;
          el?.style.setProperty('--ag-font-family', `'${event.value}', Calibri, sans-serif`);
        }
        break;
      case 'font-size':
        if (event.value) {
          const el = document.querySelector('.bi-grid') as HTMLElement | null;
          el?.style.setProperty('--ag-font-size', `${event.value}px`);
          this.gridApi?.refreshCells({ force: true });
        }
        break;
    }
  }

  onFormulaCommit(_: FormulaCommitEvent): void { /* BI vistas are read-only */ }

  onZoomChange(pct: number): void {
    this.zoom.set(pct);
    const scaledSize = (11 * pct) / 100;
    const el = document.querySelector('.bi-grid') as HTMLElement | null;
    el?.style.setProperty('--ag-font-size', `${scaledSize}px`);
    this.gridApi?.setGridOption('rowHeight', Math.round(21 * pct / 100));
    this.gridApi?.resetRowHeights();
  }

  // ─── Filter-required panel ────────────────────────────────────────────────

  onSuggestedFilter(col: string, value: string): void {
    if (!value) delete this.suggestedFilterValues[col];
    else this.suggestedFilterValues[col] = value;
  }

  aplicarFiltrosRequeridos(): void {
    const activos = Object.entries(this.suggestedFilterValues).filter(([, v]) => v);
    if (!activos.length) { this.errorMessage.set('Ingrese al menos un filtro.'); return; }
    this.filters = Object.fromEntries(activos.map(([col, val]) => {
      const tipo = getColumnType(this.filterColumns().find(c => c.name === col)?.type ?? 'varchar');
      return [col, tipo === 'text' && !val.includes('%') ? `%${val}%` : val];
    }));
    this.paginaActual = 1;
    this.showFilterRequired.set(false);
    this.cargarDatos();
  }

  // Expose helpers to template
  readonly humanizeColumnName = humanizeColumnName;
  readonly getColumnType = getColumnType;
}
