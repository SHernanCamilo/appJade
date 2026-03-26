import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Permiso {
  id: number;
  id_modulo: number;
  nombre: string;
  codigo: string;
  descripcion?: string;
  tipo: 'boton' | 'accion' | 'menu';
  icono?: string;
  orden: number;
  estado: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Modulo {
  id: number;
  nombre: string;
  codigo: string;
  descripcion?: string;
  icono?: string;
  ruta?: string;
  id_modulo_padre?: number;
  nivel: number;
  orden: number;
  estado: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class PermisoService {
  private apiUrl = '/permisos';
  private modulosUrl = '/modulos';

  constructor(private http: HttpClient) {}

  getPermisos(params?: { id_modulo?: number }): Observable<ApiResponse<Permiso[]>> {
    let httpParams = new HttpParams();
    if (params?.id_modulo) {
      httpParams = httpParams.set('id_modulo', params.id_modulo.toString());
    }
    return this.http.get<ApiResponse<Permiso[]>>(this.apiUrl, { params: httpParams });
  }

  getPermiso(id: number): Observable<ApiResponse<Permiso>> {
    return this.http.get<ApiResponse<Permiso>>(`${this.apiUrl}/${id}`);
  }

  createPermiso(permiso: Partial<Permiso>): Observable<ApiResponse<Permiso>> {
    return this.http.post<ApiResponse<Permiso>>(this.apiUrl, permiso);
  }

  updatePermiso(id: number, permiso: Partial<Permiso>): Observable<ApiResponse<Permiso>> {
    return this.http.put<ApiResponse<Permiso>>(`${this.apiUrl}/${id}`, permiso);
  }

  deletePermiso(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}`);
  }

  getModulos(): Observable<ApiResponse<Modulo[]>> {
    return this.http.get<ApiResponse<Modulo[]>>('/modulos');
  }

  getPermisosPorModulo(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>('/permisos-por-modulo');
  }
}
