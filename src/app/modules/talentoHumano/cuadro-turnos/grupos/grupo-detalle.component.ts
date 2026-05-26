import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { CheckboxModule } from 'primeng/checkbox';
import { DatePickerModule } from 'primeng/datepicker';
import { MessageService, ConfirmationService } from 'primeng/api';

import { GrupoService } from '../services/grupo.service';
import { Grupo, GrupoEmpleado, GrupoEncargado } from '../models/grupo.model';

@Component({
  selector: 'app-grupo-detalle',
  standalone: true,
  imports: [
    CommonModule, RouterModule, FormsModule,
    TableModule, ButtonModule, TagModule, ToastModule, DialogModule,
    InputTextModule, SkeletonModule, TooltipModule, ConfirmDialogModule,
    CheckboxModule, DatePickerModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './grupo-detalle.component.html',
  styleUrl: './grupo-detalle.component.css'
})
export class GrupoDetalleComponent implements OnInit {

  grupoId!: number;
  grupo: Grupo | null = null;
  empleados: GrupoEmpleado[] = [];
  historialEncargados: GrupoEncargado[] = [];
  isLoading = false;
  isSaving = false;
  mostrarHistorico = false;
  showHistorialDialog = false;

  // Dialog encargado
  showEncargadoDialog = false;
  formEncargado = { id_user: null as number | null, fecha_inicio: null as Date | null, motivo: '' };

  // Dialog empleado
  showEmpleadoDialog = false;
  formEmpleado = { id_empleado: null as number | null, fecha_ingreso: null as Date | null };

  // Dialog retirar
  showRetirarDialog = false;
  empleadoRetirar: GrupoEmpleado | null = null;
  fechaSalida: Date | null = null;

  constructor(
    private route: ActivatedRoute,
    private grupoService: GrupoService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit(): void {
    this.grupoId = Number(this.route.snapshot.paramMap.get('id'));
    this.cargarGrupo();
    this.cargarEmpleados();
  }

  cargarGrupo(): void {
    this.isLoading = true;
    this.grupoService.getById(this.grupoId).subscribe({
      next: (data: Grupo) => { this.grupo = data; this.isLoading = false; },
      error: () => { this.isLoading = false; this.toast('error', 'No se pudo cargar el grupo'); }
    });
  }

  cargarEmpleados(): void {
    this.grupoService.getEmpleados(this.grupoId, this.mostrarHistorico).subscribe({
      next: (data: GrupoEmpleado[]) => { this.empleados = data; },
      error: () => this.toast('error', 'No se pudieron cargar los empleados')
    });
  }

  verHistorialEncargados(): void {
    this.grupoService.getHistorialEncargados(this.grupoId).subscribe({
      next: (data: GrupoEncargado[]) => { this.historialEncargados = data; this.showHistorialDialog = true; },
      error: () => this.toast('error', 'No se pudo cargar el historial')
    });
  }

  guardarEncargado(): void {
    if (!this.formEncargado.id_user || !this.formEncargado.fecha_inicio) {
      this.toast('warn', 'Usuario y fecha de inicio son obligatorios'); return;
    }
    this.isSaving = true;
    this.grupoService.asignarEncargado(this.grupoId, {
      id_user: this.formEncargado.id_user,
      fecha_inicio: this.formatDate(this.formEncargado.fecha_inicio),
      motivo: this.formEncargado.motivo || undefined
    }).subscribe({
      next: () => { this.toast('success', 'Encargado asignado'); this.showEncargadoDialog = false; this.isSaving = false; this.cargarGrupo(); },
      error: (e: any) => { this.toast('error', e.error?.message || 'Error'); this.isSaving = false; }
    });
  }

  guardarEmpleado(): void {
    if (!this.formEmpleado.id_empleado || !this.formEmpleado.fecha_ingreso) {
      this.toast('warn', 'Empleado y fecha de ingreso son obligatorios'); return;
    }
    this.isSaving = true;
    this.grupoService.agregarEmpleado(this.grupoId, {
      id_empleado: this.formEmpleado.id_empleado,
      fecha_ingreso: this.formatDate(this.formEmpleado.fecha_ingreso)
    }).subscribe({
      next: () => { this.toast('success', 'Empleado agregado'); this.showEmpleadoDialog = false; this.isSaving = false; this.cargarEmpleados(); },
      error: (e: any) => { this.toast('error', e.error?.message || 'Error'); this.isSaving = false; }
    });
  }

  abrirRetirar(emp: GrupoEmpleado): void {
    this.empleadoRetirar = emp;
    this.fechaSalida = new Date();
    this.showRetirarDialog = true;
  }

  confirmarRetiro(): void {
    if (!this.empleadoRetirar || !this.fechaSalida) return;
    this.isSaving = true;
    this.grupoService.retirarEmpleado(this.grupoId, this.empleadoRetirar.id_empleado, this.formatDate(this.fechaSalida)).subscribe({
      next: () => { this.toast('success', 'Empleado retirado'); this.showRetirarDialog = false; this.isSaving = false; this.cargarEmpleados(); },
      error: (e: any) => { this.toast('error', e.error?.message || 'Error'); this.isSaving = false; }
    });
  }

  private formatDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  private toast(s: string, d: string) { this.messageService.add({ severity: s, summary: s === 'error' ? 'Error' : s === 'warn' ? 'Advertencia' : 'Éxito', detail: d, life: 3500 }); }
}
