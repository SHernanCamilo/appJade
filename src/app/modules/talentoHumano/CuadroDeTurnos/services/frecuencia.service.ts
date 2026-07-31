import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

export interface Frecuencia {
  id?: number;
  id_empleado: number;
  id_plantilla: number;
  id_cuadro?: number | null;
  tipo_frecuencia: 'sin_programacion' | 'por_numero_dias' | 'por_dias_semana' | 'dias_del_mes';
  cada_n_dias?: number | null;
  dias_semana?: number[] | null;    // [0=dom, 1=lun, ..., 6=sab]
  dias_mes?: number[] | null;       // [1, 15, 28, ...]
  fecha_inicio: string;             // YYYY-MM-DD
  fecha_fin: string;                // YYYY-MM-DD
  incluir_festivos: boolean;
  incluir_dominicales: boolean;
  es_descanso?: boolean;
  hora_inicio_override?: string | null;
  hora_fin_override?: string | null;
  observacion?: string | null;
  estado?: boolean;
  creado_por?: number;
  created_at?: string;
  updated_at?: string;
  // Relaciones cargadas
  empleado?: any;
  plantilla?: any;
}

export interface FrecuenciaTipo {
  [key: string]: string;
}

export interface PrevisualizarResponse {
  fechas: string[];
  total_fechas: number;
  tipo_frecuencia: string;
}

export interface GenerarResponse {
  frecuencia?: Frecuencia;
  total: number;
  total_ok: number;
  total_err: number;
  errores: { fecha: string; error: string }[];
}

@Injectable({
  providedIn: 'root'
})
export class FrecuenciaService {

  private apiUrl = `${environment.URL_SERVICIOS}/turnos/frecuencias`;

  constructor(private http: HttpClient) {}

  /**
   * Obtener los tipos de frecuencia disponibles (para dropdown).
   */
  getTipos(): Observable<FrecuenciaTipo> {
    return this.http.get<any>(`${this.apiUrl}/tipos`).pipe(
      map(res => res.data)
    );
  }

  /**
   * Listar frecuencias (opcionalmente por empleado).
   */
  listar(params?: { id_empleado?: number; tipo_frecuencia?: string }): Observable<Frecuencia[]> {
    return this.http.get<any>(this.apiUrl, { params: params as any }).pipe(
      map(res => res.data || [])
    );
  }

  /**
   * Obtener una frecuencia por ID.
   */
  getById(id: number): Observable<Frecuencia> {
    return this.http.get<any>(`${this.apiUrl}/${id}`).pipe(
      map(res => res.data)
    );
  }

  /**
   * Crear una frecuencia.
   */
  crear(frecuencia: Partial<Frecuencia>): Observable<any> {
    return this.http.post<any>(this.apiUrl, frecuencia);
  }

  /**
   * Actualizar una frecuencia.
   */
  actualizar(id: number, frecuencia: Partial<Frecuencia>): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, frecuencia);
  }

  /**
   * Eliminar una frecuencia.
   */
  eliminar(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`);
  }

  /**
   * Generar asignaciones desde una frecuencia guardada.
   */
  generar(id: number): Observable<GenerarResponse> {
    return this.http.post<any>(`${this.apiUrl}/${id}/generar`, {}).pipe(
      map(res => res.data)
    );
  }

  /**
   * Generar directamente (crear frecuencia + generar en un solo paso).
   */
  generarDirecto(config: Partial<Frecuencia>): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/generar-directo`, config);
  }

  /**
   * Previsualizar: calcula las fechas sin crear asignaciones.
   */
  previsualizar(config: Partial<Frecuencia>): Observable<PrevisualizarResponse> {
    return this.http.post<any>(`${this.apiUrl}/previsualizar`, config).pipe(
      map(res => res.data)
    );
  }
}
