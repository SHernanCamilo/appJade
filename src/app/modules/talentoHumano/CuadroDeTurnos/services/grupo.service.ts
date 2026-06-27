import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

export interface Grupo {
  id?: number;
  codigo?: string;
  nombre: string;
  descripcion?: string;
  id_empresa?: number;
  id_sede?: number;
  id_unidad_funcional?: number;
  unidad_funcional?: string; // Nombre de la unidad funcional (para compatibilidad)
  cantidad_empleados?: number;
  activo: boolean;
  estado?: boolean; // Alias de activo
  created_at?: string;
  updated_at?: string;
  empresa?: {
    id: number;
    nombre: string;
  };
  sede?: {
    id: number;
    nombre: string;
  };
  unidadFuncional?: {
    id: number;
    codigo: string;
    nombre: string;
  };
}

export interface Empleado {
  id: number;
  nombre: string;
  email?: string;
  cedula?: string;
}

@Injectable({
  providedIn: 'root'
})
export class GrupoService {

  private apiUrl = `${environment.URL_SERVICIOS}/turnos/grupos`;

  constructor(private http: HttpClient) { }

  // Obtener todos los grupos
  getGrupos(params?: { id_empresa?: number; id_sede?: number; id_unidad_funcional?: number; estado?: boolean }): Observable<Grupo[]> {
    return this.http.get<any>(this.apiUrl, { params: params as any }).pipe(
      map(response => response.success ? response.data : [])
    );
  }

  // Obtener un grupo por ID
  getGrupo(id: number): Observable<Grupo> {
    return this.http.get<Grupo>(`${this.apiUrl}/${id}`);
  }

  // Crear un nuevo grupo
  createGrupo(grupo: Partial<Grupo>): Observable<Grupo> {
    return this.http.post<any>(this.apiUrl, grupo).pipe(
      map(response => response.success ? response.data : null)
    );
  }

  // Actualizar un grupo
  updateGrupo(id: number, grupo: Partial<Grupo>): Observable<Grupo> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, grupo).pipe(
      map(response => response.success ? response.data : null)
    );
  }

  // Eliminar un grupo
  deleteGrupo(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  // Obtener empleados de un grupo
  getEmpleados(grupoId: number): Observable<Empleado[]> {
    return this.http.get<Empleado[]>(`${this.apiUrl}/${grupoId}/empleados`);
  }

  // Agregar empleado a un grupo
  agregarEmpleado(grupoId: number, empleadoId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${grupoId}/empleados`, { empleado_id: empleadoId });
  }

  // Retirar empleado de un grupo
  retirarEmpleado(grupoId: number, empleadoId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${grupoId}/empleados/${empleadoId}`);
  }

  // Asignar encargado del grupo
  asignarEncargado(grupoId: number, empleadoId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${grupoId}/encargado`, { empleado_id: empleadoId });
  }

  // Obtener historial de encargados
  getHistorialEncargados(grupoId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/${grupoId}/encargado/historial`);
  }
}
