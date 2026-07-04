import { Component, OnInit, OnDestroy, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { Subscription } from 'rxjs';

import { FabricDataMeta, VistasService, VistaBi } from '../../services/vistas.service';
import { BiExcelOnlineService } from '../../services/bi-excel-online.service';
import { FabricExportService } from '../../services/fabric-export.service';
import { AG_GRID_LOCALE } from '../../../../core/config/ag-grid.config';

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

@Component({
  selector: 'app-view-vistas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AgGridAngular, ToastModule],
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
  isCargaParcial = false;
  isExportingExcelOnline = false;
  exportEnSegundoPlano = false;
  cargaProgreso: { loaded: number; total: number } | null = null;

  rowData: Record<string, unknown>[] = [];
  columnDefs: ColDef[] = [];
  meta: FabricDataMeta = { total: 0, limit: 0, offset: 0, has_next: false };

  pageSize = 50;
  localeText = AG_GRID_LOCALE;

  defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 110
  };

  private gridApi?: GridApi;
  private exportSub?: Subscription;
  private previousRowCount = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private vistasService: VistasService,
    private biExcelOnlineService: BiExcelOnlineService,
    private fabricExportService: FabricExportService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.schema = this.route.snapshot.paramMap.get('schema') ?? '';
    this.viewName = this.route.snapshot.paramMap.get('viewName') ?? '';

    if (!this.schema || !this.viewName) {
      this.router.navigate(['/inteligenciaNegocios/vistas']);
      return;
    }

    this.loadVista();

    this.exportSub = this.fabricExportService.pendingCount$.subscribe(
      count => { this.exportEnSegundoPlano = count > 0; }
    );
  }

  ngOnDestroy(): void {
    this.exportSub?.unsubscribe();
  }

  get totalRegistros(): number {
    return this.rowData.length || this.meta.total;
  }

  get totalEsperado(): number {
    return this.cargaProgreso?.total || this.meta.total || this.rowData.length;
  }

  private loadVista(): void {
    this.isLoadingVista = true;

    this.vistasService.getVista(this.schema, this.viewName).subscribe({
      next: (response) => {
        this.vista = response.data;
        this.isLoadingVista = false;

        if (!this.vista) {
          this.messageService.add({
            severity: 'warn',
            summary: 'Vista no encontrada',
            detail: 'No tiene acceso a esta vista o no existe en el catálogo.',
            life: 5000
          });
          this.router.navigate(['/inteligenciaNegocios/vistas']);
          return;
        }

        this.cargarDatos();
      },
      error: () => {
        this.isLoadingVista = false;
        this.router.navigate(['/inteligenciaNegocios/vistas']);
      }
    });
  }

  cargarDatos(): void {
    if (!this.vista) {
      return;
    }

    this.isLoadingDatos = true;
    this.isCargaParcial = false;
    this.cargaProgreso = { loaded: 0, total: 0 };
    this.rowData = [];
    this.columnDefs = [];
    this.previousRowCount = 0;

    this.vistasService.getVistaDatosTodos(this.schema, this.viewName, {
      onProgress: (loaded, total) => {
        this.cargaProgreso = { loaded, total };
      }
    }).subscribe({
      next: (response) => {
        const prevCount = this.previousRowCount;
        this.columnDefs = response.columnDefs;
        this.rowData = response.rowData;
        this.meta = response.meta;
        this.isCargaParcial = response.partial ?? false;
        this.isLoadingDatos = response.partial ?? false;

        if (!response.partial) {
          this.cargaProgreso = null;
        }

        this.refreshGrid(prevCount);
        this.previousRowCount = this.rowData.length;
      },
      error: (err) => {
        this.columnDefs = [];
        this.rowData = [];
        this.meta = { total: 0, limit: 0, offset: 0, has_next: false };
        this.isLoadingDatos = false;
        this.isCargaParcial = false;
        this.cargaProgreso = null;
        this.messageService.add({
          severity: 'error',
          summary: 'Error al consultar',
          detail: err?.error?.message || 'No se pudieron cargar los datos de Fabric.',
          life: 6000
        });
      }
    });
  }

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
    this.refreshGrid();
  }

  private refreshGrid(previousCount = 0): void {
    if (!this.gridApi) {
      return;
    }

    const incremental =
      this.isCargaParcial &&
      previousCount > 0 &&
      previousCount < this.rowData.length;

    if (incremental) {
      this.gridApi.applyTransaction({
        add: this.rowData.slice(previousCount)
      });
      return;
    }

    this.gridApi.setGridOption('columnDefs', this.columnDefs);
    this.gridApi.setGridOption('rowData', this.rowData);
    this.gridApi.sizeColumnsToFit();
  }

  volverAlListado(): void {
    this.router.navigate(['/inteligenciaNegocios/vistas']);
  }

  abrirEnNuevaPestana(): void {
    const url = this.router.serializeUrl(
      this.router.createUrlTree([
        '/inteligenciaNegocios/vistas/viewVistas/fullscreen',
        this.schema,
        this.viewName
      ])
    );
    window.open(url, '_blank');
  }

  async exportarExcelEnLinea(): Promise<void> {
    if (!this.vista || this.rowData.length === 0) {
      return;
    }

    this.isExportingExcelOnline = true;

    try {
      const datosExportar = this.rowData;
      const nombreHoja = this.vista.nombre.substring(0, 31);
      const nombreArchivo = this.vista.codigo.replace(/[^a-zA-Z0-9-_]/g, '_');

      const response = await this.biExcelOnlineService.abrirVistaEnExcelOnline({
        datos: datosExportar,
        columnDefs: this.columnDefs,
        nombreHoja,
        nombreArchivo,
        filaEncabezados: 6,
        reportHeader: {
          title: this.vista.nombre,
          subtitle: `${this.vista.codigo} · ${this.vista.fuente || 'Fabric'} · ${this.rowData.length} registros`
        }
      });

      if (!response.success || !response.data?.office_url) {
        this.messageService.add({
          severity: 'error',
          summary: 'Excel Online',
          detail: response.message || 'No se pudo abrir Excel en línea.',
          life: 6000
        });
        return;
      }

      window.open(response.data.office_url, '_blank', 'noopener,noreferrer');

      this.messageService.add({
        severity: 'success',
        summary: 'Excel en línea',
        detail: 'Se abrió el dataset completo en Microsoft Excel Online.',
        life: 4000
      });
    } catch (error: any) {
      const backendMessage = error?.error?.message;
      const hint = error?.error?.hint;

      this.messageService.add({
        severity: 'warn',
        summary: 'Excel Online no disponible',
        detail: hint
          ? `${backendMessage} ${hint}`
          : backendMessage || 'No se pudo publicar el archivo para Excel Online.',
        life: 8000
      });
    } finally {
      this.isExportingExcelOnline = false;
    }
  }

  descargarExcel(): void {
    if (!this.vista) {
      return;
    }

    this.fabricExportService.exportarExcel({
      schema: this.schema,
      viewName: this.viewName,
      label: this.vista.nombre,
      codigo: this.vista.codigo,
      fuente: this.vista.fuente,
      rowData: this.rowData,
      columnDefs: this.columnDefs,
      cargaCompleta: !this.isCargaParcial && !this.isLoadingDatos,
      max_rows: 50000
    });
  }

}
