import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

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
  estado: boolean;
  created_at?: string;
  updated_at?: string;
  modulo?: {
    id: number;
    nombre: string;
    codigo: string;
  };
  roles?: any[];
  permisos?: {
    id: number;
    codigo: string;
    nombre: string;
  }[];
}

export interface CreatePerfilRequest {
  nombre: string;
  codigo?: string;
  id_modulo: number;
  descripcion?: string;
  puede_crear?: boolean;
  puede_leer?: boolean;
  puede_editar?: boolean;
  puede_eliminar?: boolean;
  permisos_ids?: number[];
  estado?: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class PerfilService {
  private apiUrl = '/perfiles';

  constructor(private http: HttpClient) {}

  /**
   * Obtener todos los perfiles
   */
  getPerfiles(params?: { id_modulo?: number; estado?: boolean }): Observable<Perfil[]> {
    let httpParams = new HttpParams();
    
    if (params?.id_modulo !== undefined) {
      httpParams = httpParams.set('id_modulo', params.id_modulo.toString());
    }
    if (params?.estado !== undefined) {
      httpParams = httpParams.set('estado', params.estado ? '1' : '0');
    }

    return this.http.get<Perfil[]>(this.apiUrl, { params: httpParams });
  }

  /**
   * Obtener un perfil específico
   */
  getPerfil(id: number): Observable<Perfil> {
    return this.http.get<Perfil>(`${this.apiUrl}/${id}`);
  }

  /**
   * Crear un nuevo perfil
   */
  createPerfil(perfil: CreatePerfilRequest): Observable<Perfil> {
    return this.http.post<Perfil>(this.apiUrl, perfil);
  }

  /**
   * Actualizar un perfil
   */
  updatePerfil(id: number, perfil: Partial<CreatePerfilRequest>): Observable<Perfil> {
    return this.http.put<Perfil>(`${this.apiUrl}/${id}`, perfil);
  }

  /**
   * Eliminar un perfil
   */
  deletePerfil(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  /**
   * Obtener perfiles agrupados por módulo
   */
  getPerfilesPorModulo(): Observable<any[]> {
    return this.http.get<any[]>('/perfiles-por-modulo');
  }

  getPerfilesDeModulo(idModulo: number): Observable<any> {
    return this.http.get<any>(`/perfiles-modulo/${idModulo}`);
  }

  getPermisosDisponibles(idModulo: number): Observable<any> {
    return this.http.get<any>(`/permisos-disponibles/${idModulo}`);
  }
}
