import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { Cuadro, CuadroGrilla } from '../models/cuadro.model';
import { AsignacionMasiva, ResultadoMasivo } from '../models/asignacion.model';

interface ApiResponse<T> { success: boolean; data: T; message?: string; }

@Injectable({ providedIn: 'root' })
export class CuadroService {
  private api = `${environment.URL_SERVICIOS}/turnos/cuadros`;

  constructor(private http: HttpClient) {}

  getAll(params?: { id_grupo?: number; anio?: number; mes?: number; estado?: string }): Observable<Cuadro[]> {
    let p = new HttpParams();
    if (params?.id_grupo) p = p.set('id_grupo', params.id_grupo);
    if (params?.anio)     p = p.set('anio', params.anio);
    if (params?.mes)      p = p.set('mes', params.mes);
    if (params?.estado)   p = p.set('estado', params.estado);
    return this.http.get<ApiResponse<Cuadro[]>>(this.api, { params: p })
      .pipe(map(r => r.data ?? r as any));
  }

  getById(id: number): Observable<Cuadro> {
    return this.http.get<ApiResponse<Cuadro>>(`${this.api}/${id}`)
      .pipe(map(r => r.data ?? r as any));
  }

  create(data: { id_grupo: number; anio: number; mes: number; observaciones?: string }): Observable<Cuadro> {
    return this.http.post<ApiResponse<Cuadro>>(this.api, data)
      .pipe(map(r => r.data ?? r as any));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }

  publicar(id: number): Observable<Cuadro> {
    return this.http.post<ApiResponse<Cuadro>>(`${this.api}/${id}/publicar`, {})
      .pipe(map(r => r.data ?? r as any));
  }

  cerrar(id: number): Observable<Cuadro> {
    return this.http.post<ApiResponse<Cuadro>>(`${this.api}/${id}/cerrar`, {})
      .pipe(map(r => r.data ?? r as any));
  }

  getGrilla(id: number): Observable<CuadroGrilla> {
    return this.http.get<ApiResponse<CuadroGrilla>>(`${this.api}/${id}/grilla`)
      .pipe(map(r => r.data ?? r as any));
  }

  asignarMasivo(id: number, asignaciones: AsignacionMasiva[]): Observable<ResultadoMasivo> {
    return this.http.post<ApiResponse<ResultadoMasivo>>(`${this.api}/${id}/asignaciones`, { asignaciones })
      .pipe(map(r => r.data ?? r as any));
  }
}
