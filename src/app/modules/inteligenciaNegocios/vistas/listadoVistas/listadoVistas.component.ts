import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
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
  searchTerm = '';
  vistas: VistaBi[] = [];
  departamento: string | null = null;
  esquemasCatalogo: EsquemaCatalogo[] = [];
  esquemaOptions: EsquemaOption[] = [];
  esquemasSeleccionados: string[] = [];

  private vistasPorEsquema = new Map<string, VistaBi[]>();

  constructor(
    private router: Router,
    private vistasService: VistasService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.cargarContexto();
  }

  get isLoading(): boolean {
    return this.isLoadingContext || this.isLoadingVistas;
  }

  cargarContexto(): void {
    this.isLoadingContext = true;

    this.vistasService.getContext().subscribe({
      next: ctx => {
        this.departamento = ctx.departamento;
        this.esquemasCatalogo = ctx.esquemas_catalogo ?? [];
        this.esquemaOptions = this.esquemasCatalogo.map(item => ({
          code: item.schema,
          label: item.nombre
        }));
        this.isLoadingContext = false;

        if (this.esquemaOptions.length === 1) {
          this.esquemasSeleccionados = [this.esquemaOptions[0].code];
          this.cargarVistasEsquema();
        } else if (this.esquemaOptions.length > 1) {
          // Auto-seleccionar todas
          this.esquemasSeleccionados = this.esquemaOptions.map(o => o.code);
          this.cargarVistasEsquema();
        }
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

    // Cargar vistas de todos los esquemas seleccionados
    this.isLoadingVistas = true;
    const promises: Promise<VistaBi[]>[] = [];

    for (const schema of this.esquemasSeleccionados) {
      if (forceReload) this.vistasPorEsquema.delete(schema);

      const cached = this.vistasPorEsquema.get(schema);
      if (cached) {
        promises.push(Promise.resolve(cached));
      } else {
        promises.push(new Promise((resolve, reject) => {
          this.vistasService.getVistasPorEsquema(schema, forceReload).subscribe({
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

    this.router.navigate([
      '/inteligenciaNegocios/vistas/viewVistas',
      vista.schema,
      vista.view_name
    ]);
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
