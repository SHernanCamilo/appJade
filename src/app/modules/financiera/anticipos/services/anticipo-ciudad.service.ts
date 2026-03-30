import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Ciudad, ApiResponse, TipoCiudad } from '../models/anticipo.models';

@Injectable({ providedIn: 'root' })
export class AnticipoCiudadService {
  private apiUrl = '/anticipos/catalogos/ciudades';

  constructor(private http: HttpClient) {}

  getCiudades(tipo?: TipoCiudad): Observable<ApiResponse<Ciudad[]>> {
    let params = new HttpParams();
    if (tipo) params = params.set('tipo', tipo);
    return this.http.get<ApiResponse<Ciudad[]>>(this.apiUrl, { params });
  }

  getCiudadesPorTipo(tipo: TipoCiudad): Observable<ApiResponse<Ciudad[]>> {
    return this.getCiudades(tipo);
  }

  getCiudad(id: number): Observable<ApiResponse<Ciudad>> {
    return this.http.get<ApiResponse<Ciudad>>(`${this.apiUrl}/${id}`);
  }
}
