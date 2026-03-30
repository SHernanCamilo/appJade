import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  WfDefinicion, WfPaso, WfRegla, WfAprobador, WfInstancia,
  CrearDefinicionRequest, CrearPasoRequest, CrearReglaRequest, CrearAprobadorRequest,
  ApiResponse, PaginatedResponse, EstadoFlujo
} from '../models/workflow.models';

/**
 * Servicio global del Motor de Flujos Parametrizable.
 * Reutilizable para cualquier módulo: anticipos, horas_extras, permisos, etc.
 */
@Injectable({ providedIn: 'root' })
export class WorkflowService {
  private apiUrl = '/workflow';

  constructor(private http: HttpClient) {}

  // ── DEFINICIONES ──────────────────────────────────────────────────────────

  listarDefiniciones(params?: {
    modulo?: string; id_empresa?: number; estado?: boolean; page?: number; per_page?: number;
  }): Observable<PaginatedResponse<WfDefinicion>> {
    let p = new HttpParams();
    if (params?.modulo) p = p.set('modulo', params.modulo);
    if (params?.id_empresa) p = p.set('id_empresa', params.id_empresa.toString());
    if (params?.estado !== undefined) p = p.set('estado', params.estado ? '1' : '0');
    if (params?.page) p = p.set('page', params.page.toString());
    if (params?.per_page) p = p.set('per_page', params.per_page.toString());
    return this.http.get<PaginatedResponse<WfDefinicion>>(`${this.apiUrl}/definiciones`, { params: p });
  }

  obtenerDefinicion(id: number): Observable<ApiResponse<WfDefinicion>> {
    return this.http.get<ApiResponse<WfDefinicion>>(`${this.apiUrl}/definiciones/${id}`);
  }

  crearDefinicion(req: CrearDefinicionRequest): Observable<ApiResponse<WfDefinicion>> {
    return this.http.post<ApiResponse<WfDefinicion>>(`${this.apiUrl}/definiciones`, req);
  }

  actualizarDefinicion(id: number, req: Partial<CrearDefinicionRequest>): Observable<ApiResponse<WfDefinicion>> {
    return this.http.put<ApiResponse<WfDefinicion>>(`${this.apiUrl}/definiciones/${id}`, req);
  }

  eliminarDefinicion(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/definiciones/${id}`);
  }

  toggleEstadoDefinicion(id: number): Observable<ApiResponse<WfDefinicion>> {
    return this.http.patch<ApiResponse<WfDefinicion>>(`${this.apiUrl}/definiciones/${id}/toggle-estado`, {});
  }

  // ── PASOS ─────────────────────────────────────────────────────────────────

  listarPasos(idDefinicion: number): Observable<ApiResponse<WfPaso[]>> {
    return this.http.get<ApiResponse<WfPaso[]>>(`${this.apiUrl}/definiciones/${idDefinicion}/pasos`);
  }

  crearPaso(req: CrearPasoRequest): Observable<ApiResponse<WfPaso>> {
    return this.http.post<ApiResponse<WfPaso>>(`${this.apiUrl}/pasos`, req);
  }

  actualizarPaso(id: number, req: Partial<CrearPasoRequest>): Observable<ApiResponse<WfPaso>> {
    return this.http.put<ApiResponse<WfPaso>>(`${this.apiUrl}/pasos/${id}`, req);
  }

  eliminarPaso(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/pasos/${id}`);
  }

  reordenarPasos(idDefinicion: number, pasos: { id: number; orden: number }[]): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/definiciones/${idDefinicion}/reordenar-pasos`, { pasos });
  }

  // ── REGLAS ────────────────────────────────────────────────────────────────

  listarReglas(idDefinicion: number): Observable<ApiResponse<WfRegla[]>> {
    return this.http.get<ApiResponse<WfRegla[]>>(`${this.apiUrl}/definiciones/${idDefinicion}/reglas`);
  }

  crearRegla(req: CrearReglaRequest): Observable<ApiResponse<WfRegla>> {
    return this.http.post<ApiResponse<WfRegla>>(`${this.apiUrl}/reglas`, req);
  }

  actualizarRegla(id: number, req: Partial<CrearReglaRequest>): Observable<ApiResponse<WfRegla>> {
    return this.http.put<ApiResponse<WfRegla>>(`${this.apiUrl}/reglas/${id}`, req);
  }

  eliminarRegla(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/reglas/${id}`);
  }

  // ── APROBADORES ───────────────────────────────────────────────────────────

  listarAprobadores(idPaso: number): Observable<ApiResponse<WfAprobador[]>> {
    return this.http.get<ApiResponse<WfAprobador[]>>(`${this.apiUrl}/pasos/${idPaso}/aprobadores`);
  }

  crearAprobador(req: CrearAprobadorRequest): Observable<ApiResponse<WfAprobador>> {
    return this.http.post<ApiResponse<WfAprobador>>(`${this.apiUrl}/aprobadores`, req);
  }

  actualizarAprobador(id: number, req: Partial<CrearAprobadorRequest>): Observable<ApiResponse<WfAprobador>> {
    return this.http.put<ApiResponse<WfAprobador>>(`${this.apiUrl}/aprobadores/${id}`, req);
  }

  eliminarAprobador(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/aprobadores/${id}`);
  }

  // ── INSTANCIAS / MONITOREO ────────────────────────────────────────────────

  obtenerInstancia(id: number): Observable<ApiResponse<WfInstancia>> {
    return this.http.get<ApiResponse<WfInstancia>>(`${this.apiUrl}/instancias/${id}`);
  }

  listarInstancias(params?: {
    modulo?: string; estado?: EstadoFlujo; id_definicion?: number; page?: number; per_page?: number;
  }): Observable<PaginatedResponse<WfInstancia>> {
    let p = new HttpParams();
    if (params?.modulo) p = p.set('modulo', params.modulo);
    if (params?.estado) p = p.set('estado', params.estado);
    if (params?.id_definicion) p = p.set('id_definicion', params.id_definicion.toString());
    if (params?.page) p = p.set('page', params.page.toString());
    if (params?.per_page) p = p.set('per_page', params.per_page.toString());
    return this.http.get<PaginatedResponse<WfInstancia>>(`${this.apiUrl}/instancias`, { params: p });
  }
}
