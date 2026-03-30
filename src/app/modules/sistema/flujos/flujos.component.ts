import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { DialogModule } from 'primeng/dialog';
import { AccordionModule } from 'primeng/accordion';
import { TooltipModule } from 'primeng/tooltip';
import { TabViewModule } from 'primeng/tabview';
import { CheckboxModule } from 'primeng/checkbox';
import { InputNumberModule } from 'primeng/inputnumber';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';

import { WorkflowService } from './services/workflow.service';
import {
  WfDefinicion, WfPaso, WfRegla, WfAprobador,
  CondicionesRegla, CrearDefinicionRequest, CrearPasoRequest,
  CrearReglaRequest, CrearAprobadorRequest
} from './models/workflow.models';

@Component({
  selector: 'app-flujos',
  standalone: true,
  imports: [
    CommonModule, RouterModule, FormsModule,
    ButtonModule, ToastModule, TableModule, TagModule, SkeletonModule,
    InputTextModule, DropdownModule, DialogModule, AccordionModule,
    TooltipModule, TabViewModule, CheckboxModule, InputNumberModule, ConfirmDialogModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './flujos.component.html',
  styleUrl: './flujos.component.css'
})
export class FlujosComponent implements OnInit {

  activeTab = 0;
  isLoading = false;
  isSaving = false;

  // Flujos
  flujos: WfDefinicion[] = [];
  totalFlujos = 0;
  flujoSeleccionado: WfDefinicion | null = null;
  mostrarModalFlujo = false;
  flujoForm: Partial<CrearDefinicionRequest> = this.emptyFlujoForm();
  editandoFlujoId: number | null = null;

  // Pasos
  pasos: WfPaso[] = [];
  mostrarModalPaso = false;
  pasoForm: Partial<CrearPasoRequest> = this.emptyPasoForm();
  editandoPasoId: number | null = null;

  // Reglas
  reglas: WfRegla[] = [];
  mostrarModalRegla = false;
  reglaForm: Partial<CrearReglaRequest> = this.emptyReglaForm();
  editandoReglaId: number | null = null;

  // Aprobadores
  aprobadores: WfAprobador[] = [];
  pasoParaAprobadores: WfPaso | null = null;
  mostrarModalAprobador = false;
  aprobadorForm: Partial<CrearAprobadorRequest> = this.emptyAprobadorForm();

  // Opciones
  modulosOptions = [
    { label: 'Anticipos', value: 'anticipos' },
    { label: 'Horas Extras', value: 'horas_extras' },
    { label: 'Permisos', value: 'permisos' },
    { label: 'Eventos', value: 'eventos' }
  ];

  estrategiasOptions = [
    { label: 'Usuario Fijo', value: 'fijo' },
    { label: 'Por Unidad Funcional', value: 'unidad_funcional' },
    { label: 'Por Prefijo Sucursal', value: 'prefijo_sucursal' }
  ];

  coberturaOptions = [
    { label: 'Todas', value: null },
    { label: 'Nacional', value: 'nacional' },
    { label: 'Internacional', value: 'internacional' }
  ];

  constructor(
    private workflowService: WorkflowService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit(): void {
    this.loadFlujos();
  }

  // ── FLUJOS ────────────────────────────────────────────────────────────────

  loadFlujos(): void {
    this.isLoading = true;
    this.workflowService.listarDefiniciones({ page: 1, per_page: 50 }).subscribe({
      next: (res) => {
        this.flujos = res.data;
        this.totalFlujos = res.total;
        this.isLoading = false;
      },
      error: () => {
        this.toast('error', 'No se pudieron cargar los flujos');
        this.isLoading = false;
      }
    });
  }

  seleccionarFlujo(flujo: WfDefinicion): void {
    this.flujoSeleccionado = flujo;
    this.loadPasos(flujo.id);
    this.loadReglas(flujo.id);
    this.aprobadores = [];
    this.pasoParaAprobadores = null;
  }

  abrirModalFlujo(flujo?: WfDefinicion): void {
    if (flujo) {
      this.editandoFlujoId = flujo.id;
      this.flujoForm = { codigo: flujo.codigo, nombre: flujo.nombre, descripcion: flujo.descripcion, modulo: flujo.modulo, id_empresa: flujo.id_empresa, estado: flujo.estado };
    } else {
      this.editandoFlujoId = null;
      this.flujoForm = this.emptyFlujoForm();
    }
    this.mostrarModalFlujo = true;
  }

  guardarFlujo(): void {
    if (!this.flujoForm.codigo || !this.flujoForm.nombre || !this.flujoForm.modulo) {
      this.toast('warn', 'Código, nombre y módulo son obligatorios');
      return;
    }
    this.isSaving = true;
    const req = this.flujoForm as CrearDefinicionRequest;
    const op = this.editandoFlujoId
      ? this.workflowService.actualizarDefinicion(this.editandoFlujoId, req)
      : this.workflowService.crearDefinicion(req);

    op.subscribe({
      next: (res) => {
        if (res.success) {
          this.toast('success', this.editandoFlujoId ? 'Flujo actualizado' : 'Flujo creado');
          this.mostrarModalFlujo = false;
          this.loadFlujos();
        }
        this.isSaving = false;
      },
      error: (err) => {
        this.toast('error', err.error?.message || 'Error al guardar flujo');
        this.isSaving = false;
      }
    });
  }

  eliminarFlujo(flujo: WfDefinicion): void {
    this.confirmationService.confirm({
      message: `¿Eliminar el flujo "${flujo.nombre}"?`,
      header: 'Confirmar',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.workflowService.eliminarDefinicion(flujo.id).subscribe({
          next: () => { this.toast('success', 'Flujo eliminado'); this.loadFlujos(); if (this.flujoSeleccionado?.id === flujo.id) this.flujoSeleccionado = null; },
          error: () => this.toast('error', 'No se pudo eliminar')
        });
      }
    });
  }

  // ── PASOS ─────────────────────────────────────────────────────────────────

  loadPasos(idDefinicion: number): void {
    this.workflowService.listarPasos(idDefinicion).subscribe({
      next: (res) => { if (res.success) this.pasos = res.data; },
      error: () => this.toast('error', 'No se pudieron cargar los pasos')
    });
  }

  abrirModalPaso(paso?: WfPaso): void {
    if (paso) {
      this.editandoPasoId = paso.id;
      this.pasoForm = { ...paso };
    } else {
      this.editandoPasoId = null;
      this.pasoForm = { ...this.emptyPasoForm(), id_definicion: this.flujoSeleccionado?.id };
    }
    this.mostrarModalPaso = true;
  }

  guardarPaso(): void {
    if (!this.pasoForm.nombre_paso || !this.pasoForm.rol_aprobador) {
      this.toast('warn', 'Nombre y rol son obligatorios');
      return;
    }
    this.isSaving = true;
    const req = this.pasoForm as CrearPasoRequest;
    const op = this.editandoPasoId
      ? this.workflowService.actualizarPaso(this.editandoPasoId, req)
      : this.workflowService.crearPaso(req);

    op.subscribe({
      next: (res) => {
        if (res.success) {
          this.toast('success', this.editandoPasoId ? 'Paso actualizado' : 'Paso creado');
          this.mostrarModalPaso = false;
          this.loadPasos(this.flujoSeleccionado!.id);
        }
        this.isSaving = false;
      },
      error: (err) => { this.toast('error', err.error?.message || 'Error al guardar paso'); this.isSaving = false; }
    });
  }

  eliminarPaso(paso: WfPaso): void {
    this.confirmationService.confirm({
      message: `¿Eliminar el paso "${paso.nombre_paso}"?`,
      header: 'Confirmar',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.workflowService.eliminarPaso(paso.id).subscribe({
          next: () => { this.toast('success', 'Paso eliminado'); this.loadPasos(this.flujoSeleccionado!.id); },
          error: () => this.toast('error', 'No se pudo eliminar')
        });
      }
    });
  }

  verAprobadores(paso: WfPaso): void {
    this.pasoParaAprobadores = paso;
    this.workflowService.listarAprobadores(paso.id).subscribe({
      next: (res) => { if (res.success) this.aprobadores = res.data; },
      error: () => this.toast('error', 'No se pudieron cargar los aprobadores')
    });
  }

  // ── REGLAS ────────────────────────────────────────────────────────────────

  loadReglas(idDefinicion: number): void {
    this.workflowService.listarReglas(idDefinicion).subscribe({
      next: (res) => { if (res.success) this.reglas = res.data; },
      error: () => this.toast('error', 'No se pudieron cargar las reglas')
    });
  }

  abrirModalRegla(regla?: WfRegla): void {
    if (regla) {
      this.editandoReglaId = regla.id;
      this.reglaForm = { ...regla, condiciones: { ...regla.condiciones } };
    } else {
      this.editandoReglaId = null;
      this.reglaForm = { ...this.emptyReglaForm(), id_definicion: this.flujoSeleccionado?.id };
    }
    this.mostrarModalRegla = true;
  }

  guardarRegla(): void {
    if (!this.reglaForm.prioridad) {
      this.toast('warn', 'La prioridad es obligatoria');
      return;
    }
    this.isSaving = true;
    const req = this.reglaForm as CrearReglaRequest;
    const op = this.editandoReglaId
      ? this.workflowService.actualizarRegla(this.editandoReglaId, req)
      : this.workflowService.crearRegla(req);

    op.subscribe({
      next: (res) => {
        if (res.success) {
          this.toast('success', this.editandoReglaId ? 'Regla actualizada' : 'Regla creada');
          this.mostrarModalRegla = false;
          this.loadReglas(this.flujoSeleccionado!.id);
        }
        this.isSaving = false;
      },
      error: (err) => { this.toast('error', err.error?.message || 'Error al guardar regla'); this.isSaving = false; }
    });
  }

  eliminarRegla(regla: WfRegla): void {
    this.confirmationService.confirm({
      message: `¿Eliminar esta regla?`,
      header: 'Confirmar',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.workflowService.eliminarRegla(regla.id).subscribe({
          next: () => { this.toast('success', 'Regla eliminada'); this.loadReglas(this.flujoSeleccionado!.id); },
          error: () => this.toast('error', 'No se pudo eliminar')
        });
      }
    });
  }

  // ── APROBADORES ───────────────────────────────────────────────────────────

  abrirModalAprobador(): void {
    this.aprobadorForm = { ...this.emptyAprobadorForm(), id_paso: this.pasoParaAprobadores?.id };
    this.mostrarModalAprobador = true;
  }

  guardarAprobador(): void {
    if (!this.aprobadorForm.estrategia) {
      this.toast('warn', 'La estrategia es obligatoria');
      return;
    }
    this.isSaving = true;
    this.workflowService.crearAprobador(this.aprobadorForm as CrearAprobadorRequest).subscribe({
      next: (res) => {
        if (res.success) {
          this.toast('success', 'Aprobador agregado');
          this.mostrarModalAprobador = false;
          this.verAprobadores(this.pasoParaAprobadores!);
        }
        this.isSaving = false;
      },
      error: (err) => { this.toast('error', err.error?.message || 'Error al guardar aprobador'); this.isSaving = false; }
    });
  }

  eliminarAprobador(aprobador: WfAprobador): void {
    this.confirmationService.confirm({
      message: '¿Eliminar este aprobador?',
      header: 'Confirmar',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.workflowService.eliminarAprobador(aprobador.id).subscribe({
          next: () => { this.toast('success', 'Aprobador eliminado'); this.verAprobadores(this.pasoParaAprobadores!); },
          error: () => this.toast('error', 'No se pudo eliminar')
        });
      }
    });
  }

  // ── HELPERS ───────────────────────────────────────────────────────────────

  formatCondiciones(condiciones: CondicionesRegla): string {
    const partes: string[] = [];
    if (condiciones.nivel_min !== undefined || condiciones.nivel_max !== undefined)
      partes.push(`Nivel ${condiciones.nivel_min ?? 1}-${condiciones.nivel_max ?? 4}`);
    if (condiciones.prefijo_sucursal) partes.push(`Sucursal: ${condiciones.prefijo_sucursal}`);
    if (condiciones.monto_min) partes.push(`Monto > ${condiciones.monto_min.toLocaleString('es-CO')}`);
    if (condiciones.monto_max) partes.push(`Monto < ${condiciones.monto_max.toLocaleString('es-CO')}`);
    if (condiciones.cobertura) partes.push(`Cobertura: ${condiciones.cobertura}`);
    return partes.join(' | ') || 'Sin condiciones';
  }

  formatEstrategia(aprobador: WfAprobador): string {
    switch (aprobador.estrategia) {
      case 'fijo': return `Usuario: ${aprobador.user?.name ?? 'N/A'}`;
      case 'unidad_funcional': return `Unidad: ${aprobador.unidad_funcional?.nombre ?? 'N/A'}`;
      case 'prefijo_sucursal': return `Sucursal: ${aprobador.prefijo_sucursal ?? 'N/A'}`;
      default: return 'N/A';
    }
  }

  getSeverity(estado: boolean): 'success' | 'danger' { return estado ? 'success' : 'danger'; }
  getEstadoTexto(estado: boolean): string { return estado ? 'Activo' : 'Inactivo'; }

  private toast(severity: string, detail: string): void {
    this.messageService.add({ severity, summary: severity === 'error' ? 'Error' : severity === 'warn' ? 'Advertencia' : 'Éxito', detail, life: 3000 });
  }

  private emptyFlujoForm(): Partial<CrearDefinicionRequest> {
    return { codigo: '', nombre: '', descripcion: '', modulo: 'anticipos', estado: true };
  }

  private emptyPasoForm(): Partial<CrearPasoRequest> {
    return { orden: 1, nombre_paso: '', rol_aprobador: '', es_opcional: false, permite_rechazo: true };
  }

  private emptyReglaForm(): Partial<CrearReglaRequest> {
    return { prioridad: 10, condiciones: {}, descripcion: '', estado: true };
  }

  private emptyAprobadorForm(): Partial<CrearAprobadorRequest> {
    return { estrategia: 'fijo', es_suplente: false };
  }
}
