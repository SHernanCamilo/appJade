import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

export interface Cuadro {
  id?: number;
  grupo_id?: number;
  id_grupo?: number;
  id_unidad_funcional?: number;
  mes: number;
  year?: number;
  anio?: number;
  estado: 'creado' | 'activo';
  descripcion?: string;
  observaciones?: string;
  grupo?: any;
  unidad_funcional?: any;
  created_at?: string;
  updated_at?: string;
}

export interface Grilla {
  dias: number[];
  empleados: any[];
  asignaciones: any[];
}

@Injectable({
  providedIn: 'root'
})
export class CuadroService {

  private apiUrl = `${environment.URL_SERVICIOS}/turnos/cuadros`;

  constructor(private http: HttpClient) { }

  // Obtener todos los cuadros
  getCuadros(): Observable<Cuadro[]> {
    return this.http.get<any>(this.apiUrl).pipe(
      map(response => response.success ? response.data : response)
    );
  }

  // Obtener un cuadro por ID
  getCuadro(id: number): Observable<Cuadro> {
    return this.http.get<any>(`${this.apiUrl}/${id}`).pipe(
      map(response => response.success ? response.data : response)
    );
  }

  // Crear un nuevo cuadro
  createCuadro(cuadro: Cuadro): Observable<Cuadro> {
    return this.http.post<any>(this.apiUrl, cuadro).pipe(
      map(response => response.success ? response.data : response)
    );
  }

  // Obtener la grilla de un cuadro
  getGrilla(id: number): Observable<Grilla> {
    return this.http.get<Grilla>(`${this.apiUrl}/${id}/grilla`);
  }

  // Asignar turnos masivamente
  asignarMasivo(id: number, asignaciones: any[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/asignaciones`, { asignaciones });
  }
}
