import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Sede {
  id: number;
  nombre: string;
  id_Sucursal: number;
  sucursal?: {
    id: number;
    nombre: string;
    id_Empresa: number;
    empresa?: {
      id: number;
      nombre: string;
      prefijo: string;
    };
  };
  created_at?: string;
  updated_at?: string;
}

export interface CreateSedeRequest {
  nombre: string;
  id_Sucursal: number;
}

@Injectable({
  providedIn: 'root'
})
export class SedeService {
  private apiUrl = '/sedes';

  constructor(private http: HttpClient) {
    // console.log('📡 SedeService initialized. API URL:', this.apiUrl);
  }

  getSedes(): Observable<Sede[]> {
    return this.http.get<Sede[]>(this.apiUrl);
  }

  getSede(id: number): Observable<Sede> {
    return this.http.get<Sede>(`${this.apiUrl}/${id}`);
  }

  getSedesPorSucursal(sucursalId: number): Observable<Sede[]> {
    return this.http.get<Sede[]>(`/sedes-por-sucursal/${sucursalId}`);
  }

  getSedesPorEmpresa(empresaId: number): Observable<Sede[]> {
    return this.http.get<Sede[]>(`/sedes-por-empresa/${empresaId}`);
  }

  createSede(sede: CreateSedeRequest): Observable<Sede> {
    return this.http.post<Sede>(this.apiUrl, sede);
  }

  updateSede(id: number, sede: Partial<CreateSedeRequest>): Observable<Sede> {
    return this.http.put<Sede>(`${this.apiUrl}/${id}`, sede);
  }

  deleteSede(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
