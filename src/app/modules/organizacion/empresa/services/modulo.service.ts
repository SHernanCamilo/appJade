import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface Modulo {
  id: number;
  id_modulo_padre: number | null;
  nombre: string;
  codigo: string;
  descripcion: string | null;
  icono: string | null;
  ruta: string | null;
  orden: number;
  nivel: number;
  estado: boolean;
  created_at?: string;
  updated_at?: string;
  hijos?: Modulo[];
  padre?: Modulo;
  empresas?: any[];
}

export interface ModuloEmpresa {
  id: number;
  id_modulo: number;
  id_empresa: number;
  activo: boolean;
  hereda_hijos: boolean;
  created_at?: string;
  updated_at?: string;
  modulo?: Modulo;
}

export interface MatrizPermisos {
  id: number;
  nombre: string;
  modulos: {
    id_modulo: number;
    codigo: string;
    nombre: string;
    tiene_acceso: boolean;
    activo: boolean;
    hereda_hijos: boolean;
    hijos: {
      id: number;
      codigo: string;
      nombre: string;
      tiene_acceso: boolean;
    }[];
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class ModuloService {
  private apiUrl = `${environment.URL_SERVICIOS}/modulos`;
  private apiUrlEmpresa = `${environment.URL_SERVICIOS}`;

  constructor(private http: HttpClient) {}

  // Módulos
  getModulos(soloRaiz: boolean = false, conHijos: boolean = true): Observable<any> {
    return this.http.get(`${this.apiUrl}?solo_raiz=${soloRaiz}&con_hijos=${conHijos}`);
  }

  getModulosTree(): Observable<any> {
    return this.http.get(`${this.apiUrl}-tree`);
  }

  getModulo(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/${id}`);
  }

  createModulo(modulo: Partial<Modulo>): Observable<any> {
    return this.http.post(this.apiUrl, modulo);
  }

  updateModulo(id: number, modulo: Partial<Modulo>): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, modulo);
  }

  deleteModulo(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  // Módulos por Empresa
  getModulosByEmpresa(idEmpresa: number): Observable<any> {
    return this.http.get(`${this.apiUrlEmpresa}/modulos-empresa/${idEmpresa}`);
  }

  getEmpresasByModulo(idModulo: number): Observable<any> {
    return this.http.get(`${this.apiUrlEmpresa}/empresas-modulo/${idModulo}`);
  }

  getMatrizPermisos(): Observable<any> {
    return this.http.get(`${this.apiUrlEmpresa}/matriz-permisos`);
  }

  asignarModulo(data: { id_modulo: number; id_empresa: number; hereda_hijos?: boolean; activo?: boolean }): Observable<any> {
    return this.http.post(`${this.apiUrlEmpresa}/asignar-modulo`, data);
  }

  removerModulo(data: { id_modulo: number; id_empresa: number }): Observable<any> {
    return this.http.post(`${this.apiUrlEmpresa}/remover-modulo`, data);
  }

  actualizarConfiguracion(data: { id_modulo: number; id_empresa: number; hereda_hijos?: boolean; activo?: boolean }): Observable<any> {
    return this.http.post(`${this.apiUrlEmpresa}/actualizar-configuracion-modulo`, data);
  }

  // Empresas
  getEmpresasActivas(): Observable<any> {
    return this.http.get(`${this.apiUrlEmpresa}/empresas-activas`);
  }
}
