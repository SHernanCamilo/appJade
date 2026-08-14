import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';

import {
  ActivoFijo,
  ActivosFijosService,
  CampoBusqueda,
  NovedadActivoPayload,
  TrazabilidadActivo
} from '../services/activos-fijos.service';

/** Campos de novedad que el inventariador puede reportar. */
interface FormularioNovedad {
  novedad_placa: string;
  novedad_estado: string;
  novedad_articulo: string;
  novedad_marca: string;
  novedad_modelo: string;
  novedad_serie: string;
  novedad_responsable: string;
  novedad_localizacion: string;
  novedad_tipo_inventario: string;
  novedad_sucursal: string;
  novedad_estado_fisico: string;
  observacion: string;
}

const FORMULARIO_VACIO: FormularioNovedad = {
  novedad_placa: '',
  novedad_estado: '',
  novedad_articulo: '',
  novedad_marca: '',
  novedad_modelo: '',
  novedad_serie: '',
  novedad_responsable: '',
  novedad_localizacion: '',
  novedad_tipo_inventario: '',
  novedad_sucursal: '',
  novedad_estado_fisico: '',
  observacion: ''
};

/**
 * Toma de inventario de activos fijos.
 *
 * Izquierda: datos del activo tal como están en Indigo (solo lectura).
 * Derecha: campos de novedad que el inventariador llena si encuentra diferencia.
 * Abajo: historial de tomas previas del mismo activo.
 */
@Component({
  selector: 'app-toma-inventario-activos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ToastModule, TooltipModule, TableModule, TagModule],
  providers: [MessageService],
  templateUrl: './tomaInventario.component.html',
  styleUrl: './tomaInventario.component.css'
})
export class TomaInventarioComponent implements OnInit {
  private readonly service = inject(ActivosFijosService);
  private readonly messages = inject(MessageService);

  // ── Búsqueda ──────────────────────────────────────────────────────────
  campoBusqueda: CampoBusqueda = 'placa';
  valorBusqueda = '';
  buscando = false;

  readonly camposBusqueda: Array<{ valor: CampoBusqueda; etiqueta: string }> = [
    { valor: 'placa', etiqueta: 'Placa' },
    { valor: 'serie', etiqueta: 'Serie' },
    { valor: 'responsable', etiqueta: 'Responsable' },
    { valor: 'articulo', etiqueta: 'Artículo' }
  ];

  /** Resultados cuando la búsqueda devuelve más de un activo. */
  resultados: ActivoFijo[] = [];

  // ── Activo seleccionado ───────────────────────────────────────────────
  activo: ActivoFijo | null = null;
  historial: TrazabilidadActivo[] = [];
  cargandoHistorial = false;

  // ── Formulario de novedad ─────────────────────────────────────────────
  formulario: FormularioNovedad = { ...FORMULARIO_VACIO };
  guardando = false;

  estados: string[] = [];
  estadosFisicos: string[] = [];

  ngOnInit(): void {
    this.cargarOpciones();
  }

  // =========================================================================
  // BÚSQUEDA
  // =========================================================================

  get puedeBuscar(): boolean {
    return this.valorBusqueda.trim().length >= 2 && !this.buscando;
  }

  consultar(): void {
    if (!this.puedeBuscar) {
      return;
    }

    this.buscando = true;
    this.resultados = [];
    this.activo = null;
    this.historial = [];

    this.service.buscar(this.campoBusqueda, this.valorBusqueda.trim()).subscribe({
      next: respuesta => {
        this.buscando = false;
        const encontrados = respuesta.data ?? [];

        if (encontrados.length === 0) {
          this.messages.add({
            severity: 'warn',
            summary: 'Sin resultados',
            detail: `No se encontró ningún activo con ese ${this.etiquetaCampoActual}.`,
            life: 5000
          });
          return;
        }

        // Un solo resultado: abrir directo. Varios: mostrar lista para elegir.
        if (encontrados.length === 1) {
          this.seleccionar(encontrados[0]);
        } else {
          this.resultados = encontrados;
          this.messages.add({
            severity: 'info',
            summary: `${encontrados.length} activos encontrados`,
            detail: 'Seleccione el activo que va a inventariar.',
            life: 4000
          });
        }
      },
      error: (error: HttpErrorResponse) => {
        this.buscando = false;
        this.messages.add({
          severity: 'error',
          summary: 'Error consultando',
          detail: error.error?.message ?? 'No se pudo consultar el maestro de activos.',
          life: 7000
        });
      }
    });
  }

  seleccionar(activo: ActivoFijo): void {
    this.activo = activo;
    this.resultados = [];
    this.formulario = { ...FORMULARIO_VACIO };

    if (activo.placa) {
      this.cargarHistorial(activo.placa);
    }
  }

  regresar(): void {
    this.activo = null;
    this.resultados = [];
    this.historial = [];
    this.valorBusqueda = '';
    this.formulario = { ...FORMULARIO_VACIO };
  }

  // =========================================================================
  // REGISTRO DE NOVEDAD
  // =========================================================================

  /** Cuenta cuántos campos de novedad tienen valor (para habilitar el botón). */
  get novedadesLlenas(): number {
    return Object.entries(this.formulario)
      .filter(([clave]) => clave !== 'observacion')
      .filter(([, valor]) => valor.trim() !== '').length;
  }

  get puedeRegistrar(): boolean {
    if (!this.activo || this.guardando) {
      return false;
    }
    return this.novedadesLlenas > 0 || this.formulario.observacion.trim() !== '';
  }

  registrar(): void {
    if (!this.puedeRegistrar || !this.activo?.placa) {
      return;
    }

    this.guardando = true;

    const payload: NovedadActivoPayload = { placa: this.activo.placa };

    // Solo se envían los campos con valor: null significa "sin novedad"
    (Object.keys(this.formulario) as Array<keyof FormularioNovedad>).forEach(clave => {
      const valor = this.formulario[clave].trim();
      if (valor !== '') {
        (payload as unknown as Record<string, unknown>)[clave] = valor;
      }
    });

    this.service.registrarNovedad(payload).subscribe({
      next: respuesta => {
        this.guardando = false;
        this.messages.add({
          severity: 'success',
          summary: 'Novedad registrada',
          detail: `Se guardaron ${respuesta.data.total_cambios} cambio(s) para la placa ${this.activo?.placa}.`,
          life: 6000
        });

        this.formulario = { ...FORMULARIO_VACIO };
        if (this.activo?.placa) {
          this.cargarHistorial(this.activo.placa);
        }
      },
      error: (error: HttpErrorResponse) => {
        this.guardando = false;
        this.messages.add({
          severity: 'error',
          summary: 'No se pudo registrar',
          detail: error.error?.message ?? 'Error guardando la novedad.',
          life: 7000
        });
      }
    });
  }

  // =========================================================================
  // HISTORIAL
  // =========================================================================

  private cargarHistorial(placa: string): void {
    this.cargandoHistorial = true;

    this.service.historial(placa).subscribe({
      next: respuesta => {
        this.cargandoHistorial = false;
        this.historial = respuesta.data ?? [];
      },
      error: () => {
        this.cargandoHistorial = false;
        this.historial = [];
      }
    });
  }

  private cargarOpciones(): void {
    this.service.opciones().subscribe({
      next: respuesta => {
        this.estados = respuesta.data?.estados ?? [];
        this.estadosFisicos = respuesta.data?.estados_fisicos ?? [];
      },
      error: () => {
        // Fallback: si el endpoint falla, el formulario sigue usable con los valores conocidos
        this.estados = ['Activo', 'Inactivo'];
        this.estadosFisicos = ['En buen estado', 'Para Reparacion', 'Dar de baja'];
      }
    });
  }

  // =========================================================================
  // HELPERS DE VISTA
  // =========================================================================

  get etiquetaCampoActual(): string {
    return this.camposBusqueda.find(c => c.valor === this.campoBusqueda)?.etiqueta.toLowerCase() ?? 'valor';
  }

  severidadEstadoFisico(estado: string | null): 'success' | 'warn' | 'danger' | 'info' {
    switch (estado) {
      case 'En buen estado': return 'success';
      case 'Para Reparacion': return 'warn';
      case 'Dar de baja': return 'danger';
      default: return 'info';
    }
  }

  /** Muestra un guion cuando el maestro no trae el dato. */
  valor(dato: string | null | undefined): string {
    return dato && dato.trim() !== '' ? dato : '—';
  }
}
