import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AllowedDomain {
  id: number;
  domain: string;
  tenant_id: string;
  tenant_name: string;
  id_empresa: number | null;
  descripcion: string | null;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
  empresa?: {
    id: number;
    nombre: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AllowedDomainService {
  private apiUrl = '/allowed-domains';

  constructor(private http: HttpClient) {}

  getAll(): Observable<any> {
    return this.http.get(this.apiUrl);
  }

  getById(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/${id}`);
  }

  create(domain: Partial<AllowedDomain>): Observable<any> {
    return this.http.post(this.apiUrl, domain);
  }

  update(id: number, domain: Partial<AllowedDomain>): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, domain);
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  checkEmail(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/check-email`, { email });
  }

  toggleStatus(id: number): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${id}/toggle-status`, {});
  }
}
