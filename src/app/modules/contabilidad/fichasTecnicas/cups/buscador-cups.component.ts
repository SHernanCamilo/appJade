import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TabViewModule } from 'primeng/tabview';
import { ToastModule } from 'primeng/toast';

import { Cups, CupsGrupo, FichaPorCups, Homologo, PaginationMeta, TarifaSoat } from '../models/ficha.model';
import { CupsService, ManualRuta } from '../services/cups.service';
import { interpretarErrorFicha } from '../shared/ficha-error.util';

/**
 * Buscador de tarifarios: CUPS vigente, homólogos (ISS/SOAT/Institucional),
 * SOAT 2023 y trazabilidad de un CUPS en fichas vigentes.
 *
 * Reemplaza los archivos cups.php, iss.php, insti.php, soat_2022/2023.php y
 * aprobador/buscar_cups.php + datos_cups.php.
 */
@Component({
  selector: 'app-buscador-cups',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ToastModule, CardModule, TabViewModule,
    TableModule, InputTextModule, SelectModule, ButtonModule, SkeletonModule,
  ],
  providers: [MessageService],
  templateUrl: './buscador-cups.component.html',
  styleUrl: './buscador-cups.component.css',
})
export class BuscadorCupsComponent {
  private readonly cupsService = inject(CupsService);
  private readonly mensajes = inject(MessageService);

  // CUPS
  protected readonly cupsBuscar = signal<string>('');
  protected readonly cupsResultados = signal<Cups[]>([]);
  protected readonly cupsMeta = signal<PaginationMeta | null>(null);
  protected readonly cupsCargando = signal<boolean>(false);
  protected readonly cupsGrupos = signal<CupsGrupo[]>([]);
  protected readonly cupsGrupoSel = signal<string | null>(null);

  // Homólogos
  protected readonly homBuscar = signal<string>('');
  protected readonly homManual = signal<ManualRuta>('iss');
  protected readonly homResultados = signal<Homologo[]>([]);
  protected readonly homMeta = signal<PaginationMeta | null>(null);
  protected readonly homCargando = signal<boolean>(false);
  protected readonly manuales: { value: ManualRuta; label: string }[] = [
    { value: 'iss', label: 'ISS 2001' },
    { value: 'soat', label: 'SOAT' },
    { value: 'institucional', label: 'Institucional' },
  ];

  // SOAT
  protected readonly soatBuscar = signal<string>('');
  protected readonly soatResultados = signal<TarifaSoat[]>([]);
  protected readonly soatMeta = signal<PaginationMeta | null>(null);
  protected readonly soatCargando = signal<boolean>(false);

  // Trazabilidad
  protected readonly trazaCups = signal<string>('');
  protected readonly trazaResultados = signal<FichaPorCups[]>([]);
  protected readonly trazaCargando = signal<boolean>(false);

  constructor() {
    this.cupsService.grupos().subscribe((g) => this.cupsGrupos.set(g));
  }

  // ── CUPS ──────────────────────────────────────────────────────────────

  protected buscarCups(evento?: TableLazyLoadEvent): void {
    this.cupsCargando.set(true);
    const page = evento ? Math.floor((evento.first ?? 0) / (evento.rows ?? 25)) + 1 : 1;

    this.cupsService.buscarCups({
      buscar: this.cupsBuscar().trim() || undefined,
      grupo: this.cupsGrupoSel() ?? undefined,
      page,
      per_page: evento?.rows ?? 25,
    }).subscribe({
      next: (r) => { this.cupsResultados.set(r.data); this.cupsMeta.set(r.meta); this.cupsCargando.set(false); },
      error: (e: unknown) => { this.cupsCargando.set(false); this.error(e); },
    });
  }

  // ── Homólogos ─────────────────────────────────────────────────────────

  protected buscarHomologos(evento?: TableLazyLoadEvent): void {
    this.homCargando.set(true);
    const page = evento ? Math.floor((evento.first ?? 0) / (evento.rows ?? 25)) + 1 : 1;

    this.cupsService.tarifario(
      this.homManual(),
      this.homBuscar().trim() || undefined,
      page,
      evento?.rows ?? 25,
    ).subscribe({
      next: (r) => { this.homResultados.set(r.data); this.homMeta.set(r.meta); this.homCargando.set(false); },
      error: (e: unknown) => { this.homCargando.set(false); this.error(e); },
    });
  }

  // ── SOAT ──────────────────────────────────────────────────────────────

  protected buscarSoat(evento?: TableLazyLoadEvent): void {
    this.soatCargando.set(true);
    const page = evento ? Math.floor((evento.first ?? 0) / (evento.rows ?? 25)) + 1 : 1;

    this.cupsService.buscarSoat(
      this.soatBuscar().trim() || undefined,
      2023,
      page,
      evento?.rows ?? 25,
    ).subscribe({
      next: (r) => { this.soatResultados.set(r.data); this.soatMeta.set(r.meta); this.soatCargando.set(false); },
      error: (e: unknown) => { this.soatCargando.set(false); this.error(e); },
    });
  }

  // ── Trazabilidad ──────────────────────────────────────────────────────

  protected buscarTrazabilidad(): void {
    const cups = this.trazaCups().trim();
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
