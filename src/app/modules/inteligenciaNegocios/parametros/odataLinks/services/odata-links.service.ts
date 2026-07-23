import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../../environments/environment';

export interface OdataLink {
  id: number;
  code: string;
  name: string;
  visibility: 'private' | 'organizational' | 'public';
  schema: string;
  view: string;
  url: string;
  active: boolean;
  expires_at: string | null;
  access_count: number;
  last_accessed_at: string | null;
  created_at: string;
}

export interface OdataLinkCreatePayload {
  name: string;
  visibility: 'private' | 'organizational' | 'public';
  schema_name: string;
  view_name: string;
  columns?: string[];
  filters?: Record<string, string>[];
  sort_col?: string;
  sort_dir?: 'asc' | 'desc';
  max_rows?: number;
  expires_at?: string;
  allowed_ips?: string[];
  allowed_users?: string[];
}

export interface OdataLinkCreateResponse {
  success: boolean;
  data: {
    id: number;
    code: string;
    name: string;
    visibility: string;
    url: string;
    excel_url: string;
    expires_at: string | null;
    public_token?: string;
    full_url?: string;
    warning?: string;
  };
}

export interface OdataApiKey {
  id: number;
  name: string;
  key_prefix: string;
  scope: 'private' | 'shared';
  active: boolean;
  expires_at: string | null;
  last_used_at: string | null;
  use_count: number;
  created_at: string;
}

export interface OdataApiKeyCreateResponse {
  success: boolean;
  data: {
    id: number;
    name: string;
    key: string;
    prefix: string;
    scope: 'private' | 'shared';
    expires_at: string | null;
    instructions: string;
  };
  warning: string;
}

export interface VistaPermissionUser {
  id: number;
  name: string;
  email: string;
}

export interface AllowedDomain {
  id: number;
  domain: string;
  tenant_id: string | null;
  tenant_name: string | null;
  id_empresa: number | null;
  activo: boolean;
  descripcion: string | null;
  created_at: string;
  updated_at: string;
  empresa?: { id: number; nombre: string } | null;
}

@Injectable({
  providedIn: 'root'
})
export class OdataLinksService {
  private readonly baseUrl = `${environment.URL_SERVICIOS}/fabric`;

  constructor(private http: HttpClient) {}

  // ─── Links ──────────────────────────────────────────

  getLinks(): Observable<OdataLink[]> {
    return this.http.get<{ success: boolean; data: OdataLink[] }>(
      `${this.baseUrl}/odata/links`
    ).pipe(map(r => r.data ?? []));
  }

  createLink(payload: OdataLinkCreatePayload): Observable<OdataLinkCreateResponse> {
    return this.http.post<OdataLinkCreateResponse>(
      `${this.baseUrl}/odata/links`, payload
    );
  }

  deactivateLink(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/odata/links/${id}`);
  }

  // ─── API Keys ───────────────────────────────────────

  getApiKeys(): Observable<OdataApiKey[]> {
    return this.http.get<{ success: boolean; data: OdataApiKey[] }>(
      `${this.baseUrl}/odata/api-keys`
    ).pipe(map(r => r.data ?? []));
  }

  createApiKey(name: string, expiresDays?: number, scope: 'private' | 'shared' = 'private'): Observable<OdataApiKeyCreateResponse> {
    return this.http.post<OdataApiKeyCreateResponse>(
      `${this.baseUrl}/odata/api-keys`,
      { name, expires_days: expiresDays, scope }
    );
  }

  revokeApiKey(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/odata/api-keys/${id}`);
  }

  // ─── Permisos por Vista ─────────────────────────────

  getPermissions(vistaId: number): Observable<VistaPermissionUser[]> {
    return this.http.get<{ success: boolean; data: VistaPermissionUser[] }>(
      `${this.baseUrl}/bi-vistas/${vistaId}/permissions`
    ).pipe(map(r => r.data ?? []));
  }

  addPermission(vistaId: number, userId: number): Observable<void> {
    return this.http.post<void>(
      `${this.baseUrl}/bi-vistas/${vistaId}/permissions`,
      { user_id: userId }
    );
  }

  removePermission(vistaId: number, userId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/bi-vistas/${vistaId}/permissions/${userId}`
    );
  }

  // ─── Dominios Permitidos OData ──────────────────────

  getAllowedDomains(): Observable<AllowedDomain[]> {
    return this.http.get<{ domains: AllowedDomain[]; total: number }>(
      `${this.baseUrl}/odata/allowed-domains`
    ).pipe(map(r => r.domains ?? []));
  }

  addAllowedDomain(payload: { domain: string; tenant_id: string; tenant_name: string; id_empresa?: number; descripcion?: string }): Observable<{ domain: AllowedDomain }> {
    return this.http.post<{ domain: AllowedDomain }>(
      `${this.baseUrl}/odata/allowed-domains`, payload
    );
  }

  updateAllowedDomain(id: number, payload: Partial<{ domain: string; tenant_id: string; tenant_name: string; id_empresa: number; activo: boolean; descripcion: string }>): Observable<{ domain: AllowedDomain }> {
    return this.http.put<{ domain: AllowedDomain }>(
      `${this.baseUrl}/odata/allowed-domains/${id}`, payload
    );
  }

  removeAllowedDomain(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/odata/allowed-domains/${id}`);
  }

  toggleDomainStatus(id: number): Observable<{ domain: AllowedDomain }> {
    return this.http.patch<{ domain: AllowedDomain }>(
      `${this.baseUrl}/odata/allowed-domains/${id}/toggle`, {}
    );
  }
}
