import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';

import { FabricDataMeta, VistasService, VistaBi } from '../../services/vistas.service';
import { AG_GRID_LOCALE } from '../../../../core/config/ag-grid.config';

@Component({
  selector: 'app-view-vistas-fullscreen',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  templateUrl: './viewVistasFullscreen.component.html',
  styleUrl: './viewVistasFullscreen.component.css'
})
export class ViewVistasFullscreenComponent implements OnInit {
  schema = '';
  viewName = '';
  vista: VistaBi | null = null;
  isLoading = false;
  meta: FabricDataMeta = { total: 0, limit: 50, offset: 0, has_next: false };

  rowData: Record<string, unknown>[] = [];
  columnDefs: ColDef[] = [];
  localeText = AG_GRID_LOCALE;

  defaultColDef: ColDef = {
    sortable: true,
    filter: false,
    resizable: true,
    minWidth: 100
  };

  private gridApi?: GridApi;

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

  get totalRegistros(): number {
    return this.rowData.length || this.meta.total;
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

    this.vistasService.getVistaDatosTodos(this.schema, this.viewName).subscribe({
      next: (response) => {
        this.columnDefs = response.columnDefs;
        this.rowData = response.rowData;
        this.meta = response.meta;
        this.isLoading = false;
        this.refreshGrid();
      },
      error: () => {
        this.columnDefs = [];
        this.rowData = [];
        this.meta = { total: 0, limit: 0, offset: 0, has_next: false };
        this.isLoading = false;
      }
    });
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
