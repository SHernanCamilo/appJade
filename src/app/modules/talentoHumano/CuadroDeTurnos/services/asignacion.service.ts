import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface Asignacion {
  id?: number;
  cuadro_id?: number;
  id_cuadro?: number;
  empleado_id?: number;
  id_empleado?: number;
  plantilla_id?: number;
  id_plantilla?: number | null;
  dia?: number;
  fecha?: string;
  es_descanso?: boolean;
  es_festivo?: boolean;
  // Rango 1
  hora_inicio_override?: string | null;
  hora_fin_override?: string | null;
  // Rango 2 (jornada partida)
  hora_inicio_override_2?: string | null;
  hora_fin_override_2?: string | null;
  observacion?: string | null;
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AsignacionService {

  private apiUrl = `${environment.URL_SERVICIOS}/turnos/asignaciones`;

  constructor(private http: HttpClient) { }

  // Crear una asignación
  createAsignacion(asignacion: Asignacion): Observable<Asignacion> {
    return this.http.post<Asignacion>(this.apiUrl, asignacion);
  }

  // Obtener una asignación por ID
  getAsignacion(id: number): Observable<Asignacion> {
    return this.http.get<Asignacion>(`${this.apiUrl}/${id}`);
  }

  // Actualizar una asignación
  updateAsignacion(id: number, asignacion: Asignacion): Observable<Asignacion> {
    return this.http.put<Asignacion>(`${this.apiUrl}/${id}`, asignacion);
  }

  // Eliminar una asignación
  deleteAsignacion(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  // Obtener turnos de un empleado en un período
  getTurnosEmpleado(empleadoId: number, mes?: number, year?: number): Observable<Asignacion[]> {
    let url = `${environment.URL_SERVICIOS}/turnos/empleados/${empleadoId}/turnos`;
    if (mes && year) {
      url += `?mes=${mes}&year=${year}`;
    }
    return this.http.get<Asignacion[]>(url);
  }
}
