import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
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

interface GlpiTicketNivelCard extends GlpiTicketNivelResumen {
  abiertos: number;
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
    InputTextModule,
    TagModule,
    TooltipModule,
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
  entidadSeleccionada: string | null = null;
  alertaSeleccionada: GlpiTicketAlerta | null = null;
  nivelSeleccionado: number | null = null;
  grupoSeleccionado: string | null = null;
  private refresco: ReturnType<typeof setInterval> | null = null;

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
  get niveles(): GlpiTicketNivelCard[] {
    const tickets = this.ticketsContexto({ alerta: true, nivel: false });
    const totalesNivel = this.ticketsContexto({ alerta: false, nivel: false });

    return [1, 2, 3].map((nivel) => {
      const delNivel = tickets.filter((t) => t.nivel === nivel);
      return {
        nivel,
        nombre: `Nivel ${nivel}`,
        total: delNivel.length,
        abiertos: totalesNivel.filter((t) => t.nivel === nivel).length,
        vencidos: delNivel.filter((t) => t.alerta === 'vencido').length,
        por_vencer: delNivel.filter((t) => t.alerta === 'por_vencer').length,
        en_tiempo: delNivel.filter((t) => t.alerta === 'en_tiempo').length,
        sin_ans: delNivel.filter((t) => t.alerta === 'sin_ans').length
      };
    });
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
        label: `${grupo.nombre} (${grupo.total})`,
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

  hintNivel(nivel: GlpiTicketNivelCard): string {
    if (this.alertaSeleccionada) {
      const etiqueta = this.etiquetaAlerta(this.alertaSeleccionada).toLowerCase();
      return `${etiqueta} · de ${nivel.abiertos} abiertos`;
    }
    return `${nivel.vencidos} vencidos · ${nivel.por_vencer} por vencer · ${nivel.en_tiempo} en tiempo`;
  }

  hintEstado(tipo: 'abiertos' | GlpiTicketAlerta): string {
    const enNivel = this.nivelSeleccionado ? `En Nivel ${this.nivelSeleccionado}` : null;
    if (tipo === 'abiertos') {
      return enNivel || `${this.tablero?.grupos_tecnicos.length ?? 0} grupos técnicos`;
    }
    if (enNivel) {
      return enNivel;
    }
    if (tipo === 'vencido') return 'ANS superado';
    if (tipo === 'por_vencer') return `≤ ${this.tablero?.alerta_horas ?? 2} horas`;
    if (tipo === 'en_tiempo') return 'Dentro del ANS';
    return 'Sin fecha ANS';
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

  private ticketsContexto(opciones: { alerta: boolean; nivel: boolean }): GlpiTicketTic[] {
    const tickets = this.tablero?.tickets ?? [];
    const q = this.busqueda.trim().toLowerCase();

    return tickets.filter((ticket) => {
      if (opciones.alerta && this.alertaSeleccionada && ticket.alerta !== this.alertaSeleccionada) {
        return false;
      }
      if (opciones.nivel && this.nivelSeleccionado && ticket.nivel !== this.nivelSeleccionado) {
        return false;
      }
      if (this.entidadSeleccionada && ticket.entidad !== this.entidadSeleccionada) {
        return false;
      }
      if (this.grupoSeleccionado && ticket.grupo_actual !== this.grupoSeleccionado) {
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
