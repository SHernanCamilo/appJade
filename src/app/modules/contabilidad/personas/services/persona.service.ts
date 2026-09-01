import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface AuditoriaUsuario {
  id: number;
  name: string;
  email?: string;
}

export interface Empleado {
  id: number;
  id_empresa: number;
  id_cargo: number | null;
  numero_identificacion: string;
  nombre: string;
  email?: string | null;
  tipo_identificacion?: string | null;
  unidad?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  contrato?: string | null;
  fecha_inicio_contrato?: string | null;
  fecha_fin_contrato?: string | null;
  estado?: boolean;
  caso_glpi?: string | null;
  id_user?: number | null;
  usuario?: AuditoriaUsuario & {
    numero_identificacion?: string | null;
    tipo_identificacion?: string | null;
    telefono?: string | null;
    direccion?: string | null;
  } | null;
  usuario_crea?: AuditoriaUsuario | null;
  usuario_actualiza?: AuditoriaUsuario | null;
  usuario_crea_id?: number | null;
  usuario_actualiza_id?: number | null;
  created_at?: string;
  updated_at?: string;
  empresa?: {
    id: number;
    nombre: string;
  };
  cargo_relacion?: {
    id_cargo: number;
    nombre_cargo: string;
  };
}

export interface CargoOpcion {
  id_cargo: number;
  nombre_cargo: string;
}

export interface PersonaPayload {
  id_empresa: number;
  id_cargo?: number | null;
  numero_identificacion: string;
  nombre: string;
  email?: string | null;
  tipo_identificacion?: string | null;
  unidad?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  contrato?: string | null;
  fecha_inicio_contrato?: string | null;
  fecha_fin_contrato?: string | null;
  estado?: boolean;
  id_user?: number | null;
}

export interface UsuarioLookup {
  id: number;
  name: string;
  email?: string | null;
  numero_identificacion?: string | null;
  tipo_identificacion?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  estado?: boolean | number;
  cargo?: string | null;
}

export interface UsuariosLookupPaginados {
  data: UsuarioLookup[];
  total: number;
  current_page: number;
  per_page: number;
  last_page: number;
  scope?: 'todos' | 'empresas';
}

export interface PersonaUsuarioLookup {
  persona: Empleado | null;
  usuario: UsuarioLookup | null;
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
  private empleadosUrl = '/empleados';
  private personasUrl  = '/personas';

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
    const meta = response?.meta ?? {};
    if (response?.data && Array.isArray(response.data)) {
      return {
        data: response.data as Empleado[],
        total: response.total ?? meta.total ?? response.data.length,
        current_page: response.current_page ?? meta.current_page ?? 1,
        per_page: response.per_page ?? meta.per_page ?? response.data.length,
        last_page: response.last_page ?? meta.last_page ?? 1
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

  listar(params?: {
    empresaId?: number;
    termino?: string;
    estado?: boolean;
    page?: number;
    perPage?: number;
  }): Observable<EmpleadosPaginados> {
    let httpParams = new HttpParams();
    if (params?.empresaId) {
      httpParams = httpParams.set('id_empresa', params.empresaId.toString());
    } else {
      httpParams = httpParams.set('todas_empresas', '1');
    }
    if (params?.termino) {
      httpParams = httpParams.set('buscar', params.termino);
    }
    if (params?.estado !== undefined) {
      httpParams = httpParams.set('estado', params.estado ? 'true' : 'false');
    }
    httpParams = httpParams.set('page', (params?.page ?? 1).toString());
    httpParams = httpParams.set('per_page', (params?.perPage ?? 25).toString());

    return this.http.get<any>(this.empleadosUrl, { params: httpParams }).pipe(
      map((response) => this.normalizarPaginado(response))
    );
  }

  obtener(id: number): Observable<Empleado> {
    return this.http.get<any>(`${this.empleadosUrl}/${id}`).pipe(
      map((response) => (response?.data ?? response) as Empleado)
    );
  }

  crear(payload: PersonaPayload): Observable<Empleado> {
    return this.http.post<any>(this.empleadosUrl, payload).pipe(
      map((response) => (response?.data ?? response) as Empleado)
    );
  }

  actualizar(id: number, payload: Partial<PersonaPayload>): Observable<Empleado> {
    return this.http.put<any>(`${this.empleadosUrl}/${id}`, payload).pipe(
      map((response) => (response?.data ?? response) as Empleado)
    );
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.empleadosUrl}/${id}`);
  }

  buscarPorDocumento(params: {
    documento?: string;
    email?: string;
    empresaId?: number;
  }): Observable<PersonaUsuarioLookup> {
    let httpParams = new HttpParams();
    if (params.documento) {
      httpParams = httpParams.set('documento', params.documento);
    }
    if (params.email) {
      httpParams = httpParams.set('email', params.email);
    }
    if (params.empresaId) {
      httpParams = httpParams.set('id_empresa', params.empresaId.toString());
    }
    return this.http.get<any>(`${this.empleadosUrl}/por-documento`, { params: httpParams }).pipe(
      map((response) => ({
        persona: (response?.data?.persona ?? null) as Empleado | null,
        usuario: (response?.data?.usuario ?? null) as UsuarioLookup | null
      }))
    );
  }

  listarUsuarios(params?: {
    empresaId?: number;
    buscar?: string;
    page?: number;
    perPage?: number;
  }): Observable<UsuariosLookupPaginados> {
    let httpParams = new HttpParams();
    if (params?.empresaId) {
      httpParams = httpParams.set('id_empresa', params.empresaId.toString());
    }
    if (params?.buscar) {
      httpParams = httpParams.set('buscar', params.buscar);
    }
    httpParams = httpParams.set('page', (params?.page ?? 1).toString());
    httpParams = httpParams.set('per_page', (params?.perPage ?? 25).toString());

    return this.http.get<any>(`${this.empleadosUrl}/usuarios`, { params: httpParams }).pipe(
      map((response) => {
        const meta = response?.meta ?? {};
        return {
          data: (Array.isArray(response?.data) ? response.data : []) as UsuarioLookup[],
          total: meta.total ?? 0,
          current_page: meta.current_page ?? 1,
          per_page: meta.per_page ?? 25,
          last_page: meta.last_page ?? 1,
          scope: response?.scope
        };
      })
    );
  }

  cargos(): Observable<CargoOpcion[]> {
    return this.http.get<any>(`${this.empleadosUrl}/cargos`).pipe(
      map((response) => (Array.isArray(response?.data) ? response.data : []) as CargoOpcion[])
    );
  }
}
