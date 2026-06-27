import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

export interface TotalesHoras {
  total: number;
  normales: number;
  nocturnas: number;
  festivas: number;
  festivas_nocturnas: number;
}

export interface DesgloseDia {
  normales: number;
  nocturnas: number;
  festivas: number;
  festivas_nocturnas: number;
  rangos: { inicio: string; fin: string }[];
}

export interface CalculoMes extends TotalesHoras {
  desde: string;
  hasta: string;
  anio?: number;
  mes?: number;
  por_dia: { [fecha: string]: DesgloseDia };
}

export interface TurnoEmpleado {
  id: number;
  fecha: string;
  es_descanso: boolean;
  es_festivo: boolean;
  hora_inicio: string | null;
  hora_fin: string | null;
  hora_inicio_2: string | null;
  hora_fin_2: string | null;
  es_jornada_partida: boolean;
  rangos: { inicio: string; fin: string }[];
  plantilla: {
    id: number;
    codigo: string;
    nombre: string;
    color_hex?: string;
  } | null;
  grupo: {
    id: number;
    nombre: string;
  } | null;
  observacion?: string;
}

export interface Festivo {
  fecha: string;
  nombre: string;
}

export interface CuadroMesEmpleado {
  empleado: { id: number; nombre: string; unidad?: string } | null;
  anio: number;
  mes: number;
  turnos: TurnoEmpleado[];
  totales: TotalesHoras;
  por_dia: { [fecha: string]: DesgloseDia };
  festivos: Festivo[];
}

@Injectable({ providedIn: 'root' })
export class CalculoHorasService {

  private apiBase = `${environment.URL_SERVICIOS}/turnos`;

  constructor(private http: HttpClient) {}

  /** Cuadro mensual completo de un empleado: turnos + totales + festivos. */
  getCuadroMesEmpleado(idEmpleado: number, anio: number, mes: number): Observable<CuadroMesEmpleado> {
    const params = new HttpParams().set('anio', anio).set('mes', mes);
    return this.http
      .get<{ success: boolean; data: CuadroMesEmpleado }>(`${this.apiBase}/empleados/${idEmpleado}/cuadro-mes`, { params })
      .pipe(map(r => r.data));
  }

  /** Solo totales de horas por categoría de un empleado en un mes. */
  getTotalesEmpleadoMes(idEmpleado: number, anio: number, mes: number): Observable<CalculoMes> {
    const params = new HttpParams().set('anio', anio).set('mes', mes);
    return this.http
      .get<{ success: boolean; data: CalculoMes }>(`${this.apiBase}/calculo/empleado/${idEmpleado}`, { params })
      .pipe(map(r => r.data));
  }

  /** Festivos en un año. */
  getFestivos(anio: number): Observable<Festivo[]> {
    const params = new HttpParams().set('anio', anio);
    return this.http
      .get<{ success: boolean; data: Festivo[] }>(`${this.apiBase}/festivos`, { params })
      .pipe(map(r => r.data));
  }

  /** Sincronizar festivos desde API externa */
  sincronizarFestivos(anio: number): Observable<any> {
    return this.http.post<{ success: boolean; data: any }>(`${this.apiBase}/festivos/sincronizar`, { anio });
  }

  /** Test de conexión con API externa */
  testConexionFestivos(): Observable<any> {
    return this.http.get<{ success: boolean; message: string }>(`${this.apiBase}/festivos/test-conexion`);
  }

  /** Asegura que existe un cuadro mensual para una UNIDAD FUNCIONAL. Crea si no existe. */
  ensureCuadroUnidad(idUnidad: number, anio: number, mes: number): Observable<{ success: boolean; data: { id_cuadro: number } }> {
    return this.http.post<{ success: boolean; data: { id_cuadro: number } }>(
      `${this.apiBase}/cuadros/ensure`,
      { id_unidad: idUnidad, anio, mes }
    );
  }

  /** Asegura que existe un cuadro mensual para un EMPLEADO. Crea si no existe. */
  ensureCuadroEmpleado(idEmpleado: number, anio: number, mes: number): Observable<{ success: boolean; data: { id_cuadro: number } }> {
    return this.http.post<{ success: boolean; data: { id_cuadro: number } }>(
      `${this.apiBase}/cuadros/ensure`,
      { id_empleado: idEmpleado, anio, mes }
    );
  }

  /** Elimina todos los turnos de un empleado en un mes/año. */
  deleteCuadroMesEmpleado(idEmpleado: number, anio: number, mes: number): Observable<{ success: boolean; data: any }> {
    const params = new HttpParams().set('anio', anio).set('mes', mes);
    return this.http.delete<{ success: boolean; data: any }>(`${this.apiBase}/empleados/${idEmpleado}/cuadro-mes`, { params });
  }
}
