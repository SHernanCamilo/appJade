import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { TableroDevice, CreateTableroPayload, CreateTableroResponse } from '../models/tablero-device.model';

@Injectable({ providedIn: 'root' })
export class TableroAdminService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.URL_SERVICIOS}/tableros/tokens`;

  list(): Observable<{ success: boolean; data: TableroDevice[] }> {
    return this.http.get<{ success: boolean; data: TableroDevice[] }>(this.baseUrl);
  }

  create(payload: CreateTableroPayload): Observable<CreateTableroResponse> {
    return this.http.post<CreateTableroResponse>(this.baseUrl, payload);
  }

  regenerateCode(id: number): Observable<{ success: boolean; data: { pairing_code: string; expires_in: string } }> {
    return this.http.post<{ success: boolean; data: { pairing_code: string; expires_in: string } }>(
      `${this.baseUrl}/${id}/regenerate-code`, {}
    );
  }

  revoke(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.patch<{ success: boolean; message: string }>(`${this.baseUrl}/${id}/revoke`, {});
  }

  activate(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.patch<{ success: boolean; message: string }>(`${this.baseUrl}/${id}/activate`, {});
  }

  delete(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.baseUrl}/${id}`);
  }
}
