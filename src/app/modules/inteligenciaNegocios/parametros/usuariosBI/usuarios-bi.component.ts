import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-community';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { TabViewModule } from 'primeng/tabview';
import { CalendarModule } from 'primeng/calendar';
import { MessageService } from 'primeng/api';
import { AG_GRID_LOCALE } from '../../../../core/config/ag-grid.config';
import { ContextoService, Empresa as EmpresaContexto } from '../../../../core/services/contexto.service';
import { environment } from '../../../../environments/environment';
import {
  BiAuditoriaItem,
  BiDelegacionEmpresaGrupo,
  BiDelegacionUsuarioGrupo,
  BiEsquemaCatalogoUsuario,
  BiGrupoDirecto,
  BiUsuarioPermisos,
  UsuariosBiService,
  UsuarioEmpresaOption
} from './services/usuarios-bi.service';

interface VistaDelegadaRow {
  schema: string;
  grupo: string;
  vista: string;
  estado?: string;
  empresa_propietaria?: string | null;
  empresa_receptora?: string | null;
  tipo_acceso: string;
}

@Component({
  selector: 'app-usuarios-bi',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    AgGridAngular,
    DropdownModule,
    ToastModule,
    TagModule,
    TooltipModule,
    TabViewModule,
    CalendarModule
  ],
  providers: [MessageService],
  templateUrl: './usuarios-bi.component.html',
  styleUrl: './usuarios-bi.component.css'
})
export class UsuariosBiComponent implements OnInit {
  empresasOptions: { label: string; value: number }[] = [];
  usuariosOptions: { label: string; value: number }[] = [];
  empresaId: number | null = null;
  usuarioId: number | null = null;

  esTransversal = true;
  empresaNombre = '';

  isLoadingEmpresas = false;
  isLoadingUsuarios = false;
  isLoadingPermisos = false;

  permisos: BiUsuarioPermisos | null = null;
  activeTabIndex = 0;
  modoSoloAuditoria = false;

  readonly localeText = AG_GRID_LOCALE;
  readonly defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 110
  };

  gruposDirectosColumnDefs: ColDef<BiGrupoDirecto>[] = [
    { field: 'grupo', headerName: 'Grupo Azure', minWidth: 140 },
    { field: 'schema', headerName: 'Esquema', width: 100 },
    { field: 'descripcion', headerName: 'Descripción', flex: 1, minWidth: 180 },
    {
      field: 'tipo',
      headerName: 'Tipo',
      width: 130,
      valueFormatter: p => this.getTipoLabel(p.value)
    },
    { field: 'origen', headerName: 'Origen', width: 100 },
    { field: 'fuente', headerName: 'Fuente', width: 110 }
  ];

  esquemasColumnDefs: ColDef<BiEsquemaCatalogoUsuario>[] = [
    { field: 'codigo', headerName: 'Grupo', minWidth: 130 },
    { field: 'schema', headerName: 'Esquema', width: 100 },
    { field: 'nombre', headerName: 'Nombre', flex: 1, minWidth: 180 },
    {
      field: 'es_delegado',
      headerName: 'Acceso',
      width: 130,
      valueFormatter: p => (p.value ? 'Delegado' : 'Directo Azure')
    },
    { field: 'empresa_nombre', headerName: 'Empresa esquema', flex: 1, minWidth: 160 },
    {
      field: 'tipo',
      headerName: 'Tipo',
      width: 130,
      valueFormatter: p => this.getTipoLabel(p.value)
    }
  ];

  vistasDelegadasColumnDefs: ColDef<VistaDelegadaRow>[] = [
    { field: 'tipo_acceso', headerName: 'Tipo', width: 150 },
    { field: 'schema', headerName: 'Esquema', width: 100 },
    { field: 'grupo', headerName: 'Grupo', minWidth: 120 },
    { field: 'vista', headerName: 'Vista', flex: 1, minWidth: 200 },
    { field: 'estado', headerName: 'Estado', width: 110 },
    { field: 'empresa_propietaria', headerName: 'Empresa esquema', minWidth: 160 },
    { field: 'empresa_receptora', headerName: 'Empresa receptora', minWidth: 160 }
  ];

  gruposDirectosRows: BiGrupoDirecto[] = [];
  esquemasRows: BiEsquemaCatalogoUsuario[] = [];
  vistasDelegadasEmpresaRows: VistaDelegadaRow[] = [];
  vistasDelegadasUsuarioRows: VistaDelegadaRow[] = [];

  auditoriaFechaDesde: Date | null = null;
  auditoriaFechaHasta: Date | null = null;
  auditoriaSchema: string | null = null;
  auditoriaAccion: string | null = null;
  auditoriaEsquemasOptions: { label: string; value: string }[] = [];
  auditoriaAccionOptions = [
    { label: 'Todas las acciones', value: null },
    { label: 'Consulta de vista', value: 'consulta' },
    { label: 'Exportación (inicio)', value: 'exportacion_inicio' },
    { label: 'Exportación (descarga)', value: 'exportacion_descarga' },
    { label: 'Exportación (directa)', value: 'exportacion_sync' }
  ];
  auditoriaRows: BiAuditoriaItem[] = [];
  auditoriaTotal = 0;
  isLoadingAuditoria = false;
  isLoadingEsquemasAuditoria = false;

  auditoriaColumnDefs: ColDef<BiAuditoriaItem>[] = [
    {
      field: 'accessed_at',
      headerName: 'Fecha / hora',
      minWidth: 165,
      valueFormatter: p => this.formatAuditoriaFecha(p.value)
    },
    { field: 'user_name', headerName: 'Usuario', minWidth: 150 },
    { field: 'user_email', headerName: 'Email', minWidth: 180 },
    { field: 'empresa_nombre', headerName: 'Empresa', minWidth: 140 },
    { field: 'schema', headerName: 'Esquema', width: 100 },
    { field: 'view', headerName: 'Vista', flex: 1, minWidth: 180 },
    {
      field: 'accion',
      headerName: 'Acción',
      width: 170,
      valueFormatter: p => this.getAccionLabel(p.value)
    },
    {
      field: 'rows_returned',
      headerName: 'Filas',
      width: 90,
      valueFormatter: p => (p.value != null ? String(p.value) : '—')
    },
    { field: 'ip_address', headerName: 'IP', width: 120 }
  ];

  constructor(
    private usuariosBiService: UsuariosBiService,
    private contextoService: ContextoService,
    private http: HttpClient,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.initAuditoriaFechas();
    this.loadEmpresas();
  }

  get puedeCargarAuditoria(): boolean {
    return !!this.empresaId && !!this.auditoriaFechaDesde && !!this.auditoriaFechaHasta;
  }

  get puedeConsultar(): boolean {
    return !!this.usuarioId;
  }

  get resumenUsuario(): string {
    if (!this.permisos?.usuario) {
      return '';
    }
    return `${this.permisos.usuario.name} (${this.permisos.usuario.email})`;
  }

  private loadEmpresas(): void {
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
              this.showError('Error al cargar empresas');
            }
          });
        } else if (empresas.length === 1) {
          this.esTransversal = false;
          this.empresaId = empresas[0].id;
          this.empresaNombre = empresas[0].nombre;
          this.isLoadingEmpresas = false;
          this.cargarUsuarios();
          this.cargarEsquemasAuditoria();
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
    this.usuarioId = null;
    this.usuariosOptions = [];
    this.limpiarPermisos();
    this.limpiarAuditoria();
    if (this.empresaId) {
      const empresa = this.empresasOptions.find(e => e.value === this.empresaId);
      this.empresaNombre = empresa?.label ?? '';
      this.cargarUsuarios();
      this.cargarEsquemasAuditoria();
    } else {
      this.empresaNombre = '';
      this.auditoriaEsquemasOptions = [];
    }
  }

  onUsuarioChange(): void {
    this.limpiarPermisos();
  }

  private cargarUsuarios(): void {
    if (!this.empresaId) {
      return;
    }

    this.isLoadingUsuarios = true;
    this.http.get<UsuarioEmpresaOption[]>(`${environment.URL_SERVICIOS}/users-por-empresa/${this.empresaId}`).subscribe({
      next: (users) => {
        this.usuariosOptions = (users ?? []).map(u => ({
          label: `${u.name} (${u.email})`,
          value: u.id
        }));
        this.isLoadingUsuarios = false;
      },
      error: () => {
        this.usuariosOptions = [];
        this.isLoadingUsuarios = false;
        this.showError('Error al cargar usuarios de la empresa');
      }
    });
  }

  traerGruposUsuario(syncAzure = false): void {
    if (!this.usuarioId) {
      this.showWarn('Seleccione un usuario');
      return;
    }

    this.isLoadingPermisos = true;
    this.usuariosBiService.getPermisos(this.usuarioId, this.empresaId, syncAzure).subscribe({
      next: (data) => {
        this.permisos = data;
        this.mapGridRows(data);
        this.isLoadingPermisos = false;
        this.showSuccess(syncAzure
          ? 'Grupos sincronizados desde Azure y permisos cargados'
          : 'Permisos BI cargados');
      },
      error: (err) => {
        this.isLoadingPermisos = false;
        this.showError(err?.error?.message || 'Error al consultar permisos del usuario');
      }
    });
  }

  private mapGridRows(data: BiUsuarioPermisos): void {
    this.gruposDirectosRows = data.grupos_directos ?? [];
    this.esquemasRows = data.esquemas_catalogo ?? [];
    this.vistasDelegadasEmpresaRows = this.flattenDelegacionesEmpresa(data.delegaciones_empresa ?? []);
    this.vistasDelegadasUsuarioRows = this.flattenDelegacionesUsuario(data.delegaciones_usuario ?? []);
  }

  private flattenDelegacionesEmpresa(items: BiDelegacionEmpresaGrupo[]): VistaDelegadaRow[] {
    const rows: VistaDelegadaRow[] = [];
    for (const item of items) {
      for (const vista of item.vistas ?? []) {
        rows.push({
          schema: item.schema,
          grupo: item.grupo,
          vista: vista.nombre,
          estado: vista.estado,
          empresa_propietaria: item.empresa_propietaria,
          empresa_receptora: item.empresa_receptora,
          tipo_acceso: item.es_otra_empresa ? 'Delegación otra empresa' : 'Delegación empresa'
        });
      }
    }
    return rows;
  }

  private flattenDelegacionesUsuario(items: BiDelegacionUsuarioGrupo[]): VistaDelegadaRow[] {
    const rows: VistaDelegadaRow[] = [];
    for (const item of items) {
      for (const vista of item.vistas ?? []) {
        rows.push({
          schema: item.schema,
          grupo: item.grupo,
          vista: vista.nombre,
          estado: vista.estado,
          empresa_propietaria: item.empresa_esquema,
          empresa_receptora: null,
          tipo_acceso: 'Delegación usuario'
        });
      }
    }
    return rows;
  }

  private limpiarPermisos(): void {
    this.permisos = null;
    this.gruposDirectosRows = [];
    this.esquemasRows = [];
    this.vistasDelegadasEmpresaRows = [];
    this.vistasDelegadasUsuarioRows = [];
  }

  getTipoLabel(tipo: number | null | undefined): string {
    switch (tipo) {
      case 1: return 'Asistencial';
      case 2: return 'Financiero';
      case 3: return 'Administrativo';
      default: return tipo != null ? String(tipo) : '—';
    }
  }

  getTipoSeverity(tipo: number | null | undefined): 'info' | 'success' | 'warn' | 'secondary' {
    switch (tipo) {
      case 1: return 'info';
      case 2: return 'success';
      case 3: return 'warn';
      default: return 'secondary';
    }
  }

  irModoAuditoria(): void {
    this.modoSoloAuditoria = true;
    this.usuarioId = null;
    this.usuariosOptions = [];
    this.activeTabIndex = 0;
    this.limpiarPermisos();
    this.limpiarAuditoria();
    this.initAuditoriaFechas();

    if (this.empresaId) {
      this.cargarEsquemasAuditoria();
      this.cargarUsuarios();
    }
  }

  irModoPermisos(): void {
    this.modoSoloAuditoria = false;
    this.limpiarAuditoria();
    this.activeTabIndex = 0;
  }

  onEmpresaAuditoriaChange(): void {
    this.usuarioId = null;
    this.usuariosOptions = [];
    this.limpiarAuditoria();
    this.onEmpresaChange();
  }

  onUsuarioAuditoriaChange(): void {
    this.limpiarAuditoria();
  }

  cargarAuditoria(): void {
    if (!this.empresaId) {
      this.showWarn('Seleccione una empresa');
      return;
    }
    if (!this.auditoriaFechaDesde || !this.auditoriaFechaHasta) {
      this.showWarn('Indique el rango de fechas');
      return;
    }

    this.isLoadingAuditoria = true;
    this.usuariosBiService.getAuditoria({
      fecha_desde: this.formatDateParam(this.auditoriaFechaDesde),
      fecha_hasta: this.formatDateParam(this.auditoriaFechaHasta),
      empresa_id: this.empresaId,
      schema: this.auditoriaSchema,
      user_id: this.usuarioId,
      accion: this.auditoriaAccion,
      limit: 1000
    }).subscribe({
      next: (data) => {
        this.auditoriaRows = data.items ?? [];
        this.auditoriaTotal = data.total ?? 0;
        this.isLoadingAuditoria = false;
        this.showSuccess(`Auditoría cargada: ${this.auditoriaRows.length} de ${this.auditoriaTotal} registros`);
      },
      error: (err) => {
        this.isLoadingAuditoria = false;
        this.showError(err?.error?.message || 'Error al cargar auditoría');
      }
    });
  }

  private cargarEsquemasAuditoria(): void {
    if (!this.empresaId) {
      this.auditoriaEsquemasOptions = [];
      return;
    }

    this.isLoadingEsquemasAuditoria = true;
    this.usuariosBiService.getEsquemasAuditoria(this.empresaId).subscribe({
      next: (items) => {
        this.auditoriaEsquemasOptions = (items ?? []).map(e => ({
          label: `${e.schema.toUpperCase()} — ${e.nombre}`,
          value: e.schema
        }));
        this.isLoadingEsquemasAuditoria = false;
      },
      error: () => {
        this.auditoriaEsquemasOptions = [];
        this.isLoadingEsquemasAuditoria = false;
      }
    });
  }

  private initAuditoriaFechas(): void {
    const hoy = new Date();
    const hace7 = new Date();
    hace7.setDate(hoy.getDate() - 7);
    this.auditoriaFechaDesde = hace7;
    this.auditoriaFechaHasta = hoy;
  }

  private limpiarAuditoria(): void {
    this.auditoriaRows = [];
    this.auditoriaTotal = 0;
    this.auditoriaSchema = null;
    this.auditoriaAccion = null;
  }

  private formatDateParam(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  formatAuditoriaFecha(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getAccionLabel(accion: string | null | undefined): string {
    switch (accion) {
      case 'consulta': return 'Consulta';
      case 'exportacion_inicio': return 'Exportación (inicio)';
      case 'exportacion_descarga': return 'Exportación (descarga)';
      case 'exportacion_sync': return 'Exportación (directa)';
      default: return accion ?? '—';
    }
  }

  private showSuccess(detail: string): void {
    this.messageService.add({ severity: 'success', summary: 'Éxito', detail });
  }

  private showWarn(detail: string): void {
    this.messageService.add({ severity: 'warn', summary: 'Atención', detail });
  }

  private showError(detail: string): void {
    this.messageService.add({ severity: 'error', summary: 'Error', detail });
  }
}
