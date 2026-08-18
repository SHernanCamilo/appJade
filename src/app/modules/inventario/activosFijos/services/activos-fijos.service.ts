import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

/** Campo por el que se busca un activo en el maestro de Indigo. */
export type CampoBusqueda = 'placa' | 'serie' | 'responsable' | 'articulo';

/**
 * Activo tal como lo entrega el backend, ya normalizado.
 * Los nombres son estables aunque la vista de Indigo cambie el casing.
 */
export interface ActivoFijo {
  placa: string | null;
  estado: string | null;
  articulo: string | null;
  articulo_codigo: string | null;
  marca: string | null;
  modelo: string | null;
  serie: string | null;
  responsable: string | null;
  localizacion: string | null;
  tipo_inventario: string | null;
  sucursal: string | null;
  estado_fisico: string | null;
  observacion: string | null;
  /** Fila cruda de la vista, por si se necesita un campo no mapeado. */
  _raw?: Record<string, unknown>;
}

/** Un cambio puntual dentro de una novedad. */
export interface CambioTrazabilidad {
  campo: string;
  etiqueta: string;
  anterior: string | null;
  nuevo: string;
}

/** Registro de trazabilidad (una toma de inventario). */
export interface TrazabilidadActivo {
  id: number;
  placa: string;
  serie: string | null;
  articulo_codigo: string | null;
  articulo_nombre: string | null;
  observacion: string | null;
  sucursal_origen: string | null;
  estado_fisico: string | null;
  cambios: CambioTrazabilidad[];
  total_cambios: number;
  registrado_por: {
    id: number | null;
    nombre: string;
    email: string | null;
  };
  created_at: string | null;
  created_at_human: string | null;
}

/** Payload para registrar una novedad. Solo se envían los campos con valor. */
export interface NovedadActivoPayload {
  placa: string;
  novedad_placa?: string | null;
  novedad_estado?: string | null;
  novedad_articulo?: string | null;
  novedad_marca?: string | null;
  novedad_modelo?: string | null;
  novedad_serie?: string | null;
  novedad_responsable?: string | null;
  novedad_localizacion?: string | null;
  novedad_tipo_inventario?: string | null;
  novedad_sucursal?: string | null;
  novedad_estado_fisico?: string | null;
  observacion?: string | null;
  id_empresa?: number | null;
  id_sucursal?: number | null;
}

export interface OpcionesActivo {
  estados: string[];
  estados_fisicos: string[];
}

export interface ResumenTrazabilidad {
  total_tomas: number;
  activos_distintos: number;
  para_baja: number;
  para_reparacion: number;
  en_buen_estado: number;
  tomas_hoy: number;
  externos: number;
}

export interface DetalleActivoResponse {
  activo: ActivoFijo;
  historial: TrazabilidadActivo[];
}

/** Payload para registrar un activo que no existe en el maestro. */
export interface NovedadExternaPayload {
  placa: string;
  serie?: string | null;
  articulo_nombre?: string | null;
  marca?: string | null;
  modelo?: string | null;
  responsable?: string | null;
  localizacion?: string | null;
  sucursal?: string | null;
  estado_fisico?: string | null;
  observacion?: string | null;
  unidad_funcional?: string | null;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  total?: number;
  message?: string;
}

interface ApiPaginated<T> {
  success: boolean;
  data: T[];
  meta: {
    total: number;
    per_page: number;
    current_page: number;
    last_page: number;
  };
}

/**
 * Activos fijos: consulta al maestro de Indigo (solo lectura) y registro de
 * novedades de toma de inventario en la base local.
 */
@Injectable({ providedIn: 'root' })
export class ActivosFijosService {
  private readonly baseUrl = `${environment.URL_SERVICIOS}/inventario/activos-fijos`;

  constructor(private readonly http: HttpClient) {}

  // ── Consulta al maestro (Fabric) ────────────────────────────────────────

  buscar(campo: CampoBusqueda, valor: string, limit = 50): Observable<ApiResponse<ActivoFijo[]>> {
    return this.http.get<ApiResponse<ActivoFijo[]>>(`${this.baseUrl}/buscar`, {
      params: { campo, valor, limit }
    });
  }

  detalle(placa: string): Observable<ApiResponse<DetalleActivoResponse>> {
    return this.http.get<ApiResponse<DetalleActivoResponse>>(
      `${this.baseUrl}/${encodeURIComponent(placa)}`
    );
  }

  columnas(): Observable<ApiResponse<Array<{ name: string; type: string }>>> {
    return this.http.get<ApiResponse<Array<{ name: string; type: string }>>>(`${this.baseUrl}/columnas`);
  }

  opciones(): Observable<ApiResponse<OpcionesActivo>> {
    return this.http.get<ApiResponse<OpcionesActivo>>(`${this.baseUrl}/opciones`);
  }

  // ── Trazabilidad (base local) ───────────────────────────────────────────

  registrarNovedad(payload: NovedadActivoPayload): Observable<ApiResponse<TrazabilidadActivo>> {
    return this.http.post<ApiResponse<TrazabilidadActivo>>(`${this.baseUrl}/novedad`, payload);
  }

  historial(placa: string): Observable<ApiResponse<TrazabilidadActivo[]>> {
    return this.http.get<ApiResponse<TrazabilidadActivo[]>>(
      `${this.baseUrl}/${encodeURIComponent(placa)}/historial`
    );
  }

  trazabilidad(filtros: {
    placa?: string;
    estado_fisico?: string;
    usuario_id?: number;
    desde?: string;
    hasta?: string;
    unidad_funcional?: string;
    es_externo?: boolean;
    per_page?: number;
    page?: number;
  } = {}): Observable<ApiPaginated<TrazabilidadActivo>> {
    const params: Record<string, string> = {};
    Object.entries(filtros).forEach(([clave, valor]) => {
      if (valor !== null && valor !== undefined && valor !== '') {
        params[clave] = String(valor);
      }
    });

    return this.http.get<ApiPaginated<TrazabilidadActivo>>(`${this.baseUrl}/trazabilidad`, { params });
  }

  resumen(): Observable<ApiResponse<ResumenTrazabilidad>> {
    return this.http.get<ApiResponse<ResumenTrazabilidad>>(`${this.baseUrl}/trazabilidad/resumen`);
  }

  // ── Exportar Excel ──────────────────────────────────────────────────────

  exportarExcel(filtros: {
    unidad_funcional?: string;
    placa?: string;
    estado_fisico?: string;
    desde?: string;
    hasta?: string;
    es_externo?: boolean;
  }): Observable<Blob> {
    const params: Record<string, string> = {};
    Object.entries(filtros).forEach(([clave, valor]) => {
      if (valor !== null && valor !== undefined && valor !== '') {
        params[clave] = String(valor);
      }
    });

    return this.http.get(`${this.baseUrl}/exportar`, {
      params,
      responseType: 'blob'
    });
  }

  // ── Novedad externa (activo no encontrado en el maestro) ────────────────

  registrarNovedadExterna(payload: NovedadExternaPayload): Observable<ApiResponse<TrazabilidadActivo>> {
    return this.http.post<ApiResponse<TrazabilidadActivo>>(`${this.baseUrl}/novedad-externa`, payload);
  }

  // ── Unidades funcionales ────────────────────────────────────────────────

  unidadesFuncionales(): Observable<ApiResponse<{ valor: string; origen: string }[]>> {
    return this.http.get<ApiResponse<{ valor: string; origen: string }[]>>(`${this.baseUrl}/unidades-funcionales`);
  }
}
