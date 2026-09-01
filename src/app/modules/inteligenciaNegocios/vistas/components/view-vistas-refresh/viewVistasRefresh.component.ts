/**
 * ViewVistasRefreshComponent
 *
 * Vista tipo "Excel Online" con carga desde export/parquet.
 *
 * Flujo:
 *  1. Abre en fullscreen con el shell ExcelSheetComponent
 *  2. Panel lateral derecho "Cargando..." mientras el export asincrono trabaja
 *     (igual al panel de "Actualizando conexiones" de Excel Online)
 *  3. Al completar descarga el gzip/xlsx, parsea los datos en memoria
 *  4. Carga TODOS los datos en AG Grid con virtual scroll (solo ~30 filas en DOM)
 *  5. Filtros dinamicos en ribbon: rango de fechas, texto, numerico segun tipo de columna
 *  6. Boton "Actualizar" replica el flujo desde cero (como clic derecho -> Actualizar en Excel)
 */
import {
  Component, OnInit, OnDestroy, signal, computed, inject, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AgGridAngular } from 'ag-grid-angular';
import type { ColDef, ColGroupDef, GridApi, GridReadyEvent, CellFocusedEvent } from 'ag-grid-community';
import * as XLSX from 'xlsx';

import {
  VistasService, VistaBi, FabricColumn,
} from '../../../services/vistas.service';
import {
  getColumnType, humanizeColumnName,
} from '../../../helpers/column-type.helper';
import {
  ExcelSheetComponent, ExcelSheetConfig,
  FormulaCellInfo, RibbonActionEvent, RibbonTab, FormulaCommitEvent,
  RibbonButton, RibbonDropdown,
} from '../../../../../complements/shared/excel-sheet';
import { AG_GRID_LOCALE } from '../../../../../core/config/ag-grid.config';
import { environment } from '../../../../../environments/environment';
import { ExcelColumnFilterComponent } from '../excel-column-filter/excel-column-filter.component';
import { ExcelDateFilterComponent } from '../excel-date-filter/excel-date-filter.component';
import { FormulaEngineService } from '../../services/formula-engine.service';
import { WorkbookStateService } from '../../services/workbook-state.service';
import { ViewRegistryService } from '../../services/view-registry.service';
import {
  buildFormulaSuggestions, FORMULA_CATALOG, FORMULA_BY_NAME, FORMULA_CATEGORIES,
  type FormulaDef,
} from '../../services/formula-catalog';
import type { FormulaSuggestionItem } from '../../../../../complements/shared/excel-sheet';
import { PivotPanelComponent, PivotResult } from '../pivot-panel/pivot-panel.component';

// Tipos propios -
export type RefreshStatus =
  | 'idle'        // Sin datos, esperando accion del usuario
  | 'queuing'     // Enviando request al backend para encolar export
  | 'processing'  // Job en ejecucion (polling activo)
  | 'downloading' // Job completado, descargando archivo
  | 'parsing'     // Parseando CSV/NDJSON en memoria
  | 'ready'       // Datos listos en la grilla
  | 'error';      // Error en algun paso

interface RefreshProgress {
  status: RefreshStatus;
  message: string;
  percent: number;      // 0-100 para la barra de progreso
  rows: number;         // filas procesadas hasta ahora
  elapsed: number;      // segundos transcurridos
  jobId?: string;
  errorDetail?: string;
}

/** Filtro dinamico de una columna */
export interface DynamicFilter {
  col: string;
  label: string;
  colType: 'text' | 'number' | 'date' | 'boolean';
  // text
  textValue?: string;
  textMode?: 'contains' | 'startsWith' | 'endsWith' | 'equals';
  // number
  numFrom?: number | null;
  numTo?: number | null;
  numMode?: 'between' | 'eq' | 'gt' | 'lt';
  // date
  dateFrom?: string;
  dateTo?: string;
  // boolean
  boolValue?: '1' | '0' | '';
}

/** Formatos de presentacion aplicables a una columna desde la pestana Formato */
export type ColumnFormat =
  | 'text' | 'number' | 'integer' | 'date'
  | 'cop' | 'usd' | 'eur' | 'percent';

/**
 * Convierte un valor crudo al texto de presentacion segun el formato pedido.
 * No altera el dato subyacente: solo cambia como se muestra (igual que Excel).
 */
function formatCellValue(value: unknown, format: ColumnFormat): string {
  if (value === null || value === undefined || value === '') return '';

  // Normalizar a numero cuando el formato lo requiere
  const toNumber = (v: unknown): number | null => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const n = Number(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };

  switch (format) {
    case 'text':
      return String(value);

    case 'number': {
      const n = toNumber(value);
      return n === null ? String(value) : n.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    case 'integer': {
      const n = toNumber(value);
      return n === null ? String(value) : Math.round(n).toLocaleString('es-CO');
    }

    case 'date': {
      const raw = String(value).replace('T', ' ');
      // ISO: YYYY-MM-DD -> DD/MM/YYYY
      const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
      const d = new Date(raw);
      if (!isNaN(d.getTime())) {
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      }
      return raw;
    }

    case 'cop': {
      const n = toNumber(value);
      return n === null ? String(value)
        : n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
    }

    case 'usd': {
      const n = toNumber(value);
      return n === null ? String(value)
        : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
    }

    case 'eur': {
      const n = toNumber(value);
      return n === null ? String(value)
        : n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
    }

    case 'percent': {
      const n = toNumber(value);
      return n === null ? String(value)
        : `${(n <= 1 && n >= -1 ? n * 100 : n).toLocaleString('es-CO', { maximumFractionDigits: 2 })} %`;
    }
  }
}

// Helpers para construir items del ribbon -
function btn(id: string, label: string, icon: string, size: 'lg' | 'sm' = 'lg', tooltip?: string): RibbonButton {
  return { type: 'button', id, label, icon, size, tooltip: tooltip ?? label };
}

function dropdown(
  id: string, tooltip: string, value: string,
  options: Array<{ label: string; value: string }>,
  size: 'lg' | 'sm' = 'sm',
): RibbonDropdown {
  return { type: 'dropdown', id, tooltip, value, options, size };
}

// Ribbon definition --------------------

/**
 * Construye las pestanas del ribbon dinamicamente.
 * Los filtros de fecha/numero/texto se implementan como dropdowns + botones
 * porque RibbonItem no soporta tipo 'input' - los campos de entrada
 * se muestran en la UI del componente, no en el ribbon.
 */
function buildRibbon(
  colOptions: Array<{ label: string; value: string }>,
  showTotals: boolean,
): RibbonTab[] {
  return [
    {
      id: 'datos',
      label: 'Datos',
      groups: [
        {
          title: 'Conexion',
          items: [
            btn('refresh',        'Actualizar\ntodo',   'pi pi-refresh',       'lg', 'Recargar desde Fabric (parquet)'),
            btn('cancel-refresh', 'Cancelar',           'pi pi-times-circle',  'sm', 'Cancelar actualizacion en curso'),
          ],
        },
        {
          title: 'Vistas',
          items: [
            btn('add-view', 'Agregar\nvista', 'pi pi-plus-circle', 'lg', 'Cargar otra vista del usuario como nueva hoja'),
          ],
        },
        {
          title: 'Filtrar',
          items: [
            btn('filter-open', 'Filtros\ndinamicos', 'pi pi-filter', 'lg', 'Filtrar por rango de fechas, texto o numeros'),
            btn('filter-clear', 'Limpiar\nfiltros', 'pi pi-filter-slash', 'sm', 'Eliminar todos los filtros'),
          ],
        },
        {
          title: 'Herramientas',
          items: [
            { 
              type: 'toggle', 
              id: 'toggle-totals', 
              label: 'Fila de\ntotales', 
              icon: 'pi pi-calculator', 
              size: 'lg' as const,
              tooltip: 'Mostrar/ocultar fila con sumas de columnas numericas',
              active: showTotals,
            },
            btn('freeze-cols', 'Congelar\ncolumnas', 'pi pi-lock', 'lg', 'Congelar primeras columnas'),
            btn('unfreeze-cols', 'Descongelar', 'pi pi-lock-open', 'sm', 'Descongelar todas las columnas'),
          ],
        },
        {
          title: 'Exportar',
          items: [
            btn('export-csv',  'CSV',   'pi pi-file-export', 'lg'),
            btn('export-xlsx', 'Excel', 'pi pi-file-excel',  'lg'),
          ],
        },
        {
          title: 'Pantalla',
          items: [
            btn('fullscreen', 'Pantalla\ncompleta', 'pi pi-window-maximize', 'lg', 'Ver en pantalla completa (F11)'),
          ],
        },
      ],
    },
    {
      id: 'filtros',
      label: 'Filtros',
      groups: [
        {
          title: 'Columna',
          items: [
            dropdown('filter-col', 'Seleccione columna para filtrar', '',
              [{ label: '- Seleccione columna -', value: '' }, ...colOptions]),
          ],
        },
        {
          title: 'Tipo de filtro',
          items: [
            dropdown('filter-type', 'Tipo de comparacion', 'contains', [
              { label: 'Contiene',    value: 'contains'   },
              { label: 'Empieza con', value: 'startsWith' },
              { label: 'Termina en',  value: 'endsWith'   },
              { label: 'Igual a',     value: 'equals'     },
              { label: 'Rango',       value: 'range'      },
              { label: 'Mayor que',   value: 'gt'         },
              { label: 'Menor que',   value: 'lt'         },
            ]),
          ],
        },
        {
          title: 'Acciones',
          items: [
            btn('filter-open',  'Configurar\nfiltro', 'pi pi-filter',       'lg', 'Abrir panel de filtros'),
            btn('filter-clear', 'Limpiar\nfiltros',   'pi pi-filter-slash', 'lg', 'Eliminar todos los filtros'),
          ],
        },
      ],
    },
    {
      id: 'vista',
      label: 'Vista',
      groups: [
        {
          title: 'Columnas',
          items: [
            btn('autofit',  'Ajustar\ntodo',   'pi pi-arrows-h', 'lg'),
            btn('zoom-fit', 'Ajustar\nancho',  'pi pi-expand',   'lg'),
            btn('show-all-cols', 'Mostrar\ntodas', 'pi pi-eye', 'sm', 'Mostrar todas las columnas ocultas'),
            btn('column-panel', 'Columnas', 'pi pi-list', 'sm', 'Mostrar/ocultar columnas'),
          ],
        },
        {
          title: 'Densidad',
          items: [
            dropdown('row-height', 'Alto de fila', 'normal', [
              { label: 'Compacto (21px)',  value: 'compact'     },
              { label: 'Normal (28px)',    value: 'normal'      },
              { label: 'Comodo (36px)',    value: 'comfortable' },
            ]),
          ],
        },
      ],
    },
    {
      id: 'formato',
      label: 'Formato',
      groups: [
        {
          title: 'Columna activa',
          items: [
            dropdown('fmt-col', 'Columna a formatear', '',
              [{ label: '- Seleccione columna -', value: '' }, ...colOptions]),
          ],
        },
        {
          title: 'Tipo de dato',
          items: [
            btn('fmt-text',   'Texto',   'pi pi-align-left',      'sm', 'Mostrar como texto'),
            btn('fmt-number', 'Numero',  'pi pi-sort-numeric-up', 'sm', 'Mostrar con separador de miles y 2 decimales'),
            btn('fmt-integer','Entero',  'pi pi-hashtag',         'sm', 'Mostrar sin decimales'),
            btn('fmt-date',   'Fecha',   'pi pi-calendar',        'sm', 'Mostrar como DD/MM/YYYY'),
          ],
        },
        {
          title: 'Moneda y porcentaje',
          items: [
            btn('fmt-cop',     'COP',   'pi pi-dollar',  'sm', 'Pesos colombianos'),
            btn('fmt-usd',     'USD',   'pi pi-dollar',  'sm', 'Dolares'),
            btn('fmt-eur',     'EUR',   'pi pi-euro',    'sm', 'Euros'),
            btn('fmt-percent', '%',     'pi pi-percentage', 'sm', 'Porcentaje'),
          ],
        },
        {
          title: 'Restablecer',
          items: [
            btn('fmt-reset', 'Quitar\nformato', 'pi pi-undo', 'lg', 'Volver al formato original de la columna'),
          ],
        },
      ],
    },
    {
      id: 'formulas',
      label: 'Formulas',
      groups: [
        {
          title: 'Hoja de calculo',
          items: [
            btn('new-calc-sheet', 'Nueva hoja\nde calculo', 'pi pi-plus', 'lg',
                'Crear una hoja vacia A-Z donde escribir formulas'),
          ],
        },
        {
          title: 'Cruzar vistas',
          items: [
            btn('fx-buscarvista', 'BUSCARVISTA', 'pi pi-search', 'sm',
                'Traer un dato de otra vista cargada (como BUSCARV entre hojas)'),
            btn('fx-contarvista', 'CONTARVISTA', 'pi pi-list', 'sm',
                'Contar filas de otra vista que cumplen un valor'),
            btn('fx-sumarvista',  'SUMARVISTA',  'pi pi-plus-circle', 'sm',
                'Sumar una columna de otra vista filtrando por otra columna'),
          ],
        },
        {
          title: 'Ayuda',
          items: [
            btn('fx-help', 'Guia de\nformulas', 'pi pi-question-circle', 'lg',
                'Ver todas las formulas disponibles, con ejemplos'),
            btn('fx-recalc', 'Recalcular', 'pi pi-refresh', 'sm',
                'Volver a calcular todas las formulas con los datos actuales'),
          ],
        },
      ],
    },
    {
      id: 'analisis',
      label: 'Analisis',
      groups: [
        {
          title: 'Tablas Dinamicas',
          items: [
            btn('pivot-table', 'Tabla\nDinamica', 'pi pi-table', 'lg', 'Crear tabla dinamica (pivot table) como Excel'),
          ],
        },
        {
          title: 'Analisis Rapido',
          items: [
            btn('quick-analysis', 'Analisis\nRapido', 'pi pi-chart-bar', 'lg', 'Agrupar y resumir datos (alternativa simple)'),
            btn('clear-analysis', 'Limpiar', 'pi pi-times', 'sm', 'Limpiar analisis'),
          ],
        },
        {
          title: 'Exportar',
          items: [
            btn('export-analysis', 'Exportar\nAnalisis', 'pi pi-download', 'lg', 'Exportar resultados del analisis'),
          ],
        },
      ],
    },
  ];
}

/** Tamano inicial de una hoja de calculo vacia (se amplia al hacer scroll) */
const BLANK_SHEET_ROWS = 100;
const BLANK_SHEET_COLS = 26;

// Componente -
@Component({
  selector: 'app-view-vistas-refresh',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, AgGridAngular, ExcelSheetComponent, PivotPanelComponent],
  templateUrl: './viewVistasRefresh.component.html',
  styleUrl:    './viewVistasRefresh.component.css',
})
export class ViewVistasRefreshComponent implements OnInit, OnDestroy {
  private readonly route          = inject(ActivatedRoute);
  private readonly vistasService  = inject(VistasService);
  private readonly http           = inject(HttpClient);
  private readonly formulaEngine  = inject(FormulaEngineService);
  private readonly viewRegistry   = inject(ViewRegistryService);

  private readonly baseUrl = `${environment.URL_SERVICIOS}/fabric/viewer`;

  /** Maximo de VISTAS de datos cargadas a la vez (las hojas de analisis no cuentan) */
  private static readonly MAX_LOADED_VIEWS = 5;

  // Parametros de ruta ----------------------------------------------------
  schema   = '';
  viewName = '';
  vista: VistaBi | null = null;
  columns: FabricColumn[] = [];

  // Estado del refresco --------------------

readonly progress = signal<RefreshProgress>({
    status: 'idle', message: 'Sin datos. Haga clic en "Actualizar todo" para cargar.', percent: 0, rows: 0, elapsed: 0,
  });

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private elapsedTimer: ReturnType<typeof setInterval> | null = null;
  private startTime = 0;
  private keyboardHandler?: (event: KeyboardEvent) => void;
  private clickHandler?: () => void;

  // Datos en memoria --------------------

/** Todos los registros descargados, sin filtrar */
  private rawData: Record<string, unknown>[] = [];

  // Grilla -----------------------------------------------------------------
  // rowData y columnDefs son arrays normales - AG Grid 32 detecta cambios
  // por referencia. Los signals no disparan re-render con OnPush en AG Grid 32.
  rowData:    Record<string, unknown>[] = [];
  /** Lista plana de columnas - usada por toda la logica interna (filtros, totales, etc.) */
  columnDefs: ColDef[] = [];
  /**
   * Version agrupada que se entrega a AG Grid: cada columna de datos va dentro de
   * un grupo cuyo encabezado es la letra Excel (A, B, C...). Esto produce DOS filas
   * de encabezado nativas: fila 1 = letras, fila 2 = nombres de columna.
   */
  gridColumnDefs: (ColDef | ColGroupDef)[] = [];

  readonly totalRows      = signal(0);
  readonly filteredRows   = signal(0);
  readonly cellInfo       = signal<FormulaCellInfo>({ reference: 'A1', value: '', editable: false });
  readonly zoom           = signal(100);
  readonly showTotalsRow  = signal(false); // Controla si se muestra la fila de totales

  // Menu contextual custom (reemplaza getContextMenuItems de Enterprise)
  readonly contextMenu = signal<{ visible: boolean; x: number; y: number; colId: string }>({
    visible: false, x: 0, y: 0, colId: ''
  });

  /**
   * Agregados de la columna seleccionada, igual que la barra de estado de Excel:
   * al hacer clic en un encabezado se calculan Promedio / Recuento / Suma / Min / Max.
   */
  readonly columnStats = signal<{
    label: string;
    count: number;
    numericCount: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
  } | null>(null);
  private gridApi?: GridApi;

  readonly defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    filter: ExcelColumnFilterComponent,
    filterParams: { maxDisplayedValues: 50 },
    minWidth: 80,
    cellClass: 'bi-cell',
    floatingFilter: false, // sin filtro flotante, solo el menu
  };

  readonly localeText = AG_GRID_LOCALE;

  // Helper para usar en el template
  readonly humanizeColumnName = humanizeColumnName;


  readonly activeFilters = signal<DynamicFilter[]>([]);

  // Estado del builder de filtros (publico para template)
  filterBuilder: Partial<DynamicFilter> & { col: string } = { col: '' };
  readonly selectedColType = signal<'text' | 'number' | 'date' | 'boolean' | null>(null);

  /** Controla la visibilidad del panel lateral de configuracion de filtros */
  readonly showFilterPanel = signal(false);

  /** Panel de mostrar/ocultar columnas */
  readonly showColumnPanel = signal(false);
  readonly hiddenColumnIds = signal<string[]>([]);

  /** Columna seleccionada en la pestana Formato */
  private formatTargetCol = '';
  /** Formato aplicado por columna (para poder restablecer) */
  private readonly columnFormats = new Map<string, ColumnFormat>();

  // Panel "Agregar vista" --------------------

/** Muestra/oculta el panel de seleccion de vistas disponibles */
  readonly showAddViewPanel = signal(false);
  /** Vistas disponibles para el usuario (cargadas al abrir el panel) */
  readonly availableViews = signal<VistaBi[]>([]);

  // Panel "Analisis Rapido" --------------------

/** Muestra/oculta el panel de analisis rapido (tablas dinamicas) */
  readonly showAnalysisPanel = signal(false);
  /** Configuracion del analisis rapido */
  readonly analysisConfig = signal<{
    groupBy: string;
    metrics: Array<{ column: string; operation: 'sum' | 'avg' | 'count' | 'distinct' }>;
  }>({ groupBy: '', metrics: [] });

  // Panel "Tabla Dinamica" (Pivot Table) --------------------

/** Muestra/oculta el panel de configuracion de tabla dinamica */
  readonly showPivotPanel = signal(false);
  /** Configuracion de la tabla dinamica */
  readonly pivotConfig = signal<{
    rowFields: string[];      // Campos para filas (ej: ["categoria", "subcategoria"])
    columnFields: string[];   // Campos para columnas (ej: ["ano", "mes"])
    valueFields: Array<{      // Campos de valores con agregacion
      column: string;
      operation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct';
      label?: string;
    }>;
    filterFields: string[];   // Campos para filtrar
  }>({
    rowFields: [],
    columnFields: [],
    valueFields: [],
    filterFields: []
  });

  // Metricas de Performance --------------------

readonly perfMetrics = signal<{
    totalRows: number;
    filteredRows: number;
    loadTimeSeconds: number;
    memoryUsageMB: number;
    isNearLimit: boolean;
  }>({
    totalRows: 0,
    filteredRows: 0,
    loadTimeSeconds: 0,
    memoryUsageMB: 0,
    isNearLimit: false,
  });
  readonly loadingViews   = signal(false);
  readonly searchVistas   = signal('');

  /**
   * Hojas abiertas. La primera es la vista cargada al entrar.
   * `kind` distingue las hojas de datos (una vista de Fabric) de las hojas de
   * calculo/analisis, porque el limite de 5 aplica SOLO a las de datos.
   */
  readonly sheets = signal<Array<{ 
    id: string; 
    label: string; 
    schema: string; 
    viewName: string; 
    active: boolean;
    kind?: 'view' | 'blank' | 'pivot';
    rowData?: Record<string, unknown>[];
    columnDefs?: ColDef[];
    columns?: FabricColumn[];
  }>>([]);

  /**
   * Hoja del motor de formulas asociada a la pestana activa.
   * Vacio cuando la pestana activa es una vista de datos (solo lectura).
   */
  private activeFormulaSheet = '';

  /** Sugerencias que se muestran en el autocompletado de la barra de formulas */
  formulaSuggestions: FormulaSuggestionItem[] = [];

  /** Panel lateral con la guia de formulas */
  readonly showFormulaHelp = signal(false);

  /** Categoria abierta en la guia de formulas */
  readonly helpCategory = signal<string>('Vistas');

  /** Catalogo agrupado por categoria, para la guia */
  readonly formulaCategories = FORMULA_CATEGORIES;

  formulasOfCategory(cat: string): FormulaDef[] {
    return FORMULA_CATALOG.filter(f => f.category === cat);
  }

  /** Vistas disponibles ahora mismo para las formulas, con sus columnas */
  readonly formulaViews = computed(() => this.viewRegistry.views().map(v => ({
    name: v.name,
    rows: v.rows.length,
    columns: v.columns,
  })));

  /**
   * Inserta la plantilla de una funcion en la celda enfocada.
   * Solo tiene sentido en una hoja de calculo: en una vista de datos avisa.
   */
  private insertFormulaTemplate(name: string): void {
    const def = FORMULA_BY_NAME.get(name);
    if (!def) return;

    if (!this.isEditableSheet()) {
      alert(
        `${name} se escribe en una hoja de calculo, no sobre los datos de la vista.\n\n` +
        `Cree una hoja con "Nueva hoja de calculo" (o el boton + de las pestanas) ` +
        `y escriba alli la formula. El resultado aparece en la celda donde la escriba.\n\n` +
        `Ejemplo: ${def.example}`
      );
      return;
    }

    const views = this.viewRegistry.viewNames();
    if (views.length === 0) {
      alert(
        'No hay ninguna vista cargada todavia.\n\n' +
        'Las formulas de vista solo leen datos YA cargados en una pestana. ' +
        'Cargue la vista primero con "Agregar vista".'
      );
      return;
    }

    if (!this.focusedCell) {
      alert('Seleccione primero la celda donde quiere el resultado.');
      return;
    }

    // Plantilla con la primera vista cargada como pista
    const sample = `=${name}("${views[0]}";"";"";"")`;
    const { rowIndex, colId } = this.focusedCell;
    const row = this.rowData[rowIndex];
    if (!row) return;

    row[colId] = sample;
    this.cellInfo.update(ci => ({ ...ci, value: sample }));
    this.gridApi?.refreshCells({ force: true });
    this.gridApi?.startEditingCell({ rowIndex, colKey: colId });
  }

  /** Recalcula todas las formulas con los datos actuales de las vistas. */
  private recalcFormulas(): void {
    if (!this.formulaEngine.isReady) {
      alert('Todavia no hay hojas de calculo con formulas.');
      return;
    }
    this.viewRegistry.viewNames().forEach(v => this.viewRegistry.invalidateIndexes(v));
    this.formulaEngine.recalculate();
    this.gridApi?.refreshCells({ force: true });
  }

  /**
   * El shell avisa cada vez que cambia el texto de la barra de formulas.
   * Aqui se decide que sugerir: funciones del catalogo, vistas cargadas o
   * columnas de esa vista, segun donde este el cursor.
   */
  onFormulaInput(e: { text: string; caret: number }): void {
    this.formulaSuggestions = buildFormulaSuggestions(
      e.text,
      e.caret,
      this.viewRegistry.viewNames(),
      this.viewRegistry.columnsByView(),
    );
  }

  get availableViewsFiltradas(): VistaBi[] {
    const term = this.searchVistas().toLowerCase().trim();
    if (!term) return this.availableViews();
    return this.availableViews().filter(v =>
      v.nombre.toLowerCase().includes(term) ||
      v.schemaDisplay?.toLowerCase().includes(term)
    );
  }

  // Ribbon --------------------

private colOptions = signal<Array<{ label: string; value: string }>>([]);

  // ExcelSheetConfig --------------------

readonly excelConfig = computed<ExcelSheetConfig>(() => {
    const p  = this.progress();
    const tr = this.totalRows();
    const af = this.activeFilters();

    // El encabezado se toma de la HOJA ACTIVA, no de this.vista.
    //
    // this.vista se actualiza al arrancar una carga, pero schema/viewName podian
    // quedar apuntando a otra hoja: se veia el nombre de una vista con el conteo
    // de otra ("VW Censo · 30.308 registros" cuando esas filas eran de
    // Treasury). Leyendo de la hoja activa, encabezado y pestaña no se pueden
    // desincronizar.
    const active = this.sheets().find(s => s.active);

    return {
      title: {
        documentName: active?.label || this.vista?.nombre || this.viewName,
        subtitle:     `${active?.schema || this.schema}  ${tr > 0 ? tr.toLocaleString('es-CO') + ' registros' : ''}${af.length > 0 ? `  ${af.length} filtro(s)` : ''}`,
        saveState:    p.status === 'processing' ? 'saving' : 'saved',
        secondaryActions: [
          { label: 'Cerrar', icon: 'pi pi-times', action: 'close' },
        ],
      },
      ribbonTabs: buildRibbon(this.colOptions(), this.showTotalsRow()),
      sheets: this.sheets().length > 0 ? this.sheets() : [{ id: 'datos', label: this.vista?.nombre || 'Datos', active: true }],
      statusBar: {
        readyText: this.statusLabel(),
        items: this.buildStatusBarItems(tr, af.length, p.elapsed),
        hint: this.getPerformanceHint(),
        showZoom: true,
      },
    };
  });

  /**
   * Construye los items de la barra de estado.
   * Si hay una columna seleccionada, muestra sus agregados (Promedio/Recuento/Suma)
   * al frente, como hace Excel. Si no, muestra las metricas del dataset.
   */
  private buildStatusBarItems(totalRows: number, filterCount: number, elapsed: number) {
    const nf = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: 2 });
    const stats = this.columnStats();

    const items: Array<{ key: string; label: string; value: string | number; variant?: 'default' | 'ok' | 'warn' | 'bad' }> = [];

    if (stats) {
      items.push({ key: 'stat-col', label: stats.label, value: '' });
      if (stats.numericCount > 0) {
        items.push({ key: 'stat-sum', label: 'Suma',     value: nf(stats.sum), variant: 'ok' });
        items.push({ key: 'stat-avg', label: 'Promedio', value: nf(stats.avg) });
        items.push({ key: 'stat-min', label: 'Min',      value: nf(stats.min) });
        items.push({ key: 'stat-max', label: 'Max',      value: nf(stats.max) });
      }
      items.push({ key: 'stat-count', label: 'Recuento', value: nf(stats.count) });
    }

    items.push(
      { key: 'total',   label: 'total',      value: totalRows > 0 ? nf(totalRows) : '-' },
      { key: 'visible', label: 'mostrados',  value: this.filteredRows() > 0 ? nf(this.filteredRows()) : '-' },
      { key: 'filtros', label: 'filtro(s)',  value: filterCount },
      { key: 'elapsed', label: 'seg. carga', value: elapsed > 0 ? elapsed : '-' },
      {
        key: 'memory', label: 'MB memoria',
        value: this.perfMetrics().memoryUsageMB > 0 ? this.perfMetrics().memoryUsageMB : '-',
        variant: this.perfMetrics().isNearLimit ? 'warn' : 'default',
      },
    );

    // Cuantas vistas hay cargadas (tope 5) y cuantas esperan turno en la cola
    const loaded = this.loadedViewCount();
    items.push({
      key: 'vistas',
      label: 'vistas cargadas',
      value: `${loaded}/${ViewVistasRefreshComponent.MAX_LOADED_VIEWS}`,
      variant: loaded >= ViewVistasRefreshComponent.MAX_LOADED_VIEWS ? 'warn' : 'default',
    });

    const queued = this.queuedViewCount();
    if (queued > 0) {
      items.push({ key: 'cola', label: 'en cola', value: queued, variant: 'warn' });
    }

    return items;
  }

  private getPerformanceHint(): string {
    const p = this.progress();
    const perf = this.perfMetrics();
    
    if (perf.isNearLimit) {
      return `Acercandose al limite (${perf.totalRows.toLocaleString()} registros) - Considera usar filtros`;
    }
    
    if (p.status === 'ready') {
      return `Datos cargados en ${perf.loadTimeSeconds}s  ${perf.memoryUsageMB}MB memoria  Filtros en pestana Filtros`;
    }
    
    return p.message;
  }

  private statusLabel(): string {
    const s = this.progress().status;
    const labels: Record<RefreshStatus, string> = {
      idle: 'Sin datos',
      queuing: 'Iniciando...',
      processing: 'Cargando datos...',
      downloading: 'Descargando...',
      parsing: 'Procesando...',
      ready: 'Listo',
      error: 'Error',
    };
    return labels[s] ?? 'Listo';
  }

  // -Lifecycle -
  ngOnInit(): void {
    // Soportar tanto route params (/vistaBI-refresh/:schema/:viewName) como query params (?schema=x&viewName=y)
    this.schema   = this.route.snapshot.paramMap.get('schema')   || this.route.snapshot.queryParamMap.get('schema')   || '';
    this.viewName = this.route.snapshot.paramMap.get('viewName') || this.route.snapshot.queryParamMap.get('viewName') || '';

    // Si viene de "Mis Excels", tenemos un workbookId para restaurar estado completo
    const wbId = this.route.snapshot.queryParamMap.get('workbookId');
    if (wbId) this.currentWorkbookId = Number(wbId) || null;

    console.log('[ViewVistasRefresh] ngOnInit - schema:', this.schema, 'viewName:', this.viewName,
      this.currentWorkbookId ? `workbookId:${this.currentWorkbookId}` : '');

    if (!this.schema || !this.viewName) {
      console.error('[ViewVistasRefresh] No se proporcionaron schema y viewName');
      window.close();
      return;
    }

    // Agregar listener de teclado para atajos
    this.setupKeyboardShortcuts();

    // La carga inicial ocupa el turno de la cola: si el usuario abre otra vista
    // mientras esta llega, la segunda espera en vez de pedirle dos exports a Fabric.
    this.loadInFlight = true;

    // Si tenemos un workbook guardado, restaurar su estado (hojas, filtros, zoom)
    // ANTES de cargar las vistas, asi abrimos directamente las que el usuario tenia.
    if (this.currentWorkbookId) {
      this.restoreFromWorkbook(this.currentWorkbookId);
    } else {
      this.loadMeta();
    }
  }

  ngOnDestroy(): void {
    this.clearTimers();
    // Flush final: guardar estado antes de salir
    this.saveWorkbookState();
    // Liberar el motor de formulas y las vistas registradas: los indices de
    // busqueda pueden ocupar decenas de MB por columna indexada.
    this.formulaEngine.destroy();
    this.sheets().forEach(s => { if (s.viewName) this.viewRegistry.unregister(s.viewName); });
    // Remover listener de teclado
    if (this.keyboardHandler) {
      document.removeEventListener('keydown', this.keyboardHandler);
    }
    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler);
    }
  }

  // -Atajos de teclado -
  private setupKeyboardShortcuts(): void {
    // Guardar referencia para poder removerla despues
    this.keyboardHandler = this.handleKeyboardShortcut.bind(this);
    document.addEventListener('keydown', this.keyboardHandler);
    
    // Cerrar context menu al hacer clic en cualquier parte
    this.clickHandler = () => this.closeContextMenu();
    document.addEventListener('click', this.clickHandler);
  }

  private handleKeyboardShortcut(event: KeyboardEvent): void {
    // Ctrl+C: Copiar celdas seleccionadas
    if (event.ctrlKey && event.key === 'c') {
      event.preventDefault();
      this.copySelectedCells();
      return;
    }

    // Ctrl+V: Pegar (mostrar alerta de solo lectura)
    if (event.ctrlKey && event.key === 'v') {
      event.preventDefault();
      this.showPasteAlert();
      return;
    }

    // Ctrl+F: Abrir busqueda de AG Grid
    if (event.ctrlKey && event.key === 'f') {
      event.preventDefault();
      this.openGridSearch();
      return;
    }

    // Ctrl+Home: Primera celda
    if (event.ctrlKey && event.key === 'Home') {
      event.preventDefault();
      this.goToFirstCell();
      return;
    }

    // Ctrl+End: Ãšltima celda
    if (event.ctrlKey && event.key === 'End') {
      event.preventDefault();
      this.goToLastCell();
      return;
    }

    // Delete: Limpiar filtro de columna activa
    if (event.key === 'Delete' && !event.ctrlKey && !event.shiftKey) {
      const focusedCell = this.gridApi?.getFocusedCell();
      if (focusedCell) {
        this.clearColumnFilter(focusedCell.column.getColId());
      }
      return;
    }

    // Escape: Limpiar seleccion
    if (event.key === 'Escape') {
      this.clearGridSelection();
      return;
    }
  }

  private copySelectedCells(): void {
    if (!this.gridApi) return;

    // AG Grid Community: usa filas seleccionadas o celda enfocada
    const selectedRows = this.gridApi.getSelectedRows();
    
    if (selectedRows.length > 0) {
      const visibleCols = this.gridApi.getColumns()?.filter(c => c.isVisible() && c.getColId() !== '__ROW_NUMBER__') || [];
      const headers = visibleCols.map(c => c.getColDef().headerName || c.getColId());
      const lines: string[] = [headers.join('\t')];
      
      selectedRows.forEach(row => {
        const values = visibleCols.map(c => {
          const val = (row as any)[c.getColId()];
          return val != null ? String(val) : '';
        });
        lines.push(values.join('\t'));
      });
      
      navigator.clipboard.writeText(lines.join('\n')).then(() => {
        this.showCopyFeedback(selectedRows.length);
      });
    } else {
      // Copiar solo la celda enfocada
      const focused = this.gridApi.getFocusedCell();
      if (focused) {
        const rowNode = this.gridApi.getDisplayedRowAtIndex(focused.rowIndex);
        if (rowNode) {
          const value = this.gridApi.getValue(focused.column, rowNode);
          navigator.clipboard.writeText(value != null ? String(value) : '').then(() => {
            this.showCopyFeedback(1);
          });
        }
      }
    }
  }

  private showCopyFeedback(count: number): void {
    const feedback = document.createElement('div');
    feedback.textContent = 'Copiado (' + count + (count === 1 ? ' celda)' : ' filas)');
    feedback.style.position = 'fixed';
    feedback.style.top = '20px';
    feedback.style.right = '20px';
    feedback.style.background = '#217346';
    feedback.style.color = 'white';
    feedback.style.padding = '8px 16px';
    feedback.style.borderRadius = '4px';
    feedback.style.zIndex = '10000';
    feedback.style.fontSize = '12px';
    feedback.style.fontWeight = '600';
    document.body.appendChild(feedback);
    setTimeout(() => feedback.remove(), 1500);
  }

  private showPasteAlert(): void {
    alert('Esta vista es de solo lectura. No se puede pegar contenido.');
  }

  private openGridSearch(): void {
    if (!this.gridApi) return;
    
    // AG Grid Community no tiene busqueda incorporada nativa
    // Alternativa: Usar el filtro rapido (Quick Filter)
    const searchTerm = prompt('Buscar en la tabla:');
    if (searchTerm !== null) {
      this.gridApi.setGridOption('quickFilterText', searchTerm);
    }
  }

  private clearGridSelection(): void {
    if (!this.gridApi) {
      return;
    }
    this.gridApi.clearRangeSelection();
    console.log('[Keyboard] Seleccion limpiada');
  }

  private goToFirstCell(): void {
    if (!this.gridApi || this.rowData.length === 0 || this.columnDefs.length === 0) return;
    
    // Skip row number column (index 0), go to first data column (index 1)
    const firstDataCol = this.columnDefs[1]?.field || this.columnDefs[0]?.field;
    if (!firstDataCol) return;
    
    this.gridApi.ensureIndexVisible(0, 'top');
    this.gridApi.setFocusedCell(0, firstDataCol);
    console.log('[Keyboard] Navegado a primera celda');
  }

  private goToLastCell(): void {
    if (!this.gridApi || this.rowData.length === 0 || this.columnDefs.length === 0) return;
    
    const lastRow = this.rowData.length - 1;
    const lastCol = this.columnDefs[this.columnDefs.length - 1];
    if (!lastCol?.field) return;
    
    this.gridApi.ensureIndexVisible(lastRow, 'bottom');
    this.gridApi.setFocusedCell(lastRow, lastCol.field);
    console.log('[Keyboard] Navegado a ultima celda');
  }

  private clearColumnFilter(colId: string): void {
    if (!this.gridApi) return;
    
    // getColumnFilterInstance es async en AG Grid v32+
    this.gridApi.getColumnFilterInstance(colId).then(filterInstance => {
      if (filterInstance) {
        filterInstance.setModel(null);
        this.gridApi!.onFilterChanged();
        console.log('[Keyboard] Filtro limpiado para columna:', colId);
      }
    });
    
    // Tambien limpiar de activeFilters
    this.activeFilters.update(filters => filters.filter(f => f.col !== colId));
  }

  // -Metadatos de la vista -
  private loadMeta(): void {
    this.vistasService.getVista(this.schema, this.viewName).subscribe({
      next: res => {
        this.vista = res.data;
        this.loadColumns();
      },
      error: () => this.setError('No se pudo cargar la informacion de la vista.'),
    });
  }

  private loadColumns(): void {
    console.log('[loadColumns] schema:', this.schema, 'viewName:', this.viewName);
    
    this.http.post<{ success: boolean; data: { columns: FabricColumn[] } }>(
      `${this.baseUrl}/columns`,
      { schema_name: this.schema, view_name: this.viewName }
    ).subscribe({
      next: res => {
        this.columns = res.data?.columns ?? [];
        this.colOptions.set(this.columns.map(c => ({
          label: humanizeColumnName(c.name),
          value: c.name,
        })));
        this.columnDefs = this.buildColumnDefs(this.columns);
        this.applyColumnDefs();
        console.log('[loadColumns] Columnas:', this.columns.length, 'columnDefs:', this.columnDefs.length);
        
        // Solo inicializar las hojas si no hay ninguna (primer load)
        if (this.sheets().length === 0) {
          console.log('[loadColumns] Primera carga - Inicializando hoja');
          const firstId = 'sheet-' + this.schema + '-' + this.viewName;
          this.loadTargetSheetId = firstId;
          this.sheets.set([{
            id: firstId,
            // El nombre original de la vista, igual que en Excel: la pestaña
            // dice VW_Treasury_ComprobantesEgresoTesoreria, no una version
            // recortada que no se puede rastrear en Fabric.
            label: this.viewName,
            schema: this.schema,
            viewName: this.viewName,
            active: true,
            kind: 'view',
            columns: this.columns,
          }]);
        } else {
          // Escribir en la hoja DESTINO de esta carga, no en "la activa": si el
          // usuario cambio de pestaña mientras /columns respondia, las columnas
          // se guardaban en la hoja equivocada.
          const targetId = this.loadTargetSheetId
            || this.sheets().find(s => s.active)?.id
            || '';

          this.sheets.update(sheets => {
            const target = sheets.find(s => s.id === targetId);
            if (target) {
              target.columns = this.columns;
              target.columnDefs = this.columnDefs;
            }
            // Nueva referencia: los signals comparan con Object.is, y devolver
            // el mismo array no notifica a los consumidores.
            return [...sheets];
          });
        }
        
        this.startRefresh();
      },
      error: () => {
        this.startRefresh();
      },
    });
  }

  // -FLUJO PRINCIPAL: Actualizar -

  /** Limite maximo de filas que se exportan de Fabric (protege RAM del navegador) */
  private static readonly MAX_EXPORT_ROWS = 500_000;
  /** Si la vista tiene mas de este numero de filas, obliga un filtro de fechas antes de cargar */
  private static readonly REQUIRE_FILTER_THRESHOLD = 1_000_000;

  /** Controla el panel que pide filtro obligatorio */
  readonly requiresDateFilter = signal(false);
  readonly estimatedRowCount  = signal(0);

  /** Filtro de fechas obligatorio (cuando la vista tiene >1M filas) */
  mandatoryDateFrom = '';
  mandatoryDateTo   = '';
  mandatoryDateCol  = '';

  /** Columnas tipo fecha disponibles para el filtro obligatorio */
  get dateColumnsForFilter(): Array<{ name: string; label: string }> {
    return this.columns
      .filter(c => /date|datetime|timestamp/i.test(c.type ?? ''))
      .map(c => ({ name: c.name, label: humanizeColumnName(c.name) }));
  }

  /** Punto de entrada - equivale a "Actualizar todo" o clic derecho -> Actualizar en Excel */
  startRefresh(): void {
    const p = this.progress();
    if (p.status === 'queuing' || p.status === 'processing' || p.status === 'downloading') {
      return; // Ya esta en curso
    }

    // ── Sobre qué hoja se refresca ──────────────────────────────────────────
    //
    // Si la hoja activa YA es de datos, se refresca esa y nada más.
    //
    // Antes esto hacía `find(kind === 'view')`, que devuelve la PRIMERA hoja de
    // datos. Al cargar una segunda vista, pumpLoadQueue activaba la hoja nueva
    // y acto seguido startRefresh la devolvía a la primera, reescribiendo
    // schema y viewName. Resultado: la pestaña nueva quedaba seleccionada pero
    // con los datos y el conteo de la vista anterior. El mismo error hacía que
    // "Actualizar todo" sobre la segunda pestaña recargara siempre la primera.
    const activeSheet  = this.sheets().find(s => s.active);
    const activeIsData = (activeSheet?.kind ?? 'view') === 'view' && !!activeSheet;

    if (this.sheets().length === 0) {
      // Primera carga y /columns fallo antes de crear la hoja: se refresca con
      // el schema/viewName de la ruta, que es lo unico que tenemos.
      console.warn('[startRefresh] Sin hojas todavia; se usa la vista de la ruta', this.viewName);
    } else if (activeSheet && activeIsData) {
      // Respetar la hoja activa: es la que eligió el usuario o la cola
      this.schema   = activeSheet.schema;
      this.viewName = activeSheet.viewName;
    } else {
      // Estamos en un pivot o una hoja de cálculo: saltar a la hoja de datos de
      // la vista en curso, o a la primera que haya.
      const target = this.sheets().find(s => (s.kind ?? 'view') === 'view' && s.viewName === this.viewName)
        ?? this.sheets().find(s => (s.kind ?? 'view') === 'view');

      if (!target) return; // no hay ninguna hoja de datos que refrescar

      this.sheets.update(sheets => {
        sheets.forEach(s => s.active = s.id === target.id);
        return [...sheets];
      });
      this.schema   = target.schema;
      this.viewName = target.viewName;
      this.loadTargetSheetId = target.id;
    }

    // Cerrar SOLO los pivots que salieron de esta vista: sus datos van a
    // cambiar. Antes se cerraba cualquier pivot, así que abrir una segunda
    // vista destruía la tabla dinámica de la primera sin avisar.
    const stalePivots = this.sheets().filter(s =>
      (s.kind ?? 'view') === 'pivot' && s.viewName.includes(this.viewName)
    );
    if (stalePivots.length > 0) {
      const staleIds = new Set(stalePivots.map(s => s.id));
      this.sheets.update(sheets => sheets.filter(s => !staleIds.has(s.id)));
      console.log('[startRefresh] Pivots cerrados por refresco de', this.viewName, '->', staleIds.size);
    }

    this.clearTimers();
    this.startTime = Date.now();
    this.startElapsedTimer();

    this.progress.set({
      status: 'queuing',
      message: 'Conectando con Graph-Fabric...',
      percent: 2,
      rows: 0,
      elapsed: 0,
    });

    // Lanzar export: el backend maneja R2 warm internamente.
    // force_refresh=true le dice al backend que invalide el parquet y genere uno nuevo
    this.doExport(ViewVistasRefreshComponent.MAX_EXPORT_ROWS, {}, true);
  }

  /**
   * El usuario aplico el filtro obligatorio de fechas: ahora si lanzar el export.
   */
  applyMandatoryFilter(): void {
    if (!this.mandatoryDateCol || !this.mandatoryDateFrom) {
      alert('Seleccione una columna de fecha y al menos la fecha "Desde".');
      return;
    }

    this.requiresDateFilter.set(false);
    this.startTime = Date.now();
    this.startElapsedTimer();

    this.progress.set({
      status: 'queuing',
      message: 'Iniciando descarga con filtro de fechas...',
      percent: 3,
      rows: 0,
      elapsed: 0,
    });

    const filters: Record<string, unknown> = {};
    filters[this.mandatoryDateCol] = {
      type: 'dateRange',
      from: this.mandatoryDateFrom,
      to:   this.mandatoryDateTo || undefined,
    };

    // Agregar tambien como filtro dinamico para que se vea en la UI
    const newFilter: DynamicFilter = {
      col: this.mandatoryDateCol,
      label: humanizeColumnName(this.mandatoryDateCol),
      colType: 'date',
      dateFrom: this.mandatoryDateFrom,
      dateTo: this.mandatoryDateTo || undefined,
    };
    this.activeFilters.update(fs => [...fs, newFilter]);

    this.doExport(ViewVistasRefreshComponent.MAX_EXPORT_ROWS, filters, false);
  }

  /**
   * Lanza el export asincrono a Fabric.
   * @param maxRows Limite de filas (0 = sin limite)
   * @param filters Filtros opcionales que el backend aplica en la query
   * @param forceRefresh Si true, invalida el parquet y genera uno nuevo desde Fabric
   */
  private doExport(maxRows: number, filters: Record<string, unknown>, forceRefresh = false): void {
    this.progress.update(p => ({ ...p, status: 'queuing', message: 'Verificando parquet en cache...', percent: 3 }));

    const body: Record<string, unknown> = {
      schema_name: this.schema,
      view:        this.viewName,
      format:      'xlsx',
      filters,
    };
    if (maxRows > 0) body['max_rows'] = maxRows;
    if (forceRefresh) body['force_refresh'] = true;

    this.http.post<{
      success: boolean;
      job_id?: string;
      message?: string;
      r2_status?: string;
      estimated_s?: number;
      row_count?: number;
      rows?: number;
    }>(
      `${this.baseUrl}/export/start`, body
    ).subscribe({
      next: res => {
        const r2 = res.r2_status;

        // ── R2 GENERATING: el parquet se esta creando en background ──
        if (r2 === 'generating') {
          const est = res.estimated_s ?? 60;
          this.progress.set({
            status: 'processing',
            message: `Generando parquet (~${est}s estimados)...`,
            percent: 5,
            rows: 0,
            elapsed: this.elapsed(),
          });
          this.startR2Polling(filters, maxRows);
          return;
        }

        // ── R2 TOO_BIG: requiere filtros (>1M filas) ──
        if (r2 === 'too_big') {
          this.estimatedRowCount.set(res.row_count ?? 1000000);
          this.progress.set({
            status: 'idle',
            message: `La vista tiene ~${(res.row_count ?? 1000000).toLocaleString()} registros. Aplique un filtro de fechas.`,
            percent: 0, rows: 0, elapsed: 0,
          });
          this.requiresDateFilter.set(true);
          const dateCols = this.dateColumnsForFilter;
          if (dateCols.length > 0 && !this.mandatoryDateCol) {
            this.mandatoryDateCol = dateCols[0].name;
          }
          this.releaseLoadSlot();
          return;
        }

        // ── READY (o fallback stream): tenemos job_id → polling normal ──
        if (!res.success || !res.job_id) {
          this.setError(res.message || 'No se pudo iniciar la descarga de datos.');
          return;
        }

        const source = r2 === 'ready' ? 'parquet' : 'stream';
        this.progress.set({
          status: 'processing',
          message: source === 'parquet'
            ? `Datos listos desde parquet (${(res.rows ?? 0).toLocaleString()} filas)...`
            : 'Fabric esta exportando los datos...',
          percent: source === 'parquet' ? 60 : 10,
          rows: res.rows ?? 0,
          elapsed: this.elapsed(),
          jobId: res.job_id,
        });
        this.startPolling(res.job_id);
      },
      error: (err) => {
        const msg = err?.error?.message ?? 'No se pudo conectar con el servidor.';
        this.setError(msg);
      },
    });
  }

  // ── R2 Polling: espera a que el parquet esté listo ─────────────────────────

  private r2PollTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Hace polling cada 5s al endpoint /r2/status hasta que el parquet pasa a 'ready'.
   * Cuando lo está, re-llama doExport y el backend ya sale por el fast path.
   */
  private startR2Polling(filters: Record<string, unknown>, maxRows: number): void {
    if (this.r2PollTimer) clearInterval(this.r2PollTimer);

    this.r2PollTimer = setInterval(() => {
      this.http.get<{
        success: boolean;
        r2_status: string;
        estimated_s?: number;
        row_count?: number;
        message?: string;
      }>(`${this.baseUrl}/r2/status`, {
        params: { schema: this.schema, view: this.viewName },
      }).subscribe({
        next: res => {
          const status = res.r2_status;
          console.log('[R2Poll]', status, res.message);

          if (status === 'ready' || status === 'ready_stale') {
            this.stopR2Polling();
            this.progress.update(p => ({ ...p, message: 'Parquet listo, descargando datos...', percent: 50 }));
            // No forzar: ya esta fresco
            this.doExport(maxRows, filters, false);
          } else if (status === 'too_big') {
            this.stopR2Polling();
            this.estimatedRowCount.set(res.row_count ?? 1000000);
            this.requiresDateFilter.set(true);
            this.progress.set({
              status: 'idle',
              message: `Vista demasiado grande (~${(res.row_count ?? 1000000).toLocaleString()}). Aplique filtro.`,
              percent: 0, rows: 0, elapsed: 0,
            });
            this.releaseLoadSlot();
          } else if (status === 'unavailable') {
            this.stopR2Polling();
            this.progress.update(p => ({ ...p, message: 'R2 no disponible, usando export stream...' }));
            this.doExport(maxRows, filters, false);
          } else {
            // Sigue generating: actualizar mensaje
            const est = res.estimated_s ?? 30;
            this.progress.update(p => ({
              ...p,
              message: `Generando parquet (~${est}s restantes)...`,
              elapsed: this.elapsed(),
            }));
          }
        },
        error: () => {
          this.stopR2Polling();
          this.doExport(maxRows, filters, false);
        },
      });
    }, 5000);
  }

  private stopR2Polling(): void {
    if (this.r2PollTimer) { clearInterval(this.r2PollTimer); this.r2PollTimer = null; }
  }

  cancelRefresh(): void {
    this.clearTimers();
    if (this.progress().status !== 'ready') {
      this.progress.update(p => ({
        ...p,
        status: 'idle',
        message: 'Actualizacion cancelada.',
        percent: 0,
      }));
    }
  }

  // -Polling del job -
  private startPolling(jobId: string): void {
    this.pollTimer = setInterval(() => this.checkStatus(jobId), 2500);
  }

  private checkStatus(jobId: string): void {
    this.http.get<{ success: boolean; data: Record<string, unknown> }>(
      `${this.baseUrl}/export/status/${jobId}`
    ).subscribe({
      next: res => {
        const s = res.data;
        const status = String(s['status'] ?? '');

        if (status === 'completed') {
          clearInterval(this.pollTimer!);
          this.pollTimer = null;
          this.onJobCompleted(jobId, s);
          return;
        }

        if (status === 'failed') {
          clearInterval(this.pollTimer!);
          this.pollTimer = null;
          this.setError(String(s['error'] ?? s['message'] ?? 'El export fallo en el servidor.'));
          return;
        }

        // En progreso - actualizar indicadores
        const rows    = Number(s['rows'] ?? 0);
        const pct     = Math.min(10 + (rows / 5000), 75); // heuristica progreso
        const progMsg = String(s['message'] ?? 'Exportando datos desde Fabric...');

        this.progress.update(p => ({
          ...p,
          status: 'processing',
          message: progMsg,
          percent: Math.round(pct),
          rows,
          elapsed: this.elapsed(),
        }));
      },
      error: () => {
        // No matar el polling por un error de red puntual - reintentar en el proximo tick
      },
    });
  }

  private onJobCompleted(jobId: string, statusData: Record<string, unknown>): void {
    const rows = Number(statusData['rows'] ?? 0);

    this.progress.set({
      status: 'downloading',
      message: `Descargando ${rows.toLocaleString('es-CO')} registros...`,
      percent: 78,
      rows,
      elapsed: this.elapsed(),
      jobId,
    });

    // Para pintar la grilla se descarga el NDJSON crudo (~12 MB), NO el xlsx
    // de 200+ MB. Parsear ese xlsx en el navegador con SheetJS consumia varios
    // GB de RAM y congelaba la pagina. El xlsx queda en el servidor y se baja
    // solo cuando el usuario pulsa "Descargar Excel" (as=file, sin parsear).
    const token = localStorage.getItem('token') ?? '';
    this.http.get(
      `${this.baseUrl}/export/download/${jobId}?as=data&token=${encodeURIComponent(token)}`,
      { responseType: 'blob', observe: 'response' }
    ).subscribe({
      next: response => {
        // El header puede venir null si CORS no lo expone: no se asume 'xlsx'.
        // parseBlob decide por magic bytes; esto es solo una pista para el log.
        const format = response.headers.get('X-Export-Format') ?? '';
        const blob   = response.body!;

        console.log('[Download] blob recibido', {
          bytes: blob.size,
          contentType: blob.type,
          formatHeader: format || '(no expuesto por CORS)',
        });

        this.progress.set({
          status: 'parsing',
          message: 'Procesando datos...',
          percent: 88,
          rows,
          elapsed: this.elapsed(),
          jobId,
        });

        // Parsear en el proximo tick para no bloquear el render del progreso
        setTimeout(() => this.parseAndLoad(blob, format, rows), 10);
      },
      error: (err) => {
        // No mostrar error si los datos ya se cargaron exitosamente
        if (this.rowData.length > 0 && this.progress().status === 'ready') {
          console.warn('[Download] Error ignorado porque datos ya cargados:', err.status);
          return;
        }
        const msg = err?.error?.message ?? `Error al descargar el archivo (HTTP ${err.status}).`;
        this.setError(msg);
      },
    });
  }

  // -Parseo del archivo -
  private async parseAndLoad(blob: Blob, format: string, expectedRows: number): Promise<void> {
    try {
      this.progress.update(p => ({ ...p, status: 'parsing', message: 'Procesando datos...', percent: 75 }));

      // Ceder un frame para que el browser pinte el progreso antes del parseo pesado
      await new Promise(r => setTimeout(r, 0));

      const data = await this.parseBlob(blob, format, expectedRows);

      if (data.length === 0) {
        this.setError('El archivo descargado esta vacio.');
        return;
      }

      // Guarda: si las filas llegaron pero SIN campos, el parseo fallo (por
      // ejemplo el gzip no se descomprimio bien). Antes esto pintaba la grilla
      // con encabezados y todas las celdas vacias, sin ningun aviso.
      const primeraFilaCampos = Object.keys(data[0] ?? {}).length;
      if (primeraFilaCampos === 0) {
        this.setError(
          'Los datos llegaron pero no se pudieron interpretar (0 campos por fila). ' +
          'Reintente con "Actualizar todo".'
        );
        return;
      }

      // Guarda anti-binario: si los nombres de campo traen caracteres de control
      // es que se parseo un stream comprimido como si fuera texto. Antes esto
      // pintaba la grilla con columnas tipo "Õÿù¯?þí/ðjõ" y 19.000 filas de
      // basura, sin ningun aviso al usuario.
      const clavesBinarias = Object.keys(data[0]).filter(k => /[\x00-\x08\x0E-\x1F\x7F]/.test(k));
      if (clavesBinarias.length > 0) {
        console.error('[parseAndLoad] Claves binarias detectadas:', clavesBinarias.slice(0, 3));
        this.setError(
          'El archivo descargado no se pudo decodificar (contenido binario sin descomprimir). ' +
          'Reintente con "Actualizar todo".'
        );
        return;
      }

      console.log('[parseAndLoad] Filas:', data.length, '| Cols:', Object.keys(data[0] ?? {}).length);
      this.rawData = data;

      if (this.columnDefs.length === 0) {
        this.columnDefs = this.inferColumnDefs(data);
        this.applyColumnDefs();
      } else if (!this.columnDefsMatchData(data)) {
        // Las columnas venian del endpoint /columns pero sus `field` no coinciden
        // con las claves reales de los datos: AG Grid pintaba los encabezados y
        // dejaba TODAS las celdas vacias. Se reconstruyen desde los datos.
        console.warn('[parseAndLoad] Los campos de las columnas no coinciden con los datos; se reconstruyen desde el dataset');
        this.columnDefs = this.inferColumnDefs(data);
        this.applyColumnDefs();
      }

      // Registrar para BUSCARVISTA
      this.registerActiveViewForFormulas(data);
      this.totalRows.set(data.length);

      // ── Destino de estos datos ────────────────────────────────────────────
      // Se fija la hoja a la que pertenece la carga. Si el usuario cambio de
      // pestaña mientras cargaba, los datos se guardan en su hoja pero NO se
      // pintan, para no sobreescribir lo que esta viendo.
      const targetId = this.loadTargetSheetId
        || this.sheets().find(s => s.active)?.id
        || '';
      const targetIsActive = () => this.sheets().find(s => s.active)?.id === targetId;

      // Guardar de una en la hoja destino: aunque el usuario se vaya a otra
      // pestaña, al volver los datos ya estan ahi.
      this.saveSheetData(targetId, data, this.columnDefs);

      if (!targetIsActive()) {
        console.log('[parseAndLoad] La hoja destino ya no esta activa; datos guardados sin pintar la grilla',
          { targetId, activa: this.sheets().find(s => s.active)?.id });

        this.registerActiveViewForFormulas(data);
        this.clearTimers();
        this.progress.set({
          status: 'ready',
          message: data.length.toLocaleString('es-CO') + ' registros cargados',
          percent: 100,
          rows: data.length,
          elapsed: this.elapsed(),
        });
        this.releaseLoadSlot();
        return;
      }

      // --- Carga progresiva: evita congelar el navegador con 64K+ filas ---
      const FIRST_CHUNK = 1000;
      const CHUNK_SIZE  = 10000;

      // 1. Primer chunk rapido: el usuario ve datos en <1s
      const firstSlice = data.slice(0, Math.min(FIRST_CHUNK, data.length));
      this.rowData = firstSlice;
      this.filteredRows.set(firstSlice.length);

      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', firstSlice);
        this.autoSizeColumns();
      }

      // 2. Chunks restantes con pausas de 30ms entre cada uno
      if (data.length > FIRST_CHUNK) {
        let offset = FIRST_CHUNK;
        while (offset < data.length) {
          await new Promise(r => setTimeout(r, 30));

          // El usuario pudo cambiar de pestaña a mitad del troceado: dejar de
          // pintar en la grilla de otra hoja.
          if (!targetIsActive()) {
            console.log('[parseAndLoad] Cambio de pestaña durante la carga; se deja de pintar');
            break;
          }

          offset = Math.min(offset + CHUNK_SIZE, data.length);
          this.rowData = data.slice(0, offset);
          this.filteredRows.set(offset);
          if (this.gridApi) {
            this.gridApi.setGridOption('rowData', this.rowData);
          }
          this.progress.update(p => ({
            ...p,
            message: 'Cargando ' + offset.toLocaleString() + ' / ' + data.length.toLocaleString() + ' filas...',
            percent: 75 + Math.round((offset / data.length) * 20),
          }));
        }
      }

      // 3. Finalizar: aplicar filtros y marcar como listo
      this.rowData = data;
      this.filteredRows.set(data.length);
      this.applyFiltersToGrid();
      this.updatePerformanceMetrics();
      this.loadWorkbookState();

      this.clearTimers();
      this.progress.set({
        status: 'ready',
        message: data.length.toLocaleString('es-CO') + ' registros cargados',
        percent: 100,
        rows: data.length,
        elapsed: this.elapsed(),
      });

      this.releaseLoadSlot();
      this.saveWorkbookState();

      setTimeout(() => {
        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.rowData);
          this.autoSizeColumns();
        }
      }, 50);

      // Validar que el parquet coincida con la vista real (detectar parquet stale/corrupto)
      this.validateRowCountAgainstView(data.length);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error procesando el archivo.';
      this.setError('Error al procesar los datos: ' + msg);
    }
  }

  /** Señal para avisar en la UI si el parquet no coincide con la vista real */
  readonly parquetMismatch = signal<{ loaded: number; actual: number } | null>(null);

  /**
   * Compara las filas cargadas (del parquet) contra el conteo real de la vista SQL.
   * Si difieren más del 10%, avisa que el parquet puede estar desactualizado.
   * No bloquea: solo informa para que el usuario pueda "Actualizar todo".
   */
  private validateRowCountAgainstView(loadedRows: number): void {
    // Solo para hojas de datos (no pivots ni hojas de calculo), y sin filtros activos
    const activeSheet = this.sheets().find(s => s.active);
    if ((activeSheet?.kind ?? 'view') !== 'view') return;
    if (this.activeFilters().length > 0) return; // con filtros el conteo no debe coincidir

    this.http.post<{ success: boolean; estimated_rows?: number; total?: number }>(
      `${this.baseUrl}/estimate-rows`,
      { schema_name: this.schema, view: this.viewName }
    ).subscribe({
      next: res => {
        // El endpoint devuelve `count` (no `estimated_rows` ni `total`)
        const actual = (res as any).count ?? res.estimated_rows ?? res.total ?? 0;
        if (actual <= 0) { this.parquetMismatch.set(null); return; }

        const diff = Math.abs(loadedRows - actual) / actual;
        if (diff > 0.10) {
          console.warn('[Validacion] Parquet no coincide con vista:', { loaded: loadedRows, actual });
          this.parquetMismatch.set({ loaded: loadedRows, actual });
        } else {
          this.parquetMismatch.set(null);
        }
      },
      // El endpoint es opcional: si no existe (404) o falla, no interrumpir nada.
      error: () => this.parquetMismatch.set(null),
    });
  }
  /**
   * Parsea el blob descargado. Detecta automaticamente si es xlsx o CSV.
   *
   * - xlsx (lo que genera el backend Laravel con StreamingExportWriter):
   *   -> SheetJS lee el archivo binario directamente, sin errores de codificacion.
   *
   * - CSV / gzip-CSV (fallback del backend o R2 directo):
   *   -> Parser manual con soporte BOM UTF-8 y delimitador auto-detectado.
   */
  private async parseBlob(blob: Blob, format: string, expectedRows: number): Promise<Record<string, unknown>[]> {
    // ── El formato se decide por MAGIC BYTES, nunca por el header HTTP ───────
    //
    // Por qué: el frontend (jade.medilaser.com.co) y la API
    // (jade-api.medilaser.com.co) son origenes distintos, asi que aplica CORS.
    // Los headers de respuesta personalizados solo son legibles desde JS si el
    // servidor los declara en Access-Control-Expose-Headers. Como no lo hacia,
    // `X-Export-Format` llegaba como null y el `?? 'xlsx'` del llamador daba
    // 'xlsx' SIEMPRE — incluso cuando el body era el NDJSON.gz que sirve
    // `?as=data`. Resultado: se le pasaba un gzip a SheetJS, que lo interpretaba
    // como texto plano y lo partia por los saltos de linea que aparecen dentro
    // del binario. De ahi salian ~19.000 "filas" con 2 "columnas" cuyos nombres
    // eran bytes comprimidos (Õÿù¯?þí/ðjõ...).
    //
    // Los magic bytes no dependen de CORS ni de proxies, asi que mandan ellos.
    const header = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
    const hex    = Array.from(header).map(b => b.toString(16).padStart(2, '0')).join(' ');

    const isZip  = header[0] === 0x50 && header[1] === 0x4B; // 'PK' -> xlsx (ZIP)
    const isGzip = header[0] === 0x1F && header[1] === 0x8B; // gzip
    // NDJSON/JSON plano: '{' o, si trae BOM UTF-8, EF BB BF seguido de '{'
    const isText = header[0] === 0x7B
      || (header[0] === 0xEF && header[1] === 0xBB && header[2] === 0xBF);

    console.log('[parseBlob] primeros bytes:', hex, '| formatHeader:', format || '(vacio)',
      '|', isZip ? 'ZIP/xlsx' : isGzip ? 'gzip' : isText ? 'texto' : 'DESCONOCIDO');

    if (isZip) {
      // xlsx real: el `?as=file` del backend, o un R2 que devuelva xlsx.
      return this.parseXlsxBlob(blob);
    }

    if (isText) {
      // Camino normal desde el fix del backend: NDJSON plano. Si Apache lo
      // comprimio con Content-Encoding: gzip, el navegador ya lo decodifico.
      return this.parseCsvBlob(blob, false);
    }

    if (isGzip) {
      // Backend anterior (o R2 directo): NDJSON.gz que toca descomprimir aqui.
      return this.parseCsvBlob(blob, true);
    }

    // Ni ZIP, ni gzip, ni texto plano. Esto ocurre cuando una capa fuera de
    // nuestro control (Cloudflare, un proxy inverso) recomprime la respuesta y
    // borra el Content-Encoding: el navegador entrega bytes comprimidos que no
    // supo decodificar. No podemos arreglar esa capa desde aqui, asi que se
    // intenta descomprimir manualmente por deflate (raw e zlib) antes de rendir.
    console.error(
      '[parseBlob] Formato no reconocido (ni ZIP, ni gzip, ni texto). ' +
      'Probable recompresion sin Content-Encoding. Primeros 16 bytes:', hex,
      '- intentando descompresion manual...'
    );

    const recuperado = await this.tryDecompressUnknown(blob);
    if (recuperado !== null) {
      console.warn('[parseBlob] Recuperado con descompresion manual:', recuperado.encoding);
      return this.parseCsvBlob(new Blob([recuperado.text]), false);
    }

    // No se pudo recuperar: se procesa como texto y la guarda de parseAndLoad
    // corta con un error claro si sale basura.
    return this.parseCsvBlob(blob, false);
  }

  /**
   * Ultimo recurso cuando el body llega comprimido sin Content-Encoding.
   *
   * Un proxy puede comprimir con gzip o deflate y "olvidar" declararlo. El
   * navegador no lo decodifica y nos entrega bytes crudos. Se prueba cada
   * formato que DecompressionStream soporta; el primero que produzca texto que
   * empiece por '{' o BOM es el bueno. Brotli no se puede: los navegadores no
   * exponen su descompresion a JS, asi que ese caso solo se arregla en Apache.
   *
   * @returns el texto y el encoding acertado, o null si ninguno funciono.
   */
  private async tryDecompressUnknown(blob: Blob): Promise<{ text: string; encoding: string } | null> {
    const formatos: Array<'gzip' | 'deflate' | 'deflate-raw'> = ['gzip', 'deflate', 'deflate-raw'];

    for (const encoding of formatos) {
      try {
        const ds     = new DecompressionStream(encoding);
        const stream = blob.stream().pipeThrough(ds);
        const text   = await new Response(stream).text();

        // Validar que el resultado sea NDJSON/JSON real, no basura casual
        const head = text.trimStart();
        if (head.startsWith('{') || head.charCodeAt(0) === 0xFEFF) {
          return { text, encoding };
        }
      } catch {
        // Este formato no aplica: probar el siguiente
      }
    }

    return null;
  }

  /** Parsea xlsx usando SheetJS - maneja correctamente fechas, numeros y strings.
   *
   * El backend (StreamingExportWriter) genera xlsx con filas de encabezado
   * corporativo antes de los datos (titulo, fecha, etc.). Detectamos la fila
   * real de headers buscando la primera fila cuyos valores coinciden con las
   * columnas conocidas del backend, o que no contiene __EMPTY keys.
   */
  private async parseXlsxBlob(blob: Blob): Promise<Record<string, unknown>[]> {
    const arrayBuffer = await blob.arrayBuffer();
    const workbook    = XLSX.read(arrayBuffer, { type: 'array', cellDates: true, dense: false });

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];

    const sheet = workbook.Sheets[sheetName];

    // Leer con header:1 para obtener arrays de filas (sin que SheetJS asigne
    // nombres automaticos __EMPTY_N a las columnas vacias)
    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: null,
      raw:    false,
    });

    if (rawRows.length < 2) return [];

    // ── Estructura conocida del backend ─────────────────────────────────────
    // Todos los escritores del backend (FastXlsxWriter, StreamingExportWriter,
    // SpoutXlsxWriter) generan una portada corporativa:
    //
    //   Fila 1 → "JadeOne — schema.VW_..."    (título)
    //   Fila 2 → "Exportado: dd/mm/yyyy HH:mm" (info)
    //   Fila 3 → headers reales               ← FastXlsxWriter / SpoutXlsxWriter
    //   Fila 4 → headers reales               ← StreamingExportWriter (PhpSpreadsheet)
    //   Fila 3+ → datos
    //
    // El algoritmo anterior usaba un umbral de coincidencias que fallaba cuando
    // knownCols estaba vacío o el título coincidía antes de la fila real.
    // Ahora buscamos la fila con el MAYOR número de coincidencias con los
    // nombres de columna del backend entre las primeras MAX_SCAN filas.
    // ────────────────────────────────────────────────────────────────────────

    const knownCols = new Set(this.columns.map(c => c.name.toLowerCase().trim()));
    const MAX_SCAN  = 10;

    // Palabras que solo aparecen en filas de portada — nunca en headers reales
    const COVER_MARKERS = ['jadejone', 'jadeone', 'exportado:', 'registros:'];

    const isCoverRow = (row: (string | null)[]): boolean => {
      const text = row.filter(v => v != null).map(v => String(v).toLowerCase()).join(' ');
      return COVER_MARKERS.some(m => text.includes(m));
    };

    let headerRowIdx = -1;

    if (knownCols.size > 0) {
      // Con columnas conocidas: elegir la fila con más coincidencias exactas
      // (no la primera que alcanza un umbral — eso fallaba con el título).
      let bestIdx     = -1;
      let bestMatches = 0;

      for (let i = 0; i < Math.min(rawRows.length, MAX_SCAN); i++) {
        const row      = rawRows[i] as (string | null)[];
        const nonEmpty = row.filter(v => v !== null && String(v).trim() !== '');
        if (nonEmpty.length === 0 || isCoverRow(row)) continue;

        const matches = nonEmpty.filter(v =>
          knownCols.has(String(v).toLowerCase().trim())
        ).length;

        if (matches > bestMatches) {
          bestMatches = matches;
          bestIdx     = i;
        }
      }

      // Exigir al menos 1 coincidencia para aceptar la fila candidata
      if (bestMatches >= 1) headerRowIdx = bestIdx;

    } else {
      // Sin columnas conocidas: primera fila con ≥3 celdas no vacías que
      // no sea portada corporativa y no parezca metadato.
      for (let i = 0; i < Math.min(rawRows.length, MAX_SCAN); i++) {
        const row      = rawRows[i] as (string | null)[];
        const nonEmpty = row.filter(v => v !== null && String(v).trim() !== '');
        if (nonEmpty.length < 3 || isCoverRow(row)) continue;

        headerRowIdx = i;
        break;
      }
    }

    // Último recurso: la posición de los headers depende del writer del backend
    //   generateXlsxFromCsv (OpenSpout)   → fila 1  (índice 0, SIN portada)
    //   FastXlsxWriter con portada        → fila 3  (índice 2)
    //   writeXlsx (PhpSpreadsheet)        → fila 4  (índice 3)
    // Por eso no se puede fijar un índice: se toma la primera fila no-portada
    // con más celdas no vacías.
    if (headerRowIdx === -1) {
      let bestIdx = 0;
      let bestLen = -1;
      for (let i = 0; i < Math.min(rawRows.length, MAX_SCAN); i++) {
        const row = rawRows[i] as (string | null)[];
        if (isCoverRow(row)) continue;
        const len = row.filter(v => v !== null && String(v).trim() !== '').length;
        if (len > bestLen) { bestLen = len; bestIdx = i; }
      }
      headerRowIdx = bestIdx;
      console.warn('[parseXlsxBlob] No se detectó fila de headers; usando fila con más celdas:',
        headerRowIdx, `(${bestLen} celdas)`);
    }

    const headers = (rawRows[headerRowIdx] as (string | null)[])
      .map(h => (h !== null ? String(h).trim() : ''));

    const result: Record<string, unknown>[] = [];

    for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
      const row = rawRows[i] as unknown[];
      // Saltar filas completamente vacías
      if (row.every(v => v === null || v === '')) continue;

      const obj: Record<string, unknown> = {};
      for (let j = 0; j < headers.length; j++) {
        const key = headers[j];
        if (key) obj[key] = row[j] ?? null;
      }
      result.push(obj);
    }

    console.log('[parseXlsxBlob] headerRowIdx:', headerRowIdx,
      '| headers:', headers.slice(0, 5),
      '| totalHeaders:', headers.filter(h => h).length,
      '| filas:', result.length);

    return result;
  }

  /**
   * Parsea CSV con soporte para BOM UTF-8, delimitador ';' (el que usa R2CacheService),
   * valores con comillas y campos multi-linea. Soporte gzip.
   */
  private async parseCsvBlob(blob: Blob, isGzip: boolean): Promise<Record<string, unknown>[]> {
    let text: string;

    if (isGzip) {
      // Descomprimir el gzip y leer como texto UTF-8 explícito.
      // new Response(stream).blob().then(.text()) usaba la codificación por defecto
      // del blob, que en algunos navegadores no es UTF-8: resultaba en ÃƒÂ¡ en vez
      // de á (UTF-8 interpretado como Latin-1 / doble encoding).
      try {
        const ds     = new DecompressionStream('gzip');
        const stream = blob.stream().pipeThrough(ds);
        text = await new Response(stream).text();
      } catch {
        // El navegador o el proxy ya descomprimió el gzip antes de entregarlo a
        // Angular: el blob ya es texto plano. Leer directamente.
        console.warn('[parseCsvBlob] DecompressionStream falló, el gzip ya estaba descomprimido');
        text = await blob.text();
      }
    } else {
      text = await blob.text();
    }

    // Quitar BOM UTF-8
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

    // NDJSON: el export async de Graph devuelve una fila JSON por linea.
    // Se detecta porque el contenido arranca con '{' (no es CSV).
    if (text.trimStart().startsWith('{')) {
      return this.parseNdjsonText(text);
    }

    // Saltar linea "sep=X" que algunos CSV incluyen para Excel
    if (text.startsWith('sep=')) {
      text = text.slice(text.indexOf('\n') + 1);
    }

    // Detectar delimitador: ';' o ','
    const firstLine = text.slice(0, text.indexOf('\n'));
    const delim     = (firstLine.split(';').length > firstLine.split(',').length) ? ';' : ',';

    return this.parseCsvText(text, delim);
  }

  /**
   * Parser NDJSON: una fila JSON por linea (formato del export async de Graph).
   * Las lineas corruptas se saltan para no perder todo el dataset.
   */
  private parseNdjsonText(text: string): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = [];
    for (const line of text.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      try {
        const obj = JSON.parse(t);
        if (obj && typeof obj === 'object') out.push(obj as Record<string, unknown>);
      } catch { /* saltar linea corrupta */ }
    }
    return out;
  }

  /** Parser CSV manual, sin librerias externas */
  private parseCsvText(csv: string, delim: string): Record<string, unknown>[] {
    const lines   = csv.split('\n');
    if (lines.length < 2) return [];

    const headers = this.parseCsvLine(lines[0], delim);
    const result: Record<string, unknown>[] = [];

    // Procesar en lotes de 10k para no bloquear el hilo principal
    const total = lines.length;
    for (let i = 1; i < total; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values  = this.parseCsvLine(line, delim);
      const row: Record<string, unknown> = {};

      for (let j = 0; j < headers.length; j++) {
        const raw = values[j] ?? '';
        row[headers[j]] = this.coerceValue(raw);
      }

      result.push(row);
    }

    return result;
  }

  private parseCsvLine(line: string, delim: string): string[] {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === delim && !inQuotes) {
        result.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur);
    return result;
  }

  /** Convierte string a tipo JS apropiado */
  private coerceValue(raw: string): unknown {
    if (raw === '' || raw === 'NULL' || raw === 'null') return null;
    // Numero
    if (/^-?\d+(\.\d+)?$/.test(raw) && raw.length < 16) {
      const n = Number(raw);
      return isNaN(n) ? raw : n;
    }
    // ISO date
    if (/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2})?/.test(raw)) return raw;
    return raw;
  }

  // -Columnas -
  private buildColumnDefs(cols: FabricColumn[]): ColDef[] {
    console.group('[buildColumnDefs] Construyendo columnDefs desde metadatos backend');
    console.log('Columnas recibidas:', cols.length);
    
    const result: ColDef[] = [
      // -… Columna de numeros de fila (como Excel: 1, 2, 3...)
      {
        headerName: '',
        field: '__ROW_NUMBER__',
        width: 60,
        minWidth: 60,
        maxWidth: 60,
        resizable: false,
        sortable: false,
        filter: false,
        pinned: 'left',
        lockPinned: true,
        cellClass: 'bi-cell-row-number',
        headerClass: 'excel-corner-header',
        valueGetter: (params) => params.node?.rowIndex != null ? params.node.rowIndex + 1 : '',
        cellStyle: {
          fontWeight: 'bold',
          color: '#666',
          textAlign: 'center',
          backgroundColor: '#f9fafb',
          borderRight: '1px solid #d1d5db',
        },
      },
    ];

    // Agregar las columnas reales de datos (sin letra en headerName, usaremos CSS)
    const dataCols = cols.map((col, index) => {
      const type = getColumnType(col.type);
      
      // Detectar si es una columna "larga"
      const isLongText = type === 'text' && (
        col.name.toLowerCase().includes('observ') ||
        col.name.toLowerCase().includes('descrip') ||
        col.name.toLowerCase().includes('detalle') ||
        col.name.toLowerCase().includes('nota') ||
        col.name.toLowerCase().includes('comentario')
      );

      const base: ColDef = {
        field:     col.name,
        headerName: humanizeColumnName(col.name), // La letra Excel va en el grupo padre
        cellClass:  `bi-cell bi-cell--${type}`,
        headerClass: 'excel-name-header',
        filter: type === 'date' ? ExcelDateFilterComponent : ExcelColumnFilterComponent,
        filterParams: { maxDisplayedValues: 50 },
        width: isLongText ? 280 : undefined,
        minWidth: isLongText ? 180 : 100,
        maxWidth: isLongText ? 500 : 400,
        cellStyle: {
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        },
      };

      if (type === 'number') {
        base.type = 'numericColumn';
        base.valueFormatter = (p) => p.value != null
          ? Number(p.value).toLocaleString('es-CO', { maximumFractionDigits: 2 })
          : '';
      }

      if (type === 'date') {
        base.valueFormatter = (p) => {
          if (!p.value) return '';
          const s = String(p.value).replace('T', ' ');
          return s.length > 10 ? s.slice(0, 16) : s;
        };
      }

      if (type === 'date') {
        console.log(`  -“ Columna fecha detectada: ${col.name} (${col.type}) -> ExcelDateFilterComponent`);
      }

      return base;
    });

    result.push(...dataCols);

    console.log('columnDefs generados:', result.length);
    console.log('Filtros de fecha asignados:', result.filter(c => c.filter === ExcelDateFilterComponent).length);
    console.groupEnd();
    
    return result;
  }

  /**
   * Convierte un indice numerico a letra de columna Excel (0->A, 1->B, ..., 25->Z, 26->AA, etc.)
   */
  private getExcelColumnLetter(index: number): string {
    let letter = '';
    let num = index + 1; // Excel es 1-indexed (A=1, B=2, etc.)
    
    while (num > 0) {
      const remainder = (num - 1) % 26;
      letter = String.fromCharCode(65 + remainder) + letter;
      num = Math.floor((num - 1) / 26);
    }
    
    return letter;
  }

  /**
   * Envuelve cada columna de datos en un grupo cuyo encabezado es su letra Excel.
   * AG Grid renderiza entonces dos filas de encabezado:
   *   fila 1 (group header)  -> A, B, C, D...
   *   fila 2 (column header) -> SOURCE, Llave, FechaNacimiento...
   * La columna de numeros de fila queda sin grupo y abarca ambas filas.
   */
  private toGroupedColumnDefs(flat: ColDef[]): (ColDef | ColGroupDef)[] {
    const out: (ColDef | ColGroupDef)[] = [];
    let letterIndex = 0;

    for (const col of flat) {
      // La columna de numeros de fila no lleva letra
      if (col.field === '__ROW_NUMBER__') {
        out.push(col);
        continue;
      }

      const letter = this.getExcelColumnLetter(letterIndex);
      letterIndex++;

      out.push({
        headerName: letter,
        groupId: `grp_${letter}`,
        marryChildren: true,
        headerClass: 'excel-letter-header',
        children: [col],
      } as ColGroupDef);
    }

    return out;
  }

  /**
   * Recalcula la version agrupada y la entrega al grid.
   * Unico punto por el que se actualizan las columnas de AG Grid.
   */
  private applyColumnDefs(): void {
    this.gridColumnDefs = this.toGroupedColumnDefs(this.columnDefs);
    this.gridApi?.setGridOption('columnDefs', this.gridColumnDefs);
  }

  /**
   * ¿Los `field` de las columnas actuales existen de verdad en los datos?
   *
   * Las columnas se construyen con los metadatos de /columns, pero los datos
   * llegan del NDJSON del export. Si los nombres no coinciden (mayusculas,
   * alias, columnas renombradas en la vista), AG Grid pinta los encabezados y
   * deja TODAS las celdas vacias, que es justo el sintoma que veiamos.
   *
   * Se considera que coinciden si al menos la mitad de las columnas de datos
   * aparecen como clave en la primera fila.
   */
  private columnDefsMatchData(data: Record<string, unknown>[]): boolean {
    if (data.length === 0) return true;

    // Comparar case-insensitive: el xlsx puede capitalizar diferente a los
    // metadatos del backend (ej. "FechaComprobante" vs "fechacomprobante").
    const dataKeysLower = new Set(Object.keys(data[0]).map(k => k.toLowerCase()));
    const dataFields = this.columnDefs
      .map(c => c.field)
      .filter((f): f is string => !!f && f !== '__ROW_NUMBER__');

    if (dataFields.length === 0) return false;

    const matches = dataFields.filter(f => dataKeysLower.has(f.toLowerCase())).length;
    const ratio   = matches / dataFields.length;

    if (ratio < 0.5) {
      console.warn('[columnDefsMatchData] Coincidencia baja:', {
        columnas: dataFields.slice(0, 5),
        clavesDatos: Object.keys(data[0]).slice(0, 5),
        coinciden: matches,
        de: dataFields.length,
        ratio: ratio.toFixed(2),
      });
    }

    return ratio >= 0.5;
  }

  private inferColumnDefs(data: Record<string, unknown>[]): ColDef[] {
    if (!data.length) return [];

    // ── Caso 1: tenemos metadatos del backend (this.columns) pero los nombres
    //    del xlsx difieren en capitalización (ej. "FECHACOMPROBANTE" vs "FechaComprobante").
    //    Remap las claves del primer row para que coincidan con los nombres exactos
    //    del backend, y reusar buildColumnDefs que ya tiene la lógica de tipos/filtros.
    if (this.columns.length > 0) {
      const dataKeys   = Object.keys(data[0]);
      const dataLower  = new Map(dataKeys.map(k => [k.toLowerCase(), k]));
      const colLower   = new Map(this.columns.map(c => [c.name.toLowerCase(), c.name]));

      // ¿Cuántos nombres del backend aparecen en el xlsx (ignorando caso)?
      const remapCount = this.columns.filter(c => dataLower.has(c.name.toLowerCase())).length;

      if (remapCount >= Math.ceil(this.columns.length * 0.5)) {
        // Hay suficiente superposición: renombrar las filas para que las claves
        // coincidan exactamente con los nombres del backend y usar buildColumnDefs.
        console.log('[inferColumnDefs] Remapeando claves del xlsx a nombres exactos del backend',
          { columnas: this.columns.length, remapeadas: remapCount });

        // Renombrar in-place en todos los rows
        for (const row of data) {
          for (const dataKey of dataKeys) {
            const backendName = colLower.get(dataKey.toLowerCase());
            if (backendName && backendName !== dataKey) {
              row[backendName] = row[dataKey];
              delete row[dataKey];
            }
          }
        }

        // Ahora los datos tienen las claves exactas del backend → buildColumnDefs funciona
        return this.buildColumnDefs(this.columns);
      }
    }

    // ── Caso 2: no hay metadatos del backend, inferir todo desde los datos ──
    console.warn('[inferColumnDefs] Infiriendo columnas desde datos - NO se usaron metadatos del backend');

    const sample = data.slice(0, 20);

    // La columna de numeros de fila (como Excel) tiene que ir siempre primero.
    // Antes se perdia al inferir columnas desde los datos.
    const out: ColDef[] = [{
      headerName: '',
      field: '__ROW_NUMBER__',
      width: 60, minWidth: 60, maxWidth: 60,
      resizable: false, sortable: false, filter: false,
      pinned: 'left', lockPinned: true,
      cellClass: 'bi-cell-row-number',
      headerClass: 'excel-corner-header',
      valueGetter: (params) => params.node?.rowIndex != null ? params.node.rowIndex + 1 : '',
      cellStyle: {
        fontWeight: 'bold',
        color: '#666',
        textAlign: 'center',
        backgroundColor: '#f9fafb',
        borderRight: '1px solid #d1d5db',
      },
    }];

    const dataCols = Object.keys(data[0])
      .filter(key => key !== '__ROW_NUMBER__')
      .map(key => {
      const vals  = sample.map(r => r[key]).filter(v => v != null);
      const isNum = vals.length > 0 && vals.every(v => typeof v === 'number');
      
      // Detectar fechas: valores que parecen ISO date strings
      const isDate = !isNum && vals.length > 0 && vals.every(v => {
        if (typeof v !== 'string') return false;
        return /^\d{4}-\d{2}-\d{2}/.test(v); // YYYY-MM-DD...
      });

      const colType = isDate ? 'date' : (isNum ? 'number' : 'text');

      if (isDate) {
        console.log(`  -“ [inferColumnDefs] Fecha detectada en datos: ${key} (primeros valores:`, vals.slice(0, 3), ')');
      }

      const colDef: ColDef = {
        field: key,
        headerName: humanizeColumnName(key),
        type:   isNum ? 'numericColumn' : undefined,
        // -… Asignar filtro especifico segun tipo detectado
        filter: isDate ? ExcelDateFilterComponent : ExcelColumnFilterComponent,
        filterParams: { maxDisplayedValues: 50 },
        cellClass: `bi-cell bi-cell--${colType}`,
      };

      // Formatear fechas para que se vean bien en la grilla
      if (isDate) {
        colDef.valueFormatter = (p) => {
          if (!p.value) return '';
          const s = String(p.value).replace('T', ' ');
          return s.length > 10 ? s.slice(0, 16) : s;
        };
      }

      return colDef;
    });

    out.push(...dataCols);

    return out;
  }

  // -Filtros dinamicos -
  /** Aplica todos los filtros activos a rawData y actualiza la grilla */
  applyFiltersToGrid(): void {
    const filters = this.activeFilters();
    if (!filters.length) {
      this.rowData = [...this.rawData];
      this.filteredRows.set(this.rawData.length);
    } else {
      const filtered = this.rawData.filter(row =>
        filters.every(f => this.rowMatchesFilter(row, f))
      );
      this.rowData = [...filtered];
      this.filteredRows.set(filtered.length);
    }

    // Recalcular totales si estan activados
    if (this.showTotalsRow()) {
      this.updateTotalsRow();
    }
  }

  /**
   * Calcula y actualiza la fila de totales con funciones Excel basicas
   */
  private updateTotalsRow(): void {
    if (!this.gridApi || this.rowData.length === 0) return;

    const totalsRow: Record<string, unknown> = {};
    
    // Primera columna muestra "Total"
    const firstField = this.columnDefs[0]?.field;
    if (firstField) {
      totalsRow[firstField] = 'TOTAL';
    }

    // Para cada columna numerica, calcular suma
    this.columnDefs.forEach(colDef => {
      if (!colDef.field) return;
      
      // Verificar si la columna es numerica
      const isNumeric = colDef.type === 'numericColumn' || 
                       this.rowData.every(row => {
                         const val = row[colDef.field!];
                         return val === null || val === undefined || typeof val === 'number';
                       });

      if (isNumeric && colDef.field !== firstField) {
        // Calcular suma de valores no nulos
        const values = this.rowData
          .map(row => row[colDef.field!])
          .filter(v => v !== null && v !== undefined && !isNaN(Number(v)))
          .map(v => Number(v));

        if (values.length > 0) {
          const sum = values.reduce((a, b) => a + b, 0);
          totalsRow[colDef.field] = sum;
        }
      }
    });

    // Aplicar la fila de totales como pinnedBottomRowData
    this.gridApi.setGridOption('pinnedBottomRowData', [totalsRow]);
  }

  /**
   * Alterna la visibilidad de la fila de totales
   */
  toggleTotalsRow(): void {
    this.showTotalsRow.update(show => !show);
    
    if (this.showTotalsRow()) {
      this.updateTotalsRow();
    } else {
      // Remover fila de totales
      this.gridApi?.setGridOption('pinnedBottomRowData', []);
    }
  }

  /**
   * Congela las primeras columnas (numeros de fila + primera columna de datos)
   */
  freezeColumns(): void {
    if (!this.gridApi) return;
    
    const colsToPin: string[] = ['__ROW_NUMBER__'];
    
    // Agregar la primera columna de datos (excluyendo __ROW_NUMBER__)
    const firstDataCol = this.columnDefs.find(c => c.field && c.field !== '__ROW_NUMBER__');
    if (firstDataCol?.field) {
      colsToPin.push(firstDataCol.field);
    }
    
    // Aplicar pinning a la izquierda
    this.gridApi.setColumnsPinned(colsToPin, 'left');
    
    console.log('[ViewVistasRefresh] Columnas congeladas:', colsToPin);
  }

  /**
   * Descongela todas las columnas excepto __ROW_NUMBER__ (que siempre esta fijo)
   */
  unfreezeColumns(): void {
    if (!this.gridApi) return;
    
    const allCols = this.gridApi.getColumns() || [];
    allCols.forEach(col => {
      const colId = col.getColId();
      // Mantener __ROW_NUMBER__ siempre pinned, descongelar el resto
      if (colId !== '__ROW_NUMBER__') {
        this.gridApi?.setColumnPinned(colId, null);
      }
    });
    
    console.log('[ViewVistasRefresh] Columnas descongeladas');
  }

  private rowMatchesFilter(row: Record<string, unknown>, f: DynamicFilter): boolean {
    const rawVal = row[f.col];
    if (rawVal == null) return false;

    switch (f.colType) {
      case 'text': {
        const val  = String(rawVal).toLowerCase();
        const term = (f.textValue ?? '').toLowerCase();
        if (!term) return true;
        switch (f.textMode) {
          case 'startsWith': return val.startsWith(term);
          case 'endsWith':   return val.endsWith(term);
          case 'equals':     return val === term;
          default:           return val.includes(term);
        }
      }
      case 'number': {
        const n = Number(rawVal);
        switch (f.numMode) {
          case 'eq': return n === f.numFrom;
          case 'gt': return n > (f.numFrom ?? -Infinity);
          case 'lt': return n < (f.numFrom ?? Infinity);
          default: // between
            if (f.numFrom != null && n < f.numFrom) return false;
            if (f.numTo   != null && n > f.numTo)   return false;
            return true;
        }
      }
      case 'date': {
        const d = String(rawVal).slice(0, 10);
        if (f.dateFrom && d < f.dateFrom) return false;
        if (f.dateTo   && d > f.dateTo)   return false;
        return true;
      }
      case 'boolean':
        return f.boolValue === '' || String(rawVal) === f.boolValue;
    }
  }

  removeFilter(idx: number): void {
    this.activeFilters.update(fs => fs.filter((_, i) => i !== idx));
    this.applyFiltersToGrid();
  }

  clearAllFilters(): void {
    this.activeFilters.set([]);
    this.applyFiltersToGrid();
  }

  // -Grid events -
  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;

    // Si las columnas se construyeron antes de que la grilla estuviera lista,
    // las entregamos ahora (OnPush puede no haber propagado el binding).
    if (this.columnDefs.length > 0) {
      this.applyColumnDefs();
    }

    // Si los datos ya llegaron antes de que la grilla estuviera lista,
    // forzamos la carga explicita y ajustamos columnas.
    if (this.rowData.length > 0) {
      this.gridApi.setGridOption('rowData', this.rowData);
      setTimeout(() => this.autoSizeColumns(), 100);
    }
    // Las letras Excel (A, B, C...) las renderiza AG Grid como encabezados de grupo
  }

  /**
   * Agrega letras de columna (A, B, C...) en los headers como Excel.
   * Se ejecuta cada vez que AG Grid re-renderiza los headers.
   */
  private addExcelColumnLetters(): void {
    if (!this.gridApi) return;

    const headerCells = document.querySelectorAll('.ag-header-cell');
    let colIndex = 0;

    headerCells.forEach((cell: Element) => {
      const htmlCell = cell as HTMLElement;
      const colId = htmlCell.getAttribute('col-id');

      // Skip row number column
      if (colId === '__ROW_NUMBER__') return;

      // Calcular letra Excel (A, B, C...Z, AA, AB...)
      const letter = this.getExcelColumnLetter(colIndex);
      colIndex++;

      // Agregar elemento con la letra si no existe
      let letterEl = htmlCell.querySelector('.excel-col-letter') as HTMLElement;
      if (!letterEl) {
        letterEl = document.createElement('div');
        letterEl.className = 'excel-col-letter';
        htmlCell.insertBefore(letterEl, htmlCell.firstChild);
      }
      letterEl.textContent = letter;

      // Asegurar visibilidad con estilos inline
      letterEl.style.display = 'flex';
      letterEl.style.position = 'absolute';
      letterEl.style.top = '0';
      letterEl.style.left = '0';
      letterEl.style.right = '0';
      letterEl.style.height = '24px';
      letterEl.style.alignItems = 'center';
      letterEl.style.justifyContent = 'center';
      letterEl.style.fontSize = '11px';
      letterEl.style.fontWeight = '700';
      letterEl.style.color = '#374151';
      letterEl.style.background = '#e5e7eb';
      letterEl.style.borderBottom = '1px solid #9ca3af';
      letterEl.style.borderRight = '1px solid #9ca3af';
      letterEl.style.zIndex = '10';
      letterEl.style.fontFamily = 'Segoe UI, Calibri, Arial, sans-serif';
      letterEl.style.letterSpacing = '0.5px';
    });

    console.log('[addExcelColumnLetters] Procesadas ' + colIndex + ' columnas');
  }


  /** Auto-ajusta columnas al contenido con limites razonables */
  private autoSizeColumns(): void {
    if (!this.gridApi) return;
    
    // Ajustar todas las columnas al contenido
    this.gridApi.autoSizeAllColumns(false);
    
    // Aplicar limites min/max para evitar columnas muy anchas o estrechas
    const allColumns = this.gridApi.getColumns();
    if (!allColumns) return;

    allColumns.forEach(col => {
      const currentWidth = col.getActualWidth();
      let newWidth = currentWidth;
      
      // Minimo 100px, maximo 400px
      if (currentWidth < 100) newWidth = 100;
      if (currentWidth > 400) newWidth = 400;
      
      if (newWidth !== currentWidth) {
        this.gridApi!.setColumnWidths([{ key: col.getColId(), newWidth }]);
      }
    });
  }

  onCellFocused(event: CellFocusedEvent): void {
    if (event.rowIndex == null) return;
    // Cerrar context menu si esta abierto
    this.closeContextMenu();
    
    const col = event.column;
    let colId: string | null = null;
    
    if (typeof col === 'string') {
      colId = col;
    } else if (col && typeof col === 'object' && 'getColId' in col) {
      colId = (col as { getColId(): string }).getColId();
    } else if (col && typeof col === 'object' && 'colId' in col) {
      colId = (col as { colId: string }).colId;
    }
    
    if (!colId || colId === '__ROW_NUMBER__') return;

    const row = this.rowData[event.rowIndex];
    const val = row ? String(row[colId] ?? '') : '';
    
    // Si la celda tiene una formula, mostrar la formula en la barra (no el resultado)
    const rawVal = row ? row[colId] : '';
    const displayVal = (typeof rawVal === 'string' && rawVal.startsWith('=')) ? rawVal : val;
    
    // Calcular letra de columna correcta (A-Z, AA-AZ...)
    const colIdx = this.columnDefs.findIndex(c => c.field === colId);
    const colLetter = colIdx >= 0 ? this.getExcelColumnLetter(colIdx) : '?';
    
    // Recordar la celda enfocada: la barra de formulas escribe aqui al confirmar
    this.focusedCell = { rowIndex: event.rowIndex, colId };

    this.cellInfo.set({ 
      reference: `${colLetter}${event.rowIndex + 1}`, 
      value: displayVal, 
      editable: this.isEditableSheet(),
    });
  }

  /** Celda con el foco, para saber donde escribe la barra de formulas */
  private focusedCell: { rowIndex: number; colId: string } | null = null;

  /**
   * Manejadores de eventos AG Grid
   */
  onColumnResized(): void {
    // No-op: los encabezados de grupo de AG Grid mantienen las letras
  }

  onSortChanged(): void {
    // No-op: los encabezados de grupo de AG Grid mantienen las letras
  }

  onFilterChanged(): void {
    // No-op: los encabezados de grupo de AG Grid mantienen las letras
  }

  onDisplayedColumnsChanged(): void {
    // No-op: los encabezados de grupo de AG Grid mantienen las letras
  }

  // --- Navegacion y edicion tipo Excel ---

  /**
   * Tab navega a la siguiente celda (como Excel).
   * Shift+Tab navega a la celda anterior.
   */
  tabToNextCell = (params: any) => {
    const previousCell = params.previousCellPosition;
    const nextCell = params.nextCellPosition;
    
    // Si nextCell es null (final de fila), mover a primera celda de siguiente fila
    if (!nextCell && previousCell) {
      const nextRow = previousCell.rowIndex + 1;
      const firstCol = this.gridApi?.getColumns()?.[1]; // Skip __ROW_NUMBER__
      if (firstCol && this.gridApi) {
        const lastRow = this.gridApi.getDisplayedRowCount() - 1;
        if (nextRow <= lastRow) {
          return { rowIndex: nextRow, column: firstCol, floating: null };
        }
      }
    }
    return nextCell;
  };

  /**
   * Doble-clic en celda: entra en modo edicion si la hoja es editable.
   */
  onCellDoubleClicked(event: any): void {
    const activeSheet = this.sheets().find(s => s.active);
    // Solo editable en hojas de analisis/vacias
    if (activeSheet && (activeSheet.label.startsWith('Analisis') || activeSheet.label.startsWith('Pivot'))) {
      // AG Grid maneja la edicion si la columna tiene editable:true
      // Para hojas de datos, no permitir edicion
      return;
    }
    // En hojas de datos no se puede editar - mostrar valor en formula bar
    if (event.value != null) {
      this.cellInfo.update(ci => ({ ...ci, value: String(event.value) }));
    }
  }

  /**
   * Manejo de teclas en celdas para interacciones tipo Excel.
   */
  onCellKeyDown(event: any): void {
    const keyEvent = event.event as KeyboardEvent;
    if (!keyEvent) return;

    // F2: Iniciar edicion de la celda actual
    if (keyEvent.key === 'F2') {
      const activeSheet = this.sheets().find(s => s.active);
      if (activeSheet && (activeSheet.label.startsWith('Analisis') || activeSheet.label.startsWith('Pivot'))) {
        this.gridApi?.startEditingCell({
          rowIndex: event.rowIndex,
          colKey: event.column.getColId(),
        });
      }
      return;
    }

    // Ctrl+A: Seleccionar todas las filas
    if (keyEvent.ctrlKey && keyEvent.key === 'a') {
      keyEvent.preventDefault();
      this.gridApi?.selectAll();
      return;
    }
  }

  /**
   * Cuando el scroll llega al final en hojas editables,
   * agrega filas automaticamente (scroll infinito).
   */
  onBodyScrollEnd(event: any): void {
    if (!this.isEditableSheet()) return;
    if (event.direction !== 'vertical') return;
    
    const lastRow = this.gridApi?.getDisplayedRowCount() ?? 0;
    const visibleLast = this.gridApi?.getLastDisplayedRowIndex() ?? 0;
    
    // Si estamos cerca del final (ultimas 5 filas), agregar mas
    if (visibleLast >= lastRow - 5) {
      const colFields = this.columnDefs
        .filter(c => c.field && c.field !== '__ROW_NUMBER__')
        .map(c => c.field!);
      
      // Agregar 50 filas mas
      const newRows: Record<string, unknown>[] = [];
      for (let i = 0; i < 50; i++) {
        const row: Record<string, unknown> = {};
        colFields.forEach(f => { row[f] = ''; });
        newRows.push(row);
      }
      
      this.rowData = [...this.rowData, ...newRows];
      this.gridApi?.setGridOption('rowData', this.rowData);
      this.totalRows.set(this.rowData.length);
      this.filteredRows.set(this.rowData.length);
    }
  }

  // --- Context Menu (clic derecho) ------------------------------------------

  onCellContextMenu(event: any): void {
    event.event?.preventDefault();
    const mouseEvent = event.event as MouseEvent;
    const colId = event.column?.getId() || '';
    
    // Posicionar menu relativo al grid-wrap
    const gridEl = (mouseEvent.target as HTMLElement).closest('.vr-grid-wrap');
    const rect = gridEl?.getBoundingClientRect() || { left: 0, top: 0 };
    
    this.contextMenu.set({
      visible: true,
      x: mouseEvent.clientX - rect.left,
      y: mouseEvent.clientY - rect.top,
      colId
    });
  }

  closeContextMenu(): void {
    this.contextMenu.update(m => ({ ...m, visible: false }));
  }

  ctxCopyCells(): void {
    this.gridApi?.copySelectedRangeToClipboard();
    this.closeContextMenu();
  }

  ctxCopyWithHeaders(): void {
    this.gridApi?.copySelectedRangeToClipboard();
    this.closeContextMenu();
  }

  ctxAutoSize(): void {
    const colId = this.contextMenu().colId;
    if (colId && this.gridApi) {
      this.gridApi.autoSizeColumns([colId], false);
    }
    this.closeContextMenu();
  }

  ctxAutoSizeAll(): void {
    this.autoSizeColumns();
    this.closeContextMenu();
  }

  ctxHideColumn(): void {
    const colId = this.contextMenu().colId;
    if (colId && this.gridApi) {
      this.gridApi.setColumnsVisible([colId], false);
    }
    this.closeContextMenu();
  }

  ctxShowAllColumns(): void {
    if (this.gridApi) {
      const allCols = this.gridApi.getColumns();
      if (allCols) {
        this.gridApi.setColumnsVisible(allCols.map(c => c.getColId()), true);
        this.hiddenColumnIds.set([]);
      }
    }
    this.closeContextMenu();
  }

  /**
   * Clic en el encabezado de una columna: calcula los agregados de esa columna
   * y los publica en la barra de estado, igual que hace Excel al seleccionar
   * un rango (Promedio / Recuento / Suma / Min / Max).
   */
  onColumnHeaderClicked(event: any): void {
    const colId: string | undefined = event?.column?.getColId?.();
    if (!colId || colId === '__ROW_NUMBER__') { this.columnStats.set(null); return; }

    const stats = this.computeColumnStats(colId);
    this.columnStats.set(stats);
  }

  /** Calcula los agregados de una columna sobre las filas visibles (filtradas). */
  private computeColumnStats(colId: string) {
    const label = this.columnDefs.find(c => c.field === colId)?.headerName
      ?? humanizeColumnName(colId);

    const raw = this.rowData
      .map(r => r[colId])
      .filter(v => v !== null && v !== undefined && v !== '');

    const nums = raw
      .map(v => (typeof v === 'number' ? v : Number(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'))))
      .filter(n => Number.isFinite(n));

    const sum = nums.reduce((a, b) => a + b, 0);

    return {
      label,
      count: raw.length,
      numericCount: nums.length,
      sum,
      avg: nums.length > 0 ? sum / nums.length : 0,
      min: nums.length > 0 ? Math.min(...nums) : 0,
      max: nums.length > 0 ? Math.max(...nums) : 0,
    };
  }

  /** Limpia los agregados de columna de la barra de estado. */
  clearColumnStats(): void {
    this.columnStats.set(null);
  }

  /**
   * Solo las hojas de calculo son editables. Las hojas de datos son un espejo
   * de la vista de Fabric: se leen, no se escriben.
   */
  isEditableSheet(): boolean {
    const activeSheet = this.sheets().find(s => s.active);
    return (activeSheet?.kind ?? 'view') === 'blank';
  }

  /** Insertar fila arriba de la celda enfocada */
  ctxInsertRowAbove(): void {
    const focused = this.gridApi?.getFocusedCell();
    const rowIdx = focused?.rowIndex ?? 0;
    
    // Crear fila vacia
    const newRow: Record<string, unknown> = {};
    this.columnDefs.forEach(cd => {
      if (cd.field && cd.field !== '__ROW_NUMBER__') newRow[cd.field] = '';
    });
    
    this.rowData.splice(rowIdx, 0, newRow);
    this.rowData = [...this.rowData]; // Trigger change detection
    this.gridApi?.setGridOption('rowData', this.rowData);
    this.totalRows.set(this.rowData.length);
    this.filteredRows.set(this.rowData.length);
    this.closeContextMenu();
  }

  /** Insertar fila debajo de la celda enfocada */
  ctxInsertRowBelow(): void {
    const focused = this.gridApi?.getFocusedCell();
    const rowIdx = (focused?.rowIndex ?? 0) + 1;
    
    const newRow: Record<string, unknown> = {};
    this.columnDefs.forEach(cd => {
      if (cd.field && cd.field !== '__ROW_NUMBER__') newRow[cd.field] = '';
    });
    
    this.rowData.splice(rowIdx, 0, newRow);
    this.rowData = [...this.rowData];
    this.gridApi?.setGridOption('rowData', this.rowData);
    this.totalRows.set(this.rowData.length);
    this.filteredRows.set(this.rowData.length);
    this.closeContextMenu();
  }

  /** Eliminar la fila enfocada */
  ctxDeleteRow(): void {
    const focused = this.gridApi?.getFocusedCell();
    const rowIdx = focused?.rowIndex ?? -1;
    if (rowIdx < 0 || rowIdx >= this.rowData.length) { this.closeContextMenu(); return; }
    
    this.rowData.splice(rowIdx, 1);
    this.rowData = [...this.rowData];
    this.gridApi?.setGridOption('rowData', this.rowData);
    this.totalRows.set(this.rowData.length);
    this.filteredRows.set(this.rowData.length);
    this.closeContextMenu();
  }

  /** Insertar columna despues de la enfocada */
  ctxInsertColumn(): void {
    // Generar nuevo nombre de columna
    const existingCols = this.columnDefs.filter(c => c.field !== '__ROW_NUMBER__').length;
    const newLetter = this.getExcelColumnLetter(existingCols);
    const newField = `col_${newLetter}`;
    
    const newCol: ColDef = {
      field: newField,
      headerName: '',
      width: 100,
      minWidth: 80,
      editable: true,
      headerClass: 'excel-name-header',
    };
    
    this.columnDefs.push(newCol);
    this.applyColumnDefs();
    
    // Agregar el campo a todas las filas
    this.rowData.forEach(row => { row[newField] = ''; });
    this.gridApi?.setGridOption('rowData', this.rowData);
    this.closeContextMenu();
  }

  /** Toggle visibilidad de una columna individual */
  toggleColumnVisibility(colId: string): void {
    if (!this.gridApi) return;
    const col = this.gridApi.getColumn(colId);
    if (!col) return;
    
    const isVisible = col.isVisible();
    this.gridApi.setColumnsVisible([colId], !isVisible);
    
    // Actualizar lista de ocultas
    if (isVisible) {
      this.hiddenColumnIds.update(ids => [...ids, colId]);
    } else {
      this.hiddenColumnIds.update(ids => ids.filter(id => id !== colId));
    }
    
    this.saveWorkbookState();
  }

  /** Obtener lista de columnas con su estado de visibilidad */
  getColumnVisibilityList(): Array<{ id: string; name: string; visible: boolean }> {
    if (!this.gridApi) return [];
    const allCols = this.gridApi.getColumns();
    if (!allCols) return [];
    
    return allCols
      .filter(c => c.getColId() !== '__ROW_NUMBER__')
      .map(c => ({
        id: c.getColId(),
        name: c.getColDef().headerName || humanizeColumnName(c.getColId()),
        visible: c.isVisible(),
      }));
  }

  // -Ribbon actions -
  onRibbonAction(event: RibbonActionEvent): void {
    switch (event.actionId) {
      case 'refresh':        this.startRefresh(); break;
      case 'cancel-refresh': this.cancelRefresh(); break;
      case 'autofit':        
        this.autoSizeColumns();
        break;
      case 'zoom-fit':       
        this.gridApi?.sizeColumnsToFit();
        break;
      case 'show-all-cols':
        this.ctxShowAllColumns();
        break;
      case 'column-panel':
        this.showColumnPanel.update(v => !v);
        break;

      case 'toggle-totals':  this.toggleTotalsRow(); break;
      case 'freeze-cols':    
        this.freezeColumns();
        break;
      case 'unfreeze-cols':
        this.unfreezeColumns();
        break;

      case 'export-csv':
        this.gridApi?.exportDataAsCsv({ fileName: `${this.viewName}_${this.today()}.csv` });
        break;
      case 'export-xlsx':
        this.gridApi?.exportDataAsExcel?.({ fileName: `${this.viewName}_${this.today()}.xlsx` });
        break;
      case 'fullscreen':
        this.toggleFullscreen();
        break;

      case 'row-height': {
        const h = ({ compact: 21, normal: 28, comfortable: 36 } as Record<string, number>)[event.value ?? 'normal'] ?? 28;
        this.gridApi?.setGridOption('rowHeight', h);
        this.gridApi?.resetRowHeights();
        break;
      }

      case 'filter-col': {
        const col = event.value ?? '';
        this.filterBuilder = { col };
        const colMeta = this.columns.find(c => c.name === col);
        const ct = col ? getColumnType(colMeta?.type ?? 'varchar') : null;
        this.selectedColType.set(ct as 'text' | 'number' | 'date' | 'boolean' | null);
        if (ct) this.showFilterPanel.set(true);
        break;
      }

      case 'filter-type': {
        const val = event.value ?? 'contains';
        if (this.selectedColType() === 'text') this.filterBuilder.textMode = val as DynamicFilter['textMode'];
        if (this.selectedColType() === 'number') this.filterBuilder.numMode = val as DynamicFilter['numMode'];
        break;
      }

      case 'filter-open': this.showFilterPanel.set(true); break;
      case 'filter-clear': this.clearAllFilters(); break;

      // -- Pestana Formato --
      case 'fmt-col':     this.formatTargetCol = event.value ?? ''; break;
      case 'fmt-text':    this.applyColumnFormat('text');    break;
      case 'fmt-number':  this.applyColumnFormat('number');  break;
      case 'fmt-integer': this.applyColumnFormat('integer'); break;
      case 'fmt-date':    this.applyColumnFormat('date');    break;
      case 'fmt-cop':     this.applyColumnFormat('cop');     break;
      case 'fmt-usd':     this.applyColumnFormat('usd');     break;
      case 'fmt-eur':     this.applyColumnFormat('eur');     break;
      case 'fmt-percent': this.applyColumnFormat('percent'); break;
      case 'fmt-reset':   this.resetColumnFormat();          break;

      case 'add-view': this.openAddViewPanel(); break;

      // -- Pestana Formulas --
      case 'new-calc-sheet': this.addBlankSheet(); break;
      case 'fx-help':        this.showFormulaHelp.update(v => !v); break;
      case 'fx-recalc':      this.recalcFormulas(); break;
      case 'fx-buscarvista': this.insertFormulaTemplate('BUSCARVISTA'); break;
      case 'fx-contarvista': this.insertFormulaTemplate('CONTARVISTA'); break;
      case 'fx-sumarvista':  this.insertFormulaTemplate('SUMARVISTA');  break;

      
      case 'pivot-table': this.openPivotPanel(); break;
      case 'quick-analysis': this.openAnalysisPanel(); break;
      case 'clear-analysis': this.clearAnalysis(); break;
      case 'export-analysis': this.exportAnalysis(); break;
    }
  }

  private addFilterFromBuilder(): void {
    const col     = this.filterBuilder.col;
    const colType = this.selectedColType();
    if (!col || !colType) return;

    const colLabel = humanizeColumnName(col);
    const newFilter: DynamicFilter = {
      col, label: colLabel, colType,
      textValue:  this.filterBuilder.textValue,
      textMode:   this.filterBuilder.textMode ?? 'contains',
      numFrom:    this.filterBuilder.numFrom ?? null,
      numTo:      this.filterBuilder.numTo ?? null,
      numMode:    this.filterBuilder.numMode ?? 'between',
      dateFrom:   this.filterBuilder.dateFrom,
      dateTo:     this.filterBuilder.dateTo,
      boolValue:  this.filterBuilder.boolValue,
    };

    // Validar que tiene datos
    if (colType === 'text' && !newFilter.textValue) return;
    if (colType === 'date' && !newFilter.dateFrom && !newFilter.dateTo) return;
    if (colType === 'number' && newFilter.numFrom == null && newFilter.numTo == null) return;

    this.activeFilters.update(fs => [...fs, newFilter]);
    this.applyFiltersToGrid();

    // Reset builder
    this.filterBuilder = { col: '' };
    this.selectedColType.set(null);
  }

  // --- Pestana Formato: conversiones de presentacion ---

  /**
   * Aplica un formato de presentacion a la columna seleccionada en la pestana
   * Formato. Solo cambia el valueFormatter (como Excel: el dato no se altera).
   */
  private applyColumnFormat(format: ColumnFormat): void {
    const colId = this.formatTargetCol;
    if (!colId) {
      alert('Primero seleccione una columna en el desplegable de la pestana Formato.');
      return;
    }

    const colDef = this.columnDefs.find(c => c.field === colId);
    if (!colDef) return;

    this.columnFormats.set(colId, format);
    colDef.valueFormatter = (p) => formatCellValue(p.value, format);

    // Los formatos numericos se alinean a la derecha, como en Excel
    const isNumeric = format !== 'text' && format !== 'date';
    colDef.cellClass = `bi-cell bi-cell--${isNumeric ? 'number' : format}`;

    this.applyColumnDefs();
    this.gridApi?.refreshCells({ force: true, columns: [colId] });
    this.saveWorkbookState();
    console.log(`[Formato] ${colId} -> ${format}`);
  }

  /** Quita el formato personalizado de la columna seleccionada. */
  private resetColumnFormat(): void {
    const colId = this.formatTargetCol;
    if (!colId) return;

    const colDef = this.columnDefs.find(c => c.field === colId);
    if (!colDef) return;

    this.columnFormats.delete(colId);

    // Restaurar el formateador segun el tipo original de la columna
    const meta = this.columns.find(c => c.name === colId);
    const type = meta ? getColumnType(meta.type) : 'text';

    if (type === 'number') {
      colDef.valueFormatter = (p) => p.value != null
        ? Number(p.value).toLocaleString('es-CO', { maximumFractionDigits: 2 })
        : '';
    } else if (type === 'date') {
      colDef.valueFormatter = (p) => {
        if (!p.value) return '';
        const s = String(p.value).replace('T', ' ');
        return s.length > 10 ? s.slice(0, 16) : s;
      };
    } else {
      colDef.valueFormatter = undefined;
    }

    colDef.cellClass = `bi-cell bi-cell--${type}`;
    this.applyColumnDefs();
    this.gridApi?.refreshCells({ force: true, columns: [colId] });
    console.log(`[Formato] ${colId} restablecido a ${type}`);
  }

  /** Cuando cambia la columna seleccionada en el panel de filtros */
  onFilterColumnChange(): void {
    const col = this.filterBuilder.col;
    if (!col) { this.selectedColType.set(null); return; }
    const colMeta = this.columns.find(c => c.name === col);
    const ct = colMeta ? getColumnType(colMeta.type) : 'text';
    this.selectedColType.set(ct as 'text' | 'number' | 'date' | 'boolean');
  }

  /** Aplica el filtro dinamico configurado en el panel */
  applyDynamicFilter(): void {
    this.addFilterFromBuilder();
    this.saveWorkbookState();
  }

  // -Panel "Agregar vista" -
  openAddViewPanel(): void {
    this.showAddViewPanel.set(true);
    if (this.availableViews().length > 0) return;

    this.loadingViews.set(true);

    // Se usa VistasService.getVistas() en vez de llamar el endpoint a mano.
    //
    // Antes este panel repetia el aplanado de la respuesta y en el camino
    // recortaba el nombre: `view_name.replace(/^VW_[A-Za-z]+_/, '').replace(/_/g,' ')`
    // convertia VW_Censo_Trazabilidad_NvaEal en "Censo Trazabilidad NvaEal", un
    // nombre que no existe en Fabric y no se puede rastrear. El servicio ya
    // conserva el nombre original, respeta los esquemas permitidos del usuario
    // y trae column_count y bi_estado.
    this.vistasService.getVistas().subscribe({
      next: res => {
        this.loadingViews.set(false);
        this.availableViews.set(res.data ?? []);
        console.log('[openAddViewPanel] Vistas disponibles:', res.data?.length ?? 0);
      },
      error: err => {
        this.loadingViews.set(false);
        console.error('[openAddViewPanel] No se pudieron cargar las vistas', err);
      },
    });
  }

  closeAddViewPanel(): void {
    this.showAddViewPanel.set(false);
    this.searchVistas.set('');
  }

  // -Panel "Analisis Rapido" -
  openAnalysisPanel(): void {
    this.showAnalysisPanel.set(true);
  }

  closeAnalysisPanel(): void {
    this.showAnalysisPanel.set(false);
  }

  performQuickAnalysis(): void {
    const config = this.analysisConfig();
    if (!config.groupBy || config.metrics.length === 0) {
      alert('Selecciona una columna para agrupar y al menos una metrica');
      return;
    }

    const grouped = new Map<string, Record<string, unknown>[]>();
    
    // Agrupar datos
    this.rawData.forEach(row => {
      const key = String(row[config.groupBy] || 'Sin valor');
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    });
    
    // Calcular metricas
    const results: Record<string, unknown>[] = [];
    grouped.forEach((rows, key) => {
      const result: Record<string, unknown> = { [config.groupBy]: key };
      
      config.metrics.forEach(metric => {
        const values = rows.map(r => r[metric.column]).filter(v => v != null);
        const numericValues = values.map(v => Number(v)).filter(n => !isNaN(n));
        
        switch (metric.operation) {
          case 'sum':
            result[`${metric.column}_sum`] = numericValues.reduce((a, b) => a + b, 0);
            break;
          case 'avg':
            result[`${metric.column}_avg`] = numericValues.length > 0 
              ? numericValues.reduce((a, b) => a + b, 0) / numericValues.length 
              : 0;
            break;
          case 'count':
            result[`${metric.column}_count`] = values.length;
            break;
          case 'distinct':
            result[`${metric.column}_distinct`] = new Set(values).size;
            break;
        }
      });
      
      results.push(result);
    });

    // Crear columnDefs para los resultados
    const resultColumnDefs: ColDef[] = [
      {
        field: config.groupBy,
        headerName: humanizeColumnName(config.groupBy),
        pinned: 'left',
      },
    ];

    config.metrics.forEach(metric => {
      const suffix = `_${metric.operation}`;
      resultColumnDefs.push({
        field: `${metric.column}${suffix}`,
        headerName: `${humanizeColumnName(metric.column)} (${metric.operation.toUpperCase()})`,
        type: 'numericColumn',
        valueFormatter: (p) => p.value != null
          ? Number(p.value).toLocaleString('es-CO', { maximumFractionDigits: 2 })
          : '',
      });
    });

    // Actualizar grid con resultados
    this.rawData = results;
    this.rowData = results;
    this.columnDefs = resultColumnDefs;
    this.applyColumnDefs();
    this.totalRows.set(results.length);
    this.filteredRows.set(results.length);

    if (this.gridApi) {
      this.applyColumnDefs();
      this.gridApi.setGridOption('rowData', this.rowData);
      setTimeout(() => this.autoSizeColumns(), 100);
    }

    console.log('[Analisis] Resultados generados:', results.length, 'grupos');
    this.closeAnalysisPanel();
  }

  clearAnalysis(): void {
    // Restaurar datos originales de la hoja activa
    const activeSheet = this.sheets().find(s => s.active);
    if (activeSheet && activeSheet.rowData && activeSheet.columnDefs) {
      this.loadSheetData(activeSheet.id);
      console.log('[Analisis] Analisis limpiado, datos originales restaurados');
    }
  }

  exportAnalysis(): void {
    if (this.gridApi) {
      this.gridApi.exportDataAsCsv({ fileName: `analisis_${this.viewName}_${this.today()}.csv` });
      console.log('[Analisis] Resultados exportados a CSV');
    }
  }

  // -Panel "Tabla Dinamica" (Pivot Table) -

  closePivotPanel(): void {
    this.showPivotPanel.set(false);
  }

  /**
   * Agrega un campo a una zona de la tabla dinamica (Filas, Columnas, Valores, Filtros)
   */
  addPivotField(zone: 'row' | 'column' | 'value' | 'filter', field: string): void {
    const config = this.pivotConfig();
    
    switch (zone) {
      case 'row':
        if (!config.rowFields.includes(field)) {
          this.pivotConfig.update(c => ({
            ...c,
            rowFields: [...c.rowFields, field]
          }));
        }
        break;
      case 'column':
        if (!config.columnFields.includes(field)) {
          this.pivotConfig.update(c => ({
            ...c,
            columnFields: [...c.columnFields, field]
          }));
        }
        break;
      case 'value':
        // Por defecto, agregar con operacion 'sum'
        this.pivotConfig.update(c => ({
          ...c,
          valueFields: [...c.valueFields, { column: field, operation: 'sum', label: field }]
        }));
        break;
      case 'filter':
        if (!config.filterFields.includes(field)) {
          this.pivotConfig.update(c => ({
            ...c,
            filterFields: [...c.filterFields, field]
          }));
        }
        break;
    }
  }

  /**
   * Elimina un campo de una zona de la tabla dinamica
   */
  removePivotField(zone: 'row' | 'column' | 'value' | 'filter', index: number): void {
    const config = this.pivotConfig();
    
    switch (zone) {
      case 'row':
        this.pivotConfig.update(c => ({
          ...c,
          rowFields: c.rowFields.filter((_, i) => i !== index)
        }));
        break;
      case 'column':
        this.pivotConfig.update(c => ({
          ...c,
          columnFields: c.columnFields.filter((_, i) => i !== index)
        }));
        break;
      case 'value':
        this.pivotConfig.update(c => ({
          ...c,
          valueFields: c.valueFields.filter((_, i) => i !== index)
        }));
        break;
      case 'filter':
        this.pivotConfig.update(c => ({
          ...c,
          filterFields: c.filterFields.filter((_, i) => i !== index)
        }));
        break;
    }
  }

  /**
   * Genera la tabla dinamica con la configuracion actual
   */
  generatePivotTable(): void {
    const config = this.pivotConfig();
    
    if (config.rowFields.length === 0 || config.valueFields.length === 0) {
      alert('Debe agregar al menos un campo a "FILAS" y uno a "VALORES"');
      return;
    }

    console.log('[Pivot] Generando tabla dinamica con config:', config);

    // 1. Guardar hoja actual
    this.saveActiveSheetData(this.rawData, this.columnDefs);

    // 2. Agrupar datos por las combinaciones de rowFields
    const grouped = new Map<string, Record<string, unknown>[]>();
    const sourceData = this.rawData.length > 0 ? this.rawData : this.rowData;

    sourceData.forEach(row => {
      const key = config.rowFields.map(f => String(row[f] ?? '(vacio)')).join(' | ');
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    });

    // 3. Calcular valores agregados para cada grupo
    const pivotRows: Record<string, unknown>[] = [];

    grouped.forEach((rows, key) => {
      const pivotRow: Record<string, unknown> = {};

      // Campos de fila
      config.rowFields.forEach(f => {
        pivotRow[f] = rows[0][f] ?? '(vacio)';
      });

      // Campos de valor (con su operacion)
      config.valueFields.forEach(vf => {
        const values = rows.map(r => r[vf.column]).filter(v => v != null);
        const nums = values.map(v => Number(v)).filter(n => !isNaN(n));
        let result: number | string = 0;

        switch (vf.operation) {
          case 'sum':
            result = nums.reduce((a, b) => a + b, 0);
            break;
          case 'avg':
            result = nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
            break;
          case 'count':
            result = values.length;
            break;
          case 'min':
            result = nums.length > 0 ? Math.min(...nums) : 0;
            break;
          case 'max':
            result = nums.length > 0 ? Math.max(...nums) : 0;
            break;
          case 'distinct':
            result = new Set(values.map(v => String(v))).size;
            break;
        }

        const label = `${vf.operation.toUpperCase()} de ${humanizeColumnName(vf.column)}`;
        pivotRow[label] = result;
      });

      pivotRows.push(pivotRow);
    });

    // 4. Construir columnDefs para la tabla pivotada
    const pivotColumnDefs: ColDef[] = [
      {
        headerName: '',
        field: '__ROW_NUMBER__',
        width: 50, minWidth: 50, maxWidth: 50,
        resizable: false, sortable: false, filter: false,
        pinned: 'left', lockPinned: true,
        cellClass: 'bi-cell-row-number',
        headerClass: 'excel-corner-header',
        valueGetter: (params) => params.node?.rowIndex != null ? params.node.rowIndex + 1 : '',
      },
    ];

    // Columnas de fila
    config.rowFields.forEach(f => {
      pivotColumnDefs.push({
        field: f,
        headerName: humanizeColumnName(f),
        pinned: 'left',
        filter: true,
      });
    });

    // Columnas de valores
    config.valueFields.forEach(vf => {
      const label = `${vf.operation.toUpperCase()} de ${humanizeColumnName(vf.column)}`;
      pivotColumnDefs.push({
        field: label,
        headerName: label,
        type: 'numericColumn',
        valueFormatter: (p) => p.value != null
          ? Number(p.value).toLocaleString('es-CO', { maximumFractionDigits: 2 })
          : '',
      });
    });

    // 5. Crear nueva hoja con los datos pivotados
    const pivotSheetId = `sheet-pivot-${Date.now()}`;
    const analysisCount = this.sheets().filter(s => (s.kind ?? 'view') === 'pivot').length;

    // Guardar la hoja de datos actual ANTES de crear el pivot
    // Solo si la hoja activa es de datos (no otro pivot previo)
    const activeSheet = this.sheets().find(s => s.active);
    if (activeSheet && (activeSheet.kind ?? 'view') === 'view' && this.pivotSourceData.length > 0) {
      this.sheets.update(sheets => {
        const ds = sheets.find(s => s.id === activeSheet.id);
        if (ds) {
          ds.rowData    = this.pivotSourceData;
          ds.columnDefs = ds.columnDefs && ds.columnDefs.length > 0 ? ds.columnDefs : this.columnDefs;
        }
        return [...sheets];
      });
    }

    // Sin limite: una tabla dinamica es un resumen agregado, no una vista mas
    this.sheets.update(sheets => {
      sheets.forEach(s => s.active = false);
      sheets.push({
        id: pivotSheetId,
        label: `Pivot ${analysisCount + 1}`,
        schema: '',
        viewName: `Pivot - ${config.rowFields.join(', ')}`,
        active: true,
        kind: 'pivot',
        rowData: pivotRows,
        columnDefs: pivotColumnDefs,
        columns: [],
      });
      return [...sheets];
    });
    this.activeFormulaSheet = '';

    // 6. Aplicar al grid SOLO si la hoja pivot es la activa
    const pivotActive = this.sheets().find(s => s.active);
    if (pivotActive && (pivotActive.kind ?? 'view') === 'pivot') {
      this.rawData = pivotRows;
      this.rowData = pivotRows;
      this.columnDefs = pivotColumnDefs;
      this.applyColumnDefs();
      this.columns = [];
      this.totalRows.set(pivotRows.length);
      this.filteredRows.set(pivotRows.length);
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', pivotRows);
        setTimeout(() => this.autoSizeColumns(), 100);
      }
    }
    console.log('[Pivot] Tabla dinamica generada:', pivotRows.length, 'filas,', pivotColumnDefs.length, 'columnas');
    this.closePivotPanel();
  }

  /**
   * Limpia la configuracion de la tabla dinamica
   */
  clearPivotConfig(): void {
    this.pivotConfig.set({
      rowFields: [],
      columnFields: [],
      valueFields: [],
      filterFields: []
    });
  }

  /** Limpia config y restaura datos originales (llamado desde template) */
  clearPivotConfigAuto(): void {
    this.clearPivotConfig();
    if (this.pivotSourceData.length > 0) {
      this.rowData = this.pivotSourceData;
      this.rawData = this.pivotSourceData;
      const activeSheet = this.sheets().find(s => s.active);
      if (activeSheet?.columnDefs?.length) {
        this.columnDefs = activeSheet.columnDefs;
      }
      this.applyColumnDefs();
      this.totalRows.set(this.rowData.length);
      this.filteredRows.set(this.rowData.length);
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.rowData);
        setTimeout(() => this.autoSizeColumns(), 50);
      }
    }
    this.closePivotPanel();
  }

  // --- Pivot Table (delegado a PivotPanelComponent) ---

  /** Datos fuente de la tabla dinamica (se guardan al abrir el panel) */
  pivotSourceData: Record<string, unknown>[] = [];

  /**
   * Columnas que ofrece el panel de tabla dinamica para arrastrar.
   *
   * Va aparte de `this.columns` a proposito: el panel puede dinamizar CUALQUIER
   * hoja de datos abierta, no solo la activa. Antes el template usaba
   * `this.columns`, asi que al elegir otra hoja como fuente los datos cambiaban
   * pero la lista de campos seguia siendo la de la vista anterior: se
   * arrastraban columnas que no existian en el dataset y el pivot salia vacio.
   */
  readonly pivotColumns = signal<FabricColumn[]>([]);

  /** Hoja de datos que alimenta el pivot (para nombrar su hoja de resultados) */
  private pivotSourceSheetId = '';

  /** Al abrir el panel, guardar referencia a los datos actuales */
  openPivotPanel(): void {
    // Guardar los datos de la hoja de datos activa como fuente del pivot.
    // IMPORTANTE: guardamos una referencia directa a los datos de la hoja de DATOS
    // (no a this.rawData que puede ser de otra hoja si ya hay un pivot activo).
    const activeSheet = this.sheets().find(s => s.active);
    const dataSheet   = (activeSheet?.kind ?? 'view') === 'view'
      ? activeSheet
      : this.sheets().find(s => (s.kind ?? 'view') === 'view' && (s.rowData?.length ?? 0) > 0);

    if (dataSheet?.rowData && dataSheet.rowData.length > 0) {
      this.pivotSourceData    = dataSheet.rowData;
      this.pivotSourceSheetId = dataSheet.id;
      this.pivotColumns.set(this.columnsForSheet(dataSheet));
    } else {
      this.pivotSourceData    = this.rawData.length > 0 ? this.rawData : this.rowData;
      this.pivotSourceSheetId = activeSheet?.id ?? '';
      this.pivotColumns.set(this.columns);
    }

    if (this.pivotSourceData.length === 0) {
      alert(
        'No hay datos cargados para dinamizar.\n\n' +
        'Cargue primero una vista con "Actualizar todo" y vuelva a abrir la tabla dinamica.'
      );
      return;
    }

    this.showPivotPanel.set(true);
  }

  /**
   * Columnas de una hoja para el panel de pivot.
   *
   * Si la hoja no guardo los metadatos del backend (por ejemplo se cargo antes
   * de que /columns respondiera), se derivan de las claves de la primera fila
   * para que el panel nunca quede sin campos que arrastrar.
   */
  private columnsForSheet(sheet: { columns?: FabricColumn[]; rowData?: Record<string, unknown>[] }): FabricColumn[] {
    if (sheet.columns && sheet.columns.length > 0) return sheet.columns;

    const first = sheet.rowData?.[0];
    if (!first) return [];

    return Object.keys(first)
      .filter(k => k !== '__ROW_NUMBER__')
      .map(name => ({ name, type: 'varchar', nullable: true } as FabricColumn));
  }

  /**
   * Hojas que se pueden dinamizar: solo las de DATOS ya cargadas.
   * Una hoja de calculo vacia o otra tabla dinamica no son fuentes validas.
   */
  getPivotSheets(): Array<{ id: string; label: string; hasData: boolean }> {
    return this.sheets()
      .filter(s => (s.kind ?? 'view') === 'view')
      .map(s => ({
        id: s.id,
        label: s.label,
        hasData: (s.rowData?.length ?? 0) > 0,
      }));
  }

  /** Cuando el usuario selecciona una hoja fuente en el pivot */
  onPivotSheetSelected(sheetId: string): void {
    const sheet = this.sheets().find(s => s.id === sheetId);
    if (!sheet || !sheet.rowData || sheet.rowData.length === 0) {
      console.warn('[Pivot] La hoja elegida no tiene datos cargados:', sheetId);
      return;
    }

    this.pivotSourceData    = sheet.rowData;
    this.pivotSourceSheetId = sheet.id;

    // Cambiar tambien los campos disponibles: son los de ESTA hoja, no los de
    // la vista activa. Sin esto se arrastraban columnas de otra vista.
    this.pivotColumns.set(this.columnsForSheet(sheet));

    console.log('[Pivot] Fuente cambiada a:', sheet.label,
      '-', sheet.rowData.length, 'registros,', this.pivotColumns().length, 'columnas');
  }

  /** Cuando el componente pivot genera resultados */
  onPivotGenerated(result: PivotResult): void {
    // Construir columnDefs para AG Grid
    const pivotCols: ColDef[] = [
      {
        headerName: '', field: '__ROW_NUMBER__',
        width: 50, minWidth: 50, maxWidth: 50,
        resizable: false, sortable: false, filter: false,
        pinned: 'left', lockPinned: true,
        cellClass: 'bi-cell-row-number',
        headerClass: 'excel-corner-header',
        valueGetter: (p) => p.node?.rowIndex != null ? p.node.rowIndex + 1 : '',
      },
    ];

    result.columns.forEach(col => {
      pivotCols.push({
        field: col.field,
        headerName: col.headerName,
        type: col.type || undefined,
        pinned: result.columns.indexOf(col) < 2 ? 'left' : undefined,
        valueFormatter: col.type === 'numericColumn'
          ? (p) => p.value != null ? Number(p.value).toLocaleString('es-CO', { maximumFractionDigits: 2 }) : ''
          : undefined,
      });
    });

    // ─── Crear o actualizar la hoja Pivot ────────────────────────────────────
    //
    // IMPORTANTE: NO tocar la hoja de datos. El pivot opera sobre una COPIA
    // de los datos (pivotSourceData) y sus resultados van SOLO a la hoja Pivot.
    // Antes esto llamaba saveActiveSheetData antes de crear el pivot, pero eso
    // sobreescribia la hoja de datos con pivot data si se llamaba mas de una vez.

    // La hoja de pivot se identifica por su HOJA FUENTE, no por la etiqueta.
    //
    // Antes se buscaba `label === 'Pivot'`, asi que con varias vistas abiertas
    // todos los pivots colisionaban en una sola hoja: dinamizar la segunda vista
    // sobreescribia el pivot de la primera. Ahora cada hoja de datos tiene su
    // propio pivot y ambos conviven, como en Excel.
    const sourceSheet   = this.sheets().find(s => s.id === this.pivotSourceSheetId);
    const sourceLabel   = sourceSheet?.label ?? this.viewName;
    const sourceView    = sourceSheet?.viewName ?? this.viewName;
    const pivotSheetId  = `sheet-pivot-${this.pivotSourceSheetId || sourceView}`;
    const existingPivot = this.sheets().find(s => s.id === pivotSheetId);

    // Devolver a la hoja fuente sus datos originales, por si el pivot anterior
    // los habia dejado a medias. Se escribe en SU id, nunca en "la activa".
    if (this.pivotSourceSheetId && this.pivotSourceData.length > 0) {
      this.sheets.update(sheets => {
        const ds = sheets.find(s => s.id === this.pivotSourceSheetId);
        if (ds && (ds.kind ?? 'view') === 'view') {
          ds.rowData = this.pivotSourceData;
          if (!ds.columnDefs || ds.columnDefs.length === 0) {
            ds.columnDefs = this.columnDefs;
          }
        }
        return [...sheets];
      });
    }

    if (!existingPivot) {
      this.sheets.update(sheets => {
        sheets.forEach(s => s.active = false);
        sheets.push({
          id: pivotSheetId,
          label: `Pivot · ${sourceLabel}`,
          schema: sourceSheet?.schema ?? this.schema,
          viewName: `Pivot - ${sourceView}`,
          active: true,
          kind: 'pivot',
          rowData: result.rows,
          columnDefs: pivotCols,
          columns: [],
        });
        return [...sheets];
      });
    } else {
      // Actualizar la hoja pivot existente — NO tocar otras hojas
      this.sheets.update(sheets => {
        const pivot = sheets.find(s => s.id === pivotSheetId);
        if (pivot) {
          pivot.rowData    = result.rows;
          pivot.columnDefs = pivotCols;
        }
        sheets.forEach(s => s.active = s.id === pivotSheetId);
        return [...sheets];
      });
    }

    // Solo aplicar al grid si la hoja Pivot es la activa AHORA.
    // Si el usuario ve la hoja de datos y el pivot se auto-genera al arrastrar
    // un campo, NO tocar la grilla. Los datos ya estan en sheet.rowData.
    // El usuario vera los resultados al hacer clic en la pestana Pivot.
    const nowActive = this.sheets().find(s => s.active);
    if (nowActive && (nowActive.kind ?? 'view') === 'pivot') {
      this.rawData    = result.rows;
      this.rowData    = result.rows;
      this.columnDefs = pivotCols;
      this.columns    = [];
      this.applyColumnDefs();
      this.totalRows.set(result.rows.length);
      this.filteredRows.set(result.rows.length);

      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', result.rows);
        setTimeout(() => this.autoSizeColumns(), 50);
      }
    }
  }

  // -Metricas de Performance -
  private updatePerformanceMetrics(): void {
    const totalRows = this.totalRows();
    const filteredRows = this.filteredRows();
    const loadTimeSeconds = this.elapsed();
    
    // Estimacion aproximada de memoria: ~50-100 bytes por celda
    const avgBytesPerCell = 75;
    const numColumns = this.columnDefs.length;
    const estimatedBytes = totalRows * numColumns * avgBytesPerCell;
    const memoryUsageMB = Math.round((estimatedBytes / 1024 / 1024) * 100) / 100;
    
    // Alertar si se acerca al limite (>80K registros)
    const isNearLimit = totalRows > 80000;
    
    this.perfMetrics.set({
      totalRows,
      filteredRows,
      loadTimeSeconds,
      memoryUsageMB,
      isNearLimit,
    });
    
    if (isNearLimit) {
      console.warn('[Performance] Acercandose al limite de registros:', totalRows);
    }
    
    console.log('[Performance] Metricas actualizadas:', {
      totalRows,
      filteredRows,
      loadTimeSeconds,
      memoryUsageMB,
      isNearLimit,
    });
  }

  // --- Auto-save workbook state ---

  private readonly workbookService = inject(WorkbookStateService);

  /**
   * ID del workbook si fue abierto desde "Mis Excels".
   * Cuando es null el workbook se crea automaticamente en el primer guardado.
   */
  currentWorkbookId: number | null = null;

  /**
   * Guarda el estado completo del workspace del usuario.
   *
   * Se llama de forma implicita al:
   * - Cambiar filtros
   * - Cambiar formato de columna
   * - Cerrar/abrir hojas
   * - Cada que AG Grid detecta cambio relevante (column resize, sort, etc.)
   *
   * Flujo:
   *  1. Si tenemos un workbookId: auto-save al backend (debounced 3s)
   *  2. Si no tenemos workbookId: crear el workbook la primera vez, luego auto-save
   *  3. Ademas se guarda el per-view quick-state (bi_workbook_states) como antes
   */
  saveWorkbookState(): void {
    if (!this.schema || !this.viewName) return;

    const state = this.buildCurrentState();

    // --- Quick-state por vista (esquema original, retrocompatible) ---
    this.workbookService.save(this.schema, this.viewName, state);

    // --- Workbook multi-vista (Mis Excels) ---
    if (this.currentWorkbookId) {
      this.workbookService.saveWorkbookState(this.currentWorkbookId, state);
    } else {
      // Crear el workbook automaticamente la primera vez que hay datos cargados
      this.createWorkbookIfNeeded(state);
    }
  }

  /** Construye el blob de estado del workspace actual */
  private buildCurrentState(): import('../../services/workbook-state.service').WorkbookState {
    // Extraer formulas escritas en hojas de calculo (para restaurar luego)
    const formulas: Record<string, Record<string, string>> = {};
    for (const sheet of this.sheets()) {
      if ((sheet.kind ?? 'view') !== 'blank') continue;
      if (!sheet.rowData || sheet.rowData.length === 0) continue;
      const sheetFormulas: Record<string, string> = {};
      sheet.rowData.forEach((row, rowIdx) => {
        Object.entries(row).forEach(([col, val]) => {
          if (typeof val === 'string' && val.startsWith('=')) {
            sheetFormulas[`${rowIdx}:${col}`] = val;
          }
        });
      });
      if (Object.keys(sheetFormulas).length > 0) formulas[sheet.id] = sheetFormulas;
    }

    return {
      sheets: this.sheets().map(s => ({
        id: s.id, label: s.label, schema: s.schema, viewName: s.viewName,
        active: s.active, kind: s.kind,
      })),
      activeSheetId: this.sheets().find(s => s.active)?.id || '',
      hiddenColumns: this.hiddenColumnIds(),
      filters: this.activeFilters(),
      pivotConfig: this.pivotConfig(),
      zoom: this.zoom(),
      formulas: Object.keys(formulas).length > 0 ? formulas : undefined,
    };
  }

  /** Crea el workbook en el backend si todavia no existe para esta sesion */
  private createWorkbookIfNeeded(state: import('../../services/workbook-state.service').WorkbookState): void {
    // Solo crear si ya hay al menos una hoja con datos
    if (this.rawData.length === 0) return;
    // Evitar multiples creaciones (el debounce del service ya ayuda, pero por si acaso)
    if ((this as any).__creatingWb) return;
    (this as any).__creatingWb = true;

    const views = this.sheets()
      .filter(s => (s.kind ?? 'view') === 'view' && s.viewName)
      .map(s => ({ schema: s.schema, viewName: s.viewName, label: s.label }));

    if (views.length === 0) { (this as any).__creatingWb = false; return; }

    this.workbookService.createWorkbook({
      name: views.length === 1
        ? views[0].label
        : `${views[0].label} + ${views.length - 1} mas`,
      description: `Creado automaticamente al abrir ${views.map(v => v.viewName).join(', ')}`,
      views,
      state,
    }).then(wb => {
      (this as any).__creatingWb = false;
      if (wb) {
        this.currentWorkbookId = wb.id;
        console.log('[Workbook] Creado automaticamente id:', wb.id);
      }
    });
  }

  /**
   * Restaura el estado completo desde un workbook guardado.
   * Se llama en ngOnInit cuando hay ?workbookId= en la URL.
   */
  private async restoreFromWorkbook(id: number): Promise<void> {
    console.log('[Workbook] Restaurando workbook id:', id);
    const wb = await this.workbookService.loadWorkbook(id);

    if (!wb || !wb.state) {
      console.warn('[Workbook] No se pudo cargar, cargando vista por defecto');
      this.loadMeta();
      return;
    }

    // Restaurar zoom
    if (wb.state.zoom) this.zoom.set(wb.state.zoom);

    // Restaurar hojas: crear la estructura de pestanas ANTES de cargar datos
    if (wb.state.sheets && wb.state.sheets.length > 0) {
      const restoredSheets = wb.state.sheets.map(s => ({
        id: s.id,
        label: s.label,
        schema: s.schema,
        viewName: s.viewName,
        active: s.active,
        kind: (s.kind ?? 'view') as 'view' | 'blank' | 'pivot',
        rowData: [] as Record<string, unknown>[],
        columnDefs: [] as any[],
        columns: [] as any[],
      }));
      this.sheets.set(restoredSheets);
    }

    // Restaurar filtros
    if (wb.state.filters?.length > 0) {
      this.activeFilters.set(wb.state.filters);
    }

    // Restaurar columnas ocultas (se aplican despues de que la grilla monte)
    if (wb.state.hiddenColumns?.length > 0) {
      this.hiddenColumnIds.set(wb.state.hiddenColumns);
    }

    console.log('[Workbook] Estado restaurado, cargando datos de la primera vista...');

    // Ahora cargar los datos de la hoja activa (o la primera de datos)
    const activeSheet = this.sheets().find(s => s.active) ?? this.sheets()[0];
    if (activeSheet && activeSheet.viewName) {
      this.schema   = activeSheet.schema;
      this.viewName = activeSheet.viewName;
      this.loadMeta();
    } else {
      this.loadInFlight = false;
    }
  }

  private async loadWorkbookState(): Promise<void> {
    if (!this.schema || !this.viewName) return;
    // Si ya restauramos desde un workbook, no pisar con el quick-state
    if (this.currentWorkbookId) return;

    const state = await this.workbookService.load(this.schema, this.viewName);
    if (state) {
      if (state.hiddenColumns?.length > 0 && this.gridApi) {
        this.gridApi.setColumnsVisible(state.hiddenColumns, false);
        this.hiddenColumnIds.set(state.hiddenColumns);
      }
      if (state.zoom) this.zoom.set(state.zoom);
      console.log('[Workbook] Quick-state restaurado');
    }
  }

  // ── Registro de vistas para formulas ──────────────────────────────────────

  /**
   * Publica la vista recien cargada en el registro que consultan las formulas.
   * Las filas se comparten por referencia, y los indices de busqueda se crean
   * solo cuando una formula pregunta por una columna concreta.
   */
  private registerActiveViewForFormulas(data: Record<string, unknown>[]): void {
    if (!this.viewName || data.length === 0) return;

    const colNames = this.columns.length > 0
      ? this.columns.map(c => c.name)
      : Object.keys(data[0] ?? {}).filter(k => k !== '__ROW_NUMBER__');

    this.viewRegistry.register(this.viewName, data, colNames);

    // Las funciones de vista leen datos externos al motor, asi que HyperFormula
    // no se enteraria del refresco por si sola.
    this.viewRegistry.invalidateIndexes(this.viewName);
    if (this.formulaEngine.isReady) this.formulaEngine.recalculate();
  }

  /** Cuantas hojas de datos (vistas de Fabric) hay abiertas ahora mismo. */
  private loadedViewCount(): number {
    return this.sheets().filter(s => (s.kind ?? 'view') === 'view' && !!s.viewName).length;
  }

  // ── Cola secuencial de cargas ─────────────────────────────────────────────
  //
  // Fabric se satura si se le piden varios exports a la vez, sobre todo con
  // vistas de cientos de miles de filas. Las vistas se cargan de UNA EN UNA:
  // si el usuario abre tres seguidas, las dos ultimas quedan en cola y arrancan
  // cuando la anterior termina (o falla).

  /** Vistas esperando turno para cargarse */
  private readonly loadQueue: VistaBi[] = [];
  /** Hay una carga en curso ocupando el turno */
  private loadInFlight = false;

  /**
   * Hoja a la que pertenece la carga en curso.
   *
   * Toda la cadena de carga es asincrona (columns -> export -> polling ->
   * download -> parse), y puede tardar minutos. Si durante ese rato el usuario
   * cambia de pestaña, "la hoja activa" ya no es la que pidio los datos: al
   * llegar, se guardaban en la hoja equivocada y quedaba "pegada" con los datos
   * de otra vista. Por eso el destino se fija AL INICIAR la carga y no se
   * vuelve a consultar.
   */
  private loadTargetSheetId = '';

  readonly queuedViewCount = signal(0);

  private enqueueViewLoad(vista: VistaBi): void {
    this.loadQueue.push(vista);
    this.queuedViewCount.set(this.loadQueue.length);
    this.pumpLoadQueue();
  }

  /**
   * Arranca la siguiente carga si no hay ninguna en curso.
   *
   * La hoja destino se activa AQUI, no al encolarla: si se activara antes, la
   * carga que todavia esta en vuelo guardaria sus filas en la hoja equivocada
   * (saveActiveSheetData escribe siempre en la hoja activa).
   */
  private pumpLoadQueue(): void {
    if (this.loadInFlight) return;

    const next = this.loadQueue.shift();
    this.queuedViewCount.set(this.loadQueue.length);
    if (!next) return;

    this.loadInFlight = true;
    console.log('[loadQueue] Iniciando carga de', next.view_name, '| pendientes:', this.loadQueue.length);

    const targetId = `sheet-${next.schema}-${next.view_name}`;

    // Guardar lo que hay en la hoja activa antes de cederle el turno a la nueva
    this.saveActiveSheetData(this.rawData, this.columnDefs);

    // Fijar el destino de esta carga: startRefresh y parseAndLoad lo respetan
    this.loadTargetSheetId = targetId;

    this.sheets.update(sheets => {
      sheets.forEach(s => s.active = s.id === targetId);
      return [...sheets];
    });

    // Vaciar la grilla mientras carga, para no mostrar los datos de la hoja anterior
    this.rawData = [];
    this.rowData = [];
    this.columnDefs = [];
    this.gridApi?.setGridOption('rowData', []);

    this.schema   = next.schema;
    this.viewName = next.view_name;
    this.vista    = next;
    this.loadColumns();
  }

  /**
   * Libera el turno de la cola. Se llama tanto al terminar bien como al fallar,
   * si no la cola se quedaria bloqueada para siempre.
   */
  private releaseLoadSlot(): void {
    if (!this.loadInFlight) return;
    this.loadInFlight = false;
    // Un tick de aire para que la grilla acabe de renderizar antes del siguiente export
    setTimeout(() => this.pumpLoadQueue(), 250);
  }

  // ── Cierre de hojas ───────────────────────────────────────────────────────

  /**
   * Cierra una pestana. Si era una hoja de datos libera su vista del registro
   * de formulas (y por tanto sus indices); si era de calculo quita su hoja del
   * motor de formulas.
   */
  onCloseSheet(sheetId: string): void {
    const list = this.sheets();
    if (list.length <= 1) return; // siempre queda al menos una hoja, como Excel

    const sheet = list.find(s => s.id === sheetId);
    if (!sheet) return;

    const kind = sheet.kind ?? 'view';
    if (kind === 'view' && sheet.viewName) {
      this.viewRegistry.unregister(sheet.viewName);
    } else {
      this.formulaEngine.removeSheet(sheet.id);
    }

    const wasActive = sheet.active;
    let nextActiveId = '';

    this.sheets.update(sheets => {
      const idx = sheets.findIndex(s => s.id === sheetId);
      if (idx >= 0) {
        // Liberar las filas de la hoja cerrada para que el GC pueda reclamarlas
        sheets[idx].rowData = undefined;
        sheets[idx].columnDefs = undefined;
        sheets.splice(idx, 1);
      }
      if (wasActive && sheets.length > 0) {
        const fallback = sheets[Math.min(idx, sheets.length - 1)];
        sheets.forEach(s => s.active = s.id === fallback.id);
        nextActiveId = fallback.id;
      }
      return [...sheets];
    });

    console.log('[onCloseSheet] Hoja cerrada:', sheet.label, '| vistas cargadas:', this.loadedViewCount());

    if (nextActiveId) this.loadSheetData(nextActiveId);
  }

  /**
   * Guarda los datos cargados en la hoja activa actual
   */
  private saveActiveSheetData(data: Record<string, unknown>[], columnDefs: ColDef[]): void {
    const activeId = this.sheets().find(s => s.active)?.id;
    if (activeId) this.saveSheetData(activeId, data, columnDefs);
  }

  /**
   * Guarda datos en UNA hoja concreta, identificada por id.
   *
   * Se usa al terminar una carga: el destino es la hoja que la pidio
   * (loadTargetSheetId), no la que este activa en ese momento. Si el usuario
   * cambio de pestaña mientras cargaba, los datos igual caen donde deben.
   */
  private saveSheetData(sheetId: string, data: Record<string, unknown>[], columnDefs: ColDef[]): void {
    if (data.length === 0 || columnDefs.length === 0) return;

    this.sheets.update(sheets => {
      const activeSheet = sheets.find(s => s.id === sheetId);
      if (!activeSheet) return [...sheets];

      const kind = activeSheet.kind ?? 'view';

      // PROTECCION: no sobreescribir una hoja de datos con resultados de pivot.
      // Si la hoja es de tipo 'view' y ya tiene datos guardados con mas columnas
      // que lo que estamos intentando guardar, rechazar.
      if (kind === 'view' && activeSheet.rowData && activeSheet.rowData.length > 0) {
        const existingColCount = activeSheet.columnDefs?.length ?? 0;
        if (existingColCount > 5 && columnDefs.length <= 5 && data.length < activeSheet.rowData.length) {
          console.warn('[saveActiveSheetData] BLOQUEADO: intento de sobreescribir hoja de datos con pivot data',
            { sheet: activeSheet.label, existingCols: existingColCount, newCols: columnDefs.length });
          return [...sheets];
        }
      }

      activeSheet.rowData    = data;
      activeSheet.columnDefs = columnDefs;
      activeSheet.columns    = this.columns;
      return [...sheets];
    });
  }
  /**
   * Carga los datos de una hoja especifica cuando el usuario cambia de pestana
   */
  private loadSheetData(sheetId: string): void {
    console.log('[loadSheetData] Cargando hoja:', sheetId);
    const sheet = this.sheets().find(s => s.id === sheetId);
    if (!sheet) return;

    // Recuperar el contexto de formulas de la hoja: si es de calculo, sus
    // formulas siguen vivas en su propia hoja de HyperFormula.
    const kind = sheet.kind ?? 'view';
    if (kind === 'blank') {
      this.formulaEngine.ensureSheet(sheet.id, BLANK_SHEET_ROWS, BLANK_SHEET_COLS);
      this.activeFormulaSheet = sheet.id;
    } else {
      this.activeFormulaSheet = '';
    }

    // Si la hoja ya tiene datos cargados, restaurarlos
    if (sheet.rowData && sheet.rowData.length > 0 && sheet.columnDefs && sheet.columnDefs.length > 0) {
      console.log('[loadSheetData] Restaurando datos existentes:', sheet.rowData.length, 'registros');

      // Restaurar datos de la hoja: cada hoja es independiente.
      this.rawData    = sheet.rowData;
      this.columnDefs = sheet.columnDefs;
      this.columns    = sheet.columns ?? [];
      this.rowData    = [...sheet.rowData];

      // Los desplegables del ribbon (Filtros y Formato) se alimentan de
      // colOptions. Sin refrescarlo aqui, al cambiar de pestaña seguian
      // ofreciendo las columnas de la vista anterior y filtrar no hacia nada.
      this.colOptions.set(this.columns.map(c => ({
        label: humanizeColumnName(c.name),
        value: c.name,
      })));

      // El builder de filtros apuntaba a una columna que ya no existe
      this.filterBuilder = { col: '' };
      this.selectedColType.set(null);
      this.columnStats.set(null);

      this.applyColumnDefs();

      this.totalRows.set(sheet.rowData.length);
      this.filteredRows.set(sheet.rowData.length);

      // Actualizar metadatos de UI
      this.schema   = sheet.schema;
      this.viewName = sheet.viewName;

      // Reaplicar filtros si hay (solo para hojas de datos)
      if (kind === 'view' && this.activeFilters().length > 0) {
        this.applyFiltersToGrid();
      }

      // Refrescar grid
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.rowData);
        setTimeout(() => this.autoSizeColumns(), 100);
      }
        } else {
      if (kind !== 'view' || !sheet.schema || !sheet.viewName) {
        console.log('[loadSheetData] Hoja sin datos y sin vista asociada, nada que cargar');
        return;
      }
      console.log('[loadSheetData] Sin datos, cargando por primera vez...');
      // Si no tiene datos, cargarlos por primera vez respetando la cola
      this.schema = sheet.schema;
      this.viewName = sheet.viewName;
      if (this.loadInFlight) {
        console.log('[loadSheetData] Hay otra carga en curso, se respeta el turno');
        return;
      }
      this.loadInFlight = true;
      this.loadTargetSheetId = sheet.id;
      this.loadMeta();
    }
  }

  /**
   * Maneja el evento de cambio de hoja desde el ExcelSheetComponent
   */
  onSheetTabChange(sheetId: string): void {
    console.log('[onSheetTabChange] Cambiando a hoja:', sheetId);
    
    // Guardar datos de la hoja actual antes de cambiar
    this.saveActiveSheetData(this.rawData, this.columnDefs);

    // Cambiar hoja activa (modificar in-place, no copiar)
    this.sheets.update(sheets => {
      sheets.forEach(s => s.active = s.id === sheetId);
      return [...sheets];
    });

    // Cargar datos de la nueva hoja
    this.loadSheetData(sheetId);
  }

  /**
   * Abre la vista seleccionada como nueva hoja en la misma ventana
   */
  addViewAsSheet(vista: VistaBi): void {
    console.log('[addViewAsSheet] Agregando vista:', vista.nombre);
    
    this.closeAddViewPanel();
    
    const newSheetId = `sheet-${vista.schema}-${vista.view_name}`;
    
    // Verificar si la vista ya esta abierta
    const existingSheet = this.sheets().find(s => s.id === newSheetId);
    if (existingSheet) {
      console.log('[addViewAsSheet] Vista ya existe, activandola');
      this.onSheetTabChange(newSheetId);
      return;
    }

    // El limite de 5 es de VISTAS cargadas, no de hojas: las hojas de analisis
    // son ilimitadas porque no consumen memoria de datos.
    const MAX = ViewVistasRefreshComponent.MAX_LOADED_VIEWS;
    if (this.loadedViewCount() >= MAX) {
      alert(
        `Maximo ${MAX} vistas cargadas a la vez (limite de memoria del navegador).\n` +
        `Cierra una hoja de datos con la X de su pestana antes de abrir otra.\n\n` +
        `Las hojas de analisis (formulas, tablas dinamicas) no tienen limite.`
      );
      return;
    }

    // Guardar datos de la hoja actual antes de agregar la nueva
    this.saveActiveSheetData(this.rawData, this.columnDefs);

    // Agregar nueva hoja INACTIVA: la activa pumpLoadQueue cuando le toque turno
    this.sheets.update(sheets => {
      sheets.push({
        id: newSheetId,
        // Nombre original de la vista: es el que se puede buscar en Fabric y el
        // que usan las formulas (BUSCARVISTA lee viewName, no una etiqueta).
        label: vista.view_name,
        schema: vista.schema,
        viewName: vista.view_name,
        active: false,
        kind: 'view',
        rowData: [],
        columnDefs: [],
        columns: [],
      });

      console.log('[addViewAsSheet] Total hojas:', sheets.length);
      return [...sheets];
    });

    // La carga va por cola: de una en una para no saturar Fabric
    this.enqueueViewLoad(vista);
  }

  /**
   * Agrega una hoja vacia para analisis personalizado
   */
  addBlankSheet(): void {
    console.log('[addBlankSheet] Creando hoja vacia');

    // Guardar datos de la hoja actual
    this.saveActiveSheetData(this.rawData, this.columnDefs);

    // Las hojas de calculo NO tienen limite: no cargan datos de Fabric, solo
    // celdas. El tope de 5 aplica unicamente a las vistas cargadas.
    const analysisCount = this.sheets().filter(s => (s.kind ?? 'view') === 'blank').length;
    const newSheetId = `sheet-blank-${Date.now()}`;
    const label = `Analisis ${analysisCount + 1}`;

    this.sheets.update(sheets => {
      sheets.forEach(s => s.active = false);
      sheets.push({
        id: newSheetId,
        label,
        schema: '',
        viewName: '',
        active: true,
        kind: 'blank',
        rowData: [],
        columnDefs: [],
        columns: [],
      });
      console.log('[addBlankSheet] Total hojas:', sheets.length);
      return [...sheets];
    });

    // Cada hoja de analisis tiene SU PROPIA hoja dentro de HyperFormula, asi las
    // formulas sobreviven al cambio de pestana y se pueden cruzar entre hojas.
    this.formulaEngine.ensureSheet(newSheetId, BLANK_SHEET_ROWS, BLANK_SHEET_COLS);
    this.activeFormulaSheet = newSheetId;

    // Generar grid vacio tipo Excel: 26 columnas (A-Z) + 100 filas vacias
    const blankColumnDefs: ColDef[] = [
      {
        headerName: '',
        field: '__ROW_NUMBER__',
        width: 50,
        minWidth: 50,
        maxWidth: 50,
        resizable: false,
        sortable: false,
        filter: false,
        pinned: 'left',
        lockPinned: true,
        cellClass: 'bi-cell-row-number',
        headerClass: 'excel-corner-header',
        valueGetter: (params) => params.node?.rowIndex != null ? params.node.rowIndex + 1 : '',
        cellStyle: {
          fontWeight: 'bold',
          color: '#666',
          textAlign: 'center',
          backgroundColor: '#f3f4f6',
          borderRight: '1px solid #d1d5db',
        },
      },
    ];
    
    // Generar columnas A-Z con soporte de formulas.
    // `sheetKey` queda capturado en el closure: cada hoja escribe y lee de SU
    // propia hoja de HyperFormula, aunque compartan la misma instancia del motor.
    const sheetKey = newSheetId;
    for (let i = 0; i < BLANK_SHEET_COLS; i++) {
      const letter = this.getExcelColumnLetter(i);
      const colField = `col_${letter}`;
      const colIndex = i;
      blankColumnDefs.push({
        field: colField,
        headerName: letter,
        width: 100,
        minWidth: 80,
        editable: true,
        sortable: false,
        filter: false,
        headerClass: 'excel-name-header',
        valueGetter: (params: any) => {
          const raw = params.data?.[colField];
          // Si es formula, mostrar el RESULTADO calculado (como Excel)
          if (typeof raw === 'string' && raw.startsWith('=')) {
            try {
              const rowIdx = params.node?.rowIndex ?? 0;
              const calc = this.formulaEngine.getCellValue(sheetKey, rowIdx, colIndex);
              return calc === null || calc === undefined ? '' : calc;
            } catch { return raw; }
          }
          return raw;
        },
        valueSetter: (params: any) => {
          const newValue = params.newValue;
          const rowIdx = params.node?.rowIndex ?? 0;

          // El dato crudo (la formula tal cual se escribio) vive en la fila
          params.data[colField] = newValue;

          if (typeof newValue === 'string' && newValue.startsWith('=')) {
            this.formulaEngine.setCellValue(sheetKey, rowIdx, colIndex, newValue);
          } else {
            // Valor plano: numerico si se puede, para que SUMA/PROMEDIO funcionen
            const txt = newValue == null ? '' : String(newValue).trim();
            const numVal = txt === '' ? NaN : Number(txt.replace(',', '.'));
            this.formulaEngine.setCellValue(
              sheetKey, rowIdx, colIndex,
              txt === '' ? null : (Number.isNaN(numVal) ? txt : numVal),
            );
          }

          // Cualquier celda puede depender de la editada: refrescar toda la vista
          params.api?.refreshCells({ force: true });
          return true;
        },
        cellStyle: (params: any) => {
          const val = params.data?.[colField];
          if (typeof val === 'string' && val.startsWith('=')) {
            return { color: '#1e40af', fontStyle: 'italic' };
          }
          return null;
        },
      });
    }

    // Generar filas vacias
    const blankRowData: Record<string, unknown>[] = [];
    for (let i = 0; i < BLANK_SHEET_ROWS; i++) {
      const row: Record<string, unknown> = {};
      for (let j = 0; j < BLANK_SHEET_COLS; j++) {
        row[`col_${this.getExcelColumnLetter(j)}`] = '';
      }
      blankRowData.push(row);
    }

    this.rawData = blankRowData;
    this.rowData = blankRowData;
    this.columnDefs = blankColumnDefs;
    this.columns = [];
    this.applyColumnDefs();
    this.totalRows.set(BLANK_SHEET_ROWS);
    this.filteredRows.set(BLANK_SHEET_ROWS);
    this.activeFilters.set([]);

    // Persistir de una en la hoja recien creada, para que al volver siga ahi
    this.saveActiveSheetData(blankRowData, blankColumnDefs);

    // Actualizar grid
    if (this.gridApi) {
      this.applyColumnDefs();
      this.gridApi.setGridOption('rowData', blankRowData);
    }
  }

  onSecondaryAction(action: string): void {
    if (action === 'close') {
      window.opener ? window.close() : history.back();
    }
  }

  /**
   * Confirmacion desde la barra de formulas (Enter). Escribe en la celda
   * enfocada de la hoja de calculo activa. En las hojas de datos no hace nada:
   * son un espejo de la vista de Fabric.
   */
  onFormulaCommit(event: FormulaCommitEvent): void {
    this.formulaSuggestions = [];

    if (!this.isEditableSheet() || !this.focusedCell) return;

    const { rowIndex, colId } = this.focusedCell;
    const row = this.rowData[rowIndex];
    if (!row) return;

    const colIndex = this.columnDefs.findIndex(c => c.field === colId) - 1; // -1 por __ROW_NUMBER__
    if (colIndex < 0) return;

    row[colId] = event.value;

    const txt = (event.value ?? '').trim();
    if (txt.startsWith('=')) {
      this.formulaEngine.setCellValue(this.activeFormulaSheet, rowIndex, colIndex, txt);
    } else {
      const numVal = txt === '' ? NaN : Number(txt.replace(',', '.'));
      this.formulaEngine.setCellValue(
        this.activeFormulaSheet, rowIndex, colIndex,
        txt === '' ? null : (Number.isNaN(numVal) ? txt : numVal),
      );
    }

    this.gridApi?.refreshCells({ force: true });
  }
  onZoomChange(pct: number): void { this.zoom.set(pct); }

  // -Helpers -
  private elapsed(): number {
    return this.startTime ? Math.round((Date.now() - this.startTime) / 1000) : 0;
  }

  private startElapsedTimer(): void {
    this.elapsedTimer = setInterval(() => {
      if (this.startTime) {
        this.progress.update(p => ({ ...p, elapsed: this.elapsed() }));
      }
    }, 1000);
  }

  private clearTimers(): void {
    if (this.pollTimer)    { clearInterval(this.pollTimer);    this.pollTimer    = null; }
    if (this.elapsedTimer) { clearInterval(this.elapsedTimer); this.elapsedTimer = null; }
    this.stopR2Polling();
  }

  private setError(detail: string): void {
    this.clearTimers();
    this.progress.set({
      status: 'error',
      message: 'No se pudieron cargar los datos.',
      percent: 0,
      rows: 0,
      elapsed: this.elapsed(),
      errorDetail: detail,
    });
    // Que un fallo no deje la cola bloqueada
    this.releaseLoadSlot();
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * Alterna pantalla completa usando la Fullscreen API del navegador.
   * Entra en fullscreen todo el documento (la app Excel ocupa toda la pantalla).
   */
  private toggleFullscreen(): void {
    const doc = document as Document & {
      webkitFullscreenElement?: Element;
      webkitExitFullscreen?: () => Promise<void>;
    };
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };

    const isFullscreen = !!(document.fullscreenElement || doc.webkitFullscreenElement);

    if (!isFullscreen) {
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(err => console.warn('[Fullscreen] Error:', err));
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      }
    }
  }

  filterLabel(f: DynamicFilter): string {
    switch (f.colType) {
      case 'date':    return `${f.label}: ${f.dateFrom ?? ''}..${f.dateTo ?? ''}`;
      case 'number':  return `${f.label} ${f.numMode === 'between' ? `[${f.numFrom}-${f.numTo}]` : `${f.numMode} ${f.numFrom}`}`;
      case 'boolean': return `${f.label}: ${f.boolValue === '1' ? 'Si' : 'No'}`;
      default:        return `${f.label} ${f.textMode ?? 'contiene'} "${f.textValue}"`;
    }
  }

  // Exponer helpers al template
  readonly getColumnType = getColumnType;

  // Helpers de estado para el template -
  isLoading(): boolean {
    const s = this.progress().status;
    return s === 'queuing' || s === 'processing' || s === 'downloading' || s === 'parsing';
  }

  isRefreshing(): boolean {
    return this.isLoading();
  }

  canCancel(): boolean {
    const s = this.progress().status;
    return s === 'queuing' || s === 'processing';
  }

  /**
   * Un paso se marca como "done" cuando el estado actual ya paso ese paso.
   * Orden: queuing -> processing -> downloading -> parsing -> ready
   */
  stepDone(step: RefreshStatus): boolean {
    const order: RefreshStatus[] = ['idle', 'queuing', 'processing', 'downloading', 'parsing', 'ready', 'error'];
    const current = order.indexOf(this.progress().status);
    const target  = order.indexOf(step);
    return current > target && this.progress().status !== 'error';
  }
}
