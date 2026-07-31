import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Sucursal {
  id: number;
  nombre: string;
  prefijo?: string | null;
  id_Empresa: number;
  empresa?: {
    id: number;
    nombre: string;
    prefijo: string;
  };
  created_at?: string;
  updated_at?: string;
}

export interface CreateSucursalRequest {
  nombre: string;
  prefijo?: string | null;
  id_Empresa: number;
}

@Injectable({
  providedIn: 'root'
})
export class SucursalService {
  private apiUrl = '/sucursales';

  constructor(private http: HttpClient) {
    // console.log('📡 SucursalService initialized. API URL:', this.apiUrl);
  }

  getSucursales(): Observable<Sucursal[]> {
    return this.http.get<Sucursal[]>(this.apiUrl);
  }

  getSucursal(id: number): Observable<Sucursal> {
    return this.http.get<Sucursal>(`${this.apiUrl}/${id}`);
  }

  getSucursalesPorEmpresa(empresaId: number): Observable<Sucursal[]> {
    return this.http.get<Sucursal[]>(`/sucursales-por-empresa/${empresaId}`);
  }

  createSucursal(sucursal: CreateSucursalRequest): Observable<Sucursal> {
    return this.http.post<Sucursal>(this.apiUrl, sucursal);
  }

  updateSucursal(id: number, sucursal: Partial<CreateSucursalRequest>): Observable<Sucursal> {
    return this.http.put<Sucursal>(`${this.apiUrl}/${id}`, sucursal);
  }

  deleteSucursal(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
