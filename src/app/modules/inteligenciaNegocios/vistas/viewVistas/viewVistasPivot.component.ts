import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { WebdatarocksPivotModule, WebdatarocksComponent } from '@webdatarocks/ngx-webdatarocks';

import { VistasService, FabricColumn } from '../../services/vistas.service';

interface AggValue {
  field: string;
  aggregation: 'sum' | 'count' | 'avg' | 'min' | 'max' | 'count_distinct';
}

@Component({
  selector: 'app-view-vistas-pivot',
  standalone: true,
  imports: [CommonModule, FormsModule, WebdatarocksPivotModule],
  templateUrl: './viewVistasPivot.component.html',
  styleUrl: './viewVistasPivot.component.css'
})
export class ViewVistasPivotComponent implements OnInit {
  @ViewChild('pivotRef') pivotRef!: WebdatarocksComponent;

  schema = '';
  viewName = '';
  vistaLabel = '';

  // Estado
  isLoadingColumns = true;
  isLoadingData = false;
  showPivot = false;
  errorMessage = '';
  elapsedMs = 0;
  totalGroups = 0;

  // Columnas de la vista
  columns: FabricColumn[] = [];
  numericColumns: FabricColumn[] = [];
  textColumns: FabricColumn[] = [];

  // Configuración del usuario
  selectedRows: string[] = [];
  selectedValues: AggValue[] = [];
  filters: Record<string, string> = {};

  // Datos resultado
  pivotData: Record<string, unknown>[] = [];

  private pivotReady = false;

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
    this.vistaLabel = `${this.schema}.${this.viewName}`;

    if (!this.schema || !this.viewName) {
      this.errorMessage = 'Parámetros de vista inválidos.';
      this.isLoadingColumns = false;
      return;
    }

    this.loadColumns();
  }

  onPivotReady(): void {
    this.pivotReady = true;
    if (this.pivotData.length > 0) {
      this.feedPivot();
    }
  }

  private loadColumns(): void {
    this.vistasService.getColumnas(this.schema, this.viewName).subscribe({
      next: (res) => {
        this.columns = res.data?.columns ?? [];
        this.numericColumns = this.columns.filter(c =>
          ['int', 'bigint', 'decimal', 'numeric', 'float', 'real', 'money', 'smallmoney', 'smallint', 'tinyint']
            .some(t => c.type.toLowerCase().includes(t))
        );
        this.textColumns = this.columns.filter(c =>
          !['int', 'bigint', 'decimal', 'numeric', 'float', 'real', 'money', 'smallmoney', 'smallint', 'tinyint']
            .some(t => c.type.toLowerCase().includes(t))
        );

        // Defaults: primeras 2 columnas texto como filas, primera numérica como SUM
        if (this.textColumns.length > 0) {
          this.selectedRows = [this.textColumns[0].name];
        }
        if (this.numericColumns.length > 0) {
          this.selectedValues = [{ field: this.numericColumns[0].name, aggregation: 'sum' }];
        } else {
          this.selectedValues = [{ field: '*', aggregation: 'count' }];
        }

        this.isLoadingColumns = false;
      },
      error: () => {
        this.errorMessage = 'Error al obtener columnas de la vista.';
        this.isLoadingColumns = false;
      }
    });
  }

  addRow(colName: string): void {
    if (!this.selectedRows.includes(colName)) {
      this.selectedRows.push(colName);
    }
  }

  removeRow(colName: string): void {
    this.selectedRows = this.selectedRows.filter(r => r !== colName);
  }

  addValue(): void {
    const field = this.numericColumns.length > 0 ? this.numericColumns[0].name : '*';
    this.selectedValues.push({ field, aggregation: 'count' });
  }

  removeValue(index: number): void {
    this.selectedValues.splice(index, 1);
  }

  ejecutarAgregacion(): void {
    if (this.selectedRows.length === 0) {
      this.errorMessage = 'Seleccione al menos una columna para agrupar.';
      return;
    }
    if (this.selectedValues.length === 0) {
      this.errorMessage = 'Seleccione al menos un valor a calcular.';
      return;
    }

    this.errorMessage = '';
    this.isLoadingData = true;

    this.vistasService.aggregate(this.schema, this.viewName, {
      rows: this.selectedRows,
      values: this.selectedValues,
      filters: this.filters,
      limit: 10000,
    }).subscribe({
      next: (res) => {
        this.isLoadingData = false;
        if (!res.success) {
          this.errorMessage = res.message ?? 'Error en la agregación.';
          return;
        }
        this.pivotData = res.data ?? [];
        this.totalGroups = res.meta?.total_groups ?? this.pivotData.length;
        this.elapsedMs = res.meta?.elapsed_ms ?? 0;
        this.showPivot = true;

        if (this.pivotReady) {
          this.feedPivot();
        }
      },
      error: (err) => {
        this.isLoadingData = false;
        this.errorMessage = err?.error?.message ?? 'Error al ejecutar la agregación.';
      }
    });
  }

  private feedPivot(): void {
    if (!this.pivotRef?.webDataRocks || this.pivotData.length === 0) return;

    this.pivotRef.webDataRocks.setReport({
      dataSource: {
        data: this.pivotData
      },
      options: {
        grid: {
          type: 'compact',
          showTotals: 'on',
          showGrandTotals: 'on'
        },
        configuratorActive: true,
        configuratorButton: true
      },
      localization: 'https://cdn.webdatarocks.com/loc/es.json'
    });
  }
}
