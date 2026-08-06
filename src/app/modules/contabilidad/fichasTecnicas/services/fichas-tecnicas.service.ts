import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import {
  ActualizarFichaPayload,
  AgrupacionValor,
  ApiResponse,
  CrearActualizacionPayload,
  CrearFichaPayload,
  DashboardFichas,
  DetalleFicha,
  DetallePayload,
  Ficha,
  FichaProximaVencer,
  FiltrosFichas,
  HistorialEstado,
  IndicadoresFichas,
  ObservacionFicha,
  PaginatedResponse,
  ResumenPorSucursal,
  RespuestaConflictos,
} from '../models/ficha.model';

/**
 * Servicio unificado del módulo Fichas Técnicas.
 *
 * Consolida lo que estaba repartido en `ficha.service.ts` y
 * `validacion.service.ts`. Todas las operaciones sobre fichas, validación,
 * dashboard y PDF desde un solo punto.
 *
 * Razón: ambos servicios compartían la misma URL base y patrones idénticos.
 * En el backend, el alcance (quién ve qué) lo resuelve el JWT + los roles de
 * Spatie, así que el frontend NO necesita lógica distinta por rol — la misma
 * llamada devuelve datos filtrados según el usuario autenticado.
 */
@Injectable({ providedIn: 'root' })
export class FichasTecnicasService {
  private readonly http = inject(HttpClient);
  private readonly base = '/fichas-tecnicas';

  // ═════════════════════════════════════════════════════════════════════════
  // FICHAS — CRUD y consulta
  // ═════════════════════════════════════════════════════════════════════════

  listar(filtros: FiltrosFichas = {}): Observable<PaginatedResponse<Ficha>> {
    return this.http.get<PaginatedResponse<Ficha>>(`${this.base}/fichas`, {
      params: this.toParams(filtros),
    });
  }

  obtener(id: number): Observable<Ficha> {
    return this.http
      .get<ApiResponse<Ficha>>(`${this.base}/fichas/${id}`)
      .pipe(map((r) => r.data));
  }

  crear(payload: CrearFichaPayload): Observable<Ficha> {
    return this.http
      .post<ApiResponse<Ficha>>(`${this.base}/fichas`, payload)
      .pipe(map((r) => r.data));
  }

  actualizar(id: number, payload: ActualizarFichaPayload): Observable<Ficha> {
    return this.http
      .put<ApiResponse<Ficha>>(`${this.base}/fichas/${id}`, payload)
      .pipe(map((r) => r.data));
  }

  cancelar(id: number, motivo?: string): Observable<Ficha> {
    return this.http
      .delete<ApiResponse<Ficha>>(`${this.base}/fichas/${id}`, { body: { motivo } })
      .pipe(map((r) => r.data));
  }

  crearActualizacion(idFichaPadre: number, payload: CrearActualizacionPayload): Observable<Ficha> {
    return this.http
      .post<ApiResponse<Ficha>>(`${this.base}/fichas/${idFichaPadre}/actualizaciones`, payload)
      .pipe(map((r) => r.data));
  }

  // ═════════════════════════════════════════════════════════════════════════
  // DETALLES (servicios/ítems)
  // ═════════════════════════════════════════════════════════════════════════

  detalles(idFicha: number): Observable<DetalleFicha[]> {
    return this.http
      .get<ApiResponse<DetalleFicha[]>>(`${this.base}/fichas/${idFicha}/detalles`)
      .pipe(map((r) => r.data));
  }

  guardarDetalles(idFicha: number, items: DetallePayload[]): Observable<DetalleFicha[]> {
    return this.http
      .post<ApiResponse<DetalleFicha | DetalleFicha[]>>(`${this.base}/fichas/${idFicha}/detalles`, { items })
      .pipe(map((r) => (Array.isArray(r.data) ? r.data : [r.data])));
  }

  eliminarDetalle(idFicha: number, idDetalle: number): Observable<void> {
    return this.http
      .delete<ApiResponse<null>>(`${this.base}/fichas/${idFicha}/detalles/${idDetalle}`)
      .pipe(map(() => undefined));
  }

  // ═════════════════════════════════════════════════════════════════════════
  // OBSERVACIONES
  // ═════════════════════════════════════════════════════════════════════════

  agregarObservacion(idFicha: number, descObs: string): Observable<ObservacionFicha> {
    return this.http
      .post<ApiResponse<ObservacionFicha>>(`${this.base}/fichas/${idFicha}/observaciones`, { desc_obs: descObs })
      .pipe(map((r) => r.data));
  }

  // ═════════════════════════════════════════════════════════════════════════
  // PROFESIONALES
  // ═════════════════════════════════════════════════════════════════════════

  sincronizarProfesionales(idFicha: number, profesionales: number[]): Observable<Ficha> {
    return this.http
      .put<ApiResponse<Ficha>>(`${this.base}/fichas/${idFicha}/profesionales`, { profesionales })
      .pipe(map((r) => r.data));
  }

  verificarConflictos(
    profesionales: number[],
    fechaIni: string,
    fechaFin: string,
    excluirFicha?: number,
  ): Observable<RespuestaConflictos> {
    return this.http.post<RespuestaConflictos>(`${this.base}/fichas/verificar-conflictos`, {
      profesionales,
      fecha_ini: fechaIni,
      fecha_fin: fechaFin,
      excluir_ficha: excluirFicha ?? null,
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  // VALIDACIÓN (autorizar / aprobar / rechazar / reenviar)
  //
  // Unificado: el estado destino lo determina el BACKEND, no el cliente.
  // La acción es semántica ("autorizar") y el backend aplica la transición
  // correcta según el estado actual de la ficha y los permisos del usuario.
  // ═════════════════════════════════════════════════════════════════════════

  autorizar(idFicha: number, observacion: string): Observable<Ficha> {
    return this.validar(idFicha, 'autorizar', { observacion });
  }

  aprobar(idFicha: number, observacion?: string, consecutivo?: string): Observable<Ficha> {
    return this.validar(idFicha, 'aprobar', { observacion: observacion ?? null, consecutivo: consecutivo ?? null });
  }

  rechazar(idFicha: number, observacion: string): Observable<Ficha> {
    return this.validar(idFicha, 'rechazar', { observacion });
  }

  reenviar(idFicha: number, observacion?: string): Observable<Ficha> {
    return this.validar(idFicha, 'reenviar', { observacion: observacion ?? null });
  }

  /** Endpoint unificado: `POST /fichas/{id}/validar/{accion}` */
  private validar(idFicha: number, accion: string, body: Record<string, string | null>): Observable<Ficha> {
    return this.http
      .post<ApiResponse<Ficha>>(`${this.base}/fichas/${idFicha}/validar/${accion}`, body)
      .pipe(map((r) => r.data));
  }

  consecutivoSugerido(idFicha: number): Observable<string> {
    return this.http
      .get<{ success: boolean; consecutivo: string }>(`${this.base}/fichas/${idFicha}/consecutivo-sugerido`)
      .pipe(map((r) => r.consecutivo));
  }

  // ═════════════════════════════════════════════════════════════════════════
  // HISTORIAL
  // ═════════════════════════════════════════════════════════════════════════

  historial(idFicha: number): Observable<HistorialEstado[]> {
    return this.http
      .get<ApiResponse<HistorialEstado[]>>(`${this.base}/fichas/${idFicha}/historial`)
      .pipe(map((r) => r.data));
  }

  // ═════════════════════════════════════════════════════════════════════════
  // DASHBOARD
  //
  // Todo el filtrado por rol lo hace el backend. El frontend solo pide.
  // ═════════════════════════════════════════════════════════════════════════

  dashboard(): Observable<DashboardFichas> {
    return this.http
      .get<ApiResponse<DashboardFichas>>(`${this.base}/dashboard`)
      .pipe(map((r) => r.data));
  }

  indicadores(): Observable<IndicadoresFichas> {
    return this.http
      .get<ApiResponse<IndicadoresFichas>>(`${this.base}/dashboard/indicadores`)
      .pipe(map((r) => r.data));
  }

  porSucursal(): Observable<ResumenPorSucursal[]> {
    return this.http
      .get<ApiResponse<ResumenPorSucursal[]>>(`${this.base}/dashboard/por-sucursal`)
      .pipe(map((r) => r.data));
  }

  proximasAVencer(limite = 10): Observable<FichaProximaVencer[]> {
    return this.http
      .get<ApiResponse<FichaProximaVencer[]>>(`${this.base}/dashboard/proximas-vencer`, {
        params: { limite: String(limite) },
      })
      .pipe(map((r) => r.data));
  }

  // ═════════════════════════════════════════════════════════════════════════
  // PDF
  // ═════════════════════════════════════════════════════════════════════════

  /** URL relativa del PDF (el interceptor le agrega la baseUrl y el token). */
  urlPdf(idFicha: number, descargar = false): string {
    return `${this.base}/fichas/${idFicha}/pdf${descargar ? '?descargar=1' : ''}`;
  }

  descargarPdf(idFicha: number): Observable<Blob> {
    return this.http.get(this.urlPdf(idFicha, true), { responseType: 'blob' });
  }

  // ═════════════════════════════════════════════════════════════════════════
  // HELPER
  // ═════════════════════════════════════════════════════════════════════════

  private toParams(filtros: FiltrosFichas): HttpParams {
    let params = new HttpParams();

    (Object.keys(filtros) as (keyof FiltrosFichas)[]).forEach((clave) => {
      const valor = filtros[clave];

      if (valor === undefined || valor === null || valor === '') {
        return;
      }

      if (Array.isArray(valor)) {
        valor.forEach((v) => {
          params = params.append(`${clave}[]`, String(v));
        });
        return;
      }

      params = params.set(clave, String(valor));
    });

    return params;
  }
}
