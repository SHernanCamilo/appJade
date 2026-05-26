import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { Novedad, NovedadTipo } from '../models/novedad.model';

interface ApiResponse<T> { success: boolean; data: T; message?: string; }

@Injectable({ providedIn: 'root' })
export class NovedadService {
  private api     = `${environment.URL_SERVICIOS}/turnos/novedades`;
  private tiposApi = `${environment.URL_SERVICIOS}/turnos/novedad-tipos`;

  constructor(private http: HttpClient) {}

  getAll(params?: { id_cuadro?: number; id_empleado?: number; estado?: string }): Observable<Novedad[]> {
    let p = new HttpParams();
    if (params?.id_cuadro)   p = p.set('id_cuadro', params.id_cuadro);
    if (params?.id_empleado) p = p.set('id_empleado', params.id_empleado);
    if (params?.estado)      p = p.set('estado', params.estado);
    return this.http.get<ApiResponse<Novedad[]>>(this.api, { params: p })
      .pipe(map(r => r.data ?? r as any));
  }

  getById(id: number): Observable<Novedad> {
    return this.http.get<ApiResponse<Novedad>>(`${this.api}/${id}`)
      .pipe(map(r => r.data ?? r as any));
  }

  create(data: Partial<Novedad>): Observable<Novedad> {
    return this.http.post<ApiResponse<Novedad>>(this.api, data)
      .pipe(map(r => r.data ?? r as any));
  }

  update(id: number, data: Partial<Novedad>): Observable<Novedad> {
    return this.http.put<ApiResponse<Novedad>>(`${this.api}/${id}`, data)
      .pipe(map(r => r.data ?? r as any));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }

  aprobar(id: number, comentario?: string): Observable<Novedad> {
    return this.http.post<ApiResponse<Novedad>>(`${this.api}/${id}/aprobar`, { comentario })
      .pipe(map(r => r.data ?? r as any));
  }

  rechazar(id: number, comentario: string): Observable<Novedad> {
    return this.http.post<ApiResponse<Novedad>>(`${this.api}/${id}/rechazar`, { comentario })
      .pipe(map(r => r.data ?? r as any));
  }

  // ── Tipos de novedad ──────────────────────────────────────────────────────

  getTipos(): Observable<NovedadTipo[]> {
    return this.http.get<ApiResponse<NovedadTipo[]>>(this.tiposApi)
      .pipe(map(r => r.data ?? r as any));
  }

  createTipo(data: Partial<NovedadTipo>): Observable<NovedadTipo> {
    return this.http.post<ApiResponse<NovedadTipo>>(this.tiposApi, data)
      .pipe(map(r => r.data ?? r as any));
  }

  updateTipo(id: number, data: Partial<NovedadTipo>): Observable<NovedadTipo> {
    return this.http.put<ApiResponse<NovedadTipo>>(`${this.tiposApi}/${id}`, data)
      .pipe(map(r => r.data ?? r as any));
  }
}
