import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

export interface ActivoMatriz {
  tipo_unidad: string;
  id: number;
  id_activo_glpi: number;
  nombre_equipo: string;
  id_empresa: number;
  id_sede: number;
  id_sucursal: number | null;
  agente: string;
  placa: string | null;
  serial: string | null;
  ubicacion: string | null;
  usuario_glpi: string | null;
  puntaje: number;
  usuario_modificacion: string;
  date_u_sincronizacion: string;
  created_at: string;
  updated_at: string;
  
  // Estado de sincronización (solo frontend)
  isSyncing?: boolean;
  
  empresa?: {
    id: number;
    nombre: string;
  };
  sede?: {
    id: number;
    nombre: string;
  };
  sucursal?: {
    id: number;
    nombre: string;
  };
  detalle?: {
    // Campos básicos
    marca: string | null;
    tipo: string | null;
    referencia: string | null;
    
    // RAM
    tamano_ram: number | null;
    generacion_ram: string | null;
    
    // Procesador
    procesador: string | null;
    numero_procesador: number | null;
    
    // Disco
    tipo_disco: string | null;
    tamano_disco: number | null;
    interfaz_conexion: string | null;
    sistema_operativo: string | null;
    
    // Campos adicionales que vienen del backend
    tipo_unidad?: string | null;
    modalidad?: string | null;
    proveedor?: string | null;
    fecha_compra?: string | null;
    edad?: number | null;
    edad_v_util?: number | null;
    incidencias_6_meses?: number | null;
    valoracion_edad?: string | null;
    valoracion_ram?: string | null;
    valoracion_procesador?: string | null;
    valoracion_disco?: string | null;
    
    // IDs y metadatos
    activo_c_id?: number;
    id_activo_c?: number;
    created_at?: string;
    updated_at?: string;
  };
}

export interface ActivosResponse {
  success: boolean;
  data: ActivoMatriz[];
  total: number;
  per_page: number;
  current_page: number;
  last_page: number;
}

export interface FiltrosActivos {
  empresa_id?: number;
  sucursal_id?: number;
  sede_id?: number;
  agente?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface DistribucionEstado {
  optimo: number;
  funcional: number;
  potencialmente: number;
  obsoleto: number;
}

export interface EstadisticaPorTipo extends DistribucionEstado {
  tipo: string;
  total: number;
}

export interface EstadisticaPorUbicacion {
  ubicacion: string;
  empresa_id: number | null;
  sucursal_id: number | null;
  total: number;
  distribucion: DistribucionEstado;
}

export interface DashboardData {
  total_activos: number;
  estadisticas_por_estado: DistribucionEstado;
  estadisticas_por_tipo: EstadisticaPorTipo[];
  estadisticas_por_ubicacion: EstadisticaPorUbicacion[];
}

export interface DashboardResponse {
  success: boolean;
  data: DashboardData;
}

export interface OpcionFiltro {
  id: number;
  nombre: string;
}

export interface OpcionesFiltroResponse {
  success: boolean;
  data: OpcionFiltro[];
}

@Injectable({
  providedIn: 'root'
})
export class MatrizObsActivosService {
  private apiUrl = '/matriz-obs-activos';

  constructor(private http: HttpClient) {}

  private handleError(error: any): Observable<never> {
    console.error('❌ Error en MatrizObsActivosService:', error);
    
    let errorMessage = 'Ha ocurrido un error en el servidor';
    
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else if (error.status) {
      switch (error.status) {
        case 400:
          errorMessage = error.error?.message || 'Solicitud incorrecta';
          break;
        case 401:
          errorMessage = 'No autorizado. Por favor, inicie sesión nuevamente';
          break;
        case 403:
          errorMessage = 'No tiene permisos para realizar esta acción';
          break;
        case 404:
          errorMessage = 'Recurso no encontrado';
          break;
        case 422:
          errorMessage = error.error?.message || 'Error de validación';
          break;
        case 500:
          errorMessage = 'Error interno del servidor';
          break;
        default:
          errorMessage = error.error?.message || `Error del servidor (${error.status})`;
      }
    }
    
    return throwError(() => new Error(errorMessage));
  }

  getActivosPorPermisos(filtros?: FiltrosActivos): Observable<ActivosResponse> {
    let params = new HttpParams();

    if (filtros) {
      // console.log('🔧 Procesando filtros:', filtros);
      
      if (filtros.empresa_id) {
        params = params.set('empresa_id', filtros.empresa_id.toString());
        // console.log('  ✓ empresa_id:', filtros.empresa_id);
      }
      if (filtros.sucursal_id) {
        params = params.set('sucursal_id', filtros.sucursal_id.toString());
        // console.log('  ✓ sucursal_id:', filtros.sucursal_id);
      }
      if (filtros.sede_id) {
        params = params.set('sede_id', filtros.sede_id.toString());
        // console.log('  ✓ sede_id:', filtros.sede_id);
      }
      if (filtros.agente) {
        params = params.set('agente', filtros.agente);
        // console.log('  ✓ agente:', filtros.agente);
      }
      if (filtros.search) {
        params = params.set('search', filtros.search);
        // console.log('  ✓ search:', filtros.search);
      }
      if (filtros.page) {
        params = params.set('page', filtros.page.toString());
        // console.log('  ✓ page:', filtros.page);
      }
      if (filtros.per_page) {
        params = params.set('per_page', filtros.per_page.toString());
        // console.log('  ✓ per_page:', filtros.per_page);
      }
    }

    const finalUrl = `${this.apiUrl}/por-permisos`;
    const finalParams = params.toString();
    
    // console.log('🎯 URL final:', finalUrl);
    // console.log('📋 Parámetros finales:', finalParams);
    // console.log('🔗 URL completa:', finalUrl + (finalParams ? '?' + finalParams : ''));
    
    // console.log('📤 Enviando petición HTTP GET...');

    return this.http.get<ActivosResponse>(finalUrl, { params })
      .pipe(
        tap(response => {
          // console.log('📥 === RESPUESTA DEL SERVIDOR ===');
          // console.log('✅ Status: OK');
          // console.log('📊 Response RAW:', response);
          // console.log('📊 Response Type:', typeof response);
          // console.log('📊 Response.success:', response.success, typeof response.success);
          // console.log('📊 Response.data:', response.data);
          // console.log('📊 Response.data Type:', typeof response.data);
          // console.log('📊 Response.data Array?:', Array.isArray(response.data));
          // console.log('📊 Response.data Length:', response.data?.length);
          // console.log('📊 Response.total:', response.total);
          
          // Verificar estructura de cada activo
          if (response.data && Array.isArray(response.data) && response.data.length > 0) {
            // console.log('🔍 === ANÁLISIS DETALLADO SERVICIO ===');
            response.data.forEach((activo, index) => {
              if (index < 2) { // Solo los primeros 2
                /* console.log(`📋 Activo ${index + 1} en servicio:`, 
                {
                  id: activo.id,
                  nombre_equipo: activo.nombre_equipo,
                  agente: activo.agente,
                  empresa_raw: activo.empresa,
                  detalles_raw: activo.detalle,
                  tiene_empresa: !!activo.empresa,
                  tiene_detalles: !!activo.detalle,
                  keys: Object.keys(activo)
                });*/
              }
            });
          }
        }),
        catchError(error => {
          console.error('❌ === ERROR DEL SERVIDOR ===');
          console.error('🚨 Error completo:', error);
          console.error('📊 Error status:', error.status);
          console.error('📊 Error statusText:', error.statusText);
          console.error('📊 Error message:', error.message);
          console.error('📊 Error url:', error.url);
          console.error('📊 Error body:', error.error);
          return this.handleError(error);
        })
      );
  }

  getAllActivos(filtros?: FiltrosActivos): Observable<ActivosResponse> {
    let params = new HttpParams();

    if (filtros) {
      if (filtros.search) params = params.set('search', filtros.search);
      if (filtros.page) params = params.set('page', filtros.page.toString());
      if (filtros.per_page) params = params.set('per_page', filtros.per_page.toString());
    }

    return this.http.get<ActivosResponse>(this.apiUrl, { params })
      .pipe(catchError(this.handleError.bind(this)));
  }

  getActivo(id: number): Observable<{ success: boolean; data: ActivoMatriz }> {
    return this.http.get<{ success: boolean; data: ActivoMatriz }>(`${this.apiUrl}/${id}`)
      .pipe(catchError(this.handleError.bind(this)));
  }

  getEstadisticas(): Observable<any> {
    return this.http.get(`${this.apiUrl}/estadisticas`)
      .pipe(catchError(this.handleError.bind(this)));
  }

  /**
   * Datos agregados del dashboard (conteos por estado/tipo/ubicación) calculados en el backend.
   */
  getDashboard(filtros?: FiltrosActivos): Observable<DashboardResponse> {
    let params = new HttpParams();

    if (filtros) {
      if (filtros.empresa_id) params = params.set('empresa_id', filtros.empresa_id.toString());
      if (filtros.sucursal_id) params = params.set('sucursal_id', filtros.sucursal_id.toString());
      if (filtros.sede_id) params = params.set('sede_id', filtros.sede_id.toString());
      if (filtros.search) params = params.set('search', filtros.search);
    }

    return this.http.get<DashboardResponse>(`${this.apiUrl}/dashboard`, { params })
      .pipe(catchError(this.handleError.bind(this)));
  }

  /**
   * Opciones para los dropdowns de filtros (empresa/sucursal/sede) según permisos.
   */
  getOpcionesFiltro(
    tipo: 'empresa' | 'sucursal' | 'sede',
    filtros?: { empresa_id?: number; sucursal_id?: number }
  ): Observable<OpcionesFiltroResponse> {
    let params = new HttpParams().set('tipo', tipo);

    if (filtros?.empresa_id) params = params.set('empresa_id', filtros.empresa_id.toString());
    if (filtros?.sucursal_id) params = params.set('sucursal_id', filtros.sucursal_id.toString());

    return this.http.get<OpcionesFiltroResponse>(`${this.apiUrl}/filtros`, { params })
      .pipe(catchError(this.handleError.bind(this)));
  }

  getActivosPorEmpresa(empresaId: number, filtros?: FiltrosActivos): Observable<ActivosResponse> {
    let params = new HttpParams();

    if (filtros) {
      if (filtros.sucursal_id) params = params.set('sucursal_id', filtros.sucursal_id.toString());
      if (filtros.sede_id) params = params.set('sede_id', filtros.sede_id.toString());
      if (filtros.search) params = params.set('search', filtros.search);
      if (filtros.page) params = params.set('page', filtros.page.toString());
      if (filtros.per_page) params = params.set('per_page', filtros.per_page.toString());
    }

    return this.http.get<ActivosResponse>(`${this.apiUrl}/empresa/${empresaId}`, { params })
      .pipe(catchError(this.handleError.bind(this)));
  }

  getActivosPorSucursal(sucursalId: number, filtros?: FiltrosActivos): Observable<ActivosResponse> {
    let params = new HttpParams();

    if (filtros) {
      if (filtros.sede_id) params = params.set('sede_id', filtros.sede_id.toString());
      if (filtros.search) params = params.set('search', filtros.search);
      if (filtros.page) params = params.set('page', filtros.page.toString());
      if (filtros.per_page) params = params.set('per_page', filtros.per_page.toString());
    }

    return this.http.get<ActivosResponse>(`${this.apiUrl}/sucursal/${sucursalId}`, { params })
      .pipe(catchError(this.handleError.bind(this)));
  }

  getActivosPorSede(sedeId: number, filtros?: FiltrosActivos): Observable<ActivosResponse> {
    let params = new HttpParams();

    if (filtros) {
      if (filtros.search) params = params.set('search', filtros.search);
      if (filtros.page) params = params.set('page', filtros.page.toString());
      if (filtros.per_page) params = params.set('per_page', filtros.per_page.toString());
    }

    return this.http.get<ActivosResponse>(`${this.apiUrl}/sede/${sedeId}`, { params })
      .pipe(catchError(this.handleError.bind(this)));
  }

  exportarActivos(filtros?: FiltrosActivos): Observable<Blob> {
    let params = new HttpParams();

    if (filtros) {
      if (filtros.empresa_id) params = params.set('empresa_id', filtros.empresa_id.toString());
      if (filtros.sucursal_id) params = params.set('sucursal_id', filtros.sucursal_id.toString());
      if (filtros.sede_id) params = params.set('sede_id', filtros.sede_id.toString());
      if (filtros.agente) params = params.set('agente', filtros.agente);
      if (filtros.search) params = params.set('search', filtros.search);
    }

    return this.http.get(`${this.apiUrl}/exportar`, { 
      params, 
      responseType: 'blob' 
    }).pipe(catchError(this.handleError.bind(this)));
  }

  exportarEstadisticas(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/exportar-estadisticas`, { 
      responseType: 'blob' 
    }).pipe(catchError(this.handleError.bind(this)));
  }

  /**
   * Actualizar campos editables de un activo
   */
  actualizarActivo(datos: any): Observable<{ success: boolean; message?: string; data?: ActivoMatriz }> {
    return this.http.put<{ success: boolean; message?: string; data?: ActivoMatriz }>(
      `${this.apiUrl}/${datos.id}`, 
      datos
    ).pipe(catchError(this.handleError.bind(this)));
  }
}
