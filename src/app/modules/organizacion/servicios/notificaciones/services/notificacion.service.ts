import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface DashboardResumen {
  total: number;
  enviados: number;
  entregados: number;
  rebotados: number;
  pendientes_envio: number;
  pendientes_verificacion: number;
  errores: number;
  expirados: number;
  tasa_entrega: number;
}

export interface DashboardResponse {
  periodo: { desde: string; hasta: string };
  resumen: DashboardResumen;
  por_tipo: Record<string, number>;
}

export interface EmailNotificacion {
  id: number;
  tipo: string;
  identificacion_paciente: string;
  nombre_paciente: string;
  profesional_nombre: string;
  email_to: string;
  subject: string;
  status: 'PENDING' | 'SENT' | 'ERROR' | 'EXPIRED';
  delivery_status: 'PENDING' | 'DELIVERED' | 'BOUNCED' | 'FAILED';
  error_message: string | null;
  bounce_reason: string | null;
  intentos: number;
  fecha_envio: string | null;
  fecha_intento: string | null;
  delivered_at: string | null;
  especialidad: string;
  clinica: string;
  estado_orden: string;
  created_at: string;
}

export interface EmailDetalle extends EmailNotificacion {
  message_id: string | null;
  ingreso: string;
  unidad_funcional: string;
  cama: string;
  orden: string;
  diagnostico: string;
  folio: string;
  fecha_orden: string;
  observaciones: string | null;
}

export interface EmailTrace {
  id: number;
  event_type: string;
  event_status: string;
  event_message: string;
  created_at: string;
}

export interface EmailDetalleResponse {
  email: EmailDetalle;
  traces: EmailTrace[];
}

export interface EmailRebotado {
  id: number;
  email_to: string;
  profesional_nombre: string;
  identificacion_paciente: string;
  nombre_paciente: string;
  bounce_reason: string;
  bounce_detected_at: string;
  especialidad: string;
  clinica: string;
}

export interface EmailFiltros {
  status?: string;
  delivery_status?: string;
  tipo?: string;
  clinica?: string;
  email_to?: string;
  identificacion?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  per_page?: number;
  page?: number;
}

export interface PaginatedMeta {
  total: number;
  per_page: number;
  current_page: number;
  last_page: number;
}

interface ApiResponse<T> { success: boolean; data: T; message?: string; }
interface PaginatedApiResponse<T> { success: boolean; data: T[]; meta: PaginatedMeta; }

// ── Servicio ────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class NotificacionService {
  private baseUrl = '/notificaciones';

  constructor(private http: HttpClient) {}

  getDashboard(fechaDesde?: string, fechaHasta?: string): Observable<DashboardResponse> {
    let p = new HttpParams();
    if (fechaDesde) p = p.set('fecha_desde', fechaDesde);
    if (fechaHasta) p = p.set('fecha_hasta', fechaHasta);
    return this.http.get<ApiResponse<DashboardResponse>>(`${this.baseUrl}/dashboard`, { params: p })
      .pipe(map(r => r.data));
  }

  getEmails(filtros: EmailFiltros = {}): Observable<{ data: EmailNotificacion[]; meta: PaginatedMeta }> {
    let p = new HttpParams();
    if (filtros.status) p = p.set('status', filtros.status);
    if (filtros.delivery_status) p = p.set('delivery_status', filtros.delivery_status);
    if (filtros.tipo) p = p.set('tipo', filtros.tipo);
    if (filtros.clinica) p = p.set('clinica', filtros.clinica);
    if (filtros.email_to) p = p.set('email_to', filtros.email_to);
    if (filtros.identificacion) p = p.set('identificacion', filtros.identificacion);
    if (filtros.fecha_desde) p = p.set('fecha_desde', filtros.fecha_desde);
    if (filtros.fecha_hasta) p = p.set('fecha_hasta', filtros.fecha_hasta);
    if (filtros.per_page) p = p.set('per_page', filtros.per_page.toString());
    if (filtros.page) p = p.set('page', filtros.page.toString());
    return this.http.get<PaginatedApiResponse<EmailNotificacion>>(`${this.baseUrl}/emails`, { params: p })
      .pipe(map(r => ({ data: r.data, meta: r.meta })));
  }

  getEmailDetail(id: number): Observable<EmailDetalleResponse> {
    return this.http.get<ApiResponse<EmailDetalleResponse>>(`${this.baseUrl}/emails/${id}`)
      .pipe(map(r => r.data));
  }

  getRebotados(): Observable<EmailRebotado[]> {
    return this.http.get<ApiResponse<EmailRebotado[]>>(`${this.baseUrl}/rebotados`)
      .pipe(map(r => r.data));
  }

  checkBounces(): Observable<{ checked: number; bounced: number; delivered: number; message: string }> {
    return this.http.post<ApiResponse<{ checked: number; bounced: number; delivered: number }> & { message: string }>(
      `${this.baseUrl}/check-bounces`, {}
    ).pipe(map(r => ({ ...r.data, message: r.message ?? '' })));
  }
}
