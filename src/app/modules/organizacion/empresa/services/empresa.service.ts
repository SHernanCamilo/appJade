import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Empresa {
  id: number;
  nombre: string;
  prefijo: string;
  rep_legal: string;
  cc_rep_legal: number;
  direccion: string;
  telefono: number;
  nit: number;
  logo?: string;
  estado: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreateEmpresaRequest {
  nombre: string;
  prefijo: string;
  rep_legal: string;
  cc_rep_legal: number;
  direccion: string;
  telefono: number;
  nit: number;
  logo?: string;
  estado?: number;
}

@Injectable({
  providedIn: 'root'
})
export class EmpresaService {

  private apiUrl = '/empresas';

  constructor(private http: HttpClient) {
    console.log('📡 EmpresaService initialized. API URL:', this.apiUrl);
  }

  getEmpresas(): Observable<Empresa[]> {
    return this.http.get<Empresa[]>(this.apiUrl);
  }

  getEmpresa(id: number): Observable<Empresa> {
    return this.http.get<Empresa>(`${this.apiUrl}/${id}`);
  }

  createEmpresa(empresa: CreateEmpresaRequest): Observable<Empresa> {
    return this.http.post<Empresa>(this.apiUrl, empresa);
  }

  updateEmpresa(id: number, empresa: Partial<CreateEmpresaRequest>): Observable<Empresa> {
    return this.http.put<Empresa>(`${this.apiUrl}/${id}`, empresa);
  }

  deleteEmpresa(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  toggleEstado(id: number): Observable<Empresa> {
    return this.http.patch<Empresa>(`${this.apiUrl}/${id}/toggle-estado`, {});
  }
}
