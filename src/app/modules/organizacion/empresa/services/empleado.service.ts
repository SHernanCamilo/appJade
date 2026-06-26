import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Empleado {
  id: number;
  nombre: string;
  email?: string | null;
  numero_identificacion?: string;
  estado?: boolean | number;
}

@Injectable({
  providedIn: 'root'
})
export class EmpleadoService {
  private apiUrl = '/empleados';

  constructor(private http: HttpClient) {}

  /**
   * Busca personas de una empresa con paginación.
   * Sin término: devuelve la primera página ordenada por nombre.
   * Con término (≥2 chars): filtra por nombre o número de identificación.
   */
  buscarPersonas(
    empresaId: number,
    search: string,
    page: number = 1,
    limit: number = 100
  ): Observable<Empleado[]> {
    let params = new HttpParams()
      .set('empresa_id', empresaId.toString())
      .set('activos', '1')
      .set('page', page.toString())
      .set('limit', limit.toString());

    if (search && search.trim().length >= 2) {
      params = params.set('search', search.trim());
    }

    return this.http.get<{ success: boolean; data: Empleado[] }>(
      `${this.apiUrl}/opciones`,
      { params }
    ).pipe(
      map(response => response.data ?? [])
    );
  }
}
