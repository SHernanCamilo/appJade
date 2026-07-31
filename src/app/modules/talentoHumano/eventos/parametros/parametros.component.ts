import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  EventNovedadService,
  EventNovedad,
  EventNovedadCargo,
  FlujoEventoConfig,
  ConfiguracionFlujoUnidad,
  WfGrupoUf
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
import { CheckboxModule } from 'primeng/checkbox';
import { MultiSelectModule } from 'primeng/multiselect';
import { MessageService, ConfirmationService } from 'primeng/api';

@Component({
  selector: 'app-dashboard-eventos',
  standalone: true,
  imports: [
    CommonModule, RouterModule, FormsModule,
    TableModule, ButtonModule, InputTextModule, DialogModule,
    ToastModule, ConfirmDialogModule, TagModule, TooltipModule,
    ToggleButtonModule, SkeletonModule, InputSwitchModule, DropdownModule,
    CheckboxModule, MultiSelectModule
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

  // ─── Flujos por UF o por grupo WF ─────────────────────────────────────────
  flujoPorGrupo = false;
  flujoEmpresaId: number | null = null;
  flujoUnidadId: number | null = null;
  flujoGrupoId: number | null = null;
  flujoGrupoNombre = '';
  flujoGrupoDescripcion = '';
  flujoGrupoUfIds: number[] = [];
  gruposList: WfGrupoUf[] = [];
  flujoSeleccionadoId: number | null = null;
  flujoOptions: { label: string; value: number }[] = [];
  flujoList: FlujoEventoConfig[] = [];
  unidadFlujoOptions: { label: string; value: number }[] = [];
  usuarioOptions: { label: string; value: number }[] = [];
  pasosFlujo: FlujoEventoConfig['pasos'] = [];
  responsablesPorPaso: Record<number, number[]> = {};
  isLoadingFlujos = false;
  isLoadingUsuariosFlujo = false;
  isSavingFlujo = false;
  showModalGrupos = false;
  modalGrupoSearchTerm = '';
  isLoadingModalGrupos = false;

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
    if (tab === 'flujos') {
      if (this.empresaOptions.length === 0) {
        this.cargarCatalogosFlujos();
      }
      if (this.flujoEmpresaId) {
        this.cargarUsuariosFlujoEmpresa();
      }
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

  // ─── Flujos por UF o grupo WF ─────────────────────────────────────────────

  get puedeConfigurarFlujo(): boolean {
    if (!this.flujoEmpresaId) return false;
    if (this.flujoPorGrupo) {
      return !!(this.flujoGrupoId || this.flujoGrupoNombre.trim());
    }
    return !!this.flujoUnidadId;
  }

  get puedeGestionarUnidadesGrupo(): boolean {
    return !!this.flujoEmpresaId && this.flujoPorGrupo;
  }

  get gruposModalFiltrados(): WfGrupoUf[] {
    const term = this.modalGrupoSearchTerm.trim().toLowerCase();
    if (!term) return this.gruposList;
    return this.gruposList.filter(g =>
      g.nombre?.toLowerCase().includes(term)
    );
  }

  get unidadesGrupoSeleccionadas(): { id: number; codigo: string; nombre: string }[] {
    return this.unidadFlujoOptions
      .filter(u => this.flujoGrupoUfIds.includes(u.value))
      .map(u => {
        const parts = u.label.split(' - ');
        return { id: u.value, codigo: parts[0] || '', nombre: parts.slice(1).join(' - ') || u.label };
      });
  }

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

  onModoFlujoChange(): void {
    this.flujoUnidadId = null;
    this.flujoGrupoId = null;
    this.flujoGrupoNombre = '';
    this.flujoGrupoDescripcion = '';
    this.flujoGrupoUfIds = [];
    this.flujoSeleccionadoId = null;
    this.pasosFlujo = [];
    this.responsablesPorPaso = {};

    if (this.flujoEmpresaId) {
      if (this.flujoPorGrupo) {
        this.cargarGruposEmpresa();
      }
    }
  }

  onEmpresaFlujoChange(): void {
    this.flujoUnidadId = null;
    this.flujoGrupoId = null;
    this.flujoGrupoNombre = '';
    this.flujoGrupoDescripcion = '';
    this.flujoGrupoUfIds = [];
    this.flujoSeleccionadoId = null;
    this.pasosFlujo = [];
    this.responsablesPorPaso = {};
    this.unidadFlujoOptions = [];
    this.gruposList = [];
    this.usuarioOptions = [];

    if (!this.flujoEmpresaId) return;

    this.isLoadingFlujos = true;

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

    if (this.flujoPorGrupo) {
      this.cargarGruposEmpresa();
    }

    this.cargarUsuariosFlujoEmpresa();
  }

  cargarUsuariosFlujoEmpresa(): void {
    if (!this.flujoEmpresaId) {
      this.usuarioOptions = [];
      return;
    }

    this.isLoadingUsuariosFlujo = true;
    this.svc.getUsuariosPorEmpresa(this.flujoEmpresaId).subscribe({
      next: (ops) => {
        this.usuarioOptions = ops;
        this.isLoadingUsuariosFlujo = false;
      },
      error: () => {
        this.usuarioOptions = [];
        this.isLoadingUsuariosFlujo = false;
        this.messageService.add({
          severity: 'warn',
          summary: 'Usuarios',
          detail: 'No se pudieron cargar los usuarios de la empresa seleccionada',
        });
      }
    });
  }

  cargarGruposEmpresa(): void {
    if (!this.flujoEmpresaId) return;
    this.isLoadingModalGrupos = true;
    this.svc.getGruposWf(this.flujoEmpresaId).subscribe({
      next: (grupos) => {
        this.gruposList = grupos;
        this.isLoadingModalGrupos = false;
      },
      error: () => {
        this.gruposList = [];
        this.isLoadingModalGrupos = false;
      }
    });
  }

  nuevoGrupoFlujo(): void {
    this.flujoGrupoId = null;
    this.flujoGrupoNombre = '';
    this.flujoGrupoDescripcion = '';
    this.flujoGrupoUfIds = [];
    this.flujoSeleccionadoId = null;
    this.pasosFlujo = [];
    this.responsablesPorPaso = {};
  }

  abrirModalGrupos(): void {
    if (!this.flujoEmpresaId) return;
    this.modalGrupoSearchTerm = '';
    this.showModalGrupos = true;
    this.cargarGruposEmpresa();
  }

  cerrarModalGrupos(): void {
    this.showModalGrupos = false;
    this.modalGrupoSearchTerm = '';
  }

  seleccionarGrupoDesdeModal(grupo: WfGrupoUf): void {
    this.cargarDetalleGrupo(grupo.id);
    this.cerrarModalGrupos();
  }

  buscarGrupoPorNombre(): void {
    if (!this.flujoGrupoNombre.trim() || !this.flujoEmpresaId) return;
    this.cargarGrupoPorNombre(this.flujoGrupoNombre.trim());
  }

  private cargarGrupoPorNombre(nombre: string): void {
    const normalizar = (v: string) => v.trim().toLowerCase();
    const grupo = this.gruposList.find(g => normalizar(g.nombre) === normalizar(nombre));
    if (grupo) {
      this.cargarDetalleGrupo(grupo.id);
      return;
    }

    this.isLoadingFlujos = true;
    this.svc.getGruposWf(this.flujoEmpresaId!).subscribe({
      next: (grupos) => {
        this.gruposList = grupos;
        const found = grupos.find(g => normalizar(g.nombre) === normalizar(nombre));
        if (found) {
          this.cargarDetalleGrupo(found.id);
        } else {
          this.flujoGrupoId = null;
          this.flujoGrupoDescripcion = '';
          this.flujoGrupoUfIds = [];
          this.flujoSeleccionadoId = null;
          this.pasosFlujo = [];
          this.responsablesPorPaso = {};
          this.isLoadingFlujos = false;
        }
      },
      error: () => { this.isLoadingFlujos = false; }
    });
  }

  cargarDetalleGrupo(grupoId: number): void {
    this.isLoadingFlujos = true;
    this.svc.getGrupoWf(grupoId).subscribe({
      next: (detalle) => {
        const grupo = detalle.grupo;
        this.flujoGrupoId = grupo.id;
        this.flujoGrupoNombre = grupo.nombre;
        this.flujoGrupoDescripcion = grupo.descripcion || '';
        this.flujoGrupoUfIds = (grupo.unidades_funcionales || []).map(u => u.id);
        this.flujoSeleccionadoId = detalle.flujo_id;
        this.actualizarPasosPorFlujo();

        const map: Record<number, number[]> = {};
        (detalle.pasos || []).forEach(p => {
          map[p.id] = (p.aprobadores || []).map(id => Number(id));
        });
        this.responsablesPorPaso = map;
        this.isLoadingFlujos = false;
      },
      error: () => { this.isLoadingFlujos = false; }
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
        const map: Record<number, number[]> = {};
        Object.entries(cfg.responsables || {}).forEach(([idPaso, ids]) => {
          const lista = Array.isArray(ids) ? ids : [ids];
          map[Number(idPaso)] = lista.map(id => Number(id)).filter(id => !isNaN(id));
        });
        this.responsablesPorPaso = map;
        this.isLoadingFlujos = false;
      },
      error: () => { this.isLoadingFlujos = false; }
    });
  }

  onFlujoSeleccionadoChange(): void {
    this.actualizarPasosPorFlujo();
    const nextMap: Record<number, number[]> = {};
    this.pasosFlujo.forEach(p => {
      nextMap[p.id] = this.responsablesPorPaso[p.id] ?? [];
    });
    this.responsablesPorPaso = nextMap;
  }

  private construirResponsablesPayload(): { id_paso: number; id_user: number }[] {
    return this.pasosFlujo.flatMap(p =>
      (this.responsablesPorPaso[p.id] || []).map(id_user => ({
        id_paso: p.id,
        id_user: Number(id_user),
      }))
    );
  }

  private actualizarPasosPorFlujo(): void {
    const flujo = this.flujoList.find(f => f.id === this.flujoSeleccionadoId);
    this.pasosFlujo = flujo?.pasos || [];
    this.pasosFlujo.forEach(p => {
      if (!Array.isArray(this.responsablesPorPaso[p.id])) {
        this.responsablesPorPaso[p.id] = [];
      }
    });
  }

  quitarUnidadGrupo(ufId: number): void {
    this.flujoGrupoUfIds = this.flujoGrupoUfIds.filter(id => id !== ufId);
  }

  guardarFlujo(): void {
    if (!this.flujoEmpresaId || !this.flujoSeleccionadoId) {
      this.messageService.add({ severity: 'warn', summary: 'Validación', detail: 'Seleccione empresa y flujo' });
      return;
    }

    const responsables = this.construirResponsablesPayload();

    this.isSavingFlujo = true;

    if (this.flujoPorGrupo) {
      this.guardarFlujoPorGrupo(responsables);
    } else {
      this.guardarFlujoPorUnidad(responsables);
    }
  }

  private guardarFlujoPorUnidad(responsables: { id_paso: number; id_user: number }[]): void {
    if (!this.flujoUnidadId) {
      this.messageService.add({ severity: 'warn', summary: 'Validación', detail: 'Seleccione una unidad funcional' });
      this.isSavingFlujo = false;
      return;
    }

    this.svc.guardarConfiguracionFlujoUnidad({
      unidad_funcional_id: this.flujoUnidadId,
      flujo_id: this.flujoSeleccionadoId!,
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

  private guardarFlujoPorGrupo(responsables: { id_paso: number; id_user: number }[]): void {
    if (!this.flujoGrupoNombre.trim()) {
      this.messageService.add({ severity: 'warn', summary: 'Validación', detail: 'Ingrese el nombre del grupo' });
      this.isSavingFlujo = false;
      return;
    }
    if (this.flujoGrupoUfIds.length === 0) {
      this.messageService.add({ severity: 'warn', summary: 'Validación', detail: 'Seleccione al menos una unidad funcional para el grupo' });
      this.isSavingFlujo = false;
      return;
    }

    const asignarFlujo = (grupoId: number) => {
      this.svc.asignarFlujoGrupoWf(grupoId, {
        flujo_id: this.flujoSeleccionadoId!,
        aprobadores: responsables,
      }).subscribe({
        next: (res) => {
          this.messageService.add({ severity: 'success', summary: 'Éxito', detail: res.message || 'Flujo asignado al grupo correctamente' });
          this.flujoGrupoId = grupoId;
          this.isSavingFlujo = false;
          this.cargarGruposEmpresa();
        },
        error: (err) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo asignar el flujo al grupo' });
          this.isSavingFlujo = false;
        }
      });
    };

    if (this.flujoGrupoId) {
      this.svc.actualizarGrupoWf(this.flujoGrupoId, {
        nombre: this.flujoGrupoNombre.trim(),
        descripcion: this.flujoGrupoDescripcion.trim() || undefined,
        id_empresa: this.flujoEmpresaId,
        unidades_funcionales: this.flujoGrupoUfIds,
      }).subscribe({
        next: () => asignarFlujo(this.flujoGrupoId!),
        error: (err) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo actualizar el grupo' });
          this.isSavingFlujo = false;
        }
      });
      return;
    }

    this.svc.crearGrupoWf({
      nombre: this.flujoGrupoNombre.trim(),
      descripcion: this.flujoGrupoDescripcion.trim() || undefined,
      id_empresa: this.flujoEmpresaId,
      unidades_funcionales: this.flujoGrupoUfIds,
    }).subscribe({
      next: (grupo) => asignarFlujo(grupo.id),
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'No se pudo crear el grupo' });
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
