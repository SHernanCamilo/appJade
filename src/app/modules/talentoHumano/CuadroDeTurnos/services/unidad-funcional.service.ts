import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface UnidadFuncional {
  id?: number;
  codigo: string;
  nombre: string;
  id_empresa: number;
  id_sede?: number | null;
  estado: boolean;
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
}

export interface Empleado {
  id: number;
  nombre: string;
  email?: string;
  cedula?: string;
  unidad?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UnidadFuncionalService {

  private apiUrl = `${environment.URL_SERVICIOS}/turnos/unidades-funcionales`;

  constructor(private http: HttpClient) { }

  // Obtener todas las unidades funcionales
  getUnidadesFuncionales(params?: { id_empresa?: number; id_sede?: number; estado?: boolean; search?: string }): Observable<{ success: boolean; data: UnidadFuncional[] }> {
    return this.http.get<{ success: boolean; data: UnidadFuncional[] }>(this.apiUrl, { params: params as any });
  }

  // Obtener una unidad funcional por ID
  getUnidadFuncional(id: number): Observable<{ success: boolean; data: UnidadFuncional }> {
    return this.http.get<{ success: boolean; data: UnidadFuncional }>(`${this.apiUrl}/${id}`);
  }

  // Crear una nueva unidad funcional
  createUnidadFuncional(unidad: Partial<UnidadFuncional>): Observable<{ success: boolean; data: UnidadFuncional; message: string }> {
    return this.http.post<{ success: boolean; data: UnidadFuncional; message: string }>(this.apiUrl, unidad);
  }

  // Actualizar una unidad funcional
  updateUnidadFuncional(id: number, unidad: Partial<UnidadFuncional>): Observable<{ success: boolean; data: UnidadFuncional; message: string }> {
    return this.http.put<{ success: boolean; data: UnidadFuncional; message: string }>(`${this.apiUrl}/${id}`, unidad);
  }

  // Eliminar (desactivar) una unidad funcional
  deleteUnidadFuncional(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/${id}`);
  }

  // Obtener empleados de una unidad funcional
  getEmpleados(id: number, params?: { search?: string; fallback_all?: boolean }): Observable<{ success: boolean; data: Empleado[]; fallback?: boolean; message?: string }> {
    const httpParams: any = {};
    if (params?.search) httpParams.search = params.search;
    if (params?.fallback_all) httpParams.fallback_all = '1';
    return this.http.get<{ success: boolean; data: Empleado[]; fallback?: boolean; message?: string }>(
      `${this.apiUrl}/${id}/empleados`,
      { params: httpParams }
    );
  }
}
