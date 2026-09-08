import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, tap, shareReplay, finalize } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

export interface ParametroCierre {
  id?: number;
  tipo_bloqueo: 'automatico' | 'manual';
  tipo_nomina: 'mensual' | 'quincenal';
  dia_cierre: number;
  hora_cierre: string;
  aplica_mes_actual: boolean;
  id_empresa?: number | null;
  activo: boolean;
}

export interface EstadoUnidad {
  id: number;
  codigo: string;
  nombre: string;
  id_empresa: number;
  bloqueado: number; // 1 o 0
  bloqueado_en?: string;
  bloqueado_por?: number;
  tipo_bloqueo?: string;
}

@Injectable({ providedIn: 'root' })
export class CierreCuadroService {

  private apiUrl = `${environment.URL_SERVICIOS}/turnos/cierre-cuadro`;

  // Cache en memoria (servicio singleton). Evita re-pedir al reentrar al tab.
  private cacheParametros: ParametroCierre[] | null = null;
  private cacheEstado = new Map<string, EstadoUnidad[]>();

  // Peticion en vuelo (evita duplicar: precarga del padre + carga del hijo).
  private parametrosEnVuelo$: Observable<ParametroCierre[]> | null = null;

  constructor(private http: HttpClient) {}

  getParametros(forzarRecarga = false): Observable<ParametroCierre[]> {
    if (!forzarRecarga && this.cacheParametros) {
      return of(this.cacheParametros);
    }
    if (this.parametrosEnVuelo$) {
      return this.parametrosEnVuelo$;
    }
    this.parametrosEnVuelo$ = this.http.get<any>(`${this.apiUrl}/parametros`).pipe(
      map(r => r.data),
      tap(data => this.cacheParametros = data),
      finalize(() => this.parametrosEnVuelo$ = null),
      shareReplay(1)
    );
    return this.parametrosEnVuelo$;
  }

  guardarParametro(data: Partial<ParametroCierre>): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/parametros`, data).pipe(
      tap(() => this.cacheParametros = null)
    );
  }

  getEstado(anio: number, mes: number, idEmpresa?: number, forzarRecarga = false): Observable<EstadoUnidad[]> {
    const key = `${anio}-${mes}-${idEmpresa ?? ''}`;
    if (!forzarRecarga && this.cacheEstado.has(key)) {
      return of(this.cacheEstado.get(key)!);
    }
    let url = `${this.apiUrl}/estado?anio=${anio}&mes=${mes}`;
    if (idEmpresa) url += `&id_empresa=${idEmpresa}`;
    return this.http.get<any>(url).pipe(
      map(r => r.data),
      tap(data => this.cacheEstado.set(key, data))
    );
  }

  bloquear(idsUnidades: number[], anio: number, mes: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/bloquear`, { ids_unidades: idsUnidades, anio, mes }).pipe(
      tap(() => this.cacheEstado.clear())
    );
  }

  desbloquear(idUnidad: number, anio: number, mes: number, motivo: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/desbloquear`, { id_unidad: idUnidad, anio, mes, motivo }).pipe(
      tap(() => this.cacheEstado.clear())
    );
  }

  verificar(idUnidad: number, anio: number, mes: number): Observable<boolean> {
    return this.http.get<any>(`${this.apiUrl}/verificar?id_unidad=${idUnidad}&anio=${anio}&mes=${mes}`)
      .pipe(map(r => r.data.bloqueado));
  }

  ejecutarAutomatico(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/ejecutar-automatico`, {});
  }

  getHistorial(anio?: number, mes?: number): Observable<any[]> {
    let url = `${this.apiUrl}/historial`;
    const params: string[] = [];
    if (anio) params.push(`anio=${anio}`);
    if (mes) params.push(`mes=${mes}`);
    if (params.length) url += '?' + params.join('&');
    return this.http.get<any>(url).pipe(map(r => r.data));
  }
}
