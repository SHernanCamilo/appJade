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

export interface EsquemaOption {
  code: string;
  label: string;
}

export interface GrupoVistas {
  schema: string;
  codigo: string;
  nombre: string;
  expandido: boolean;
  vistas: VistaBi[];
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
    const term = this.searchTerm.trim().toLowerCase();

    return this.esquemasCatalogo
      .map(esquema => {
        const vistasGrupo = (this.vistasPorEsquema.get(esquema.schema) ?? [])
          .filter(vista => {
            if (!term) return true;
            return (
              vista.nombre.toLowerCase().includes(term) ||
              vista.codigo.toLowerCase().includes(term) ||
              esquema.nombre.toLowerCase().includes(term) ||
              (vista.fuente ?? '').toLowerCase().includes(term)
            );
          });

        return {
          schema: esquema.schema,
          codigo: esquema.codigo,
          nombre: esquema.nombre,
          expandido: this.estaGrupoExpandido(esquema.schema, term, vistasGrupo.length > 0),
          vistas: vistasGrupo
        };
      })
      .filter(grupo => grupo.vistas.length > 0 || (!term && this.vistasPorEsquema.has(grupo.schema)));
  }

  cargarContexto(): void {
    this.isLoadingContext = true;

    this.vistasService.getContext(this.grupoTipo).subscribe({
      next: ctx => {
        this.departamento = ctx.departamento;
        this.esquemasCatalogo = ctx.esquemas_catalogo ?? [];
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

  toggleGrupo(schema: string): void {
    if (this.gruposExpandidos.has(schema)) {
      this.gruposExpandidos.delete(schema);
    } else {
      this.gruposExpandidos.add(schema);
    }
  }

  expandirTodos(): void {
    this.gruposVistas.forEach(g => this.gruposExpandidos.add(g.schema));
  }

  colapsarTodos(): void {
    this.gruposExpandidos.clear();
  }

  estaGrupoExpandido(schema: string, term: string, tieneResultados: boolean): boolean {
    if (term) {
      return tieneResultados;
    }
    return this.gruposExpandidos.has(schema);
  }

  contarVisibles(grupo: GrupoVistas): number {
    return grupo.vistas.filter(v => v.estado).length;
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
