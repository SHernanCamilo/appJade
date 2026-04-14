import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';

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

import { WorkflowService } from '../../../sistema/flujos/services/workflow.service';
import {
  WfDefinicion, WfPaso, WfRegla, WfAprobador,
  CondicionesRegla, CrearDefinicionRequest, CrearPasoRequest,
  CrearReglaRequest, CrearAprobadorRequest
} from '../../../sistema/flujos/models/workflow.models';

// Interfaces para grupos de aprobación
interface WfGrupo { id: number; codigo: string; nombre: string; descripcion?: string; id_empresa?: number; estado: boolean; cargos?: GrupoCargo[]; }
interface GrupoCargo { id: number; id_grupo: number; id_cargo: number; cargo?: { id_cargo: number; nombre_cargo: string; nivel_jerarquico?: number }; }

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

  // ── TAB 1: GRUPOS DE APROBACIÓN ───────────────────────────────────────────
  grupos: WfGrupo[] = [];
  grupoSeleccionado: WfGrupo | null = null;
  mostrarModalGrupo = false;
  grupoForm = { codigo: '', nombre: '', descripcion: '', estado: true };
  editandoGrupoId: number | null = null;
  cargosDelGrupo: GrupoCargo[] = [];
  isLoadingCargos = false;

  // ── TAB 2: FLUJOS ─────────────────────────────────────────────────────────
  flujos: WfDefinicion[] = [];
  totalFlujos = 0;
  flujoSeleccionado: WfDefinicion | null = null;
  mostrarModalFlujo = false;
  flujoForm: Partial<CrearDefinicionRequest> = { codigo: '', nombre: '', descripcion: '', modulo: 'anticipos', estado: true };
  editandoFlujoId: number | null = null;

  pasos: WfPaso[] = [];
  mostrarModalPaso = false;
  pasoForm: Partial<CrearPasoRequest> = { orden: 1, nombre_paso: '', rol_aprobador: '', es_opcional: false, permite_rechazo: true };
  editandoPasoId: number | null = null;

  reglas: WfRegla[] = [];
  mostrarModalRegla = false;
  reglaForm: Partial<CrearReglaRequest> = { prioridad: 10, condiciones: {}, descripcion: '', estado: true };
  editandoReglaId: number | null = null;

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
    private workflowService: WorkflowService,
    private http: HttpClient
  ) {}

  ngOnInit(): void { this.loadGrupos(); this.loadFlujos(); }

  // ── GRUPOS DE APROBACIÓN ──────────────────────────────────────────────────
  loadGrupos(): void {
    this.isLoading = true;
    this.http.get<any>('/workflow/grupos').subscribe({
      next: (r) => { this.grupos = r?.data ?? r ?? []; this.isLoading = false; },
      error: () => { this.grupos = []; this.isLoading = false; }
    });
  }

  seleccionarGrupo(grupo: WfGrupo): void {
    this.grupoSeleccionado = grupo;
    this.loadCargosGrupo(grupo.id);
  }

  loadCargosGrupo(idGrupo: number): void {
    this.isLoadingCargos = true;
    this.http.get<any>(`/workflow/grupos/${idGrupo}/cargos`).subscribe({
      next: (r) => { this.cargosDelGrupo = r?.data ?? r ?? []; this.isLoadingCargos = false; },
      error: () => { this.cargosDelGrupo = []; this.isLoadingCargos = false; }
    });
  }

  abrirModalGrupo(grupo?: WfGrupo): void {
    if (grupo) { this.editandoGrupoId = grupo.id; this.grupoForm = { codigo: grupo.codigo, nombre: grupo.nombre, descripcion: grupo.descripcion || '', estado: grupo.estado }; }
    else { this.editandoGrupoId = null; this.grupoForm = { codigo: '', nombre: '', descripcion: '', estado: true }; }
    this.mostrarModalGrupo = true;
  }

  guardarGrupo(): void {
    if (!this.grupoForm.codigo || !this.grupoForm.nombre) { this.toast('warn', 'Código y nombre son obligatorios'); return; }
    this.isSaving = true;
    const op = this.editandoGrupoId
      ? this.http.put<any>(`/workflow/grupos/${this.editandoGrupoId}`, this.grupoForm)
      : this.http.post<any>('/workflow/grupos', this.grupoForm);
    op.subscribe({
      next: () => { this.toast('success', this.editandoGrupoId ? 'Grupo actualizado' : 'Grupo creado'); this.mostrarModalGrupo = false; this.loadGrupos(); this.isSaving = false; },
      error: (err) => { this.toast('error', err.error?.message || 'Error al guardar'); this.isSaving = false; }
    });
  }

  eliminarGrupo(grupo: WfGrupo): void {
    this.confirmationService.confirm({
      message: `¿Eliminar grupo "${grupo.nombre}"?`, header: 'Confirmar', icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí', rejectLabel: 'No',
      accept: () => this.http.delete<any>(`/workflow/grupos/${grupo.id}`).subscribe({
        next: () => { this.toast('success', 'Grupo eliminado'); this.loadGrupos(); if (this.grupoSeleccionado?.id === grupo.id) this.grupoSeleccionado = null; },
        error: () => this.toast('error', 'No se pudo eliminar')
      })
    });
  }

  // ── FLUJOS ────────────────────────────────────────────────────────────────
  loadFlujos(): void {
    this.workflowService.listarDefiniciones({ modulo: 'anticipos', page: 1, per_page: 50 }).subscribe({
      next: (res) => { this.flujos = res.data ?? []; this.totalFlujos = res.total ?? this.flujos.length; },
      error: () => this.toast('error', 'No se pudieron cargar los flujos')
    });
  }

  seleccionarFlujo(flujo: WfDefinicion): void {
    this.flujoSeleccionado = flujo;
    this.loadPasos(flujo.id); this.loadReglas(flujo.id);
    this.aprobadores = []; this.pasoParaAprobadores = null;
  }

  abrirModalFlujo(flujo?: WfDefinicion): void {
    if (flujo) { this.editandoFlujoId = flujo.id; this.flujoForm = { codigo: flujo.codigo, nombre: flujo.nombre, descripcion: flujo.descripcion, modulo: 'anticipos', id_empresa: flujo.id_empresa, estado: flujo.estado }; }
    else { this.editandoFlujoId = null; this.flujoForm = { codigo: '', nombre: '', descripcion: '', modulo: 'anticipos', estado: true }; }
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
  loadPasos(id: number): void { this.workflowService.listarPasos(id).subscribe({ next: (r) => { this.pasos = r.data ?? []; }, error: () => this.toast('error', 'Error cargando pasos') }); }

  abrirModalPaso(paso?: WfPaso): void {
    if (paso) { this.editandoPasoId = paso.id; this.pasoForm = { ...paso }; }
    else { this.editandoPasoId = null; this.pasoForm = { id_definicion: this.flujoSeleccionado?.id, orden: this.pasos.length + 1, nombre_paso: '', rol_aprobador: '', es_opcional: false, permite_rechazo: true }; }
    this.mostrarModalPaso = true;
  }

  guardarPaso(): void {
    if (!this.pasoForm.nombre_paso || !this.pasoForm.rol_aprobador) { this.toast('warn', 'Nombre y rol son obligatorios'); return; }
    this.isSaving = true;
    const op = this.editandoPasoId ? this.workflowService.actualizarPaso(this.editandoPasoId, this.pasoForm as CrearPasoRequest) : this.workflowService.crearPaso(this.pasoForm as CrearPasoRequest);
    op.subscribe({ next: () => { this.toast('success', 'Paso guardado'); this.mostrarModalPaso = false; this.loadPasos(this.flujoSeleccionado!.id); this.isSaving = false; }, error: (e) => { this.toast('error', e.error?.message || 'Error'); this.isSaving = false; } });
  }

  eliminarPaso(paso: WfPaso): void {
    this.confirmationService.confirm({ message: `¿Eliminar "${paso.nombre_paso}"?`, header: 'Confirmar', icon: 'pi pi-exclamation-triangle', acceptLabel: 'Sí', rejectLabel: 'No',
      accept: () => this.workflowService.eliminarPaso(paso.id).subscribe({ next: () => { this.toast('success', 'Paso eliminado'); this.loadPasos(this.flujoSeleccionado!.id); }, error: () => this.toast('error', 'No se pudo eliminar') }) });
  }

  verAprobadores(paso: WfPaso): void {
    this.pasoParaAprobadores = paso;
    this.workflowService.listarAprobadores(paso.id).subscribe({ next: (r) => { this.aprobadores = r.data ?? []; }, error: () => this.toast('error', 'Error cargando aprobadores') });
  }

  // ── REGLAS ────────────────────────────────────────────────────────────────
  loadReglas(id: number): void { this.workflowService.listarReglas(id).subscribe({ next: (r) => { this.reglas = r.data ?? []; }, error: () => this.toast('error', 'Error cargando reglas') }); }

  abrirModalRegla(regla?: WfRegla): void {
    if (regla) { this.editandoReglaId = regla.id; this.reglaForm = { ...regla, condiciones: { ...regla.condiciones } }; }
    else { this.editandoReglaId = null; this.reglaForm = { id_definicion: this.flujoSeleccionado?.id, prioridad: 10, condiciones: {}, descripcion: '', estado: true }; }
    this.mostrarModalRegla = true;
  }

  guardarRegla(): void {
    if (!this.reglaForm.prioridad) { this.toast('warn', 'La prioridad es obligatoria'); return; }
    this.isSaving = true;
    const op = this.editandoReglaId ? this.workflowService.actualizarRegla(this.editandoReglaId, this.reglaForm as CrearReglaRequest) : this.workflowService.crearRegla(this.reglaForm as CrearReglaRequest);
    op.subscribe({ next: () => { this.toast('success', 'Regla guardada'); this.mostrarModalRegla = false; this.loadReglas(this.flujoSeleccionado!.id); this.isSaving = false; }, error: (e) => { this.toast('error', e.error?.message || 'Error'); this.isSaving = false; } });
  }

  eliminarRegla(regla: WfRegla): void {
    this.confirmationService.confirm({ message: '¿Eliminar esta regla?', header: 'Confirmar', icon: 'pi pi-exclamation-triangle', acceptLabel: 'Sí', rejectLabel: 'No',
      accept: () => this.workflowService.eliminarRegla(regla.id).subscribe({ next: () => { this.toast('success', 'Regla eliminada'); this.loadReglas(this.flujoSeleccionado!.id); }, error: () => this.toast('error', 'No se pudo eliminar') }) });
  }

  // ── APROBADORES ───────────────────────────────────────────────────────────
  abrirModalAprobador(): void { this.aprobadorForm = { id_paso: this.pasoParaAprobadores?.id, estrategia: 'fijo', es_suplente: false }; this.mostrarModalAprobador = true; }

  guardarAprobador(): void {
    if (!this.aprobadorForm.estrategia) { this.toast('warn', 'La estrategia es obligatoria'); return; }
    this.isSaving = true;
    this.workflowService.crearAprobador(this.aprobadorForm as CrearAprobadorRequest).subscribe({
      next: () => { this.toast('success', 'Aprobador agregado'); this.mostrarModalAprobador = false; this.verAprobadores(this.pasoParaAprobadores!); this.isSaving = false; },
      error: (e) => { this.toast('error', e.error?.message || 'Error'); this.isSaving = false; }
    });
  }

  eliminarAprobador(a: WfAprobador): void {
    this.confirmationService.confirm({ message: '¿Eliminar este aprobador?', header: 'Confirmar', icon: 'pi pi-exclamation-triangle', acceptLabel: 'Sí', rejectLabel: 'No',
      accept: () => this.workflowService.eliminarAprobador(a.id).subscribe({ next: () => { this.toast('success', 'Aprobador eliminado'); this.verAprobadores(this.pasoParaAprobadores!); }, error: () => this.toast('error', 'No se pudo eliminar') }) });
  }

  // ── HELPERS ───────────────────────────────────────────────────────────────
  formatCondiciones(cond: CondicionesRegla): string {
    const p: string[] = [];
    if (cond.nivel_min !== undefined || cond.nivel_max !== undefined) p.push(`Nivel ${cond.nivel_min ?? 1}-${cond.nivel_max ?? 4}`);
    if (cond.prefijo_sucursal) p.push(`Sucursal: ${cond.prefijo_sucursal}`);
    if (cond.cobertura) p.push(`Cobertura: ${cond.cobertura}`);
    if ((cond as any).id_grupo) p.push(`Grupo: ${(cond as any).id_grupo}`);
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
