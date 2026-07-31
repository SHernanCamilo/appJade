import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { CheckboxModule } from 'primeng/checkbox';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';

import { ParametrizacionService, TipoRecargo, ParametroJornada } from '../services/parametrizacion.service';

@Component({
  selector: 'app-parametrizacion',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    ButtonModule, DialogModule, InputTextModule, CheckboxModule,
    ToastModule, TooltipModule, TagModule
  ],
  providers: [MessageService],
  templateUrl: './parametrizacion.component.html',
  styleUrls: ['./parametrizacion.component.css']
})
export class ParametrizacionComponent implements OnInit {

  // ─── Tipos de Recargo ───
  tiposRecargo: TipoRecargo[] = [];
  showRecargoDialog = false;
  editandoRecargo: TipoRecargo | null = null;
  recargoForm = this.emptyRecargoForm();

  // ─── Parámetros de Jornada ───
  parametrosJornada: ParametroJornada[] = [];
  parametroVigente: ParametroJornada | null = null;
  showJornadaDialog = false;
  editandoJornada: ParametroJornada | null = null;
  jornadaForm = this.emptyJornadaForm();

  isLoading = false;
  isSaving = false;

  constructor(
    private service: ParametrizacionService,
    private message: MessageService
  ) {}

  ngOnInit(): void {
    this.cargarTiposRecargo();
    this.cargarParametrosJornada();
  }

  // ═══════════════════════════════════════════════════════
  // TIPOS DE RECARGO
  // ═══════════════════════════════════════════════════════

  cargarTiposRecargo(): void {
    this.service.getTiposRecargo().subscribe({
      next: (data) => this.tiposRecargo = data,
      error: () => this.toast('error', 'Error al cargar tipos de recargo')
    });
  }

  abrirRecargoDialog(tipo?: TipoRecargo): void {
    if (tipo) {
      this.editandoRecargo = tipo;
      this.recargoForm = { ...tipo };
    } else {
      this.editandoRecargo = null;
      this.recargoForm = this.emptyRecargoForm();
    }
    this.showRecargoDialog = true;
  }

  guardarRecargo(): void {
    if (!this.recargoForm.codigo || !this.recargoForm.nombre) return;
    this.isSaving = true;

    const obs = this.editandoRecargo
      ? this.service.actualizarTipoRecargo(this.editandoRecargo.id!, this.recargoForm)
      : this.service.crearTipoRecargo(this.recargoForm);

    obs.subscribe({
      next: () => {
        this.isSaving = false;
        this.showRecargoDialog = false;
        this.toast('success', this.editandoRecargo ? 'Recargo actualizado' : 'Recargo creado');
        this.cargarTiposRecargo();
      },
      error: (err) => {
        this.isSaving = false;
        this.toast('error', err?.error?.message || 'Error al guardar');
      }
    });
  }

  desactivarRecargo(tipo: TipoRecargo): void {
    if (!confirm(`¿Desactivar "${tipo.nombre}"?`)) return;
    this.service.eliminarTipoRecargo(tipo.id!).subscribe({
      next: () => { this.toast('success', 'Recargo desactivado'); this.cargarTiposRecargo(); },
      error: () => this.toast('error', 'Error al desactivar')
    });
  }

  emptyRecargoForm(): any {
    return {
      codigo: '', nombre: '', porcentaje: 0,
      es_hora_extra: false, aplica_dominical_festivo: false,
      hora_inicio: '', hora_fin: '', activo: true
    };
  }

  // ═══════════════════════════════════════════════════════
  // PARÁMETROS DE JORNADA
  // ═══════════════════════════════════════════════════════

  cargarParametrosJornada(): void {
    this.service.getParametrosJornada().subscribe({
      next: (data) => {
        this.parametrosJornada = data;
        this.parametroVigente = data.find(p => p.activo && !p.vigente_hasta) || data[0] || null;
      },
      error: () => this.toast('error', 'Error al cargar parámetros de jornada')
    });
  }

  abrirJornadaDialog(param?: ParametroJornada): void {
    if (param) {
      this.editandoJornada = param;
      this.jornadaForm = { ...param };
    } else {
      this.editandoJornada = null;
      this.jornadaForm = this.emptyJornadaForm();
    }
    this.showJornadaDialog = true;
  }

  guardarJornada(): void {
    if (!this.jornadaForm.vigente_desde) return;
    this.isSaving = true;

    const obs = this.editandoJornada
      ? this.service.actualizarParametroJornada(this.editandoJornada.id!, this.jornadaForm)
      : this.service.crearParametroJornada(this.jornadaForm);

    obs.subscribe({
      next: () => {
        this.isSaving = false;
        this.showJornadaDialog = false;
        this.toast('success', this.editandoJornada ? 'Parámetro actualizado' : 'Parámetro creado');
        this.cargarParametrosJornada();
      },
      error: (err) => {
        this.isSaving = false;
        this.toast('error', err?.error?.message || 'Error al guardar');
      }
    });
  }

  emptyJornadaForm(): any {
    return {
      horas_max_dia: 8, horas_max_semana: 42, horas_max_mes: null,
      jornada_diurna_inicio: '06:00', jornada_diurna_fin: '21:00',
      jornada_nocturna_inicio: '21:00', jornada_nocturna_fin: '06:00',
      vigente_desde: '', vigente_hasta: '', observacion: ''
    };
  }

  private toast(severity: string, detail: string): void {
    this.message.add({ severity, summary: severity === 'success' ? 'OK' : 'Error', detail });
  }
}
