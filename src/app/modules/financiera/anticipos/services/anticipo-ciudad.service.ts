import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Ciudad, ApiResponse, TipoCiudad } from '../models/anticipo.models';

@Injectable({
  providedIn: 'root'
})
export class AnticipoC
  getCiudades: any;
  getCiudades() {
    throw new Error('Method not implemented.');
  } iudadService {
  private apiUrl = '/anticipos/ciudades';

  constructor(private http: HttpClient) {}

  /**
   * Obtener todas las ciudades activas
   */
  getCiudades(tipo?: TipoCiudad): Observable<ApiResponse<Ciudad[]>> {
    let params = new HttpParams();
    if (tipo) {
      params = params.set('tipo', tipo);
    }
    return this.http.get<ApiResponse<Ciudad[]>>(this.apiUrl, { params });
  }

  /**
   * Obtener ciudades por tipo (A, B, C)
   */
  getCiudadesPorTipo(tipo: TipoCiudad): Observable<ApiResponse<Ciudad[]>> {
    return this.getCiudades(tipo);
  }

  /**
   * Obtener una ciudad específica
   */
  getCiudad(id: number): Observable<ApiResponse<Ciudad>> {
    return this.http.get<ApiResponse<Ciudad>>(`${this.apiUrl}/${id}`);
  }
}
