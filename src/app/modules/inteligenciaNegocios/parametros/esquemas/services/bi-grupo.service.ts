import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface BiGrupo {
  id: number;
  codigo: string;
  tipo: 1 | 2 | 3;
  descripcion?: string | null;
  empresa_id: number | null;
  created_at?: string;
  updated_at?: string;
  empresa?: {
    id: number;
    nombre: string;
    prefijo?: string;
  };
  vistas?: BiVista[];
  usuario_crea?: { id: number; name: string };
  usuario_modifica?: { id: number; name: string };
}

export interface BiGrupoPayload {
  codigo: string;
  tipo: 1 | 2 | 3;
  descripcion?: string | null;
  empresa_id: number;
}

export interface FabricCatalogView {
  view_name: string;
  qualified_name: string;
  column_count: number;
}

export interface BiVista {
  id: number;
  id_bi_grupos: number;
  nombre: string;
  descripcion?: string | null;
  departamentos?: string[] | null;
}

export interface DepartamentoCatalogo {
  codigo: string;
  nombre: string;
}

interface ApiListResponse {
  success: boolean;
  data: BiGrupo[];
}

interface ApiItemResponse {
  success: boolean;
  message?: string;
  data: BiGrupo | null;
}

interface ApiFabricResponse {
  success: boolean;
  message?: string;
  schema?: string;
  data: FabricCatalogView[];
}

interface ApiSyncVistasResponse {
  success: boolean;
  message?: string;
  data: {
    vistas: BiVista[];
    total_fabric: number;
    nuevas: number;
    actualizadas: number;
    schema: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class BiGrupoService {
  private readonly apiUrl = '/fabric/bi-grupos';

  constructor(private http: HttpClient) {}

  getGrupos(filters: { empresa_id?: number; tipo?: number } = {}): Observable<BiGrupo[]> {
    let params = new HttpParams();
    if (filters.empresa_id != null) {
      params = params.set('empresa_id', filters.empresa_id.toString());
    }
    if (filters.tipo != null) {
      params = params.set('tipo', filters.tipo.toString());
    }

    return this.http.get<ApiListResponse>(this.apiUrl, { params }).pipe(
      map(response => response.data ?? [])
    );
  }

  buscarPorCodigo(codigo: string, empresaId: number): Observable<BiGrupo | null> {
    const params = new HttpParams()
      .set('codigo', codigo.trim().toUpperCase())
      .set('empresa_id', empresaId.toString());

    return this.http.get<ApiItemResponse>(`${this.apiUrl}/buscar`, { params }).pipe(
      map(response => response.data ?? null)
    );
  }

  getGrupo(id: number): Observable<BiGrupo> {
    return this.http.get<ApiItemResponse>(`${this.apiUrl}/${id}`).pipe(
      map(response => response.data as BiGrupo)
    );
  }

  getCatalogoFabric(schema: string, refresh = false): Observable<FabricCatalogView[]> {
    let params = new HttpParams().set('schema', schema.toLowerCase());
    if (refresh) {
      params = params.set('refresh', '1');
    }

    return this.http.get<ApiFabricResponse>(`${this.apiUrl}/catalogo-fabric`, { params }).pipe(
      map(response => response.data ?? [])
    );
  }

  sincronizarVistasFabric(grupoId: number): Observable<ApiSyncVistasResponse> {
    return this.http.post<ApiSyncVistasResponse>(`${this.apiUrl}/${grupoId}/sincronizar-vistas`, {});
  }

  createGrupo(payload: BiGrupoPayload): Observable<BiGrupo> {
    return this.http.post<ApiItemResponse>(this.apiUrl, payload).pipe(
      map(response => response.data as BiGrupo)
    );
  }

  updateGrupo(id: number, payload: Partial<BiGrupoPayload>): Observable<BiGrupo> {
    return this.http.put<ApiItemResponse>(`${this.apiUrl}/${id}`, payload).pipe(
      map(response => response.data as BiGrupo)
    );
  }

  deleteGrupo(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}

@Injectable({
  providedIn: 'root'
})
export class BiVistaService {
  private readonly apiUrl = '/fabric/bi-vistas';

  constructor(private http: HttpClient) {}

  getVistas(idBiGrupos: number): Observable<BiVista[]> {
    const params = new HttpParams().set('id_bi_grupos', idBiGrupos.toString());
    return this.http.get<{ success: boolean; data: BiVista[] }>(this.apiUrl, { params }).pipe(
      map(response => response.data ?? [])
    );
  }

  addVistas(idBiGrupos: number, vistas: { nombre: string; descripcion?: string | null }[]): Observable<BiVista[]> {
    return this.http.post<{ success: boolean; data: BiVista[] }>(`${this.apiUrl}/bulk`, {
      id_bi_grupos: idBiGrupos,
      vistas
    }).pipe(map(response => response.data ?? []));
  }

  deleteVista(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  updateVista(id: number, payload: { departamentos?: string[] | null; descripcion?: string | null }): Observable<BiVista> {
    return this.http.put<{ success: boolean; data: BiVista }>(`${this.apiUrl}/${id}`, payload).pipe(
      map(response => response.data)
    );
  }

  getDepartamentosCatalogo(): Observable<DepartamentoCatalogo[]> {
    return this.http.get<{ success: boolean; data: DepartamentoCatalogo[] }>(`${this.apiUrl}/departamentos-catalogo`).pipe(
      map(response => response.data ?? [])
    );
  }
}
