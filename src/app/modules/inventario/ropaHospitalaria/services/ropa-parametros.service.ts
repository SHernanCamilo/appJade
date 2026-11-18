import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export type ReglaRopa = 'cama' | 'estar_medico' | 'personal';

export interface ApiRopa<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface RopaPrenda {
  id: number;
  codigo: string | null;
  nombre: string;
  regla: ReglaRopa;
  regla_nombre: string;
  estado: number;
  constantes_vigentes: number;
}

export interface RopaUnidad {
  id: number;
  codigo: string;
  nombre: string;
  sucursal_id: number | null;
  sucursal_nombre: string | null;
  sede_id: number | null;
  sede_nombre: string | null;
  tiene_cupo: boolean;
  camas: number | null;
  camas_medico: number | null;
  personal: number | null;
  aplica_estar_medico: boolean;
  aplica_personal: boolean;
}

export interface RopaConstante {
  id: number;
  id_prenda: number;
  id_unidad: number;
  constante: string;
  estado: number;
  prenda_codigo: string | null;
  prenda_nombre: string | null;
  regla: ReglaRopa | null;
  regla_nombre: string;
  unidad_codigo: string | null;
  unidad_nombre: string | null;
  sucursal_nombre: string | null;
  sede_nombre: string | null;
}

export interface PrendaPayload {
  codigo: string | null;
  nombre: string;
  regla: ReglaRopa;
  estado: number;
}

export interface CupoPayload {
  camas: number;
  camas_medico: number;
  personal: number;
  aplica_estar_medico: boolean;
  aplica_personal: boolean;
}

export interface ConstantePayload {
  id_prenda: number;
  id_unidad: number;
  constante: number;
}

@Injectable({ providedIn: 'root' })
export class RopaParametrosService {
  private readonly base = `${environment.URL_SERVICIOS}/inventario/ropa-hospitalaria`;

  constructor(private readonly http: HttpClient) {}

  prendas(): Observable<ApiRopa<RopaPrenda[]>> {
    return this.http.get<ApiRopa<RopaPrenda[]>>(`${this.base}/prendas`);
  }

  crearPrenda(payload: PrendaPayload): Observable<ApiRopa<RopaPrenda>> {
    return this.http.post<ApiRopa<RopaPrenda>>(`${this.base}/prendas`, payload);
  }

  actualizarPrenda(id: number, payload: PrendaPayload): Observable<ApiRopa<RopaPrenda>> {
    return this.http.put<ApiRopa<RopaPrenda>>(`${this.base}/prendas/${id}`, payload);
  }

  eliminarPrenda(id: number): Observable<ApiRopa<RopaPrenda>> {
    return this.http.delete<ApiRopa<RopaPrenda>>(`${this.base}/prendas/${id}`);
  }

  unidades(): Observable<ApiRopa<RopaUnidad[]>> {
    return this.http.get<ApiRopa<RopaUnidad[]>>(`${this.base}/unidades`);
  }

  guardarCupo(idUnidad: number, payload: CupoPayload): Observable<ApiRopa<RopaUnidad>> {
    return this.http.put<ApiRopa<RopaUnidad>>(`${this.base}/unidades/${idUnidad}/cupo`, payload);
  }

  constantes(): Observable<ApiRopa<RopaConstante[]>> {
    return this.http.get<ApiRopa<RopaConstante[]>>(`${this.base}/constantes`);
  }

  crearConstante(payload: ConstantePayload): Observable<ApiRopa<RopaConstante>> {
    return this.http.post<ApiRopa<RopaConstante>>(`${this.base}/constantes`, payload);
  }

  actualizarConstante(id: number, payload: ConstantePayload): Observable<ApiRopa<RopaConstante>> {
    return this.http.put<ApiRopa<RopaConstante>>(`${this.base}/constantes/${id}`, payload);
  }

  eliminarConstante(id: number): Observable<ApiRopa<unknown>> {
    return this.http.delete<ApiRopa<unknown>>(`${this.base}/constantes/${id}`);
  }
}
