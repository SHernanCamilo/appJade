/**
 * Buscador flotante de la grilla (Ctrl+F), estilo "Buscar" de Excel.
 *
 * Reemplaza el `prompt()` que habia antes: un prompt bloquea la pagina, no deja
 * ver los resultados mientras se escribe y no se puede cerrar con Escape.
 *
 * Busca en TODAS las columnas de cada fila. La coincidencia la resuelve el
 * quickFilterText de AG Grid, que compara el termino contra el texto de todas
 * las celdas de la fila, asi que da igual en que columna este el valor.
 */
import { Component, ElementRef, EventEmitter, Input, Output, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-grid-search-box',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="gsb" role="search">
      <i class="pi pi-search gsb__icon" aria-hidden="true"></i>

      <input
        #input
        type="text"
        class="gsb__input"
        [ngModel]="term"
        (ngModelChange)="onTerm($event)"
        (keydown.escape)="close.emit()"
        (keydown.enter)="$event.preventDefault()"
        placeholder="Buscar en todas las columnas..."
        aria-label="Buscar en todas las columnas de la tabla" />

      <span class="gsb__count" *ngIf="term">
        {{ matches | number }} de {{ total | number }}
      </span>

      <button
        type="button"
        class="gsb__btn"
        *ngIf="term"
        (click)="onTerm('')"
        title="Limpiar busqueda"
        aria-label="Limpiar busqueda">
        <i class="pi pi-times-circle"></i>
      </button>

      <button
        type="button"
        class="gsb__btn"
        (click)="close.emit()"
        title="Cerrar (Esc)"
        aria-label="Cerrar buscador">
        <i class="pi pi-times"></i>
      </button>
    </div>
  `,
  styles: [`
    .gsb {
      position: absolute;
      top: 8px;
      right: 16px;
      z-index: 40;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 8px;
      background: #fff;
      border: 1px solid #217346;
      border-radius: 4px;
      box-shadow: 0 4px 12px rgb(0 0 0 / 18%);
      font-size: 12px;
    }
    .gsb__icon { color: #217346; font-size: 12px; }
    .gsb__input {
      width: 240px;
      border: none;
      outline: none;
      font-size: 12px;
      font-family: inherit;
      color: #1f2937;
      background: transparent;
    }
    .gsb__count {
      color: #6b7280;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .gsb__btn {
      display: flex;
      align-items: center;
      padding: 2px 4px;
      border: none;
      background: transparent;
      color: #6b7280;
      cursor: pointer;
      border-radius: 3px;
    }
    .gsb__btn:hover { background: #f3f4f6; color: #111827; }
    .gsb__btn:focus-visible { outline: 2px solid #217346; outline-offset: 1px; }
  `],
})
export class GridSearchBoxComponent implements AfterViewInit {
  /** Filas que coinciden ahora mismo */
  @Input() matches = 0;
  /** Filas totales del dataset */
  @Input() total = 0;

  /** Termino escrito. El padre lo pasa a quickFilterText. */
  @Output() termChange = new EventEmitter<string>();
  /** El usuario cerro el buscador (X o Escape) */
  @Output() close = new EventEmitter<void>();

  term = '';

  @ViewChild('input') private inputRef?: ElementRef<HTMLInputElement>;

  ngAfterViewInit(): void {
    // Foco automatico: Ctrl+F debe dejar escribir de inmediato
    this.inputRef?.nativeElement.focus();
  }

  onTerm(value: string): void {
    this.term = value;
    this.termChange.emit(value);
  }
}
