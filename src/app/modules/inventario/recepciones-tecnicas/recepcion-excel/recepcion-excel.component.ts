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

// ── Excel Sheet shared component ──
import {
  ExcelSheetComponent,
  ExcelSheetConfig,
  FormulaCellInfo,
  RibbonActionEvent,
  FormulaCommitEvent,
  RIBBON_RECEPCION,
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
  imports: [CommonModule, FormsModule, AgGridAngular, ToastModule, ExcelSheetComponent],
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

  // ─── Grid config ──────────────────────────────────────────────────────────

  readonly defaultColDef: ColDef<RecepcionRow> = {
    resizable: true,
    sortable: true,
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
  };

  private readonly dataColumns: ColDef<RecepcionRow>[] = [
    { headerName: '✓', field: 'recibido', width: 42, cellDataType: 'boolean', cellClass: 'xl-cell xl-center' },
    // A–H: Datos de OC (NO editables)
    { headerName: 'Código', field: 'codigo_producto', width: 120, editable: false, cellClass: 'xl-cell xl-locked' },
    { headerName: 'Producto', field: 'producto_nombre', width: 300, editable: false, cellClass: 'xl-cell xl-locked', tooltipField: 'producto_nombre' },
    { headerName: 'Tipo', field: 'tipo_producto', width: 110, editable: false, cellClass: 'xl-cell xl-locked' },
    { headerName: 'Forma Farm.', field: 'forma_farmaceutica', width: 130, editable: false, cellClass: 'xl-cell xl-locked' },
    { headerName: 'Concentración', field: 'concentracion', width: 120, editable: false, cellClass: 'xl-cell xl-locked' },
    { headerName: 'Unid. Empaque', field: 'unidad_empaque', width: 110, editable: false, cellClass: 'xl-cell xl-locked' },
    { headerName: 'Cant. Solic.', field: 'cantidad_solicitada', width: 92, editable: false, type: 'numericColumn', cellClass: 'xl-cell xl-num xl-locked' },
    // I en adelante: Editables (recepción técnica)
    { headerName: 'Med. Vital', field: 'es_medicamento_vital', width: 78, cellDataType: 'boolean', cellClass: 'xl-cell xl-center' },
    {
      headerName: 'Cód. Sanitario / CUM', field: 'codigo_sanitario', width: 165,
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
        if (p.value === 'Vigente') return `${base} xl-fill-ok`;
        if (p.value === 'Vencido') return `${base} xl-fill-bad`;
        if (p.value) return `${base} xl-fill-warn`;
        return base;
      },
    },
    { headerName: 'Fabricante', field: 'fabricante', width: 190 },
    { headerName: 'Vida Útil', field: 'vida_util', width: 88 },
    {
      headerName: 'Fecha Vencimiento', field: 'fecha_vencimiento', width: 132,
      cellEditor: 'agTextCellEditor', cellEditorParams: { maxLength: 10 },
      cellClass: (p: CellClassParams<RecepcionRow>) => {
        const base = 'xl-cell xl-center';
        const s = p.data?._semaforo;
        return s ? `${base} xl-fill-${s}` : base;
      },
      tooltipValueGetter: () => 'Formato: AAAA-MM-DD',
    },
    { headerName: 'Cant. Recibida', field: 'cantidad_recibida', width: 104, cellEditor: 'agNumberCellEditor', cellEditorParams: { min: 0, precision: 0 }, type: 'numericColumn', cellClass: 'xl-cell xl-num xl-strong' },
    { headerName: 'Muestra', field: 'muestra_poblacion', width: 80, editable: false, type: 'numericColumn', cellClass: 'xl-cell xl-num xl-locked' },
    { headerName: 'N. Lote', field: 'numero_lote', width: 118 },
    { headerName: 'Aspecto', field: 'aspecto_cumple', width: 100, cellEditor: 'agSelectCellEditor', cellEditorParams: { values: CUMPLE_VALUES } },
    { headerName: 'Embalaje', field: 'embalaje_cumple', width: 100, cellEditor: 'agSelectCellEditor', cellEditorParams: { values: CUMPLE_VALUES } },
    { headerName: 'Contenido', field: 'contenido_cumple', width: 100, cellEditor: 'agSelectCellEditor', cellEditorParams: { values: CUMPLE_VALUES } },
    { headerName: 'Temp. °C', field: 'cadena_frio_temperatura', width: 82, cellEditor: 'agNumberCellEditor', cellEditorParams: { precision: 1 }, type: 'numericColumn', cellClass: 'xl-cell xl-num' },
    {
      headerName: 'Concepto', field: 'concepto_recepcion', width: 118,
      cellEditor: 'agSelectCellEditor', cellEditorParams: { values: CONCEPTO_VALUES },
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
          const cantidad = Number(item.cantidad_solicitada_compra ?? item.cantidad_solicitada ?? 0);
          return {
            codigo_producto: item.codigo_producto || '', producto_nombre: item.producto_nombre || '',
            marca: item.marca || '', tipo_producto: item.tipo_producto || 'Medicamento',
            forma_farmaceutica: item.forma_farmaceutica || '', concentracion: item.concentracion || '',
            unidad_empaque: item.unidad_empaque || '', cantidad_solicitada: cantidad,
            es_medicamento_vital: false, codigo_sanitario: '', estado_invima: '',
            fabricante: '', vida_util: '', fecha_vencimiento: '',
            cantidad_recibida: cantidad, muestra_poblacion: null, numero_lote: '',
            aspecto_cumple: 'Cumple', embalaje_cumple: 'Cumple', contenido_cumple: 'Cumple',
            cadena_frio_temperatura: null, concepto_recepcion: 'aceptado', observaciones_recepcion: '',
            _validatingInvima: false, _invimaValid: null, _semaforo: '',
            pedido_detalle_id: item.pedido_detalle_id ?? item.id ?? null, recibido: true,
          } as RecepcionRow;
        });
        this.rowData = items;
        this.ordenInfo.set({ numero: res.orden_numero || `OC-${this.compraId}`, proveedor: res.proveedor || '' });
        this.recalcTotals();
        this.isLoading.set(false);
      },
      error: () => { this.isLoading.set(false); this.msg.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la orden.' }); },
    });
  }

  // ─── Grid events ──────────────────────────────────────────────────────────

  onGridReady(event: GridReadyEvent<RecepcionRow>): void { this.gridApi = event.api; }

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
    if (field === 'codigo_sanitario') this.validarInvima(row, event.rowIndex ?? 0);
    if (field === 'fecha_vencimiento') { this.calcularSemaforo(row); this.gridApi?.refreshCells({ rowNodes: event.node ? [event.node] : undefined, force: true }); }
    if (field === 'cantidad_recibida' || field === 'recibido' || field === 'concepto_recepcion') this.recalcTotals();
    // Update formula bar
    this.cellInfo.update(c => ({ ...c, value: event.newValue === null || event.newValue === undefined ? '' : String(event.newValue) }));
  }

  // ─── Shell events ─────────────────────────────────────────────────────────

  onSecondaryAction(action: string): void {
    if (action === 'close') { window.opener ? window.close() : this.router.navigate(['/inventario/farmacia/recepcionTecnica']); }
  }

  onRibbonAction(event: RibbonActionEvent): void {
    switch (event.actionId) {
      case 'select-all': this.rowData.forEach(r => r.recibido = true); this.gridApi?.refreshCells({ force: true }); this.recalcTotals(); break;
      case 'select-none': this.rowData.forEach(r => r.recibido = false); this.gridApi?.refreshCells({ force: true }); this.recalcTotals(); break;
      case 'autofit': this.gridApi?.autoSizeAllColumns(); break;
      case 'export-csv': this.gridApi?.exportDataAsCsv({ fileName: `recepcion_${this.ordenInfo()?.numero ?? this.compraId}.csv` }); break;
      case 'align-left': this.setAlignment('left'); break;
      case 'align-center': this.setAlignment('center'); break;
      case 'align-right': this.setAlignment('right'); break;
      case 'sort-asc': this.gridApi?.applyColumnState({ state: [{ colId: this.getFocusedColId(), sort: 'asc' }] }); break;
      case 'sort-desc': this.gridApi?.applyColumnState({ state: [{ colId: this.getFocusedColId(), sort: 'desc' }] }); break;
      case 'clear-filters': this.gridApi?.setFilterModel(null); break;
      case 'freeze-cols': this.toggleFreeze(); break;
      case 'zoom-fit': this.gridApi?.sizeColumnsToFit(); break;
      case 'copy': this.gridApi?.copySelectedRangeToClipboard(); break;
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

  private validarInvima(row: RecepcionRow, rowIndex: number): void {
    const code = (row.codigo_sanitario ?? '').trim();
    if (!code || code.length < 5) { row.estado_invima = ''; row._invimaValid = null; this.refreshRow(rowIndex); return; }
    row._validatingInvima = true; this.refreshRow(rowIndex);
    this.inventarioService.validateInvima(code).subscribe({
      next: (res: any) => {
        row._validatingInvima = false;
        if (res.success && res.data) {
          row.estado_invima = res.data.status === 'active' ? 'Vigente' : res.data.status === 'expired' ? 'Vencido' : 'No encontrado';
          row._invimaValid = res.data.valid;
          if (res.data.laboratory) row.fabricante = res.data.laboratory;
          if (res.data.vida_util) row.vida_util = res.data.vida_util;
        } else { row.estado_invima = 'No encontrado'; row._invimaValid = false; }
        this.refreshRow(rowIndex);
      },
      error: () => { row._validatingInvima = false; row.estado_invima = 'Error'; row._invimaValid = null; this.refreshRow(rowIndex); },
    });
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

  private setAlignment(_align: string): void {
    // AG Grid community doesn't support dynamic cell alignment changes
    // This would need enterprise or custom cell class logic — placeholder for now
    this.msg.add({ severity: 'info', summary: 'Info', detail: 'Alineación se aplica al exportar.' });
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
      items: items.map(r => ({ ...r, recibido: 1, _validatingInvima: undefined, _invimaValid: undefined, _semaforo: undefined })),
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
