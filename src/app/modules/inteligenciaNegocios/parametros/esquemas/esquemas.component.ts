import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';
import { MultiSelectModule } from 'primeng/multiselect';
import { TabViewModule } from 'primeng/tabview';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageService, ConfirmationService } from 'primeng/api';
import { DataTableComponent } from '../../../../complements/shared/data-table/data-table.component';
import { TableColumn } from '../../../../complements/shared/data-table/table-column.model';
import { ContextoService, Empresa as EmpresaContexto } from '../../../../core/services/contexto.service';
import { environment } from '../../../../environments/environment';
import {
  BiGrupo,
  BiGrupoPayload,
  BiGrupoService,
  BiDelegacionVista,
  BiVista,
  BiVistaEstado,
  BiVistaService,
  FabricCatalogView
} from './services/bi-grupo.service';

@Component({
  selector: 'app-esquemas-bi',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    DropdownModule,
    InputTextModule,
    ToastModule,
    ConfirmDialogModule,
    TagModule,
    TooltipModule,
    TableModule,
    MultiSelectModule,
    TabViewModule,
    CheckboxModule,
    DataTableComponent
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './esquemas.component.html',
  styleUrl: './esquemas.component.css'
})
export class EsquemasComponent implements OnInit {
  esquemaForm!: FormGroup;

  empresasOptions: { label: string; value: number }[] = [];
  esTransversal = true;
  empresaNombre = '';

  editMode = false;
  currentGrupoId: number | null = null;
  esquemaListoParaVistas = false;

  isLoadingEmpresas = false;
  isSearching = false;
  isSaving = false;
  isLoadingModal = false;
  isLoadingFabric = false;
  isSyncingFabric = false;
  isAddingVistas = false;

  showModalEsquemas = false;
  esquemasModal: BiGrupo[] = [];
  modalColumns: TableColumn[] = [];

  vistas: BiVista[] = [];
  fabricOptions: { label: string; value: string }[] = [];
  fabricCatalog: FabricCatalogView[] = [];
  selectedFabricViews: string[] = [];
  departamentosOptions: { label: string; value: string }[] = [];
  savingVistaId: number | null = null;

  activeTabIndex = 0;
  delegacionEmpresasOptions: { label: string; value: number }[] = [];
  delegacionEmpresaId: number | null = null;
  delegacionVistas: BiDelegacionVista[] = [];
  delegacionTieneConfig = false;
  isLoadingDelegacion = false;
  isSavingDelegacion = false;

  delegacionModo: 'empresa' | 'usuario' = 'empresa';
  delegacionUsuarioId: number | null = null;
  delegacionUsuariosOptions: { label: string; value: number }[] = [];
  delegacionUsuarioVistas: BiDelegacionVista[] = [];
  delegacionUsuarioTieneConfig = false;
  delegacionEmpresaTienePool = false;
  isLoadingDelegacionUsuario = false;
  isSavingDelegacionUsuario = false;
  isLoadingUsuariosEmpresa = false;

  tipoOptions = [
    { label: 'Asistencial', value: 1 },
    { label: 'Financiero', value: 2 },
    { label: 'Administrativo', value: 3 }
  ];

  estadoOptions: { label: string; value: BiVista['estado'] }[] = [
    { label: 'Activo', value: 'activo' },
    { label: 'Inactivo', value: 'inactivo' },
    { label: 'Mantenimiento', value: 'mantenimiento' }
  ];

  constructor(
    private fb: FormBuilder,
    private biGrupoService: BiGrupoService,
    private biVistaService: BiVistaService,
    private contextoService: ContextoService,
    private http: HttpClient,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    this.buildModalColumns();
    this.loadEmpresasDisponibles();
    this.loadDepartamentosCatalogo();
    this.loadDelegacionEmpresas();
  }

  private loadDelegacionEmpresas(): void {
    this.http.get<{ success: boolean; data: { nombre: string; id: number }[] }>(
      `${environment.URL_SERVICIOS}/empresas-activas`
    ).subscribe({
      next: (response) => {
        this.delegacionEmpresasOptions = (response.data || []).map(e => ({
          label: e.nombre,
          value: e.id
        }));
      },
      error: () => {
        this.delegacionEmpresasOptions = [...this.empresasOptions];
      }
    });
  }

  onTabChange(index: number): void {
    this.activeTabIndex = index;
    if (index !== 1 || !this.puedeGestionarVistas) {
      return;
    }
    if (this.delegacionModo === 'usuario' && this.esquemaEmpresaId) {
      this.delegacionEmpresaId = this.esquemaEmpresaId;
      this.delegacionEmpresaTienePool = true;
      this.cargarUsuariosEmpresa();
      if (this.delegacionUsuarioId) {
        this.cargarDelegacionUsuario();
      }
      return;
    }
    if (this.delegacionEmpresaId) {
      this.cargarDelegacion();
    }
  }

  private loadDepartamentosCatalogo(): void {
    this.biVistaService.getDepartamentosCatalogo().subscribe({
      next: (items) => {
        this.departamentosOptions = items.map(d => ({
          label: d.nombre,
          value: d.codigo
        }));
      },
      error: () => {
        this.departamentosOptions = [
          { label: 'Materno (MA)', value: 'MA' },
          { label: 'Nacional (NAL)', value: 'NAL' },
          { label: 'Florencia (FLA)', value: 'FLA' },
          { label: 'Neiva (NVA)', value: 'NVA' }
        ];
      }
    });
  }

  private initForm(): void {
    this.esquemaForm = this.fb.group({
      empresa_id: [null, Validators.required],
      codigo: [{ value: '', disabled: true }, [Validators.required, Validators.maxLength(20)]],
      tipo: [null, Validators.required],
      descripcion: ['', Validators.maxLength(255)]
    });
  }

  private buildModalColumns(): void {
    this.modalColumns = [
      { field: 'codigo', header: 'Código', sortable: true, filter: true, filterType: 'text' },
      { field: 'descripcion', header: 'Descripción', sortable: true, filter: true, filterType: 'text' },
      { field: 'tipo', header: 'Tipo', sortable: true, filter: true, filterType: 'select', filterOptions: this.tipoOptions }
    ];
  }

  get empresaSeleccionada(): boolean {
    return !!this.esquemaForm.get('empresa_id')?.value;
  }

  get puedeGestionarVistas(): boolean {
    return this.esquemaListoParaVistas && !!this.currentGrupoId;
  }

  get schemaActual(): string {
    return String(this.esquemaForm.get('codigo')?.value || '').trim().toLowerCase();
  }

  get esquemaEmpresaId(): number | null {
    const value = this.esquemaForm.get('empresa_id')?.value;
    return value != null ? Number(value) : null;
  }

  get esquemaEmpresaNombre(): string {
    if (this.empresaNombre) {
      return this.empresaNombre;
    }
    const id = this.esquemaEmpresaId;
    return this.delegacionEmpresasOptions.find(o => o.value === id)?.label ?? '';
  }

  /** Por empresa: solo empresas externas. Por usuario: usa la empresa del esquema. */
  get delegacionEmpresasOptionsFiltradas(): { label: string; value: number }[] {
    const ownerId = this.esquemaEmpresaId;
    if (this.delegacionModo === 'empresa' && ownerId) {
      return this.delegacionEmpresasOptions.filter(o => o.value !== ownerId);
    }
    return this.delegacionEmpresasOptions;
  }

  get esDelegacionUsuariosInterna(): boolean {
    return this.delegacionModo === 'usuario' && !!this.esquemaEmpresaId;
  }

  get delegacionSeleccionadas(): number {
    return this.delegacionVistas.filter(v => v.delegada).length;
  }

  get delegacionUsuarioSeleccionadas(): number {
    return this.delegacionUsuarioVistas.filter(v => v.delegada).length;
  }

  get puedeGestionarDelegacion(): boolean {
    return this.puedeGestionarVistas && !!this.delegacionEmpresaId;
  }

  get puedeGestionarDelegacionUsuario(): boolean {
    if (!this.puedeGestionarVistas || !this.delegacionUsuarioId) {
      return false;
    }
    if (this.esDelegacionUsuariosInterna) {
      return true;
    }
    return !!this.delegacionEmpresaId && this.delegacionEmpresaTienePool;
  }

  get fabricOptionsDisponibles(): { label: string; value: string }[] {
    const asignadas = new Set(this.vistas.map(v => v.nombre));
    return this.fabricOptions.filter(o => !asignadas.has(o.value));
  }

  loadEmpresasDisponibles(): void {
    this.isLoadingEmpresas = true;
    this.contextoService.obtenerEmpresasDisponibles().subscribe({
      next: (empresas: EmpresaContexto[]) => {
        if (empresas.length === 0) {
          this.esTransversal = true;
          this.http.get<{ success: boolean; data: { nombre: string; id: number }[] }>(
            `${environment.URL_SERVICIOS}/empresas-activas`
          ).subscribe({
            next: (response) => {
              this.empresasOptions = (response.data || []).map(e => ({
                label: e.nombre,
                value: e.id
              }));
              this.isLoadingEmpresas = false;
            },
            error: () => {
              this.isLoadingEmpresas = false;
              this.showError('Error al cargar las empresas');
            }
          });
        } else if (empresas.length === 1) {
          this.esTransversal = false;
          this.establecerEmpresa(empresas[0].id, empresas[0].nombre);
          this.isLoadingEmpresas = false;
        } else {
          this.esTransversal = true;
          this.empresasOptions = empresas.map(e => ({
            label: e.nombre,
            value: e.id
          }));
          this.isLoadingEmpresas = false;
        }
      },
      error: () => {
        this.isLoadingEmpresas = false;
        this.showError('No se pudieron cargar las empresas');
      }
    });
  }

  onEmpresaChange(): void {
    const empresaId = this.esquemaForm.get('empresa_id')?.value;
    if (empresaId) {
      const empresa = this.empresasOptions.find(e => e.value === empresaId);
      this.empresaNombre = empresa?.label ?? '';
    } else {
      this.empresaNombre = '';
    }
    this.limpiarContextoVistas();
    this.actualizarEstadoCodigo();
  }

  private establecerEmpresa(empresaId: number, nombre: string): void {
    this.esquemaForm.patchValue({ empresa_id: empresaId });
    this.empresaNombre = nombre;
    this.actualizarEstadoCodigo();
  }

  private actualizarEstadoCodigo(): void {
    const codigoCtrl = this.esquemaForm.get('codigo');
    if (this.empresaSeleccionada) {
      codigoCtrl?.enable({ emitEvent: false });
    } else {
      codigoCtrl?.disable({ emitEvent: false });
    }
  }

  nuevoEsquema(): void {
    const empresaId = this.esquemaForm.get('empresa_id')?.value;
    this.editMode = false;
    this.currentGrupoId = null;
    this.limpiarContextoVistas();

    this.esquemaForm.reset();
    this.esquemaForm.patchValue({ empresa_id: empresaId ?? null });
    this.actualizarEstadoCodigo();
  }

  buscarPorCodigo(): void {
    if (!this.empresaSeleccionada) {
      this.showWarn('Seleccione primero una empresa');
      return;
    }

    const codigo = String(this.esquemaForm.get('codigo')?.value || '').trim();
    if (!codigo) {
      this.showWarn('Ingrese un código para buscar');
      return;
    }

    const empresaId = Number(this.esquemaForm.get('empresa_id')?.value);
    this.isSearching = true;

    this.biGrupoService.buscarPorCodigo(codigo, empresaId).subscribe({
      next: (grupo) => {
        this.isSearching = false;
        if (grupo) {
          this.cargarEsquema(grupo);
          this.showSuccess('Esquema encontrado');
        } else {
          this.prepararNuevoRegistro(codigo);
          this.showInfo('No se encontró el esquema. Puede crear un nuevo registro.');
        }
      },
      error: () => {
        this.isSearching = false;
        this.showWarn('No se pudo buscar el código');
      }
    });
  }

  abrirModalEsquemas(): void {
    if (!this.empresaSeleccionada) {
      this.showWarn('Seleccione primero una empresa');
      return;
    }

    const empresaId = Number(this.esquemaForm.get('empresa_id')?.value);
    this.showModalEsquemas = true;
    this.isLoadingModal = true;
    this.esquemasModal = [];

    this.biGrupoService.getGrupos({ empresa_id: empresaId }).subscribe({
      next: (grupos) => {
        this.esquemasModal = grupos;
        this.isLoadingModal = false;
      },
      error: () => {
        this.isLoadingModal = false;
        this.showError('Error al cargar esquemas de la empresa');
      }
    });
  }

  cerrarModalEsquemas(): void {
    this.showModalEsquemas = false;
  }

  seleccionarDesdeModal(grupo: BiGrupo): void {
    this.biGrupoService.getGrupo(grupo.id).subscribe({
      next: (detalle) => {
        this.cargarEsquema(detalle);
        this.cerrarModalEsquemas();
      },
      error: () => {
        this.cargarEsquema(grupo);
        this.cerrarModalEsquemas();
      }
    });
  }

  private cargarEsquema(grupo: BiGrupo): void {
    this.editMode = true;
    this.currentGrupoId = grupo.id;

    this.esquemaForm.patchValue({
      empresa_id: grupo.empresa_id,
      codigo: grupo.codigo,
      tipo: grupo.tipo,
      descripcion: grupo.descripcion ?? ''
    });

    if (!this.esTransversal && grupo.empresa) {
      this.empresaNombre = grupo.empresa.nombre;
    }

    this.actualizarEstadoCodigo();
    this.vistas = [...(grupo.vistas ?? [])];
    this.esquemaListoParaVistas = true;
    this.selectedFabricViews = [];
    this.cargarCatalogoFabric(false);
  }

  private prepararNuevoRegistro(codigo: string): void {
    this.editMode = false;
    this.currentGrupoId = null;
    this.limpiarContextoVistas();
    this.esquemaForm.patchValue({ codigo: codigo.toUpperCase() });
  }

  private limpiarContextoVistas(): void {
    this.esquemaListoParaVistas = false;
    this.vistas = [];
    this.fabricOptions = [];
    this.fabricCatalog = [];
    this.selectedFabricViews = [];
    this.delegacionVistas = [];
    this.delegacionEmpresaId = null;
    this.delegacionTieneConfig = false;
    this.delegacionUsuarioId = null;
    this.delegacionUsuariosOptions = [];
    this.delegacionUsuarioVistas = [];
    this.delegacionUsuarioTieneConfig = false;
    this.delegacionEmpresaTienePool = false;
    this.delegacionModo = 'empresa';
  }

  guardar(): void {
    if (this.esquemaForm.invalid) {
      this.esquemaForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    const payload: BiGrupoPayload = {
      empresa_id: Number(this.esquemaForm.get('empresa_id')?.value),
      codigo: String(this.esquemaForm.get('codigo')?.value).trim().toUpperCase(),
      tipo: Number(this.esquemaForm.get('tipo')?.value) as 1 | 2 | 3,
      descripcion: this.esquemaForm.get('descripcion')?.value?.trim() || null
    };

    const request$ = this.editMode && this.currentGrupoId
      ? this.biGrupoService.updateGrupo(this.currentGrupoId, payload)
      : this.biGrupoService.createGrupo(payload);

    request$.subscribe({
      next: (grupo) => {
        this.isSaving = false;
        const fueCreacion = !this.editMode;
        this.editMode = true;
        this.currentGrupoId = grupo.id;
        this.esquemaListoParaVistas = true;
        this.vistas = grupo.vistas ?? this.vistas;
        this.showSuccess(fueCreacion ? 'Esquema creado' : 'Esquema actualizado');
        this.cargarCatalogoFabric(false);
      },
      error: (err) => {
        this.isSaving = false;
        this.showError(err?.error?.message || 'Error al guardar el esquema');
      }
    });
  }

  cargarCatalogoFabric(refresh = false): void {
    if (!this.schemaActual) {
      return;
    }

    this.isLoadingFabric = true;
    this.biGrupoService.getCatalogoFabric(this.schemaActual, refresh).subscribe({
      next: (views) => {
        this.fabricCatalog = views;
        this.fabricOptions = views.map(v => ({
          label: v.view_name,
          value: v.view_name
        }));
        this.isLoadingFabric = false;
      },
      error: () => {
        this.fabricOptions = [];
        this.fabricCatalog = [];
        this.isLoadingFabric = false;
        this.showWarn('No se pudo cargar el catálogo Fabric para este esquema');
      }
    });
  }

  actualizarVistasDesdeFabric(): void {
    if (!this.puedeGestionarVistas || !this.currentGrupoId) {
      this.showWarn('Guarde el esquema antes de sincronizar vistas');
      return;
    }

    this.isSyncingFabric = true;
    this.biGrupoService.sincronizarVistasFabric(this.currentGrupoId).subscribe({
      next: (response) => {
        this.vistas = response.data.vistas ?? [];
        this.selectedFabricViews = [];
        this.cargarCatalogoFabric(true);
        this.isSyncingFabric = false;
        this.showSuccess(response.message || 'Vistas sincronizadas desde Fabric');
      },
      error: (err) => {
        this.isSyncingFabric = false;
        this.showError(err?.error?.message || 'Error al sincronizar vistas desde Fabric');
      }
    });
  }

  agregarVistas(): void {
    if (!this.puedeGestionarVistas || !this.currentGrupoId) {
      this.showWarn('Guarde el esquema antes de asignar vistas');
      return;
    }

    const seleccionadas = this.selectedFabricViews ?? [];
    if (!seleccionadas.length) {
      this.showWarn('Seleccione al menos una vista de Fabric');
      return;
    }

    this.isAddingVistas = true;
    const payload = seleccionadas.map(nombre => ({
      nombre,
      descripcion: this.fabricCatalog.find(v => v.view_name === nombre)?.qualified_name ?? null
    }));

    this.biVistaService.addVistas(this.currentGrupoId, payload).subscribe({
      next: (creadas) => {
        const mapa = new Map(this.vistas.map(v => [v.nombre, v]));
        creadas.forEach(v => mapa.set(v.nombre, v));
        this.vistas = Array.from(mapa.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
        this.selectedFabricViews = [];
        this.isAddingVistas = false;
        this.showSuccess(`${creadas.length} vista(s) agregada(s)`);
      },
      error: (err) => {
        this.isAddingVistas = false;
        this.showError(err?.error?.message || 'Error al agregar vistas');
      }
    });
  }

  eliminarVista(vista: BiVista): void {
    this.confirmationService.confirm({
      message: `¿Eliminar la vista ${vista.nombre}?`,
      header: 'Confirmar',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.biVistaService.deleteVista(vista.id).subscribe({
          next: () => {
            this.vistas = this.vistas.filter(v => v.id !== vista.id);
            this.showSuccess('Vista eliminada');
          },
          error: (err) => {
            this.showError(err?.error?.message || 'Error al eliminar la vista');
          }
        });
      }
    });
  }

  onDescripcionChange(vista: BiVista, descripcion: string): void {
    if (!this.puedeGestionarVistas) {
      return;
    }

    const valor = descripcion.trim() || null;
    if ((vista.descripcion ?? null) === valor) {
      return;
    }

    this.savingVistaId = vista.id;
    this.biVistaService.updateVista(vista.id, { descripcion: valor }).subscribe({
      next: (actualizada) => {
        this.vistas = this.vistas.map(v => v.id === actualizada.id ? actualizada : v);
        this.savingVistaId = null;
        this.showSuccess('Descripción actualizada');
      },
      error: (err) => {
        this.savingVistaId = null;
        this.showError(err?.error?.message || 'Error al guardar la descripción');
      }
    });
  }

  onDepartamentosChange(vista: BiVista, departamentos: string[] | null): void {
    if (!this.puedeGestionarVistas) {
      return;
    }

    this.savingVistaId = vista.id;
    const normalizados = (departamentos ?? []).length ? departamentos : null;

    this.biVistaService.updateVista(vista.id, { departamentos: normalizados }).subscribe({
      next: (actualizada) => {
        this.vistas = this.vistas.map(v => v.id === actualizada.id ? actualizada : v);
        this.savingVistaId = null;
        this.showSuccess('Departamentos actualizados');
      },
      error: (err) => {
        this.savingVistaId = null;
        this.showError(err?.error?.message || 'Error al guardar departamentos');
      }
    });
  }

  onEstadoChange(vista: BiVista, estado: BiVistaEstado): void {
    if (!this.puedeGestionarVistas) {
      return;
    }

    const actual = vista.estado ?? 'activo';
    if (actual === estado) {
      return;
    }

    this.savingVistaId = vista.id;
    this.biVistaService.updateVista(vista.id, { estado }).subscribe({
      next: (actualizada) => {
        this.vistas = this.vistas.map(v => v.id === actualizada.id ? actualizada : v);
        this.savingVistaId = null;
        this.showSuccess(`Estado actualizado: ${this.getEstadoLabel(actualizada.estado ?? 'activo')}`);
      },
      error: (err) => {
        this.savingVistaId = null;
        this.showError(err?.error?.message || 'Error al actualizar el estado');
      }
    });
  }

  getDepartamentosLabel(vista: BiVista): string {
    if (!vista.departamentos?.length) {
      return 'Todos';
    }
    return vista.departamentos.join(', ');
  }

  getEstadoLabel(estado: BiVistaEstado): string {
    return this.estadoOptions.find(o => o.value === estado)?.label ?? estado;
  }

  getEstadoSeverity(estado: BiVistaEstado): 'success' | 'warn' | 'danger' | 'secondary' {
    switch (estado) {
      case 'activo': return 'success';
      case 'mantenimiento': return 'warn';
      case 'inactivo': return 'danger';
      default: return 'secondary';
    }
  }

  onDelegacionEmpresaChange(): void {
    this.delegacionUsuarioId = null;
    this.delegacionUsuariosOptions = [];
    this.delegacionUsuarioVistas = [];
    this.delegacionUsuarioTieneConfig = false;
    this.delegacionEmpresaTienePool = false;

    if (!this.delegacionEmpresaId || !this.currentGrupoId) {
      this.delegacionVistas = [];
      return;
    }

    this.cargarUsuariosEmpresa();
    if (this.delegacionModo === 'empresa') {
      this.cargarDelegacion();
    }
  }

  setDelegacionModo(modo: 'empresa' | 'usuario'): void {
    this.delegacionModo = modo;

    if (modo === 'usuario') {
      this.delegacionEmpresaId = this.esquemaEmpresaId;
      this.delegacionUsuarioId = null;
      this.delegacionUsuarioVistas = [];
      this.delegacionUsuarioTieneConfig = false;

      if (this.esquemaEmpresaId) {
        this.delegacionEmpresaTienePool = true;
        this.cargarUsuariosEmpresa();
      }
      return;
    }

    this.delegacionEmpresaId = null;
    this.delegacionUsuarioId = null;
    this.delegacionUsuarioVistas = [];
    this.delegacionVistas = [];
  }

  onDelegacionUsuarioChange(): void {
    if (!this.delegacionUsuarioId) {
      this.delegacionUsuarioVistas = [];
      return;
    }
    this.cargarDelegacionUsuario();
  }

  private cargarUsuariosEmpresa(): void {
    const empresaId = this.esDelegacionUsuariosInterna
      ? this.esquemaEmpresaId
      : this.delegacionEmpresaId;

    if (!empresaId) {
      return;
    }

    this.isLoadingUsuariosEmpresa = true;
    this.http.get<{ id: number; name: string; email: string }[]>(
      `${environment.URL_SERVICIOS}/users-por-empresa/${empresaId}`
    ).subscribe({
      next: (users) => {
        this.delegacionUsuariosOptions = (users ?? []).map(u => ({
          label: `${u.name} (${u.email})`,
          value: u.id
        }));
        this.isLoadingUsuariosEmpresa = false;
      },
      error: () => {
        this.delegacionUsuariosOptions = [];
        this.isLoadingUsuariosEmpresa = false;
      }
    });
  }

  cargarDelegacion(): void {
    if (!this.currentGrupoId || !this.delegacionEmpresaId) {
      return;
    }

    this.isLoadingDelegacion = true;
    this.biGrupoService.getDelegaciones(this.currentGrupoId, this.delegacionEmpresaId).subscribe({
      next: (data) => {
        this.delegacionVistas = data.vistas ?? [];
        this.delegacionTieneConfig = data.tiene_config;
        this.delegacionEmpresaTienePool = data.tiene_config;
        this.isLoadingDelegacion = false;
      },
      error: (err) => {
        this.delegacionVistas = [];
        this.isLoadingDelegacion = false;
        this.showError(err?.error?.message || 'Error al cargar delegaci\u00f3n');
      }
    });
  }

  toggleDelegacionVista(vista: BiDelegacionVista, delegada: boolean): void {
    vista.delegada = delegada;
  }

  seleccionarTodasDelegacion(seleccionar: boolean): void {
    this.delegacionVistas.forEach(v => { v.delegada = seleccionar; });
  }

  guardarDelegacion(): void {
    if (!this.currentGrupoId || !this.delegacionEmpresaId) {
      return;
    }

    const vistaIds = this.delegacionVistas.filter(v => v.delegada).map(v => v.id);
    this.isSavingDelegacion = true;

    this.biGrupoService.saveDelegaciones(this.currentGrupoId, this.delegacionEmpresaId, vistaIds).subscribe({
      next: () => {
        this.delegacionTieneConfig = vistaIds.length > 0;
        this.delegacionEmpresaTienePool = vistaIds.length > 0;
        this.isSavingDelegacion = false;
        this.showSuccess('Delegaci\u00f3n por empresa guardada correctamente');
        if (this.delegacionModo === 'usuario' && this.delegacionUsuarioId) {
          this.cargarDelegacionUsuario();
        }
      },
      error: (err) => {
        this.isSavingDelegacion = false;
        this.showError(err?.error?.message || 'Error al guardar delegaci\u00f3n');
      }
    });
  }

  cargarDelegacionUsuario(): void {
    const empresaId = this.esDelegacionUsuariosInterna
      ? this.esquemaEmpresaId
      : this.delegacionEmpresaId;

    if (!this.currentGrupoId || !empresaId || !this.delegacionUsuarioId) {
      return;
    }

    this.isLoadingDelegacionUsuario = true;
    this.biGrupoService.getDelegacionUsuario(
      this.currentGrupoId,
      empresaId,
      this.delegacionUsuarioId
    ).subscribe({
      next: (data) => {
        this.delegacionUsuarioVistas = data.vistas ?? [];
        this.delegacionUsuarioTieneConfig = data.tiene_config;
        this.delegacionEmpresaTienePool = data.empresa_tiene_config || !!data.es_misma_empresa;
        this.isLoadingDelegacionUsuario = false;
      },
      error: (err) => {
        this.delegacionUsuarioVistas = [];
        this.isLoadingDelegacionUsuario = false;
        this.showError(err?.error?.message || 'Error al cargar delegaci\u00f3n por usuario');
      }
    });
  }

  toggleDelegacionUsuarioVista(vista: BiDelegacionVista, delegada: boolean): void {
    vista.delegada = delegada;
  }

  seleccionarTodasDelegacionUsuario(seleccionar: boolean): void {
    this.delegacionUsuarioVistas.forEach(v => { v.delegada = seleccionar; });
  }

  guardarDelegacionUsuario(): void {
    const empresaId = this.esDelegacionUsuariosInterna
      ? this.esquemaEmpresaId
      : this.delegacionEmpresaId;

    if (!this.currentGrupoId || !empresaId || !this.delegacionUsuarioId) {
      return;
    }

    const vistaIds = this.delegacionUsuarioVistas.filter(v => v.delegada).map(v => v.id);
    this.isSavingDelegacionUsuario = true;

    this.biGrupoService.saveDelegacionUsuario(
      this.currentGrupoId,
      empresaId,
      this.delegacionUsuarioId,
      vistaIds
    ).subscribe({
      next: () => {
        this.delegacionUsuarioTieneConfig = vistaIds.length > 0;
        this.isSavingDelegacionUsuario = false;
        this.showSuccess('Delegaci\u00f3n por usuario guardada correctamente');
      },
      error: (err) => {
        this.isSavingDelegacionUsuario = false;
        this.showError(err?.error?.message || 'Error al guardar delegaci\u00f3n por usuario');
      }
    });
  }

  getTipoLabel(tipo: number): string {
    return this.tipoOptions.find(o => o.value === tipo)?.label ?? String(tipo);
  }

  getTipoSeverity(tipo: number): 'info' | 'success' | 'warn' | 'danger' | 'secondary' | 'contrast' {
    switch (tipo) {
      case 1: return 'info';
      case 2: return 'success';
      case 3: return 'warn';
      default: return 'secondary';
    }
  }

  private showSuccess(detail: string): void {
    this.messageService.add({ severity: 'success', summary: 'Éxito', detail });
  }

  private showInfo(detail: string): void {
    this.messageService.add({ severity: 'info', summary: 'Información', detail });
  }

  private showWarn(detail: string): void {
    this.messageService.add({ severity: 'warn', summary: 'Atención', detail });
  }

  private showError(detail: string): void {
    this.messageService.add({ severity: 'error', summary: 'Error', detail });
  }
}