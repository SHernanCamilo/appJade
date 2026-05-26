import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TextareaModule } from 'primeng/textarea';
import { DatePickerModule } from 'primeng/datepicker';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageService, ConfirmationService } from 'primeng/api';

import { NovedadService } from '../services/novedad.service';
import { Novedad, NovedadTipo, EstadoNovedad, ESTADO_NOVEDAD_CONFIG } from '../models/novedad.model';

@Component({
  selector: 'app-novedades-list',
  standalone: true,
  imports: [
    CommonModule, RouterModule, FormsModule,
    TableModule, ButtonModule, TagModule, ToastModule, DialogModule,
    DropdownModule, InputTextModule, SkeletonModule, TooltipModule,
    ConfirmDialogModule, TextareaModule, DatePickerModule, InputNumberModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './novedades-list.component.html',
  styleUrl: './novedades-list.component.css'
})
export class NovedadesListComponent implements OnInit {

  novedades: Novedad[] = [];
  tipos: NovedadTipo[] = [];
  isLoading = false;
  isSaving = false;
  showDialog = false;
  showAprobarDialog = false;
  showRechazarDialog = false;
  novedadActual: Novedad | null = null;
  comentarioAprobacion = '';
  estadoConfig = ESTADO_NOVEDAD_CONFIG;

  filtroEstado: EstadoNovedad | null = null;
  estadosOptions = [
    { label: 'Todos', value: null },
    { label: 'Pendiente', value: 'pendiente' },
    { label: 'Aprobado', value: 'aprobado' },
    { label: 'Rechazado', value: 'rechazado' }
  ];

  form: Partial<Novedad> & { fecha_inicio_d?: Date | null; fecha_fin_d?: Date | null } = this.emptyForm();
  tipoSeleccionado: NovedadTipo | null = null;

  constructor(
    private novedadService: NovedadService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit(): void {
    this.cargarTipos();
    this.cargar();
  }

  cargarTipos(): void {
    this.novedadService.getTipos().subscribe({ next: (data: NovedadTipo[]) => { this.tipos = data; }, error: () => {} });
  }

  cargar(): void {
    this.isLoading = true;
    this.novedadService.getAll({ estado: this.filtroEstado ?? undefined }).subscribe({
      next: (data: Novedad[]) => { this.novedades = data; this.isLoading = false; },
      error: () => { this.novedades = []; this.isLoading = false; this.toast('error', 'No se pudieron cargar las novedades'); }
    });
  }

  abrirNuevo(): void {
    this.form = this.emptyForm();
    this.tipoSeleccionado = null;
    this.showDialog = true;
  }

  onTipoChange(idTipo: number): void {
    this.tipoSeleccionado = this.tipos.find(t => t.id === idTipo) ?? null;
  }

  guardar(): void {
    if (!this.form.id_novedad_tipo || !this.form.id_empleado || !this.form.fecha_inicio_d || !this.form.fecha_fin_d) {
      this.toast('warn', 'Tipo, empleado y fechas son obligatorios'); return;
    }
    if (this.tipoSeleccionado?.requiere_reemplazo && !this.form.id_empleado_reemplaza) {
      this.toast('warn', 'Este tipo requiere empleado de reemplazo'); return;
    }
    this.isSaving = true;
    const payload: Partial<Novedad> = {
      ...this.form,
      fecha_inicio: this.formatDate(this.form.fecha_inicio_d!),
      fecha_fin: this.formatDate(this.form.fecha_fin_d!)
    };
    this.novedadService.create(payload).subscribe({
      next: () => { this.toast('success', 'Novedad creada'); this.showDialog = false; this.isSaving = false; this.cargar(); },
      error: (e: any) => { this.toast('error', e.error?.message || 'Error'); this.isSaving = false; }
    });
  }

  aprobar(n: Novedad): void {
    this.novedadActual = n;
    this.comentarioAprobacion = '';
    this.showAprobarDialog = true;
  }

  confirmarAprobacion(): void {
    if (!this.novedadActual) return;
    this.isSaving = true;
    this.novedadService.aprobar(this.novedadActual.id, this.comentarioAprobacion || undefined).subscribe({
      next: () => { this.toast('success', 'Novedad aprobada'); this.showAprobarDialog = false; this.isSaving = false; this.cargar(); },
      error: (e: any) => { this.toast('error', e.error?.message || 'Error'); this.isSaving = false; }
    });
  }

  rechazar(n: Novedad): void {
    this.novedadActual = n;
    this.comentarioAprobacion = '';
    this.showRechazarDialog = true;
  }

  confirmarRechazo(): void {
    if (!this.novedadActual || !this.comentarioAprobacion) { this.toast('warn', 'El comentario es obligatorio para rechazar'); return; }
    this.isSaving = true;
    this.novedadService.rechazar(this.novedadActual.id, this.comentarioAprobacion).subscribe({
      next: () => { this.toast('success', 'Novedad rechazada'); this.showRechazarDialog = false; this.isSaving = false; this.cargar(); },
      error: (e: any) => { this.toast('error', e.error?.message || 'Error'); this.isSaving = false; }
    });
  }

  getSeverity(estado: EstadoNovedad): any { return this.estadoConfig[estado]?.severity ?? 'secondary'; }
  getLabel(estado: EstadoNovedad): string { return this.estadoConfig[estado]?.label ?? estado; }

  private emptyForm() { return { id_novedad_tipo: undefined as any, id_empleado: undefined as any, id_empleado_reemplaza: null as number | null, id_cuadro: undefined as any, motivo: '', observacion: '', fecha_inicio_d: null as Date | null, fecha_fin_d: null as Date | null }; }
  private formatDate(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  private toast(s: string, d: string) { this.messageService.add({ severity: s, summary: s === 'error' ? 'Error' : s === 'warn' ? 'Advertencia' : 'Éxito', detail: d, life: 3500 }); }
}
