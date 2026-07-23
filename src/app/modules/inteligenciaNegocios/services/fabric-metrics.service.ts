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
}
