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
    return this.http.get<any>(this.empleadosUrl, { params: httpParams }).pipe(
      map((response) => this.normalizarEmpleados(response))
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
}
