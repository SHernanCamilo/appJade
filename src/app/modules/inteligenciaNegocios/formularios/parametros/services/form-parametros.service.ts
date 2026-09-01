import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { CampoParametro, FormParametrosGuardados } from '../models/form-parametros.model';

interface ApiItemResponse {
  success: boolean;
  data?: FormParametrosGuardados | null;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class FormParametrosService {
  private readonly apiUrl = '/fabric/form-parametros';

  constructor(private readonly http: HttpClient) {}

  obtener(formulario: string): Observable<CampoParametro[]> {
    return this.http.get<ApiItemResponse>(`${this.apiUrl}/${encodeURIComponent(formulario)}`).pipe(
      map(r => r.data?.campos ?? []),
      catchError(() => of([] as CampoParametro[]))
    );
  }

  guardar(formulario: string, campos: CampoParametro[]): Observable<FormParametrosGuardados> {
    return this.http.put<ApiItemResponse>(`${this.apiUrl}/${encodeURIComponent(formulario)}`, { campos }).pipe(
      map(r => r.data ?? { formulario, campos })
    );
  }
}
