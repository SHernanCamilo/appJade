import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Solicitud, CrearSolicitudRequest, AprobarSolicitudRequest,
  RechazarSolicitudRequest, LegalizarRequest, DecidirContabilidadRequest,
  CalculoTopesRequest, CalculoTopesResponse,
  ApiResponse, PaginatedResponse, Aprobacion
} from '../models/anticipo.models';

/**
 * Servicio de Anticipos — 19 endpoints del backend V2.
 * Cubre: cálculo de topes, CRUD solicitudes, aprobaciones,
 * desembolso, legalización, contabilidad, excedentes y cierre.
 */
@Injectable({ providedIn: 'root' })
export class AnticipoSolicitudService {
  private api = '/anticipos';

  constructor(private http: HttpClient) {}

  // ── CÁLCULO DE TOPES ──────────────────────────────────────────────────────
  calcularTopes(req: CalculoTopesRequest): Observable<ApiResponse<CalculoTopesResponse>> {
    return this.http.post<ApiResponse<CalculoTopesResponse>>(`${this.api}/calcular-topes`, req);
  }

  // ── SOLICITUDES CRUD ──────────────────────────────────────────────────────
  listarSolicitudes(params?: {
    estado?: string; id_empleado?: number;
    fecha_desde?: string; fecha_hasta?: string;
    page?: number; per_page?: number;
  }): Observable<PaginatedResponse<Solicitud>> {
    let p = new HttpParams();
    if (params?.estado) p = p.set('estado', params.estado);
    if (params?.id_empleado) p = p.set('id_empleado', params.id_empleado.toString());
    if (params?.fecha_desde) p = p.set('fecha_desde', params.fecha_desde);
    if (params?.fecha_hasta) p = p.set('fecha_hasta', params.fecha_hasta);
    if (params?.page) p = p.set('page', params.page.toString());
    if (params?.per_page) p = p.set('per_page', params.per_page.toString());
    return this.http.get<PaginatedResponse<Solicitud>>(`${this.api}/solicitudes`, { params: p });
  }

  crearSolicitud(req: CrearSolicitudRequest): Observable<ApiResponse<Solicitud>> {
    return this.http.post<ApiResponse<Solicitud>>(`${this.api}/solicitudes`, req);
  }

  verSolicitud(id: number): Observable<ApiResponse<Solicitud>> {
    return this.http.get<ApiResponse<Solicitud>>(`${this.api}/solicitudes/${id}`);
  }

  // ── FASE 1: APROBACIÓN ────────────────────────────────────────────────────
  aprobarSolicitud(id: number, req: AprobarSolicitudRequest): Observable<ApiResponse<Solicitud>> {
    return this.http.post<ApiResponse<Solicitud>>(`${this.api}/solicitudes/${id}/aprobar`, req);
  }

  rechazarSolicitud(id: number, req: RechazarSolicitudRequest): Observable<ApiResponse<Solicitud>> {
    return this.http.post<ApiResponse<Solicitud>>(`${this.api}/solicitudes/${id}/rechazar`, req);
  }

  // ── FASE 2: DESEMBOLSO ────────────────────────────────────────────────────
  desembolsar(id: number): Observable<ApiResponse<Solicitud>> {
    return this.http.post<ApiResponse<Solicitud>>(`${this.api}/solicitudes/${id}/desembolsar`, {});
  }

  // ── FASE 3: LEGALIZACIÓN ──────────────────────────────────────────────────
  legalizar(id: number, req: LegalizarRequest): Observable<ApiResponse<Solicitud>> {
    return this.http.post<ApiResponse<Solicitud>>(`${this.api}/solicitudes/${id}/legalizar`, req);
  }

  // ── FASE 4: CONTABILIDAD ──────────────────────────────────────────────────
  decidirContabilidad(id: number, req: DecidirContabilidadRequest): Observable<ApiResponse<Solicitud>> {
    return this.http.post<ApiResponse<Solicitud>>(`${this.api}/solicitudes/${id}/decidir-contabilidad`, req);
  }

  registrarDevolucion(id: number): Observable<ApiResponse<Solicitud>> {
    return this.http.post<ApiResponse<Solicitud>>(`${this.api}/solicitudes/${id}/registrar-devolucion`, {});
  }

  aprobarExcedente(id: number): Observable<ApiResponse<Solicitud>> {
    return this.http.post<ApiResponse<Solicitud>>(`${this.api}/solicitudes/${id}/aprobar-excedente`, {});
  }

  rechazarExcedente(id: number, req: RechazarSolicitudRequest): Observable<ApiResponse<Solicitud>> {
    return this.http.post<ApiResponse<Solicitud>>(`${this.api}/solicitudes/${id}/rechazar-excedente`, req);
  }

  cerrar(id: number): Observable<ApiResponse<Solicitud>> {
    return this.http.post<ApiResponse<Solicitud>>(`${this.api}/solicitudes/${id}/cerrar`, {});
  }

  // ── HISTORIAL ─────────────────────────────────────────────────────────────
  obtenerHistorial(id: number): Observable<ApiResponse<{ instancia: any; aprobaciones: Aprobacion[] }>> {
    return this.http.get<ApiResponse<any>>(`${this.api}/solicitudes/${id}/historial`);
  }

  // ── MIS APROBACIONES ──────────────────────────────────────────────────────
  misAprobacionesPendientes(params?: {
    estado?: string; page?: number; per_page?: number;
  }): Observable<PaginatedResponse<Solicitud>> {
    let p = new HttpParams();
    if (params?.estado) p = p.set('estado', params.estado);
    if (params?.page) p = p.set('page', params.page.toString());
    if (params?.per_page) p = p.set('per_page', params.per_page.toString());
    return this.http.get<PaginatedResponse<Solicitud>>(`${this.api}/mis-aprobaciones`, { params: p });
  }
}
