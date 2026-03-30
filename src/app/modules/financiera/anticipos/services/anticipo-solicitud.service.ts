import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Solicitud,
  CrearSolicitudRequest,
  AprobarSolicitudRequest,
  RechazarSolicitudRequest,
  CalculoTopesRequest,
  CalculoTopesResponse,
  ApiResponse,
  PaginatedResponse,
  Aprobacion
} from '../models/anticipo.models';

@Injectable({
  providedIn: 'root'
})
export class AnticipoSolicitudService {
  private apiUrl = '/anticipos';

  constructor(private http: HttpClient) {}

  // ========================================================================
  // CÁLCULO DE TOPES
  // ========================================================================

  /**
   * Calcula los topes de alimentación y transporte según nivel jerárquico
   * del empleado y tipo de ciudad destino
   */
  calcularTopes(request: CalculoTopesRequest): Observable<ApiResponse<CalculoTopesResponse>> {
    return this.http.post<ApiResponse<CalculoTopesResponse>>(
      `${this.apiUrl}/calcular-topes`,
      request
    );
  }

  // ========================================================================
  // GESTIÓN DE SOLICITUDES
  // ========================================================================

  /**
   * Listar solicitudes con filtros y paginación
   */
  listarSolicitudes(params?: {
    estado?: string;
    id_empleado?: number;
    fecha_desde?: string;
    fecha_hasta?: string;
    page?: number;
    per_page?: number;
  }): Observable<PaginatedResponse<Solicitud>> {
    let httpParams = new HttpParams();
    
    if (params) {
      if (params.estado) httpParams = httpParams.set('estado', params.estado);
      if (params.id_empleado) httpParams = httpParams.set('id_empleado', params.id_empleado.toString());
      if (params.fecha_desde) httpParams = httpParams.set('fecha_desde', params.fecha_desde);
      if (params.fecha_hasta) httpParams = httpParams.set('fecha_hasta', params.fecha_hasta);
      if (params.page) httpParams = httpParams.set('page', params.page.toString());
      if (params.per_page) httpParams = httpParams.set('per_page', params.per_page.toString());
    }

    return this.http.get<PaginatedResponse<Solicitud>>(`${this.apiUrl}/solicitudes`, { params: httpParams });
  }

  /**
   * Crear nueva solicitud de anticipo
   */
  crearSolicitud(request: CrearSolicitudRequest): Observable<ApiResponse<Solicitud>> {
    return this.http.post<ApiResponse<Solicitud>>(`${this.apiUrl}/solicitudes`, request);
  }

  /**
   * Ver detalle de una solicitud
   */
  verSolicitud(id: number): Observable<ApiResponse<Solicitud>> {
    return this.http.get<ApiResponse<Solicitud>>(`${this.apiUrl}/solicitudes/${id}`);
  }

  /**
   * Aprobar solicitud (solo para aprobadores)
   */
  aprobarSolicitud(id: number, request: AprobarSolicitudRequest): Observable<ApiResponse<Solicitud>> {
    return this.http.post<ApiResponse<Solicitud>>(`${this.apiUrl}/solicitudes/${id}/aprobar`, request);
  }

  /**
   * Rechazar solicitud (solo para aprobadores)
   */
  rechazarSolicitud(id: number, request: RechazarSolicitudRequest): Observable<ApiResponse<Solicitud>> {
    return this.http.post<ApiResponse<Solicitud>>(`${this.apiUrl}/solicitudes/${id}/rechazar`, request);
  }

  /**
   * Obtener historial de aprobaciones de una solicitud
   */
  obtenerHistorial(id: number): Observable<ApiResponse<{ instancia: any; aprobaciones: Aprobacion[] }>> {
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/solicitudes/${id}/historial`);
  }

  // ========================================================================
  // MIS APROBACIONES (Para aprobadores)
  // ========================================================================

  /**
   * Listar solicitudes pendientes de aprobación del usuario actual
   */
  misAprobacionesPendientes(params?: {
    estado?: string;
    page?: number;
    per_page?: number;
  }): Observable<PaginatedResponse<Solicitud>> {
    let httpParams = new HttpParams();
    
    if (params) {
      if (params.estado) httpParams = httpParams.set('estado', params.estado);
      if (params.page) httpParams = httpParams.set('page', params.page.toString());
      if (params.per_page) httpParams = httpParams.set('per_page', params.per_page.toString());
    }

    return this.http.get<PaginatedResponse<Solicitud>>(`${this.apiUrl}/mis-aprobaciones`, { params: httpParams });
  }
}
