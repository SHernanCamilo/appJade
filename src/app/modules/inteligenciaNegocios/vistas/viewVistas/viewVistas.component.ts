import { Component, OnInit, OnDestroy, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { Subscription } from 'rxjs';

import { FabricDataMeta, VistasService, VistaBi } from '../../services/vistas.service';
import { FabricExportService } from '../../services/fabric-export.service';
import { AG_GRID_LOCALE } from '../../../../core/config/ag-grid.config';
import { GridLoaderComponent } from '../../../../complements/shared/grid-loader/grid-loader.component';

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

  localeText = AG_GRID_LOCALE;

  defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 110,
    floatingFilter: true
  };

  private gridApi?: GridApi;
  private exportSub?: Subscription;
  private filterDebounce: ReturnType<typeof setTimeout> | null = null;
  exportEnSegundoPlano = false;

  private listPath = '/inteligenciaNegocios/vistas';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
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
  }

  ngOnDestroy(): void {
    this.exportSub?.unsubscribe();
    if (this.filterDebounce) clearTimeout(this.filterDebounce);
  }

  get totalRegistros(): number {
    return this.meta.total;
  }

  get totalPaginas(): number {
    return Math.ceil(this.meta.total / this.pageSize) || 1;
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

        this.cargarDatos();
      },
      error: () => { this.isLoadingVista = false; this.router.navigate([this.listPath]); }
    });
  }

  cargarDatos(): void {
    if (!this.vista) return;

    this.isLoadingDatos = true;
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
        this.isLoadingDatos = false;
        this.refreshGrid();
      },
      error: (err) => {
        this.rowData = []; this.isLoadingDatos = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'No se pudieron cargar los datos.', life: 6000 });
      }
    });
  }

  // ── Paginación ────────────────────────────────────────────────────────────

  irPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas) return;
    this.paginaActual = pagina;
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
    // Debounce para no enviar muchas peticiones mientras el usuario escribe
    if (this.filterDebounce) clearTimeout(this.filterDebounce);

    this.filterDebounce = setTimeout(() => {
      this.filters = this.extraerFiltrosGrid();
      this.paginaActual = 1;
      this.cargarDatos();
    }, 600);
  }

  private extraerFiltrosGrid(): Record<string, string> {
    if (!this.gridApi) return {};

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

  limpiarFiltros(): void {
    this.gridApi?.setFilterModel(null);
    this.filters = {};
    this.paginaActual = 1;
    this.cargarDatos();
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
    this.gridApi.sizeColumnsToFit();
  }

  volverAlListado(): void { this.router.navigate([this.listPath]); }

  abrirEnNuevaPestana(): void {
    const url = this.router.serializeUrl(
      this.router.createUrlTree([`${this.listPath}/viewVistas/fullscreen`, this.schema, this.viewName])
    );
    window.open(url, '_blank');
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
      max_rows: 100000,
      filters: this.filters,
      sort_col: this.sortCol,
      sort_dir: this.sortDir
    });
  }
}
