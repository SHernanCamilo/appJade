import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

export interface EventSolicitud {
  id: number;
  consecutivo: string;
  empleado_id: number;
  empleado: string | { id: number; nombre: string; numero_identificacion?: string | null; id_empresa?: number };
  aprobador_id?: number;
  aprobador?: string | { id: number; nombre: string };
  unidad_funcional?: string;
  unidad_funcional_codigo?: string;
  id_unidad_funcional?: number;
  empresa_id?: number;
  sucursal_id?: number;
  novedad_id?: number;
  novedad?: { id: number; codigo?: string; descripcion?: string } | string;
  empleado_cubre_id?: number;
  empleado_cubre?: string | { id: number; nombre: string; numero_identificacion?: string | null };
  fecha_nov_ini: string;
  fecha_nov_fin: string;
  fecha_solicitud?: string;
  fecha_digitalizacion?: string;
  user_digitalizador?: string;
  coment_solicitante?: string;
  coment_aprobador?: string;
  /** Alias legacy del comentario del solicitante */
  descripcion?: string;
  estado: number | 'proceso' | 'rechazada' | 'aprobada' | 'autorizada' | 'registrado' | 'digitalizado' | 'digitalizada' | 'anulado' | 'anulada';
  id_motivo_rechazo?: number | null;
  motivo_rechazo?: MotivoRechazoOption | null;
  paso_actual?: string | null;
  aprobador_pendiente?: string | null;
  wf_instancia_id?: number | null;
  /** Acción que el usuario realizó sobre el evento (aprobado/rechazado). */
  mi_accion?: string | null;
  /** Paso en el que el usuario actuó. */
  mi_paso?: string | null;
  mi_fecha_accion?: string | null;
  mi_comentario?: string | null;
  /** Columnas nativas del backend (fallback al editar). */
  id_user_nov?: number;
  id_motivo_evento?: number;
  id_user_cubre?: number;
  id_user_aprobador?: number;
}

export interface CreateEventSolicitudRequest {
  empleado_id: number;
  aprobador_id?: number;
  unidad_funcional_id?: number;
  novedad_id?: number;
  empleado_cubre_id?: number;
  fecha_inicial: string;
  fecha_final: string;
  estado?: number;
  descripcion?: string;
}

export interface EmpleadoOption {
  id: number;
  nombre: string;
  numero_identificacion?: string | null;
}

export function formatEmpleadoLabel(empleado: Pick<EmpleadoOption, 'nombre' | 'numero_identificacion'>): string {
  const doc = empleado.numero_identificacion?.trim();
  return doc ? `${doc} - ${empleado.nombre}` : empleado.nombre;
}

export interface UnidadFuncionalOption {
  id: number;
  codigo: string;
  nombre: string;
  id_empresa: number;
  id_sucursal?: number | null;
  id_sede?: number | null;
}

export interface FlujoPreviewPaso {
  orden: number;
  nombre_paso: string;
  rol_aprobador: string;
  intervinientes?: { id: number; nombre: string }[];
  intervinientes_texto?: string;
}

export interface FlujoPreview {
  parametrizada?: boolean;
  mensaje?: string;
  codigo?: string;
  nombre?: string;
  unidad_funcional_flujo?: { id: number; codigo: string; nombre: string } | null;
  modo_parametrizacion?: 'uf' | 'grupo' | null;
  pasos: FlujoPreviewPaso[];
}

export function formatUnidadFuncionalLabel(unidad: Pick<UnidadFuncionalOption, 'codigo' | 'nombre'>): string {
  return `${unidad.codigo} - ${unidad.nombre}`;
}

export interface MotivoRechazoOption {
  id: number;
  codigo: number;
  descriocion: string;
  id_modulo?: number;
}

export function formatMotivoRechazoLabel(motivo: Pick<MotivoRechazoOption, 'codigo' | 'descriocion'>): string {
  return `${motivo.codigo} - ${motivo.descriocion}`;
}

@Injectable({ providedIn: 'root' })
export class EventSolicitudService {

  private base = `${environment.URL_SERVICIOS}/talento-humano/eventos`;

  constructor(private http: HttpClient) {}

  getEmpleados(
    empresaId?: number | null,
    search?: string,
    page: number = 1,
    limit: number = 100
  ): Observable<EmpleadoOption[]> {
    let params = new HttpParams()
      .set('activos', '1')
      .set('page', page.toString())
      .set('limit', limit.toString());
    if (empresaId) params = params.set('empresa_id', empresaId);
    if (search && search.length >= 2) params = params.set('search', search);

    return this.http.get<{ success: boolean; data: any[] }>(
      `${environment.URL_SERVICIOS}/empleados/opciones`, { params }
    ).pipe(
      map(r => (r.data || []).map((e: any) => ({
        id: e.id,
        nombre: e.nombre,
        numero_identificacion: e.numero_identificacion ?? null
      })))
    );
  }

  /** Empleados de las unidades funcionales a cargo del usuario autenticado. */
  getEmpleadosMiUnidad(
    empresaId?: number | null,
    search?: string,
    page: number = 1,
    limit: number = 100
  ): Observable<EmpleadoOption[]> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
    if (empresaId) params = params.set('empresa_id', empresaId.toString());
    if (search && search.length >= 2) params = params.set('search', search);

    return this.http.get<{ success: boolean; data: any[] }>(
      `${this.base}/empleados/mi-unidad`, { params }
    ).pipe(
      map(r => (r.data || []).map((e: any) => ({
        id: e.id,
        nombre: e.nombre,
        numero_identificacion: e.numero_identificacion ?? null
      })))
    );
  }

  getNovedadesCatalogo(empresaId?: number | null): Observable<any[]> {
    if (!empresaId) {
      return of([]);
    }

    const params = new HttpParams().set('empresa_id', empresaId.toString());
    const url = `${environment.URL_SERVICIOS}/talento-humano/eventos/novedad-cargo`;

    return this.http.get<{ success: boolean; data: any[] }>(url, { params }).pipe(
      map(r => {
        if (!r.success || !r.data?.length) {
          return [];
        }

        return r.data.map((item: any) => {
          const novedad = item.novedad || item;
          const novedadId = item.novedad_id || novedad.id || item.id;
          const codigo = novedad.codigo || item.codigo;
          const descripcion = novedad.descripcion || item.descripcion;
          const cubreValue = item.cubre !== undefined ? item.cubre : (novedad.cubre || false);

          return {
            label: `${codigo} - ${descripcion}`,
            value: novedadId,
            cubre: !!cubreValue
          };
        });
      })
    );
  }

  getUnidadesFuncionales(
    empresaId?: number | null,
    search?: string,
    page: number = 1,
    limit: number = 100
  ): Observable<UnidadFuncionalOption[]> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
    if (empresaId) params = params.set('empresa_id', empresaId.toString());
    if (search && search.length >= 2) params = params.set('search', search);

    return this.http.get<{ success: boolean; data: UnidadFuncionalOption[] }>(
      `${this.base}/unidades-funcionales`,
      { params }
    ).pipe(
      map(r => r.data || [])
    );
  }

  /** Unidades funcionales de las que el usuario autenticado es responsable (cargador). */
  getUnidadesFuncionalesResponsable(empresaId?: number | null): Observable<UnidadFuncionalOption[]> {
    let params = new HttpParams();
    if (empresaId) params = params.set('empresa_id', empresaId.toString());

    return this.http.get<{ success: boolean; data: UnidadFuncionalOption[] }>(
      `${this.base}/unidades-funcionales/responsable`,
      { params }
    ).pipe(
      map(r => r.data || [])
    );
  }

  /** Previsualiza el flujo según la UF donde se realizará el evento. */
  getFlujoPreview(params: {
    empresa_id?: number | null;
    empleado_id?: number | null;
    unidad_funcional_id?: number | null;
    novedad_id?: number | null;
  }): Observable<FlujoPreview | null> {
    let httpParams = new HttpParams();
    if (params.empresa_id) httpParams = httpParams.set('empresa_id', String(params.empresa_id));
    if (params.empleado_id) httpParams = httpParams.set('empleado_id', String(params.empleado_id));
    if (params.unidad_funcional_id) httpParams = httpParams.set('unidad_funcional_id', String(params.unidad_funcional_id));
    if (params.novedad_id) httpParams = httpParams.set('novedad_id', String(params.novedad_id));

    return this.http.get<{ success: boolean; data: FlujoPreview | null }>(
      `${this.base}/flujo-preview`, { params: httpParams }
    ).pipe(map(r => r.data));
  }

  getSolicitudes(filtros: {
    estado?: string | number | null;
    search?: string;
    page?: number;
    per_page?: number;
  } = {}): Observable<{ success: boolean; data: EventSolicitud[]; total: number; current_page: number; per_page: number }> {
    let params = new HttpParams()
      .set('page', String(filtros.page ?? 1))
      .set('per_page', String(filtros.per_page ?? 10));
    if (filtros.estado != null && filtros.estado !== '') {
      params = params.set('estado', String(filtros.estado));
    }
    if (filtros.search?.trim()) {
      params = params.set('search', filtros.search.trim());
    }
    return this.http.get<{ success: boolean; data: EventSolicitud[]; total: number; current_page: number; per_page: number }>(
      `${this.base}/solicitudes`, { params }
    );
  }

  verificarSolapamiento(params: {
    empleado_id: number;
    fecha_inicial: string;
    fecha_final: string;
    excluir_id?: number;
  }): Observable<EventSolicitud | null> {
    let httpParams = new HttpParams()
      .set('empleado_id', String(params.empleado_id))
      .set('fecha_inicial', params.fecha_inicial)
      .set('fecha_final', params.fecha_final);
    if (params.excluir_id) {
      httpParams = httpParams.set('excluir_id', String(params.excluir_id));
    }

    return this.http.get<{ success: boolean; data: EventSolicitud | null }>(
      `${this.base}/solicitudes/solapamiento`, { params: httpParams }
    ).pipe(map(r => r.data ?? null));
  }

  /** Eventos pendientes de acción para el usuario autenticado (bandeja). */
  getPendientes(search?: string): Observable<{ success: boolean; data: EventSolicitud[] }> {
    let params = new HttpParams();
    if (search && search.length >= 2) params = params.set('search', search);
    return this.http.get<{ success: boolean; data: EventSolicitud[] }>(
      `${this.base}/solicitudes/pendientes`, { params }
    );
  }

  /** Aprueba el paso actual del evento y avanza el flujo. */
  aprobarEvento(id: number, comentario?: string): Observable<any> {
    return this.http.post<any>(`${this.base}/solicitudes/${id}/aprobar`, { comentario });
  }

  /** Eventos que el usuario autenticado ya gestionó (aprobó o rechazó). */
  getGestionados(search?: string): Observable<{ success: boolean; data: EventSolicitud[] }> {
    let params = new HttpParams().set('per_page', '500');
    if (search && search.length >= 2) params = params.set('search', search);
    return this.http.get<{ success: boolean; data: EventSolicitud[] }>(
      `${this.base}/solicitudes/gestionados`, { params }
    );
  }

  /** Motivos de rechazo parametrizados para el módulo de eventos. */
  getMotivosRechazo(): Observable<MotivoRechazoOption[]> {
    return this.http.get<{ success: boolean; data: MotivoRechazoOption[] }>(
      `${this.base}/motivos-rechazo`
    ).pipe(map(r => r.data || []));
  }

  /** Rechaza el evento y finaliza el flujo. */
  rechazarEvento(id: number, payload: { id_motivo_rechazo: number; comentario?: string }): Observable<any> {
    return this.http.post<any>(`${this.base}/solicitudes/${id}/rechazar`, payload);
  }

  /** Historial de aprobaciones del evento. */
  getHistorial(id: number): Observable<{ success: boolean; data: any }> {
    return this.http.get<{ success: boolean; data: any }>(
      `${this.base}/solicitudes/${id}/historial`
    );
  }

  /** Eventos autorizados pendientes de digitalizar (cargue a nómina). */
  getPendientesDigitalizar(filtros: {
    search?: string;
    empresa_id?: number | null;
    sucursal_id?: number | null;
  } = {}): Observable<{ success: boolean; data: EventSolicitud[]; total: number }> {
    let params = new HttpParams()
      .set('paso', 'digitalizar')
      .set('per_page', '200');
    if (filtros.search?.trim() && filtros.search.trim().length >= 2) {
      params = params.set('search', filtros.search.trim());
    }
    if (filtros.empresa_id) {
      params = params.set('empresa_id', String(filtros.empresa_id));
    }
    if (filtros.sucursal_id) {
      params = params.set('sucursal_id', String(filtros.sucursal_id));
    }
    return this.http.get<{ success: boolean; data: EventSolicitud[]; total: number }>(
      `${this.base}/solicitudes/pendientes`, { params }
    );
  }

  /** Eventos ya digitalizados. Requiere rango de fechas. */
  getDigitalizados(filtros: {
    fecha_desde: string;
    fecha_hasta: string;
    search?: string;
    empresa_id?: number | null;
    sucursal_id?: number | null;
  }): Observable<{ success: boolean; data: EventSolicitud[]; total: number }> {
    let params = new HttpParams()
      .set('fecha_desde', filtros.fecha_desde)
      .set('fecha_hasta', filtros.fecha_hasta)
      .set('per_page', '200');
    if (filtros.search?.trim() && filtros.search.trim().length >= 2) {
      params = params.set('search', filtros.search.trim());
    }
    if (filtros.empresa_id) {
      params = params.set('empresa_id', String(filtros.empresa_id));
    }
    if (filtros.sucursal_id) {
      params = params.set('sucursal_id', String(filtros.sucursal_id));
    }
    return this.http.get<{ success: boolean; data: EventSolicitud[]; total: number }>(
      `${this.base}/solicitudes/digitalizados`, { params }
    );
  }

  /** Cierra un evento autorizado: pasa a Digitalizado. */
  digitalizarEvento(id: number, comentario?: string): Observable<any> {
    return this.http.post<any>(`${this.base}/solicitudes/${id}/digitalizar`, { comentario });
  }

  /** Digitaliza varios eventos por id y/o consecutivo. */
  digitalizarMasivo(payload: {
    ids?: number[];
    consecutivos?: string[];
    comentario?: string;
  }): Observable<{
    success: boolean;
    message: string;
    data: { exitosos: number; fallidos: { id?: number; consecutivo?: string; message: string }[] };
  }> {
    return this.http.post<any>(`${this.base}/solicitudes/digitalizar-masivo`, payload);
  }

  getSolicitudById(id: number): Observable<EventSolicitud> {
    return this.http.get<{ success: boolean; data: EventSolicitud }>(
      `${this.base}/solicitudes/${id}`
    ).pipe(map(r => r.data));
  }

  createSolicitud(data: CreateEventSolicitudRequest): Observable<any> {
    return this.http.post<any>(`${this.base}/solicitudes`, data);
  }

  updateSolicitud(id: number, data: Partial<CreateEventSolicitudRequest> & Record<string, any>): Observable<any> {
    return this.http.put<any>(`${this.base}/solicitudes/${id}`, data);
  }

  deleteSolicitud(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/solicitudes/${id}`);
  }
}
