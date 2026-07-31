import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';

import { FabricDataMeta, FabricColumn, VistasService, VistaBi } from '../../services/vistas.service';
import { AG_GRID_LOCALE } from '../../../../core/config/ag-grid.config';
import { GridLoaderComponent } from '../../../../complements/shared/grid-loader/grid-loader.component';
import { getColumnType, humanizeColumnName } from '../../helpers/column-type.helper';
import { handleFabricError, isFiltersRequiredError, isMaintenanceError, isVistaEnMantenimiento, FabricFiltersRequiredError } from '../../helpers/fabric-error.helper';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-view-vistas-fullscreen',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridAngular, GridLoaderComponent],
  templateUrl: './viewVistasFullscreen.component.html',
  styleUrl: './viewVistasFullscreen.component.css'
})
export class ViewVistasFullscreenComponent implements OnInit, OnDestroy {
  schema = '';
  viewName = '';
  vista: VistaBi | null = null;
  isLoading = false;
  meta: FabricDataMeta = { total: 0, limit: 50, offset: 0, has_next: false };

  rowData: Record<string, unknown>[] = [];
  columnDefs: ColDef[] = [];
  localeText = AG_GRID_LOCALE;

  paginaActual = 1;
  pageSize = 50;
  sortCol = '';
  sortDir: 'asc' | 'desc' = 'asc';
  filters: Record<string, string> = {};

  isHeavyView = false;
  showFilterRequired = false;
  isMaintenanceMode = false;
  maintenanceMessage = 'Esta vista está en mantenimiento. Intente más tarde.';
  filterRequiredMessage = '';
  filterColumns: FabricColumn[] = [];
  suggestedFilterValues: Record<string, string> = {};
  errorMessage = '';

  readonly getColumnType = getColumnType;
  readonly humanizeColumnName = humanizeColumnName;

  defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 110,
    floatingFilter: true
  };

  private gridApi?: GridApi;
  private filterDebounce: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private route: ActivatedRoute,
    private vistasService: VistasService
  ) {}

  ngOnInit(): void {
    this.schema = this.route.snapshot.paramMap.get('schema') ?? '';
    this.viewName = this.route.snapshot.paramMap.get('viewName') ?? '';

    if (!this.schema || !this.viewName) {
      window.close();
      return;
    }

    this.loadVista();
  }

  ngOnDestroy(): void {
    if (this.filterDebounce) {
      clearTimeout(this.filterDebounce);
    }
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

  private loadVista(): void {
    this.isLoading = true;

    this.vistasService.getVista(this.schema, this.viewName).subscribe({
      next: (response) => {
        this.vista = response.data;

        if (!this.vista) {
          window.close();
          return;
        }

        if (isVistaEnMantenimiento(this.vista)) {
          this.isMaintenanceMode = true;
          this.maintenanceMessage = `La vista '${this.vista.nombre}' está en mantenimiento. Intente más tarde.`;
          this.isLoading = false;
          return;
        }

        this.cargarDatos();
      },
      error: () => {
        window.close();
      }
    });
  }

  private cargarDatos(): void {
    if (!this.vista) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
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
        this.isLoading = false;
        this.refreshGrid();
      },
      error: (err) => {
        this.rowData = [];
        this.isLoading = false;

        if (isFiltersRequiredError(err)) {
          this.showFilterRequired = true;
          this.isHeavyView = true;
          this.filterRequiredMessage = err.error.message;
          this.filterColumns = (err.error.columns ?? []).map((col: NonNullable<FabricFiltersRequiredError['columns']>[number]) => ({
            name: col.name,
            type: col.type,
            nullable: col.nullable ?? true
          }));
          return;
        }

        if (isMaintenanceError(err)) {
          this.isMaintenanceMode = true;
          this.maintenanceMessage = err.error.message ?? this.maintenanceMessage;
          return;
        }

        this.errorMessage = err instanceof HttpErrorResponse
          ? handleFabricError(err)
          : 'No se pudieron cargar los datos.';
      }
    });
  }

  irPagina(pagina: number): void {
    if (this.usarPaginacionInfinita) {
      return;
    }
    if (pagina < 1 || pagina > this.totalPaginas) {
      return;
    }
    this.paginaActual = pagina;
    this.cargarDatos();
  }

  siguientePagina(): void {
    if (!this.canGoNext) {
      return;
    }
    this.paginaActual += 1;
    this.cargarDatos();
  }

  paginaAnterior(): void {
    if (!this.canGoPrev) {
      return;
    }
    this.paginaActual -= 1;
    this.cargarDatos();
  }

  onSuggestedFilter(col: string, value: string): void {
    if (!value) {
      delete this.suggestedFilterValues[col];
      return;
    }
    this.suggestedFilterValues[col] = value;
  }

  aplicarFiltrosRequeridos(): void {
    const activos = Object.entries(this.suggestedFilterValues)
      .filter(([, v]) => v !== undefined && v !== null && v !== '');

    if (activos.length === 0) {
      this.errorMessage = 'Ingrese al menos un filtro para consultar esta vista.';
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

  onPageSizeChange(): void {
    this.pageSize = Number(this.pageSize);
    this.paginaActual = 1;
    this.cargarDatos();
  }

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

  onFilterChanged(): void {
    if (this.filterDebounce) {
      clearTimeout(this.filterDebounce);
    }

    this.filterDebounce = setTimeout(() => {
      this.filters = this.extraerFiltrosGrid();
      this.paginaActual = 1;
      this.cargarDatos();
    }, 600);
  }

  private extraerFiltrosGrid(): Record<string, string> {
    if (!this.gridApi) {
      return {};
    }

    const filterModel = this.gridApi.getFilterModel();
    const filters: Record<string, string> = {};

    for (const [col, model] of Object.entries(filterModel as Record<string, any>)) {
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

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
    this.refreshGrid();
  }

  private refreshGrid(): void {
    if (!this.gridApi) {
      return;
    }

    this.gridApi.setGridOption('columnDefs', this.columnDefs);
    this.gridApi.setGridOption('rowData', this.rowData);
    this.gridApi.sizeColumnsToFit();
  }
}
