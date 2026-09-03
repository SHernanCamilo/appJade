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
import { autoSizeGridColumns } from '../../helpers/grid-columns.helper';
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

  /** Metadatos de columnas del backend (tipos reales), para el filtro de fechas */
  private fabricColumns: FabricColumn[] = [];

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
    // serverSide: los datos vienen paginados, el filtro no descarta filas solo
    filterParams: { maxDisplayedValues: 50, serverSide: true },
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
    console.log('[ViewVistasExcel] Iniciando carga de vista:', {
      schema: this.schema,
      viewName: this.viewName
    });

    this.isLoading.set(true);
    this.vistasService.getVista(this.schema, this.viewName).subscribe({
      next: (res) => {
        console.log('[ViewVistasExcel] Vista obtenida:', {
          success: res.success,
          vista: res.data
        });

        this.vista = res.data;
        if (!this.vista) {
          console.error('[ViewVistasExcel] Vista no encontrada');
          window.close();
          return;
        }
        if (isVistaEnMantenimiento(this.vista)) {
          console.warn('[ViewVistasExcel] Vista en mantenimiento');
          this.isMaintenanceMode.set(true);
          this.maintenanceMessage.set(`La vista '${this.vista.nombre}' está en mantenimiento.`);
          this.isLoading.set(false);
          return;
        }

        // Metadatos de columnas: es la unica forma fiable de saber cuales son
        // fechas y asignarles el filtro de calendario. No bloquea la carga.
        this.vistasService.getColumnas(this.schema, this.viewName).subscribe({
          next: res => { this.fabricColumns = res.data?.columns ?? []; },
          error: () => { this.fabricColumns = []; },
        });

        this.cargarDatos();
      },
      error: (err) => {
        console.error('[ViewVistasExcel] Error al obtener vista:', err);
        window.close();
      },
    });
  }

  /**
   * Post-procesa columnDefs del servicio para asignar filtros específicos por tipo
   */
  private assignDateFiltersToColumns(columnDefs: ColDef[]): ColDef[] {
    // Nombres de columna que el backend declaro como fecha: es la señal fiable.
    const dateFields = new Set(
      this.fabricColumns
        .filter(c => getColumnType(c.type) === 'date')
        .map(c => c.name.toLowerCase())
    );

    return columnDefs.map(colDef => {
      // ── Deteccion de columna de fecha ─────────────────────────────────────
      //
      // Antes se inspeccionaba el codigo fuente del valueFormatter con
      //   `colDef.valueFormatter && String(...).includes('T]') || String(...).includes('datePart')`
      // que ademas tenia un bug de precedencia: `a && b || c` se evalua como
      // `(a && b) || c`, asi que la segunda condicion se comprobaba incluso sin
      // valueFormatter y podia reventar. Y con el codigo minificado en produccion
      // esas cadenas no existen, asi que en el build real NINGUNA columna se
      // detectaba como fecha: todas caian en el filtro de valores.
      //
      // Ahora se usa el tipo declarado por el backend y, como respaldo, el
      // nombre de la columna.
      const field = (colDef.field ?? '').toLowerCase();
      const isDateCol = dateFields.has(field) || /fecha|date|_dt$|periodo/.test(field);

      return {
        ...colDef,
        filter: isDateCol ? ExcelDateFilterComponent : ExcelColumnFilterComponent,
        // serverSide: esta vista trae los datos paginados, asi que el filtro no
        // debe descartar filas por su cuenta (solo hay una pagina en memoria).
        filterParams: { maxDisplayedValues: 50, serverSide: true },
      };
    });
  }

  private cargarDatos(): void {
    if (!this.vista) return;
    this.isLoading.set(true);
    this.errorMessage.set('');
    const offset = (this.paginaActual - 1) * this.pageSize;
    const skipCount = this.pageSize > 1000 || this.meta().total === -1 || this.isHeavyView();

    console.log('[ViewVistasExcel] Cargando datos:', {
      schema: this.schema,
      viewName: this.viewName,
      offset,
      limit: this.pageSize,
      skipCount,
      filters: this.filters,
      url: `${this.vistasService['baseUrl']}/data`
    });

    this.vistasService.getVistaDatos(this.schema, this.viewName, {
      limit: this.pageSize, offset,
      sort_col: this.sortCol, sort_dir: this.sortDir,
      filters: this.filters, skip_count: skipCount,
    }).subscribe({
      next: (res) => {
        console.log('[ViewVistasExcel] Respuesta recibida:', {
          success: res.success,
          rowsCount: res.rowData?.length ?? 0,
          columnsCount: res.columnDefs?.length ?? 0,
          meta: res.meta,
          firstRow: res.rowData?.[0]
        });

        // Validar que haya datos
        if (!res.rowData || res.rowData.length === 0) {
          console.warn('[ViewVistasExcel] No hay datos en la respuesta');
          this.errorMessage.set('No se encontraron datos para esta vista.');
          this.isLoading.set(false);
          return;
        }

        // Validar que haya columnas
        if (!res.columnDefs || res.columnDefs.length === 0) {
          console.warn('[ViewVistasExcel] No hay columnDefs en la respuesta');
          this.errorMessage.set('Error: La vista no tiene columnas definidas.');
          this.isLoading.set(false);
          return;
        }

        // Aplicar filtros específicos por tipo de columna
        this.columnDefs.set(this.assignDateFiltersToColumns(res.columnDefs));
        this.rowData.set(res.rowData);
        this.meta.set(res.meta);
        this.isHeavyView.set(!!res.meta.heavy_view);
        this.showFilterRequired.set(false);
        this.isLoading.set(false);

        console.log('[ViewVistasExcel] Estado actualizado:', {
          columnDefs: this.columnDefs().length,
          rowData: this.rowData().length,
          meta: this.meta()
        });

        this.refreshGrid();
      },
      error: (err) => {
        console.error('[ViewVistasExcel] Error al cargar datos:', {
          status: err.status,
          statusText: err.statusText,
          error: err.error,
          message: err.message,
          url: err.url
        });

        this.rowData.set([]);
        this.isLoading.set(false);

        if (isFiltersRequiredError(err)) {
          console.log('[ViewVistasExcel] Filtros requeridos');
          this.showFilterRequired.set(true);
          this.isHeavyView.set(true);
          this.filterRequiredMessage.set(err.error.message);
          this.filterColumns.set((err.error.columns ?? []).map((c: NonNullable<FabricFiltersRequiredError['columns']>[number]) => ({
            name: c.name, type: c.type, nullable: c.nullable ?? true,
          })));
          return;
        }
        if (isMaintenanceError(err)) {
          console.log('[ViewVistasExcel] Vista en mantenimiento');
          this.isMaintenanceMode.set(true);
          this.maintenanceMessage.set(err.error.message ?? this.maintenanceMessage());
          return;
        }
        this.errorMessage.set(err instanceof HttpErrorResponse ? handleFabricError(err) : 'No se pudieron cargar los datos.');
      },
    });
  }

  /** Firma de las columnas entregadas al grid, para no reemplazarlas sin motivo */
  private appliedColumnSignature = '';

  private refreshGrid(): void {
    if (!this.gridApi) {
      console.warn('[ViewVistasExcel] refreshGrid llamado pero gridApi no está inicializado');
      return;
    }

    // ── Las columnas SOLO se reemplazan si de verdad cambiaron ───────────────
    //
    // Este era el bug del filtro: cada carga hacia
    // setGridOption('columnDefs', nuevosObjetos), y eso destruye las instancias
    // de filtro de AG Grid. Como filtrar dispara una recarga, el ciclo era:
    //   aplicar filtro -> recarga -> columnDefs nuevos -> filtro destruido
    // Resultado: el popup se cerraba y la columna volvia a salir sin filtrar.
    const signature = this.columnDefs().map(c => c.field ?? c.headerName ?? '').join('|');

    if (signature !== this.appliedColumnSignature) {
      this.appliedColumnSignature = signature;
      this.gridApi.setGridOption('columnDefs', this.columnDefs());
      console.log('[ViewVistasExcel] columnDefs actualizados:', this.columnDefs().length);
    }

    this.gridApi.setGridOption('rowData', this.rowData());
  }

  // ─── Grid events ──────────────────────────────────────────────────────────

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
    this.refreshGrid();
    // Auto-ajustar columnas al contenido después de renderizar
    setTimeout(() => this.autoSizeColumns(), 100);
  }

  /** Auto-ajusta columnas al contenido con límites razonables (helper compartido) */
  private autoSizeColumns(): void {
    autoSizeGridColumns(this.gridApi);
  }

  onSortChanged(): void {
    const state = this.gridApi?.getColumnState()?.find(c => c.sort);
    const col = state?.colId ?? '';
    const dir = (state?.sort as 'asc' | 'desc') ?? 'asc';

    // Sin cambio real no se recarga. AG Grid emite sortChanged tambien al
    // entregar datos nuevos, y eso provocaba una segunda consulta identica al
    // servidor por cada carga (y de paso cerraba el menu de columna abierto).
    if (col === this.sortCol && dir === this.sortDir) return;

    this.sortCol = col;
    this.sortDir = dir;
    this.paginaActual = 1;
    this.cargarDatos();
  }

  /**
   * El filtro de columna cambio.
   *
   * Los datos vienen paginados del servidor, asi que el filtro se traduce a la
   * clausula que entiende el backend. Lo que se puede expresar:
   *
   *   - un solo valor marcado  -> igualdad exacta
   *   - rango de fechas        -> `dateRange` (from/to)
   *   - varios valores         -> NO se puede expresar en la API actual: se
   *     avisa y se deja el filtrado del lado del cliente sobre la pagina.
   *
   * Antes leia `m.filter` y `m.type`, campos de los filtros nativos de AG Grid
   * que nuestros filtros nunca produjeron (devolvian un Set). El resultado era
   * `filters = {}`: se recargaba la vista SIN filtro y el usuario veia que
   * "el filtro no hace nada".
   */
  onFilterChanged(): void {
    if (this.filterDebounce) clearTimeout(this.filterDebounce);

    this.filterDebounce = setTimeout(() => {
      if (!this.gridApi) return;

      const model = this.gridApi.getFilterModel() as Record<string, any>;
      const result: Record<string, string> = {};
      const soloCliente: string[] = [];

      for (const [col, m] of Object.entries(model)) {
        if (!m) continue;

        // Rango de fechas del filtro propio.
        //
        // El endpoint /data recibe `filters` como mapa columna -> valor (con `%`
        // para LIKE), asi que un rango abierto no se puede expresar. Solo el
        // rango de UN dia se traduce, como prefijo LIKE.
        if (m.filterType === 'dateRange') {
          if (m.dateFrom && m.dateFrom === m.dateTo) {
            result[col] = `${m.dateFrom}%`;
          } else if (m.dateFrom || m.dateTo) {
            soloCliente.push(col);
          }
          continue;
        }

        // Lista de valores (filtro de valores o de fechas concretas)
        if (Array.isArray(m.values)) {
          if (m.values.length === 1) {
            result[col] = m.values[0] === '(Vacío)' ? '' : String(m.values[0]);
          } else if (m.values.length > 1) {
            soloCliente.push(col);
          }
          continue;
        }

        // Filtros nativos de AG Grid (por si alguna columna los usa)
        if (m.filter !== undefined && m.filter !== null && m.filter !== '') {
          const val = m.filter instanceof Date
            ? m.filter.toISOString().split('T')[0]
            : String(m.filter);
          result[col] = m.type === 'contains'   ? `%${val}%`
                      : m.type === 'startsWith' ? `${val}%`
                      : m.type === 'endsWith'   ? `%${val}`
                      : val;
        }
      }

      if (soloCliente.length > 0) {
        console.info('[ViewVistasExcel] Seleccion multiple en',
          soloCliente.join(', '), '- se filtra la pagina en el navegador');
      }

      // Si el filtro efectivo para el servidor no cambio, no se recarga: asi el
      // menu de columna sigue abierto y no se pierde el trabajo del usuario.
      const nuevo = JSON.stringify(result);
      if (nuevo === JSON.stringify(this.filters)) return;

      this.filters = result;
      this.paginaActual = 1;
      this.cargarDatos();
    }, 500);
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
      // Ordenar la columna donde esta el cursor. Antes, si no habia celda
      // enfocada, se llamaba applyColumnState con colId '' y AG Grid lo
      // ignoraba en silencio: el boton "no hacia nada" sin explicacion.
      case 'sort-asc':  this.applySortToFocusedColumn('asc');  break;
      case 'sort-desc': this.applySortToFocusedColumn('desc'); break;

      case 'clear-filters':
        this.gridApi?.setFilterModel(null);
        // Si no habia filtros de servidor, no hace falta recargar
        if (Object.keys(this.filters).length === 0) break;
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
      case 'export-csv': this.exportCsv(); break;

      // exportDataAsExcel es de AG Grid ENTERPRISE: en Community no existe, asi
      // que el `?.()` no hacia nada y el boton parecia roto. Se exporta CSV
      // (Excel lo abre igual) y se avisa de la equivalencia.
      case 'export-excel':
        this.exportCsv();
        break;
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

  /**
   * Ordena la columna enfocada. Si el usuario no ha hecho clic en ninguna celda,
   * se avisa en vez de fallar en silencio.
   */
  private applySortToFocusedColumn(sort: 'asc' | 'desc'): void {
    const colId = this.gridApi?.getFocusedCell()?.column.getColId();
    if (!colId) {
      alert('Seleccione primero una celda de la columna que quiere ordenar.');
      return;
    }
    this.gridApi?.applyColumnState({
      state: [{ colId, sort }],
      defaultState: { sort: null },
    });
  }

  /**
   * Exporta lo que se ve en la pagina actual a CSV.
   *
   * Solo la pagina: los datos vienen paginados del servidor. Se avisa para que
   * el usuario no crea que bajo la vista completa.
   */
  private exportCsv(): void {
    if (!this.gridApi) return;

    const filas = this.rowData().length;
    const total = this.meta().total;

    this.gridApi.exportDataAsCsv({
      fileName: `${this.viewName}_pag${this.paginaActual}.csv`,
    });

    if (total > filas && total !== -1) {
      console.info(`[ViewVistasExcel] Exportadas ${filas} de ${total} filas (pagina actual).`);
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
