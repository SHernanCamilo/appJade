/**
 * Custom AG Grid date cell editor.
 * Uses a native <input type="date"> which opens the browser date picker
 * inline without freezing. Falls back to text input on older browsers.
 *
 * Registered as 'agDateCellEditor' override in the grid options.
 * Usage: cellEditor: DateCellEditorComponent
 */
import {
  Component,
  AfterViewInit,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ICellEditorAngularComp } from 'ag-grid-angular';
import type { ICellEditorParams } from 'ag-grid-community';

@Component({
  selector: 'app-date-cell-editor',
  standalone: true,
  imports: [FormsModule],
  template: `
    <input
      #dateInput
      type="date"
      class="xl-date-editor"
      [(ngModel)]="value"
      (keydown)="onKeydown($event)" />
  `,
  styles: [`
    .xl-date-editor {
      width: 100%;
      height: 100%;
      padding: 0 4px;
      border: none;
      outline: none;
      font-family: 'Calibri', 'Segoe UI', sans-serif;
      font-size: 11.5px;
      background: #fff;
      color: #212121;
      cursor: pointer;
      box-sizing: border-box;
    }

    /* Remove the default calendar icon styling that pushes text */
    .xl-date-editor::-webkit-calendar-picker-indicator {
      cursor: pointer;
      opacity: 0.6;
      font-size: 11px;
    }

    .xl-date-editor:hover::-webkit-calendar-picker-indicator {
      opacity: 1;
    }
  `],
})
export class DateCellEditorComponent implements ICellEditorAngularComp, AfterViewInit {
  @ViewChild('dateInput') inputRef!: ElementRef<HTMLInputElement>;

  value = '';
  private params!: ICellEditorParams;

  agInit(params: ICellEditorParams): void {
    this.params = params;
    const raw = params.value as string | null | undefined;
    // Normalise to YYYY-MM-DD for the date input
    if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      this.value = raw;
    } else if (raw && /^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
      // Handle DD/MM/YYYY → YYYY-MM-DD
      const parts = raw.split('/');
      this.value = `${parts[2]}-${parts[1]}-${parts[0]}`;
    } else {
      this.value = '';
    }
  }

  afterGuiAttached(): void {
    this.inputRef?.nativeElement?.focus();
    this.inputRef?.nativeElement?.showPicker?.();
  }

  ngAfterViewInit(): void {
    // Slight delay so AG Grid finishes setting up the editor DOM
    requestAnimationFrame(() => this.inputRef?.nativeElement?.focus());
  }

  getValue(): string {
    return this.value ?? '';
  }

  isCancelBeforeStart(): boolean { return false; }
  isCancelAfterEnd(): boolean { return false; }

  onKeydown(event: KeyboardEvent): void {
    // Enter/Tab → stop editing
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      this.params.stopEditing();
    }
    // Escape → cancel
    if (event.key === 'Escape') {
      this.params.stopEditing(true);
    }
  }
}
