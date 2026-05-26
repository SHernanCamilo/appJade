import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { Asignacion } from '../models/asignacion.model';

interface ApiResponse<T> { success: boolean; data: T; message?: string; }

@Injectable({ providedIn: 'root' })
export class AsignacionService {
  private api = `${environment.URL_SERVICIOS}/turnos/asignaciones`;
  private empleadosApi = `${environment.URL_SERVICIOS}/turnos/empleados`;

  constructor(private http: HttpClient) {}

  getById(id: number): Observable<Asignacion> {
    return this.http.get<ApiResponse<Asignacion>>(`${this.api}/${id}`)
      .pipe(map(r => r.data ?? r as any));
  }

  create(data: Partial<Asignacion>): Observable<Asignacion> {
    return this.http.post<ApiResponse<Asignacion>>(this.api, data)
      .pipe(map(r => r.data ?? r as any));
  }

  update(id: number, data: Partial<Asignacion>): Observable<Asignacion> {
    return this.http.put<ApiResponse<Asignacion>>(`${this.api}/${id}`, data)
      .pipe(map(r => r.data ?? r as any));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }

  getTurnosEmpleado(idEmpleado: number, anio: number, mes: number): Observable<Asignacion[]> {
    const p = new HttpParams().set('anio', anio).set('mes', mes);
    return this.http.get<ApiResponse<Asignacion[]>>(`${this.empleadosApi}/${idEmpleado}/turnos`, { params: p })
      .pipe(map(r => r.data ?? r as any));
  }
}
