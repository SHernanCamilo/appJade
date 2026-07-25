import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface ServiceMetrics {
  service: {
    pool_size: number;
    max_concurrent_queries: number;
    active_threads: number;
    command_timeout_s: number;
  };
  redis: {
    available: boolean;
    used_memory_human: string;
    connected_clients: number;
    hits: number;
    misses: number;
    keys: number;
  };
  queries: {
    uptime_hours: number;
    total_queries: number;
    total_cached: number;
    total_errors: number;
    cache_hit_rate: number;
    avg_elapsed_ms: number;
    max_elapsed_ms: number;
    total_rows_served: number;
    queries_per_minute: number;
    unique_views: number;
    unique_users: number;
  };
  top_views: TopView[];
  top_users: TopUser[];
  slow_queries: SlowQuery[];
}

export interface TopView {
  view: string;
  count: number;
}

export interface TopUser {
  user: string;
  count: number;
}

export interface SlowQuery {
  timestamp: string;
  schema: string;
  view: string;
  user_email: string;
  department?: string;
  elapsed_ms: number;
  rows_returned: number;
  query_type?: string;
  filters_used: string[];
  cached: boolean;
  heavy_view: boolean;
}

export interface QueryHistory {
  timestamp: string;
  schema: string;
  view: string;
  user_email: string;
  department?: string;
  elapsed_ms: number;
  rows_returned: number;
  cached: boolean;
  heavy_view: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class FabricMetricsService {
  private readonly baseUrl = `${environment.URL_SERVICIOS}/fabric/metrics`;

  constructor(private http: HttpClient) {}

  /** Resumen completo del servicio */
  getServiceMetrics(): Observable<ServiceMetrics> {
    return this.http.get<ServiceMetrics>(`${this.baseUrl}/service`);
  }

  /** Top vistas más consultadas */
  getTopViews(limit = 20): Observable<TopView[]> {
    return this.http.get<{ top_views: TopView[] }>(
      `${this.baseUrl}/top-views`, { params: { limit: limit.toString() } }
    ).pipe(map(r => r.top_views ?? []));
  }

  /** Top usuarios más activos */
  getTopUsers(limit = 20): Observable<TopUser[]> {
    return this.http.get<{ top_users: TopUser[] }>(
      `${this.baseUrl}/top-users`, { params: { limit: limit.toString() } }
    ).pipe(map(r => r.top_users ?? []));
  }

  /** Queries lentas */
  getSlowQueries(thresholdMs = 5000, limit = 20): Observable<SlowQuery[]> {
    return this.http.get<{ slow_queries: SlowQuery[] }>(
      `${this.baseUrl}/slow`, { params: { threshold_ms: thresholdMs.toString(), limit: limit.toString() } }
    ).pipe(map(r => r.slow_queries ?? []));
  }

  /** Historial de queries recientes */
  getHistory(limit = 100): Observable<QueryHistory[]> {
    return this.http.get<{ queries: QueryHistory[] }>(
      `${this.baseUrl}/history`, { params: { limit: limit.toString() } }
    ).pipe(map(r => r.queries ?? []));
  }

  /** Queries activas en Fabric ahora mismo */
  getFabricActive(): Observable<unknown> {
    return this.http.get(`${this.baseUrl}/fabric/active`);
  }

  /** Resumen de Fabric */
  getFabricSummary(): Observable<unknown> {
    return this.http.get(`${this.baseUrl}/fabric/summary`);
  }

  // ── Error Logs ────────────────────────────────────────

  /** Lista de errores con filtros opcionales */
  getErrorLogs(params: ErrorLogFilters = {}): Observable<ErrorLogResponse> {
    const httpParams: Record<string, string> = {};
    if (params.schema) httpParams['schema'] = params.schema;
    if (params.view) httpParams['view'] = params.view;
    if (params.error_type) httpParams['error_type'] = params.error_type;
    if (params.from) httpParams['from'] = params.from;
    if (params.to) httpParams['to'] = params.to;
    if (params.unresolved) httpParams['unresolved'] = '1';
    httpParams['limit'] = (params.limit ?? 50).toString();

    return this.http.get<ErrorLogResponse>(`${this.baseUrl}/error-logs`, { params: httpParams });
  }

  /** Errores agrupados por vista */
  getErrorsByView(days = 7): Observable<ErrorByView[]> {
    return this.http.get<{ data: ErrorByView[] }>(
      `${this.baseUrl}/error-logs/by-view`, { params: { days: days.toString() } }
    ).pipe(map(r => r.data ?? []));
  }

  /** Marcar un error como resuelto */
  resolveError(id: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/error-logs/${id}/resolve`, {});
  }

  /** Resolver todos los errores de una vista y quitar mantenimiento */
  resolveView(schema: string, view: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/error-logs/resolve-view`, { schema, view });
  }
}

// ── Interfaces de Error Logs ──────────────────────────

export interface ErrorLog {
  id: number;
  schema_name: string;
  view_name: string;
  error_type: 'timeout' | 'fabric_error' | 'permission' | 'unknown';
  error_category: string;
  error_message: string;
  error_detail: string | null;
  user_email: string | null;
  department: string | null;
  elapsed_ms: number | null;
  auto_maintenance_applied: boolean;
  notification_sent: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface ErrorLogSummary {
  total: number;
  today: number;
  timeouts: number;
  fabric_errors: number;
  auto_maintenance: number;
}

export interface ErrorLogResponse {
  success: boolean;
  summary: ErrorLogSummary;
  data: ErrorLog[];
}

export interface ErrorLogFilters {
  schema?: string;
  view?: string;
  error_type?: string;
  from?: string;
  to?: string;
  unresolved?: boolean;
  limit?: number;
}

export interface ErrorByView {
  schema_name: string;
  view_name: string;
  error_type: string;
  error_count: number;
  last_error: string;
}
