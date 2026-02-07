import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

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

@Injectable({
  providedIn: 'root'
})
export class MatrizObsParametrosService {
  private apiUrl = `${environment.URL_SERVICIOS}/matriz-obsolescencia`;

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
   * Iniciar sincronización completa de equipos desde GLPI
   */
  sincronizarEquipos(): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${environment.URL_SERVICIOS}/glpi/sync/force-all`, {});
  }

  /**
   * Cancelar sincronización en curso
   */
  cancelarSincronizacion(syncId: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${environment.URL_SERVICIOS}/glpi/sync/cancel`, { sync_id: syncId });
  }

  /**
   * Obtener estado de sincronización
   */
  getEstadoSincronizacion(syncId: string): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${environment.URL_SERVICIOS}/glpi/sync/status`, {
      params: { sync_id: syncId }
    });
  }

  /**
   * Obtener el estado de la última sincronización activa
   */
  getLastActiveSyncStatus(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${environment.URL_SERVICIOS}/glpi/sync/last-active-status`);
  }

  /**
   * Sincronizar un activo específico
   */
  sincronizarActivoEspecifico(assetId: number): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${environment.URL_SERVICIOS}/glpi/sync/single-asset`, {
      asset_id: assetId
    });
  }

}
