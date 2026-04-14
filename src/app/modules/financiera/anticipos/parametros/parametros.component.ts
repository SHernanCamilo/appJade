import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

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

import { AnticipoConceptoService, AntiConcepto, AntiTipo, AntiClase, AntiModalidad, AntiRegla } from '../services/anticipo-concepto.service';
import { AnticipoCiudadService } from '../services/anticipo-ciudad.service';
import { ContextoService } from '../../../../core/services/contexto.service';
import { AuthService } from '../../../auth/auth.service';
import { Ciudad } from '../models/anticipo.models';

@Component({
  selector: 'app-parametros-anticipos',
  standalone: true,
  imports: [
    CommonModule, RouterModule, FormsModule,
    ButtonModule, ToastModule, TableModule, TagModule, SkeletonModule,
    InputTextModule, TooltipModule, CheckboxModule, DropdownModule,
    InputNumberModule, ConfirmDialogModule, TabViewModule, DialogModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './parametros.component.html',
  styleUrl: './parametros.component.css'
})
export class ParametrosAnticiposComponent implements OnInit, OnDestroy {

  activeTabIndex = 0;
  isLoading = false;
  isSaving = false;
  private subscriptions: Subscription[] = [];

  // ── TAB 1: CONCEPTOS (Tipo → Clase → Modalidad → Reglas) ─────────────────
  conceptos: AntiConcepto[] = [];
  totalConceptos = 0;
  tiposOptions: AntiTipo[] = [];
  clasesOptions: AntiClase[] = [];
  modalidadesOptions: AntiModalidad[] = [];
  conceptoForm = { id_tipo: null as number | null, id_clase: null as number | null, id_modalidad: null as number | null, estado: true };
  reglas: AntiRegla[] = [];
  nuevaRegla: AntiRegla = { descripcion: '', valor_tope: 0 };
  modoEdicionConcepto = false;
  conceptoEditandoId: number | null = null;

  // ── TAB 2: CIUDADES (lectura del catálogo) ────────────────────────────────
  ciudades: Ciudad[] = [];

  // ── TAB 3: TOPES POR NIVEL (tabla resumen, datos del backend) ─────────────
  nivelesJerarquicos = [
    { nivel: 1, tipo: 'Estratégico', desayuno: 35000, almuerzo: 45000, cena: 45000, totalDia: 125000 },
    { nivel: 2, tipo: 'Táctico', desayuno: 30000, almuerzo: 40000, cena: 40000, totalDia: 110000 },
    { nivel: 3, tipo: 'Operativo', desayuno: 30000, almuerzo: 40000, cena: 40000, totalDia: 110000 }
  ];

  transportePorCiudad = [
    { tipo: 'A', ciudades: 'Bogotá, Medellín, Cali, Barranquilla, Cartagena', valorDia: 70000 },
    { tipo: 'B', ciudades: 'Neiva, Pasto, Pereira, Tunja, Yopal, Montería, Florencia', valorDia: 50000 },
    { tipo: 'C', ciudades: 'Pitalito, Duitama, Garzón, Puerto Asís, Tumaco', valorDia: 40000 }
  ];

  constructor(
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private conceptoService: AnticipoConceptoService,
    private ciudadService: AnticipoCiudadService,
    private contextoService: ContextoService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadTipos();
    this.loadConceptos();
    this.loadCiudades();
  }

  ngOnDestroy(): void { this.subscriptions.forEach(s => s.unsubscribe()); }

  // ── CONCEPTOS ─────────────────────────────────────────────────────────────
  loadTipos(): void {
    this.conceptoService.getTipos().subscribe({
      next: (r) => { if (r.success) this.tiposOptions = r.data; },
      error: () => this.toast('error', 'No se pudieron cargar los tipos')
    });
  }

  loadConceptos(): void {
    this.isLoading = true;
    this.conceptoService.getConceptos({ page: 1, per_page: 50 }).subscribe({
      next: (r) => { if (r.success) { this.conceptos = r.data; this.totalConceptos = r.total; } this.isLoading = false; },
      error: () => { this.toast('error', 'No se pudieron cargar los conceptos'); this.isLoading = false; }
    });
  }

  onTipoChange(): void {
    this.conceptoForm.id_clase = null; this.conceptoForm.id_modalidad = null;
    this.clasesOptions = []; this.modalidadesOptions = [];
    if (this.conceptoForm.id_tipo) {
      this.conceptoService.getClasesPorTipo(this.conceptoForm.id_tipo).subscribe({
        next: (r) => { if (r.success) this.clasesOptions = r.data; },
        error: () => this.toast('error', 'No se pudieron cargar las clases')
      });
    }
  }

  onClaseChange(): void {
    this.conceptoForm.id_modalidad = null; this.modalidadesOptions = [];
    if (this.conceptoForm.id_clase) {
      this.conceptoService.getModalidadesPorClase(this.conceptoForm.id_clase).subscribe({
        next: (r) => { if (r.success) this.modalidadesOptions = r.data; },
        error: () => this.toast('error', 'No se pudieron cargar las modalidades')
      });
    }
  }

  agregarRegla(): void {
    if (!this.nuevaRegla.descripcion?.trim()) { this.toast('warn', 'La descripción es obligatoria'); return; }
    if (this.nuevaRegla.valor_tope <= 0) { this.toast('warn', 'El valor tope debe ser mayor a 0'); return; }
    this.reglas.push({ ...this.nuevaRegla });
    this.nuevaRegla = { descripcion: '', valor_tope: 0 };
  }

  eliminarRegla(regla: AntiRegla): void {
    this.reglas = this.reglas.filter(r => r !== regla);
  }

  guardarConcepto(): void {
    if (this.nuevaRegla.descripcion?.trim() && this.nuevaRegla.valor_tope > 0) {
      this.reglas.push({ ...this.nuevaRegla }); this.nuevaRegla = { descripcion: '', valor_tope: 0 };
    }
    if (!this.conceptoForm.id_tipo || !this.conceptoForm.id_clase || !this.conceptoForm.id_modalidad) {
      this.toast('warn', 'Tipo, clase y modalidad son obligatorios'); return;
    }
    if (this.reglas.length === 0) { this.toast('warn', 'Debe agregar al menos una regla'); return; }

    this.isSaving = true;
    const data = { ...this.conceptoForm, reglas: this.reglas } as any;
    const op = this.modoEdicionConcepto && this.conceptoEditandoId
      ? this.conceptoService.updateConcepto(this.conceptoEditandoId, data)
      : this.conceptoService.createConcepto(data);

    op.subscribe({
      next: (r) => {
        if (r.success) { this.toast('success', this.modoEdicionConcepto ? 'Concepto actualizado' : 'Concepto creado'); this.loadConceptos(); this.resetConceptoForm(); }
        this.isSaving = false;
      },
      error: (err) => { this.toast('error', err.error?.message || 'Error al guardar'); this.isSaving = false; }
    });
  }

  editarConcepto(c: AntiConcepto): void {
    this.modoEdicionConcepto = true; this.conceptoEditandoId = c.id || null;
    this.conceptoForm = { id_tipo: c.id_tipo, id_clase: c.id_clase, id_modalidad: c.id_modalidad, estado: c.estado };
    this.reglas = c.reglas ? [...c.reglas] : [];
    if (c.id_tipo) this.conceptoService.getClasesPorTipo(c.id_tipo).subscribe({ next: (r) => { if (r.success) this.clasesOptions = r.data; } });
    if (c.id_clase) this.conceptoService.getModalidadesPorClase(c.id_clase).subscribe({ next: (r) => { if (r.success) this.modalidadesOptions = r.data; } });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  eliminarConcepto(c: AntiConcepto): void {
    this.confirmationService.confirm({
      message: '¿Eliminar este concepto?', header: 'Confirmar', icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí', rejectLabel: 'No',
      accept: () => { if (c.id) this.conceptoService.deleteConcepto(c.id).subscribe({ next: () => { this.toast('success', 'Concepto eliminado'); this.loadConceptos(); }, error: () => this.toast('error', 'No se pudo eliminar') }); }
    });
  }

  toggleEstadoConcepto(c: AntiConcepto): void {
    if (c.id) this.conceptoService.toggleEstado(c.id).subscribe({
      next: (r) => { if (r.success) { this.toast('success', `Concepto ${r.data.estado ? 'activado' : 'desactivado'}`); this.loadConceptos(); } },
      error: () => this.toast('error', 'No se pudo cambiar el estado')
    });
  }

  resetConceptoForm(): void {
    this.conceptoForm = { id_tipo: null, id_clase: null, id_modalidad: null, estado: true };
    this.reglas = []; this.clasesOptions = []; this.modalidadesOptions = [];
    this.modoEdicionConcepto = false; this.conceptoEditandoId = null;
    this.nuevaRegla = { descripcion: '', valor_tope: 0 };
  }

  // ── CIUDADES ──────────────────────────────────────────────────────────────
  loadCiudades(): void {
    this.ciudadService.getCiudades().subscribe({
      next: (r: any) => {
        const lista = Array.isArray(r?.data) ? r.data : Array.isArray(r) ? r : [];
        this.ciudades = lista;
      },
      error: () => this.toast('error', 'No se pudieron cargar las ciudades')
    });
  }

  // ── HELPERS ───────────────────────────────────────────────────────────────
  getTipoLabel(c: AntiConcepto): string { return c.tipo?.nombre || ''; }
  getClaseLabel(c: AntiConcepto): string { return c.clase?.nombre || ''; }
  getModalidadLabel(c: AntiConcepto): string { return c.modalidad?.nombre || ''; }
  getSeverity(estado: boolean): 'success' | 'danger' { return estado ? 'success' : 'danger'; }
  getEstadoTexto(estado: boolean): string { return estado ? 'Activo' : 'Inactivo'; }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
  }

  private toast(severity: string, detail: string): void {
    this.messageService.add({ severity, summary: severity === 'error' ? 'Error' : severity === 'warn' ? 'Advertencia' : 'Éxito', detail, life: 3000 });
  }
}
