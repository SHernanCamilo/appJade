import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';

import { VistasService, FabricColumn } from '../../services/vistas.service';
import { AG_GRID_LOCALE } from '../../../../core/config/ag-grid.config';

interface AggValue {
  field: string;
  aggregation: 'sum' | 'count' | 'avg' | 'min' | 'max' | 'count_distinct';
}

interface MetricCard {
  label: string;
  value: string;
  icon: string;
  color: string;
}

@Component({
  selector: 'app-view-vistas-pivot',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridAngular],
  templateUrl: './viewVistasPivot.component.html',
  styleUrl: './viewVistasPivot.component.css'
})
export class ViewVistasPivotComponent implements OnInit {
  schema = '';
  viewName = '';
  vistaLabel = '';

  // Estado reactivo
  isLoadingColumns = signal(true);
  isLoadingData = signal(false);
  showResults = signal(false);
  errorMessage = signal('');

  // Columnas
  columns: FabricColumn[] = [];
  numericColumns: FabricColumn[] = [];
  allColumns: FabricColumn[] = [];

  // Configuración pivot
  selectedRows: string[] = [];
  selectedValues: AggValue[] = [];
  filters: Record<string, string> = {};

  // Resultado
  pivotData: Record<string, unknown>[] = [];
  pivotColumnDefs: ColDef[] = [];
  totalGroups = 0;
  elapsedMs = 0;
  metrics: MetricCard[] = [];

  // Ag-Grid
  localeText = AG_GRID_LOCALE;
  private gridApi?: GridApi;

  defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 130,
    floatingFilter: true,
  };

  // Pinned bottom row para totales
  pinnedBottomRowData: Record<string, unknown>[] = [];

  readonly aggOptions = [
    { label: 'Suma', value: 'sum' },
    { label: 'Conteo', value: 'count' },
    { label: 'Promedio', value: 'avg' },
    { label: 'Mínimo', value: 'min' },
    { label: 'Máximo', value: 'max' },
  ];

  constructor(
    private route: ActivatedRoute,
    private vistasService: VistasService
  ) {}

  ngOnInit(): void {
    this.schema = this.route.snapshot.paramMap.get('schema') ?? '';
    this.viewName = this.route.snapshot.paramMap.get('viewName') ?? '';
    this.vistaLabel = `${this.schema.toUpperCase()}.${this.viewName}`;

    if (!this.schema || !this.viewName) {
      this.errorMessage.set('Parámetros inválidos.');
      this.isLoadingColumns.set(false);
      return;
    }

    this.loadColumns();
  }

  private loadColumns(): void {
    this.vistasService.getColumnas(this.schema, this.viewName).subscribe({
      next: (res) => {
        this.columns = res.data?.columns ?? [];
        this.allColumns = this.columns;
        this.numericColumns = this.columns.filter(c =>
          ['int', 'bigint', 'decimal', 'numeric', 'float', 'real', 'money', 'smallmoney', 'smallint', 'tinyint']
            .some(t => c.type.toLowerCase().includes(t))
        );

        // Defaults inteligentes
        const textCols = this.columns.filter(c => !this.numericColumns.includes(c));
        if (textCols.length > 0) this.selectedRows = [textCols[0].name];
        if (this.numericColumns.length > 0) {
          this.selectedValues = [{ field: this.numericColumns[0].name, aggregation: 'sum' }];
        } else {
          this.selectedValues = [{ field: '*', aggregation: 'count' }];
        }

        this.isLoadingColumns.set(false);
      },
      error: () => {
        this.errorMessage.set('Error al cargar columnas.');
        this.isLoadingColumns.set(false);
      }
    });
  }

  // ── Configuración ──────────────────────────────────────────────────────

  addRow(colName: string): void {
    if (colName && !this.selectedRows.includes(colName)) {
      this.selectedRows = [...this.selectedRows, colName];
    }
  }

  removeRow(colName: string): void {
    this.selectedRows = this.selectedRows.filter(r => r !== colName);
  }

  addValue(): void {
    const field = this.numericColumns.length > 0 ? this.numericColumns[0].name : '*';
    this.selectedValues = [...this.selectedValues, { field, aggregation: 'count' }];
  }

  removeValue(index: number): void {
    this.selectedValues = this.selectedValues.filter((_, i) => i !== index);
  }

  // ── Ejecución ──────────────────────────────────────────────────────────

  ejecutar(): void {
    if (this.selectedRows.length === 0 || this.selectedValues.length === 0) {
      this.errorMessage.set('Seleccione al menos una columna y un valor.');
      return;
    }

    this.errorMessage.set('');
    this.isLoadingData.set(true);
    this.showResults.set(false);

    this.vistasService.aggregate(this.schema, this.viewName, {
      rows: this.selectedRows,
      values: this.selectedValues,
      filters: this.filters,
      limit: 10000,
    }).subscribe({
      next: (res) => {
        this.isLoadingData.set(false);
        if (!res.success) {
          this.errorMessage.set(res.message ?? 'Error.');
          return;
        }

        this.pivotData = res.data ?? [];
        this.totalGroups = res.meta?.total_groups ?? this.pivotData.length;
        this.elapsedMs = res.meta?.elapsed_ms ?? 0;
        this.buildColumnDefs();
        this.buildMetrics();
        this.showResults.set(true);
      },
      error: (err) => {
        this.isLoadingData.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Error en la agregación.');
      }
    });
  }

  volverAConfigurar(): void {
    this.showResults.set(false);
  }

  // ── Construcción de columnas y métricas ────────────────────────────────

  private buildColumnDefs(): void {
    if (this.pivotData.length === 0) {
      this.pivotColumnDefs = [];
      return;
    }

    const keys = Object.keys(this.pivotData[0]);
    this.pivotColumnDefs = keys.map(key => {
      const isNumeric = this.pivotData.some(row => typeof row[key] === 'number');
      const colDef: ColDef = {
        field: key,
        headerName: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        filter: isNumeric ? 'agNumberColumnFilter' : 'agTextColumnFilter',
        minWidth: 140,
      };

      if (isNumeric) {
        colDef.valueFormatter = (params) => {
          if (params.value == null) return '';
          return Number(params.value).toLocaleString('es-CO', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          });
        };
        colDef.cellStyle = { textAlign: 'right', fontWeight: '500' };
      }

      return colDef;
    });
  }

  private buildMetrics(): void {
    if (this.pivotData.length === 0) {
      this.metrics = [];
      this.pinnedBottomRowData = [];
      return;
    }

    this.metrics = [];
    const totalsRow: Record<string, unknown> = {};

    // Marcar la primera columna del total
    if (this.selectedRows.length > 0) {
      totalsRow[this.selectedRows[0]] = '⟹ TOTAL';
    }

    // Métrica: Total de grupos
    this.metrics.push({
      label: 'Grupos',
      value: this.totalGroups.toLocaleString('es-CO'),
      icon: 'pi pi-th-large',
      color: '#7c3aed',
    });

    // Métrica: Tiempo de respuesta
    this.metrics.push({
      label: 'Tiempo',
      value: `${(this.elapsedMs / 1000).toFixed(1)}s`,
      icon: 'pi pi-clock',
      color: '#0891b2',
    });

    // Métricas por cada valor agregado + fila de totales
    for (const val of this.selectedValues) {
      const alias = val.field === '*' ? 'registros_count' : `${val.field}_${val.aggregation}`;
      const values = this.pivotData
        .map(row => Number(row[alias] ?? 0))
        .filter(v => !isNaN(v));

      if (values.length === 0) continue;

      const total = values.reduce((a, b) => a + b, 0);
      const max = Math.max(...values);
      const avg = total / values.length;

      // Fila de totales
      totalsRow[alias] = total;

      if (val.aggregation === 'sum' || val.aggregation === 'count') {
        this.metrics.push({
          label: `Total ${val.field === '*' ? 'Registros' : val.field}`,
          value: total.toLocaleString('es-CO', { maximumFractionDigits: 0 }),
          icon: val.aggregation === 'count' ? 'pi pi-hashtag' : 'pi pi-dollar',
          color: '#059669',
        });
      }

      if (val.aggregation === 'sum' && values.length > 1) {
        this.metrics.push({
          label: `Máx ${val.field}`,
          value: max.toLocaleString('es-CO', { maximumFractionDigits: 0 }),
          icon: 'pi pi-arrow-up',
          color: '#dc2626',
        });
        this.metrics.push({
          label: `Promedio ${val.field}`,
          value: avg.toLocaleString('es-CO', { maximumFractionDigits: 0 }),
          icon: 'pi pi-chart-bar',
          color: '#d97706',
        });
      }
    }

    this.pinnedBottomRowData = [totalsRow];
  }

  // ── Grid ───────────────────────────────────────────────────────────────

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
    this.gridApi.sizeColumnsToFit();
  }

  exportExcel(): void {
    this.gridApi?.exportDataAsCsv({
      fileName: `pivot_${this.schema}_${this.viewName}_${new Date().toISOString().split('T')[0]}`,
    });
  }
}
