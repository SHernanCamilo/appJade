import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface Cuadro {
  id?: number;
  grupo_id: number;
  mes: number;
  year: number;
  estado: 'borrador' | 'publicado' | 'cerrado';
  descripcion?: string;
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
    return this.http.get<Cuadro[]>(this.apiUrl);
  }

  // Obtener un cuadro por ID
  getCuadro(id: number): Observable<Cuadro> {
    return this.http.get<Cuadro>(`${this.apiUrl}/${id}`);
  }

  // Crear un nuevo cuadro
  createCuadro(cuadro: Cuadro): Observable<Cuadro> {
    return this.http.post<Cuadro>(this.apiUrl, cuadro);
  }

  // Obtener la grilla de un cuadro
  getGrilla(id: number): Observable<Grilla> {
    return this.http.get<Grilla>(`${this.apiUrl}/${id}/grilla`);
  }

  // Asignar turnos masivamente
  asignarMasivo(id: number, asignaciones: any[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/asignaciones`, { asignaciones });
  }

  // Publicar un cuadro
  publicar(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/publicar`, {});
  }

  // Cerrar un cuadro
  cerrar(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/cerrar`, {});
  }
}
