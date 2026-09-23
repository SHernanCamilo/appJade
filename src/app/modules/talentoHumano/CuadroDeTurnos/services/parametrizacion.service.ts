import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
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
  id_empresa?: number | null;
  empresa?: { id: number; nombre: string } | null;
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

  // Cache en memoria de tipos de recargo (estos siguen siendo globales).
  private cacheTiposRecargo: TipoRecargo[] | null = null;

  constructor(private http: HttpClient) {}

  // ─── Tipos de Recargo ───
  getTiposRecargo(forzarRecarga = false): Observable<TipoRecargo[]> {
    if (!forzarRecarga && this.cacheTiposRecargo) {
      return of(this.cacheTiposRecargo);
    }
    return this.http.get<any>(`${this.apiUrl}/tipos-recargo`).pipe(
      map(r => r.data),
      tap(data => this.cacheTiposRecargo = data)
    );
  }
  crearTipoRecargo(data: Partial<TipoRecargo>): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/tipos-recargo`, data).pipe(
      tap(() => this.cacheTiposRecargo = null)
    );
  }
  actualizarTipoRecargo(id: number, data: Partial<TipoRecargo>): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/tipos-recargo/${id}`, data).pipe(
      tap(() => this.cacheTiposRecargo = null)
    );
  }
  eliminarTipoRecargo(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/tipos-recargo/${id}`).pipe(
      tap(() => this.cacheTiposRecargo = null)
    );
  }

  // ─── Parámetros de Jornada (por empresa) ───
  getParametrosJornada(idEmpresa?: number | null): Observable<ParametroJornada[]> {
    let params: any = {};
    if (idEmpresa != null) params.id_empresa = idEmpresa;
    return this.http.get<any>(`${this.apiUrl}/parametros-jornada`, { params }).pipe(
      map(r => r.data)
    );
  }
  getParametroVigente(idEmpresa?: number | null): Observable<ParametroJornada> {
    let params: any = {};
    if (idEmpresa != null) params.id_empresa = idEmpresa;
    return this.http.get<any>(`${this.apiUrl}/parametros-jornada/vigente`, { params }).pipe(
      map(r => r.data)
    );
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
