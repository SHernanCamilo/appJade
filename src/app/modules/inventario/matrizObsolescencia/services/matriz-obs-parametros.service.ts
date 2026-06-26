import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface GrupoParametro {
  id: number;
  nombre: string;
  created_at?: string;
  updated_at?: string;
  parametros?: Parametro[];
}

export interface Parametro {
  id: number;
  id_grupo: number;
  nombre: string;
  valor?: string;
  frecuencia?: string;
  rango_i?: number;
  rango_f?: number;
  created_at?: string;
  updated_at?: string;
  grupo?: GrupoParametro;
}


export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedApiResponse<T> {
  success: boolean;
  data?: T;
  total?: number;
  per_page?: number;
  current_page?: number;
  last_page?: number;
  message?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MatrizObsParametrosService {
  private apiUrl = '/matriz-obsolescencia';

  constructor(private http: HttpClient) {}

  /**
   * Obtener todos los grupos con sus parámetros
   */
  getGrupos(): Observable<ApiResponse<GrupoParametro[]>> {
    return this.http.get<ApiResponse<GrupoParametro[]>>(`${this.apiUrl}/grupos`);
  }

  /**
   * Obtener un grupo específico con sus parámetros
   */
  getGrupo(id: number): Observable<ApiResponse<GrupoParametro>> {
    return this.http.get<ApiResponse<GrupoParametro>>(`${this.apiUrl}/grupos/${id}`);
  }

  /**
   * Crear un nuevo grupo
   */
  createGrupo(nombre: string): Observable<ApiResponse<GrupoParametro>> {
    return this.http.post<ApiResponse<GrupoParametro>>(`${this.apiUrl}/grupos`, { nombre });
  }

  /**
   * Obtener parámetros de un grupo específico
   */
  getParametrosByGrupo(grupoId: number): Observable<ApiResponse<Parametro[]>> {
    return this.http.get<ApiResponse<Parametro[]>>(`${this.apiUrl}/grupos/${grupoId}/parametros`);
  }

  /**
   * Crear un nuevo parámetro
   */
  createParametro(parametro: Partial<Parametro>): Observable<ApiResponse<Parametro>> {
    return this.http.post<ApiResponse<Parametro>>(`${this.apiUrl}/parametros`, parametro);
  }

  /**
   * Actualizar un parámetro
   */
  updateParametro(id: number, parametro: Partial<Parametro>): Observable<ApiResponse<Parametro>> {
    return this.http.put<ApiResponse<Parametro>>(`${this.apiUrl}/parametros/${id}`, parametro);
  }

  /**
   * Eliminar un parámetro
   */
  deleteParametro(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/parametros/${id}`);
  }

  /**
   * Ejecutar cálculos automáticos para la matriz de obsolescencia
   */
  ejecutarCalculos(options?: {
    activo_id?: number;
    batch_size?: number;
    force?: boolean;
    solo_nuevos?: boolean;
  }): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/calcular-valores`, options || {});
  }

  /**
   * Obtener estadísticas por tipo de equipo para gráficos
   */
  getEstadisticasPorTipo(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/estadisticas-por-tipo`);
  }

  /**
   * Obtener estadísticas por ubicación para gráficos
   */
  getEstadisticasPorUbicacion(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/estadisticas-por-ubicacion`);
  }

  /**
   * Obtener equipos filtrados por tipo o ubicación (para modales de gráficas)
   */
  getEquiposPorFiltro(filtros: {
    tipo?: string;
    ubicacion?: string;
    empresa_id?: number;
    sucursal_id?: number;
    sede_id?: number;
    sin_empresa?: boolean;
    page?: number;
    per_page?: number;
  }): Observable<PaginatedApiResponse<any[]>> {
    let params = new HttpParams();
    
    if (filtros.tipo) params = params.set('tipo', filtros.tipo);
    if (filtros.ubicacion) params = params.set('ubicacion', filtros.ubicacion);
    if (filtros.empresa_id) params = params.set('empresa_id', filtros.empresa_id.toString());
    if (filtros.sucursal_id) params = params.set('sucursal_id', filtros.sucursal_id.toString());
    if (filtros.sede_id) params = params.set('sede_id', filtros.sede_id.toString());
    if (filtros.sin_empresa) params = params.set('sin_empresa', '1');
    if (filtros.page) params = params.set('page', filtros.page.toString());
    if (filtros.per_page) params = params.set('per_page', filtros.per_page.toString());
    
    return this.http.get<PaginatedApiResponse<any[]>>(`${this.apiUrl}/equipos-por-filtro`, { params });
  }

  /**
   * Iniciar sincronización completa de equipos desde GLPI
   */
  sincronizarEquipos(): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>('/glpi/sync/force-all', {});
  }

  cancelarSincronizacion(syncId: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>('/glpi/sync/cancel', { sync_id: syncId });
  }

  getEstadoSincronizacion(syncId: string): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>('/glpi/sync/status', {
      params: { sync_id: syncId }
    });
  }

  getLastActiveSyncStatus(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>('/glpi/sync/last-active-status');
  }

  sincronizarActivoEspecifico(assetId: number): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>('/glpi/sync/single-asset', {
      asset_id: assetId
    });
  }

  /**
   * ========================================
   * MÉTODOS PARA PROCESADORES
   * ========================================
   */

  /**
   * Obtener todos los procesadores
   */
  getProcesadores(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/procesadores`);
  }

  /**
   * Crear un nuevo procesador
   */
  createProcesador(procesador: any): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/procesadores`, procesador);
  }

  /**
   * Actualizar un procesador
   */
  updateProcesador(id: number, procesador: any): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`${this.apiUrl}/procesadores/${id}`, procesador);
  }

  /**
   * Eliminar un procesador
   */
  deleteProcesador(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/procesadores/${id}`);
  }

  /**
   * Obtener procesadores desde activos
   */
  getProcesadoresDesdeActivos(): Observable<ApiResponse<string[]>> {
    return this.http.get<ApiResponse<string[]>>(`${this.apiUrl}/procesadores-desde-activos`);
  }

  /**
   * Importar procesadores desde activos
   */
  importarProcesadoresDesdeActivos(): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/procesadores-importar`, {});
  }

  /**
   * ========================================
   * MÉTODOS PARA TIPOS DE RAM
   * ========================================
   */

  /**
   * Obtener todos los tipos de RAM
   */
  getTiposRam(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/tipos-ram`);
  }

  /**
   * Crear un nuevo tipo de RAM
   */
  createTipoRam(tipoRam: any): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/tipos-ram`, tipoRam);
  }

  /**
   * Actualizar un tipo de RAM
   */
  updateTipoRam(id: number, tipoRam: any): Observable<ApiResponse<any>> {
    return this.http.put<ApiResponse<any>>(`${this.apiUrl}/tipos-ram/${id}`, tipoRam);
  }

  /**
   * Eliminar un tipo de RAM
   */
  deleteTipoRam(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/tipos-ram/${id}`);
  }

  /**
   * Obtener tipos de RAM desde activos
   */
  getTiposRamDesdeActivos(): Observable<ApiResponse<string[]>> {
    return this.http.get<ApiResponse<string[]>>(`${this.apiUrl}/tipos-ram-desde-activos`);
  }

  /**
   * Importar tipos de RAM desde activos
   */
  importarTiposRamDesdeActivos(): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/tipos-ram-importar`, {});
  }
}
