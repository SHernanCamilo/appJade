import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface Tercero {
  id: number;
  nombre: string;
  numero_identificacion?: string;
  tipo_identificacion?: string | null;
  estado?: boolean;
  email?: string | null;
  unidad?: string | null;
  cargo_relacion?: {
    id_cargo: number;
    nombre_cargo: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class TerceroService {
  private apiUrl = `${environment.URL_SERVICIOS}/terceros`;

  constructor(private http: HttpClient) {}

  buscarEmpleadosPorDocumento(empresaId: number, documento: string): Observable<Tercero[]> {
    return this.buscarTerceros({ empresaId, termino: documento, estado: true });
  }

  buscarEmpleadosPorNombre(empresaId: number, nombre: string): Observable<Tercero[]> {
    return this.buscarTerceros({ empresaId, termino: nombre, estado: true });
  }

  private buscarTerceros(params?: {
    empresaId?: number;
    termino?: string;
    estado?: boolean;
  }): Observable<Tercero[]> {
    let httpParams = new HttpParams().set('tipo', 'empleado');
    if (params?.empresaId) {
      httpParams = httpParams.set('id_empresa', params.empresaId.toString());
    }
    if (params?.termino) {
      httpParams = httpParams.set('buscar', params.termino);
    }
    if (params?.estado !== undefined) {
      httpParams = httpParams.set('estado', params.estado ? 'true' : 'false');
    }
    return this.http.get<any>(this.apiUrl, { params: httpParams }).pipe(
      map((response) => this.normalizarTerceros(response))
    );
  }

  private normalizarTerceros(response: any): Tercero[] {
    if (Array.isArray(response)) {
      return response as Tercero[];
    }
    if (response?.data && Array.isArray(response.data)) {
      return response.data as Tercero[];
    }
    if (response?.data && typeof response.data === 'object') {
      return [response.data as Tercero];
    }
    return [];
  }
}
