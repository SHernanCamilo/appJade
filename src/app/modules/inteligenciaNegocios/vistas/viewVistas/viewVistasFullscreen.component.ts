import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';

import { FabricDataMeta, VistasService, VistaBi } from '../../services/vistas.service';
import { AG_GRID_LOCALE } from '../../../../core/config/ag-grid.config';
import { GridLoaderComponent } from '../../../../complements/shared/grid-loader/grid-loader.component';

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

  get totalPaginas(): number {
    return Math.ceil(this.meta.total / this.pageSize) || 1;
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
    const offset = (this.paginaActual - 1) * this.pageSize;

    this.vistasService.getVistaDatos(this.schema, this.viewName, {
      limit: this.pageSize,
      offset,
      sort_col: this.sortCol,
      sort_dir: this.sortDir,
      filters: this.filters
    }).subscribe({
      next: (response) => {
        this.columnDefs = response.columnDefs;
        this.rowData = response.rowData;
        this.meta = response.meta;
        this.isLoading = false;
        this.refreshGrid();
      },
      error: () => {
        this.rowData = [];
        this.isLoading = false;
      }
    });
  }

  irPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas) {
      return;
    }
    this.paginaActual = pagina;
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
        const valor = String(model.filter);

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
