import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputSwitchModule } from 'primeng/inputswitch';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TabViewModule } from 'primeng/tabview';
import { ToastModule } from 'primeng/toast';

import { CatalogoNombre, PaginationMeta } from '../models/ficha.model';
import { FiltrosCatalogo, ParametrosService, RegistroCatalogo } from '../services/parametros.service';
import { interpretarErrorFicha } from '../shared/ficha-error.util';

interface TabConfig {
  catalogo: CatalogoNombre;
  titulo: string;
  columnas: { campo: string; header: string; width?: string }[];
}

/**
 * CRUD genérico de los catálogos maestros del módulo.
 *
 * Un solo componente con pestañas cubre agremiaciones, profesionales,
 * especialidades, tipos de servicio, objetos de contrato, observaciones y
 * homólogos. Reemplaza los ~20 archivos del `parametrizador/` legacy.
 */
@Component({
  selector: 'app-parametros-ficha',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ToastModule,
    TabViewModule,
    TableModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    InputSwitchModule,
    SelectModule,
    SkeletonModule,
  ],
  providers: [MessageService],
  templateUrl: './parametros-ficha.component.html',
  styleUrl: './parametros-ficha.component.css',
})
export class ParametrosFichaComponent {
  private readonly parametros = inject(ParametrosService);
  private readonly mensajes = inject(MessageService);

  protected readonly tabs: TabConfig[] = [
    { catalogo: 'agremiaciones', titulo: 'Agremiaciones', columnas: [
      { campo: 'nombre', header: 'Nombre' },
      { campo: 'nit', header: 'NIT', width: '10rem' },
      { campo: 'rep_legal', header: 'Representante legal' },
      { campo: 'telefono', header: 'Teléfono', width: '9rem' },
    ]},
    { catalogo: 'profesionales', titulo: 'Profesionales', columnas: [
      { campo: 'documento', header: 'Documento', width: '10rem' },
      { campo: 'nombre', header: 'Nombre' },
      { campo: 'tarjeta_profesional', header: 'RETHUS', width: '10rem' },
    ]},
    { catalogo: 'especialidades', titulo: 'Especialidades', columnas: [
      { campo: 'descripcion', header: 'Descripción' },
      { campo: 'perfil', header: 'Perfil', width: '10rem' },
    ]},
    { catalogo: 'tipos-servicio', titulo: 'Tipos de servicio', columnas: [
      { campo: 'descripcion', header: 'Descripción' },
    ]},
    { catalogo: 'objetos-contrato', titulo: 'Objetos de contrato', columnas: [
      { campo: 'descripcion', header: 'Descripción' },
    ]},
    { catalogo: 'obs-items', titulo: 'Observaciones', columnas: [
      { campo: 'descripcion', header: 'Descripción' },
    ]},
  ];

  protected readonly tabActiva = signal<number>(0);
  protected readonly registros = signal<RegistroCatalogo[]>([]);
  protected readonly meta = signal<PaginationMeta | null>(null);
  protected readonly cargando = signal<boolean>(true);
  protected readonly buscar = signal<string>('');

  protected readonly mostrarDialog = signal<boolean>(false);
  protected readonly registroActual = signal<Partial<RegistroCatalogo>>({});
  protected readonly esEdicion = signal<boolean>(false);
  protected readonly guardando = signal<boolean>(false);

  protected readonly catalogoActual = computed<CatalogoNombre>(() => this.tabs[this.tabActiva()].catalogo);

  constructor() {
    this.cargar();
  }

  protected onCambioTab(indice: number): void {
    this.tabActiva.set(indice);
    this.buscar.set('');
    this.cargar();
  }

  protected onBuscar(): void {
    this.cargar();
  }

  protected onLazyLoad(evento: TableLazyLoadEvent): void {
    const filas = evento.rows ?? 25;
    const pagina = Math.floor((evento.first ?? 0) / filas) + 1;
    this.cargar({ page: pagina, per_page: filas });
  }

  protected nuevoRegistro(): void {
    this.registroActual.set({ estado: true });
    this.esEdicion.set(false);
    this.mostrarDialog.set(true);
  }

  protected editarRegistro(registro: RegistroCatalogo): void {
    this.registroActual.set({ ...registro });
    this.esEdicion.set(true);
    this.mostrarDialog.set(true);
  }

  protected toggleEstado(registro: RegistroCatalogo): void {
    const nuevoEstado = !registro.estado;
    this.parametros.cambiarEstado(this.catalogoActual(), registro.id, nuevoEstado).subscribe({
      next: () => {
        registro.estado = nuevoEstado;
        this.mensajes.add({ severity: 'success', summary: nuevoEstado ? 'Activado' : 'Desactivado', life: 2000 });
      },
      error: (e: unknown) => this.mostrarError(e),
    });
  }

  protected guardar(): void {
    this.guardando.set(true);
    const data = this.registroActual();
    const catalogo = this.catalogoActual();

    const op = this.esEdicion()
      ? this.parametros.actualizar(catalogo, data.id!, data)
      : this.parametros.crear(catalogo, data);

    op.subscribe({
      next: () => {
        this.guardando.set(false);
        this.mostrarDialog.set(false);
        this.mensajes.add({ severity: 'success', summary: this.esEdicion() ? 'Actualizado' : 'Creado', life: 3000 });
        this.cargar();
      },
      error: (e: unknown) => {
        this.guardando.set(false);
        this.mostrarError(e);
      },
    });
  }

  private cargar(paginacion?: { page?: number; per_page?: number }): void {
    this.cargando.set(true);
    const filtros: FiltrosCatalogo = { buscar: this.buscar().trim() || undefined, ...paginacion };

    this.parametros.listar(this.catalogoActual(), filtros).subscribe({
      next: (resp) => {
        this.registros.set(resp.data);
        this.meta.set(resp.meta);
        this.cargando.set(false);
      },
      error: (e: unknown) => {
        this.cargando.set(false);
        this.mostrarError(e);
      },
    });
  }

  private mostrarError(e: unknown): void {
    this.mensajes.add({ severity: 'error', summary: 'Error', detail: interpretarErrorFicha(e).mensaje, life: 6000 });
  }
}
