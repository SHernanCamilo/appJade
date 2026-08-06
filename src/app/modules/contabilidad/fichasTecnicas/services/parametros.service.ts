import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';

import {
  ApiResponse,
  CatalogoNombre,
  ObsItem,
  OpcionesFormulario,
  PaginatedResponse,
  Profesional,
  ProfesionalDeEspecialidad,
} from '../models/ficha.model';

/** Registro genérico de un catálogo administrable. */
export interface RegistroCatalogo {
  id: number;
  estado?: boolean;
  [clave: string]: string | number | boolean | null | undefined | object;
}

export interface FiltrosCatalogo {
  buscar?: string;
  estado?: boolean;
  page?: number;
  per_page?: number;
}

/**
 * Catálogos maestros y cascadas de formulario.
 *
 * Un único servicio cubre los siete catálogos, replicando el CRUD genérico del
 * backend y reemplazando los ~20 archivos de `parametrizador/` del legacy.
 */
@Injectable({ providedIn: 'root' })
export class ParametrosService {
  private readonly http = inject(HttpClient);
  private readonly base = '/fichas-tecnicas/parametros';

  /** Cache en memoria: las opciones cambian poco durante una sesión. */
  private opciones$?: Observable<OpcionesFormulario>;

  // ── Opciones y cascadas ───────────────────────────────────────────────

  opcionesFormulario(refrescar = false): Observable<OpcionesFormulario> {
    if (refrescar || !this.opciones$) {
      this.opciones$ = this.http
        .get<ApiResponse<OpcionesFormulario>>(`${this.base}/opciones`)
        .pipe(
          map((r) => r.data),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
    }

    return this.opciones$;
  }

  /** Profesionales que atienden una especialidad (cascada del paso 1). */
  profesionalesPorEspecialidad(idEspecialidad: number): Observable<ProfesionalDeEspecialidad[]> {
    return this.http
      .get<ApiResponse<ProfesionalDeEspecialidad[]>>(`${this.base}/especialidades/${idEspecialidad}/profesionales`)
      .pipe(map((r) => r.data));
  }

  /** Observaciones aplicables a un tipo de servicio (cascada del paso 2). */
  observacionesPorTipoServicio(idTipoServicio: number): Observable<ObsItem[]> {
    return this.http
      .get<ApiResponse<ObsItem[]>>(`${this.base}/tipos-servicio/${idTipoServicio}/observaciones`)
      .pipe(map((r) => r.data));
  }

  // ── CRUD genérico ─────────────────────────────────────────────────────

  listar(catalogo: CatalogoNombre, filtros: FiltrosCatalogo = {}): Observable<PaginatedResponse<RegistroCatalogo>> {
    let params = new HttpParams();

    if (filtros.buscar) {
      params = params.set('buscar', filtros.buscar);
    }
    if (filtros.estado !== undefined) {
      params = params.set('estado', String(filtros.estado));
    }
    if (filtros.page) {
      params = params.set('page', String(filtros.page));
    }
    if (filtros.per_page) {
      params = params.set('per_page', String(filtros.per_page));
    }

    return this.http.get<PaginatedResponse<RegistroCatalogo>>(`${this.base}/${catalogo}`, { params });
  }

  crear(catalogo: CatalogoNombre, payload: Partial<RegistroCatalogo>): Observable<RegistroCatalogo> {
    return this.http
      .post<ApiResponse<RegistroCatalogo>>(`${this.base}/${catalogo}`, payload)
      .pipe(map((r) => this.invalidarYDevolver(r.data)));
  }

  actualizar(catalogo: CatalogoNombre, id: number, payload: Partial<RegistroCatalogo>): Observable<RegistroCatalogo> {
    return this.http
      .put<ApiResponse<RegistroCatalogo>>(`${this.base}/${catalogo}/${id}`, payload)
      .pipe(map((r) => this.invalidarYDevolver(r.data)));
  }

  /** Desactivación lógica: en este módulo nunca se borra físicamente. */
  cambiarEstado(catalogo: CatalogoNombre, id: number, estado: boolean): Observable<RegistroCatalogo> {
    return this.http
      .patch<ApiResponse<RegistroCatalogo>>(`${this.base}/${catalogo}/${id}/estado`, { estado })
      .pipe(map((r) => this.invalidarYDevolver(r.data)));
  }

  // ── Relaciones N:M ────────────────────────────────────────────────────

  asignarEspecialidades(idProfesional: number, especialidades: number[]): Observable<Profesional> {
    return this.http
      .post<ApiResponse<Profesional>>(`${this.base}/profesionales/${idProfesional}/especialidades`, { especialidades })
      .pipe(map((r) => r.data));
  }

  asignarTiposServicio(idObsItem: number, tiposServicio: number[]): Observable<ObsItem> {
    return this.http
      .post<ApiResponse<ObsItem>>(`${this.base}/obs-items/${idObsItem}/tipos-servicio`, {
        tipos_servicio: tiposServicio,
      })
      .pipe(map((r) => r.data));
  }

  private invalidarYDevolver<T>(dato: T): T {
    this.opciones$ = undefined;

    return dato;
  }
}
