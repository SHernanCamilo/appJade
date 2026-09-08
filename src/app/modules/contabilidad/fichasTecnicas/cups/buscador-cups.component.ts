import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';

import { FichaPorCups } from '../models/ficha.model';
import { CupsService } from '../services/cups.service';
import { interpretarErrorFicha } from '../shared/ficha-error.util';

/**
 * Trazabilidad de un código CUPS: fichas vigentes que lo contratan.
 *
 * Las búsquedas de CUPS/homólogos/SOAT se retiraron porque ahora esos
 * tarifarios se consultan directamente desde Microsoft Fabric en el paso 2
 * del generador (autocompletado en vivo). Aquí solo queda la trazabilidad,
 * que responde "¿en qué fichas está este CUPS?".
 */
@Component({
  selector: 'app-buscador-cups',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ToastModule,
    TableModule, InputTextModule, ButtonModule, SkeletonModule,
  ],
  providers: [MessageService],
  templateUrl: './buscador-cups.component.html',
  styleUrl: './buscador-cups.component.css',
})
export class BuscadorCupsComponent {
  private readonly cupsService = inject(CupsService);
  private readonly mensajes = inject(MessageService);

  protected trazaCups = '';
  protected readonly trazaResultados = signal<FichaPorCups[]>([]);
  protected readonly trazaCargando = signal<boolean>(false);

  protected buscarTrazabilidad(): void {
    const cups = this.trazaCups.trim();
    if (!cups) return;

    this.trazaCargando.set(true);
    this.cupsService.fichasPorCups(cups).subscribe({
      next: (r) => { this.trazaResultados.set(r); this.trazaCargando.set(false); },
      error: (e: unknown) => { this.trazaCargando.set(false); this.error(e); },
    });
  }

  private error(e: unknown): void {
    this.mensajes.add({ severity: 'error', summary: 'Error', detail: interpretarErrorFicha(e).mensaje, life: 6000 });
  }
}
