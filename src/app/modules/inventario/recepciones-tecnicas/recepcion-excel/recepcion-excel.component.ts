import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import type {
  ColDef,
  GridApi,
  GridReadyEvent,
  CellValueChangedEvent,
  ValueGetterParams,
  CellClassParams,
  GridOptions,
} from 'ag-grid-community';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { SkeletonModule } from 'primeng/skeleton';
import { InventarioService } from '../../../../core/services/inventario.service';
import { AG_GRID_LOCALE } from '../../../../core/config/ag-grid.config';

/** Fila del formulario de recepción técnica. */
interface RecepcionRow {
  // Datos del producto (solo lectura)
  codigo_producto: string;
  producto_nombre: string;
  marca: string;
  tipo_producto: string;
  forma_farmaceutica: string;
  concentracion: string;
  unidad_empaque: string;
  cantidad_solicitada: number;

  // Campos editables
  es_medicamento_vital: boolean;
  codigo_sanitario: string;
  estado_invima: string;
  fabricante: string;
  vida_util: string;
  fecha_vencimiento: string;
  cantidad_recibida: number;
  muestra_poblacion: number | null;
  numero_lote: string;
  aspecto_cumple: string;
  embalaje_cumple: string;
  contenido_cumple: string;
  cadena_frio_temperatura: number | null;
  concepto_recepcion: string;
  observaciones_recepcion: string;

  // Estado interno
  _validatingInvima: boolean;
  _invimaValid: boolean | null;
  _semaforo: 'verde' | 'amarillo' | 'rojo' | '';
  pedido_detalle_id: number | null;
  recibido: boolean;
}

const CUMPLE_VALUES = ['Cumple', 'No Cumple'];
const CONCEPTO_VALUES = ['', 'aceptado', 'cuarentena', 'rechazado'];

@Component({
  selector: 'app-recepcion-excel',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridAngular, ButtonModule, ToastModule, SkeletonModule],
  providers: [MessageService],
  templateUrl: './recepcion-excel.component.html',
  styleUrl: './recepcion-excel.component.css',
})
export class RecepcionExcelComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly inventarioService = inject(InventarioService);
  private readonly msg = inject(MessageService);

  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly ordenInfo = signal<{ numero: string; proveedor: string; compraId: number } | null>(null);
  readonly observacionesGlobal = signal('');

  /** Contadores reactivos (se recalculan al editar celdas). */
  readonly totalItems = signal(0);
  readonly totalRecibidos = signal(0);
  readonly totalRechazados = signal(0);
  readonly totalPendientes = computed(() => this.totalItems() - this.totalRecibidos());

  readonly localeText = AG_GRID_LOCALE;

  /** AG Grid trabaja sobre este arreglo mutable. */
  rowData: RecepcionRow[] = [];

  private gridApi?: GridApi<RecepcionRow>;
  private compraId = 0;

  // ─── Configuración de columnas ────────────────────────────────────────────

  readonly defaultColDef: ColDef<RecepcionRow> = {
    resizable: true,
    sortable: true,
    suppressMovable: false,
    minWidth: 80,
    cellClass: 'xl-cell',
    headerClass: 'xl-header',
    editable: true, // Todo editable por defecto (como Excel)
  };

  readonly gridOptions: GridOptions<RecepcionRow> = {
    // ━━ Comportamiento idéntico a Excel ━━
    singleClickEdit: true,         // Un clic entra a edición (como Excel)
    stopEditingWhenCellsLoseFocus: true,
    enterNavigatesVertically: true,
    enterNavigatesVerticallyAfterEdit: true,
    tabToNextCell: undefined,      // Tab natural: avanza a siguiente celda
    enableCellTextSelection: true,
    ensureDomOrder: true,
    undoRedoCellEditing: true,     // Ctrl+Z funciona
    undoRedoCellEditingLimit: 50,
    rowHeight: 28,
    headerHeight: 32,
    animateRows: false,
    suppressCellFocus: false,
    rowSelection: 'multiple',
    suppressRowClickSelection: true,
    // Sin agrupar, sin paginación (todo en una hoja como Excel)
    suppressPaginationPanel: true,
    domLayout: 'normal',
    enableRangeSelection: false,
    clipboardDelimiter: '\t',      // Ctrl+C copia con tabs como Excel
  };

  readonly columnDefs: ColDef<RecepcionRow>[] = [
    // ── Número de fila (como Excel: columna A, B, C... pero con números) ──
    {
      headerName: '',
      colId: 'rowNumber',
      width: 45,
      maxWidth: 45,
      sortable: false,
      editable: false,
      suppressSizeToFit: true,
      cellClass: 'xl-rownum',
      headerClass: 'xl-header xl-corner',
      valueGetter: (p: ValueGetterParams<RecepcionRow>) => (p.node?.rowIndex ?? 0) + 1,
    },
    {
      headerName: '✓',
      field: 'recibido',
      width: 45,
      maxWidth: 45,
      editable: true,
      cellDataType: 'boolean',
      cellClass: 'xl-cell xl-center',
      headerClass: 'xl-header xl-center',
      headerTooltip: 'Marcar el ítem como recibido',
    },

    // ── Datos del producto (editables como Excel — libre movimiento) ──
    { headerName: 'Código', field: 'codigo_producto', width: 130 },
    { headerName: 'Producto', field: 'producto_nombre', width: 320, tooltipField: 'producto_nombre' },
    { headerName: 'Tipo', field: 'tipo_producto', width: 120 },
    { headerName: 'Forma Farm.', field: 'forma_farmaceutica', width: 140 },
    { headerName: 'Concentración', field: 'concentracion', width: 130 },
    { headerName: 'Unid. Empaque', field: 'unidad_empaque', width: 115 },
    {
      headerName: 'Cant. Solic.',
      field: 'cantidad_solicitada',
      width: 100,
      type: 'numericColumn',
      cellClass: 'xl-cell xl-num',
    },

    // ── Campos de recepción (editables) ──
    {
      headerName: 'Med. Vital',
      field: 'es_medicamento_vital',
      width: 85,
      cellDataType: 'boolean',
      cellClass: 'xl-cell xl-center',
      headerTooltip: 'Medicamento Vital No Disponible',
    },
    {
      headerName: 'Cód. Sanitario / CUM',
      field: 'codigo_sanitario',
      width: 175,
      cellRenderer: (p: any) => {
        const val = p.value ?? '';
        const row = p.data as RecepcionRow;
        let icon = '';
        if (row._validatingInvima) {
          icon = '<i class="pi pi-spin pi-spinner xl-invima-icon" style="color:#94a3b8"></i>';
        } else if (row._invimaValid === true) {
          icon = '<i class="pi pi-check-circle xl-invima-icon" style="color:#16a34a"></i>';
        } else if (row._invimaValid === false) {
          icon = '<i class="pi pi-times-circle xl-invima-icon" style="color:#dc2626"></i>';
        }
        return `<span class="xl-invima-wrap">${val}${icon}</span>`;
      },
    },
    {
      headerName: 'Estado INVIMA',
      field: 'estado_invima',
      width: 120,
      editable: false,
      cellClass: (p: CellClassParams<RecepcionRow>) => {
        const base = 'xl-cell xl-center';
        if (p.value === 'Vigente') return `${base} xl-tag-ok`;
        if (p.value === 'Vencido') return `${base} xl-tag-bad`;
        if (p.value) return `${base} xl-tag-warn`;
        return base;
      },
    },
    { headerName: 'Fabricante', field: 'fabricante', width: 200 },
    { headerName: 'Vida Útil', field: 'vida_util', width: 100 },
    {
      headerName: 'Fecha Vencimiento',
      field: 'fecha_vencimiento',
      width: 145,
      // Usar editor de texto simple — el agDateStringCellEditor no funciona bien en celdas compactas
      cellEditor: 'agTextCellEditor',
      cellEditorParams: { maxLength: 10 },
      valueFormatter: (p) => p.value || '',
      cellClass: (p: CellClassParams<RecepcionRow>) => {
        const base = 'xl-cell xl-center';
        const s = p.data?._semaforo;
        return s ? `${base} xl-semaforo-${s}` : base;
      },
      tooltipValueGetter: () => 'Formato: YYYY-MM-DD',
    },
    {
      headerName: 'Cant. Recibida',
      field: 'cantidad_recibida',
      width: 115,
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: { min: 0, precision: 0 },
      type: 'numericColumn',
      cellClass: 'xl-cell xl-num xl-strong',
    },
    {
      headerName: 'Muestra',
      field: 'muestra_poblacion',
      width: 90,
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: { min: 0, precision: 0 },
      type: 'numericColumn',
      cellClass: 'xl-cell xl-num',
    },
    { headerName: 'N. Lote', field: 'numero_lote', width: 130 },
    {
      headerName: 'Aspecto',
      field: 'aspecto_cumple',
      width: 110,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: CUMPLE_VALUES },
    },
    {
      headerName: 'Embalaje',
      field: 'embalaje_cumple',
      width: 110,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: CUMPLE_VALUES },
    },
    {
      headerName: 'Contenido',
      field: 'contenido_cumple',
      width: 110,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: CUMPLE_VALUES },
    },
    {
      headerName: 'Temp. °C',
      field: 'cadena_frio_temperatura',
      width: 90,
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: { precision: 1 },
      type: 'numericColumn',
      cellClass: 'xl-cell xl-num',
    },
    {
      headerName: 'Concepto',
      field: 'concepto_recepcion',
      width: 130,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: CONCEPTO_VALUES },
      cellClass: (p: CellClassParams<RecepcionRow>) => {
        const base = 'xl-cell xl-center';
        if (p.value === 'aceptado') return `${base} xl-tag-ok`;
        if (p.value === 'rechazado') return `${base} xl-tag-bad`;
        if (p.value === 'cuarentena') return `${base} xl-tag-warn`;
        return base;
      },
    },
    { headerName: 'Observaciones', field: 'observaciones_recepcion', width: 250 },
  ];

  // ─── Ciclo de vida ────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.compraId = Number(this.route.snapshot.paramMap.get('compraId') || 0);
    if (!this.compraId) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'Orden de compra no especificada.' });
      this.isLoading.set(false);
      return;
    }
    this.loadData();
  }

  // ─── Carga de datos ───────────────────────────────────────────────────────

  private loadData(): void {
    this.isLoading.set(true);
    this.inventarioService.getRecepcion(this.compraId).subscribe({
      next: (res: any) => {
        const items: RecepcionRow[] = (Array.isArray(res.data) ? res.data : []).map((item: any) => {
          const cantidad = Number(item.cantidad_solicitada_compra ?? item.cantidad_solicitada ?? 0);
          return {
            codigo_producto: item.codigo_producto || '',
            producto_nombre: item.producto_nombre || '',
            marca: item.marca || '',
            tipo_producto: item.tipo_producto || 'Medicamento',
            forma_farmaceutica: item.forma_farmaceutica || '',
            concentracion: item.concentracion || '',
            unidad_empaque: item.unidad_empaque || '',
            cantidad_solicitada: cantidad,
            es_medicamento_vital: false,
            codigo_sanitario: '',
            estado_invima: '',
            fabricante: '',
            vida_util: '',
            fecha_vencimiento: '',
            cantidad_recibida: cantidad,
            muestra_poblacion: null,
            numero_lote: '',
            aspecto_cumple: 'Cumple',
            embalaje_cumple: 'Cumple',
            contenido_cumple: 'Cumple',
            cadena_frio_temperatura: null,
            concepto_recepcion: 'aceptado',
            observaciones_recepcion: '',
            _validatingInvima: false,
            _invimaValid: null,
            _semaforo: '',
            pedido_detalle_id: item.pedido_detalle_id ?? item.id ?? null,
            recibido: true,
          } as RecepcionRow;
        });

        this.rowData = items;
        this.ordenInfo.set({
          numero: res.orden_numero || `OC-${this.compraId}`,
          proveedor: res.proveedor || items[0]?.marca || '',
          compraId: this.compraId,
        });
        this.recalcTotals();
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.msg.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la orden.' });
      },
    });
  }

  // ─── Eventos del grid ─────────────────────────────────────────────────────

  onGridReady(event: GridReadyEvent<RecepcionRow>): void {
    this.gridApi = event.api;
  }

  onCellValueChanged(event: CellValueChangedEvent<RecepcionRow>): void {
    const field = event.colDef.field;
    const row = event.data;

    if (field === 'codigo_sanitario') {
      this.validarInvima(row, event.rowIndex ?? 0);
    }

    if (field === 'fecha_vencimiento') {
      this.calcularSemaforo(row);
      this.gridApi?.refreshCells({ rowNodes: event.node ? [event.node] : undefined, force: true });
    }

    if (field === 'cantidad_recibida' || field === 'recibido' || field === 'concepto_recepcion') {
      this.recalcTotals();
    }
  }

  /** Recalcula los contadores del pie de página. */
  private recalcTotals(): void {
    this.totalItems.set(this.rowData.length);
    this.totalRecibidos.set(this.rowData.filter((r) => r.recibido && r.cantidad_recibida > 0).length);
    this.totalRechazados.set(this.rowData.filter((r) => r.concepto_recepcion === 'rechazado').length);
  }

  // ─── Validación INVIMA ────────────────────────────────────────────────────

  private validarInvima(row: RecepcionRow, rowIndex: number): void {
    const code = (row.codigo_sanitario ?? '').trim();
    if (!code || code.length < 5) {
      row.estado_invima = '';
      row._invimaValid = null;
      this.refreshRow(rowIndex);
      return;
    }

    row._validatingInvima = true;
    this.refreshRow(rowIndex);

    this.inventarioService.validateInvima(code).subscribe({
      next: (res: any) => {
        row._validatingInvima = false;
        if (res.success && res.data) {
          const d = res.data;
          row.estado_invima =
            d.status === 'active' ? 'Vigente' : d.status === 'expired' ? 'Vencido' : 'No encontrado';
          row._invimaValid = d.valid;
          if (d.laboratory) row.fabricante = d.laboratory;
          if (d.vida_util) row.vida_util = d.vida_util;
        } else {
          row.estado_invima = 'No encontrado';
          row._invimaValid = false;
        }
        this.refreshRow(rowIndex);
      },
      error: () => {
        row._validatingInvima = false;
        row.estado_invima = 'Error';
        row._invimaValid = null;
        this.refreshRow(rowIndex);
      },
    });
  }

  private refreshRow(rowIndex: number): void {
    const node = this.gridApi?.getDisplayedRowAtIndex(rowIndex);
    if (node) {
      this.gridApi?.refreshCells({ rowNodes: [node], force: true });
    }
  }

  // ─── Semáforo de vencimiento ──────────────────────────────────────────────

  private calcularSemaforo(row: RecepcionRow): void {
    if (!row.fecha_vencimiento) {
      row._semaforo = '';
      return;
    }
    const venc = new Date(row.fecha_vencimiento);
    if (Number.isNaN(venc.getTime())) {
      row._semaforo = '';
      return;
    }
    const hoy = new Date();
    const diffMeses = (venc.getFullYear() - hoy.getFullYear()) * 12 + (venc.getMonth() - hoy.getMonth());

    if (diffMeses <= 0) row._semaforo = 'rojo';
    else if (diffMeses <= 6) row._semaforo = 'amarillo';
    else row._semaforo = 'verde';
  }

  // ─── Acciones de la barra superior ────────────────────────────────────────

  /** Marca o desmarca todas las filas como recibidas. */
  toggleTodos(recibido: boolean): void {
    this.rowData.forEach((r) => (r.recibido = recibido));
    this.gridApi?.refreshCells({ force: true });
    this.recalcTotals();
  }

  /** Autoajusta el ancho de las columnas al contenido. */
  autoajustarColumnas(): void {
    this.gridApi?.autoSizeAllColumns();
  }

  /** Exporta la grilla actual a CSV (abre en Excel). */
  exportarCsv(): void {
    this.gridApi?.exportDataAsCsv({
      fileName: `recepcion_${this.ordenInfo()?.numero ?? this.compraId}.csv`,
      columnKeys: this.columnDefs
        .map((c) => (c as ColDef).field ?? (c as ColDef).colId ?? '')
        .filter((k) => k && k !== 'rowNumber'),
    });
  }

  cerrar(): void {
    // Si se abrió en pestaña nueva, cerrarla; si no, volver al listado.
    if (window.opener) {
      window.close();
    } else {
      this.router.navigate(['/inventario/farmacia/recepcionTecnica']);
    }
  }

  // ─── Guardar ──────────────────────────────────────────────────────────────

  guardar(): void {
    this.gridApi?.stopEditing();

    const items = this.rowData.filter((r) => r.recibido && r.cantidad_recibida > 0);

    if (items.length === 0) {
      this.msg.add({
        severity: 'warn',
        summary: 'Sin datos',
        detail: 'Marque al menos un producto como recibido.',
      });
      return;
    }

    const incompletos = items.filter((i) => !i.numero_lote || !i.fecha_vencimiento || !i.concepto_recepcion);
    if (incompletos.length > 0) {
      this.msg.add({
        severity: 'warn',
        summary: 'Campos faltantes',
        detail: `${incompletos.length} producto(s) sin Lote, Vencimiento o Concepto.`,
      });
      return;
    }

    this.isSaving.set(true);

    const payload = {
      compra_id: this.compraId,
      observaciones: this.observacionesGlobal(),
      items: items.map((r) => ({
        ...r,
        recibido: 1,
        _validatingInvima: undefined,
        _invimaValid: undefined,
        _semaforo: undefined,
      })),
    };

    this.inventarioService.createRecepcion(payload).subscribe({
      next: (res: any) => {
        this.isSaving.set(false);
        if (res.success) {
          this.msg.add({ severity: 'success', summary: 'Guardado', detail: res.message || 'Recepción guardada.' });
          setTimeout(() => this.cerrar(), 1500);
        } else {
          this.msg.add({ severity: 'error', summary: 'Error', detail: res.message || 'No se pudo guardar.' });
        }
      },
      error: (err: any) => {
        this.isSaving.set(false);
        this.msg.add({
          severity: 'error',
          summary: 'Error',
          detail: err?.error?.message || 'Error de conexión.',
        });
      },
    });
  }
}
