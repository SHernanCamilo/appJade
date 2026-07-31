import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
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

  constructor(private http: HttpClient) {}

  getParametros(): Observable<ParametroCierre[]> {
    return this.http.get<any>(`${this.apiUrl}/parametros`).pipe(map(r => r.data));
  }

  guardarParametro(data: Partial<ParametroCierre>): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/parametros`, data);
  }

  getEstado(anio: number, mes: number, idEmpresa?: number): Observable<EstadoUnidad[]> {
    let url = `${this.apiUrl}/estado?anio=${anio}&mes=${mes}`;
    if (idEmpresa) url += `&id_empresa=${idEmpresa}`;
    return this.http.get<any>(url).pipe(map(r => r.data));
  }

  bloquear(idsUnidades: number[], anio: number, mes: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/bloquear`, { ids_unidades: idsUnidades, anio, mes });
  }

  desbloquear(idUnidad: number, anio: number, mes: number, motivo: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/desbloquear`, { id_unidad: idUnidad, anio, mes, motivo });
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
