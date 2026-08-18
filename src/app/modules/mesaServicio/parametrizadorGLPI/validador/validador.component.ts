import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { TreeModule } from 'primeng/tree';
import { TreeNode, MessageService } from 'primeng/api';
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { TabViewModule } from 'primeng/tabview';
import { TableModule } from 'primeng/table';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';

import { GlpiPlantillaService } from '../services/glpi-plantilla.service';
import { GlpiValidadorService } from '../services/glpi-validador.service';
import { GlpiPlantilla, GLPI_PRIORIDADES } from '../interfaces/glpi-plantilla.interface';
import {
  GlpiAnsPlantillaOpcion,
  GlpiComparacionEstado,
  GlpiComparacionFila,
  GlpiComparacionRegla,
  GlpiComparacionResultado,
  GlpiEntidadNodo
} from '../interfaces/glpi-validador.interface';

@Component({
  selector: 'app-glpi-validador',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TreeModule,
    DropdownModule,
    ButtonModule,
    ToastModule,
    TagModule,
    TabViewModule,
    TableModule,
    SkeletonModule,
    TooltipModule,
    InputTextModule
  ],
  providers: [MessageService],
  templateUrl: './validador.component.html',
  styleUrl: './validador.component.css'
})
export class GlpiValidadorComponent implements OnInit {
  entidadesTree: TreeNode[] = [];
  entidadSeleccionada: TreeNode | null = null;
  plantillas: GlpiPlantilla[] = [];
  plantillaId: number | null = null;

  isLoadingEntidades = false;
  isLoadingPlantillas = false;
  isComparando = false;
  resultado: GlpiComparacionResultado | null = null;
  filtroEstado: GlpiComparacionEstado | null = null;
  busquedaCategoria = '';
  asignandoReglaId: number | null = null;

  readonly prioridades = GLPI_PRIORIDADES;
  readonly opcionesEstado: { label: string; value: GlpiComparacionEstado }[] = [
    { label: 'Coincide', value: 'ok' },
    { label: 'Falta en GLPI', value: 'falta_glpi' },
    { label: 'Extra en GLPI', value: 'extra_glpi' },
    { label: 'Diferente', value: 'diferente' },
    { label: 'Tildes', value: 'tildes' },
    { label: 'Espacios', value: 'espacios' },
    { label: 'Tildes y espacios', value: 'tildes_espacios' }
  ];

  constructor(
    private validadorService: GlpiValidadorService,
    private plantillaService: GlpiPlantillaService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.cargarEntidades();
    this.cargarPlantillas();
  }

  get entidadActual(): GlpiEntidadNodo | null {
    return (this.entidadSeleccionada?.data as GlpiEntidadNodo) || null;
  }

  get puedeComparar(): boolean {
    return !!this.entidadActual && !!this.plantillaId && !this.isComparando;
  }

  get categoriasFiltradas(): GlpiComparacionFila[] {
    const filas = this.filtrar(this.resultado?.categorias || []);
    const q = this.busquedaCategoria.trim().toLowerCase();
    if (!q) {
      return filas;
    }

    return filas.filter((fila) => this.textoCategoria(fila).includes(q));
  }

  get reglasFiltradas(): GlpiComparacionRegla[] {
    const reglas = this.resultado?.reglas || [];
    const filtro = this.filtroEstado;
    if (!filtro) {
      return reglas;
    }
    return reglas.filter((regla) =>
      regla.estado === filtro || this.reglaTieneEstado(regla, filtro)
    );
  }

  cargarEntidades(): void {
    this.isLoadingEntidades = true;
    this.validadorService.entidades().subscribe({
      next: (arbol) => {
        this.entidadesTree = this.toTree(arbol);
        this.isLoadingEntidades = false;
      },
      error: (err) => {
        this.isLoadingEntidades = false;
        this.messageService.add({
          severity: 'error',
          summary: 'GLPI',
          detail: err?.error?.message || 'No se pudo leer el árbol de entidades.'
        });
      }
    });
  }

  cargarPlantillas(): void {
    this.isLoadingPlantillas = true;
    this.plantillaService.listar().subscribe({
      next: (plantillas) => {
        this.plantillas = plantillas;
        this.isLoadingPlantillas = false;
      },
      error: () => {
        this.isLoadingPlantillas = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Plantillas',
          detail: 'No se pudieron cargar las plantillas.'
        });
      }
    });
  }

  comparar(): void {
    if (!this.puedeComparar || !this.entidadActual || !this.plantillaId) {
      return;
    }

    this.isComparando = true;
    this.filtroEstado = null;
    this.busquedaCategoria = '';
    this.asignandoReglaId = null;
    this.resultado = null;
    this.validadorService.comparar(this.plantillaId, this.entidadActual.id).subscribe({
      next: (resultado) => {
        this.resultado = resultado;
        this.isComparando = false;
      },
      error: (err) => {
        this.isComparando = false;
        this.resultado = null;
        this.messageService.add({
          severity: 'error',
          summary: 'Comparación',
          detail: err?.error?.message || 'No se pudo comparar la plantilla con GLPI.'
        });
      }
    });
  }

  onCambioEntidad(): void {
    this.resultado = null;
    this.filtroEstado = null;
    this.busquedaCategoria = '';
    this.asignandoReglaId = null;
  }

  onCambioPlantilla(): void {
    this.resultado = null;
    this.filtroEstado = null;
    this.busquedaCategoria = '';
    this.asignandoReglaId = null;
  }

  opcionesAns(regla: GlpiComparacionRegla): GlpiAnsPlantillaOpcion[] {
    const usados = new Set(
      (this.resultado?.reglas || [])
        .filter((item) => item !== regla && item.ans_key)
        .map((item) => String(item.ans_key))
    );

    return (this.resultado?.ans_plantilla || []).map((opcion) => ({
      ...opcion,
      disabled: usados.has(opcion.key) && opcion.key !== regla.ans_key
    }));
  }

  ansSinAsignar(): GlpiAnsPlantillaOpcion[] {
    const usados = new Set(
      (this.resultado?.reglas || [])
        .filter((item) => item.ans_key)
        .map((item) => String(item.ans_key))
    );

    return (this.resultado?.ans_plantilla || []).filter((opcion) => !usados.has(opcion.key));
  }

  get etiquetasAnsSinAsignar(): string {
    return this.ansSinAsignar().map((opcion) => opcion.label).join(', ');
  }

  asignarAns(regla: GlpiComparacionRegla): void {
    if (!this.plantillaId || !this.entidadActual || !regla.glpi_id) {
      return;
    }

    this.asignandoReglaId = regla.glpi_id;
    this.validadorService
      .compararRegla(this.plantillaId, this.entidadActual.id, regla.glpi_id, regla.ans_key || null)
      .subscribe({
        next: (actualizada) => {
          if (!this.resultado) {
            this.asignandoReglaId = null;
            return;
          }
          this.resultado.reglas = this.resultado.reglas.map((item) =>
            item.glpi_id === regla.glpi_id ? { ...actualizada, ans_key: actualizada.ans_key ?? null } : item
          );
          this.asignandoReglaId = null;
        },
        error: (err) => {
          this.asignandoReglaId = null;
          this.messageService.add({
            severity: 'error',
            summary: 'Regla',
            detail: err?.error?.message || 'No se pudo comparar esa regla con el ANS elegido.'
          });
        }
      });
  }

  aplicarFiltro(estado: GlpiComparacionEstado | null): void {
    this.filtroEstado = this.filtroEstado === estado ? null : estado;
  }

  etiquetaEstado(estado: GlpiComparacionEstado): string {
    return {
      ok: 'Coincide',
      falta_glpi: 'Falta en GLPI',
      extra_glpi: 'Extra en GLPI',
      diferente: 'Diferente',
      tildes: 'Tildes',
      espacios: 'Espacios',
      tildes_espacios: 'Tildes y espacios'
    }[estado];
  }

  severidadEstado(estado: GlpiComparacionEstado): 'success' | 'danger' | 'warn' | 'info' {
    const mapa: Record<GlpiComparacionEstado, 'success' | 'danger' | 'warn' | 'info'> = {
      ok: 'success',
      falta_glpi: 'danger',
      extra_glpi: 'info',
      diferente: 'warn',
      tildes: 'warn',
      espacios: 'warn',
      tildes_espacios: 'warn'
    };
    return mapa[estado];
  }

  etiquetaPrioridad(valor?: string | null): string {
    return this.prioridades.find((item) => item.value === valor)?.label || valor || '—';
  }

  valor(obj: Record<string, unknown> | null | undefined, campo: string): unknown {
    return obj?.[campo];
  }

  private filtrar(filas: GlpiComparacionFila[]): GlpiComparacionFila[] {
    if (!this.filtroEstado) {
      return filas;
    }
    if (this.filtroEstado === 'diferente') {
      return filas.filter((fila) =>
        ['diferente', 'tildes', 'espacios', 'tildes_espacios'].includes(fila.estado)
      );
    }
    if (this.filtroEstado === 'tildes') {
      return filas.filter((fila) => fila.estado === 'tildes' || fila.estado === 'tildes_espacios');
    }
    if (this.filtroEstado === 'espacios') {
      return filas.filter((fila) => fila.estado === 'espacios' || fila.estado === 'tildes_espacios');
    }
    return filas.filter((fila) => fila.estado === this.filtroEstado);
  }

  private textoCategoria(fila: GlpiComparacionFila): string {
    const plantilla = fila.plantilla || {};
    const glpi = fila.glpi || {};

    return [
      fila.ruta,
      fila.detalle,
      fila.prioridad,
      this.etiquetaEstado(fila.estado),
      plantilla['nombre'],
      glpi['nombre'],
      glpi['ruta']
    ]
      .map((valor) => String(valor || '').toLowerCase())
      .join(' ');
  }

  private reglaTieneEstado(regla: GlpiComparacionRegla, estado: GlpiComparacionEstado): boolean {
    return [...regla.seccion_regla, ...regla.criterios, ...regla.acciones, ...(regla.ans || [])].some(
      (fila) => fila.estado === estado
    );
  }

  private toTree(nodos: GlpiEntidadNodo[], nivel = 1): TreeNode[] {
    return (nodos || []).map((nodo) => {
      const hijas = nodo.hijas || [];
      return {
        key: String(nodo.id),
        label: nodo.nombre,
        data: nodo,
        icon: hijas.length > 0 ? 'pi pi-building' : 'pi pi-map-marker',
        expanded: nivel <= 2,
        children: this.toTree(hijas, nivel + 1)
      };
    });
  }
}
