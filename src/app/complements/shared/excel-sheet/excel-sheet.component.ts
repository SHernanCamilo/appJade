import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Nl2brPipe } from './pipes/nl2br.pipe';
import {
  ExcelSheetConfig,
  RibbonTab,
  RibbonGroup,
  RibbonItem,
  RibbonActionEvent,
  FormulaCellInfo,
  FormulaCommitEvent,
  FormulaSuggestionItem,
  SheetTab,
  SheetTabEvent,
  StatusBarConfig,
  StatusBarItem,
} from './models/excel-sheet.models';

@Component({
  selector: 'app-excel-sheet',
  standalone: true,
  imports: [CommonModule, FormsModule, Nl2brPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './excel-sheet.component.html',
  styleUrl: './excel-sheet.component.css',
})
export class ExcelSheetComponent {
  // ─── Inputs ───────────────────────────────────────────────────────────────

  @Input({ required: true }) config!: ExcelSheetConfig;

  /** Live cell info for the formula bar (updated by consumer on cell focus). */
  @Input() cellInfo: FormulaCellInfo = { reference: 'A1', value: '', editable: false };

  /** Loading state for the grid area. */
  @Input() loading = false;

  // ─── Outputs ──────────────────────────────────────────────────────────────

  @Output() ribbonAction = new EventEmitter<RibbonActionEvent>();
  @Output() primaryAction = new EventEmitter<void>();
  @Output() secondaryAction = new EventEmitter<string>();
  @Output() formulaCommit = new EventEmitter<FormulaCommitEvent>();
  @Output() sheetTabChange = new EventEmitter<SheetTabEvent>();
  @Output() zoomChange = new EventEmitter<number>();
  @Output() addSheet = new EventEmitter<void>();
  /** Se emite al pulsar la X de una pestana. El consumidor decide si la quita. */
  @Output() closeSheet = new EventEmitter<string>();

  /**
   * Se emite cada vez que cambia el texto o el cursor de la barra de formulas.
   * El consumidor responde poblando `formulaSuggestions`.
   */
  @Output() formulaInput = new EventEmitter<{ text: string; caret: number }>();

  // ─── Autocompletado de formulas ───────────────────────────────────────────

  /**
   * Sugerencias a mostrar bajo la barra de formulas. El componente es agnostico:
   * solo renderiza lo que le pasen. El consumidor decide que sugerir.
   */
  @Input() formulaSuggestions: FormulaSuggestionItem[] = [];

  /** Indice de la sugerencia resaltada (navegacion con flechas) */
  readonly suggestionIndex = signal(0);
  /** Si el desplegable esta visible */
  readonly suggestionsOpen = signal(false);

  // ─── Internal state ───────────────────────────────────────────────────────

  readonly activeTabId = signal('');
  readonly zoom = signal(100);
  readonly formulaValue = signal('');

  private static readonly ZOOM_STEPS = [50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200];

  // ─── Computed ─────────────────────────────────────────────────────────────

  readonly activeTab = computed(() => {
    const id = this.activeTabId();
    return this.config?.ribbonTabs?.find((t) => t.id === id) ?? this.config?.ribbonTabs?.[0];
  });

  // ─── Lifecycle hooks replacement via Input changes ────────────────────────

  ngOnChanges(): void {
    // Set initial active tab if not set
    if (!this.activeTabId() && this.config?.ribbonTabs?.length) {
      this.activeTabId.set(this.config.ribbonTabs[0].id);
    }
    // Set initial zoom
    if (this.config?.initialZoom && this.zoom() === 100) {
      this.zoom.set(this.config.initialZoom);
    }
    // Sync formula value from input
    this.formulaValue.set(this.cellInfo.value);
  }

  // ─── Tab strip ────────────────────────────────────────────────────────────

  setActiveTab(tabId: string): void {
    this.activeTabId.set(tabId);
  }

  // ─── Ribbon actions ───────────────────────────────────────────────────────

  onRibbonClick(item: RibbonItem): void {
    if (item.type === 'button') {
      this.ribbonAction.emit({ actionId: item.id });
    }
    if (item.type === 'toggle') {
      item.active = !item.active;
      this.ribbonAction.emit({ actionId: item.id, active: item.active });
    }
  }

  onRibbonDropdown(item: RibbonItem, value: string): void {
    if (item.type === 'dropdown') {
      item.value = value;
      this.ribbonAction.emit({ actionId: item.id, value });
    }
  }

  // ─── Title bar actions ────────────────────────────────────────────────────

  onPrimaryAction(): void {
    this.primaryAction.emit();
  }

  onSecondaryAction(action: string): void {
    this.secondaryAction.emit(action);
  }

  // ─── Formula bar + autocompletado ────────────────────────────────────────

  /** Texto escrito: pide sugerencias al consumidor. */
  onFormulaTextChange(value: string, input: HTMLInputElement): void {
    this.formulaValue.set(value);
    const caret = input.selectionStart ?? value.length;
    this.suggestionIndex.set(0);
    this.formulaInput.emit({ text: value, caret });
    this.suggestionsOpen.set(value.trim().startsWith('='));
  }

  onFormulaKeydown(event: KeyboardEvent): void {
    const input = event.target as HTMLInputElement;
    const hasSuggestions = this.formulaSuggestions.length > 0 &&
      (this.suggestionsOpen() || this.formulaValue().trim().startsWith('='));

    // Navegacion dentro del desplegable
    if (hasSuggestions) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.suggestionsOpen.set(true);
        this.suggestionIndex.update(i => (i + 1) % this.formulaSuggestions.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.suggestionsOpen.set(true);
        this.suggestionIndex.update(i => (i - 1 + this.formulaSuggestions.length) % this.formulaSuggestions.length);
        return;
      }
      // Tab acepta la sugerencia; Enter tambien si el desplegable esta abierto
      if (event.key === 'Tab' || (event.key === 'Enter' && this.suggestionsOpen())) {
        event.preventDefault();
        event.stopPropagation();
        this.acceptSuggestion(this.formulaSuggestions[this.suggestionIndex()], input);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        this.suggestionsOpen.set(false);
        return;
      }
    }

    // Sin desplegable: Enter confirma la formula
    if (event.key === 'Enter') {
      this.suggestionsOpen.set(false);
      this.formulaCommit.emit({ value: this.formulaValue() });
    }
  }

  /**
   * Blur con retardo: Tab causa blur ANTES de que Angular procese el
   * preventDefault() del keydown. Si cerramos inmediato el desplegable se va
   * antes de que keydown pueda aceptar la sugerencia. 150ms da margen de sobra
   * para que el keydown gane la carrera.
   */
  private blurTimeout: ReturnType<typeof setTimeout> | null = null;

  onFormulaBlur(): void {
    this.blurTimeout = setTimeout(() => this.suggestionsOpen.set(false), 150);
  }

  /**
   * Inserta la sugerencia reemplazando el token que el usuario estaba
   * escribiendo, y deja el cursor listo para seguir.
   */
  acceptSuggestion(s: FormulaSuggestionItem | undefined, input?: HTMLInputElement): void {
    if (!s) return;

    // Cancelar el blur pendiente: el foco vuelve al input, no queremos cerrarlo
    if (this.blurTimeout) { clearTimeout(this.blurTimeout); this.blurTimeout = null; }

    const text = this.formulaValue();
    const el = input ?? null;
    const caret = el?.selectionStart ?? text.length;

    const before = text.slice(0, caret);
    const after = text.slice(caret);

    let newBefore: string;
    if (s.kind === 'function') {
      // Reemplazar el token de funcion parcial
      newBefore = before.replace(/[A-Za-zÁÉÍÓÚÑáéíóúñ.]+$/, '') + s.insert;
    } else {
      // Vista o columna: reemplazar lo escrito tras la ultima comilla
      const lastQuote = before.lastIndexOf('"');
      newBefore = before.slice(0, lastQuote + 1) + s.insert + '"';
    }

    const next = newBefore + after;
    this.formulaValue.set(next);
    this.suggestionsOpen.set(false);

    // Reposicionar el cursor tras lo insertado
    const pos = newBefore.length;
    if (el) {
      setTimeout(() => { el.focus(); el.setSelectionRange(pos, pos); }, 0);
    }

    // Pedir sugerencias para la nueva posicion: al aceptar una funcion el
    // usuario suele necesitar de inmediato el primer argumento.
    this.suggestionIndex.set(0);
    this.formulaInput.emit({ text: next, caret: pos });
  }

  closeSuggestions(): void {
    if (this.blurTimeout) { clearTimeout(this.blurTimeout); this.blurTimeout = null; }
    this.suggestionsOpen.set(false);
  }

  // ─── Sheet tabs ───────────────────────────────────────────────────────────

  onSheetTab(tab: SheetTab): void {
    if (this.config.sheets) {
      this.config.sheets.forEach((s) => (s.active = false));
      tab.active = true;
    }
    this.sheetTabChange.emit({ tabId: tab.id });
  }

  // ─── Zoom ─────────────────────────────────────────────────────────────────

  zoomIn(): void {
    const steps = ExcelSheetComponent.ZOOM_STEPS;
    const idx = steps.indexOf(this.zoom());
    if (idx < steps.length - 1) {
      this.zoom.set(steps[idx + 1]);
      this.zoomChange.emit(this.zoom());
    }
  }

  zoomOut(): void {
    const steps = ExcelSheetComponent.ZOOM_STEPS;
    const idx = steps.indexOf(this.zoom());
    if (idx > 0) {
      this.zoom.set(steps[idx - 1]);
      this.zoomChange.emit(this.zoom());
    }
  }

  resetZoom(): void {
    this.zoom.set(100);
    this.zoomChange.emit(100);
  }

  // ─── Helpers for template ─────────────────────────────────────────────────

  getSaveIcon(): string {
    switch (this.config?.title?.saveState) {
      case 'saving':
        return 'pi pi-spin pi-spinner';
      case 'saved':
        return 'pi pi-check-circle';
      default:
        return 'pi pi-cloud';
    }
  }

  getSaveLabel(): string {
    switch (this.config?.title?.saveState) {
      case 'saving':
        return 'Guardando…';
      case 'saved':
        return 'Guardado';
      default:
        return 'Sin guardar';
    }
  }

  trackByTabId(_: number, tab: RibbonTab): string {
    return tab.id;
  }

  trackByGroupTitle(_: number, group: RibbonGroup): string {
    return group.title;
  }

  trackBySheetId(_: number, sheet: SheetTab): string {
    return sheet.id;
  }

  trackByStatusKey(_: number, item: StatusBarItem): string {
    return item.key;
  }

  isButton(item: RibbonItem): boolean {
    return item.type === 'button' || item.type === 'toggle';
  }

  onCloseSheet(event: MouseEvent, tab: SheetTab): void {
    // Evita que el clic en la X active tambien la pestana
    event.stopPropagation();
    this.closeSheet.emit(tab.id);
  }

  onAddSheet(): void {
    this.addSheet.emit();
  }
}
