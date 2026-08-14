import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabViewModule } from 'primeng/tabview';

import { TomaInventarioComponent } from './tomaInventario/tomaInventario.component';
import { TrazabilidadActivoComponent } from './trazabilidadActivo/trazabilidadActivo.component';

/**
 * Activos Fijos — un solo módulo con dos pestañas.
 *
 *   Registrar    → buscar el activo en Indigo y guardar la novedad encontrada
 *   Trazabilidad → historial completo de tomas con filtros e indicadores
 *
 * Se unificaron en un componente para que el inventariador no tenga que
 * navegar entre páginas: registra y verifica en el mismo lugar. Al cambiar a
 * la pestaña de trazabilidad se refresca el listado, de modo que la novedad
 * que se acaba de guardar aparezca sin recargar.
 */
@Component({
  selector: 'app-activos-fijos',
  standalone: true,
  imports: [CommonModule, TabViewModule, TomaInventarioComponent, TrazabilidadActivoComponent],
  templateUrl: './activosFijos.component.html',
  styleUrl: './activosFijos.component.css'
})
export class ActivosFijosComponent {
  @ViewChild(TrazabilidadActivoComponent) trazabilidad?: TrazabilidadActivoComponent;

  /** 0 = Registrar, 1 = Trazabilidad */
  tabActiva = 0;

  onTabChange(evento: { index: number }): void {
    this.tabActiva = evento.index;

    // Al entrar a trazabilidad, recargar para incluir las novedades recién guardadas
    if (evento.index === 1) {
      this.trazabilidad?.recargar();
    }
  }

  /** La pestaña de registro pide ver la trazabilidad después de guardar. */
  irATrazabilidad(): void {
    this.tabActiva = 1;
    this.trazabilidad?.recargar();
  }
}
