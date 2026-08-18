import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  GlpiComparacionRegla,
  GlpiComparacionResultado,
  GlpiEntidadNodo
} from '../interfaces/glpi-validador.interface';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class GlpiValidadorService {
  private readonly apiUrl = '/mesa-servicio/glpi/validador';

  constructor(private http: HttpClient) {}

  entidades(): Observable<GlpiEntidadNodo[]> {
    return this.http.get<ApiResponse<GlpiEntidadNodo[]>>(`${this.apiUrl}/entidades`).pipe(
      map((response) => (response.success && Array.isArray(response.data) ? response.data : []))
    );
  }

  comparar(plantillaId: number, entidadId: number): Observable<GlpiComparacionResultado> {
    return this.http
      .post<ApiResponse<GlpiComparacionResultado>>(`${this.apiUrl}/comparar`, {
        plantilla_id: plantillaId,
        entidad_id: entidadId
      })
      .pipe(map((response) => response.data));
  }

  compararRegla(
    plantillaId: number,
    entidadId: number,
    reglaGlpiId: number,
    ansKey: string | null
  ): Observable<GlpiComparacionRegla> {
    return this.http
      .post<ApiResponse<GlpiComparacionRegla>>(`${this.apiUrl}/comparar-regla`, {
        plantilla_id: plantillaId,
        entidad_id: entidadId,
        regla_glpi_id: reglaGlpiId,
        ans_key: ansKey
      })
      .pipe(map((response) => response.data));
  }
}
