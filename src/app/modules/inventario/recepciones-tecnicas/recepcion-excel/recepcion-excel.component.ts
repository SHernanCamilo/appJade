import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import type {
  ColDef,
  ColGroupDef,
  GridApi,
  GridReadyEvent,
  CellValueChangedEvent,
  CellFocusedEvent,
  ValueGetterParams,
  CellClassParams,
  GridOptions,
} from 'ag-grid-community';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { InventarioService } from '../../../../core/services/inventario.service';
import { AG_GRID_LOCALE } from '../../../../core/config/ag-grid.config';

/** Fila del formulario de recepción técnica. */
interface RecepcionRow {
  codigo_producto: string;
  producto_nombre: string;
  marca: string;
  tipo_producto: string;
  forma_farmaceutica: string;
  concentracion: string;
  unidad_empaque: string;
  cantidad_solicitada: number;

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

  _validatingInvima: boolean;
  _invimaValid: boolean | null;
  _semaforo: 'verde' | 'amarillo' | 'rojo' | '';
  pedido_detalle_id: number | null;
  recibido: boolean;
}

const CUMPLE_VALUES = ['Cumple', 'No Cumple'];
const CONCEPTO_VALUES = ['', 'aceptado', 'cuarentena', 'rechazado'];

/** Convierte un índice 0-based en letra de columna estilo Excel (A, B, ... Z, AA, AB). */
function toColumnLetter(index: number): string {
  let letter = '';
  let n = index;
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

@Component({
  selector: 'app-recepcion-excel',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridAngular, ToastModule],
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

  // ── Contadores de la barra de estado ──
  readonly totalItems = signal(0);
  readonly totalRecibidos = signal(0);
  readonly totalRechazados = signal(0);
  readonly totalPendientes = computed(() => this.totalItems() - this.totalRecibidos());

  // ── Barra de fórmulas ──
  readonly activeCellRef = signal('A1');
  readonly activeCellValue = signal('');
  readonly activeCellEditable = signal(true);

  // ── Zoom ──
  readonly zoom = signal(100);
  private static readonly ZOOM_STEPS = [70, 80, 90, 100, 110, 125, 150];

  // ── Cinta de opciones ──
  readonly ribbonTabs = ['Archivo', 'Inicio', 'Datos', 'Revisar', 'Vista'];
  readonly activeRibbonTab = signal('Inicio');

  readonly localeText = AG_GRID_LOCALE;
  readonly sheetName = 'Recepción';

  rowData: RecepcionRow[] = [];

  private gridApi?: GridApi<RecepcionRow>;
  private compraId = 0;
  /** Mapa colId → letra de columna, para el cuadro de nombres. */
  private colLetters = new Map<string, string>();

  // ─── Configuración base del grid ──────────────────────────────────────────

  readonly defaultColDef: ColDef<RecepcionRow> = {
    resizable: true,
    sortable: true,
    suppressMovable: false,
    minWidth: 70,
    editable: true,
    cellClass: 'xl-cell',
  };

  readonly gridOptions: GridOptions<RecepcionRow> = {
    singleClickEdit: true,
    stopEditingWhenCellsLoseFocus: true,
    enterNavigatesVertically: true,
    enterNavigatesVerticallyAfterEdit: true,
    enableCellTextSelection: true,
    ensureDomOrder: true,
    undoRedoCellEditing: true,
    undoRedoCellEditingLimit: 50,
    rowHeight: 21,
    headerHeight: 21,
    groupHeaderHeight: 21,
    animateRows: false,
    suppressCellFocus: false,
    rowSelection: 'multiple',
    suppressRowClickSelection: true,
    suppressPaginationPanel: true,
    clipboardDelimiter: '\t',
    suppressMovableColumns: false,
  };

  /** Columnas de datos (sin la canaleta de números de fila). */
  private readonly dataColumns: ColDef<RecepcionRow>[] = [
    {
      headerName: '✓',
      field: 'recibido',
      width: 42,
      cellDataType: 'boolean',
      cellClass: 'xl-cell xl-center',
      headerTooltip: 'Marcar como recibido',
    },
    { headerName: 'Código', field: 'codigo_producto', width: 120 },
    { headerName: 'Producto', field: 'producto_nombre', width: 300, tooltipField: 'producto_nombre' },
    { headerName: 'Tipo', field: 'tipo_producto', width: 110 },
    { headerName: 'Forma Farm.', field: 'forma_farmaceutica', width: 130 },
    { headerName: 'Concentración', field: 'concentracion', width: 120 },
    { headerName: 'Unid. Empaque', field: 'unidad_empaque', width: 110 },
    {
      headerName: 'Cant. Solic.',
      field: 'cantidad_solicitada',
      width: 92,
      type: 'numericColumn',
      cellClass: 'xl-cell xl-num',
    },
    {
      headerName: 'Med. Vital',
      field: 'es_medicamento_vital',
      width: 78,
      cellDataType: 'boolean',
      cellClass: 'xl-cell xl-center',
      headerTooltip: 'Medicamento Vital No Disponible',
    },
    {
      headerName: 'Cód. Sanitario / CUM',
      field: 'codigo_sanitario',
      width: 165,
      cellRenderer: (p: any) => {
        const val = p.value ?? '';
        const row = p.data as RecepcionRow;
        let icon = '';
        if (row._validatingInvima) {
          icon = '<i class="pi pi-spin pi-spinner xl-invima-icon" style="color:#8a8886"></i>';
        } else if (row._invimaValid === true) {
          icon = '<i class="pi pi-check-circle xl-invima-icon" style="color:#107c10"></i>';
        } else if (row._invimaValid === false) {
          icon = '<i class="pi pi-times-circle xl-invima-icon" style="color:#d13438"></i>';
        }
        return `<span class="xl-invima-wrap"><span class="xl-invima-val">${val}</span>${icon}</span>`;
      },
    },
    {
      headerName: 'Estado INVIMA',
      field: 'estado_invima',
      width: 112,
      editable: false,
      cellClass: (p: CellClassParams<RecepcionRow>) => {
        const base = 'xl-cell xl-center xl-locked';
        if (p.value === 'Vigente') return `${base} xl-fill-ok`;
        if (p.value === 'Vencido') return `${base} xl-fill-bad`;
        if (p.value) return `${base} xl-fill-warn`;
        return base;
      },
    },
    { headerName: 'Fabricante', field: 'fabricante', width: 190 },
    { headerName: 'Vida Útil', field: 'vida_util', width: 88 },
    {
      headerName: 'Fecha Vencimiento',
      field: 'fecha_vencimiento',
      width: 132,
      cellEditor: 'agTextCellEditor',
      cellEditorParams: { maxLength: 10 },
      cellClass: (p: CellClassParams<RecepcionRow>) => {
        const base = 'xl-cell xl-center';
        const s = p.data?._semaforo;
        return s ? `${base} xl-fill-${s}` : base;
      },
      tooltipValueGetter: () => 'Formato: AAAA-MM-DD',
    },
    {
      headerName: 'Cant. Recibida',
      field: 'cantidad_recibida',
      width: 104,
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: { min: 0, precision: 0 },
      type: 'numericColumn',
      cellClass: 'xl-cell xl-num xl-strong',
    },
    {
      headerName: 'Muestra',
      field: 'muestra_poblacion',
      width: 80,
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: { min: 0, precision: 0 },
      type: 'numericColumn',
      cellClass: 'xl-cell xl-num',
    },
    { headerName: 'N. Lote', field: 'numero_lote', width: 118 },
    {
      headerName: 'Aspecto',
      field: 'aspecto_cumple',
      width: 100,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: CUMPLE_VALUES },
    },
    {
      headerName: 'Embalaje',
      field: 'embalaje_cumple',
      width: 100,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: CUMPLE_VALUES },
    },
    {
      headerName: 'Contenido',
      field: 'contenido_cumple',
      width: 100,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: CUMPLE_VALUES },
    },
    {
      headerName: 'Temp. °C',
      field: 'cadena_frio_temperatura',
      width: 82,
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: { precision: 1 },
      type: 'numericColumn',
      cellClass: 'xl-cell xl-num',
    },
    {
      headerName: 'Concepto',
      field: 'concepto_recepcion',
      width: 118,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: CONCEPTO_VALUES },
      cellClass: (p: CellClassParams<RecepcionRow>) => {
        const base = 'xl-cell xl-center';
        if (p.value === 'aceptado') return `${base} xl-fill-ok`;
        if (p.value === 'rechazado') return `${base} xl-fill-bad`;
        if (p.value === 'cuarentena') return `${base} xl-fill-warn`;
        return base;
      },
    },
    { headerName: 'Observaciones', field: 'observaciones_recepcion', width: 230 },
  ];

  /**
   * Estructura final: la canaleta de números de fila + cada columna envuelta en
   * un grupo cuyo encabezado es la letra (A, B, C...), igual que Excel.
   */
  readonly columnDefs: (ColDef<RecepcionRow> | ColGroupDef<RecepcionRow>)[] = [
    {
      headerName: '',
      colId: 'rowNumber',
      width: 40,
      maxWidth: 40,
      sortable: false,
      editable: false,
      resizable: false,
      suppressMovable: true,
      lockPosition: true,
      suppressSizeToFit: true,
      cellClass: 'xl-rownum',
      headerClass: 'xl-corner',
      valueGetter: (p: ValueGetterParams<RecepcionRow>) => (p.node?.rowIndex ?? 0) + 1,
    },
    ...this.dataColumns.map((col, i) => {
      const letter = toColumnLetter(i);
      const colId = (col.field as string) ?? `c${i}`;
      this.colLetters.set(colId, letter);
      return {
        headerName: letter,
        headerClass: 'xl-collabel',
        marryChildren: false,
        children: [{ ...col, colId, headerClass: 'xl-fieldname' }],
      } as ColGroupDef<RecepcionRow>;
    }),
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

  /** Actualiza el cuadro de nombres y la barra de fórmulas. */
  onCellFocused(event: CellFocusedEvent): void {
    const colId = (event.column as any)?.getColId?.() ?? '';
    const rowIndex = event.rowIndex ?? 0;

    if (!colId || colId === 'rowNumber') {
      this.activeCellEditable.set(false);
      this.activeCellValue.set('');
      return;
    }

    const letter = this.colLetters.get(colId) ?? '';
    this.activeCellRef.set(`${letter}${rowIndex + 1}`);

    const row = this.rowData[rowIndex];
    const raw = row ? (row as any)[colId] : '';
    this.activeCellValue.set(raw === null || raw === undefined ? '' : String(raw));

    const colDef = (event.column as any)?.getColDef?.();
    this.activeCellEditable.set(colDef?.editable !== false);
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

    // Reflejar el nuevo valor en la barra de fórmulas
    const raw = event.newValue;
    this.activeCellValue.set(raw === null || raw === undefined ? '' : String(raw));
  }

  /** Escribe en la celda activa desde la barra de fórmulas. */
  commitFormula(value: string): void {
    const cell = this.gridApi?.getFocusedCell();
    if (!cell) return;

    const colId = cell.column.getColId();
    if (colId === 'rowNumber') return;

    const node = this.gridApi?.getDisplayedRowAtIndex(cell.rowIndex);
    if (!node) return;

    node.setDataValue(colId, value);
  }

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

  // ─── Acciones de la cinta ─────────────────────────────────────────────────

  setRibbonTab(tab: string): void {
    this.activeRibbonTab.set(tab);
  }

  toggleTodos(recibido: boolean): void {
    this.rowData.forEach((r) => (r.recibido = recibido));
    this.gridApi?.refreshCells({ force: true });
    this.recalcTotals();
  }

  autoajustarColumnas(): void {
    this.gridApi?.autoSizeAllColumns();
  }

  exportarCsv(): void {
    this.gridApi?.exportDataAsCsv({
      fileName: `recepcion_${this.ordenInfo()?.numero ?? this.compraId}.csv`,
      columnKeys: this.dataColumns.map((c) => c.field as string).filter(Boolean),
    });
  }

  // ─── Zoom ─────────────────────────────────────────────────────────────────

  zoomIn(): void {
    const steps = RecepcionExcelComponent.ZOOM_STEPS;
    const idx = steps.indexOf(this.zoom());
    if (idx < steps.length - 1) this.setZoom(steps[idx + 1]);
  }

  zoomOut(): void {
    const steps = RecepcionExcelComponent.ZOOM_STEPS;
    const idx = steps.indexOf(this.zoom());
    if (idx > 0) this.setZoom(steps[idx - 1]);
  }

  resetZoom(): void {
    this.setZoom(100);
  }

  private setZoom(pct: number): void {
    this.zoom.set(pct);
    const scale = pct / 100;
    this.gridApi?.setGridOption('rowHeight', Math.round(21 * scale));
    this.gridApi?.resetRowHeights();
  }

  /** Escala tipográfica aplicada al grid vía variable CSS. */
  readonly gridFontSize = computed(() => `${(11 * this.zoom()) / 100}px`);

  // ─── Cerrar / Guardar ─────────────────────────────────────────────────────

  cerrar(): void {
    if (window.opener) {
      window.close();
    } else {
      this.router.navigate(['/inventario/farmacia/recepcionTecnica']);
    }
  }

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
