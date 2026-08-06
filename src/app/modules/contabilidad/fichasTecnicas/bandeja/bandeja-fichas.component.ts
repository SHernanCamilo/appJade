import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { TableLazyLoadEvent } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { map } from 'rxjs';

import { BandejaFichas, Ficha, FiltrosFichas, PaginationMeta } from '../models/ficha.model';
import { FichasTecnicasService } from '../services/fichas-tecnicas.service';
import { interpretarErrorFicha } from '../shared/ficha-error.util';
import { TablaFichasComponent } from './components/tabla-fichas.component';
import type { AccionFicha } from './components/tabla-fichas.component';
import { FiltrosBandejaComponent } from './components/filtros-bandeja.component';

interface MetaBandeja {
  titulo: string;
  descripcion: string;
  vacio: string;
  permiteValidar: boolean;
}

const METADATOS: Record<BandejaFichas, MetaBandeja> = {
  borradores: {
    titulo: 'Borradores',
    descripcion: 'Fichas en elaboración, pendientes de enviar a validación',
    vacio: 'No tiene borradores en curso.',
    permiteValidar: false,
  },
  procesando: {
    titulo: 'En validación',
    descripcion: 'Fichas en proceso de autorización o aprobación',
    vacio: 'No hay fichas en proceso de validación.',
    permiteValidar: false,
  },
  'por-autorizar': {
    titulo: 'Por autorizar',
    descripcion: 'Primer nivel de validación — Dirección Médica',
    vacio: 'No hay fichas pendientes de autorización.',
    permiteValidar: true,
  },
  'por-aprobar': {
    titulo: 'Por aprobar',
    descripcion: 'Segundo nivel de validación — Vicepresidencia Financiera',
    vacio: 'No hay fichas pendientes de aprobación.',
    permiteValidar: true,
  },
  rechazados: {
    titulo: 'Rechazadas',
    descripcion: 'Fichas devueltas para corrección',
    vacio: 'No tiene fichas rechazadas.',
    permiteValidar: false,
  },
  finalizadas: {
    titulo: 'Vigentes',
    descripcion: 'Fichas aprobadas y con vigencia en curso',
    vacio: 'No hay fichas vigentes.',
    permiteValidar: false,
  },
  vencidas: {
    titulo: 'Vencidas',
    descripcion: 'Fichas cuya vigencia ya expiró',
    vacio: 'No hay fichas vencidas.',
    permiteValidar: false,
  },
  'proximas-vencer': {
    titulo: 'Próximas a vencer',
    descripcion: 'Vigencias que expiran en los próximos 30 días',
    vacio: 'Ninguna ficha vence en los próximos 30 días.',
    permiteValidar: false,
  },
};

/**
 * Contenedor (smart) de las bandejas de fichas.
 *
 * Un solo componente cubre las ocho bandejas mediante el parámetro de ruta,
 * reemplazando `borradores.php`, `procesando.php`, `rechazados.php`,
 * `finalizadas.php`, `vencidas.php` y `por_aprobar.php` de los cuatro módulos
 * del legacy (más de 20 archivos casi idénticos).
 */
@Component({
  selector: 'app-bandeja-fichas',
  standalone: true,
  imports: [CommonModule, ToastModule, TablaFichasComponent, FiltrosBandejaComponent],
  providers: [MessageService],
  templateUrl: './bandeja-fichas.component.html',
  styleUrl: './bandeja-fichas.component.css',
})
export class BandejaFichasComponent {
  private readonly fichaService = inject(FichasTecnicasService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly mensajes = inject(MessageService);

  /** Bandeja activa tomada de la ruta; el componente reacciona al cambio. */
  protected readonly bandeja = toSignal(
    this.ruta.paramMap.pipe(map((p) => (p.get('bandeja') ?? 'borradores') as BandejaFichas)),
    { initialValue: 'borradores' as BandejaFichas },
  );

  protected readonly fichas = signal<Ficha[]>([]);
  protected readonly meta = signal<PaginationMeta | null>(null);
  protected readonly cargando = signal<boolean>(true);
  protected readonly filtros = signal<FiltrosFichas>({ per_page: 20, page: 1 });

  protected readonly info = computed<MetaBandeja>(() => METADATOS[this.bandeja()]);

  /** Recarga al cambiar de bandeja sin duplicar peticiones. */
  private ultimaBandeja: BandejaFichas | null = null;

  protected cargar(): void {
    this.cargando.set(true);

    this.fichaService.listar({ ...this.filtros(), bandeja: this.bandeja() }).subscribe({
      next: (respuesta) => {
        this.fichas.set(respuesta.data);
        this.meta.set(respuesta.meta);
        this.cargando.set(false);
      },
      error: (error: unknown) => {
        this.cargando.set(false);
        this.mensajes.add({
          severity: 'error',
          summary: 'No se pudo cargar la bandeja',
          detail: interpretarErrorFicha(error).mensaje,
          life: 6000,
        });
      },
    });
  }

  /** Paginación y orden delegados al servidor por p-table (modo lazy). */
  protected onLazyLoad(evento: TableLazyLoadEvent): void {
    const filas = evento.rows ?? 20;
    const pagina = Math.floor((evento.first ?? 0) / filas) + 1;

    // Al cambiar de bandeja se vuelve a la primera página
    if (this.ultimaBandeja !== this.bandeja()) {
      this.ultimaBandeja = this.bandeja();
      this.filtros.update((f) => ({ ...f, page: 1, per_page: filas }));
    } else {
      this.filtros.update((f) => ({ ...f, page: pagina, per_page: filas }));
    }

    this.cargar();
  }

  protected onFiltros(filtros: FiltrosFichas): void {
    this.filtros.update((f) => ({ ...f, ...filtros, page: 1 }));
    this.cargar();
  }

  protected onAccion(accion: AccionFicha): void {
    const base = '/contabilidad/fichas-tecnicas';
    const id = accion.ficha.id;

    switch (accion.tipo) {
      case 'ver':
        void this.router.navigate([base, 'ficha', id]);
        break;
      case 'editar':
        void this.router.navigate([base, 'ficha', id, 'editar']);
        break;
      case 'validar':
        void this.router.navigate([base, 'ficha', id], { queryParams: { validar: 1 } });
        break;
      case 'actualizar':
        void this.router.navigate([base, 'ficha', id, 'actualizacion']);
        break;
      case 'pdf':
        this.abrirPdf(id);
        break;
      case 'cancelar':
        this.cancelar(accion.ficha);
        break;
    }
  }

  private abrirPdf(id: number): void {
    this.fichaService.descargarPdf(id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: (error: unknown) => {
        this.mensajes.add({
          severity: 'error',
          summary: 'No se pudo generar el PDF',
          detail: interpretarErrorFicha(error).mensaje,
          life: 6000,
        });
      },
    });
  }

  private cancelar(ficha: Ficha): void {
    this.fichaService.cancelar(ficha.id).subscribe({
      next: () => {
        this.mensajes.add({ severity: 'success', summary: 'Ficha cancelada', life: 3000 });
        this.cargar();
      },
      error: (error: unknown) => {
        this.mensajes.add({
          severity: 'error',
          summary: 'No se pudo cancelar',
          detail: interpretarErrorFicha(error).mensaje,
          life: 6000,
        });
      },
    });
  }
}
