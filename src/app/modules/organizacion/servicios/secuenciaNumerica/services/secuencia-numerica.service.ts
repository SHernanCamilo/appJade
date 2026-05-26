import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface SecPatron {
  id: number;
  empresa_id: number;
  nombre: string;
  patron: string;
  descripcion?: string;
  estado: boolean;
  created_by?: number;
  created_at?: string;
  updated_at?: string;
  creador?: { id: number; name: string };
}

export interface SecDetalle {
  id: number;
  secuencia_id: number;
  patron_id: number;
  sucursal_id?: number | null;
  sede_id?: number | null;
  siguiente_numero: number;
  estado: boolean;
  created_by?: number;
  patron?: SecPatron;
  sucursal?: { id: number; nombre: string };
  sede?: { id: number; nombre: string };
}

export interface SecSecuencia {
  id: number;
  empresa_id: number;
  modulo_id: number;
  proceso_id?: number | null;
  es_manual: boolean;
  ambito: 'empresa' | 'sucursal' | 'sede';
  es_secuencial: boolean;
  rango: number;
  estado: boolean;
  created_by?: number;
  created_at?: string;
  updated_at?: string;
  modulo?: { id: number; nombre: string; codigo: string };
  proceso?: { id: number; nombre: string; codigo: string };
  detalles?: SecDetalle[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class SecuenciaNumericaService {
  private baseUrl = '/config/secuencias';

  constructor(private http: HttpClient) {}

  // ── Patrones ────────────────────────────────────────────────────────────────

  getPatrones(empresaId?: number, soloActivos = false): Observable<ApiResponse<SecPatron[]>> {
    let params = new HttpParams();
    if (empresaId) params = params.set('empresa_id', empresaId.toString());
    if (soloActivos) params = params.set('solo_activos', 'true');
    return this.http.get<ApiResponse<SecPatron[]>>(`${this.baseUrl}/patrones`, { params });
  }

  getPatron(id: number): Observable<ApiResponse<SecPatron>> {
    return this.http.get<ApiResponse<SecPatron>>(`${this.baseUrl}/patrones/${id}`);
  }

  createPatron(data: Partial<SecPatron>): Observable<ApiResponse<SecPatron>> {
    return this.http.post<ApiResponse<SecPatron>>(`${this.baseUrl}/patrones`, data);
  }

  updatePatron(id: number, data: Partial<SecPatron>): Observable<ApiResponse<SecPatron>> {
    return this.http.put<ApiResponse<SecPatron>>(`${this.baseUrl}/patrones/${id}`, data);
  }

  deletePatron(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/patrones/${id}`);
  }

  // ── Secuencias ──────────────────────────────────────────────────────────────

  getSecuencias(filtros?: { empresa_id?: number; modulo_id?: number; solo_activos?: boolean }): Observable<ApiResponse<SecSecuencia[]>> {
    let params = new HttpParams();
    if (filtros?.empresa_id) params = params.set('empresa_id', filtros.empresa_id.toString());
    if (filtros?.modulo_id)  params = params.set('modulo_id', filtros.modulo_id.toString());
    if (filtros?.solo_activos) params = params.set('solo_activos', 'true');
    return this.http.get<ApiResponse<SecSecuencia[]>>(this.baseUrl, { params });
  }

  getSecuencia(id: number): Observable<ApiResponse<SecSecuencia>> {
    return this.http.get<ApiResponse<SecSecuencia>>(`${this.baseUrl}/${id}`);
  }

  createSecuencia(data: Partial<SecSecuencia>): Observable<ApiResponse<SecSecuencia>> {
    return this.http.post<ApiResponse<SecSecuencia>>(this.baseUrl, data);
  }

  updateSecuencia(id: number, data: Partial<SecSecuencia>): Observable<ApiResponse<SecSecuencia>> {
    return this.http.put<ApiResponse<SecSecuencia>>(`${this.baseUrl}/${id}`, data);
  }

  deleteSecuencia(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/${id}`);
  }

  previsualizar(empresaId: number, moduloId: number, procesoId?: number, unidadId?: number): Observable<ApiResponse<string>> {
    let params = new HttpParams()
      .set('empresa_id', empresaId.toString())
      .set('modulo_id', moduloId.toString());
    if (procesoId) params = params.set('proceso_id', procesoId.toString());
    if (unidadId)  params = params.set('unidad_id', unidadId.toString());
    return this.http.get<ApiResponse<string>>(`${this.baseUrl}/previsualizar`, { params });
  }

  // ── Detalles ────────────────────────────────────────────────────────────────

  getDetalles(secuenciaId: number): Observable<ApiResponse<SecDetalle[]>> {
    return this.http.get<ApiResponse<SecDetalle[]>>(`${this.baseUrl}/${secuenciaId}/detalles`);
  }

  createDetalle(secuenciaId: number, data: Partial<SecDetalle>): Observable<ApiResponse<SecDetalle>> {
    return this.http.post<ApiResponse<SecDetalle>>(`${this.baseUrl}/${secuenciaId}/detalles`, data);
  }

  updateDetalle(secuenciaId: number, detalleId: number, data: Partial<SecDetalle>): Observable<ApiResponse<SecDetalle>> {
    return this.http.put<ApiResponse<SecDetalle>>(`${this.baseUrl}/${secuenciaId}/detalles/${detalleId}`, data);
  }

  deleteDetalle(secuenciaId: number, detalleId: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/${secuenciaId}/detalles/${detalleId}`);
  }
}
