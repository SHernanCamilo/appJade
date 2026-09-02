import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, timeout } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  HistoriaTrasladoAsistencial,
  RegistroTrasladoLista,
  TipoTrasladoAsistencial
} from '../models/traslado-asistencial.model';

export interface TrasladoAsistencialPayload {
  formato: TipoTrasladoAsistencial;
  datos: HistoriaTrasladoAsistencial;
  fecha_atencion?: string | null;
  nombres_apellidos?: string | null;
  tipo_identificacion?: string | null;
  numero_identificacion?: string | null;
  estado_paciente?: string | null;
}

export interface TrasladoAsistencialDetalle extends RegistroTrasladoLista {
  datos: HistoriaTrasladoAsistencial;
}

interface ApiListResponse {
  success: boolean;
  data: RegistroTrasladoLista[];
  message?: string;
}

interface ApiItemResponse {
  success: boolean;
  data: TrasladoAsistencialDetalle;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class TrasladoAsistencialService {
  private readonly apiUrl = '/fabric/traslado-asistencial';

  constructor(private readonly http: HttpClient) {}

  listar(filtros?: { tipo?: 'primario' | 'secundario'; estado?: 'guardado' | 'confirmado' }): Observable<RegistroTrasladoLista[]> {
    let params = new HttpParams();
    if (filtros?.tipo) {
      params = params.set('tipo', filtros.tipo);
    }
    if (filtros?.estado) {
      params = params.set('estado', filtros.estado);
    }

    return this.http.get<ApiListResponse>(this.apiUrl, { params }).pipe(
      timeout(12000),
      map(r => r.data ?? [])
    );
  }

  obtener(id: number): Observable<TrasladoAsistencialDetalle> {
    return this.http.get<ApiItemResponse>(`${this.apiUrl}/${id}`).pipe(
      map(r => r.data)
    );
  }

  guardar(payload: TrasladoAsistencialPayload): Observable<TrasladoAsistencialDetalle> {
    return this.http.post<ApiItemResponse>(this.apiUrl, payload).pipe(
      map(r => r.data)
    );
  }

  actualizar(id: number, payload: TrasladoAsistencialPayload): Observable<TrasladoAsistencialDetalle> {
    return this.http.put<ApiItemResponse>(`${this.apiUrl}/${id}`, payload).pipe(
      map(r => r.data)
    );
  }

  confirmar(id: number, payload?: TrasladoAsistencialPayload): Observable<TrasladoAsistencialDetalle> {
    return this.http.post<ApiItemResponse>(`${this.apiUrl}/${id}/confirmar`, payload ?? {}).pipe(
      map(r => r.data)
    );
  }
}
