import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ToastModule } from 'primeng/toast';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

import {
  ActivosFijosService,
  ResumenTrazabilidad,
  TrazabilidadActivo
} from '../services/activos-fijos.service';

/**
 * Trazabilidad de activos fijos: todas las tomas de inventario registradas,
 * con filtros y el detalle de qué cambió en cada una.
 */
@Component({
  selector: 'app-trazabilidad-activo',
  standalone: true,
  imports: [CommonModule, FormsModule, ToastModule, TableModule, TagModule, TooltipModule],
  providers: [MessageService],
  templateUrl: './trazabilidadActivo.component.html',
  styleUrl: './trazabilidadActivo.component.css'
})
export class TrazabilidadActivoComponent implements OnInit {
  private readonly service = inject(ActivosFijosService);
  private readonly messages = inject(MessageService);

  registros: TrazabilidadActivo[] = [];
  resumen: ResumenTrazabilidad | null = null;

  cargando = false;
  totalRegistros = 0;
  filasPorPagina = 25;
  primeraFila = 0;

  filtros = {
    placa: '',
    estado_fisico: '',
    desde: '',
    hasta: ''
  };

  readonly estadosFisicos = ['En buen estado', 'Para Reparacion', 'Dar de baja'];

  /** Filas expandidas para ver el detalle de cambios. */
  expandidas: Record<number, boolean> = {};

  ngOnInit(): void {
    this.cargarResumen();
    this.cargar();
  }

  /**
   * Refresca listado e indicadores. Lo llama el shell al activar esta pestaña
   * para que las novedades recién registradas aparezcan de inmediato.
   */
  recargar(): void {
    this.cargarResumen();
    this.cargar();
  }

  // =========================================================================
  // CARGA
  // =========================================================================

  cargar(): void {
    this.cargando = true;

    const pagina = Math.floor(this.primeraFila / this.filasPorPagina) + 1;

    this.service.trazabilidad({
      ...this.filtros,
      per_page: this.filasPorPagina,
      page: pagina
    }).subscribe({
      next: respuesta => {
        this.cargando = false;
        this.registros = respuesta.data ?? [];
        this.totalRegistros = respuesta.meta?.total ?? 0;
      },
      error: error => {
        this.cargando = false;
        this.registros = [];
        this.messages.add({
          severity: 'error',
          summary: 'Error',
          detail: error.error?.message ?? 'No se pudo cargar la trazabilidad.',
          life: 6000
        });
      }
    });
  }

  onPageChange(evento: { first: number; rows: number }): void {
    this.primeraFila = evento.first;
    this.filasPorPagina = evento.rows;
    this.cargar();
  }

  aplicarFiltros(): void {
    this.primeraFila = 0;
    this.cargar();
  }

  limpiarFiltros(): void {
    this.filtros = { placa: '', estado_fisico: '', desde: '', hasta: '' };
    this.primeraFila = 0;
    this.cargar();
  }

  private cargarResumen(): void {
    this.service.resumen().subscribe({
      next: respuesta => (this.resumen = respuesta.data),
      error: () => (this.resumen = null)
    });
  }

  // =========================================================================
  // HELPERS DE VISTA
  // =========================================================================

  alternar(id: number): void {
    this.expandidas[id] = !this.expandidas[id];
  }

  get hayFiltrosActivos(): boolean {
    return Object.values(this.filtros).some(v => v !== '');
  }

  severidadEstadoFisico(estado: string | null): 'success' | 'warn' | 'danger' | 'info' {
    switch (estado) {
      case 'En buen estado': return 'success';
      case 'Para Reparacion': return 'warn';
      case 'Dar de baja': return 'danger';
      default: return 'info';
    }
  }

  valor(dato: string | null | undefined): string {
    return dato && dato.trim() !== '' ? dato : '—';
  }
}
