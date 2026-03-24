import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface Empleado {
  id: number;
  id_empresa: number;
  id_cargo: number;
  numero_identificacion: string;
  nombre: string;
  email?: string | null;
  tipo_identificacion?: string | null;
  unidad?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  estado?: boolean;
  caso_glpi?: string | null;
  usuario_crea_id?: number | null;
  usuario_actualiza_id?: number | null;
  empresa?: {
    id: number;
    nombre: string;
  };
  cargo_relacion?: {
    id_cargo: number;
    nombre_cargo: string;
  };
}

export interface EmpleadosPaginados {
  data: Empleado[];
  total: number;
  current_page: number;
  per_page: number;
  last_page: number;
}

@Injectable({
  providedIn: 'root'
})
export class PersonaService {
  private empleadosUrl = `${environment.URL_SERVICIOS}/empleados`;
  private personasUrl = `${environment.URL_SERVICIOS}/personas`;

  constructor(private http: HttpClient) {}

  buscarEmpleados(params?: {
    empresaId?: number;
    termino?: string;
    estado?: boolean;
    page?: number;
    perPage?: number;
  }): Observable<Empleado[]> {
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
    if (params?.page !== undefined) {
      httpParams = httpParams.set('page', params.page.toString());
    }
    if (params?.perPage !== undefined) {
      httpParams = httpParams.set('per_page', params.perPage.toString());
    }
    return this.http.get<any>(this.empleadosUrl, { params: httpParams }).pipe(
      map((response) => this.normalizarEmpleados(response))
    );
  }

  buscarEmpleadosPaginados(params?: {
    empresaId?: number;
    termino?: string;
    estado?: boolean;
    page?: number;
    perPage?: number;
  }): Observable<EmpleadosPaginados> {
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
    httpParams = httpParams.set('page', (params?.page ?? 1).toString());
    httpParams = httpParams.set('per_page', (params?.perPage ?? 30).toString());

    return this.http.get<any>(this.empleadosUrl, { params: httpParams }).pipe(
      map((response) => this.normalizarPaginado(response))
    );
  }

  buscarEmpleadoPorDocumento(empresaId: number, documento: string): Observable<Empleado[]> {
    return this.buscarEmpleados({ empresaId, termino: documento, estado: true });
  }

  buscarEmpleadoPorNombre(empresaId: number, nombre: string): Observable<Empleado[]> {
    return this.buscarEmpleados({ empresaId, termino: nombre, estado: true });
  }

  obtenerEmpleadoActual(): Observable<Empleado | null> {
    return this.http.get<any>(`${this.personasUrl}/empleado-actual`).pipe(
      map((response) => {
        const empleados = this.normalizarEmpleados(response);
        return empleados.length > 0 ? empleados[0] : null;
      })
    );
  }

  private normalizarEmpleados(response: any): Empleado[] {
    if (Array.isArray(response)) {
      return response as Empleado[];
    }
    if (response?.data && Array.isArray(response.data)) {
      return response.data as Empleado[];
    }
    if (response?.data && typeof response.data === 'object') {
      return [response.data as Empleado];
    }
    if (response?.empleado) {
      return [response.empleado as Empleado];
    }
    return [];
  }

  private normalizarPaginado(response: any): EmpleadosPaginados {
    // Respuesta paginada de Laravel: { data: [], total, current_page, per_page, last_page }
    if (response?.data && Array.isArray(response.data)) {
      return {
        data: response.data as Empleado[],
        total: response.total ?? response.data.length,
        current_page: response.current_page ?? 1,
        per_page: response.per_page ?? response.data.length,
        last_page: response.last_page ?? 1
      };
    }
    // Respuesta envuelta: { success, data: { data: [], ... } }
    if (response?.data?.data && Array.isArray(response.data.data)) {
      return {
        data: response.data.data as Empleado[],
        total: response.data.total ?? response.data.data.length,
        current_page: response.data.current_page ?? 1,
        per_page: response.data.per_page ?? response.data.data.length,
        last_page: response.data.last_page ?? 1
      };
    }
    // Fallback: array plano sin paginación
    const items = this.normalizarEmpleados(response);
    return { data: items, total: items.length, current_page: 1, per_page: items.length, last_page: 1 };
  }
}
