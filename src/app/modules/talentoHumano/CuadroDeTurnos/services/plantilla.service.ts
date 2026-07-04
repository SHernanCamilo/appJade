import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

export interface Plantilla {
  id?: number;
  codigo?: string;
  nombre: string;
  descripcion?: string;
  // Rango 1 (obligatorio - turno principal o corrido)
  hora_inicio: string;
  hora_fin: string;
  // Rango 2 (opcional - jornada partida)
  hora_inicio_2?: string | null;
  hora_fin_2?: string | null;
  duracion_horas?: number;
  es_nocturno?: boolean;
  color_hex?: string;
  id_empresa?: number;
  activo?: boolean;
  estado?: boolean;
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PlantillaService {

  private apiUrl = `${environment.URL_SERVICIOS}/turnos/plantillas`;

  constructor(private http: HttpClient) { }

  // Obtener todas las plantillas
  getPlantillas(params?: { id_empresa?: number; estado?: boolean }): Observable<Plantilla[]> {
    return this.http.get<{ success: boolean; data: Plantilla[]; message?: string }>(this.apiUrl, { params: params as Record<string, string | number | boolean> }).pipe(
      map(response => (response.success && Array.isArray(response.data)) ? response.data : [])
    );
  }

  // Obtener una plantilla por ID
  getPlantilla(id: number): Observable<Plantilla> {
    return this.http.get<any>(`${this.apiUrl}/${id}`).pipe(
      map(response => response.success ? response.data : null)
    );
  }

  // Crear una nueva plantilla
  createPlantilla(plantilla: Partial<Plantilla>): Observable<Plantilla> {
    return this.http.post<any>(this.apiUrl, plantilla).pipe(
      map(response => response.success ? response.data : null)
    );
  }

  // Actualizar una plantilla
  updatePlantilla(id: number, plantilla: Partial<Plantilla>): Observable<Plantilla> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, plantilla).pipe(
      map(response => response.success ? response.data : null)
    );
  }

  // Eliminar una plantilla
  deletePlantilla(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
