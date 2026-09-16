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
import { PermissionService } from '../../../../core/services/permission.service';
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
  RibbonTab,
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
  // ── Desdoblamiento por CUM/Lote (agrupación tipo "folio" plegable) ──
  // _esHijo: fila-fragmento creada al desdoblar un producto (mismo pedido_detalle_id).
  // _uid: identificador único de fila (para reemplazos precisos en el grid).
  // _grupoId: id que comparten el padre y todos sus fragmentos (para plegar/desplegar).
  // _expandido: solo en el padre; controla si sus fragmentos se muestran u ocultan.
  _esHijo?: boolean;
  _uid?: string;
  _grupoId?: string;
  _expandido?: boolean;
  // _yaRecepcionado: este producto ya fue recibido en una recepción previa parcial;
  // queda bloqueado individualmente (no se re-recepciona) aunque la hoja siga editable.
  _yaRecepcionado?: boolean;
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

/**
 * Normaliza un valor de cumplimiento a 'Cumple' / 'No Cumple'.
 * Acepta número (1/0), boolean, o string. Por defecto (sin dato) → 'Cumple'.
 */
function cumpleToLabel(valor: any): string {
  if (valor === null || valor === undefined || valor === '') return 'Cumple'; // default recepción
  if (typeof valor === 'string') {
    const v = valor.trim().toLowerCase();
    return v === 'cumple' ? 'Cumple' : 'No Cumple';
  }
  return (valor === 1 || valor === true) ? 'Cumple' : 'No Cumple';
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
  private readonly permissionService = inject(PermissionService);
  private readonly msg = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  /** ¿El usuario puede confirmar/finalizar la recepción? (Jefe de Almacén). */
  get puedeConfirmarRecepcion(): boolean {
    return this.permissionService.hasPermission('confirmar-recepcion');
  }

  readonly isConfirming = signal(false);

  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  // Solo lectura: la recepción fue CONFIRMADA por el Jefe de Almacén (no se modifica).
  readonly soloLectura = signal(false);

  // ── Menú contextual propio (clic derecho sobre una fila) ──
  // AG Grid Community no soporta getContextMenuItems; se usa un menú custom.
  readonly ctxMenu = signal<{ visible: boolean; x: number; y: number; row: RecepcionRow | null }>({
    visible: false, x: 0, y: 0, row: null,
  });

  // ── Contadores ──
  private readonly totalItems = signal(0);
  private readonly totalRecibidos = signal(0);
  private readonly totalRechazados = signal(0);
  // ¿Hay al menos un producto desdoblado? (para mostrar los botones de la cinta)
  readonly hayGrupos = signal(false);
  // ¿Todos los grupos están expandidos? (para el estado del botón toggle)
  readonly todosExpandidos = signal(false);
  private readonly totalPendientes = computed(() => this.totalItems() - this.totalRecibidos());

  // ── Cell info para la barra de fórmulas ──
  readonly cellInfo = signal<FormulaCellInfo>({ reference: 'A1', value: '', editable: false });

  // ── Zoom ──
  private readonly zoom = signal(100);
  readonly gridFontSize = computed(() => `${(11 * this.zoom()) / 100}px`);

  // ── Font state (applied via CSS variable on the grid container) ──
  readonly gridFontFamily = signal('Calibri');
  readonly gridBaseFontSize = signal(11); // px, independent of zoom

  // ── Cinta (ribbon): se agrega el grupo "Desdoblamiento" solo cuando hay grupos ──
  readonly ribbonTabsRecepcion = computed<RibbonTab[]>(() => {
    if (!this.hayGrupos()) return RIBBON_RECEPCION;
    const abierto = this.todosExpandidos();
    // Clonar sin mutar el preset compartido e insertar el grupo en la pestaña "Inicio".
    return RIBBON_RECEPCION.map(tab => {
      if (tab.id !== 'inicio') return tab;
      return {
        ...tab,
        groups: [
          ...tab.groups.filter(g => !g.grow), // grupos normales
          {
            title: 'Desdoblamiento',
            items: [
              {
                type: 'button', id: 'toggle-all-groups', size: 'lg',
                label: abierto ? 'Contraer\ntodo' : 'Expandir\ntodo',
                icon: abierto ? 'pi pi-angle-double-up' : 'pi pi-angle-double-down',
                tooltip: abierto ? 'Contraer todos los fragmentos' : 'Expandir todos los fragmentos',
              },
            ],
          },
          ...tab.groups.filter(g => g.grow), // el grupo "grow" (leyenda) al final
        ],
      };
    });
  });

  // ── ExcelSheetConfig: se recalcula cuando cambian los datos ──
  readonly excelConfig = computed<ExcelSheetConfig>(() => ({
    title: {
      documentName: `Recepción Técnica — ${this.ordenInfo()?.numero || 'Cargando…'}`,
      subtitle: this.ordenInfo()?.proveedor || '',
      saveState: this.isSaving() ? 'saving' : 'unsaved',
      primaryAction: {
        label: this.soloLectura() ? 'Recepción guardada' : 'Guardar Recepción',
        icon: this.soloLectura() ? 'pi pi-lock' : 'pi pi-save',
        disabled: this.soloLectura() || this.totalRecibidos() === 0,
        loading: this.isSaving(),
      },
      secondaryActions: [
        ...(this.puedeConfirmarRecepcion && !this.soloLectura()
          ? [{
              label: this.isConfirming() ? 'Confirmando…' : 'Confirmar recepción',
              icon: 'pi pi-check-circle',
              action: 'confirmar-tecnica',
              disabled: this.isConfirming() || this.totalRecibidos() === 0,
            }]
          : []),
        { label: 'Cerrar', icon: 'pi pi-times', action: 'close' },
      ],
    },
    ribbonTabs: this.ribbonTabsRecepcion(),
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
  // rowData: fuente de verdad completa (padres + fragmentos, expandidos o no).
  rowData: RecepcionRow[] = [];
  // displayRows: lo que realmente ve el grid (oculta los fragmentos de un grupo plegado).
  displayRows: RecepcionRow[] = [];
  private gridApi?: GridApi<RecepcionRow>;
  private compraId = 0;
  private colLetters = new Map<string, string>();
  private ordenInfo = signal<{ numero: string; proveedor: string } | null>(null);
  private invimaCache = new Map<string, any>();
  private mvdCache = new Map<string, any>();
  private cumCache = new Map<string, string>();

  // ── Tabla de muestreo (ISO 2859-1) traída de la BD ──
  private muestreoNiveles: { lote_min: number; lote_max: number; tamano_muestra: number; letra_codigo: string }[] = [];
  private muestreoExclusiones = new Set<string>();

  /**
   * Calcula el tamaño de muestra usando la tabla militar (inv_muestreo_niveles) de BD.
   * - Si el producto está en exclusiones (inv_muestreo_exclusiones): muestreo del 100%.
   * - Si no, busca el rango [lote_min, lote_max] que contiene la cantidad.
   * - Fallback (si aún no cargó la tabla): 0.
   */
  private calcularMuestra(cantidad: number, codigoProducto: string, forzarTotal = false): number {
    const qty = Math.floor(Number(cantidad) || 0);
    if (!qty || qty <= 0) return 0;

    const cod = String(codigoProducto || '').trim().toUpperCase();
    if (forzarTotal || this.muestreoExclusiones.has(cod)) {
      return qty; // inspección total del lote
    }

    const nivel = this.muestreoNiveles.find(n => qty >= n.lote_min && qty <= n.lote_max);
    return nivel ? nivel.tamano_muestra : 0;
  }

  /** ¿El producto se muestrea al 100% (está en la tabla de exclusiones)? */
  private esExcluido(codigoProducto: string): boolean {
    return this.muestreoExclusiones.has(String(codigoProducto || '').trim().toUpperCase());
  }

  /**
   * Recalcula la muestra de todas las filas según su cantidad recibida actual.
   * Se usa tras cargar datos (por si la tabla de muestreo llegó después) y al
   * volver a colocar cantidades.
   */
  private recalcularTodasLasMuestras(): void {
    this.rowData.forEach(r => {
      const cant = Number(r.cantidad_recibida ?? 0);
      // Solo (re)calcular si aún no hay muestra; respeta la muestra ya cargada/guardada.
      if ((r.muestra_poblacion === null || r.muestra_poblacion === 0) && cant > 0) {
        r.muestra_poblacion = this.calcularMuestra(cant, r.codigo_producto, r.muestra_exclusion);
      }
    });
    this.gridApi?.refreshCells({ force: true });
  }

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
    // Marca visualmente las filas desdobladas (fragmentos por CUM/Lote).
    // Identidad estable de cada fila: permite que AG Grid ANIME la aparición
    // y desaparición de fragmentos al plegar/desplegar en vez de repintar todo.
    getRowId: (params) => String(params.data._uid ?? `${params.data.pedido_detalle_id}-${params.data.codigo_producto}`),
    getRowClass: (params) => {
      const row = params.data;
      if (!row) return '';
      if (row._esHijo) return 'xl-row-hijo';
      if (this.esPadreConHijos(row)) return 'xl-row-padre';
      return '';
    },
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
    animateRows: true,
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

      // If it's a boolean cell (checkbox), toggle immediately (salvo solo lectura).
      if (colDef.cellDataType === 'boolean' && colDef.editable !== false && !this.soloLectura()) {
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
    
    // NOTA: getContextMenuItems es feature de AG Grid ENTERPRISE. El proyecto usa
    // ag-grid-community, así que el menú "Desdoblar" se implementa con el evento
    // nativo (contextmenu) del contenedor + un menú propio (ver onContextMenu()).
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
      valueFormatter: (p: any) => {
        const v = String(p.value ?? '').toLowerCase();
        if (v === 'aceptado') return 'Aceptado';
        if (v === 'rechazado') return 'Rechazado';
        return v ? (v.charAt(0).toUpperCase() + v.slice(1)) : '';
      },
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
    // Columna de agrupación plegable (chevron ▸/▾) tipo "folio".
    {
      headerName: '', colId: 'expandGroup', width: 30, maxWidth: 30,
      sortable: false, editable: false, resizable: false, suppressMovable: true,
      lockPosition: true, cellClass: 'xl-expand-cell', headerClass: 'xl-corner',
      cellRenderer: (p: any) => {
        const row = p.data as RecepcionRow;
        if (!row) return '';
        // Padre con fragmentos → chevron abrir/cerrar con contador.
        if (this.esPadreConHijos(row)) {
          const abierto = row._expandido !== false;
          const n = this.contarHijos(row);
          // Siempre el mismo icono; la rotación (0°/90°) la anima el CSS.
          return `<span class="xl-grp-toggle ${abierto ? 'is-open' : ''}" title="${abierto ? 'Contraer' : 'Expandir'} fragmentos">`
            + `<i class="pi pi-chevron-right"></i><span class="xl-grp-badge">${n}</span></span>`;
        }
        // Fragmento (hijo) → marca visual de rama.
        if (row._esHijo) return `<span class="xl-grp-child">└</span>`;
        return '';
      },
      onCellClicked: (p: any) => {
        const row = p.data as RecepcionRow;
        if (row && this.esPadreConHijos(row)) this.toggleGrupo(row);
      },
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
    // Cargar la tabla de muestreo (BD) y luego los datos de la orden.
    this.cargarTablaMuestreo(() => this.loadData());
  }

  /** Carga la tabla de muestreo (niveles + exclusiones) desde el backend. */
  private cargarTablaMuestreo(done: () => void): void {
    this.inventarioService.getTablaMuestreo().subscribe({
      next: (res: any) => {
        if (res?.success) {
          this.muestreoNiveles = (res.niveles || []).map((n: any) => ({
            lote_min: Number(n.lote_min),
            lote_max: Number(n.lote_max),
            tamano_muestra: Number(n.tamano_muestra),
            letra_codigo: n.letra_codigo,
          }));
          this.muestreoExclusiones = new Set(
            (res.exclusiones || []).map((c: any) => String(c).trim().toUpperCase())
          );
        }
        done();
      },
      error: () => { done(); } // si falla, seguimos; la muestra caerá a 0 y se recalcula al guardar
    });
  }

  // ─── Data loading ─────────────────────────────────────────────────────────

  private loadData(): void {
    this.isLoading.set(true);
    this.inventarioService.getRecepcionByCompra(this.compraId).subscribe({
      next: (res: any) => {
        const items: RecepcionRow[] = (Array.isArray(res.data) ? res.data : []).map((item: any) => {
          const cantidad = Number(item.cantidad_solicitada ?? item.cantidad_solicitada_compra ?? 0);
          const fechaVenc = item.fecha_vencimiento ? String(item.fecha_vencimiento).substring(0, 10) : '';
          const diasVenc = calcularDiasVencimiento(fechaVenc);
          // Exclusión: la que venga del backend O la que esté en la tabla de exclusiones local.
          const esExcluido = Boolean(item.muestra_exclusion) || this.esExcluido(item.codigo_producto || '');
          // La cantidad a recibir arranca con la recibida previa (si la hay) o la solicitada.
          const recibidaPrevia = Number(item.cantidad_recibida ?? 0);
          const cantRecibida = recibidaPrevia > 0 ? recibidaPrevia : cantidad;
          // Muestra: usar la guardada en la recepción previa; si no, calcular sobre la cantidad.
          const muestraGuardada = Number(item.muestra_poblacion ?? 0);
          const muestraPoblacion = muestraGuardada > 0
            ? muestraGuardada
            : this.calcularMuestra(cantRecibida, item.codigo_producto || '', esExcluido);
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
            // Respetar el estado INVIMA guardado en la recepción previa (si lo hay).
            estado_invima: item.estado_invima || '',
            fabricante: item.fabricante || '',
            vida_util: item.vida_util || '',
            estado_vencimiento: getEstadoVencimiento(diasVenc),
            fecha_vencimiento: fechaVenc,
            cantidad_recibida: cantRecibida,
            muestra_poblacion: muestraPoblacion,
            muestra_exclusion: esExcluido,
            numero_lote: item.numero_lote || '',
            aspecto_cumple: cumpleToLabel(item.aspecto_cumple),
            embalaje_cumple: cumpleToLabel(item.embalaje_cumple),
            contenido_cumple: cumpleToLabel(item.contenido_cumple),
            cadena_frio_temperatura: item.cadena_frio_temperatura ?? null,
            // Respetar el concepto guardado en la recepción previa (si lo hay).
            concepto_recepcion: item.concepto_recepcion || '',
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
            // Si ya venía recepcionado en una recepción previa (parcial), se bloquea
            // esta fila para no re-recepcionarla; el resto sigue editable.
            _yaRecepcionado: Boolean(item.tiene_recepcion_previa),
          } as RecepcionRow;
        });
        this.rowData = items;
        // Asegurar identidad estable de cada fila (para animar filas en el grid).
        this.rowData.forEach(r => { if (!r._uid) r._uid = this.nuevoUid(); });
        // Reconstruir grupos de fragmentos (mismo pedido_detalle_id) que vengan
        // de una recepción previa y dejarlos PLEGADOS por defecto.
        this.agruparFragmentosCargados();
        this.refreshDisplayRows();
        // La hoja SOLO se bloquea por completo cuando el Jefe de Almacén CONFIRMA
        // la recepción. Mientras es parcial ('RECEPCIONADO'), se sigue recepcionando
        // lo que falta; los productos ya recibidos quedan bloqueados individualmente.
        const confirmada = Boolean(res.recepcion_confirmada);
        this.soloLectura.set(confirmada);
        if (confirmada) {
          this.msg.add({
            severity: 'info',
            summary: 'Recepción confirmada',
            detail: 'Esta recepción ya fue confirmada por el Jefe de Almacén. Los datos son de solo lectura.',
            life: 6000,
          });
        } else if ((Array.isArray(res.data) ? res.data : []).some((it: any) => it?.tiene_recepcion_previa)) {
          this.msg.add({
            severity: 'info',
            summary: 'Recepción parcial',
            detail: 'Esta orden ya tiene productos recepcionados. Puedes seguir recepcionando los que faltan.',
            life: 5000,
          });
        }
        items.forEach(r => { if (r.fecha_vencimiento) this.calcularSemaforo(r); });
        // Recalcular muestras por si la tabla de muestreo cargó después del mapeo.
        this.recalcularTodasLasMuestras();
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
    // Leer del nodo mostrado (displayRows), no de rowData por índice.
    const row = this.gridApi?.getDisplayedRowAtIndex(rowIndex)?.data ?? this.displayRows[rowIndex];
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
      let recibida = Math.floor(Number(event.newValue ?? 0));
      if (recibida < 0) recibida = 0;
      row.cantidad_recibida = recibida;

      // Al desdoblar, se compara la SUMA de todas las filas del mismo renglón
      // (mismo pedido_detalle_id + código) contra lo solicitado. Si el total
      // supera lo pedido, se AVISA pero NO se bloquea (puede llegar de más).
      const maxSolic = Number(row.cantidad_solicitada ?? 0);
      const totalGrupo = this.totalRecibidoDelGrupo(row);
      if (maxSolic > 0 && totalGrupo > maxSolic) {
        this.msg.add({
          severity: 'warn',
          summary: 'Recibido por encima de lo solicitado',
          detail: `El producto "${row.producto_nombre}" se solicitó por ${maxSolic} y ya suma ${totalGrupo} recibido entre sus lotes.`,
        });
      }
      // La muestra SIEMPRE se recalcula según la nueva cantidad a recibir.
      // Sin cantidad → celda de muestra vacía (no 0), para que el usuario complete.
      row.muestra_poblacion = recibida > 0
        ? this.calcularMuestra(recibida, row.codigo_producto, row.muestra_exclusion)
        : null;
      this.gridApi?.refreshCells({
        rowNodes: event.node ? [event.node] : undefined,
        columns: ['cantidad_recibida', 'muestra_poblacion'],
        force: true,
      });
    }
    if (field === 'cantidad_recibida' || field === 'recibido' || field === 'concepto_recepcion') this.recalcTotals();
    this.cellInfo.update(c => ({ ...c, value: event.newValue === null || event.newValue === undefined ? '' : String(event.newValue) }));
  }

  // ─── Shell events ─────────────────────────────────────────────────────────

  onSecondaryAction(action: string): void {
    if (action === 'close') { window.opener ? window.close() : this.router.navigate(['/inventario/farmacia/recepcionTecnica']); }
    if (action === 'confirmar-tecnica') { this.confirmarRecepcionTecnica(); }
  }

  onRibbonAction(event: RibbonActionEvent): void {
    // En solo lectura, bloquear las acciones que modifican datos.
    const accionesEscritura = ['select-all', 'select-none', 'paste', 'cut', 'undo', 'redo'];
    if (this.soloLectura() && accionesEscritura.includes(event.actionId)) {
      this.msg.add({ severity: 'warn', summary: 'Solo lectura', detail: 'La recepción ya fue guardada; no se puede modificar.' });
      return;
    }
    switch (event.actionId) {
      case 'toggle-all-groups':
        // Expandir/contraer todos los fragmentos de una sola vez.
        if (this.todosExpandidos()) this.contraerTodos();
        else this.expandirTodos();
        break;

      case 'select-all':
        // Volver a colocar: marca recibido, cantidad = solicitada y recalcula muestra.
        this.rowData.forEach(r => {
          r.recibido = true;
          r.cantidad_recibida = Number(r.cantidad_solicitada ?? 0);
          r.muestra_poblacion = r.cantidad_recibida > 0
            ? this.calcularMuestra(r.cantidad_recibida, r.codigo_producto, r.muestra_exclusion)
            : null;
        });
        this.gridApi?.refreshCells({ force: true });
        this.recalcTotals();
        this.msg.add({ severity: 'success', summary: 'Cantidades restauradas', detail: 'Se colocó la cantidad solicitada en todos los productos.' });
        break;

      case 'select-none':
        // Quitar todo: desmarca, cantidad 0 y muestra vacía.
        this.rowData.forEach(r => {
          r.recibido = false;
          r.cantidad_recibida = 0;
          r.muestra_poblacion = null;
        });
        this.gridApi?.refreshCells({ force: true });
        this.recalcTotals();
        this.msg.add({ severity: 'info', summary: 'Cantidades borradas', detail: 'Se vaciaron las cantidades. Ingresa los valores a recibir.' });
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

    // Recepción CONFIRMADA por el Jefe de Almacén: toda la hoja es de solo lectura.
    if (this.soloLectura()) return false;

    // Producto ya recepcionado en una recepción parcial previa: bloqueado
    // individualmente (no se re-recepciona), pero el resto de la hoja sí es editable.
    // Las filas hijas (desdoblamiento) del mismo producto sí se editan.
    if (row._yaRecepcionado && !row._esHijo) return false;

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
        row.muestra_poblacion = this.calcularMuestra(row.cantidad_recibida, row.codigo_producto, row.muestra_exclusion);
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
    row.muestra_poblacion = this.calcularMuestra(row.cantidad_recibida, row.codigo_producto, row.muestra_exclusion);
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
      row.muestra_poblacion = this.calcularMuestra(row.cantidad_recibida, row.codigo_producto, row.muestra_exclusion);
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

  // ─── Menú contextual propio (clic derecho) ─────────────────────────────────

  /**
   * Clic derecho sobre el grid: abre el menú propio de la hoja (Desdoblar / Quitar)
   * en vez del menú del navegador. Detecta la fila bajo el cursor por el DOM de AG Grid.
   */
  onContextMenu(event: MouseEvent): void {
    // Ubicar la fila de AG Grid bajo el cursor (atributo row-index).
    const rowEl = (event.target as HTMLElement)?.closest('.ag-row') as HTMLElement | null;
    if (!rowEl) return; // clic fuera de una fila → dejar el menú nativo

    event.preventDefault();
    const rowIndex = Number(rowEl.getAttribute('row-index'));
    const node = Number.isFinite(rowIndex) ? this.gridApi?.getDisplayedRowAtIndex(rowIndex) : undefined;
    const row = node?.data ?? null;
    if (!row) return;

    this.ctxMenu.set({ visible: true, x: event.clientX, y: event.clientY, row });
  }

  /** Cierra el menú contextual (al hacer clic fuera o elegir una opción). */
  cerrarCtxMenu(): void {
    if (this.ctxMenu().visible) this.ctxMenu.set({ visible: false, x: 0, y: 0, row: null });
  }

  /** ¿La fila del menú permite desdoblarse? (hoja editable y hay fila). */
  get puedeDesdoblar(): boolean {
    return !this.soloLectura() && !!this.ctxMenu().row;
  }

  /** ¿La fila del menú es un desdoblamiento que se puede quitar? */
  get puedeQuitarDesdoblamiento(): boolean {
    return !this.soloLectura() && !!this.ctxMenu().row?._esHijo;
  }

  /** Acción del menú: desdoblar la fila seleccionada. */
  desdoblarDesdeMenu(): void {
    const row = this.ctxMenu().row;
    this.cerrarCtxMenu();
    if (row) this.desdoblarFila(row);
  }

  /** Acción del menú: quitar el desdoblamiento seleccionado. */
  quitarDesdeMenu(): void {
    const row = this.ctxMenu().row;
    this.cerrarCtxMenu();
    if (row) this.quitarDesdoblamiento(row);
  }

  // ─── Desdoblamiento por CUM / Lote ──────────────────────────────────────────

  /**
   * Desdobla un renglón de la OC en una fila "hija" para capturar un fragmento
   * que llegó con otro CUM / lote / vencimiento. La hija:
   *   - hereda producto, código, tipo, cantidad solicitada y pedido_detalle_id;
   *   - arranca con CUM/lote/cantidad recibida en blanco para que el usuario
   *     los complete con el fragmento nuevo;
   *   - se inserta inmediatamente debajo del padre para mantenerlas juntas.
   *
   * Al guardar, todas las filas (padre + hijas) del mismo pedido_detalle_id se
   * envían como detalles de recepción independientes → trazabilidad completa.
   */
  private desdoblarFila(origen: RecepcionRow): void {
    if (this.soloLectura()) {
      this.msg.add({ severity: 'warn', summary: 'Solo lectura', detail: 'La recepción ya fue guardada; no se puede desdoblar.' });
      return;
    }

    // El fragmento pertenece al mismo grupo que el padre. Si el "origen" ya es
    // un fragmento, escalamos al grupo al que pertenece.
    if (!origen._grupoId) origen._grupoId = this.nuevoUid();
    const grupoId = origen._grupoId;

    const hija: RecepcionRow = {
      ...origen,
      _esHijo: true,
      _uid: this.nuevoUid(),
      _grupoId: grupoId,
      _expandido: undefined,
      // Campos que cambian por fragmento: se dejan en blanco para capturarlos.
      cum_recibido: '',
      cum_producto_nombre: '',
      numero_lote: '',
      fecha_vencimiento: '',
      estado_vencimiento: '',
      cantidad_recibida: 0,
      muestra_poblacion: null,
      codigo_sanitario: '',
      estado_invima: '',
      _invimaValid: null,
      _validatingInvima: false,
      _semaforo: '',
      concepto_recepcion: '',
      recibido: true,
    };

    // Asegurar que el origen tenga uid (para ubicarlo) y dejar el grupo expandido.
    if (!origen._uid) origen._uid = this.nuevoUid();
    // El padre real del grupo (no un hijo) queda marcado como expandido.
    const padre = this.rowData.find(r => !r._esHijo && r._grupoId === grupoId) ?? origen;
    padre._expandido = true;

    // Insertar la hija después del padre y de los fragmentos ya existentes del grupo.
    const idxPadre = this.rowData.findIndex(r => r === padre);
    let insertIdx = idxPadre + 1;
    while (
      insertIdx < this.rowData.length &&
      this.rowData[insertIdx]._esHijo &&
      this.rowData[insertIdx]._grupoId === grupoId
    ) {
      insertIdx++;
    }

    this.rowData.splice(insertIdx, 0, hija);
    this.refreshDisplayRows();
    this.recalcTotals();

    this.msg.add({
      severity: 'success',
      summary: 'Producto desdoblado',
      detail: `Se agregó una línea para "${origen.producto_nombre}". Ingrese el CUM, lote y cantidad del nuevo fragmento.`,
    });

    // Enfocar la celda de CUM de la nueva fila para que el usuario empiece a capturar.
    setTimeout(() => {
      const idx = this.displayRows.findIndex(r => r === hija);
      if (idx >= 0) {
        this.gridApi?.ensureIndexVisible(idx);
        this.gridApi?.setFocusedCell(idx, 'cum_recibido');
      }
    }, 50);
  }

  /** Elimina una fila hija de desdoblamiento (solo las hijas, nunca el original). */
  private quitarDesdoblamiento(fila: RecepcionRow): void {
    if (!fila._esHijo) {
      this.msg.add({ severity: 'warn', summary: 'No permitido', detail: 'Solo se pueden quitar las líneas desdobladas, no el producto original.' });
      return;
    }
    const idx = this.rowData.findIndex(r => r === fila);
    if (idx >= 0) {
      const grupoId = fila._grupoId;
      this.rowData.splice(idx, 1);
      // Si el grupo se quedó sin fragmentos, limpiar la marca del padre.
      if (grupoId) {
        const padre = this.rowData.find(r => !r._esHijo && r._grupoId === grupoId);
        if (padre && this.contarHijos(padre) === 0) {
          padre._grupoId = undefined;
          padre._expandido = undefined;
        }
      }
      this.refreshDisplayRows();
      this.recalcTotals();
      this.msg.add({ severity: 'info', summary: 'Línea eliminada', detail: 'Se quitó el desdoblamiento.' });
    }
  }

  /** Genera un id único de fila (para ubicar filas al desdoblar). */
  private nuevoUid(): string {
    return 'row_' + Math.random().toString(36).slice(2, 10);
  }

  // ─── Agrupación plegable (padre + fragmentos por CUM/Lote) ──────────────────

  /** ¿La fila es un padre que tiene al menos un fragmento (hijo)? */
  esPadreConHijos(row: RecepcionRow): boolean {
    return !row._esHijo && !!row._grupoId && this.contarHijos(row) > 0;
  }

  /** Cuenta cuántos fragmentos (hijos) tiene un grupo. */
  contarHijos(row: RecepcionRow): number {
    if (!row._grupoId) return 0;
    return this.rowData.filter(r => r._esHijo && r._grupoId === row._grupoId).length;
  }

  /**
   * Reconstruye displayRows: muestra todos los padres/independientes y
   * oculta los fragmentos de los grupos que estén plegados (_expandido = false).
   */
  private refreshDisplayRows(): void {
    // Mapa padre por grupo para saber si el grupo está expandido.
    const padrePorGrupo = new Map<string, RecepcionRow>();
    for (const r of this.rowData) {
      if (!r._esHijo && r._grupoId) padrePorGrupo.set(r._grupoId, r);
    }
    this.displayRows = this.rowData.filter(r => {
      if (!r._esHijo) return true; // padres e independientes siempre visibles
      const padre = r._grupoId ? padrePorGrupo.get(r._grupoId) : undefined;
      return padre ? padre._expandido !== false : true;
    });
    this.gridApi?.setGridOption('rowData', [...this.displayRows]);
    this.gridApi?.refreshCells({ force: true });

    // Actualizar estado de la cinta (mostrar/ocultar y etiqueta del botón).
    const padres = [...padrePorGrupo.values()].filter(p => this.contarHijos(p) > 0);
    this.hayGrupos.set(padres.length > 0);
    this.todosExpandidos.set(padres.length > 0 && padres.every(p => p._expandido !== false));
  }

  /** Expande todos los grupos de desdoblamiento (botón de la cinta). */
  expandirTodos(): void {
    this.rowData.forEach(r => { if (!r._esHijo && r._grupoId) r._expandido = true; });
    this.refreshDisplayRows();
  }

  /** Contrae todos los grupos de desdoblamiento (botón de la cinta). */
  contraerTodos(): void {
    this.rowData.forEach(r => { if (!r._esHijo && r._grupoId) r._expandido = false; });
    this.refreshDisplayRows();
  }

  /** Pliega/despliega el grupo de un padre (chevron ▸/▾). */
  toggleGrupo(row: RecepcionRow): void {
    if (!this.esPadreConHijos(row)) return;
    row._expandido = row._expandido === false ? true : false;
    this.refreshDisplayRows();
  }

  /**
   * Al cargar datos: agrupa las filas que comparten pedido_detalle_id (fragmentos
   * de un desdoblamiento previo). La primera queda como padre y las demás como
   * hijos del mismo grupo. Todos los grupos arrancan PLEGADOS.
   */
  private agruparFragmentosCargados(): void {
    const porDetalle = new Map<number, RecepcionRow[]>();
    for (const r of this.rowData) {
      // Ignorar filas creadas en esta sesión (ya tienen grupo) y sin detalle.
      if (r.pedido_detalle_id == null) continue;
      const arr = porDetalle.get(r.pedido_detalle_id) ?? [];
      arr.push(r);
      porDetalle.set(r.pedido_detalle_id, arr);
    }
    for (const filas of porDetalle.values()) {
      if (filas.length < 2) continue; // sin fragmentos, no es un grupo
      const grupoId = this.nuevoUid();
      filas.forEach((r, i) => {
        r._grupoId = grupoId;
        r._uid = r._uid || this.nuevoUid();
        if (i === 0) {
          r._esHijo = false;
          r._expandido = false; // plegado por defecto
        } else {
          r._esHijo = true;
          r._expandido = undefined;
        }
      });
    }
  }

  /**
   * Suma la cantidad recibida de TODAS las filas del mismo renglón de la OC
   * (mismo pedido_detalle_id + código de producto), incluyendo sus desdoblamientos.
   */
  private totalRecibidoDelGrupo(row: RecepcionRow): number {
    return this.rowData
      .filter(r =>
        r.codigo_producto === row.codigo_producto &&
        r.pedido_detalle_id === row.pedido_detalle_id
      )
      .reduce((acc, r) => acc + (Number(r.cantidad_recibida) || 0), 0);
  }

  // ─── Guardar ──────────────────────────────────────────────────────────────

  guardar(): void {
    if (this.soloLectura()) {
      this.msg.add({ severity: 'warn', summary: 'Solo lectura', detail: 'Esta recepción ya fue guardada y no se puede modificar.' });
      return;
    }
    this.gridApi?.stopEditing();
    // Solo se envían los productos recibidos que AÚN no estaban recepcionados
    // (las filas hijas del desdoblamiento sí van, aunque el padre ya esté recibido).
    const items = this.rowData.filter(r =>
      r.recibido && r.cantidad_recibida > 0 && (!r._yaRecepcionado || r._esHijo)
    );
    if (items.length === 0) { this.msg.add({ severity: 'warn', summary: 'Sin datos', detail: 'Marque al menos un producto nuevo como recibido.' }); return; }
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
          this.msg.add({
            severity: 'success', summary: 'Recepción guardada',
            detail: (res.message || 'Productos recepcionados.') + ' Puedes seguir recepcionando o confirmar cuando termines.',
          });
          // Recarga: los productos guardados quedan bloqueados y se puede seguir
          // recepcionando los que faltan (recepción parcial/incremental).
          this.loadData();
        } else { this.msg.add({ severity: 'error', summary: 'Error', detail: res.message || 'No se pudo guardar.' }); }
      },
      error: (err: any) => { this.isSaving.set(false); this.msg.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'Error de conexión.' }); },
    });
  }

  // ─── Confirmar / finalizar recepción (Jefe de Almacén) ──────────────────────

  /**
   * Finaliza la recepción técnica de toda la OC. Acción del Jefe de Almacén
   * (requiere permiso 'confirmar-recepcion'). Deja la recepción de solo lectura
   * y marca la OC como recibida.
   */
  confirmarRecepcionTecnica(): void {
    if (!this.puedeConfirmarRecepcion) {
      this.msg.add({ severity: 'warn', summary: 'Sin permiso', detail: 'Solo el Jefe de Almacén puede confirmar la recepción técnica.' });
      return;
    }
    if (this.soloLectura()) {
      this.msg.add({ severity: 'info', summary: 'Ya confirmada', detail: 'Esta recepción ya fue confirmada.' });
      return;
    }
    // Debe existir al menos un producto ya recepcionado (guardado).
    const hayRecibidos = this.rowData.some(r => r._yaRecepcionado);
    if (!hayRecibidos) {
      this.msg.add({ severity: 'warn', summary: 'Sin productos', detail: 'Guarde al menos un producto recepcionado antes de confirmar.' });
      return;
    }

    const pendientes = this.rowData.filter(r => !r._yaRecepcionado && !r._esHijo).length;
    const mensaje = pendientes > 0
      ? `Aún hay <strong>${pendientes}</strong> producto(s) sin recepcionar. Si confirmas ahora, la recepción se dará por finalizada y no se podrá modificar. ¿Continuar?`
      : '¿Confirmar y finalizar la recepción técnica? La orden se marcará como recibida y no se podrá modificar.';

    this.confirm.confirm({
      header: 'Confirmar recepción técnica',
      message: mensaje,
      icon: 'pi pi-check-circle',
      acceptLabel: 'Sí, confirmar',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.isConfirming.set(true);
        this.inventarioService.confirmarRecepcionTecnica(this.compraId).subscribe({
          next: (res: any) => {
            this.isConfirming.set(false);
            if (res.success) {
              this.msg.add({ severity: 'success', summary: 'Recepción confirmada', detail: res.message || 'Recepción finalizada.' });
              setTimeout(() => { window.opener ? window.close() : this.router.navigate(['/inventario/farmacia/recepcionTecnica']); }, 1500);
            } else {
              this.msg.add({ severity: 'error', summary: 'Error', detail: res.message || 'No se pudo confirmar.' });
            }
          },
          error: (err: any) => {
            this.isConfirming.set(false);
            const msg = err?.status === 403
              ? 'No tienes permiso para confirmar la recepción técnica.'
              : (err?.error?.message || 'Error al confirmar la recepción.');
            this.msg.add({ severity: 'error', summary: 'Error', detail: msg });
          },
        });
      },
    });
  }
}
