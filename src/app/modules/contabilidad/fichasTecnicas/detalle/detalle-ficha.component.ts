import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { PanelModule } from 'primeng/panel';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TabViewModule } from 'primeng/tabview';
import { TagModule } from 'primeng/tag';
import { TimelineModule } from 'primeng/timeline';
import { ToastModule } from 'primeng/toast';

import { Ficha, HistorialEstado } from '../models/ficha.model';
import { FichasTecnicasService } from '../services/fichas-tecnicas.service';
import { EstadoBadgeComponent } from '../shared/estado-badge.component';
import { interpretarErrorFicha } from '../shared/ficha-error.util';

/**
 * Vista de detalle completa de una ficha técnica.
 *
 * Reemplaza la visualización que en el legacy se hacía abriendo directamente
 * el PDF (`ficha_pdf.php`). Aquí el PDF se puede descargar desde el botón
 * correspondiente, pero la pantalla ofrece navegación interactiva por pestañas,
 * historial en timeline y acciones contextuales.
 */
@Component({
  selector: 'app-detalle-ficha',
  standalone: true,
  imports: [
    CommonModule,
    ToastModule,
    CardModule,
    PanelModule,
    TableModule,
    TabViewModule,
    TimelineModule,
    TagModule,
    ButtonModule,
    DividerModule,
    SkeletonModule,
    EstadoBadgeComponent,
  ],
  providers: [MessageService],
  templateUrl: './detalle-ficha.component.html',
  styleUrl: './detalle-ficha.component.css',
})
export class DetalleFichaComponent {
  private readonly fichaService = inject(FichasTecnicasService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly mensajes = inject(MessageService);

  protected readonly ficha = signal<Ficha | null>(null);
  protected readonly historial = signal<HistorialEstado[]>([]);
  protected readonly cargando = signal<boolean>(true);

  constructor() {
    const id = Number(this.ruta.snapshot.paramMap.get('id'));
    this.cargar(id);
  }

  protected get totalServicios(): number {
    return (this.ficha()?.detalles ?? []).reduce((s, d) => s + Number(d.valor), 0);
  }

  protected abrirPdf(): void {
    const id = this.ficha()?.id;
    if (!id) return;

    this.fichaService.descargarPdf(id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: (e: unknown) => {
        this.mensajes.add({ severity: 'error', summary: 'Error al generar PDF', detail: interpretarErrorFicha(e).mensaje, life: 6000 });
      },
    });
  }

  protected irAValidar(): void {
    void this.router.navigate(['/contabilidad/fichas-tecnicas/ficha', this.ficha()!.id, 'validar']);
  }

  protected crearActualizacion(): void {
    void this.router.navigate(['/contabilidad/fichas-tecnicas/ficha', this.ficha()!.id, 'actualizacion']);
  }

  private cargar(id: number): void {
    this.fichaService.obtener(id).subscribe({
      next: (ficha) => {
        this.ficha.set(ficha);
        this.cargando.set(false);

        this.fichaService.historial(id).subscribe((h) => this.historial.set(h));
      },
      error: (e: unknown) => {
        this.cargando.set(false);
        this.mensajes.add({ severity: 'error', summary: 'No se pudo cargar', detail: interpretarErrorFicha(e).mensaje, life: 6000 });
      },
    });
  }
}
