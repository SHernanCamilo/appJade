import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';

export interface Novedad {
  id: number;
  consecutivo: string;
  empleado_id: number;
  empleado: string;
  aprobador_id?: number;
  aprobador?: string;
  unidad_funcional?: string;
  fecha_inicial: string;
  fecha_final: string;
  descripcion?: string;
  estado: 'proceso' | 'rechazada' | 'aprobada';
  motivo_rechazo?: string;
}

export interface CreateNovedadRequest {
  empleado_id: number;
  aprobador_id?: number;
  unidad_funcional?: string;
  fecha_inicial: string;
  fecha_final: string;
  descripcion?: string;
}

export interface EmpleadoOption {
  id: number;
  nombre: string;
}

@Injectable({ providedIn: 'root' })
export class NovedadesService {
  private apiUrl = environment.URL_SERVICIOS + '/talento-humano/novedades';
  private empleadosUrl = environment.URL_SERVICIOS + '/talento-humano/empleados';

  constructor(private http: HttpClient) {}

  getEmpleados(): Observable<EmpleadoOption[]> {
    return this.http.get<EmpleadoOption[]>(this.empleadosUrl);
  }

  getNovedadesPorEstado(estado: string): Observable<Novedad[]> {
    return this.http.get<Novedad[]>(`${this.apiUrl}?estado=${estado}`);
  }

  getNovedadById(id: number): Observable<Novedad> {
    return this.http.get<Novedad>(`${this.apiUrl}/${id}`);
  }

  createNovedad(data: CreateNovedadRequest): Observable<Novedad> {
    return this.http.post<Novedad>(this.apiUrl, data);
  }

  updateNovedad(id: number, data: Partial<CreateNovedadRequest>): Observable<Novedad> {
    return this.http.put<Novedad>(`${this.apiUrl}/${id}`, data);
  }

  deleteNovedad(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  consultarEstado(id: number): Observable<Novedad> {
    return this.http.get<Novedad>(`${this.apiUrl}/${id}/estado`);
  }
}
