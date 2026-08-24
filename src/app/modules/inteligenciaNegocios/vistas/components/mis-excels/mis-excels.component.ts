import { Component, OnInit, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  WorkbookStateService,
  SavedWorkbook,
} from '../../services/workbook-state.service';

/**
 * Interfaz de "Mis Excels": tarjetas con los workbooks guardados.
 *
 * Permite:
 *  - Ver listado con nombre, vistas, ultima apertura
 *  - Abrir un workbook (navega al visor con la primera vista y restaura estado)
 *  - Marcar como favorito
 *  - Eliminar
 *  - Crear uno nuevo (redirige al visor, tras guardar la primera vista)
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

  get filteredWorkbooks(): SavedWorkbook[] {
    const term = this.filter().toLowerCase().trim();
    const list = this.workbooks();
    if (!term) return list;
    return list.filter(wb =>
      wb.name.toLowerCase().includes(term) ||
      wb.viewNames.some(v => v.toLowerCase().includes(term))
    );
  }

  ngOnInit(): void {
    this.loadList();
  }

  async loadList(): Promise<void> {
    this.loading.set(true);
    const data = await this.service.listWorkbooks();
    this.workbooks.set(data);
    this.loading.set(false);
  }

  /**
   * Abre el workbook: navega al visor con la primera vista y pasa el ID
   * como queryParam para que el componente restaure el estado completo.
   */
  openWorkbook(wb: SavedWorkbook): void {
    if (!wb.views || wb.views.length === 0) return;

    const firstView = wb.views[0];
    this.router.navigate(
      ['/vistaBI-refresh', firstView.schema, firstView.viewName],
      { queryParams: { workbookId: wb.id } }
    );
  }

  async toggleFavorite(wb: SavedWorkbook, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    const newVal = !wb.is_favorite;
    await this.service.updateWorkbook(wb.id, { is_favorite: newVal });
    this.workbooks.update(list => list.map(w =>
      w.id === wb.id ? { ...w, is_favorite: newVal } : w
    ));
  }

  async deleteWorkbook(wb: SavedWorkbook, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    if (!confirm(`Eliminar "${wb.name}"? Esta accion no se puede deshacer.`)) return;

    const ok = await this.service.deleteWorkbook(wb.id);
    if (ok) {
      this.workbooks.update(list => list.filter(w => w.id !== wb.id));
    }
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
