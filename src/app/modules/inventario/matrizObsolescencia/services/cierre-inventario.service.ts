import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface CierreInventario {
  id: number;
  nombre: string;
  periodo: string | null;
  descripcion: string | null;
  estado: 'pendiente' | 'procesando' | 'cerrado' | 'error';
  fecha_inicio_proceso: string | null;
  fecha_fin_proceso: string | null;
  duracion_segundos: number | null;
  duracion_formateada: string;
  mensaje_error: string | null;
  total_activos: number;
  total_optimo: number;
  total_funcional: number;
  total_potencial: number;
  total_obsoleto: number;
  puntaje_promedio: number;
  porcentaje_optimo: number;
  porcentaje_obsoleto: number;
  config_recalculo_aplicado: boolean;
  config_incluyo_sin_puntaje: boolean;
  config_incluyo_inactivos: boolean;
  creado_por: number | null;
  nombre_creador: string | null;
  en_progreso: boolean;
  created_at: string;
  updated_at: string;
}

export interface CierreDetalle {
  id: number;
  cierre_id: number;
  activo_c_id: number | null;
  id_activo_glpi: number | null;
  nombre_equipo: string | null;
  id_empresa: number | null;
  nombre_empresa: string | null;
  id_sucursal: number | null;
  nombre_sucursal: string | null;
  id_sede: number | null;
  nombre_sede: string | null;
  agente: string | null;
  placa: string | null;
  serial: string | null;
  ubicacion: string | null;
  usuario_glpi: string | null;
  puntaje: number;
  estado_obsolescencia: 'optimo' | 'funcional' | 'potencial' | 'obsoleto';
  marca: string | null;
  tipo: string | null;
  referencia: string | null;
  procesador: string | null;
  tamano_ram: number | null;
  tamano_disco: number | null;
  tipo_disco: string | null;
  sistema_operativo: string | null;
  edad: number | null;
  incidencias_6_meses: number;
  created_at: string;
}

export interface CierreConfig {
  id: number;
  recalcular_antes_de_cerrar: boolean;
  incluir_sin_puntaje: boolean;
  incluir_inactivos: boolean;
  notificar_al_cerrar: boolean;
  emails_notificacion: string | null;
  max_cierres_a_conservar: number;
  modificado_por: string | null;
  updated_at: string;
}

export interface ResumenEmpresaCierre {
  id_empresa: number | null;
  nombre_empresa: string | null;
  total: number;
  optimo: number;
  funcional: number;
  potencial: number;
  obsoleto: number;
  puntaje_promedio: number;
}

export interface ComparacionCierres {
  cierre_anterior: Partial<CierreInventario>;
  cierre_actual:   Partial<CierreInventario>;
  comparacion: {
    total_activos:    DeltaItem;
    total_optimo:     DeltaItem;
    total_funcional:  DeltaItem;
    total_potencial:  DeltaItem;
    total_obsoleto:   DeltaItem;
    puntaje_promedio: DeltaItem;
  };
}

export interface DeltaItem {
  anterior: number;
  actual:   number;
  delta:    number;
  pct:      number | null;
}

export interface CierresResponse {
  success: boolean;
  data: CierreInventario[];
  total: number;
  per_page: number;
  current_page: number;
  last_page: number;
}

export interface CierreDetalleResponse {
  success: boolean;
  cierre: Partial<CierreInventario>;
  data: CierreDetalle[];
  total: number;
  per_page: number;
  current_page: number;
  last_page: number;
}

export interface FiltrosCierre {
  estado?: string;
  periodo?: string;
  page?: number;
  per_page?: number;
}

export interface FiltrosDetalleCierre {
  empresa_id?: number;
  sucursal_id?: number;
  sede_id?: number;
  estado_obsolescencia?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

// ─── Servicio ─────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class CierreInventarioService {

  private readonly apiUrl = '/cierre-inventario';

  constructor(private http: HttpClient) {}

  // ── Helpers ────────────────────────────────────────────────────────────────

  private handleError(error: any): Observable<never> {
    let msg = 'Ha ocurrido un error en el servidor';
    if (error.error instanceof ErrorEvent) {
      msg = error.error.message;
    } else if (error.status) {
      const map: Record<number, string> = {
        401: 'No autorizado. Inicia sesión nuevamente',
        403: 'No tienes permisos para esta acción',
        404: 'Recurso no encontrado',
        409: error.error?.message || 'Conflicto: operación no permitida',
        422: error.error?.message || 'Datos inválidos',
        500: 'Error interno del servidor',
      };
      msg = map[error.status] ?? error.error?.message ?? `Error ${error.status}`;
    }
    return throwError(() => new Error(msg));
  }

  private buildParams(obj: Record<string, any>): HttpParams {
    let params = new HttpParams();
    Object.entries(obj).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params = params.set(k, String(v));
      }
    });
    return params;
  }

  // ── Cierres ────────────────────────────────────────────────────────────────

  /** Lista paginada de cierres */
  getCierres(filtros?: FiltrosCierre): Observable<CierresResponse> {
    const params = this.buildParams(filtros ?? {});
    return this.http.get<CierresResponse>(this.apiUrl, { params })
      .pipe(catchError(this.handleError.bind(this)));
  }

  /** Crear y ejecutar un nuevo cierre */
  crearCierre(datos: { nombre: string; periodo?: string; descripcion?: string }):
    Observable<{ success: boolean; message: string; data: CierreInventario }> {
    return this.http.post<{ success: boolean; message: string; data: CierreInventario }>(
      this.apiUrl, datos
    ).pipe(catchError(this.handleError.bind(this)));
  }

  /** Obtener cabecera de un cierre */
  getCierre(id: number): Observable<{ success: boolean; data: CierreInventario }> {
    return this.http.get<{ success: boolean; data: CierreInventario }>(`${this.apiUrl}/${id}`)
      .pipe(catchError(this.handleError.bind(this)));
  }

  /** Eliminar un cierre */
  eliminarCierre(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/${id}`)
      .pipe(catchError(this.handleError.bind(this)));
  }

  /** Detalle paginado del snapshot de un cierre */
  getDetalle(id: number, filtros?: FiltrosDetalleCierre): Observable<CierreDetalleResponse> {
    const params = this.buildParams(filtros ?? {});
    return this.http.get<CierreDetalleResponse>(`${this.apiUrl}/${id}/detalle`, { params })
      .pipe(catchError(this.handleError.bind(this)));
  }

  /** Resumen por empresa de un cierre */
  getResumenPorEmpresa(id: number):
    Observable<{ success: boolean; cierre: Partial<CierreInventario>; data: ResumenEmpresaCierre[] }> {
    return this.http.get<{ success: boolean; cierre: Partial<CierreInventario>; data: ResumenEmpresaCierre[] }>(
      `${this.apiUrl}/${id}/resumen-empresa`
    ).pipe(catchError(this.handleError.bind(this)));
  }

  /** Comparar dos cierres */
  compararCierres(cierreA: number, cierreB: number):
    Observable<{ success: boolean; data: ComparacionCierres }> {
    const params = this.buildParams({ cierre_a: cierreA, cierre_b: cierreB });
    return this.http.get<{ success: boolean; data: ComparacionCierres }>(
      `${this.apiUrl}/comparar`, { params }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  // ── Configuración ──────────────────────────────────────────────────────────

  getConfig(): Observable<{ success: boolean; data: CierreConfig }> {
    return this.http.get<{ success: boolean; data: CierreConfig }>(`${this.apiUrl}/config`)
      .pipe(catchError(this.handleError.bind(this)));
  }

  updateConfig(config: Partial<CierreConfig>):
    Observable<{ success: boolean; message: string; data: CierreConfig }> {
    return this.http.put<{ success: boolean; message: string; data: CierreConfig }>(
      `${this.apiUrl}/config`, config
    ).pipe(catchError(this.handleError.bind(this)));
  }
}
