import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NovedadesService, Novedad, CreateNovedadRequest } from '../cargue/services/cargue.service';

// PrimeNG
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { TextareaModule } from 'primeng/textarea';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService, ConfirmationService } from 'primeng/api';

@Component({
  selector: 'app-dashboard-eventos',
  standalone: true,
  imports: [
    CommonModule, RouterModule, FormsModule,
    TableModule, ButtonModule, InputTextModule, DialogModule,
    ToastModule, ConfirmDialogModule, TagModule, TooltipModule,
    DropdownModule, CalendarModule, TextareaModule, SkeletonModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardEventosComponent implements OnInit {

  activeTab: 'cargue' | 'gestionar' | 'configuracion' = 'cargue';

  // --- Gestionar ---
  novedades: Novedad[] = [];
  novedadesFiltradas: Novedad[] = [];
  empleadoOptions: { label: string; value: number }[] = [];
  isLoading = false;
  isSubmitting = false;

  searchTerm = '';
  selectedEstado: string | null = null;
  estadosOptions = [
    { label: 'Todos', value: null },
    { label: 'En Proceso', value: 'proceso' },
    { label: 'Aprobada', value: 'aprobada' },
    { label: 'Rechazada', value: 'rechazada' }
  ];

  showFormDialog = false;
  editMode = false;
  currentId?: number;
  submitted = false;
  fechaInicialInvalida = false;

  formData = this.emptyForm();

  constructor(
    private novedadesService: NovedadesService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit(): void {
    this.loadNovedades();
    this.loadEmpleados();
  }

  setTab(tab: 'cargue' | 'gestionar' | 'configuracion'): void {
    this.activeTab = tab;
  }

  emptyForm() {
    return {
      empleado_id: null as number | null,
      aprobador_id: null as number | null,
      unidad_funcional: '',
      fecha_inicial: null as Date | null,
      fecha_final: null as Date | null,
      descripcion: ''
    };
  }

  loadEmpleados(): void {
    this.novedadesService.getEmpleados().subscribe({
      next: (data) => { this.empleadoOptions = data.map(e => ({ label: e.nombre, value: e.id })); },
      error: () => { this.empleadoOptions = []; }
    });
  }

  loadNovedades(): void {
    this.isLoading = true;
    this.novedadesService.getNovedadesPorEstado(this.selectedEstado || '').subscribe({
      next: (data) => { this.novedades = data; this.aplicarFiltros(); this.isLoading = false; },
      error: () => { this.novedades = []; this.novedadesFiltradas = []; this.isLoading = false; }
    });
  }

  aplicarFiltros(): void {
    let result = [...this.novedades];
    if (this.selectedEstado) result = result.filter(n => n.estado === this.selectedEstado);
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(n =>
        n.empleado?.toLowerCase().includes(term) ||
        n.consecutivo?.toLowerCase().includes(term) ||
        n.unidad_funcional?.toLowerCase().includes(term)
      );
    }
    this.novedadesFiltradas = result;
  }

  limpiarFiltros(): void {
    this.searchTerm = '';
    this.selectedEstado = null;
    this.aplicarFiltros();
  }

  abrirFormulario(): void {
    this.editMode = false;
    this.currentId = undefined;
    this.submitted = false;
    this.fechaInicialInvalida = false;
    this.formData = this.emptyForm();
    this.showFormDialog = true;
  }

  editarNovedad(novedad: Novedad): void {
    this.editMode = true;
    this.currentId = novedad.id;
    this.submitted = false;
    this.fechaInicialInvalida = false;
    this.formData = {
      empleado_id: novedad.empleado_id,
      aprobador_id: novedad.aprobador_id ?? null,
      unidad_funcional: novedad.unidad_funcional ?? '',
      fecha_inicial: new Date(novedad.fecha_inicial),
      fecha_final: new Date(novedad.fecha_final),
      descripcion: novedad.descripcion ?? ''
    };
    this.showFormDialog = true;
  }

  validarFechas(): void {
    const { fecha_inicial: ini, fecha_final: fin } = this.formData;
    this.fechaInicialInvalida = !!(ini && fin && fin < ini);
  }

  onSubmit(): void {
    this.submitted = true;
    if (!this.formData.empleado_id || !this.formData.fecha_inicial || !this.formData.fecha_final || this.fechaInicialInvalida) return;

    this.isSubmitting = true;
    const payload: CreateNovedadRequest = {
      empleado_id: this.formData.empleado_id!,
      aprobador_id: this.formData.aprobador_id ?? undefined,
      unidad_funcional: this.formData.unidad_funcional,
      fecha_inicial: this.formData.fecha_inicial!.toISOString(),
      fecha_final: this.formData.fecha_final!.toISOString(),
      descripcion: this.formData.descripcion
    };

    const req$ = this.editMode && this.currentId
      ? this.novedadesService.updateNovedad(this.currentId, payload)
      : this.novedadesService.createNovedad(payload);

    req$.subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: this.editMode ? 'Solicitud actualizada' : 'Solicitud creada' });
        this.showFormDialog = false;
        this.isSubmitting = false;
        this.loadNovedades();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al guardar' });
        this.isSubmitting = false;
      }
    });
  }

  eliminarNovedad(novedad: Novedad): void {
    this.confirmationService.confirm({
      message: `¿Eliminar la solicitud ${novedad.consecutivo}?`,
      header: 'Confirmar Eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.novedadesService.deleteNovedad(novedad.id).subscribe({
          next: () => { this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Solicitud eliminada' }); this.loadNovedades(); },
          error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al eliminar' })
        });
      }
    });
  }

  getEstadoSeverity(estado: string): 'success' | 'danger' | 'warn' | 'info' {
    const map: Record<string, 'success' | 'danger' | 'warn' | 'info'> = {
      aprobada: 'success', rechazada: 'danger', proceso: 'warn'
    };
    return map[estado] ?? 'info';
  }
}
