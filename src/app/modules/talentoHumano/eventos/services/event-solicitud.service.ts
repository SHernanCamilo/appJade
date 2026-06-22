import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

export interface EventSolicitud {
  id: number;
  consecutivo: string;
  empleado_id: number;
  empleado: string | { id: number; nombre: string };
  aprobador_id?: number;
  aprobador?: string | { id: number; nombre: string };
  unidad_funcional?: string;
  id_unidad_funcional?: number;
  novedad_id?: number;
  empleado_cubre_id?: number;
  fecha_nov_ini: string;
  fecha_nov_fin: string;
  descripcion?: string;
  estado: number | 'proceso' | 'rechazada' | 'aprobada' | 'autorizada' | 'registrado' | 'digitalizado' | 'digitalizada' | 'anulado' | 'anulada';
  motivo_rechazo?: string;
  paso_actual?: string | null;
  aprobador_pendiente?: string | null;
  wf_instancia_id?: number | null;
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
  codigo: string;
  nombre: string;
  pasos: FlujoPreviewPaso[];
}

export function formatUnidadFuncionalLabel(unidad: Pick<UnidadFuncionalOption, 'codigo' | 'nombre'>): string {
  return `${unidad.codigo} - ${unidad.nombre}`;
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
    // Si no hay empresa, devolver array vacío
    if (!empresaId) {
      console.log('=== SERVICIO - Sin empresa ID, devolviendo array vacío ===');
      return new Observable(observer => {
        observer.next([]);
        observer.complete();
      });
    }
    
    // Usar el endpoint correcto para novedades por empresa
    let params = new HttpParams();
    params = params.set('empresa_id', empresaId.toString());
    
    const url = `${environment.URL_SERVICIOS}/talento-humano/eventos/novedad-cargo`;
    
    console.log('=== SERVICIO - Llamando API de novedad-cargo ===');
    console.log('URL:', url);
    console.log('Parámetros:', params.toString());
    console.log('Empresa ID:', empresaId);
    
    return this.http.get<{ success: boolean; data: any[] }>(url, { params }).pipe(
      map(r => {
        console.log('=== SERVICIO - Respuesta RAW del API ===');
        console.log('URL usada:', url);
        console.log('Respuesta completa:', r);
        console.log('Success:', r.success);
        console.log('Data:', r.data);
        console.log('Empresa ID:', empresaId);
        console.log('Total registros:', r.data?.length || 0);
        
        if (!r.success) {
          console.warn('API devolvió success: false');
          return [];
        }
        
        if (!r.data || r.data.length === 0) {
          console.log('No hay novedades para esta empresa');
          return [];
        }
        
        console.log('Primeros 3 registros RAW:', r.data.slice(0, 3));
        
        const mapped = r.data.map((item: any) => {
          // El endpoint novedad-cargo puede tener estructura diferente
          // Puede tener campos como: novedad_id, novedad, cubre, etc.
          console.log('Estructura del item:', item);
          
          // Extraer información de la novedad
          const novedad = item.novedad || item;
          const novedadId = item.novedad_id || novedad.id || item.id;
          const codigo = novedad.codigo || item.codigo;
          const descripcion = novedad.descripcion || item.descripcion;
          const cubreValue = item.cubre !== undefined ? item.cubre : (novedad.cubre || false);
          const cubreBoolean = !!cubreValue;
          
          if (novedadId === 5) {
            console.log(`=== NOVEDAD ID 5 ENCONTRADA ===`, {
              itemCompleto: item,
              novedadId,
              codigo,
              descripcion,
              cubreOriginal: cubreValue,
              tipoOriginal: typeof cubreValue,
              cubreConvertido: cubreBoolean
            });
          }
          
          return {
            label: `${codigo} - ${descripcion}`,
            value: novedadId,
            cubre: cubreBoolean
          };
        });
        
        console.log('Servicio - Novedades mapeadas:', mapped);
        console.log('Servicio - Novedad id:5 mapeada:', mapped.find((m: any) => m.value === 5));
        
        return mapped;
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

  /** Previsualiza el flujo que aplicaría según empresa + unidad funcional + novedad. */
  getFlujoPreview(params: { empresa_id?: number | null; unidad_funcional_id?: number | null; novedad_id?: number | null }): Observable<FlujoPreview | null> {
    let httpParams = new HttpParams();
    if (params.empresa_id) httpParams = httpParams.set('empresa_id', String(params.empresa_id));
    if (params.unidad_funcional_id) httpParams = httpParams.set('unidad_funcional_id', String(params.unidad_funcional_id));
    if (params.novedad_id) httpParams = httpParams.set('novedad_id', String(params.novedad_id));

    return this.http.get<{ success: boolean; data: FlujoPreview | null }>(
      `${this.base}/flujo-preview`, { params: httpParams }
    ).pipe(map(r => r.data));
  }

  getSolicitudes(estado?: string): Observable<{ success: boolean; data: EventSolicitud[] }> {
    let params = new HttpParams();
    if (estado) params = params.set('estado', estado);
    return this.http.get<{ success: boolean; data: EventSolicitud[] }>(
      `${this.base}/solicitudes`, { params }
    );
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

  /** Rechaza el evento y finaliza el flujo. */
  rechazarEvento(id: number, motivo: string): Observable<any> {
    return this.http.post<any>(`${this.base}/solicitudes/${id}/rechazar`, { motivo });
  }

  /** Historial de aprobaciones del evento. */
  getHistorial(id: number): Observable<{ success: boolean; data: any }> {
    return this.http.get<{ success: boolean; data: any }>(
      `${this.base}/solicitudes/${id}/historial`
    );
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
