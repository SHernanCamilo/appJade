import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  WfDefinicion,
  WfPaso,
  WfRegla,
  WfAprobador,
  WfInstancia,
  CrearDefinicionRequest,
  CrearPasoRequest,
  CrearReglaRequest,
  CrearAprobadorRequest
} from '../../modules/financiera/anticipos/models/workflow.models';
import { ApiResponse, PaginatedResponse } from '../../modules/financiera/anticipos/models/anticipo.models';

/**
 * Servicio global para administración del Motor de Flujos
 * Este servicio es reutilizable para cualquier módulo (anticipos, horas extras, permisos, etc.)
 */
@Injectable({
  providedIn: 'root'
})
export class WorkflowService {
  private apiUrl = '/workflow';

  constructor(private http: HttpClient) {}

  // ========================================================================
  // DEFINICIONES DE FLUJO
  // ========================================================================

  /**
   * Listar definiciones de flujo con filtros
   */
  listarDefiniciones(params?: {
    modulo?: string;
    id_empresa?: number;
    estado?: boolean;
    page?: number;
    per_page?: number;
  }): Observable<PaginatedResponse<WfDefinicion>> {
    let httpParams = new HttpParams();
    
    if (params) {
      if (params.modulo) httpParams = httpParams.set('modulo', params.modulo);
      if (params.id_empresa) httpParams = httpParams.set('id_empresa', params.id_empresa.toString());
      if (params.estado !== undefined) httpParams = httpParams.set('estado', params.estado ? '1' : '0');
      if (params.page) httpParams = httpParams.set('page', params.page.toString());
      if (params.per_page) httpParams = httpParams.set('per_page', params.per_page.toString());
    }

    return this.http.get<PaginatedResponse<WfDefinicion>>(`${this.apiUrl}/definiciones`, { params: httpParams });
  }

  /**
   * Obtener una definición específica con sus pasos y reglas
   */
  obtenerDefinicion(id: number): Observable<ApiResponse<WfDefinicion>> {
    return this.http.get<ApiResponse<WfDefinicion>>(`${this.apiUrl}/definiciones/${id}`);
  }

  /**
   * Crear nueva definición de flujo
   */
  crearDefinicion(request: CrearDefinicionRequest): Observable<ApiResponse<WfDefinicion>> {
    return this.http.post<ApiResponse<WfDefinicion>>(`${this.apiUrl}/definiciones`, request);
  }

  /**
   * Actualizar definición de flujo
   */
  actualizarDefinicion(id: number, request: Partial<CrearDefinicionRequest>): Observable<ApiResponse<WfDefinicion>> {
    return this.http.put<ApiResponse<WfDefinicion>>(`${this.apiUrl}/definiciones/${id}`, request);
  }

  /**
   * Eliminar definición de flujo
   */
  eliminarDefinicion(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/definiciones/${id}`);
  }

  /**
   * Cambiar estado de una definición
   */
  toggleEstadoDefinicion(id: number): Observable<ApiResponse<WfDefinicion>> {
    return this.http.patch<ApiResponse<WfDefinicion>>(`${this.apiUrl}/definiciones/${id}/toggle-estado`, {});
  }

  // ========================================================================
  // PASOS DEL FLUJO
  // ========================================================================

  /**
   * Listar pasos de una definición
   */
  listarPasos(idDefinicion: number): Observable<ApiResponse<WfPaso[]>> {
    return this.http.get<ApiResponse<WfPaso[]>>(`${this.apiUrl}/definiciones/${idDefinicion}/pasos`);
  }

  /**
   * Crear nuevo paso
   */
  crearPaso(request: CrearPasoRequest): Observable<ApiResponse<WfPaso>> {
    return this.http.post<ApiResponse<WfPaso>>(`${this.apiUrl}/pasos`, request);
  }

  /**
   * Actualizar paso
   */
  actualizarPaso(id: number, request: Partial<CrearPasoRequest>): Observable<ApiResponse<WfPaso>> {
    return this.http.put<ApiResponse<WfPaso>>(`${this.apiUrl}/pasos/${id}`, request);
  }

  /**
   * Eliminar paso
   */
  eliminarPaso(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/pasos/${id}`);
  }

  /**
   * Reordenar pasos
   */
  reordenarPasos(idDefinicion: number, pasos: { id: number; orden: number }[]): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/definiciones/${idDefinicion}/reordenar-pasos`, { pasos });
  }

  // ========================================================================
  // REGLAS DE ASIGNACIÓN
  // ========================================================================

  /**
   * Listar reglas de una definición
   */
  listarReglas(idDefinicion: number): Observable<ApiResponse<WfRegla[]>> {
    return this.http.get<ApiResponse<WfRegla[]>>(`${this.apiUrl}/definiciones/${idDefinicion}/reglas`);
  }

  /**
   * Crear nueva regla
   */
  crearRegla(request: CrearReglaRequest): Observable<ApiResponse<WfRegla>> {
    return this.http.post<ApiResponse<WfRegla>>(`${this.apiUrl}/reglas`, request);
  }

  /**
   * Actualizar regla
   */
  actualizarRegla(id: number, request: Partial<CrearReglaRequest>): Observable<ApiResponse<WfRegla>> {
    return this.http.put<ApiResponse<WfRegla>>(`${this.apiUrl}/reglas/${id}`, request);
  }

  /**
   * Eliminar regla
   */
  eliminarRegla(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/reglas/${id}`);
  }

  // ========================================================================
  // APROBADORES
  // ========================================================================

  /**
   * Listar aprobadores de un paso
   */
  listarAprobadores(idPaso: number): Observable<ApiResponse<WfAprobador[]>> {
    return this.http.get<ApiResponse<WfAprobador[]>>(`${this.apiUrl}/pasos/${idPaso}/aprobadores`);
  }

  /**
   * Crear nuevo aprobador
   */
  crearAprobador(request: CrearAprobadorRequest): Observable<ApiResponse<WfAprobador>> {
    return this.http.post<ApiResponse<WfAprobador>>(`${this.apiUrl}/aprobadores`, request);
  }

  /**
   * Actualizar aprobador
   */
  actualizarAprobador(id: number, request: Partial<CrearAprobadorRequest>): Observable<ApiResponse<WfAprobador>> {
    return this.http.put<ApiResponse<WfAprobador>>(`${this.apiUrl}/aprobadores/${id}`, request);
  }

  /**
   * Eliminar aprobador
   */
  eliminarAprobador(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/aprobadores/${id}`);
  }

  // ========================================================================
  // INSTANCIAS Y MONITOREO
  // ========================================================================

  /**
   * Obtener instancia de flujo por ID
   */
  obtenerInstancia(id: number): Observable<ApiResponse<WfInstancia>> {
    return this.http.get<ApiResponse<WfInstancia>>(`${this.apiUrl}/instancias/${id}`);
  }

  /**
   * Listar instancias de flujo con filtros
   */
  listarInstancias(params?: {
    modulo?: string;
    estado?: EstadoFlujo;
    id_definicion?: number;
    page?: number;
    per_page?: number;
  }): Observable<PaginatedResponse<WfInstancia>> {
    let httpParams = new HttpParams();
    
    if (params) {
      if (params.modulo) httpParams = httpParams.set('modulo', params.modulo);
      if (params.estado) httpParams = httpParams.set('estado', params.estado);
      if (params.id_definicion) httpParams = httpParams.set('id_definicion', params.id_definicion.toString());
      if (params.page) httpParams = httpParams.set('page', params.page.toString());
      if (params.per_page) httpParams = httpParams.set('per_page', params.per_page.toString());
    }

    return this.http.get<PaginatedResponse<WfInstancia>>(`${this.apiUrl}/instancias`, { params: httpParams });
  }
}
