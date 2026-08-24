import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { ToastModule } from 'primeng/toast';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';

import {
  ActivosFijosService,
  TipoInventario,
  TipoInventarioPayload,
  Periodicidad
} from '../services/activos-fijos.service';

interface FormularioTipo {
  nombre: string;
  periodicidad: Periodicidad | '';
  descripcion: string;
  activo: boolean;
}

const FORMULARIO_VACIO: FormularioTipo = {
  nombre: '',
  periodicidad: '',
  descripcion: '',
  activo: true
};

@Component({
  selector: 'app-parametros-tipos-inventario',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ToastModule,
    TableModule,
    TagModule,
    TooltipModule,
    ConfirmDialogModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './parametrosTiposInventario.component.html',
  styleUrl: './parametrosTiposInventario.component.css'
})
export class ParametrosTiposInventarioComponent implements OnInit {
  private readonly service = inject(ActivosFijosService);
  private readonly messages = inject(MessageService);
  private readonly confirmar = inject(ConfirmationService);

  tipos: TipoInventario[] = [];
  cargando = false;
  guardando = false;
  eliminando: number | null = null;

  /** Estado del dialog */
  dialogVisible = false;
  modoEdicion = false;
  idEditando: number | null = null;

  formulario: FormularioTipo = { ...FORMULARIO_VACIO };

  readonly opciones: Array<{ valor: Periodicidad; etiqueta: string; descripcion: string }> = [
    { valor: 'anual',       etiqueta: 'Anual',        descripcion: 'Máximo 1 registro por activo por año' },
    { valor: 'mensual',     etiqueta: 'Mensual',      descripcion: 'Máximo 1 registro por activo por mes' },
    { valor: 'semestral',   etiqueta: 'Semestral',    descripcion: 'Máximo 1 registro por activo cada 6 meses' },
    { valor: 'trimestral',  etiqueta: 'Trimestral',   descripcion: 'Máximo 1 registro por activo cada 3 meses' },
    { valor: 'semanal',     etiqueta: 'Semanal',      descripcion: 'Máximo 1 registro por activo por semana' },
    { valor: 'ninguna',     etiqueta: 'Sin restricción', descripcion: 'Sin límite de registros' }
  ];

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.service.listarTiposInventario().subscribe({
      next: resp => {
        this.cargando = false;
        this.tipos = resp.data ?? [];
      },
      error: () => {
        this.cargando = false;
        this.messages.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los tipos de inventario.',
          life: 5000
        });
      }
    });
  }

  // ── Dialog ─────────────────────────────────────────────────────────────

  abrirCrear(): void {
    this.modoEdicion = false;
    this.idEditando = null;
    this.formulario = { ...FORMULARIO_VACIO };
    this.dialogVisible = true;
  }

  abrirEditar(tipo: TipoInventario): void {
    this.modoEdicion = true;
    this.idEditando = tipo.id;
    this.formulario = {
      nombre: tipo.nombre,
      periodicidad: tipo.periodicidad,
      descripcion: tipo.descripcion ?? '',
      activo: tipo.activo
    };
    this.dialogVisible = true;
  }

  cerrarDialog(): void {
    this.dialogVisible = false;
    this.formulario = { ...FORMULARIO_VACIO };
    this.idEditando = null;
  }

  get formularioValido(): boolean {
    return this.formulario.nombre.trim().length >= 3 &&
           this.formulario.periodicidad !== '';
  }

  guardar(): void {
    if (!this.formularioValido || this.guardando) return;

    this.guardando = true;

    const payload: TipoInventarioPayload = {
      nombre: this.formulario.nombre.trim(),
      periodicidad: this.formulario.periodicidad as Periodicidad,
      descripcion: this.formulario.descripcion.trim() || null,
      activo: this.formulario.activo
    };

    const operacion = this.modoEdicion && this.idEditando !== null
      ? this.service.actualizarTipoInventario(this.idEditando, payload)
      : this.service.crearTipoInventario(payload);

    operacion.subscribe({
      next: resp => {
        this.guardando = false;
        this.messages.add({
          severity: 'success',
          summary: this.modoEdicion ? 'Tipo actualizado' : 'Tipo creado',
          detail: `"${resp.data.nombre}" se ${this.modoEdicion ? 'actualizó' : 'creó'} correctamente.`,
          life: 4000
        });
        this.cerrarDialog();
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        this.guardando = false;
        const msg = err.error?.message ?? (err.error?.errors
          ? Object.values(err.error.errors as Record<string, string[]>).flat().join(' ')
          : 'Error al guardar.');
        this.messages.add({
          severity: 'error',
          summary: 'Error guardando',
          detail: msg,
          life: 7000
        });
      }
    });
  }

  // ── Toggle activo/inactivo ──────────────────────────────────────────────

  toggleEstado(tipo: TipoInventario): void {
    const accionTexto = tipo.activo ? 'desactivar' : 'activar';
    this.confirmar.confirm({
      message: `¿Desea ${accionTexto} el tipo <strong>${tipo.nombre}</strong>?`,
      header: 'Cambiar estado',
      icon: 'pi pi-question-circle',
      acceptLabel: 'Sí, continuar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-sm',
      rejectButtonStyleClass: 'p-button-sm p-button-outlined',
      accept: () => {
        this.service.toggleEstadoTipoInventario(tipo.id).subscribe({
          next: resp => {
            const idx = this.tipos.findIndex(t => t.id === tipo.id);
            if (idx >= 0) this.tipos[idx] = resp.data;
            this.messages.add({
              severity: 'info',
              summary: 'Estado actualizado',
              detail: resp.data.activo ? `"${resp.data.nombre}" está activo.` : `"${resp.data.nombre}" está inactivo.`,
              life: 3500
            });
          },
          error: (err: HttpErrorResponse) => {
            this.messages.add({
              severity: 'error',
              summary: 'Error',
              detail: err.error?.message ?? 'No se pudo cambiar el estado.',
              life: 5000
            });
          }
        });
      }
    });
  }

  // ── Eliminar ────────────────────────────────────────────────────────────

  eliminar(tipo: TipoInventario): void {
    this.confirmar.confirm({
      message: `¿Eliminar <strong>${tipo.nombre}</strong>? Solo es posible si no tiene registros asociados.`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-sm p-button-danger',
      rejectButtonStyleClass: 'p-button-sm p-button-outlined',
      accept: () => {
        this.eliminando = tipo.id;
        this.service.eliminarTipoInventario(tipo.id).subscribe({
          next: () => {
            this.eliminando = null;
            this.tipos = this.tipos.filter(t => t.id !== tipo.id);
            this.messages.add({
              severity: 'success',
              summary: 'Eliminado',
              detail: `"${tipo.nombre}" fue eliminado.`,
              life: 3500
            });
          },
          error: (err: HttpErrorResponse) => {
            this.eliminando = null;
            this.messages.add({
              severity: 'error',
              summary: 'No se pudo eliminar',
              detail: err.error?.message ?? 'Error al eliminar.',
              life: 7000
            });
          }
        });
      }
    });
  }

  // ── Helpers de vista ────────────────────────────────────────────────────

  periodicidadNombre(p: string): string {
    return this.opciones.find(o => o.valor === p)?.etiqueta ?? p;
  }

  periodicidadDescripcion(p: string): string {
    return this.opciones.find(o => o.valor === p)?.descripcion ?? '';
  }

  severidadPeriodicidad(p: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const mapa: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary'> = {
      anual:       'info',
      mensual:     'success',
      semestral:   'info',
      trimestral:  'success',
      semanal:     'warn',
      ninguna:     'secondary'
    };
    return mapa[p] ?? 'info';
  }
}
