import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface Rol {
  id: number;
  nombre: string;
  codigo: string;
  id_empresa?: number;
  descripcion?: string;
  es_admin: boolean;
  estado: boolean;
  created_at?: string;
  updated_at?: string;
  empresa?: {
    id: number;
    nombre: string;
    prefijo: string;
  };
  perfiles?: Perfil[];
  usuarios?: any[];
}

export interface Perfil {
  id: number;
  nombre: string;
  codigo: string;
  id_modulo: number;
  descripcion?: string;
  puede_crear: boolean;
  puede_leer: boolean;
  puede_editar: boolean;
  puede_eliminar: boolean;
  permisos_extra?: any;
  estado: boolean;
  modulo?: {
    id: number;
    nombre: string;
    codigo: string;
  };
}

export interface CreateRolRequest {
  nombre: string;
  codigo?: string;
  id_empresa?: number;
  descripcion?: string;
  es_admin?: boolean;
  estado?: boolean;
  perfiles?: number[];
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class RolService {
  private apiUrl = `${environment.URL_SERVICIOS}/roles`;

  constructor(private http: HttpClient) {}

  /**
   * Obtener todos los roles
   */
  getRoles(params?: { id_empresa?: number | string; estado?: boolean; es_admin?: boolean }): Observable<Rol[]> {
    let httpParams = new HttpParams();
    
    if (params?.id_empresa !== undefined) {
      httpParams = httpParams.set('id_empresa', params.id_empresa.toString());
    }
    if (params?.estado !== undefined) {
      httpParams = httpParams.set('estado', params.estado ? '1' : '0');
    }
    if (params?.es_admin !== undefined) {
      httpParams = httpParams.set('es_admin', params.es_admin ? '1' : '0');
    }

    return this.http.get<Rol[]>(this.apiUrl, { params: httpParams });
  }

  /**
   * Obtener un rol específico
   */
  getRol(id: number): Observable<Rol> {
    return this.http.get<Rol>(`${this.apiUrl}/${id}`);
  }

  /**
   * Crear un nuevo rol
   */
  createRol(rol: CreateRolRequest): Observable<Rol> {
    return this.http.post<Rol>(this.apiUrl, rol);
  }

  /**
   * Actualizar un rol
   */
  updateRol(id: number, rol: Partial<CreateRolRequest>): Observable<Rol> {
    return this.http.put<Rol>(`${this.apiUrl}/${id}`, rol);
  }

  /**
   * Eliminar un rol
   */
  deleteRol(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  /**
   * Asignar perfiles a un rol
   */
  asignarPerfiles(id: number, perfiles: number[]): Observable<Rol> {
    return this.http.post<Rol>(`${this.apiUrl}/${id}/asignar-perfiles`, { perfiles });
  }

  /**
   * Obtener permisos de un rol
   */
  obtenerPermisos(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/${id}/permisos`);
  }

  /**
   * Obtener roles por empresa
   */
  getRolesPorEmpresa(idEmpresa: number): Observable<Rol[]> {
    return this.http.get<Rol[]>(`${environment.URL_SERVICIOS}/roles-por-empresa/${idEmpresa}`);
  }

  /**
   * Obtener roles por empresa filtrados por módulos con permisos
   * Solo devuelve roles cuyos perfiles pertenecen a módulos donde la empresa tiene acceso
   */
  getRolesPorEmpresaConModulos(idEmpresa: number): Observable<Rol[]> {
    return this.http.get<Rol[]>(`${environment.URL_SERVICIOS}/roles-por-empresa-modulos/${idEmpresa}`);
  }

  /**
   * Obtener roles por múltiples empresas filtrados por módulos con permisos
   * Recibe un array de IDs de empresas y devuelve roles disponibles para esas empresas
   */
  getRolesPorMultiplesEmpresas(empresasIds: number[]): Observable<any> {
    return this.http.post<any>(`${environment.URL_SERVICIOS}/roles-por-multiples-empresas`, {
      empresas: empresasIds
    });
  }
}
