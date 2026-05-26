import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { Plantilla } from '../models/plantilla.model';

interface ApiResponse<T> { success: boolean; data: T; message?: string; }

@Injectable({ providedIn: 'root' })
export class PlantillaService {
  private api = `${environment.URL_SERVICIOS}/turnos/plantillas`;

  constructor(private http: HttpClient) {}

  getAll(params?: { id_empresa?: number; estado?: boolean }): Observable<Plantilla[]> {
    let p = new HttpParams();
    if (params?.id_empresa) p = p.set('id_empresa', params.id_empresa);
    if (params?.estado !== undefined) p = p.set('estado', params.estado ? '1' : '0');
    return this.http.get<ApiResponse<Plantilla[]>>(this.api, { params: p })
      .pipe(map(r => r.data ?? r as any));
  }

  getById(id: number): Observable<Plantilla> {
    return this.http.get<ApiResponse<Plantilla>>(`${this.api}/${id}`)
      .pipe(map(r => r.data ?? r as any));
  }

  create(data: Partial<Plantilla>): Observable<Plantilla> {
    return this.http.post<ApiResponse<Plantilla>>(this.api, data)
      .pipe(map(r => r.data ?? r as any));
  }

  update(id: number, data: Partial<Plantilla>): Observable<Plantilla> {
    return this.http.put<ApiResponse<Plantilla>>(`${this.api}/${id}`, data)
      .pipe(map(r => r.data ?? r as any));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }
}
