import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import {
  CellValueChangedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
  RowSelectionOptions,
  SelectionColumnDef
} from 'ag-grid-community';
import { forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { MultiSelectModule } from 'primeng/multiselect';
import { TabViewModule } from 'primeng/tabview';
import { MessageService, ConfirmationService } from 'primeng/api';
import { DataTableComponent } from '../../../../complements/shared/data-table/data-table.component';
import { TableColumn } from '../../../../complements/shared/data-table/table-column.model';
import { AG_GRID_LOCALE } from '../../../../core/config/ag-grid.config';
import { ContextoService, Empresa as EmpresaContexto } from '../../../../core/services/contexto.service';
import { environment } from '../../../../environments/environment';
import { EstadoTagCellComponent } from './cell-renderers/estado-tag-cell.component';
import { VistaAccionesCellComponent } from './cell-renderers/vista-acciones-cell.component';
import { VistaDepartamentosCellComponent } from './cell-renderers/vista-departamentos-cell.component';
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
    MultiSelectModule,
    TabViewModule,
    AgGridAngular,
    DataTableComponent,
    VistaDepartamentosCellComponent,
    VistaAccionesCellComponent,
    EstadoTagCellComponent
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

  readonly localeText = AG_GRID_LOCALE;
  readonly rowSelection: RowSelectionOptions = {
    mode: 'multiRow',
    checkboxes: true,
    headerCheckbox: true,
    enableClickSelection: false
  };
  readonly selectionColumnDef: SelectionColumnDef = {
    pinned: 'left',
    width: 48,
    sortable: false,
    resizable: false
  };

  vistasColumnDefs: ColDef<BiVista>[] = [];
  delegacionColumnDefs: ColDef<BiDelegacionVista>[] = [];
  defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 110
  };

  vistasSeleccionadasCount = 0;
  isBulkUpdatingEstado = false;

  readonly vistasNoRowsTemplate =
    '<span class="ag-overlay-empty">No hay vistas configuradas. Seleccione vistas del catálogo Fabric y haga clic en Agregar.</span>';
  readonly delegacionNoRowsTemplate =
    '<span class="ag-overlay-empty">No hay vistas en este esquema. Agregue vistas en la pestaña Vistas.</span>';
  readonly delegacionUsuarioNoRowsTemplate =
    '<span class="ag-overlay-empty">Seleccione empresa y usuario para configurar delegación.</span>';

  private vistasGridApi?: GridApi<BiVista>;
  private delegacionGridApi?: GridApi<BiDelegacionVista>;
  private delegacionUsuarioGridApi?: GridApi<BiDelegacionVista>;

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
    this.buildVistasColumnDefs();
    this.buildDelegacionColumnDefs();
    this.loadEmpresasDisponibles();
    this.loadDepartamentosCatalogo();
    this.loadDelegacionEmpresas();
  }

  private buildVistasColumnDefs(): void {
    this.vistasColumnDefs = [
      {
        field: 'nombre',
        headerName: 'Nombre',
        minWidth: 140,
        maxWidth: 220,
        cellRenderer: (params: ICellRendererParams<BiVista>) => {
          const span = document.createElement('span');
          span.className = 'codigo-badge';
          span.textContent = String(params.value ?? '');
          return span;
        }
      },
      {
        field: 'descripcion',
        headerName: 'Descripción',
        flex: 1,
        minWidth: 180,
        editable: () => this.puedeGestionarVistas,
        cellEditor: 'agTextCellEditor'
      },
      {
        colId: 'departamentos',
        headerName: 'Departamentos',
        minWidth: 220,
        flex: 1,
        sortable: false,
        filter: false,
        cellRenderer: VistaDepartamentosCellComponent,
        cellRendererParams: () => ({
          departamentosOptions: this.departamentosOptions,
          puedeGestionar: this.puedeGestionarVistas,
          savingVistaId: this.savingVistaId,
          onChange: (vista: BiVista, departamentos: string[] | null) => this.onDepartamentosChange(vista, departamentos)
        })
      },
      {
        field: 'estado',
        headerName: 'Estado',
        width: 140,
        cellRenderer: EstadoTagCellComponent,
        cellRendererParams: {
          getEstadoLabel: (estado: BiVistaEstado) => this.getEstadoLabel(estado),
          getEstadoSeverity: (estado: BiVistaEstado) => this.getEstadoSeverity(estado)
        }
      },
      {
        colId: 'accion',
        headerName: 'Acción',
        width: 72,
        maxWidth: 72,
        sortable: false,
        filter: false,
        pinned: 'right',
        cellClass: 'accion-grid-cell',
        cellRenderer: VistaAccionesCellComponent,
        cellRendererParams: () => ({
          puedeGestionar: this.puedeGestionarVistas,
          savingVistaId: this.savingVistaId,
          onDelete: (vista: BiVista) => this.eliminarVista(vista)
        })
      }
    ];
  }

  private buildDelegacionColumnDefs(): void {
    this.delegacionColumnDefs = [
      {
        field: 'nombre',
        headerName: 'Vista',
        flex: 1,
        minWidth: 180,
        cellRenderer: (params: ICellRendererParams<BiDelegacionVista>) => {
          const wrap = document.createElement('div');
          const badge = document.createElement('span');
          badge.className = 'codigo-badge';
          badge.textContent = String(params.value ?? '');
          wrap.appendChild(badge);
          if (params.data?.descripcion) {
            const desc = document.createElement('small');
            desc.className = 'delegacion-desc';
            desc.textContent = params.data.descripcion;
            wrap.appendChild(desc);
          }
          return wrap;
        }
      },
      {
        field: 'descripcion',
        hide: true
      },
      {
        field: 'estado',
        headerName: 'Estado',
        width: 140,
        cellRenderer: EstadoTagCellComponent,
        cellRendererParams: {
          getEstadoLabel: (estado: BiVistaEstado) => this.getEstadoLabel(estado),
          getEstadoSeverity: (estado: BiVistaEstado) => this.getEstadoSeverity(estado)
        }
      }
    ];
  }

  onVistasGridReady(event: GridReadyEvent<BiVista>): void {
    this.vistasGridApi = event.api;
    this.onVistasSelectionChanged();
    this.refreshVistasGridData();
  }

  private refreshVistasGridData(): void {
    if (!this.vistasGridApi) {
      return;
    }
    this.vistasGridApi.setGridOption('rowData', this.vistas);
    this.vistasGridApi.sizeColumnsToFit();
  }

  onVistasSelectionChanged(): void {
    this.vistasSeleccionadasCount = this.vistasGridApi?.getSelectedRows().length ?? 0;
  }

  onVistaCellValueChanged(event: CellValueChangedEvent<BiVista>): void {
    if (event.colDef.field !== 'descripcion' || !event.data) {
      return;
    }
    this.onDescripcionChange(event.data, String(event.newValue ?? '').trim());
  }

  refreshVistasGridCells(): void {
    this.vistasGridApi?.refreshCells({ force: true });
  }

  onDelegacionGridReady(event: GridReadyEvent<BiDelegacionVista>): void {
    this.delegacionGridApi = event.api;
    this.syncDelegacionGridSelection(this.delegacionGridApi, this.delegacionVistas);
  }

  onDelegacionUsuarioGridReady(event: GridReadyEvent<BiDelegacionVista>): void {
    this.delegacionUsuarioGridApi = event.api;
    this.syncDelegacionGridSelection(this.delegacionUsuarioGridApi, this.delegacionUsuarioVistas);
  }

  onDelegacionSelectionChanged(): void {
    this.syncDelegadaFromGrid(this.delegacionGridApi, this.delegacionVistas);
  }

  onDelegacionUsuarioSelectionChanged(): void {
    this.syncDelegadaFromGrid(this.delegacionUsuarioGridApi, this.delegacionUsuarioVistas);
  }

  private syncDelegacionGridSelection(gridApi: GridApi<BiDelegacionVista> | undefined, vistas: BiDelegacionVista[]): void {
    if (!gridApi) {
      return;
    }
    gridApi.deselectAll();
    gridApi.forEachNode(node => {
      if (node.data && vistas.some(v => v.id === node.data!.id && v.delegada)) {
        node.setSelected(true);
      }
    });
  }

  private syncDelegadaFromGrid(gridApi: GridApi<BiDelegacionVista> | undefined, vistas: BiDelegacionVista[]): void {
    if (!gridApi) {
      return;
    }
    const selectedIds = new Set(gridApi.getSelectedRows().map(v => v.id));
    vistas.forEach(vista => {
      vista.delegada = selectedIds.has(vista.id);
    });
  }

  aplicarEstadoMasivo(estado: BiVistaEstado): void {
    const seleccionadas = this.vistasGridApi?.getSelectedRows() ?? [];
    if (!this.puedeGestionarVistas || seleccionadas.length === 0) {
      this.showWarn('Seleccione al menos una vista');
      return;
    }

    const aActualizar = seleccionadas.filter(v => (v.estado ?? 'activo') !== estado);
    if (aActualizar.length === 0) {
      this.showInfo(`Las vistas seleccionadas ya están en estado ${this.getEstadoLabel(estado)}`);
      return;
    }

    this.isBulkUpdatingEstado = true;
    forkJoin(aActualizar.map(vista => this.biVistaService.updateVista(vista.id, { estado }))).subscribe({
      next: (actualizadas) => {
        const mapa = new Map(actualizadas.map(v => [v.id, v]));
        this.vistas = this.vistas.map(v => mapa.get(v.id) ?? v);
        this.isBulkUpdatingEstado = false;
        this.vistasGridApi?.deselectAll();
        this.onVistasSelectionChanged();
        this.refreshVistasGridCells();
        this.showSuccess(`Estado "${this.getEstadoLabel(estado)}" aplicado a ${actualizadas.length} vista(s)`);
      },
      error: (err) => {
        this.isBulkUpdatingEstado = false;
        this.showError(err?.error?.message || 'Error al actualizar el estado de las vistas seleccionadas');
      }
    });
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

    if (index === 0) {
      setTimeout(() => {
        this.refreshVistasGridData();
        this.vistasGridApi?.sizeColumnsToFit();
      });
      return;
    }

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

  /** Por empresa: solo empresas externas. Por usuario: todas las empresas. */
  get delegacionEmpresasOptionsFiltradas(): { label: string; value: number }[] {
    const ownerId = this.esquemaEmpresaId;
    if (this.delegacionModo === 'empresa' && ownerId) {
      return this.delegacionEmpresasOptions.filter(o => o.value !== ownerId);
    }
    return this.delegacionEmpresasOptions;
  }

  /** Usuario + misma empresa del esquema (pool = todas las vistas del esquema). */
  get esDelegacionUsuariosInterna(): boolean {
    return this.delegacionModo === 'usuario'
      && !!this.delegacionEmpresaId
      && this.delegacionEmpresaId === this.esquemaEmpresaId;
  }

  get delegacionEmpresaNombre(): string {
    const id = this.delegacionEmpresaId;
    if (!id) {
      return '';
    }
    return this.delegacionEmpresasOptions.find(o => o.value === id)?.label
      ?? this.esquemaEmpresaNombre;
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
    if (!this.puedeGestionarVistas || !this.delegacionEmpresaId || !this.delegacionUsuarioId) {
      return false;
    }
    if (this.esDelegacionUsuariosInterna) {
      return true;
    }
    return this.delegacionEmpresaTienePool;
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
    setTimeout(() => this.refreshVistasGridData());
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
        setTimeout(() => this.refreshVistasGridData());
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
    this.refreshVistasGridCells();
    this.biVistaService.updateVista(vista.id, { descripcion: valor }).subscribe({
      next: (actualizada) => {
        this.vistas = this.vistas.map(v => v.id === actualizada.id ? actualizada : v);
        this.savingVistaId = null;
        this.refreshVistasGridCells();
        this.showSuccess('Descripción actualizada');
      },
      error: (err) => {
        this.savingVistaId = null;
        this.refreshVistasGridCells();
        this.showError(err?.error?.message || 'Error al guardar la descripción');
      }
    });
  }

  onDepartamentosChange(vista: BiVista, departamentos: string[] | null): void {
    if (!this.puedeGestionarVistas) {
      return;
    }

    this.savingVistaId = vista.id;
    this.refreshVistasGridCells();
    const normalizados = (departamentos ?? []).length ? departamentos : null;

    this.biVistaService.updateVista(vista.id, { departamentos: normalizados }).subscribe({
      next: (actualizada) => {
        this.vistas = this.vistas.map(v => v.id === actualizada.id ? actualizada : v);
        this.savingVistaId = null;
        this.refreshVistasGridCells();
        this.showSuccess('Departamentos actualizados');
      },
      error: (err) => {
        this.savingVistaId = null;
        this.refreshVistasGridCells();
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

    if (this.delegacionModo === 'usuario') {
      // Misma empresa del esquema: pool completo. Externa: depende de delegación por empresa.
      this.delegacionEmpresaTienePool = this.esDelegacionUsuariosInterna;
      this.cargarUsuariosEmpresa();
      return;
    }

    this.cargarDelegacion();
  }

  setDelegacionModo(modo: 'empresa' | 'usuario'): void {
    this.delegacionModo = modo;

    if (modo === 'usuario') {
      this.delegacionEmpresaId = this.esquemaEmpresaId;
      this.delegacionUsuarioId = null;
      this.delegacionUsuarioVistas = [];
      this.delegacionUsuarioTieneConfig = false;
      this.delegacionEmpresaTienePool = !!this.esquemaEmpresaId;
      this.delegacionUsuariosOptions = [];

      if (this.delegacionEmpresaId) {
        this.cargarUsuariosEmpresa();
      }
      return;
    }

    this.delegacionEmpresaId = null;
    this.delegacionUsuarioId = null;
    this.delegacionUsuariosOptions = [];
    this.delegacionUsuarioVistas = [];
    this.delegacionVistas = [];
    this.delegacionEmpresaTienePool = false;
  }

  onDelegacionUsuarioChange(): void {
    if (!this.delegacionUsuarioId) {
      this.delegacionUsuarioVistas = [];
      return;
    }
    this.cargarDelegacionUsuario();
  }

  private cargarUsuariosEmpresa(): void {
    const empresaId = this.delegacionEmpresaId;

    if (!empresaId) {
      this.delegacionUsuariosOptions = [];
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
        setTimeout(() => this.syncDelegacionGridSelection(this.delegacionGridApi, this.delegacionVistas));
      },
      error: (err) => {
        this.delegacionVistas = [];
        this.isLoadingDelegacion = false;
        this.showError(err?.error?.message || 'Error al cargar delegaci\u00f3n');
      }
    });
  }

  seleccionarTodasDelegacion(seleccionar: boolean): void {
    this.delegacionVistas.forEach(v => { v.delegada = seleccionar; });
    if (seleccionar) {
      this.delegacionGridApi?.selectAll();
    } else {
      this.delegacionGridApi?.deselectAll();
    }
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
    const empresaId = this.delegacionEmpresaId;

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
        setTimeout(() => this.syncDelegacionGridSelection(this.delegacionUsuarioGridApi, this.delegacionUsuarioVistas));
      },
      error: (err) => {
        this.delegacionUsuarioVistas = [];
        this.isLoadingDelegacionUsuario = false;
        this.showError(err?.error?.message || 'Error al cargar delegaci\u00f3n por usuario');
      }
    });
  }

  seleccionarTodasDelegacionUsuario(seleccionar: boolean): void {
    this.delegacionUsuarioVistas.forEach(v => { v.delegada = seleccionar; });
    if (seleccionar) {
      this.delegacionUsuarioGridApi?.selectAll();
    } else {
      this.delegacionUsuarioGridApi?.deselectAll();
    }
  }

  guardarDelegacionUsuario(): void {
    const empresaId = this.delegacionEmpresaId;

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