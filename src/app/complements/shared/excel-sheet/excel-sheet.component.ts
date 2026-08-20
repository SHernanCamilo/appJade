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

  // ─── Formula bar ─────────────────────────────────────────────────────────

  onFormulaKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.formulaCommit.emit({ value: this.formulaValue() });
    }
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
}
