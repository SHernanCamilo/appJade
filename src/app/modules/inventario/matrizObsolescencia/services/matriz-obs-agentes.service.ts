import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface MatrizObsAgente {
  id?: number;
  tag: string;
  id_empresa: number;
  id_sucursal: number;
  id_sede?: number;
  created_at?: string;
  updated_at?: string;
  empresa?: any;
  sucursal?: any;
  sede?: any;
}

export interface SincronizacionParametro {
  id: number;
  id_grupo: number;
  nombre: string;
  valor: string;
  frecuencia?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MatrizObsAgentesService {
  private apiUrl = '/matriz-obsolescencia';

  constructor(private http: HttpClient) {}

  /**
   * Obtener todos los agentes
   */
  getAgentes(): Observable<ApiResponse<MatrizObsAgente[]>> {
    return this.http.get<ApiResponse<MatrizObsAgente[]>>(`${this.apiUrl}/agentes`);
  }

  /**
   * Obtener un agente específico
   */
  getAgente(id: number): Observable<ApiResponse<MatrizObsAgente>> {
    return this.http.get<ApiResponse<MatrizObsAgente>>(`${this.apiUrl}/agentes/${id}`);
  }

  /**
   * Crear un nuevo agente
   */
  createAgente(agente: Partial<MatrizObsAgente>): Observable<ApiResponse<MatrizObsAgente>> {
    return this.http.post<ApiResponse<MatrizObsAgente>>(`${this.apiUrl}/agentes`, agente);
  }

  /**
   * Actualizar un agente
   */
  updateAgente(id: number, agente: Partial<MatrizObsAgente>): Observable<ApiResponse<MatrizObsAgente>> {
    return this.http.put<ApiResponse<MatrizObsAgente>>(`${this.apiUrl}/agentes/${id}`, agente);
  }

  /**
   * Eliminar un agente
   */
  deleteAgente(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/agentes/${id}`);
  }

  /**
   * Obtener parámetro de sincronización de equipos
   */
  getSincronizacionParametro(): Observable<ApiResponse<SincronizacionParametro>> {
    return this.http.get<ApiResponse<SincronizacionParametro>>(`${this.apiUrl}/sincronizacion-parametro`);
  }

  /**
   * Actualizar parámetro de sincronización de equipos
   */
  updateSincronizacionParametro(valor: string): Observable<ApiResponse<SincronizacionParametro>> {
    return this.http.put<ApiResponse<SincronizacionParametro>>(`${this.apiUrl}/sincronizacion-parametro`, { valor });
  }
}