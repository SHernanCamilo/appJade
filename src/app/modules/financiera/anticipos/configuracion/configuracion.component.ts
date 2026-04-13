import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService, ConfirmationService } from 'primeng/api';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { CheckboxModule } from 'primeng/checkbox';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TabViewModule } from 'primeng/tabview';
import { DialogModule } from 'primeng/dialog';

// Usa el servicio GLOBAL de flujos (módulo sistema)
import { WorkflowService } from '../../../sistema/flujos/services/workflow.service';
import {
  WfDefinicion, WfPaso, WfRegla, WfAprobador,
  CondicionesRegla, CrearDefinicionRequest, CrearPasoRequest,
  CrearReglaRequest, CrearAprobadorRequest
} from '../../../sistema/flujos/models/workflow.models';

@Component({
  selector: 'app-configuracion-anticipos',
  standalone: true,
  imports: [
    CommonModule, RouterModule, FormsModule,
    ButtonModule, ToastModule, TableModule, TagModule, SkeletonModule,
    InputTextModule, TooltipModule, CheckboxModule, DropdownModule,
    InputNumberModule, ConfirmDialogModule, TabViewModule, DialogModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './configuracion.component.html',
  styleUrl: './configuracion.component.css'
})
export class ConfiguracionAnticiposComponent implements OnInit {

  activeTabIndex = 0;
  isLoading = false;
  isSaving = false;

  // Flujos
  flujos: WfDefinicion[] = [];
  totalFlujos = 0;
  flujoSeleccionado: WfDefinicion | null = null;
  mostrarModalFlujo = false;
  flujoForm: Partial<CrearDefinicionRequest> = { codigo: '', nombre: '', descripcion: '', modulo: 'anticipos', estado: true };
  editandoFlujoId: number | null = null;

  // Pasos
  pasos: WfPaso[] = [];
  mostrarModalPaso = false;
  pasoForm: Partial<CrearPasoRequest> = { orden: 1, nombre_paso: '', rol_aprobador: '', es_opcional: false, permite_rechazo: true };
  editandoPasoId: number | null = null;

  // Reglas
  reglas: WfRegla[] = [];
  mostrarModalRegla = false;
  reglaForm: Partial<CrearReglaRequest> = { prioridad: 10, condiciones: {}, descripcion: '', estado: true };
  editandoReglaId: number | null = null;

  // Aprobadores
  aprobadores: WfAprobador[] = [];
  pasoParaAprobadores: WfPaso | null = null;
  mostrarModalAprobador = false;
  aprobadorForm: Partial<CrearAprobadorRequest> = { estrategia: 'fijo', es_suplente: false };

  rolesOptions = [
    { label: 'Jefe Inmediato', value: 'jefe_inmediato' },
    { label: 'Financiero', value: 'financiero' },
    { label: 'Tesorería', value: 'tesoreria' },
    { label: 'Contabilidad', value: 'contabilidad' },
    { label: 'Vicepresidente', value: 'vicepresidente' }
  ];

  estrategiasOptions = [
    { label: 'Usuario Fijo', value: 'fijo' },
    { label: 'Por Unidad Funcional', value: 'unidad_funcional' },
    { label: 'Por Prefijo Sucursal', value: 'prefijo_sucursal' }
  ];

  constructor(
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private workflowService: WorkflowService
  ) {}

  ngOnInit(): void { this.loadFlujos(); }

  // ── FLUJOS ────────────────────────────────────────────────────────────────
  loadFlujos(): void {
    this.isLoading = true;
    this.workflowService.listarDefiniciones({ modulo: 'anticipos', page: 1, per_page: 50 }).subscribe({
      next: (res) => { this.flujos = res.data ?? []; this.totalFlujos = res.total ?? this.flujos.length; this.isLoading = false; },
      error: () => { this.toast('error', 'No se pudieron cargar los flujos'); this.isLoading = false; }
    });
  }

  seleccionarFlujo(flujo: WfDefinicion): void {
    this.flujoSeleccionado = flujo;
    this.loadPasos(flujo.id);
    this.loadReglas(flujo.id);
    this.aprobadores = []; this.pasoParaAprobadores = null;
  }

  abrirModalFlujo(flujo?: WfDefinicion): void {
    if (flujo) {
      this.editandoFlujoId = flujo.id;
      this.flujoForm = { codigo: flujo.codigo, nombre: flujo.nombre, descripcion: flujo.descripcion, modulo: 'anticipos', id_empresa: flujo.id_empresa, estado: flujo.estado };
    } else {
      this.editandoFlujoId = null;
      this.flujoForm = { codigo: '', nombre: '', descripcion: '', modulo: 'anticipos', estado: true };
    }
    this.mostrarModalFlujo = true;
  }

  guardarFlujo(): void {
    if (!this.flujoForm.codigo || !this.flujoForm.nombre) { this.toast('warn', 'Código y nombre son obligatorios'); return; }
    this.isSaving = true;
    const op = this.editandoFlujoId
      ? this.workflowService.actualizarDefinicion(this.editandoFlujoId, this.flujoForm as CrearDefinicionRequest)
      : this.workflowService.crearDefinicion(this.flujoForm as CrearDefinicionRequest);
    op.subscribe({
      next: () => { this.toast('success', this.editandoFlujoId ? 'Flujo actualizado' : 'Flujo creado'); this.mostrarModalFlujo = false; this.loadFlujos(); this.isSaving = false; },
      error: (err) => { this.toast('error', err.error?.message || 'Error al guardar'); this.isSaving = false; }
    });
  }

  eliminarFlujo(flujo: WfDefinicion): void {
    this.confirmationService.confirm({
      message: `¿Eliminar "${flujo.nombre}"?`, header: 'Confirmar', icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí', rejectLabel: 'No',
      accept: () => this.workflowService.eliminarDefinicion(flujo.id).subscribe({
        next: () => { this.toast('success', 'Flujo eliminado'); this.loadFlujos(); if (this.flujoSeleccionado?.id === flujo.id) this.flujoSeleccionado = null; },
        error: () => this.toast('error', 'No se pudo eliminar')
      })
    });
  }

  // ── PASOS ─────────────────────────────────────────────────────────────────
  loadPasos(id: number): void {
    this.workflowService.listarPasos(id).subscribe({
      next: (res) => { this.pasos = res.data ?? []; },
      error: () => this.toast('error', 'No se pudieron cargar los pasos')
    });
  }

  abrirModalPaso(paso?: WfPaso): void {
    if (paso) { this.editandoPasoId = paso.id; this.pasoForm = { ...paso }; }
    else { this.editandoPasoId = null; this.pasoForm = { id_definicion: this.flujoSeleccionado?.id, orden: this.pasos.length + 1, nombre_paso: '', rol_aprobador: '', es_opcional: false, permite_rechazo: true }; }
    this.mostrarModalPaso = true;
  }

  guardarPaso(): void {
    if (!this.pasoForm.nombre_paso || !this.pasoForm.rol_aprobador) { this.toast('warn', 'Nombre y rol son obligatorios'); return; }
    this.isSaving = true;
    const op = this.editandoPasoId
      ? this.workflowService.actualizarPaso(this.editandoPasoId, this.pasoForm as CrearPasoRequest)
      : this.workflowService.crearPaso(this.pasoForm as CrearPasoRequest);
    op.subscribe({
      next: () => { this.toast('success', this.editandoPasoId ? 'Paso actualizado' : 'Paso creado'); this.mostrarModalPaso = false; this.loadPasos(this.flujoSeleccionado!.id); this.isSaving = false; },
      error: (err) => { this.toast('error', err.error?.message || 'Error al guardar'); this.isSaving = false; }
    });
  }

  eliminarPaso(paso: WfPaso): void {
    this.confirmationService.confirm({
      message: `¿Eliminar "${paso.nombre_paso}"?`, header: 'Confirmar', icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí', rejectLabel: 'No',
      accept: () => this.workflowService.eliminarPaso(paso.id).subscribe({
        next: () => { this.toast('success', 'Paso eliminado'); this.loadPasos(this.flujoSeleccionado!.id); },
        error: () => this.toast('error', 'No se pudo eliminar')
      })
    });
  }

  verAprobadores(paso: WfPaso): void {
    this.pasoParaAprobadores = paso;
    this.workflowService.listarAprobadores(paso.id).subscribe({
      next: (res) => { this.aprobadores = res.data ?? []; },
      error: () => this.toast('error', 'No se pudieron cargar los aprobadores')
    });
  }

  // ── REGLAS ────────────────────────────────────────────────────────────────
  loadReglas(id: number): void {
    this.workflowService.listarReglas(id).subscribe({
      next: (res) => { this.reglas = res.data ?? []; },
      error: () => this.toast('error', 'No se pudieron cargar las reglas')
    });
  }

  abrirModalRegla(regla?: WfRegla): void {
    if (regla) { this.editandoReglaId = regla.id; this.reglaForm = { ...regla, condiciones: { ...regla.condiciones } }; }
    else { this.editandoReglaId = null; this.reglaForm = { id_definicion: this.flujoSeleccionado?.id, prioridad: 10, condiciones: {}, descripcion: '', estado: true }; }
    this.mostrarModalRegla = true;
  }

  guardarRegla(): void {
    if (!this.reglaForm.prioridad) { this.toast('warn', 'La prioridad es obligatoria'); return; }
    this.isSaving = true;
    const op = this.editandoReglaId
      ? this.workflowService.actualizarRegla(this.editandoReglaId, this.reglaForm as CrearReglaRequest)
      : this.workflowService.crearRegla(this.reglaForm as CrearReglaRequest);
    op.subscribe({
      next: () => { this.toast('success', this.editandoReglaId ? 'Regla actualizada' : 'Regla creada'); this.mostrarModalRegla = false; this.loadReglas(this.flujoSeleccionado!.id); this.isSaving = false; },
      error: (err) => { this.toast('error', err.error?.message || 'Error al guardar'); this.isSaving = false; }
    });
  }

  eliminarRegla(regla: WfRegla): void {
    this.confirmationService.confirm({
      message: '¿Eliminar esta regla?', header: 'Confirmar', icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí', rejectLabel: 'No',
      accept: () => this.workflowService.eliminarRegla(regla.id).subscribe({
        next: () => { this.toast('success', 'Regla eliminada'); this.loadReglas(this.flujoSeleccionado!.id); },
        error: () => this.toast('error', 'No se pudo eliminar')
      })
    });
  }

  // ── APROBADORES ───────────────────────────────────────────────────────────
  abrirModalAprobador(): void {
    this.aprobadorForm = { id_paso: this.pasoParaAprobadores?.id, estrategia: 'fijo', es_suplente: false };
    this.mostrarModalAprobador = true;
  }

  guardarAprobador(): void {
    if (!this.aprobadorForm.estrategia) { this.toast('warn', 'La estrategia es obligatoria'); return; }
    this.isSaving = true;
    this.workflowService.crearAprobador(this.aprobadorForm as CrearAprobadorRequest).subscribe({
      next: () => { this.toast('success', 'Aprobador agregado'); this.mostrarModalAprobador = false; this.verAprobadores(this.pasoParaAprobadores!); this.isSaving = false; },
      error: (err) => { this.toast('error', err.error?.message || 'Error al guardar'); this.isSaving = false; }
    });
  }

  eliminarAprobador(aprobador: WfAprobador): void {
    this.confirmationService.confirm({
      message: '¿Eliminar este aprobador?', header: 'Confirmar', icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí', rejectLabel: 'No',
      accept: () => this.workflowService.eliminarAprobador(aprobador.id).subscribe({
        next: () => { this.toast('success', 'Aprobador eliminado'); this.verAprobadores(this.pasoParaAprobadores!); },
        error: () => this.toast('error', 'No se pudo eliminar')
      })
    });
  }

  // ── HELPERS ───────────────────────────────────────────────────────────────
  formatCondiciones(cond: CondicionesRegla): string {
    const p: string[] = [];
    if (cond.nivel_min !== undefined || cond.nivel_max !== undefined) p.push(`Nivel ${cond.nivel_min ?? 1}-${cond.nivel_max ?? 4}`);
    if (cond.prefijo_sucursal) p.push(`Sucursal: ${cond.prefijo_sucursal}`);
    if (cond.monto_min) p.push(`Monto > ${cond.monto_min.toLocaleString('es-CO')}`);
    if (cond.monto_max) p.push(`Monto < ${cond.monto_max.toLocaleString('es-CO')}`);
    if (cond.cobertura) p.push(`Cobertura: ${cond.cobertura}`);
    return p.join(' | ') || 'Sin condiciones';
  }

  formatEstrategia(a: WfAprobador): string {
    switch (a.estrategia) {
      case 'fijo': return `Usuario: ${a.user?.name ?? 'N/A'}`;
      case 'unidad_funcional': return `Unidad: ${a.unidad_funcional?.nombre ?? 'N/A'}`;
      case 'prefijo_sucursal': return `Sucursal: ${a.prefijo_sucursal ?? 'N/A'}`;
      default: return 'N/A';
    }
  }

  getSeverity(estado: boolean): 'success' | 'danger' { return estado ? 'success' : 'danger'; }
  getEstadoTexto(estado: boolean): string { return estado ? 'Activo' : 'Inactivo'; }

  private toast(severity: string, detail: string): void {
    this.messageService.add({ severity, summary: severity === 'error' ? 'Error' : severity === 'warn' ? 'Advertencia' : 'Éxito', detail, life: 3000 });
  }
}
