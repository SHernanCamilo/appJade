import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, of, shareReplay } from 'rxjs';

import {
  ApiResponse,
  Cups,
  CupsGrupo,
  CupsSubgrupo,
  FichaPorCups,
  Homologo,
  PaginatedResponse,
  TarifaSoat,
} from '../models/ficha.model';

export interface FiltrosCups {
  buscar?: string;
  resolucion?: string;
  grupo?: string;
  subgrupo?: string;
  page?: number;
  per_page?: number;
}

export interface FiltrosHomologos {
  buscar?: string;
  tipo_manual?: string;
  code_cups?: string;
  id_tipo_servicio?: number;
  page?: number;
  per_page?: number;
}

export type ManualRuta = 'iss' | 'soat' | 'institucional';

/**
 * Consulta de tarifarios: CUPS, homólogos y SOAT.
 *
 * Toda la búsqueda y paginación ocurre en el servidor. El legacy descargaba las
 * tablas completas (~9.400 CUPS, ~14.000 homólogos) al navegador para que
 * DataTables paginara en el cliente.
 */
@Injectable({ providedIn: 'root' })
export class CupsService {
  private readonly http = inject(HttpClient);
  private readonly base = '/fichas-tecnicas';

  /** Catálogos normativos: se cachean por sesión. */
  private grupos$?: Observable<CupsGrupo[]>;
  private readonly subgruposCache = new Map<string, Observable<CupsSubgrupo[]>>();

  // ── CUPS ──────────────────────────────────────────────────────────────

  buscarCups(filtros: FiltrosCups = {}): Observable<PaginatedResponse<Cups>> {
    return this.http.get<PaginatedResponse<Cups>>(`${this.base}/cups`, {
      params: this.aParams(filtros as Record<string, string | number | boolean | undefined | null>),
    });
  }

  /** Autocompletado: exige al menos 2 caracteres. */
  autocompletarCups(termino: string, limite = 20): Observable<Cups[]> {
    if (termino.trim().length < 2) {
      return of([]);
    }

    return this.http
      .get<ApiResponse<Cups[]>>(`${this.base}/cups/autocompletar`, {
        params: { q: termino.trim(), limit: String(limite) },
      })
      .pipe(map((r) => r.data));
  }

  grupos(): Observable<CupsGrupo[]> {
    this.grupos$ ??= this.http
      .get<ApiResponse<CupsGrupo[]>>(`${this.base}/cups/grupos`)
      .pipe(
        map((r) => r.data),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    return this.grupos$;
  }

  subgrupos(grupo?: string): Observable<CupsSubgrupo[]> {
    const clave = grupo ?? '__todos__';

    if (!this.subgruposCache.has(clave)) {
      let params = new HttpParams();
      if (grupo) {
        params = params.set('grupo', grupo);
      }

      this.subgruposCache.set(
        clave,
        this.http
          .get<ApiResponse<CupsSubgrupo[]>>(`${this.base}/cups/subgrupos`, { params })
          .pipe(
            map((r) => r.data),
            shareReplay({ bufferSize: 1, refCount: false }),
          ),
      );
    }

    return this.subgruposCache.get(clave)!;
  }

  // ── Homólogos ─────────────────────────────────────────────────────────

  buscarHomologos(filtros: FiltrosHomologos = {}): Observable<PaginatedResponse<Homologo>> {
    return this.http.get<PaginatedResponse<Homologo>>(`${this.base}/homologos`, {
      params: this.aParams(filtros as Record<string, string | number | boolean | undefined | null>),
    });
  }

  autocompletarHomologos(termino: string, limite = 20): Observable<Homologo[]> {
    if (termino.trim().length < 2) {
      return of([]);
    }

    return this.http
      .get<ApiResponse<Homologo[]>>(`${this.base}/homologos/autocompletar`, {
        params: { q: termino.trim(), limit: String(limite) },
      })
      .pipe(map((r) => r.data));
  }

  /** Homólogos de un CUPS (cascada del paso 2 del generador). */
  homologosDeCups(codeCups: string): Observable<Homologo[]> {
    return this.http
      .get<ApiResponse<Homologo[]>>(`${this.base}/cups/${codeCups}/homologos`)
      .pipe(map((r) => r.data));
  }

  tarifario(manual: ManualRuta, buscar?: string, page = 1, perPage = 25): Observable<PaginatedResponse<Homologo>> {
    return this.http.get<PaginatedResponse<Homologo>>(`${this.base}/tarifarios/${manual}`, {
      params: this.aParams({ buscar, page, per_page: perPage }),
    });
  }

  // ── SOAT ──────────────────────────────────────────────────────────────

  buscarSoat(buscar?: string, vigencia = 2023, page = 1, perPage = 25): Observable<PaginatedResponse<TarifaSoat>> {
    return this.http.get<PaginatedResponse<TarifaSoat>>(`${this.base}/soat`, {
      params: this.aParams({ buscar, vigencia, page, per_page: perPage }),
    });
  }

  vigenciasSoat(): Observable<number[]> {
    return this.http
      .get<ApiResponse<number[]>>(`${this.base}/soat/vigencias`)
      .pipe(map((r) => r.data));
  }

  // ── Trazabilidad ──────────────────────────────────────────────────────

  /** Fichas vigentes que contratan un CUPS determinado. */
  fichasPorCups(cups: string, sucursales: string[] = [], vigencia?: 'vigente' | 'vencida'): Observable<FichaPorCups[]> {
    let params = new HttpParams();

    sucursales.forEach((s) => {
      params = params.append('sucursal[]', s);
    });

    if (vigencia) {
      params = params.set('vigencia', vigencia);
    }

    return this.http
      .get<ApiResponse<FichaPorCups[]>>(`${this.base}/cups/${cups}/fichas`, { params })
      .pipe(map((r) => r.data));
  }

  private aParams(filtros: Record<string, string | number | boolean | undefined | null>): HttpParams {
    let params = new HttpParams();

    Object.entries(filtros).forEach(([clave, valor]) => {
      if (valor !== undefined && valor !== null && valor !== '') {
        params = params.set(clave, String(valor));
      }
    });

    return params;
  }
}
