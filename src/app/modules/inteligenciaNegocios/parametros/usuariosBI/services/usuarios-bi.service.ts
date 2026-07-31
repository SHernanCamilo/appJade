import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface BiUsuarioEmpresa {
  id: number;
  nombre: string;
}

export interface BiUsuarioResumen {
  id: number;
  name: string;
  email: string;
  cargo?: string | null;
}

export interface BiGrupoDirecto {
  grupo: string;
  schema: string;
  tipo: number | null;
  descripcion: string | null;
  origen: string;
  fuente: string;
}

export interface BiEsquemaCatalogoUsuario {
  schema: string;
  codigo: string;
  nombre: string;
  tipo: number | null;
  es_delegado: boolean;
  empresa_id: number | null;
  empresa_nombre: string | null;
}

export interface BiVistaDelegadaItem {
  id: number;
  nombre: string;
  descripcion?: string | null;
  estado?: string;
}

export interface BiDelegacionEmpresaGrupo {
  empresa_receptora_id: number;
  empresa_receptora?: string | null;
  id_bi_grupos: number;
  schema: string;
  grupo: string;
  tipo: number | null;
  descripcion_esquema?: string | null;
  empresa_propietaria_id?: number | null;
  empresa_propietaria?: string | null;
  es_otra_empresa: boolean;
  vistas: BiVistaDelegadaItem[];
  total_vistas: number;
}

export interface BiDelegacionUsuarioGrupo {
  empresa_id: number;
  id_bi_grupos: number;
  schema: string;
  grupo: string;
  tipo: number | null;
  descripcion_esquema?: string | null;
  empresa_esquema?: string | null;
  vistas: BiVistaDelegadaItem[];
  total_vistas: number;
}

export interface BiUserGrupRow {
  tipo: string;
  permiso: string;
  origen: string;
}

export interface BiUsuarioPermisos {
  usuario: BiUsuarioResumen;
  empresa_contexto_id: number | null;
  empresas: BiUsuarioEmpresa[];
  departamento: string | null;
  grupos_totales: string[];
  esquemas_totales: string[];
  grupos_directos: BiGrupoDirecto[];
  esquemas_catalogo: BiEsquemaCatalogoUsuario[];
  delegaciones_empresa: BiDelegacionEmpresaGrupo[];
  delegaciones_usuario: BiDelegacionUsuarioGrupo[];
  users_grups: BiUserGrupRow[];
}

export interface BiUsuarioPermisosResponse {
  success: boolean;
  data: BiUsuarioPermisos;
  azure_sync?: {
    synced: boolean;
    users_grups: BiUserGrupRow[];
    error?: string | null;
  } | null;
}

export interface UsuarioEmpresaOption {
  id: number;
  name: string;
  email: string;
}

export interface BiAuditoriaEsquema {
  schema: string;
  codigo: string;
  nombre: string;
}

export interface BiAuditoriaItem {
  id: number;
  accessed_at: string;
  user_id: number | null;
  user_name: string | null;
  user_email: string | null;
  empresa_id: number | null;
  empresa_nombre: string | null;
  schema: string;
  view: string;
  accion: string;
  rows_returned: number;
  elapsed_ms: number;
  success: boolean;
  ip_address: string | null;
}

export interface BiAuditoriaFiltros {
  fecha_desde?: string | null;
  fecha_hasta?: string | null;
  empresa_id?: number | null;
  schema?: string | null;
  user_id?: number | null;
  accion?: string | null;
  view?: string | null;
  limit?: number;
}

export interface BiAuditoriaResponse {
  success: boolean;
  data: {
    items: BiAuditoriaItem[];
    total: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class UsuariosBiService {
  private readonly apiUrl = '/fabric/bi-usuarios';

  constructor(private http: HttpClient) {}

  getPermisos(userId: number, empresaId?: number | null, sync = false): Observable<BiUsuarioPermisos> {
    let params = new HttpParams();
    if (empresaId != null) {
      params = params.set('empresa_id', empresaId.toString());
    }
    if (sync) {
      params = params.set('sync', '1');
    }

    return this.http.get<BiUsuarioPermisosResponse>(`${this.apiUrl}/${userId}/permisos`, { params }).pipe(
      map(response => response.data)
    );
  }

  getAuditoria(filtros: BiAuditoriaFiltros): Observable<{ items: BiAuditoriaItem[]; total: number }> {
    let params = new HttpParams();

    if (filtros.fecha_desde) {
      params = params.set('fecha_desde', filtros.fecha_desde);
    }
    if (filtros.fecha_hasta) {
      params = params.set('fecha_hasta', filtros.fecha_hasta);
    }
    if (filtros.empresa_id != null) {
      params = params.set('empresa_id', filtros.empresa_id.toString());
    }
    if (filtros.schema) {
      params = params.set('schema', filtros.schema);
    }
    if (filtros.user_id != null) {
      params = params.set('user_id', filtros.user_id.toString());
    }
    if (filtros.accion) {
      params = params.set('accion', filtros.accion);
    }
    if (filtros.view) {
      params = params.set('view', filtros.view);
    }
    if (filtros.limit != null) {
      params = params.set('limit', filtros.limit.toString());
    }

    return this.http.get<BiAuditoriaResponse>(`${this.apiUrl}/auditoria`, { params }).pipe(
      map(response => response.data)
    );
  }

  getEsquemasAuditoria(empresaId?: number | null): Observable<BiAuditoriaEsquema[]> {
    let params = new HttpParams();
    if (empresaId != null) {
      params = params.set('empresa_id', empresaId.toString());
    }

    return this.http.get<{ success: boolean; data: BiAuditoriaEsquema[] }>(
      `${this.apiUrl}/auditoria/esquemas`,
      { params }
    ).pipe(map(response => response.data ?? []));
  }
}
