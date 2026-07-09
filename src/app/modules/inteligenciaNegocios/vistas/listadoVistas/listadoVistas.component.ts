import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { DropdownModule } from 'primeng/dropdown';
import { MultiSelectModule } from 'primeng/multiselect';

import { EsquemaCatalogo, VistasService, VistaBi } from '../../services/vistas.service';
import { isVistaEnMantenimiento } from '../../helpers/fabric-error.helper';

export interface EsquemaOption {
  code: string;
  label: string;
}

export interface GrupoVistas {
  key: string;
  schema: string;
  codigo: string;
  nombre: string;
  expandido: boolean;
  vistas: VistaBi[];
  esDelegacion?: boolean;
  ocultarCodigo?: boolean;
}

@Component({
  selector: 'app-listado-vistas',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ButtonModule,
    ToastModule,
    TableModule,
    TagModule,
    SkeletonModule,
    InputTextModule,
    TooltipModule,
    DropdownModule,
    MultiSelectModule
  ],
  providers: [MessageService],
  templateUrl: './listadoVistas.component.html',
  styleUrl: './listadoVistas.component.css'
})
export class ListadoVistasComponent implements OnInit {
  isLoadingContext = false;
  isLoadingVistas = false;
  isNavigating = false;
  searchTerm = '';
  vistas: VistaBi[] = [];
  departamento: string | null = null;
  esquemasCatalogo: EsquemaCatalogo[] = [];
  esquemaOptions: EsquemaOption[] = [];
  esquemasSeleccionados: string[] = [];
  pageTitle = 'Reportes e Información';
  pageSubtitle = 'Consulta de fuentes de datos disponibles según tus permisos';
  listPath = '/inteligenciaNegocios/vistas';
  vistaAgrupada = false;
  tieneVistasDelegadas = false;

  private grupoTipo?: number;
  private vistasPorEsquema = new Map<string, VistaBi[]>();
  private gruposExpandidos = new Set<string>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private vistasService: VistasService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    const data = this.route.snapshot.data;
    this.grupoTipo = data['grupoTipo'] as number | undefined;
    this.vistaAgrupada = !!data['vistaAgrupada'];
    this.listPath = (data['listPath'] as string) ?? this.listPath;
    this.pageTitle = (data['pageTitle'] as string) ?? this.pageTitle;
    this.pageSubtitle = (data['pageSubtitle'] as string) ?? this.pageSubtitle;
    this.cargarContexto();
  }

  get isLoading(): boolean {
    return this.isLoadingContext || this.isLoadingVistas;
  }

  get totalVistas(): number {
    return this.vistas.length;
  }

  get gruposVistas(): GrupoVistas[] {
    if (this.vistaAgrupada && this.tieneVistasDelegadas) {
      return [
        ...this.buildGruposPorEmpresaDelegada(),
        ...this.buildGruposPorEsquema(true)
      ];
    }
    return this.buildGruposPorEsquema(false);
  }

  get resumenGruposLabel(): string {
    return this.tieneVistasDelegadas ? 'empresa(s)' : 'categoría(s)';
  }

  get tituloSeccionGrupos(): string {
    return this.tieneVistasDelegadas ? 'Vistas delegadas por empresa' : 'Vistas por categoría';
  }

  private buildGruposPorEsquema(soloDirectos = false): GrupoVistas[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.esquemasCatalogo
      .filter(esquema => !soloDirectos || !esquema.es_delegado)
      .map(esquema => {
        const vistasGrupo = this.filtrarVistasGrupo(esquema.schema, term, esquema.nombre);

        return {
          key: esquema.schema,
          schema: esquema.schema,
          codigo: esquema.codigo,
          nombre: esquema.nombre,
          expandido: this.estaGrupoExpandido(esquema.schema, term, vistasGrupo.length > 0),
          vistas: vistasGrupo,
          ocultarCodigo: false
        };
      })
      .filter(grupo => grupo.vistas.length > 0 || (!term && this.vistasPorEsquema.has(grupo.schema)));
  }

  private buildGruposPorEmpresaDelegada(): GrupoVistas[] {
    const term = this.searchTerm.trim().toLowerCase();
    const porEmpresa = new Map<number, GrupoVistas>();

    for (const esquema of this.esquemasCatalogo.filter(e => e.es_delegado)) {
      const vistasGrupo = this.filtrarVistasGrupo(esquema.schema, term, esquema.nombre, esquema.empresa_nombre);
      if (vistasGrupo.length === 0 && term) {
        continue;
      }

      const empresaId = esquema.empresa_id ?? 0;
      const key = `empresa-${empresaId}`;

      if (!porEmpresa.has(empresaId)) {
        porEmpresa.set(empresaId, {
          key,
          schema: esquema.schema,
          codigo: '',
          nombre: esquema.empresa_nombre ?? 'Empresa delegada',
          expandido: this.estaGrupoExpandido(key, term, vistasGrupo.length > 0),
          vistas: [],
          esDelegacion: true,
          ocultarCodigo: true
        });
      }

      const grupo = porEmpresa.get(empresaId)!;
      grupo.vistas.push(...vistasGrupo);
      grupo.expandido = this.estaGrupoExpandido(key, term, grupo.vistas.length > 0);
    }

    return Array.from(porEmpresa.values())
      .filter(grupo => grupo.vistas.length > 0 || !term);
  }

  private filtrarVistasGrupo(
    schema: string,
    term: string,
    nombreEsquema: string,
    empresaNombre?: string
  ): VistaBi[] {
    return (this.vistasPorEsquema.get(schema) ?? []).filter(vista => {
      if (!term) {
        return true;
      }
      return (
        vista.nombre.toLowerCase().includes(term) ||
        vista.codigo.toLowerCase().includes(term) ||
        nombreEsquema.toLowerCase().includes(term) ||
        (vista.fuente ?? '').toLowerCase().includes(term) ||
        (vista.schemaDisplay ?? '').toLowerCase().includes(term) ||
        (empresaNombre ?? '').toLowerCase().includes(term)
      );
    });
  }

  cargarContexto(): void {
    this.isLoadingContext = true;

    this.vistasService.getContext(this.grupoTipo).subscribe({
      next: ctx => {
        this.departamento = ctx.departamento;
        this.esquemasCatalogo = ctx.esquemas_catalogo ?? [];
        this.tieneVistasDelegadas = !!ctx.tiene_vistas_delegadas;
        this.esquemaOptions = this.esquemasCatalogo.map(item => ({
          code: item.schema,
          label: item.nombre
        }));
        this.isLoadingContext = false;

        if (this.esquemaOptions.length === 0) {
          return;
        }

        this.esquemasSeleccionados = this.esquemaOptions.map(o => o.code);
        this.cargarVistasEsquema();
      },
      error: () => {
        this.departamento = null;
        this.esquemasCatalogo = [];
        this.esquemaOptions = [];
        this.isLoadingContext = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo cargar el contexto de permisos.',
          life: 6000
        });
      }
    });
  }

  onEsquemaChange(): void {
    this.searchTerm = '';
    this.vistas = [];

    if (!this.esquemasSeleccionados || this.esquemasSeleccionados.length === 0) {
      return;
    }

    this.cargarVistasEsquema();
  }

  cargarVistasEsquema(forceReload = false): void {
    if (!this.esquemasSeleccionados || this.esquemasSeleccionados.length === 0) {
      return;
    }

    this.isLoadingVistas = true;
    const promises: Promise<VistaBi[]>[] = [];

    for (const schema of this.esquemasSeleccionados) {
      if (forceReload) this.vistasPorEsquema.delete(schema);

      const cached = this.vistasPorEsquema.get(schema);
      if (cached) {
        promises.push(Promise.resolve(cached));
      } else {
        promises.push(new Promise((resolve, reject) => {
          this.vistasService.getVistasPorEsquema(schema, forceReload, this.grupoTipo).subscribe({
            next: response => {
              const nombreEsquema = this.esquemasCatalogo.find(
                e => e.schema.toLowerCase() === schema.toLowerCase()
              )?.nombre;

              const vistas = (response.data ?? []).map(v => ({
                ...v,
                schemaDisplay: nombreEsquema ?? v.schemaDisplay
              }));

              this.vistasPorEsquema.set(schema, vistas);
              resolve(vistas);
            },
            error: err => reject(err)
          });
        }));
      }
    }

    Promise.all(promises).then(results => {
      this.vistas = results.flat();
      this.isLoadingVistas = false;
    }).catch(() => {
      this.vistas = [];
      this.isLoadingVistas = false;
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudieron cargar las vistas.',
        life: 6000
      });
    });
  }

  actualizar(): void {
    if (this.esquemasSeleccionados.length > 0) {
      this.cargarVistasEsquema(true);
    } else {
      this.vistasPorEsquema.clear();
      this.cargarContexto();
    }
  }

  abrirVista(vista: VistaBi): void {
    if (isVistaEnMantenimiento(vista)) {
      this.messageService.add({
        severity: 'warn',
        summary: 'En mantenimiento',
        detail: 'Esta vista está en mantenimiento. Intente más tarde.',
        life: 4000
      });
      return;
    }

    if (!vista.estado) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Vista no visible',
        detail: 'Esta vista no está disponible para su sede.',
        life: 3000
      });
      return;
    }

    // Mostrar loader de navegación
    this.isNavigating = true;

    this.router.navigate([
      `${this.listPath}/viewVistas`,
      vista.schema,
      vista.view_name
    ]);
  }

  toggleGrupo(key: string): void {
    if (this.gruposExpandidos.has(key)) {
      this.gruposExpandidos.delete(key);
    } else {
      this.gruposExpandidos.add(key);
    }
  }

  expandirTodos(): void {
    this.gruposVistas.forEach(g => this.gruposExpandidos.add(g.key));
  }

  colapsarTodos(): void {
    this.gruposExpandidos.clear();
  }

  estaGrupoExpandido(key: string, term: string, tieneResultados: boolean): boolean {
    if (term) {
      return tieneResultados;
    }
    return this.gruposExpandidos.has(key);
  }

  contarVisibles(grupo: GrupoVistas): number {
    return grupo.vistas.filter(v => v.estado && !isVistaEnMantenimiento(v)).length;
  }

  esEnMantenimiento(vista: VistaBi): boolean {
    return isVistaEnMantenimiento(vista);
  }

  get vistasFiltradas(): VistaBi[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      return this.vistas;
    }

    return this.vistas.filter(vista =>
      vista.nombre.toLowerCase().includes(term) ||
      vista.codigo.toLowerCase().includes(term) ||
      vista.schemaDisplay.toLowerCase().includes(term) ||
      (vista.fuente ?? '').toLowerCase().includes(term)
    );
  }

  limpiarBusqueda(): void {
    this.searchTerm = '';
  }
}
