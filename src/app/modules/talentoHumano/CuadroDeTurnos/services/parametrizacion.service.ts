import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, tap, shareReplay, finalize } from 'rxjs/operators';
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

  // Cache en memoria (servicio singleton). Evita re-pedir al reentrar a config.
  private cacheTiposRecargo: TipoRecargo[] | null = null;
  private cacheParametrosJornada: ParametroJornada[] | null = null;
  private cacheParametroVigente: ParametroJornada | null = null;

  // Peticiones en vuelo (evita duplicar llamadas simultaneas: precarga + hijo).
  private jornadaEnVuelo$: Observable<ParametroJornada[]> | null = null;

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

  // ─── Parámetros de Jornada ───
  getParametrosJornada(forzarRecarga = false): Observable<ParametroJornada[]> {
    if (!forzarRecarga && this.cacheParametrosJornada) {
      return of(this.cacheParametrosJornada);
    }
    // Si ya hay una peticion en curso, reutilizarla (evita duplicados)
    if (this.jornadaEnVuelo$) {
      return this.jornadaEnVuelo$;
    }
    this.jornadaEnVuelo$ = this.http.get<any>(`${this.apiUrl}/parametros-jornada`).pipe(
      map(r => r.data),
      tap(data => this.cacheParametrosJornada = data),
      finalize(() => this.jornadaEnVuelo$ = null),
      shareReplay(1)
    );
    return this.jornadaEnVuelo$;
  }
  getParametroVigente(forzarRecarga = false): Observable<ParametroJornada> {
    if (!forzarRecarga && this.cacheParametroVigente) {
      return of(this.cacheParametroVigente);
    }
    return this.http.get<any>(`${this.apiUrl}/parametros-jornada/vigente`).pipe(
      map(r => r.data),
      tap(data => this.cacheParametroVigente = data)
    );
  }
  crearParametroJornada(data: Partial<ParametroJornada>): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/parametros-jornada`, data).pipe(
      tap(() => this.invalidarCacheJornada())
    );
  }
  actualizarParametroJornada(id: number, data: Partial<ParametroJornada>): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/parametros-jornada/${id}`, data).pipe(
      tap(() => this.invalidarCacheJornada())
    );
  }
  eliminarParametroJornada(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/parametros-jornada/${id}`).pipe(
      tap(() => this.invalidarCacheJornada())
    );
  }

  private invalidarCacheJornada(): void {
    this.cacheParametrosJornada = null;
    this.cacheParametroVigente = null;
  }
}
