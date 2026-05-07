import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../../environments/environment';

export interface EventNovedad {
  id: number;
  codigo: string;
  descripcion: string;
  cubre: boolean;
  activo: boolean;
}

export interface EventNovedadCargo {
  id: number;
  novedad_id: number;
  empresa_id: number | null;
  cargo_id: number | null;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
  novedad?: EventNovedad;
  empresa?: { id: number; nombre: string };
  cargo?: { id_cargo: number; nombre_cargo: string };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class EventNovedadService {

  private base = `${environment.URL_SERVICIOS}/talento-humano/eventos`;

  constructor(private http: HttpClient) {}

  // ─── Catálogo ─────────────────────────────────────────────────────────────

  getAll(filters: { search?: string; activo?: boolean } = {}): Observable<EventNovedad[]> {
    let params = new HttpParams();
    if (filters.search)              params = params.set('search', filters.search);
    if (filters.activo !== undefined) params = params.set('activo', String(+filters.activo));

    return this.http.get<ApiResponse<EventNovedad[]>>(`${this.base}/novedades`, { params })
      .pipe(map(r => r.data));
  }

  getById(id: number): Observable<EventNovedad> {
    return this.http.get<ApiResponse<EventNovedad>>(`${this.base}/novedades/${id}`)
      .pipe(map(r => r.data));
  }

  create(data: Omit<EventNovedad, 'id'>): Observable<EventNovedad> {
    return this.http.post<ApiResponse<EventNovedad>>(`${this.base}/novedades`, data)
      .pipe(map(r => r.data));
  }

  update(id: number, data: Partial<EventNovedad>): Observable<EventNovedad> {
    return this.http.put<ApiResponse<EventNovedad>>(`${this.base}/novedades/${id}`, data)
      .pipe(map(r => r.data));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/novedades/${id}`);
  }

  // ─── Vinculaciones ────────────────────────────────────────────────────────

  getVinculaciones(filters: { novedad_id?: number; empresa_id?: number; cargo_id?: number } = {}): Observable<EventNovedadCargo[]> {
    let params = new HttpParams();
    if (filters.novedad_id) params = params.set('novedad_id', filters.novedad_id);
    if (filters.empresa_id) params = params.set('empresa_id', filters.empresa_id);
    if (filters.cargo_id)   params = params.set('cargo_id',   filters.cargo_id);

    return this.http.get<ApiResponse<EventNovedadCargo[]>>(`${this.base}/novedad-cargo`, { params })
      .pipe(map(r => r.data));
  }

  vincular(data: { novedad_id: number; empresa_id?: number | null; cargo_id?: number | null; activo?: boolean }): Observable<EventNovedadCargo> {
    return this.http.post<ApiResponse<EventNovedadCargo>>(`${this.base}/novedad-cargo`, data)
      .pipe(map(r => r.data));
  }

  desvincular(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/novedad-cargo/${id}`);
  }

  novedadesAplicables(empresaId: number, cargoId: number): Observable<EventNovedad[]> {
    const params = new HttpParams()
      .set('empresa_id', empresaId)
      .set('cargo_id', cargoId);

    return this.http.get<ApiResponse<EventNovedad[]>>(`${this.base}/novedades-aplicables`, { params })
      .pipe(map(r => r.data));
  }

  // ─── Catálogos auxiliares ─────────────────────────────────────────────────

  getEmpresas(): Observable<{ label: string; value: number }[]> {
    return this.http.get<{ success: boolean; data: any[] }>('/empresas-activas').pipe(
      map(r => r.data.map(e => ({ label: e.nombre, value: e.id })))
    );
  }

  getCargos(): Observable<{ label: string; value: number }[]> {
    return this.http.get<ApiResponse<any[]>>(`${this.base}/cargos`).pipe(
      map(r => r.data.map((c: any) => ({ label: c.nombre_cargo, value: c.id_cargo })))
    );
  }
}
