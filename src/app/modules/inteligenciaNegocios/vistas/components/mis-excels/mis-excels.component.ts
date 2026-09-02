import { Component, OnInit, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  WorkbookStateService,
  SavedWorkbook,
} from '../../services/workbook-state.service';

/**
 * Interfaz de "Excel Sheets": tarjetas con los workbooks guardados.
 *
 * Permite:
 *  - Ver listado con nombre, vistas y ultima apertura
 *  - Abrir un workbook (restaura hojas, filtros y tablas dinamicas)
 *  - Renombrar, marcar como favorito y eliminar
 *  - Seleccionar varios y borrarlos de una vez
 *  - Eliminar duplicados (workbooks con el mismo conjunto de vistas)
 */
@Component({
  selector: 'app-mis-excels',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './mis-excels.component.html',
  styleUrl: './mis-excels.component.css',
})
export class MisExcelsComponent implements OnInit {
  private readonly service = inject(WorkbookStateService);
  private readonly router  = inject(Router);

  readonly workbooks = signal<SavedWorkbook[]>([]);
  readonly loading   = signal(true);
  readonly filter    = signal('');
  readonly busy      = signal('');

  /** Ids marcados con la casilla de la tarjeta */
  readonly selected = signal<Set<number>>(new Set());

  /** Solo favoritos */
  readonly onlyFavorites = signal(false);

  /**
   * Firma de vistas -> cuantos workbooks la comparten.
   *
   * Antes de deduplicar en el backend, cada apertura de una vista creaba un
   * workbook nuevo: "Excel Sheets" acabo con decenas de tarjetas identicas. Esto
   * detecta esos grupos para poder avisar y limpiarlos.
   */
  private readonly signatures = computed(() => {
    const map = new Map<string, number>();
    for (const wb of this.workbooks()) {
      const sig = this.signatureOf(wb);
      map.set(sig, (map.get(sig) ?? 0) + 1);
    }
    return map;
  });

  /** Cuantas tarjetas sobran por estar repetidas */
  readonly duplicateCount = computed(() => {
    let extra = 0;
    this.signatures().forEach(count => { if (count > 1) extra += count - 1; });
    return extra;
  });

  readonly filteredWorkbooks = computed<SavedWorkbook[]>(() => {
    const term = this.filter().toLowerCase().trim();
    let list = this.workbooks();

    if (this.onlyFavorites()) list = list.filter(wb => wb.is_favorite);

    if (term) {
      list = list.filter(wb =>
        wb.name.toLowerCase().includes(term) ||
        wb.viewNames.some(v => v.toLowerCase().includes(term))
      );
    }

    return list;
  });

  ngOnInit(): void {
    this.loadList();
  }

  async loadList(): Promise<void> {
    this.loading.set(true);
    const data = await this.service.listWorkbooks();
    this.workbooks.set(data);
    this.selected.set(new Set());
    this.loading.set(false);
  }

  /** Firma canonica del conjunto de vistas (igual criterio que el backend) */
  private signatureOf(wb: SavedWorkbook): string {
    return (wb.views ?? [])
      .map(v => `${(v.schema ?? '').toLowerCase()}|${(v.viewName ?? '').toLowerCase()}`)
      .filter(k => k !== '|')
      .sort()
      .join(',');
  }

  /** true si este workbook comparte vistas con otro (tarjeta repetida) */
  isDuplicate(wb: SavedWorkbook): boolean {
    return (this.signatures().get(this.signatureOf(wb)) ?? 0) > 1;
  }

  /**
   * Abre el workbook en el visor y le pasa su id para que restaure el estado
   * completo (hojas, filtros, columnas ocultas y tablas dinamicas).
   */
  openWorkbook(wb: SavedWorkbook): void {
    if (!wb.views || wb.views.length === 0) return;

    const firstView = wb.views[0];
    this.router.navigate(
      ['/vistaBI-refresh', firstView.schema, firstView.viewName],
      { queryParams: { workbookId: wb.id } }
    );
  }

  // ── Seleccion multiple ────────────────────────────────────────────────────

  isSelected(id: number): boolean {
    return this.selected().has(id);
  }

  toggleSelected(wb: SavedWorkbook, event: MouseEvent): void {
    event.stopPropagation();
    this.selected.update(set => {
      const next = new Set(set);
      next.has(wb.id) ? next.delete(wb.id) : next.add(wb.id);
      return next;
    });
  }

  selectAllVisible(): void {
    const visibles = this.filteredWorkbooks().map(w => w.id);
    const todos = visibles.every(id => this.selected().has(id));
    this.selected.set(todos ? new Set() : new Set(visibles));
  }

  async deleteSelected(): Promise<void> {
    const ids = [...this.selected()];
    if (ids.length === 0) return;
    if (!confirm(`Eliminar ${ids.length} workbook(s)? Esta accion no se puede deshacer.`)) return;

    this.busy.set(`Eliminando ${ids.length}...`);
    for (const id of ids) {
      await this.service.deleteWorkbook(id);
    }
    this.workbooks.update(list => list.filter(w => !ids.includes(w.id)));
    this.selected.set(new Set());
    this.busy.set('');
  }

  // ── Acciones por tarjeta ──────────────────────────────────────────────────

  async toggleFavorite(wb: SavedWorkbook, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    const newVal = !wb.is_favorite;
    await this.service.updateWorkbook(wb.id, { is_favorite: newVal });
    this.workbooks.update(list => list.map(w =>
      w.id === wb.id ? { ...w, is_favorite: newVal } : w
    ));
  }

  /** Renombrar: el nombre automatico ("VW_...") no dice mucho al usuario */
  async renameWorkbook(wb: SavedWorkbook, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    const nuevo = prompt('Nombre del workbook:', wb.name);
    if (nuevo === null) return;

    const name = nuevo.trim();
    if (!name || name === wb.name) return;

    const ok = await this.service.updateWorkbook(wb.id, { name });
    if (ok) {
      this.workbooks.update(list => list.map(w => w.id === wb.id ? { ...w, name } : w));
    }
  }

  async deleteWorkbook(wb: SavedWorkbook, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    if (!confirm(`Eliminar "${wb.name}"? Esta accion no se puede deshacer.`)) return;

    const ok = await this.service.deleteWorkbook(wb.id);
    if (ok) {
      this.workbooks.update(list => list.filter(w => w.id !== wb.id));
    }
  }

  /** Deja un solo workbook por conjunto de vistas (el mas reciente) */
  async cleanupDuplicates(): Promise<void> {
    const sobran = this.duplicateCount();
    if (sobran === 0) return;
    if (!confirm(
      `Se eliminaran ${sobran} workbook(s) repetidos.\n\n` +
      'De cada grupo con las mismas vistas se conserva el mas reciente. ' +
      'Esta accion no se puede deshacer.'
    )) return;

    this.busy.set('Limpiando duplicados...');
    const borrados = await this.service.cleanupDuplicates();
    await this.loadList();
    this.busy.set('');
    alert(borrados > 0 ? `Se eliminaron ${borrados} duplicados.` : 'No se elimino ninguno.');
  }

  /**
   * Formatea la fecha como "hace X horas" o "hace X dias"
   */
  timeAgo(iso: string | null): string {
    if (!iso) return 'Nunca';
    const diff = Date.now() - new Date(iso).getTime();
    const mins  = Math.floor(diff / 60000);
    if (mins < 1) return 'Justo ahora';
    if (mins < 60) return `Hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Hace ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `Hace ${days}d`;
    return new Date(iso).toLocaleDateString('es-CO');
  }

  trackById(_: number, wb: SavedWorkbook): number {
    return wb.id;
  }
}
