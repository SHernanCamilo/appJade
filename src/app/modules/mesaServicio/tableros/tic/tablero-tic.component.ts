import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { MultiSelectModule } from 'primeng/multiselect';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { GlpiTicketsTicService } from '../../parametrizadorGLPI/services/glpi-tickets-tic.service';
import {
  GlpiTableroTic,
  GlpiTicketAlerta,
  GlpiTicketGrupoResumen,
  GlpiTicketNivelResumen,
  GlpiTicketTic
} from '../../parametrizadorGLPI/interfaces/glpi-tickets-tic.interface';

interface KpiCard {
  id: 'abiertos' | GlpiTicketAlerta;
  label: string;
  value: number;
  icon: string;
  tone: 'blue' | 'green' | 'teal' | 'red' | 'purple';
}

interface EntidadPanel {
  nombre: string;
  corta: string;
  total: number;
  vencidos: number;
}

interface RendimientoPanel {
  tasa: string;
  masUrgente: GlpiTicketTic | null;
  masHolgado: GlpiTicketTic | null;
  total: number;
}

@Component({
  selector: 'app-tablero-tic',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TableModule,
    ButtonModule,
    DropdownModule,
    MultiSelectModule,
    TagModule,
    SkeletonModule,
    ToastModule
  ],
  providers: [MessageService],
  templateUrl: './tablero-tic.component.html',
  styleUrl: './tablero-tic.component.css'
})
export class TableroTicComponent implements OnInit, OnDestroy {
  tablero: GlpiTableroTic | null = null;
  isLoading = false;
  busqueda = '';
  entidadesSeleccionadas: string[] | null = null;
  alertaSeleccionada: GlpiTicketAlerta | null = null;
  nivelSeleccionado: number | null = null;
  grupoSeleccionado: string | null = null;
  private refresco: ReturnType<typeof setInterval> | null = null;

  readonly nivelProveedor = 4;

  readonly opcionesAlerta: { label: string; value: GlpiTicketAlerta }[] = [
    { label: 'Vencidos', value: 'vencido' },
    { label: 'Por vencer (2h)', value: 'por_vencer' },
    { label: 'En tiempo', value: 'en_tiempo' },
    { label: 'Sin ANS', value: 'sin_ans' }
  ];

  constructor(
    private ticketsService: GlpiTicketsTicService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.cargar();
    this.refresco = setInterval(() => this.cargar(false), 60000);
  }

  ngOnDestroy(): void {
    if (this.refresco) {
      clearInterval(this.refresco);
    }
  }

  get ticketsFiltrados(): GlpiTicketTic[] {
    return this.ticketsContexto({ alerta: true, nivel: true });
  }

  /** Conteos de estado, recortados al nivel elegido (si hay). */
  get resumenEstado() {
    const tickets = this.ticketsContexto({ alerta: false, nivel: true });
    return {
      abiertos: tickets.length,
      vencidos: tickets.filter((t) => t.alerta === 'vencido').length,
      por_vencer: tickets.filter((t) => t.alerta === 'por_vencer').length,
      en_tiempo: tickets.filter((t) => t.alerta === 'en_tiempo').length,
      sin_ans: tickets.filter((t) => t.alerta === 'sin_ans').length
    };
  }

  /** Conteos por nivel, recortados a la alerta elegida (si hay). */
  get niveles(): GlpiTicketNivelResumen[] {
    const tickets = this.ticketsContexto({ alerta: true, nivel: false });

    return [1, 2, 3, this.nivelProveedor].map((nivel) => {
      const delNivel = tickets.filter((t) => t.nivel === nivel);
      return {
        nivel,
        nombre: nivel === this.nivelProveedor ? 'Proveedores' : `Nivel ${nivel}`,
        total: delNivel.length,
        vencidos: delNivel.filter((t) => t.alerta === 'vencido').length,
        por_vencer: delNivel.filter((t) => t.alerta === 'por_vencer').length,
        en_tiempo: delNivel.filter((t) => t.alerta === 'en_tiempo').length,
        sin_ans: delNivel.filter((t) => t.alerta === 'sin_ans').length
      };
    });
  }

  get totalTickets(): number {
    return this.tablero?.tickets.length ?? 0;
  }

  get kpis(): KpiCard[] {
    const resumen = this.resumenEstado;
    return [
      { id: 'abiertos', label: 'Abiertos', value: resumen.abiertos, icon: 'pi-ticket', tone: 'blue' },
      { id: 'en_tiempo', label: 'En tiempo', value: resumen.en_tiempo, icon: 'pi-check', tone: 'green' },
      { id: 'por_vencer', label: 'Por vencer', value: resumen.por_vencer, icon: 'pi-chart-line', tone: 'teal' },
      { id: 'vencido', label: 'Vencidos', value: resumen.vencidos, icon: 'pi-times-circle', tone: 'red' },
      { id: 'sin_ans', label: 'Sin ANS', value: resumen.sin_ans, icon: 'pi-clock', tone: 'purple' }
    ];
  }

  get panelEntidades(): EntidadPanel[] {
    const tickets = this.ticketsContexto({ alerta: true, nivel: true, entidad: false });
    const mapa = new Map<string, EntidadPanel>();

    for (const ticket of tickets) {
      const nombre = ticket.entidad || 'Sin entidad';
      const actual = mapa.get(nombre) ?? {
        nombre,
        corta: ticket.entidad_corta || 'Sin entidad',
        total: 0,
        vencidos: 0
      };
      actual.total += 1;
      if (ticket.alerta === 'vencido') {
        actual.vencidos += 1;
      }
      mapa.set(nombre, actual);
    }

    return [...mapa.values()].sort((a, b) => b.total - a.total).slice(0, 8);
  }

  get maxEntidad(): number {
    return this.panelEntidades.reduce((max, entidad) => Math.max(max, entidad.total), 0);
  }

  get rendimiento(): RendimientoPanel {
    const tickets = this.ticketsFiltrados;
    const conTiempo = tickets.filter((ticket) => ticket.minutos_restantes != null);
    const ordenados = [...conTiempo].sort(
      (a, b) => (a.minutos_restantes ?? 0) - (b.minutos_restantes ?? 0)
    );
    const enTiempo = tickets.filter((ticket) => ticket.alerta === 'en_tiempo').length;

    return {
      tasa: tickets.length ? `${Math.round((enTiempo / tickets.length) * 100)}%` : '—',
      masUrgente: ordenados[0] ?? null,
      masHolgado: ordenados.length ? ordenados[ordenados.length - 1] : null,
      total: tickets.length
    };
  }

  get opcionesEntidad(): { label: string; value: string }[] {
    return (this.tablero?.entidades ?? []).map((entidad) => ({
      label: `${entidad.corta} (${entidad.total})`,
      value: entidad.nombre
    }));
  }

  get opcionesGrupo(): { label: string; value: string }[] {
    return (this.tablero?.grupos_tecnicos ?? [])
      .filter((grupo) => !this.nivelSeleccionado || grupo.nivel === this.nivelSeleccionado)
      .map((grupo) => ({
        label: grupo.nivel === this.nivelProveedor
          ? `Proveedor · ${grupo.nombre} (${grupo.total})`
          : `${grupo.nombre} (${grupo.total})`,
        value: grupo.nombre
      }));
  }

  cargar(fresh = false): void {
    this.isLoading = true;
    this.ticketsService.tablero(fresh).subscribe({
      next: (data) => {
        this.tablero = data;
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'GLPI',
          detail: err?.error?.message || 'No se pudieron cargar los tickets de TIC.'
        });
      }
    });
  }

  filtrarAlerta(alerta: GlpiTicketAlerta | null): void {
    this.alertaSeleccionada = this.alertaSeleccionada === alerta ? null : alerta;
  }

  filtrarNivel(nivel: number | null): void {
    this.nivelSeleccionado = this.nivelSeleccionado === nivel ? null : nivel;
    this.grupoSeleccionado = null;
  }

  filtrarEntidad(nombre: string): void {
    const actuales = this.entidadesSeleccionadas ?? [];
    const siguientes = actuales.includes(nombre)
      ? actuales.filter((item) => item !== nombre)
      : [...actuales, nombre];
    this.entidadesSeleccionadas = siguientes.length ? siguientes : null;
  }

  entidadActiva(nombre: string): boolean {
    return (this.entidadesSeleccionadas ?? []).includes(nombre);
  }

  kpiActivo(id: KpiCard['id']): boolean {
    if (id === 'abiertos') {
      return !this.alertaSeleccionada;
    }
    return this.alertaSeleccionada === id;
  }

  seleccionarKpi(id: KpiCard['id']): void {
    this.filtrarAlerta(id === 'abiertos' ? null : id);
  }

  limpiarFiltros(): void {
    this.busqueda = '';
    this.entidadesSeleccionadas = null;
    this.alertaSeleccionada = null;
    this.nivelSeleccionado = null;
    this.grupoSeleccionado = null;
  }

  exportarCsv(): void {
    const tickets = this.ticketsFiltrados;
    if (!tickets.length) {
      return;
    }

    const encabezado = ['Ticket', 'Titulo', 'Entidad', 'Grupo', 'Nivel', 'Prioridad', 'ANS', 'Vence', 'Alerta', 'Tecnico', 'Categoria'];
    const lineas = [
      encabezado.join(','),
      ...tickets.map((ticket) =>
        [
          ticket.id,
          ticket.titulo,
          ticket.entidad_corta,
          ticket.grupo_actual,
          this.etiquetaNivel(ticket.nivel),
          ticket.prioridad,
          ticket.ans,
          ticket.vence_ans ?? '',
          this.etiquetaAlerta(ticket.alerta),
          ticket.tecnico,
          ticket.categoria
        ]
          .map((valor) => this.celdaCsv(valor))
          .join(',')
      )
    ];

    const blob = new Blob(['\uFEFF' + lineas.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = 'tablero-tic.csv';
    enlace.click();
    URL.revokeObjectURL(url);
  }

  private celdaCsv(valor: unknown): string {
    let texto = String(valor ?? '');
    if (/^[\t\r\n]*[=+\-@]/.test(texto)) {
      texto = `'${texto}`;
    }
    return `"${texto.replace(/"/g, '""')}"`;
  }

  etiquetaNivel(nivel: number): string {
    return nivel === this.nivelProveedor ? 'Proveedores' : `N${nivel}`;
  }

  fechaApertura(valor: string | null | undefined): { fecha: string; hora: string } | null {
    const texto = (valor ?? '').trim();
    const match = texto.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}(?::\d{2})?))?/);
    if (!match) {
      return null;
    }
    return { fecha: match[1], hora: match[2] ?? '' };
  }

  abrirTicket(ticket: GlpiTicketTic): void {
    if (ticket.url) {
      window.open(ticket.url, '_blank', 'noopener');
    }
  }

  resumenGrupo(nombre: string): GlpiTicketGrupoResumen | null {
    const tickets = this.ticketsFiltrados.filter((ticket) => ticket.grupo_actual === nombre);
    if (tickets.length === 0) {
      return null;
    }

    return {
      nombre,
      nivel: tickets[0].nivel,
      total: tickets.length,
      vencidos: tickets.filter((t) => t.alerta === 'vencido').length,
      por_vencer: tickets.filter((t) => t.alerta === 'por_vencer').length,
      en_tiempo: tickets.filter((t) => t.alerta === 'en_tiempo').length,
      sin_ans: tickets.filter((t) => t.alerta === 'sin_ans').length
    };
  }

  severidadAlerta(alerta: GlpiTicketAlerta): 'danger' | 'warn' | 'success' | 'secondary' {
    if (alerta === 'vencido') return 'danger';
    if (alerta === 'por_vencer') return 'warn';
    if (alerta === 'en_tiempo') return 'success';
    return 'secondary';
  }

  etiquetaAlerta(alerta: GlpiTicketAlerta): string {
    if (alerta === 'vencido') return 'Vencido';
    if (alerta === 'por_vencer') return 'Por vencer';
    if (alerta === 'en_tiempo') return 'En tiempo';
    return 'Sin ANS';
  }

  private ticketsContexto(opciones: {
    alerta: boolean;
    nivel: boolean;
    entidad?: boolean;
    grupo?: boolean;
  }): GlpiTicketTic[] {
    const tickets = this.tablero?.tickets ?? [];
    const q = this.busqueda.trim().toLowerCase();
    const aplicarEntidad = opciones.entidad !== false;
    const aplicarGrupo = opciones.grupo !== false;

    return tickets.filter((ticket) => {
      if (opciones.alerta && this.alertaSeleccionada && ticket.alerta !== this.alertaSeleccionada) {
        return false;
      }
      if (opciones.nivel && this.nivelSeleccionado && ticket.nivel !== this.nivelSeleccionado) {
        return false;
      }
      const entidades = this.entidadesSeleccionadas ?? [];
      if (aplicarEntidad && entidades.length > 0 && !entidades.includes(ticket.entidad)) {
        return false;
      }
      if (aplicarGrupo && this.grupoSeleccionado && ticket.grupo_actual !== this.grupoSeleccionado) {
        return false;
      }
      if (!q) {
        return true;
      }

      return [
        ticket.id,
        ticket.titulo,
        ticket.tecnico,
        ticket.solicitante,
        ticket.categoria,
        ticket.entidad_corta,
        ticket.grupo_actual
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }
}
