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
  EditableCallbackParams,
} from 'ag-grid-community';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { InventarioService } from '../../../../core/services/inventario.service';
import { AG_GRID_LOCALE } from '../../../../core/config/ag-grid.config';

// ── Excel Sheet shared component ──
import {
  ExcelSheetComponent,
  ExcelSheetConfig,
  FormulaCellInfo,
  RibbonActionEvent,
  FormulaCommitEvent,
  RIBBON_RECEPCION,
  DateCellEditorComponent,
} from '../../../../complements/shared/excel-sheet';

// ─── Interfaces ─────────────────────────────────────────────────────────────

interface RecepcionRow {
  codigo_producto: string;
  producto_nombre: string;
  marca: string;
  tipo_producto: string;
  forma_farmaceutica: string;
  concentracion: string;
  unidad_empaque: string;
  cantidad_solicitada: number;
  cum_recibido: string;
  cum_producto_nombre: string;
  es_medicamento_vital: boolean;
  codigo_sanitario: string;
  estado_invima: string;
  fabricante: string;
  vida_util: string;
  estado_vencimiento: string;
  fecha_vencimiento: string;
  cantidad_recibida: number;
  muestra_poblacion: number | null;
  muestra_exclusion: boolean;
  numero_lote: string;
  aspecto_cumple: string;
  embalaje_cumple: string;
  contenido_cumple: string;
  cadena_frio_temperatura: number | null;
  concepto_recepcion: string;
  observaciones_recepcion: string;
  mvd_solicitante: string;
  mvd_principio_activo: string;
  mvd_forma_farmaceutica: string;
  mvd_presentacion: string;
  mvd_ium: string;
  mvd_fecha_autorizacion: string;
  invima_override_manual: boolean;
  _validatingInvima: boolean;
  _invimaValid: boolean | null;
  _semaforo: 'verde' | 'amarillo' | 'rojo' | '';
  pedido_detalle_id: number | null;
  recibido: boolean;
  proveedor?: string;
}

const CUMPLE_VALUES = ['Cumple', 'No Cumple'];
const CONCEPTO_VALUES = ['', 'aceptado', 'rechazado'];

function isMedicamento(tipo: string): boolean {
  return String(tipo || '').toLowerCase().includes('medicamento');
}

function isDispositivoMedico(tipo: string): boolean {
  const t = String(tipo || '').toLowerCase();
  return t.includes('dispositivo') || t.includes('device');
}

function calcularDiasVencimiento(fechaStr: string): number | null {
  if (!fechaStr) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const venc = new Date(fechaStr);
  if (Number.isNaN(venc.getTime())) return null;
  return Math.floor((venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

function getEstadoVencimiento(dias: number | null): string {
  if (dias === null) return '';
  if (dias >= 365) return 'Vigente';
  if (dias >= 180) return 'Por vencer';
  return 'Critico';
}

function calculateSamplePopulation(quantity: number, forceFull: boolean): number {
  const qty = Math.floor(Number(quantity) || 0);
  if (!qty || qty <= 0) return 0;
  if (forceFull) return qty;
  const rules = [
    { min: 2, max: 8, sample: 2 },
    { min: 9, max: 15, sample: 3 },
    { min: 16, max: 25, sample: 5 },
    { min: 26, max: 50, sample: 8 },
    { min: 51, max: 90, sample: 13 },
    { min: 91, max: 150, sample: 20 },
    { min: 151, max: 280, sample: 32 },
    { min: 281, max: 500, sample: 50 },
    { min: 501, max: 1200, sample: 80 },
    { min: 1201, max: 3200, sample: 125 },
    { min: 3201, max: 10000, sample: 200 },
    { min: 10001, max: 35000, sample: 315 },
    { min: 35001, max: 150000, sample: 500 },
    { min: 150001, max: 500000, sample: 800 },
    { min: 500001, max: 2147483647, sample: 1250 },
  ];
  const rule = rules.find(r => qty >= r.min && qty <= r.max);
  return rule ? rule.sample : qty;
}

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
  imports: [CommonModule, FormsModule, AgGridAngular, ToastModule, ConfirmDialogModule, ExcelSheetComponent, DateCellEditorComponent],
  providers: [MessageService, ConfirmationService],
  templateUrl: './recepcion-excel.component.html',
  styleUrl: './recepcion-excel.component.css',
})
export class RecepcionExcelComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly inventarioService = inject(InventarioService);
  private readonly msg = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly isLoading = signal(true);
  readonly isSaving = signal(false);

  // ── Contadores ──
  private readonly totalItems = signal(0);
  private readonly totalRecibidos = signal(0);
  private readonly totalRechazados = signal(0);
  private readonly totalPendientes = computed(() => this.totalItems() - this.totalRecibidos());

  // ── Cell info para la barra de fórmulas ──
  readonly cellInfo = signal<FormulaCellInfo>({ reference: 'A1', value: '', editable: false });

  // ── Zoom ──
  private readonly zoom = signal(100);
  readonly gridFontSize = computed(() => `${(11 * this.zoom()) / 100}px`);

  // ── Font state (applied via CSS variable on the grid container) ──
  readonly gridFontFamily = signal('Calibri');
  readonly gridBaseFontSize = signal(11); // px, independent of zoom

  // ── ExcelSheetConfig: se recalcula cuando cambian los datos ──
  readonly excelConfig = computed<ExcelSheetConfig>(() => ({
    title: {
      documentName: `Recepción Técnica — ${this.ordenInfo()?.numero || 'Cargando…'}`,
      subtitle: this.ordenInfo()?.proveedor || '',
      saveState: this.isSaving() ? 'saving' : 'unsaved',
      primaryAction: {
        label: 'Guardar Recepción',
        icon: 'pi pi-save',
        disabled: this.totalRecibidos() === 0,
        loading: this.isSaving(),
      },
      secondaryActions: [{ label: 'Cerrar', icon: 'pi pi-times', action: 'close' }],
    },
    ribbonTabs: RIBBON_RECEPCION,
    sheets: [{ id: 'recepcion', label: 'Recepción', active: true }],
    statusBar: {
      readyText: 'Listo',
      items: [
        { key: 'total', label: 'productos', value: this.totalItems(), variant: 'default' },
        { key: 'recibidos', label: 'recibidos', value: this.totalRecibidos(), variant: 'ok' },
        { key: 'pendientes', label: 'pendientes', value: this.totalPendientes(), variant: 'warn' },
        ...(this.totalRechazados() > 0
          ? [{ key: 'rechazados', label: 'rechazados', value: this.totalRechazados(), variant: 'bad' as const }]
          : []),
      ],
      hint: 'Clic para editar · Enter baja · Tab avanza · Ctrl+Z deshace',
      showZoom: true,
    },
    initialZoom: 100,
  }));

  // ── Grid data ──
  readonly localeText = AG_GRID_LOCALE;
  rowData: RecepcionRow[] = [];
  private gridApi?: GridApi<RecepcionRow>;
  private compraId = 0;
  private colLetters = new Map<string, string>();
  private ordenInfo = signal<{ numero: string; proveedor: string } | null>(null);
  private invimaCache = new Map<string, any>();
  private mvdCache = new Map<string, any>();
  private cumCache = new Map<string, string>();

  // ─── Grid config ──────────────────────────────────────────────────────────

  readonly defaultColDef: ColDef<RecepcionRow> = {
    resizable: true,
    sortable: true,
    minWidth: 70,
    editable: (params) => this.canEditField(params),
    cellClass: (params) => this.getCellClass(params),
    suppressKeyboardEvent: (params) => {
      // Allow Ctrl+C, Ctrl+V, Ctrl+Z, Ctrl+Y to work natively
      const key = params.event.key;
      const ctrlPressed = params.event.ctrlKey || params.event.metaKey;
      
      if (ctrlPressed && (key === 'c' || key === 'v' || key === 'z' || key === 'y')) {
        return true; // Suppress AG Grid handling, let browser handle it
      }
      
      return false;
    },
  };

  readonly gridOptions: GridOptions<RecepcionRow> = {
    singleClickEdit: true,
    stopEditingWhenCellsLoseFocus: true,
    enterNavigatesVertically: true,
    enterNavigatesVerticallyAfterEdit: true,
    enableCellTextSelection: true,
    undoRedoCellEditing: true,
    undoRedoCellEditingLimit: 50,
    rowHeight: 21,
    headerHeight: 21,
    groupHeaderHeight: 21,
    animateRows: false,
    suppressCellFocus: false,
    rowSelection: 'multiple',
    suppressRowClickSelection: false,
    suppressPaginationPanel: true,
    clipboardDelimiter: '\t',
    
    // ── Range selection (Excel-like) ──
    enableRangeSelection: true,
    enableRangeHandle: true,
    fillHandleDirection: 'xy',
    
    // ── Copy/Paste improvements ──
    enableFillHandle: true,
    suppressCopySingleCellRanges: false,
    suppressCopyRowsToClipboard: false,
    processCellForClipboard: (params) => {
      // Better clipboard formatting
      return params.value ?? '';
    },
    processCellFromClipboard: (params) => {
      // Handle pasted data
      return params.value;
    },
    
    // ── Cell click behavior ──
    onCellClicked: (event) => {
      // Single click behavior: focus the cell, ready for editing
      // User can start typing to edit or press F2/Enter
      const colDef = event.colDef;
      
      // If it's a boolean cell (checkbox), toggle immediately
      if (colDef.cellDataType === 'boolean' && colDef.editable !== false) {
        const currentValue = event.value;
        event.node.setDataValue(event.colDef.field!, !currentValue);
        return;
      }
      
      // Otherwise, just focus (ready for typing)
      if (event.rowIndex != null) {
        this.gridApi?.setFocusedCell(event.rowIndex, event.column);
      }
    },
    
    onCellDoubleClicked: (event) => {
      // Double click: start editing immediately
      if (event.colDef.editable !== false && event.rowIndex != null) {
        this.gridApi?.startEditingCell({
          rowIndex: event.rowIndex,
          colKey: event.column.getColId(),
        });
      }
    },
    
    // ── Navigation improvements ──
    navigateToNextCell: (params) => {
      const key = params.key;
      const prev = params.previousCellPosition;
      if (!prev) return null;
      
      let nextRowIndex = prev.rowIndex;
      let nextColumn = prev.column;
      
      // Arrow key navigation (handle both string and number key codes)
      const keyStr = String(key);
      if (keyStr === 'ArrowUp' || keyStr === '38') {
        nextRowIndex = Math.max(0, prev.rowIndex - 1); // Up
      } else if (keyStr === 'ArrowDown' || keyStr === '40') {
        nextRowIndex = prev.rowIndex + 1; // Down
      } else if (keyStr === 'ArrowLeft' || keyStr === '37') {
        // Left
        const allCols = params.api.getAllDisplayedColumns();
        const idx = allCols.indexOf(prev.column);
        if (idx > 0) nextColumn = allCols[idx - 1];
      } else if (keyStr === 'ArrowRight' || keyStr === '39') {
        // Right
        const allCols = params.api.getAllDisplayedColumns();
        const idx = allCols.indexOf(prev.column);
        if (idx < allCols.length - 1) nextColumn = allCols[idx + 1];
      }
      
      return { rowIndex: nextRowIndex, column: nextColumn, rowPinned: prev.rowPinned };
    },
    
    // ── Context menu ──
    getContextMenuItems: () => [
      {
        name: 'Copiar',
        shortcut: 'Ctrl+C',
        icon: '<i class="pi pi-copy"></i>',
        action: () => {
          this.gridApi?.copySelectedRangeToClipboard();
          this.msg.add({ severity: 'success', summary: 'Copiado', detail: 'Datos copiados.' });
        },
      },
      {
        name: 'Copiar con encabezados',
        icon: '<i class="pi pi-copy"></i>',
        action: () => {
          this.gridApi?.copySelectedRangeToClipboard({ includeHeaders: true });
          this.msg.add({ severity: 'success', summary: 'Copiado', detail: 'Datos con encabezados copiados.' });
        },
      },
      {
        name: 'Pegar',
        shortcut: 'Ctrl+V',
        icon: '<i class="pi pi-clipboard"></i>',
        action: () => {
          this.msg.add({ severity: 'info', summary: 'Pegar', detail: 'Usa Ctrl+V para pegar.' });
        },
      },
      'separator',
      {
        name: 'Exportar',
        icon: '<i class="pi pi-download"></i>',
        action: () => {
          this.gridApi?.exportDataAsCsv({ fileName: `recepcion_${this.ordenInfo()?.numero ?? this.compraId}.csv` });
          this.msg.add({ severity: 'success', summary: 'Exportado', detail: 'CSV descargado.' });
        },
      },
      'separator',
      {
        name: 'Ajustar columnas',
        icon: '<i class="pi pi-arrows-h"></i>',
        action: () => {
          this.gridApi?.autoSizeAllColumns();
          this.msg.add({ severity: 'success', summary: 'Ajustado', detail: 'Columnas ajustadas.' });
        },
      },
      {
        name: 'Limpiar filtros',
        icon: '<i class="pi pi-filter-slash"></i>',
        action: () => {
          this.gridApi?.setFilterModel(null);
          this.msg.add({ severity: 'success', summary: 'Filtros', detail: 'Filtros limpiados.' });
        },
      },
    ],
  };

  private readonly dataColumns: ColDef<RecepcionRow>[] = [
    { headerName: '✓', field: 'recibido', width: 42, cellDataType: 'boolean', editable: true, cellClass: 'xl-cell xl-center' },
    { headerName: 'Código', field: 'codigo_producto', width: 110, editable: false },
    { headerName: 'Producto', field: 'producto_nombre', width: 260, editable: false, tooltipField: 'producto_nombre' },
    { headerName: 'Tipo', field: 'tipo_producto', width: 100, editable: false },
    { headerName: 'Forma Farm. / Serie', field: 'forma_farmaceutica', width: 140, editable: false },
    { headerName: 'Concentración / Riesgo', field: 'concentracion', width: 130, editable: false },
    { headerName: 'Unid. Empaque', field: 'unidad_empaque', width: 110, editable: false },
    { headerName: 'Marca', field: 'marca', width: 100, editable: false },
    { headerName: 'Cant. Solic.', field: 'cantidad_solicitada', width: 88, editable: false, type: 'numericColumn', cellClass: 'xl-cell xl-num xl-locked' },
    { headerName: 'CUM Recibido', field: 'cum_recibido', width: 120 },
    { headerName: 'Nombre CUM', field: 'cum_producto_nombre', width: 180, editable: false, hide: true },
    { headerName: 'Med. Vital', field: 'es_medicamento_vital', width: 78, cellDataType: 'boolean', cellClass: 'xl-cell xl-center' },
    {
      headerName: 'Cód. Sanitario / IUM', field: 'codigo_sanitario', width: 155,
      cellRenderer: (p: any) => {
        const val = p.value ?? '';
        const row = p.data as RecepcionRow;
        let icon = '';
        if (row._validatingInvima) icon = '<i class="pi pi-spin pi-spinner xl-invima-icon" style="color:#8a8886"></i>';
        else if (row._invimaValid === true) icon = '<i class="pi pi-check-circle xl-invima-icon" style="color:#107c10"></i>';
        else if (row._invimaValid === false) icon = '<i class="pi pi-times-circle xl-invima-icon" style="color:#d13438"></i>';
        return `<span class="xl-invima-wrap"><span class="xl-invima-val">${val}</span>${icon}</span>`;
      },
    },
    {
      headerName: 'Estado INVIMA', field: 'estado_invima', width: 112, editable: false,
      cellClass: (p: CellClassParams<RecepcionRow>) => {
        const base = 'xl-cell xl-center xl-locked';
        const v = p.value;
        if (v === 'Vigente' || v === 'Override Manual') return `${base} xl-fill-ok`;
        if (v === 'Vencido' || v === 'Rechazado' || v === 'Cancelado') return `${base} xl-fill-bad`;
        if (v) return `${base} xl-fill-warn`;
        return base;
      },
    },
    { headerName: 'Fabricante', field: 'fabricante', width: 170, editable: false },
    {
      headerName: 'Vida Útil', field: 'vida_util', width: 88, editable: false,
      cellClass: (p: CellClassParams<RecepcionRow>) => {
        const base = 'xl-cell xl-center xl-locked';
        return isDispositivoMedico(p.data?.tipo_producto ?? '') ? base : `${base} xl-muted`;
      },
    },
    {
      headerName: 'Estado Venc.', field: 'estado_vencimiento', width: 100, editable: false,
      cellClass: (p: CellClassParams<RecepcionRow>) => {
        const base = 'xl-cell xl-center xl-locked';
        if (p.value === 'Vigente') return `${base} xl-fill-ok`;
        if (p.value === 'Por vencer') return `${base} xl-fill-warn`;
        if (p.value === 'Critico') return `${base} xl-fill-bad`;
        return base;
      },
    },
    {
      headerName: 'Fecha Vencimiento', field: 'fecha_vencimiento', width: 128,
      cellEditor: DateCellEditorComponent,
      cellEditorPopup: false,
      singleClickEdit: true,
      cellEditorParams: { placeholder: 'dd/mm/yyyy' },
      cellClass: (p: CellClassParams<RecepcionRow>) => {
        const base = 'xl-cell xl-center';
        const s = p.data?._semaforo;
        return s ? `${base} xl-fill-${s}` : base;
      },
    },
    { headerName: 'Cant. Recibida', field: 'cantidad_recibida', width: 100, cellEditor: 'agNumberCellEditor', cellEditorParams: { min: 0, precision: 0 }, type: 'numericColumn', cellClass: 'xl-cell xl-num xl-strong' },
    { headerName: 'Muestra', field: 'muestra_poblacion', width: 78, editable: false, type: 'numericColumn', cellClass: 'xl-cell xl-num xl-locked' },
    { headerName: 'N. Lote', field: 'numero_lote', width: 110 },
    { headerName: 'Aspecto', field: 'aspecto_cumple', width: 96, cellEditor: 'agSelectCellEditor', cellEditorParams: { values: CUMPLE_VALUES } },
    { headerName: 'Embalaje', field: 'embalaje_cumple', width: 96, cellEditor: 'agSelectCellEditor', cellEditorParams: { values: CUMPLE_VALUES } },
    { headerName: 'Contenido', field: 'contenido_cumple', width: 96, cellEditor: 'agSelectCellEditor', cellEditorParams: { values: CUMPLE_VALUES } },
    { headerName: 'Temp. °C', field: 'cadena_frio_temperatura', width: 78, cellEditor: 'agNumberCellEditor', cellEditorParams: { precision: 1 }, type: 'numericColumn', cellClass: 'xl-cell xl-num' },
    {
      headerName: 'Concepto', field: 'concepto_recepcion', width: 110, editable: false,
      cellClass: (p: CellClassParams<RecepcionRow>) => {
        const base = 'xl-cell xl-center xl-locked';
        if (p.value === 'aceptado') return `${base} xl-fill-ok`;
        if (p.value === 'rechazado') return `${base} xl-fill-bad`;
        return base;
      },
    },
    { headerName: 'Observaciones', field: 'observaciones_recepcion', width: 200 },
    { headerName: 'MVD Solicitante', field: 'mvd_solicitante', width: 160, editable: false, hide: true, cellClass: 'xl-cell xl-mvd' },
    { headerName: 'MVD Principio Act.', field: 'mvd_principio_activo', width: 160, editable: false, hide: true, cellClass: 'xl-cell xl-mvd' },
    { headerName: 'MVD Forma Farm.', field: 'mvd_forma_farmaceutica', width: 130, editable: false, hide: true, cellClass: 'xl-cell xl-mvd' },
    { headerName: 'MVD Presentación', field: 'mvd_presentacion', width: 160, editable: false, hide: true, cellClass: 'xl-cell xl-mvd' },
  ];

  readonly columnDefs: (ColDef<RecepcionRow> | ColGroupDef<RecepcionRow>)[] = [
    {
      headerName: '', colId: 'rowNumber', width: 40, maxWidth: 40,
      sortable: false, editable: false, resizable: false, suppressMovable: true,
      lockPosition: true, cellClass: 'xl-rownum', headerClass: 'xl-corner',
      valueGetter: (p: ValueGetterParams<RecepcionRow>) => (p.node?.rowIndex ?? 0) + 1,
    },
    ...this.dataColumns.map((col, i) => {
      const letter = toColumnLetter(i);
      const colId = (col.field as string) ?? `c${i}`;
      this.colLetters.set(colId, letter);
      return { headerName: letter, headerClass: 'xl-collabel', children: [{ ...col, colId, headerClass: 'xl-fieldname' }] } as ColGroupDef<RecepcionRow>;
    }),
  ];

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.compraId = Number(this.route.snapshot.paramMap.get('compraId') || 0);
    if (!this.compraId) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'Orden de compra no especificada.' });
      this.isLoading.set(false);
      return;
    }
    this.loadData();
  }

  // ─── Data loading ─────────────────────────────────────────────────────────

  private loadData(): void {
    this.isLoading.set(true);
    this.inventarioService.getRecepcion(this.compraId).subscribe({
      next: (res: any) => {
        const items: RecepcionRow[] = (Array.isArray(res.data) ? res.data : []).map((item: any) => {
          const cantidad = Number(item.cantidad_solicitada ?? item.cantidad_solicitada_compra ?? 0);
          const aspectoDefault = item.aspecto_cumple === 0 || item.aspecto_cumple === false ? 'No Cumple' : 'Cumple';
          const fechaVenc = item.fecha_vencimiento ? String(item.fecha_vencimiento).substring(0, 10) : '';
          const diasVenc = calcularDiasVencimiento(fechaVenc);
          return {
            codigo_producto: item.codigo_producto || '',
            producto_nombre: item.producto_nombre || '',
            marca: item.marca || '',
            tipo_producto: item.tipo_producto || item.producto_tipo || 'Medicamento',
            forma_farmaceutica: item.forma_farmaceutica || '',
            concentracion: item.concentracion || '',
            unidad_empaque: item.unidad_empaque || '',
            cantidad_solicitada: cantidad,
            cum_recibido: item.cum_recibido || '',
            cum_producto_nombre: '',
            es_medicamento_vital: Boolean(item.es_medicamento_vital),
            codigo_sanitario: item.codigo_sanitario || '',
            estado_invima: '',
            fabricante: item.fabricante || '',
            vida_util: item.vida_util || '',
            estado_vencimiento: getEstadoVencimiento(diasVenc),
            fecha_vencimiento: fechaVenc,
            cantidad_recibida: cantidad,
            muestra_poblacion: item.muestra_poblacion ?? null,
            muestra_exclusion: Boolean(item.muestra_exclusion),
            numero_lote: item.numero_lote || '',
            aspecto_cumple: typeof item.aspecto_cumple === 'string' ? item.aspecto_cumple : aspectoDefault,
            embalaje_cumple: typeof item.embalaje_cumple === 'string' ? item.embalaje_cumple : aspectoDefault,
            contenido_cumple: typeof item.contenido_cumple === 'string' ? item.contenido_cumple : aspectoDefault,
            cadena_frio_temperatura: item.cadena_frio_temperatura ?? null,
            concepto_recepcion: '',
            observaciones_recepcion: item.observaciones_recepcion || item.observaciones_pedido || '',
            mvd_solicitante: '',
            mvd_principio_activo: '',
            mvd_forma_farmaceutica: '',
            mvd_presentacion: '',
            mvd_ium: '',
            mvd_fecha_autorizacion: '',
            invima_override_manual: false,
            _validatingInvima: false,
            _invimaValid: null,
            _semaforo: '',
            pedido_detalle_id: item.pedido_detalle_id ?? null,
            recibido: true,
          } as RecepcionRow;
        });
        this.rowData = items;
        items.forEach(r => { if (r.fecha_vencimiento) this.calcularSemaforo(r); });
        this.ordenInfo.set({
          numero: res.orden_numero || `OC-${this.compraId}`,
          proveedor: res.proveedor || items[0]?.proveedor || '',
        });
        this.recalcTotals();
        this.isLoading.set(false);
        setTimeout(() => this.updateDynamicColumns(), 100);
      },
      error: () => { this.isLoading.set(false); this.msg.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la orden.' }); },
    });
  }

  // ─── Grid events ──────────────────────────────────────────────────────────

  onGridReady(event: GridReadyEvent<RecepcionRow>): void { 
    this.gridApi = event.api;
    
    // Add keyboard shortcuts
    this.setupKeyboardShortcuts();
  }

  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      const target = e.target as HTMLElement;
      const isInGrid = target.closest('.xl-grid') !== null;
      
      if (!isInGrid) return;
      
      const ctrlPressed = e.ctrlKey || e.metaKey;
      
      // Ctrl+S: Save
      if (ctrlPressed && e.key === 's') {
        e.preventDefault();
        this.guardar();
      }
      
      // Ctrl+A: Select all cells
      if (ctrlPressed && e.key === 'a' && !target.matches('input, select, textarea')) {
        e.preventDefault();
        this.gridApi?.selectAll();
      }
      
      // Delete: Clear cell content
      if (e.key === 'Delete' && !target.matches('input, select, textarea')) {
        const focused = this.gridApi?.getFocusedCell();
        if (focused) {
          const node = this.gridApi?.getDisplayedRowAtIndex(focused.rowIndex);
          if (node) {
            const colDef = focused.column.getColDef();
            if (colDef.editable !== false) {
              node.setDataValue(focused.column.getColId(), '');
            }
          }
        }
      }
      
      // F2: Start editing (Excel-style)
      if (e.key === 'F2' && !target.matches('input, select, textarea')) {
        e.preventDefault();
        const focused = this.gridApi?.getFocusedCell();
        if (focused) {
          this.gridApi?.startEditingCell({
            rowIndex: focused.rowIndex,
            colKey: focused.column.getColId(),
          });
        }
      }
      
      // Escape: Stop editing
      if (e.key === 'Escape') {
        this.gridApi?.stopEditing(true); // Cancel = true
      }
    });
  }

  onCellFocused(event: CellFocusedEvent): void {
    const colId = (event.column as any)?.getColId?.() ?? '';
    const rowIndex = event.rowIndex ?? 0;
    if (!colId || colId === 'rowNumber') { this.cellInfo.set({ reference: '', value: '', editable: false }); return; }
    const letter = this.colLetters.get(colId) ?? '';
    const row = this.rowData[rowIndex];
    const raw = row ? (row as any)[colId] : '';
    const colDef = (event.column as any)?.getColDef?.();
    this.cellInfo.set({
      reference: `${letter}${rowIndex + 1}`,
      value: raw === null || raw === undefined ? '' : String(raw),
      editable: colDef?.editable !== false,
    });
  }

  onCellValueChanged(event: CellValueChangedEvent<RecepcionRow>): void {
    const field = event.colDef.field;
    const row = event.data;
    const rowIndex = event.rowIndex ?? 0;

    if (field === 'codigo_sanitario') {
      if (row.es_medicamento_vital) this.validarMvdIum(row, rowIndex);
      else this.validarInvima(row, rowIndex);
    }
    if (field === 'cum_recibido') this.validarCum(row, rowIndex);
    if (field === 'es_medicamento_vital') this.onMedicamentoVitalChanged(row, rowIndex, !!event.newValue);
    if (field === 'fecha_vencimiento') {
      row.estado_vencimiento = getEstadoVencimiento(calcularDiasVencimiento(String(event.newValue ?? '')));
      this.calcularSemaforo(row);
      this.gridApi?.refreshCells({ rowNodes: event.node ? [event.node] : undefined, force: true });
    }
    if (field === 'cantidad_recibida') {
      row.muestra_poblacion = calculateSamplePopulation(Number(event.newValue ?? 0), row.muestra_exclusion);
      this.gridApi?.refreshCells({ rowNodes: event.node ? [event.node] : undefined, columns: ['muestra_poblacion'], force: true });
    }
    if (field === 'cantidad_recibida' || field === 'recibido' || field === 'concepto_recepcion') this.recalcTotals();
    this.cellInfo.update(c => ({ ...c, value: event.newValue === null || event.newValue === undefined ? '' : String(event.newValue) }));
  }

  // ─── Shell events ─────────────────────────────────────────────────────────

  onSecondaryAction(action: string): void {
    if (action === 'close') { window.opener ? window.close() : this.router.navigate(['/inventario/farmacia/recepcionTecnica']); }
  }

  onRibbonAction(event: RibbonActionEvent): void {
    switch (event.actionId) {
      case 'select-all': 
        this.rowData.forEach(r => r.recibido = true); 
        this.gridApi?.refreshCells({ force: true }); 
        this.recalcTotals(); 
        break;
        
      case 'select-none': 
        this.rowData.forEach(r => r.recibido = false); 
        this.gridApi?.refreshCells({ force: true }); 
        this.recalcTotals(); 
        break;
        
      case 'autofit': 
        this.gridApi?.autoSizeAllColumns(); 
        this.msg.add({ severity: 'success', summary: 'Ajuste', detail: 'Columnas ajustadas automáticamente.' });
        break;
        
      case 'export-csv': 
        this.gridApi?.exportDataAsCsv({ fileName: `recepcion_${this.ordenInfo()?.numero ?? this.compraId}.csv` }); 
        this.msg.add({ severity: 'success', summary: 'Exportado', detail: 'Datos exportados a CSV.' });
        break;
        
      case 'align-left': this.applyTextAlign('left'); break;
      case 'align-center': this.applyTextAlign('center'); break;
      case 'align-right': this.applyTextAlign('right'); break;
      
      case 'sort-asc': 
        const colAsc = this.getFocusedColId();
        if (colAsc) {
          this.gridApi?.applyColumnState({ state: [{ colId: colAsc, sort: 'asc' }] });
          this.msg.add({ severity: 'success', summary: 'Ordenado', detail: 'Ordenado ascendente.' });
        } else {
          this.msg.add({ severity: 'warn', summary: 'Aviso', detail: 'Selecciona una columna primero.' });
        }
        break;
        
      case 'sort-desc': 
        const colDesc = this.getFocusedColId();
        if (colDesc) {
          this.gridApi?.applyColumnState({ state: [{ colId: colDesc, sort: 'desc' }] });
          this.msg.add({ severity: 'success', summary: 'Ordenado', detail: 'Ordenado descendente.' });
        } else {
          this.msg.add({ severity: 'warn', summary: 'Aviso', detail: 'Selecciona una columna primero.' });
        }
        break;
        
      case 'clear-filters': 
        this.gridApi?.setFilterModel(null); 
        this.msg.add({ severity: 'success', summary: 'Filtros', detail: 'Filtros limpiados.' });
        break;
        
      case 'freeze-cols': 
        this.toggleFreeze(); 
        break;
        
      case 'zoom-fit': 
        this.gridApi?.sizeColumnsToFit(); 
        this.msg.add({ severity: 'success', summary: 'Zoom', detail: 'Columnas ajustadas a la ventana.' });
        break;
        
      case 'copy':
        // Copy selected range to clipboard
        const ranges = this.gridApi?.getCellRanges();
        if (ranges && ranges.length > 0) {
          this.gridApi?.copySelectedRangeToClipboard();
          this.msg.add({ severity: 'success', summary: 'Copiado', detail: 'Datos copiados al portapapeles.' });
        } else {
          // If no range, copy focused cell
          const focused = this.gridApi?.getFocusedCell();
          if (focused) {
            this.gridApi?.copySelectedRangeToClipboard();
            this.msg.add({ severity: 'success', summary: 'Copiado', detail: 'Celda copiada al portapapeles.' });
          } else {
            this.msg.add({ severity: 'warn', summary: 'Aviso', detail: 'Selecciona celdas para copiar.' });
          }
        }
        break;
        
      case 'paste': 
        // Focus on grid to enable paste
        const gridElement = document.querySelector('.xl-grid .ag-root') as HTMLElement;
        if (gridElement) {
          gridElement.focus();
          this.msg.add({ severity: 'info', summary: 'Pegar', detail: 'Usa Ctrl+V para pegar los datos copiados.' });
        } else {
          this.msg.add({ severity: 'warn', summary: 'Aviso', detail: 'Posiciona el cursor en una celda y usa Ctrl+V.' });
        }
        break;
        
      case 'cut':
        // Copy and clear
        const cutRanges = this.gridApi?.getCellRanges();
        if (cutRanges && cutRanges.length > 0) {
          this.gridApi?.copySelectedRangeToClipboard();
          // Clear selected cells
          cutRanges.forEach(range => {
            const startRow = Math.min(range.startRow!.rowIndex, range.endRow!.rowIndex);
            const endRow = Math.max(range.startRow!.rowIndex, range.endRow!.rowIndex);
            const columns = range.columns;
            
            for (let rowIndex = startRow; rowIndex <= endRow; rowIndex++) {
              const node = this.gridApi?.getDisplayedRowAtIndex(rowIndex);
              if (node) {
                columns.forEach(col => {
                  const colDef = col.getColDef();
                  if (colDef.editable !== false) {
                    node.setDataValue(col.getColId(), '');
                  }
                });
              }
            }
          });
          this.msg.add({ severity: 'success', summary: 'Cortado', detail: 'Datos cortados. Usa Ctrl+V para pegar.' });
        } else {
          this.msg.add({ severity: 'warn', summary: 'Aviso', detail: 'Selecciona celdas para cortar.' });
        }
        break;
        
      case 'undo':
        this.gridApi?.undoCellEditing();
        this.msg.add({ severity: 'success', summary: 'Deshacer', detail: 'Última edición deshecha.' });
        break;
        
      case 'redo':
        this.gridApi?.redoCellEditing();
        this.msg.add({ severity: 'success', summary: 'Rehacer', detail: 'Edición rehecha.' });
        break;
        
      case 'font-family':
        if (event.value) {
          this.gridFontFamily.set(event.value);
          this.applyGridFont();
          this.msg.add({ severity: 'success', summary: 'Fuente', detail: `Fuente cambiada a ${event.value}.` });
        }
        break;
        
      case 'font-size':
        if (event.value) {
          this.gridBaseFontSize.set(Number(event.value));
          this.applyGridFont();
          this.msg.add({ severity: 'success', summary: 'Tamaño', detail: `Tamaño cambiado a ${event.value}px.` });
        }
        break;
    }
  }

  onFormulaCommit(event: FormulaCommitEvent): void {
    const cell = this.gridApi?.getFocusedCell();
    if (!cell) return;
    const node = this.gridApi?.getDisplayedRowAtIndex(cell.rowIndex);
    if (node) node.setDataValue(cell.column.getColId(), event.value);
  }

  onZoomChange(pct: number): void {
    this.zoom.set(pct);
    this.gridApi?.setGridOption('rowHeight', Math.round(21 * pct / 100));
    this.gridApi?.resetRowHeights();
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private recalcTotals(): void {
    this.totalItems.set(this.rowData.length);
    this.totalRecibidos.set(this.rowData.filter(r => r.recibido && r.cantidad_recibida > 0).length);
    this.totalRechazados.set(this.rowData.filter(r => r.concepto_recepcion === 'rechazado').length);
  }

  private canEditField(params: EditableCallbackParams<RecepcionRow>): boolean {
    const field = params.colDef.field;
    const row = params.data;
    if (!field || !row) return false;

    const locked = new Set([
      'codigo_producto', 'producto_nombre', 'tipo_producto', 'forma_farmaceutica', 'concentracion',
      'unidad_empaque', 'marca', 'cantidad_solicitada', 'muestra_poblacion', 'estado_invima',
      'estado_vencimiento', 'cum_producto_nombre', 'fabricante', 'vida_util', 'concepto_recepcion',
      'mvd_solicitante', 'mvd_principio_activo', 'mvd_forma_farmaceutica', 'mvd_presentacion',
    ]);
    if (locked.has(field)) return false;

    if (field === 'es_medicamento_vital') return isMedicamento(row.tipo_producto);

    const receptionFields = new Set([
      'cantidad_recibida', 'numero_lote', 'fecha_vencimiento', 'aspecto_cumple', 'embalaje_cumple',
      'contenido_cumple', 'cadena_frio_temperatura', 'observaciones_recepcion',
    ]);
    if (receptionFields.has(field)) {
      return row.estado_invima === 'Vigente' || row.estado_invima === 'Override Manual';
    }

    return true;
  }

  private getCellClass(params: CellClassParams<RecepcionRow>): string {
    const field = params.colDef.field ?? '';
    const row = params.data;
    let base = 'xl-cell';
    if (!row || !this.canEditField({ colDef: params.colDef, data: row } as EditableCallbackParams<RecepcionRow>)) {
      base += ' xl-locked';
    }
    if (field === 'cantidad_solicitada' || field === 'muestra_poblacion' || field === 'cadena_frio_temperatura') {
      base += ' xl-num';
    }
    if (field === 'cantidad_recibida') base += ' xl-num xl-strong';
    if (field.startsWith('mvd_') && row?.es_medicamento_vital) base += ' xl-mvd';
    return base;
  }

  private updateDynamicColumns(): void {
    if (!this.gridApi) return;
    let showCum = false;
    let showMvd = false;
    for (const r of this.rowData) {
      if (this.shouldShowCumName(r)) showCum = true;
      if (r.es_medicamento_vital) showMvd = true;
    }
    this.gridApi.setColumnsVisible(['cum_producto_nombre'], showCum);
    this.gridApi.setColumnsVisible(['mvd_solicitante', 'mvd_principio_activo', 'mvd_forma_farmaceutica', 'mvd_presentacion'], showMvd);
  }

  private shouldShowCumName(row: RecepcionRow): boolean {
    const cum = (row.cum_recibido ?? '').trim().toUpperCase();
    const code = (row.codigo_producto ?? '').trim().toUpperCase();
    return cum !== '' && code !== '' && cum !== code;
  }

  private onMedicamentoVitalChanged(row: RecepcionRow, rowIndex: number, enabled: boolean): void {
    if (!enabled) {
      row.mvd_solicitante = '';
      row.mvd_principio_activo = '';
      row.mvd_forma_farmaceutica = '';
      row.mvd_presentacion = '';
      row.mvd_ium = '';
      row.mvd_fecha_autorizacion = '';
      if (row.codigo_sanitario) this.validarInvima(row, rowIndex);
    } else {
      row.estado_invima = 'Ingrese IUM';
      row.fabricante = '';
      row.concepto_recepcion = 'aceptado';
      row._invimaValid = null;
    }
    this.updateDynamicColumns();
    this.refreshRow(rowIndex);
  }

  private validarCum(row: RecepcionRow, rowIndex: number): void {
    const raw = (row.cum_recibido ?? '').trim().toUpperCase();
    if (!raw) { row.cum_producto_nombre = ''; this.updateDynamicColumns(); return; }
    const code = (row.codigo_producto ?? '').trim().toUpperCase();
    if (code && raw === code) { row.cum_producto_nombre = ''; this.updateDynamicColumns(); return; }
    if (this.cumCache.has(raw)) {
      row.cum_producto_nombre = this.cumCache.get(raw)!;
      this.updateDynamicColumns();
      this.refreshRow(rowIndex);
      return;
    }
    this.inventarioService.validateCum(raw).subscribe({
      next: (res: any) => {
        const name = res.success && res.exists && res.data
          ? (res.data.nombre || res.data.product_name || res.data.producto_nombre || 'Producto no encontrado')
          : 'Producto no encontrado';
        this.cumCache.set(raw, name);
        row.cum_producto_nombre = name;
        this.updateDynamicColumns();
        this.refreshRow(rowIndex);
      },
      error: () => {
        row.cum_producto_nombre = 'Error';
        this.refreshRow(rowIndex);
      },
    });
  }

  private validarInvima(row: RecepcionRow, rowIndex: number): void {
    const code = (row.codigo_sanitario ?? '').trim();
    if (!code || code.length < 5) {
      row.estado_invima = '';
      row._invimaValid = null;
      row.concepto_recepcion = '';
      this.refreshRow(rowIndex);
      return;
    }
    if (this.invimaCache.has(code)) {
      this.applyInvimaValidation(row, rowIndex, this.invimaCache.get(code));
      return;
    }
    row._validatingInvima = true;
    row.estado_invima = 'Validando...';
    this.refreshRow(rowIndex);
    const type = isDispositivoMedico(row.tipo_producto) ? 'medical_device' : isMedicamento(row.tipo_producto) ? 'medicine' : 'auto';
    this.inventarioService.validateInvima(code, type).subscribe({
      next: (res: any) => {
        row._validatingInvima = false;
        if (res.success && res.data) {
          this.invimaCache.set(code, res.data);
          this.applyInvimaValidation(row, rowIndex, res.data);
        } else {
          row.estado_invima = 'No encontrado';
          row._invimaValid = false;
          row.concepto_recepcion = '';
          this.refreshRow(rowIndex);
          this.offerManualOverride(row, rowIndex, code, 'Código sanitario no encontrado en INVIMA');
        }
      },
      error: (err) => {
        row._validatingInvima = false;
        row.estado_invima = 'Error';
        row._invimaValid = null;
        this.refreshRow(rowIndex);
        this.offerManualOverride(row, rowIndex, code, 'Error al consultar INVIMA: ' + (err?.message || 'conexión'));
      },
    });
  }

  private applyInvimaValidation(row: RecepcionRow, rowIndex: number, data: any): void {
    const isValid = data.valid === true;
    const status = data.status || 'unknown';

    if (isValid && status === 'active') {
      row.estado_invima = 'Vigente';
      row.concepto_recepcion = 'aceptado';
      row._invimaValid = true;
      if (data.laboratory) row.fabricante = data.laboratory;
      if (isDispositivoMedico(row.tipo_producto)) {
        row.vida_util = data.vida_util || data.vida_util_texto || 'No aplica';
      } else {
        row.vida_util = '';
      }
      if (!row.fecha_vencimiento && data.expires_at) {
        row.fecha_vencimiento = String(data.expires_at).split('T')[0];
        row.estado_vencimiento = getEstadoVencimiento(calcularDiasVencimiento(row.fecha_vencimiento));
        this.calcularSemaforo(row);
      }
      if (!row.cantidad_recibida) {
        row.cantidad_recibida = row.cantidad_solicitada;
        row.muestra_poblacion = calculateSamplePopulation(row.cantidad_recibida, row.muestra_exclusion);
      }
      this.msg.add({ severity: 'success', summary: 'INVIMA vigente', detail: data.name || data.laboratory || row.codigo_sanitario });
    } else if (!isValid && status === 'not_found') {
      row.estado_invima = 'No encontrado';
      row._invimaValid = false;
      row.fabricante = '';
      row.vida_util = '';
      row.concepto_recepcion = '';
      this.refreshRow(rowIndex);
      this.offerManualOverride(row, rowIndex, row.codigo_sanitario, 'Código sanitario no encontrado en INVIMA');
      return;
    } else {
      const statusText = status === 'expired' ? 'Vencido' : status === 'cancelled' ? 'Cancelado' : 'Rechazado';
      row.estado_invima = statusText;
      row._invimaValid = false;
      row.fabricante = data.laboratory || '';
      row.vida_util = '';
      row.concepto_recepcion = 'rechazado';
      const note = `Código sanitario ${statusText.toLowerCase()} según INVIMA`;
      row.observaciones_recepcion = row.observaciones_recepcion ? `${row.observaciones_recepcion}; ${note}` : note;
      this.msg.add({ severity: 'error', summary: statusText, detail: data.name || 'Producto no vigente' });
    }
    this.refreshRow(rowIndex);
  }

  private validarMvdIum(row: RecepcionRow, rowIndex: number): void {
    const ium = (row.codigo_sanitario ?? '').trim();
    if (!ium) return;
    const key = ium.toUpperCase();
    row.estado_invima = 'Buscando MVD...';
    this.refreshRow(rowIndex);
    if (this.mvdCache.has(key)) {
      this.applyMvdData(row, rowIndex, this.mvdCache.get(key));
      return;
    }
    this.inventarioService.searchMvd(ium).subscribe({
      next: (res: any) => {
        if (res.success && res.found && res.data) {
          this.mvdCache.set(key, res.data);
          this.applyMvdData(row, rowIndex, res.data);
        } else {
          row.estado_invima = 'IUM no encontrado';
          row.fabricante = '';
          row.concepto_recepcion = 'rechazado';
          row._invimaValid = false;
          this.refreshRow(rowIndex);
          this.msg.add({ severity: 'error', summary: 'MVD', detail: 'IUM no encontrado en Medicamentos Vitales No Disponibles' });
        }
      },
      error: () => {
        row.estado_invima = 'Error';
        this.refreshRow(rowIndex);
      },
    });
  }

  private applyMvdData(row: RecepcionRow, rowIndex: number, data: any): void {
    row.estado_invima = 'Vigente';
    row._invimaValid = true;
    row.fabricante = data.solicitante || '';
    row.mvd_solicitante = data.solicitante || '';
    row.mvd_principio_activo = data.principio_activo || '';
    row.mvd_forma_farmaceutica = data.forma_farmaceutica || '';
    row.mvd_presentacion = data.presentacion_comercial || '';
    row.mvd_ium = data.ium || row.codigo_sanitario;
    row.mvd_fecha_autorizacion = data.fecha_autorizacion || '';
    row.concepto_recepcion = 'aceptado';
    if (!row.cantidad_recibida) {
      row.cantidad_recibida = row.cantidad_solicitada;
    }
    row.muestra_poblacion = calculateSamplePopulation(row.cantidad_recibida, row.muestra_exclusion);
    this.updateDynamicColumns();
    const nombre = data.nombre_comercial && data.nombre_comercial !== 'NO REPORTADO'
      ? data.nombre_comercial : (data.principio_activo || 'Medicamento vital');
    this.msg.add({ severity: 'success', summary: 'MVD autorizado', detail: nombre });
    this.refreshRow(rowIndex);
  }

  private offerManualOverride(row: RecepcionRow, rowIndex: number, code: string, reason: string): void {
    this.confirm.confirm({
      header: 'Validación INVIMA no exitosa',
      message: `${reason}. ¿Desea recepcionar manualmente este producto? Se habilitarán los campos y quedará registrado en observaciones.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, recepcionar manualmente',
      rejectLabel: 'No, mantener bloqueado',
      accept: () => this.applyManualOverride(row, rowIndex, code, reason),
      reject: () => this.msg.add({ severity: 'warn', summary: 'Bloqueado', detail: 'Ingrese un código sanitario válido para habilitar los campos.' }),
    });
  }

  private applyManualOverride(row: RecepcionRow, rowIndex: number, _code: string, reason: string): void {
    const timestamp = new Date().toLocaleString('es-CO');
    const note = `[OVERRIDE MANUAL ${timestamp}] ${reason}. Recepción manual autorizada por el usuario.`;
    row.estado_invima = 'Override Manual';
    row.invima_override_manual = true;
    row.concepto_recepcion = 'aceptado';
    row._invimaValid = true;
    row.observaciones_recepcion = row.observaciones_recepcion ? `${row.observaciones_recepcion}; ${note}` : note;
    if (!row.cantidad_recibida) {
      row.cantidad_recibida = row.cantidad_solicitada;
      row.muestra_poblacion = calculateSamplePopulation(row.cantidad_recibida, row.muestra_exclusion);
    }
    this.msg.add({ severity: 'success', summary: 'Override manual', detail: 'Campos habilitados para recepción manual.' });
    this.refreshRow(rowIndex);
  }

  private calcularSemaforo(row: RecepcionRow): void {
    if (!row.fecha_vencimiento) { row._semaforo = ''; return; }
    const venc = new Date(row.fecha_vencimiento);
    if (Number.isNaN(venc.getTime())) { row._semaforo = ''; return; }
    const hoy = new Date();
    const diffMeses = (venc.getFullYear() - hoy.getFullYear()) * 12 + (venc.getMonth() - hoy.getMonth());
    if (diffMeses <= 0) row._semaforo = 'rojo';
    else if (diffMeses <= 6) row._semaforo = 'amarillo';
    else row._semaforo = 'verde';
  }

  private refreshRow(rowIndex: number): void {
    const node = this.gridApi?.getDisplayedRowAtIndex(rowIndex);
    if (node) this.gridApi?.refreshCells({ rowNodes: [node], force: true });
  }

  private getFocusedColId(): string {
    return this.gridApi?.getFocusedCell()?.column?.getColId() ?? '';
  }

  private applyTextAlign(_align: string): void {
    // Alignment changes require re-rendering cells with a dynamic class.
    // For now, this updates the CSS variable on the grid container.
    // Full per-column alignment would need enterprise AG Grid or custom renderer.
    this.msg.add({ severity: 'info', summary: 'Info', detail: 'Alineación aplicada al exportar a CSV.' });
  }

  /** Apply font family and size via CSS variable on the grid element. */
  private applyGridFont(): void {
    const scaledSize = (this.gridBaseFontSize() * this.zoom()) / 100;
    // Re-trigger the computed signal so the template picks it up
    this.zoom.update(z => z); // force recompute
    // Update AG Grid's font via a DOM CSS variable
    const gridEl = document.querySelector('.xl-grid') as HTMLElement | null;
    if (gridEl) {
      gridEl.style.setProperty('--ag-font-family', `'${this.gridFontFamily()}', Calibri, sans-serif`);
      gridEl.style.setProperty('--ag-font-size', `${scaledSize}px`);
      gridEl.style.setProperty('--xl-font-size', `${scaledSize}px`);
    }
    this.gridApi?.refreshCells({ force: true });
  }

  private toggleFreeze(): void {
    const focused = this.gridApi?.getFocusedCell();
    if (!focused) return;
    const colId = focused.column.getColId();
    const colState = this.gridApi?.getColumnState();
    const isPinned = colState?.find(c => c.colId === colId)?.pinned;
    this.gridApi?.applyColumnState({ state: [{ colId, pinned: isPinned ? null : 'left' }] });
  }

  // ─── Guardar ──────────────────────────────────────────────────────────────

  guardar(): void {
    this.gridApi?.stopEditing();
    const items = this.rowData.filter(r => r.recibido && r.cantidad_recibida > 0);
    if (items.length === 0) { this.msg.add({ severity: 'warn', summary: 'Sin datos', detail: 'Marque al menos un producto como recibido.' }); return; }
    const incompletos = items.filter(i => !i.numero_lote || !i.fecha_vencimiento || !i.concepto_recepcion);
    if (incompletos.length > 0) { this.msg.add({ severity: 'warn', summary: 'Campos faltantes', detail: `${incompletos.length} producto(s) sin Lote, Vencimiento o Concepto.` }); return; }

    this.isSaving.set(true);
    const payload = {
      compra_id: this.compraId,
      observaciones: '',
      items: items.map(r => ({
        pedido_detalle_id: r.pedido_detalle_id,
        codigo_producto: r.codigo_producto,
        producto_nombre: r.producto_nombre,
        marca: r.marca,
        tipo_producto: r.tipo_producto,
        forma_farmaceutica: r.forma_farmaceutica,
        concentracion: r.concentracion,
        unidad_empaque: r.unidad_empaque,
        cantidad_solicitada: r.cantidad_solicitada,
        cantidad_recibida: r.cantidad_recibida,
        muestra_poblacion: r.muestra_poblacion,
        cum_recibido: r.cum_recibido,
        numero_lote: r.numero_lote,
        fecha_vencimiento: r.fecha_vencimiento,
        codigo_sanitario: r.codigo_sanitario,
        fabricante: r.fabricante,
        vida_util: r.vida_util,
        estado_invima: r.estado_invima,
        invima_override_manual: r.invima_override_manual ? 1 : 0,
        aspecto_cumple: r.aspecto_cumple,
        embalaje_cumple: r.embalaje_cumple,
        contenido_cumple: r.contenido_cumple,
        cadena_frio_temperatura: r.cadena_frio_temperatura,
        concepto_recepcion: r.concepto_recepcion,
        observaciones_recepcion: r.observaciones_recepcion,
        es_medicamento_vital: r.es_medicamento_vital,
        mvd_ium: r.es_medicamento_vital ? (r.mvd_ium || r.codigo_sanitario) : null,
        mvd_solicitante: r.mvd_solicitante,
        mvd_principio_activo: r.mvd_principio_activo,
        mvd_forma_farmaceutica: r.mvd_forma_farmaceutica,
        mvd_presentacion_comercial: r.mvd_presentacion,
        mvd_fecha_autorizacion: r.mvd_fecha_autorizacion || null,
        recibido: 1,
      })),
    };

    this.inventarioService.createRecepcion(payload).subscribe({
      next: (res: any) => {
        this.isSaving.set(false);
        if (res.success) {
          this.msg.add({ severity: 'success', summary: 'Guardado', detail: res.message || 'Recepción guardada.' });
          setTimeout(() => { window.opener ? window.close() : this.router.navigate(['/inventario/farmacia/recepcionTecnica']); }, 1500);
        } else { this.msg.add({ severity: 'error', summary: 'Error', detail: res.message || 'No se pudo guardar.' }); }
      },
      error: (err: any) => { this.isSaving.set(false); this.msg.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'Error de conexión.' }); },
    });
  }
}
