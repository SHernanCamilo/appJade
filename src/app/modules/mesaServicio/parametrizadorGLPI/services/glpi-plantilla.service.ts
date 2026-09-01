import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  GlpiPlantilla,
  GlpiPlantillaPayload
} from '../interfaces/glpi-plantilla.interface';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class GlpiPlantillaService {
  private readonly apiUrl = '/mesa-servicio/glpi/plantillas';

  constructor(private http: HttpClient) {}

  listar(params?: { id_empresa?: number; estado?: boolean; search?: string }): Observable<GlpiPlantilla[]> {
    let httpParams = new HttpParams();
    if (params?.id_empresa != null) {
      httpParams = httpParams.set('id_empresa', String(params.id_empresa));
    }
    if (params?.estado !== undefined) {
      httpParams = httpParams.set('estado', String(params.estado));
    }
    if (params?.search) {
      httpParams = httpParams.set('search', params.search);
    }

    return this.http.get<ApiResponse<GlpiPlantilla[]>>(this.apiUrl, { params: httpParams }).pipe(
      map((response) => (response.success && Array.isArray(response.data) ? response.data : []))
    );
  }

  obtener(id: number): Observable<GlpiPlantilla> {
    return this.http.get<ApiResponse<GlpiPlantilla>>(`${this.apiUrl}/${id}`).pipe(
      map((response) => response.data)
    );
  }

  crear(payload: GlpiPlantillaPayload): Observable<GlpiPlantilla> {
    return this.http.post<ApiResponse<GlpiPlantilla>>(this.apiUrl, payload).pipe(
      map((response) => response.data)
    );
  }

  actualizar(id: number, payload: GlpiPlantillaPayload): Observable<GlpiPlantilla> {
    return this.http.put<ApiResponse<GlpiPlantilla>>(`${this.apiUrl}/${id}`, payload).pipe(
      map((response) => response.data)
    );
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<ApiResponse<null>>(`${this.apiUrl}/${id}`).pipe(map(() => undefined));
  }

  duplicar(id: number): Observable<GlpiPlantilla> {
    return this.http
      .post<ApiResponse<GlpiPlantilla>>(`${this.apiUrl}/${id}/duplicar`, {})
      .pipe(map((response) => response.data));
  }

  toggleEstado(id: number): Observable<GlpiPlantilla> {
    return this.http
      .patch<ApiResponse<GlpiPlantilla>>(`${this.apiUrl}/${id}/toggle-estado`, {})
      .pipe(map((response) => response.data));
  }
}
