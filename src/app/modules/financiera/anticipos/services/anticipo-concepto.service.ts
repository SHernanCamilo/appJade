import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AntiTipo {
  id: number;
  nombre: string;
  descripcion?: string;
  estado: boolean;
}

export interface AntiClase {
  id: number;
  id_tipo: number;
  nombre: string;
  descripcion?: string;
  estado: boolean;
}

export interface AntiModalidad {
  id: number;
  id_clase: number;
  nombre: string;
  descripcion?: string;
  estado: boolean;
}

export interface AntiRegla {
  id?: number;
  id_concepto?: number;
  descripcion: string;
  valor_tope: number;
  estado?: boolean;
}

export interface AntiConcepto {
  id?: number;
  id_tipo: number;
  id_clase: number;
  id_modalidad: number;
  estado: boolean;
  tipo?: AntiTipo;
  clase?: AntiClase;
  modalidad?: AntiModalidad;
  reglas?: AntiRegla[];
  created_at?: string;
  updated_at?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  current_page: number;
  per_page: number;
  last_page: number;
}

/**
 * Servicio de Conceptos de Anticipo.
 *
 * Base URL backend: /api/anticipos
 *
 * Catálogos (lectura simple, AnticipoConceptoController):
 *   GET /anticipos/catalogos/anti-tipos
 *   GET /anticipos/catalogos/anti-clases/{tipoId}
 *   GET /anticipos/catalogos/anti-modalidades/{claseId}
 *
 * CRUD Conceptos:
 *   GET    /anticipos/conceptos
 *   POST   /anticipos/conceptos
 *   GET    /anticipos/conceptos/{id}
 *   PUT    /anticipos/conceptos/{id}
 *   DELETE /anticipos/conceptos/{id}
 *   PATCH  /anticipos/conceptos/{id}/toggle-estado
 */
@Injectable({ providedIn: 'root' })
export class AnticipoConceptoService {
  private readonly base = '/anticipos';
  private readonly catalogos = `${this.base}/catalogos`;
  private readonly conceptosUrl = `${this.base}/conceptos`;

  constructor(private http: HttpClient) {}

  // ── CATÁLOGOS ────────────────────────────────────────────────────────────

  getTipos(): Observable<ApiResponse<AntiTipo[]>> {
    return this.http.get<ApiResponse<AntiTipo[]>>(`${this.catalogos}/anti-tipos`);
  }

  getClasesPorTipo(tipoId: number): Observable<ApiResponse<AntiClase[]>> {
    return this.http.get<ApiResponse<AntiClase[]>>(`${this.catalogos}/anti-clases/${tipoId}`);
  }

  getModalidadesPorClase(claseId: number): Observable<ApiResponse<AntiModalidad[]>> {
    return this.http.get<ApiResponse<AntiModalidad[]>>(`${this.catalogos}/anti-modalidades/${claseId}`);
  }

  // ── CONCEPTOS (CRUD) ─────────────────────────────────────────────────────

  getConceptos(params?: {
    page?: number;
    per_page?: number;
    tipo_id?: number;
    clase_id?: number;
    estado?: boolean;
    search?: string;
  }): Observable<PaginatedResponse<AntiConcepto>> {
    let p = new HttpParams();
    if (params) {
      if (params.page)               p = p.set('page',     params.page.toString());
      if (params.per_page)           p = p.set('per_page', params.per_page.toString());
      if (params.tipo_id)            p = p.set('tipo_id',  params.tipo_id.toString());
      if (params.clase_id)           p = p.set('clase_id', params.clase_id.toString());
      if (params.estado !== undefined) p = p.set('estado', params.estado ? '1' : '0');
      if (params.search)             p = p.set('search',   params.search);
    }
    return this.http.get<PaginatedResponse<AntiConcepto>>(this.conceptosUrl, { params: p });
  }

  getConcepto(id: number): Observable<ApiResponse<AntiConcepto>> {
    return this.http.get<ApiResponse<AntiConcepto>>(`${this.conceptosUrl}/${id}`);
  }

  createConcepto(concepto: {
    id_tipo: number; id_clase: number; id_modalidad: number; estado: boolean; reglas: AntiRegla[];
  }): Observable<ApiResponse<AntiConcepto>> {
    return this.http.post<ApiResponse<AntiConcepto>>(this.conceptosUrl, concepto);
  }

  updateConcepto(id: number, concepto: {
    id_tipo: number; id_clase: number; id_modalidad: number; estado: boolean; reglas: AntiRegla[];
  }): Observable<ApiResponse<AntiConcepto>> {
    return this.http.put<ApiResponse<AntiConcepto>>(`${this.conceptosUrl}/${id}`, concepto);
  }

  deleteConcepto(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.conceptosUrl}/${id}`);
  }

  toggleEstado(id: number): Observable<ApiResponse<AntiConcepto>> {
    return this.http.patch<ApiResponse<AntiConcepto>>(`${this.conceptosUrl}/${id}/toggle-estado`, {});
  }
}
