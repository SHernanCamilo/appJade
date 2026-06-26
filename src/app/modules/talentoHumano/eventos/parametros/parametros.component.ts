import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  EventNovedadService,
  EventNovedad,
  EventNovedadCargo,
  FlujoEventoConfig,
  ConfiguracionFlujoUnidad
} from './services/event-novedad.service';

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
import { ToggleButtonModule } from 'primeng/togglebutton';
import { InputSwitchModule } from 'primeng/inputswitch';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService, ConfirmationService } from 'primeng/api';

@Component({
  selector: 'app-dashboard-eventos',
  standalone: true,
  imports: [
    CommonModule, RouterModule, FormsModule,
    TableModule, ButtonModule, InputTextModule, DialogModule,
    ToastModule, ConfirmDialogModule, TagModule, TooltipModule,
    ToggleButtonModule, SkeletonModule, InputSwitchModule, DropdownModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './parametros.component.html',
  styleUrl: './parametros.component.css'
})
export class ParametrosEventosComponent implements OnInit {

  activeTab: 'novedad' | 'flujos' | 'gestionar' | 'configuracion' = 'novedad';

  novedades: EventNovedad[] = [];
  novedadesFiltradas: EventNovedad[] = [];
  novedadesCatalogo: EventNovedad[] = [];
  vinculaciones: EventNovedadCargo[] = [];

  // Opciones para dropdowns del dialog Vincular
  novedadOptions: { label: string; value: number }[] = [];
  empresaOptions: { label: string; value: number }[] = [];
  cargoOptions:   { label: string; value: number }[] = [];

  // Form vincular
  vincularData = { novedad_id: null as number | null, empresa_id: null as number | null, cargo_id: null as number | null };
  novedadSeleccionada: number | null = null;
  novedadesAVincular: EventNovedad[] = [];
  submittedVincular = false;
  isSubmittingVincular = false;

  isLoading = false;
  isLoadingCatalogo = false;
  isSubmitting = false;

  // ─── Flujos por unidad funcional ──────────────────────────────────────────
  flujoEmpresaId: number | null = null;
  flujoUnidadId: number | null = null;
  flujoSeleccionadoId: number | null = null;
  flujoOptions: { label: string; value: number }[] = [];
  flujoList: FlujoEventoConfig[] = [];
  unidadFlujoOptions: { label: string; value: number }[] = [];
  usuarioOptions: { label: string; value: number }[] = [];
  pasosFlujo: FlujoEventoConfig['pasos'] = [];
  responsablesPorPaso: Record<number, number | null> = {};
  isLoadingFlujos = false;
  isLoadingUsuariosFlujo = false;
  isSavingFlujo = false;

  // Dialogs
  showFormDialog    = false;
  showVincularDialog = false;
  showListadoDialog  = false;
  showFormEnListado  = false;

  editMode        = false;
  editModeListado = false;
  currentId?: number;
  submitted        = false;
  submittedListado = false;

  formData = this.emptyForm();

  constructor(
    private svc: EventNovedadService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit(): void {
    this.loadNovedades();
    this.loadVinculaciones();
    this.cargarCatalogosFlujos();
  }

  setTab(tab: 'novedad' | 'flujos' | 'gestionar' | 'configuracion'): void {
    this.activeTab = tab;
    if (tab === 'flujos' && this.empresaOptions.length === 0) {
      this.cargarCatalogosFlujos();
    }
  }

  emptyForm() {
    return { codigo: '', descripcion: '', cubre: false, activo: true };
  }

  // ─── Tabla principal (vinculaciones) ─────────────────────────────────────

  loadVinculaciones(): void {
    this.isLoading = true;
    this.svc.getVinculaciones().subscribe({
      next: (data) => { this.vinculaciones = data; this.isLoading = false; },
      error: () => { this.vinculaciones = []; this.isLoading = false; }
    });
  }

  desvincular(v: EventNovedadCargo): void {
    this.confirmationService.confirm({
      message: `¿Desvincular la novedad "${v.novedad?.descripcion}"?`,
      header: 'Confirmar',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, desvincular',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.svc.desvincular(v.id).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Vinculación eliminada' });
            this.loadVinculaciones();
          },
          error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al desvincular' })
        });
      }
    });
  }

  // ─── Tabla principal ──────────────────────────────────────────────────────

  loadNovedades(): void {
    this.isLoading = true;
    this.svc.getAll().subscribe({
      next: (data) => { this.novedades = data; this.novedadesFiltradas = data; this.isLoading = false; },
      error: () => { this.novedades = []; this.novedadesFiltradas = []; this.isLoading = false; }
    });
  }

  // ─── Dialog Listado / Catálogo ────────────────────────────────────────────

  abrirListadoNovedades(): void {
    this.showFormEnListado = false;
    this.submittedListado  = false;
    this.showListadoDialog = true;
    this.loadCatalogo();
  }

  loadCatalogo(): void {
    this.isLoadingCatalogo = true;
    this.svc.getAll().subscribe({
      next: (data) => { this.novedadesCatalogo = data; this.isLoadingCatalogo = false; },
      error: () => { this.novedadesCatalogo = []; this.isLoadingCatalogo = false; }
    });
  }

  abrirFormEnListado(): void {
    this.editModeListado = false;
    this.currentId       = undefined;
    this.submittedListado = false;
    this.formData = this.emptyForm();
    this.showFormEnListado = true;
  }

  editarNovedadEnListado(novedad: EventNovedad): void {
    this.editModeListado  = true;
    this.currentId        = novedad.id;
    this.submittedListado = false;
    this.formData = { codigo: novedad.codigo, descripcion: novedad.descripcion, cubre: novedad.cubre, activo: novedad.activo };
    this.showFormEnListado = true;
  }

  onSubmitListado(): void {
    this.submittedListado = true;
    if (!this.formData.codigo.trim() || !this.formData.descripcion.trim()) return;

    this.isSubmitting = true;
    const payload = { ...this.formData, codigo: this.formData.codigo.toUpperCase().trim() };
    const req$ = this.editModeListado && this.currentId
      ? this.svc.update(this.currentId, payload)
      : this.svc.create(payload);

    req$.subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: this.editModeListado ? 'Novedad actualizada' : 'Novedad creada' });
        this.showFormEnListado = false;
        this.isSubmitting = false;
        this.loadCatalogo();
        this.loadNovedades();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al guardar' });
        this.isSubmitting = false;
      }
    });
  }

  // ─── Dialog Nueva / Editar (standalone) ──────────────────────────────────

  abrirFormulario(): void {
    this.editMode  = false;
    this.currentId = undefined;
    this.submitted = false;
    this.formData  = this.emptyForm();
    this.showFormDialog = true;
  }

  editarNovedad(novedad: EventNovedad): void {
    this.editMode  = true;
    this.currentId = novedad.id;
    this.submitted = false;
    this.formData  = { codigo: novedad.codigo, descripcion: novedad.descripcion, cubre: novedad.cubre, activo: novedad.activo };
    this.showFormDialog = true;
  }

  onSubmit(): void {
    this.submitted = true;
    if (!this.formData.codigo.trim() || !this.formData.descripcion.trim()) return;

    this.isSubmitting = true;
    const payload = { ...this.formData, codigo: this.formData.codigo.toUpperCase().trim() };
    const req$ = this.editMode && this.currentId
      ? this.svc.update(this.currentId, payload)
      : this.svc.create(payload);

    req$.subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: this.editMode ? 'Novedad actualizada' : 'Novedad creada' });
        this.showFormDialog = false;
        this.isSubmitting   = false;
        this.loadNovedades();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al guardar' });
        this.isSubmitting = false;
      }
    });
  }

  // ─── Vincular ─────────────────────────────────────────────────────────────

  abrirVincular(): void {
    this.vincularData = { novedad_id: null, empresa_id: null, cargo_id: null };
    this.novedadSeleccionada = null;
    this.novedadesAVincular = [];
    this.submittedVincular = false;
    this.showVincularDialog = true;
    this.loadOpcionesVincular();
  }

  agregarNovedadALista(): void {
    if (!this.novedadSeleccionada) return;
    const yaExiste = this.novedadesAVincular.some(n => n.id === this.novedadSeleccionada);
    if (yaExiste) {
      this.messageService.add({ severity: 'warn', summary: 'Aviso', detail: 'Esa novedad ya está en la lista' });
      return;
    }
    const novedad = this.novedades.find(n => n.id === this.novedadSeleccionada)
      || this.novedadesCatalogo.find(n => n.id === this.novedadSeleccionada);
    if (novedad) {
      this.novedadesAVincular.push(novedad);
      this.novedadSeleccionada = null;
    }
  }

  quitarNovedadDeLista(id: number): void {
    this.novedadesAVincular = this.novedadesAVincular.filter(n => n.id !== id);
  }

  loadOpcionesVincular(): void {
    this.svc.getAll({ activo: true }).subscribe({
      next: (data) => { this.novedadOptions = data.map(n => ({ label: `${n.codigo} - ${n.descripcion}`, value: n.id })); },
      error: () => {}
    });
    this.svc.getEmpresas().subscribe({
      next: (data) => { this.empresaOptions = data; },
      error: () => {}
    });
    this.svc.getCargos().subscribe({
      next: (data) => { this.cargoOptions = data; },
      error: () => {}
    });
  }

  onVincular(): void {
    this.submittedVincular = true;
    if (this.novedadesAVincular.length === 0) return;

    this.isSubmittingVincular = true;
    const requests = this.novedadesAVincular.map(n =>
      this.svc.vincular({
        novedad_id: n.id,
        empresa_id: this.vincularData.empresa_id,
        cargo_id:   this.vincularData.cargo_id
      })
    );

    // Ejecutar todas en paralelo con forkJoin
    import('rxjs').then(({ forkJoin }) => {
      forkJoin(requests).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Éxito', detail: `${this.novedadesAVincular.length} novedad(es) vinculada(s)` });
          this.showVincularDialog = false;
          this.isSubmittingVincular = false;
          this.loadVinculaciones();
        },
        error: (err) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al vincular' });
          this.isSubmittingVincular = false;
        }
      });
    });
  }

  // ─── Flujos por UF ─────────────────────────────────────────────────────────

  cargarCatalogosFlujos(): void {
    this.isLoadingFlujos = true;
    this.svc.getEmpresas().subscribe({
      next: (empresas) => { this.empresaOptions = empresas; },
      error: () => { this.empresaOptions = []; }
    });

    this.svc.getCatalogoFlujosEventos().subscribe({
      next: (flujos) => {
        this.flujoList = flujos || [];
        this.flujoOptions = this.flujoList.map(f => ({ label: `${f.codigo} - ${f.nombre}`, value: f.id }));
        this.isLoadingFlujos = false;
      },
      error: () => {
        this.flujoList = [];
        this.flujoOptions = [];
        this.isLoadingFlujos = false;
      }
    });
  }

  onEmpresaFlujoChange(): void {
    this.flujoUnidadId = null;
    this.flujoSeleccionadoId = null;
    this.pasosFlujo = [];
    this.responsablesPorPaso = {};
    this.unidadFlujoOptions = [];
    this.usuarioOptions = [];

    if (!this.flujoEmpresaId) return;

    this.isLoadingFlujos = true;
    this.isLoadingUsuariosFlujo = true;

    this.svc.getUnidadesFuncionalesEmpresa(this.flujoEmpresaId).subscribe({
      next: (ops) => {
        this.unidadFlujoOptions = ops;
        this.isLoadingFlujos = false;
      },
      error: () => {
        this.unidadFlujoOptions = [];
        this.isLoadingFlujos = false;
      }
    });

    this.svc.getUsuariosPorEmpresa(this.flujoEmpresaId).subscribe({
      next: (ops) => {
        this.usuarioOptions = ops;
        this.isLoadingUsuariosFlujo = false;
      },
      error: () => {
        this.usuarioOptions = [];
        this.isLoadingUsuariosFlujo = false;
      }
    });
  }

  onUnidadFlujoChange(): void {
    this.flujoSeleccionadoId = null;
    this.pasosFlujo = [];
    this.responsablesPorPaso = {};

    if (!this.flujoUnidadId) return;

    this.isLoadingFlujos = true;
    this.svc.getConfiguracionFlujoUnidad(this.flujoUnidadId).subscribe({
      next: (cfg: ConfiguracionFlujoUnidad) => {
        this.flujoSeleccionadoId = cfg.flujo_id;
        this.actualizarPasosPorFlujo();
        const map: Record<number, number | null> = {};
        Object.entries(cfg.responsables || {}).forEach(([idPaso, idUser]) => {
          map[Number(idPaso)] = Number(idUser);
        });
        this.responsablesPorPaso = map;
        this.isLoadingFlujos = false;
      },
      error: () => { this.isLoadingFlujos = false; }
    });
  }

  onFlujoSeleccionadoChange(): void {
    this.actualizarPasosPorFlujo();
    const nextMap: Record<number, number | null> = {};
    this.pasosFlujo.forEach(p => {
      nextMap[p.id] = this.responsablesPorPaso[p.id] ?? null;
    });
    this.responsablesPorPaso = nextMap;
  }

  private actualizarPasosPorFlujo(): void {
    const flujo = this.flujoList.find(f => f.id === this.flujoSeleccionadoId);
    this.pasosFlujo = flujo?.pasos || [];
  }

  guardarFlujoPorUnidad(): void {
    if (!this.flujoUnidadId || !this.flujoSeleccionadoId) {
      this.messageService.add({ severity: 'warn', summary: 'Validación', detail: 'Seleccione unidad funcional y flujo' });
      return;
    }

    const responsables = this.pasosFlujo
      .map(p => ({ id_paso: p.id, id_user: this.responsablesPorPaso[p.id] }))
      .filter(r => !!r.id_user)
      .map(r => ({ id_paso: r.id_paso, id_user: Number(r.id_user) }));

    this.isSavingFlujo = true;
    this.svc.guardarConfiguracionFlujoUnidad({
      unidad_funcional_id: this.flujoUnidadId,
      flujo_id: this.flujoSeleccionadoId,
      responsables,
    }).subscribe({
      next: (res) => {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: res.message || 'Flujo configurado correctamente' });
        this.isSavingFlujo = false;
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo guardar configuración del flujo' });
        this.isSavingFlujo = false;
      }
    });
  }

  // ─── Eliminar ─────────────────────────────────────────────────────────────

  eliminarNovedad(novedad: EventNovedad): void {
    this.confirmationService.confirm({
      message: `¿Eliminar la novedad "${novedad.descripcion}"?`,
      header: 'Confirmar Eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.svc.delete(novedad.id).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Novedad eliminada' });
            this.loadNovedades();
            this.loadCatalogo();
            this.loadVinculaciones();
          },
          error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al eliminar' })
        });
      }
    });
  }
}
