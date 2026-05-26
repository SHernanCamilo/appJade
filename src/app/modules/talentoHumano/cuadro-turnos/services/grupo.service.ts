import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { Grupo, GrupoEncargado, GrupoEmpleado } from '../models/grupo.model';

interface ApiResponse<T> { success: boolean; data: T; message?: string; }

@Injectable({ providedIn: 'root' })
export class GrupoService{
  private api = `${environment.URL_SERVICIOS}/turnos/grupos`;

  constructor(private http: HttpClient) { }

  getAll(params?: { id_empresa?: number; id_sede?: number; estado?: boolean }): Observable<Grupo[]> {
    let p = new HttpParams();
    if (params?.id_empresa) p = p.set('id_empresa', params.id_empresa);
    if (params?.id_sede) p = p.set('id_sede', params.id_sede);
    if (params?.estado !== undefined) p = p.set('estado', params.estado ? '1' : '0');
    return this.http.get<ApiResponse<Grupo[]>>(this.api, { params: p })
      .pipe(map(r => r.data ?? r as any));
  }

  getById(id: number): Observable<Grupo> {
    return this.http.get<ApiResponse<Grupo>>(`${this.api}/${id}`)
      .pipe(map(r => r.data ?? r as any));
  }

  create(data: Partial<Grupo>): Observable<Grupo> {
    return this.http.post<ApiResponse<Grupo>>(this.api, data)
      .pipe(map(r => r.data ?? r as any));
  }

  update(id: number, data: Partial<Grupo>): Observable<Grupo> {
    return this.http.put<ApiResponse<Grupo>>(`${this.api}/${id}`, data)
      .pipe(map(r => r.data ?? r as any));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }

  // ── Encargados ────────────────────────────────────────────────────────────

  asignarEncargado(id: number, data: { id_user: number; fecha_inicio: string; motivo?: string }): Observable<GrupoEncargado> {
    return this.http.post<ApiResponse<GrupoEncargado>>(`${this.api}/${id}/encargado`, data)
      .pipe(map(r => r.data ?? r as any));
  }

  getHistorialEncargados(id: number): Observable<GrupoEncargado[]> {
    return this.http.get<ApiResponse<GrupoEncargado[]>>(`${this.api}/${id}/encargado/historial`)
      .pipe(map(r => r.data ?? r as any));
  }

  // ── Empleados ─────────────────────────────────────────────────────────────

  getEmpleados(id: number, incluirHistorico = false): Observable<GrupoEmpleado[]> {
    const p = new HttpParams().set('incluir_historico', incluirHistorico ? 'true' : 'false');
    return this.http.get<ApiResponse<GrupoEmpleado[]>>(`${this.api}/${id}/empleados`, { params: p })
      .pipe(map(r => r.data ?? r as any));
  }

  agregarEmpleado(id: number, data: { id_empleado: number; fecha_ingreso: string }): Observable<GrupoEmpleado> {
    return this.http.post<ApiResponse<GrupoEmpleado>>(`${this.api}/${id}/empleados`, data)
      .pipe(map(r => r.data ?? r as any));
  }

  retirarEmpleado(idGrupo: number, idEmpleado: number, fechaSalida: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/${idGrupo}/empleados/${idEmpleado}`, {
      body: { fecha_salida: fechaSalida }
    });
  }
}