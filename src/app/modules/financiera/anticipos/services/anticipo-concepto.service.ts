import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AntiTipo {
  id: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  estado: boolean;
}

export interface AntiClase {
  id: number;
  id_tipo: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  estado: boolean;
}

export interface AntiModalidad {
  id: number;
  id_clase: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  estado: boolean;
}

export interface AntiRegla {
  id?: number;
  id_concepto?: number;
  descripcion: string;
  valor_tope: number;
  estado?: boolean;
}

export interface AntiConcepto {
  id?: number;
  id_tipo: number;
  id_clase: number;
  id_modalidad: number;
  estado: boolean;
  tipo?: AntiTipo;
  clase?: AntiClase;
  modalidad?: AntiModalidad;
  reglas?: AntiRegla[];
  created_at?: string;
  updated_at?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  current_page: number;
  per_page: number;
  last_page: number;
}

@Injectable({
  providedIn: 'root'
})
export class AnticipoConceptoService {
  private apiUrl = '/anticipos';

  constructor(private http: HttpClient) {}

  /**
   * Obtener todos los tipos de anticipos
   */
  getTipos(): Observable<ApiResponse<AntiTipo[]>> {
    return this.http.get<ApiResponse<AntiTipo[]>>(`${this.apiUrl}/tipos`);
  }

  /**
   * Obtener clases por tipo
   */
  getClasesPorTipo(tipoId: number): Observable<ApiResponse<AntiClase[]>> {
    return this.http.get<ApiResponse<AntiClase[]>>(`${this.apiUrl}/tipos/${tipoId}/clases`);
  }

  /**
   * Obtener modalidades por clase
   */
  getModalidadesPorClase(claseId: number): Observable<ApiResponse<AntiModalidad[]>> {
    return this.http.get<ApiResponse<AntiModalidad[]>>(`${this.apiUrl}/clases/${claseId}/modalidades`);
  }

  /**
   * Listar conceptos con paginación y filtros
   */
  getConceptos(params?: {
    page?: number;
    per_page?: number;
    tipo_id?: number;
    clase_id?: number;
    estado?: boolean;
    search?: string;
  }): Observable<PaginatedResponse<AntiConcepto>> {
    let httpParams = new HttpParams();
    
    if (params) {
      if (params.page) httpParams = httpParams.set('page', params.page.toString());
      if (params.per_page) httpParams = httpParams.set('per_page', params.per_page.toString());
      if (params.tipo_id) httpParams = httpParams.set('tipo_id', params.tipo_id.toString());
      if (params.clase_id) httpParams = httpParams.set('clase_id', params.clase_id.toString());
      if (params.estado !== undefined) httpParams = httpParams.set('estado', params.estado ? '1' : '0');
      if (params.search) httpParams = httpParams.set('search', params.search);
    }

    return this.http.get<PaginatedResponse<AntiConcepto>>(`${this.apiUrl}/conceptos`, { params: httpParams });
  }

  /**
   * Obtener un concepto específico
   */
  getConcepto(id: number): Observable<ApiResponse<AntiConcepto>> {
    return this.http.get<ApiResponse<AntiConcepto>>(`${this.apiUrl}/conceptos/${id}`);
  }

  /**
   * Crear un nuevo concepto
   */
  createConcepto(concepto: {
    id_tipo: number;
    id_clase: number;
    id_modalidad: number;
    estado: boolean;
    reglas: AntiRegla[];
  }): Observable<ApiResponse<AntiConcepto>> {
    return this.http.post<ApiResponse<AntiConcepto>>(`${this.apiUrl}/conceptos`, concepto);
  }

  /**
   * Actualizar un concepto existente
   */
  updateConcepto(id: number, concepto: {
    id_tipo: number;
    id_clase: number;
    id_modalidad: number;
    estado: boolean;
    reglas: AntiRegla[];
  }): Observable<ApiResponse<AntiConcepto>> {
    return this.http.put<ApiResponse<AntiConcepto>>(`${this.apiUrl}/conceptos/${id}`, concepto);
  }

  /**
   * Eliminar un concepto
   */
  deleteConcepto(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/conceptos/${id}`);
  }

  /**
   * Cambiar estado de un concepto
   */
  toggleEstado(id: number): Observable<ApiResponse<AntiConcepto>> {
    return this.http.patch<ApiResponse<AntiConcepto>>(`${this.apiUrl}/conceptos/${id}/toggle-estado`, {});
  }
}
