import { Component, OnInit, OnDestroy, ViewEncapsulation } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { Subscription } from 'rxjs';

import { FabricDataMeta, FabricColumn, VistasService, VistaBi } from '../../services/vistas.service';
import { FabricExportService, ExportProgress } from '../../services/fabric-export.service';
import { AG_GRID_LOCALE } from '../../../../core/config/ag-grid.config';
import { GridLoaderComponent } from '../../../../complements/shared/grid-loader/grid-loader.component';
import { getColumnType, humanizeColumnName } from '../../helpers/column-type.helper';
import { handleFabricError, isFiltersRequiredError, isMaintenanceError, isVistaEnMantenimiento, FabricFiltersRequiredError } from '../../helpers/fabric-error.helper';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-view-vistas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AgGridAngular, ToastModule, TooltipModule, GridLoaderComponent],
  providers: [MessageService],
  templateUrl: './viewVistas.component.html',
  styleUrl: './viewVistas.component.css',
  encapsulation: ViewEncapsulation.None
})
export class ViewVistasComponent implements OnInit, OnDestroy {
  schema = '';
  viewName = '';
  vista: VistaBi | null = null;
  isLoadingVista = true;
  isLoadingDatos = false;

  rowData: Record<string, unknown>[] = [];
  columnDefs: ColDef[] = [];
  meta: FabricDataMeta = { total: 0, limit: 50, offset: 0, has_next: false };

  // Paginación y filtros server-side
  paginaActual = 1;
  pageSize = 50;
  sortCol = '';
  sortDir: 'asc' | 'desc' = 'asc';
  filters: Record<string, string> = {};

  // Vistas pesadas — detección dinámica vía API
  isHeavyView = false;
  showFilterRequired = false;
  isMaintenanceMode = false;
  maintenanceMessage = 'Esta vista está en mantenimiento. Intente más tarde.';
  filterRequiredMessage = '';
  suggestedFilters: string[] = [];
  filterColumns: FabricColumn[] = [];
  suggestedFilterValues: Record<string, string> = {};

  readonly getColumnType = getColumnType;
  readonly humanizeColumnName = humanizeColumnName;

  localeText = AG_GRID_LOCALE;

  defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 110,
    floatingFilter: true,
    cellClass: 'cell-copyable'
  };

  // AG Grid opciones adicionales
  sideBar = {
    toolPanels: [
      {
        id: 'columns',
        labelDefault: 'Columnas',
        labelKey: 'columns',
        iconKey: 'columns',
        toolPanel: 'agColumnsToolPanel',
        toolPanelParams: { suppressRowGroups: true, suppressValues: true, suppressPivots: true, suppressPivotMode: true }
      }
    ]
  };

  // Overlay loading al filtrar
  isFiltering = false;

  // Export progress
  exportProgress: ExportProgress | null = null;

  private gridApi?: GridApi;
  private exportSub?: Subscription;
  private filterDebounce: ReturnType<typeof setTimeout> | null = null;
  exportEnSegundoPlano = false;

  private listPath = '/inteligenciaNegocios/vistas';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private vistasService: VistasService,
    private fabricExportService: FabricExportService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.listPath = (this.route.snapshot.data['listPath'] as string) ?? this.listPath;
    this.schema = this.route.snapshot.paramMap.get('schema') ?? '';
    this.viewName = this.route.snapshot.paramMap.get('viewName') ?? '';

    if (!this.schema || !this.viewName) {
      this.router.navigate([this.listPath]);
      return;
    }

    this.loadVista();

    this.exportSub = this.fabricExportService.pendingCount$.subscribe(
      count => { this.exportEnSegundoPlano = count > 0; }
    );

    this.fabricExportService.exportProgress$.subscribe(
      progress => { this.exportProgress = progress; }
    );
  }

  ngOnDestroy(): void {
    this.exportSub?.unsubscribe();
    if (this.filterDebounce) clearTimeout(this.filterDebounce);
  }

  get totalRegistros(): number {
    return this.meta.total;
  }

  get totalLabel(): string {
    if (this.meta.total === -1) {
      return 'Muchos registros';
    }
    return `${this.meta.total.toLocaleString('es-CO')} registros`;
  }

  get usarPaginacionInfinita(): boolean {
    return this.meta.total === -1;
  }

  get totalPaginas(): number {
    if (this.usarPaginacionInfinita) {
      return 0;
    }
    return Math.ceil(this.meta.total / this.pageSize) || 1;
  }

  get canGoNext(): boolean {
    return this.usarPaginacionInfinita ? this.meta.has_next : this.paginaActual < this.totalPaginas;
  }

  get canGoPrev(): boolean {
    return this.paginaActual > 1;
  }

  get hayDatosParaExportar(): boolean {
    return this.rowData.length > 0 || (this.meta.total > 0);
  }

  get hayFiltrosActivos(): boolean {
    return Object.keys(this.filters).length > 0;
  }

  private loadVista(): void {
    this.isLoadingVista = true;

    this.vistasService.getVista(this.schema, this.viewName).subscribe({
      next: (response) => {
        this.vista = response.data;
        this.isLoadingVista = false;

        if (!this.vista) {
          this.messageService.add({ severity: 'warn', summary: 'Vista no encontrada', detail: 'No tiene acceso a esta vista.', life: 5000 });
          this.router.navigate([this.listPath]);
          return;
        }

        if (isVistaEnMantenimiento(this.vista)) {
          this.isMaintenanceMode = true;
          this.maintenanceMessage = `La vista '${this.vista.nombre}' está en mantenimiento. Intente más tarde.`;
          return;
        }

        this.cargarDatos();
      },
      error: () => { this.isLoadingVista = false; this.router.navigate([this.listPath]); }
    });
  }

  cargarDatos(): void {
    if (!this.vista) return;

    this.isLoadingDatos = true;
    const offset = (this.paginaActual - 1) * this.pageSize;
    const usarSkipCount = this.pageSize > 1000 || this.usarPaginacionInfinita || this.isHeavyView;

    this.vistasService.getVistaDatos(this.schema, this.viewName, {
      limit: this.pageSize,
      offset,
      sort_col: this.sortCol,
      sort_dir: this.sortDir,
      filters: this.filters,
      skip_count: usarSkipCount
    }).subscribe({
      next: (response) => {
        this.columnDefs = response.columnDefs;
        this.rowData = response.rowData;
        this.meta = response.meta;
        this.isHeavyView = !!response.meta.heavy_view;
        this.showFilterRequired = false;
        this.isLoadingDatos = false;
        this.isFiltering = false;
        this.refreshGrid();
      },
      error: (err) => {
        this.rowData = [];
        this.isLoadingDatos = false;
        this.isFiltering = false;

        if (isFiltersRequiredError(err)) {
          this.showFilterRequired = true;
          this.isHeavyView = true;
          this.filterRequiredMessage = err.error.message;
          this.suggestedFilters = err.error.suggestions ?? [];
          this.filterColumns = (err.error.columns ?? []).map((col: NonNullable<FabricFiltersRequiredError['columns']>[number]) => ({
            name: col.name,
            type: col.type,
            nullable: col.nullable ?? true
          }));
          this.messageService.add({
            severity: 'warn',
            summary: 'Filtros requeridos',
            detail: err.error.message,
            life: 8000
          });
          return;
        }

        if (isMaintenanceError(err)) {
          this.isMaintenanceMode = true;
          this.maintenanceMessage = err.error.message ?? this.maintenanceMessage;
          return;
        }

        const detail = err instanceof HttpErrorResponse
          ? handleFabricError(err)
          : (err?.error?.message || 'No se pudieron cargar los datos.');
        this.messageService.add({ severity: 'error', summary: 'Error', detail, life: 6000 });
      }
    });
  }

  // ── Paginación ────────────────────────────────────────────────────────────

  irPagina(pagina: number): void {
    if (this.usarPaginacionInfinita) return;
    if (pagina < 1 || pagina > this.totalPaginas) return;
    this.paginaActual = pagina;
    this.cargarDatos();
  }

  siguientePagina(): void {
    if (!this.canGoNext) return;
    this.paginaActual += 1;
    this.cargarDatos();
  }

  paginaAnterior(): void {
    if (!this.canGoPrev) return;
    this.paginaActual -= 1;
    this.cargarDatos();
  }

  onPageSizeChange(): void {
    this.pageSize = Number(this.pageSize);
    this.paginaActual = 1;
    this.cargarDatos();
  }

  // ── Sorting server-side ───────────────────────────────────────────────────

  onSortChanged(): void {
    const sortModel = this.gridApi?.getColumnState()?.find(c => c.sort);
    if (sortModel) {
      this.sortCol = sortModel.colId ?? '';
      this.sortDir = (sortModel.sort as 'asc' | 'desc') ?? 'asc';
    } else {
      this.sortCol = '';
      this.sortDir = 'asc';
    }
    this.paginaActual = 1;
    this.cargarDatos();
  }

  // ── Filtros server-side ───────────────────────────────────────────────────

  onFilterChanged(): void {
    if (this.filterDebounce) clearTimeout(this.filterDebounce);

    this.filterDebounce = setTimeout(() => {
      this.filters = this.extraerFiltrosGrid();
      this.paginaActual = 1;
      this.isFiltering = true;
      this.cargarDatos();
    }, 600);
  }

  private extraerFiltrosGrid(): Record<string, string> {
    if (!this.gridApi) return {};

    const filterModel = this.gridApi.getFilterModel();
    const filters: Record<string, string> = {};

    for (const [col, model] of Object.entries(filterModel as Record<string, any>)) {
      // Filtro de fecha (agDateColumnFilter) — usa dateFrom/dateTo
      if (model.dateFrom) {
        const tipo = model.type ?? 'equals';
        const dateFrom = model.dateFrom.split(' ')[0]; // "2026-07-14 00:00:00" → "2026-07-14"

        switch (tipo) {
          case 'equals':
            // Para datetime: buscar todo el día (rango inicio..fin del día)
            filters[col] = `${dateFrom}..${dateFrom}`;
            break;
          case 'greaterThan':
            filters[col] = `>${dateFrom}`;
            break;
          case 'lessThan':
            filters[col] = `<${dateFrom}`;
            break;
          case 'notEqual':
            filters[col] = `!=${dateFrom}`;
            break;
          case 'inRange':
            const dateTo = model.dateTo ? model.dateTo.split(' ')[0] : dateFrom;
            filters[col] = `${dateFrom}..${dateTo}`;
            break;
          default:
            filters[col] = `${dateFrom}..${dateFrom}`;
        }
        continue;
      }

      // Filtro de texto/número — usa filter
      if (model.filter !== undefined && model.filter !== null && model.filter !== '') {
        const tipo = model.type ?? 'contains';
        const valor = this.formatGridFilterValue(model.filter);

        switch (tipo) {
          case 'contains':
            filters[col] = `%${valor}%`;
            break;
          case 'startsWith':
            filters[col] = `${valor}%`;
            break;
          case 'endsWith':
            filters[col] = `%${valor}`;
            break;
          case 'equals':
            filters[col] = valor;
            break;
          default:
            filters[col] = `%${valor}%`;
        }
      }
    }

    return filters;
  }

  private formatGridFilterValue(value: unknown): string {
    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }
    return String(value);
  }

  limpiarFiltros(): void {
    this.gridApi?.setFilterModel(null);
    this.filters = {};
    this.suggestedFilterValues = {};
    this.paginaActual = 1;
    this.cargarDatos();
  }

  onSuggestedFilter(col: string, value: string): void {
    if (!value) {
      delete this.suggestedFilterValues[col];
      return;
    }
    this.suggestedFilterValues[col] = this.normalizeFilterValue(col, value);
  }

  aplicarFiltrosRequeridos(): void {
    const activos = Object.entries(this.suggestedFilterValues)
      .filter(([, v]) => v !== undefined && v !== null && v !== '');

    if (activos.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Filtros requeridos',
        detail: 'Ingrese al menos un filtro para consultar esta vista.',
        life: 5000
      });
      return;
    }

    this.filters = Object.fromEntries(
      activos.map(([col, value]) => {
        const colMeta = this.filterColumns.find(c => c.name === col);
        const tipo = colMeta ? getColumnType(colMeta.type) : 'text';
        const filtro = tipo === 'text' && !value.includes('%') ? `%${value}%` : value;
        return [col, filtro];
      })
    );
    this.paginaActual = 1;
    this.showFilterRequired = false;
    this.cargarDatos();
  }

  private normalizeFilterValue(col: string, value: string): string {
    const colMeta = this.filterColumns.find(c => c.name === col);
    if (colMeta && getColumnType(colMeta.type) === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    return value;
  }

  onPaginationChanged(): void { /* no-op con suppressPaginationPanel */ }

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
    this.refreshGrid();
  }

  private refreshGrid(): void {
    if (!this.gridApi) return;
    this.gridApi.setGridOption('columnDefs', this.columnDefs);
    this.gridApi.setGridOption('rowData', this.rowData);
    // Auto-ajustar ancho de columnas al contenido
    setTimeout(() => {
      this.gridApi?.autoSizeAllColumns();
    }, 100);
  }

  volverAlListado(): void { this.router.navigate([this.listPath]); }

  abrirEnNuevaPestana(): void {
    // Usar router.createUrlTree para generar la ruta relativa
    const urlTree = this.router.createUrlTree([this.listPath, 'viewVistas', 'fullscreen', this.schema, this.viewName]);
    const url = this.router.serializeUrl(urlTree);
    
    // Usar location.prepareExternalUrl para respetar el base-href en producción
    const fullUrl = this.location.prepareExternalUrl(url);
    
    window.open(fullUrl, '_blank');
  }

  abrirPivot(): void {
    const urlTree = this.router.createUrlTree([this.listPath, 'viewVistas', 'pivot', this.schema, this.viewName]);
    const url = this.router.serializeUrl(urlTree);
    const fullUrl = this.location.prepareExternalUrl(url);
    window.open(fullUrl, '_blank');
  }

  // ── Descarga Excel en segundo plano (backend genera el archivo) ───────────

  descargarExcel(): void {
    if (!this.vista) return;

    this.messageService.add({ severity: 'info', summary: 'Exportando...', detail: 'Se está generando el Excel en segundo plano. Se descargará automáticamente.', life: 4000 });

    this.fabricExportService.exportarExcel({
      schema: this.schema,
      viewName: this.viewName,
      label: this.vista.nombre,
      codigo: this.vista.codigo,
      fuente: this.vista.fuente,
      rowData: [],  // No enviar datos locales — el backend genera todo
      columnDefs: this.columnDefs,
      cargaCompleta: false,  // Fuerza export async en backend
      max_rows: 1_000_000,
      filters: this.filters,
      sort_col: this.sortCol,
      sort_dir: this.sortDir
    });
  }

  cancelExport(): void {
    this.fabricExportService.cancelExport();
  }
}
