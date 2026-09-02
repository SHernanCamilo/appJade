/**
 * ══════════════════════════════════════════════════════════════════════════
 * Excel Sheet Component — Interfaces & Models
 *
 * Defines the configuration API for the reusable ExcelSheetComponent.
 * Consumers pass these configs as @Inputs to customize the Excel shell.
 * ══════════════════════════════════════════════════════════════════════════
 */

// ─── Title Bar ──────────────────────────────────────────────────────────────

export interface ExcelTitleConfig {
  /** Document name displayed in the title bar. */
  documentName: string;
  /** Optional subtitle (e.g., proveedor name). */
  subtitle?: string;
  /** Shows a save-state indicator (e.g., "Sin guardar", "Guardado"). */
  saveState?: 'unsaved' | 'saving' | 'saved';
  /** Primary action button config (e.g., "Guardar Recepción"). */
  primaryAction?: {
    label: string;
    icon?: string;
    disabled?: boolean;
    loading?: boolean;
  };
  /** Secondary action buttons (e.g., "Cerrar"). */
  secondaryActions?: {
    label: string;
    icon?: string;
    action: string; // event identifier
  }[];
}

// ─── Ribbon ─────────────────────────────────────────────────────────────────

export type RibbonButtonSize = 'lg' | 'sm';
export type RibbonItemType = 'button' | 'separator' | 'toggle' | 'dropdown' | 'color' | 'legend';

export interface RibbonButton {
  type: 'button' | 'toggle';
  id: string;
  label?: string;
  icon?: string;
  tooltip?: string;
  size?: RibbonButtonSize;
  active?: boolean;
  disabled?: boolean;
}

export interface RibbonSeparator {
  type: 'separator';
}

export interface RibbonDropdown {
  type: 'dropdown';
  id: string;
  label?: string;
  icon?: string;
  tooltip?: string;
  size?: RibbonButtonSize;
  options: { label: string; value: string }[];
  value?: string;
}

export interface RibbonLegend {
  type: 'legend';
  items: { color: string; label: string }[];
}

export type RibbonItem = RibbonButton | RibbonSeparator | RibbonDropdown | RibbonLegend;

export interface RibbonGroup {
  /** Group title shown at the bottom (e.g., "Portapapeles", "Fuente"). */
  title: string;
  /** Items in this group. */
  items: RibbonItem[];
  /** Whether this group stretches to fill available space. */
  grow?: boolean;
}

export interface RibbonTab {
  /** Tab label displayed in the tab strip. */
  label: string;
  /** Unique identifier. */
  id: string;
  /** Groups of buttons shown when this tab is active. */
  groups: RibbonGroup[];
}

// ─── Formula Bar ────────────────────────────────────────────────────────────

export interface FormulaCellInfo {
  /** Cell reference displayed in the Name Box (e.g., "C1", "N5"). */
  reference: string;
  /** Current cell value displayed in the formula input. */
  value: string;
  /** Whether the formula input is editable. */
  editable: boolean;
}

// ─── Sheet Tabs ─────────────────────────────────────────────────────────────

export interface SheetTab {
  id: string;
  label: string;
  active?: boolean;
  color?: string;
  /**
   * Si es `false` la pestana no muestra la X de cerrar.
   * Por defecto se considera cerrable (igual que en Excel, salvo la ultima hoja).
   */
  closable?: boolean;
}

// ─── Status Bar ─────────────────────────────────────────────────────────────

export interface StatusBarItem {
  /** Unique key for tracking. */
  key: string;
  /** Display label. */
  label: string;
  /** Value (bold). */
  value: string | number;
  /** Color variant. */
  variant?: 'default' | 'ok' | 'warn' | 'bad';
}

export interface StatusBarConfig {
  /** "Listo", "Editando", etc. */
  readyText?: string;
  /** Dynamic counters. */
  items: StatusBarItem[];
  /** Hint text on the right (e.g., keyboard shortcuts). */
  hint?: string;
  /** Whether to show zoom controls. */
  showZoom?: boolean;
}

// ─── Combined Config ────────────────────────────────────────────────────────

export interface ExcelSheetConfig {
  title: ExcelTitleConfig;
  ribbonTabs: RibbonTab[];
  sheets?: SheetTab[];
  statusBar?: StatusBarConfig;
  /** Initial zoom percentage. Default: 100. */
  initialZoom?: number;
}

// ─── Events ─────────────────────────────────────────────────────────────────

export interface RibbonActionEvent {
  /** The ribbon button id that was clicked. */
  actionId: string;
  /** For dropdowns, the selected value. */
  value?: string;
  /** For toggles, the new active state. */
  active?: boolean;
}

export interface SheetTabEvent {
  /** Which sheet tab was clicked. */
  tabId: string;
}

export interface FormulaCommitEvent {
  /** New value committed from the formula bar. */
  value: string;
}

/**
 * Una sugerencia del autocompletado de la barra de formulas.
 * El shell solo la renderiza: quien la produce es el componente consumidor.
 */
export interface FormulaSuggestionItem {
  /** Que tipo de sugerencia es (cambia el icono y como se inserta). */
  kind: 'function' | 'view' | 'column';
  /** Texto que se inserta al aceptar. */
  insert: string;
  /** Titulo visible. */
  label: string;
  /** Linea secundaria: firma de la funcion o origen de la columna. */
  detail: string;
  /** Descripcion larga / ejemplo (tooltip). */
  hint?: string;
}
