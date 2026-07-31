import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

export interface TipoRecargo {
  id?: number;
  codigo: string;
  nombre: string;
  porcentaje: number;
  es_hora_extra: boolean;
  aplica_dominical_festivo: boolean;
  hora_inicio?: string | null;
  hora_fin?: string | null;
  activo: boolean;
}

export interface ParametroJornada {
  id?: number;
  horas_max_dia: number;
  horas_max_semana: number;
  horas_max_mes: number | null;
  jornada_diurna_inicio: string;
  jornada_diurna_fin: string;
  jornada_nocturna_inicio: string;
  jornada_nocturna_fin: string;
  vigente_desde: string;
  vigente_hasta?: string | null;
  activo: boolean;
  observacion?: string | null;
}

@Injectable({ providedIn: 'root' })
export class ParametrizacionService {

  private apiUrl = `${environment.URL_SERVICIOS}/turnos`;

  constructor(private http: HttpClient) {}

  // ─── Tipos de Recargo ───
  getTiposRecargo(): Observable<TipoRecargo[]> {
    return this.http.get<any>(`${this.apiUrl}/tipos-recargo`).pipe(map(r => r.data));
  }
  crearTipoRecargo(data: Partial<TipoRecargo>): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/tipos-recargo`, data);
  }
  actualizarTipoRecargo(id: number, data: Partial<TipoRecargo>): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/tipos-recargo/${id}`, data);
  }
  eliminarTipoRecargo(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/tipos-recargo/${id}`);
  }

  // ─── Parámetros de Jornada ───
  getParametrosJornada(): Observable<ParametroJornada[]> {
    return this.http.get<any>(`${this.apiUrl}/parametros-jornada`).pipe(map(r => r.data));
  }
  getParametroVigente(): Observable<ParametroJornada> {
    return this.http.get<any>(`${this.apiUrl}/parametros-jornada/vigente`).pipe(map(r => r.data));
  }
  crearParametroJornada(data: Partial<ParametroJornada>): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/parametros-jornada`, data);
  }
  actualizarParametroJornada(id: number, data: Partial<ParametroJornada>): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/parametros-jornada/${id}`, data);
  }
  eliminarParametroJornada(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/parametros-jornada/${id}`);
  }
}
