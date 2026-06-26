import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface UsuarioAutorizado {
  id?: number;
  id_user: number;
  codigo?: string;
  nombre: string;
}

export interface JefeEncargado {
  id?: number;
  id_user: number;
  codigo?: string;
  nombre: string;
}

export interface UnidadFuncional {
  id: number;
  codigo: string;
  nombre: string;
  id_empresa: number;
  id_sucursal: number;
  id_sede?: number | null;
  estado?: number;
  empresa?: { id: number; nombre: string; prefijo?: string };
  sucursal?: { id: number; nombre: string };
  sede?: { id: number; nombre: string } | null;
  usuarios_autorizados?: UsuarioAutorizado[];
  jefes_encargados?: JefeEncargado[];
  created_at?: string;
  updated_at?: string;
}

export interface CreateUnidadFuncionalRequest {
  codigo: string;
  nombre: string;
  id_empresa: number;
  id_sucursal: number;
  id_sede?: number | null;
  estado?: number;
  usuarios_autorizados?: number[];
  jefes_encargados?: number[];
}

@Injectable({
  providedIn: 'root'
})
export class UnidadFuncionalService {
  private apiUrl = '/unidades-funcionales';
  private turnosApiUrl = '/turnos/unidades-funcionales';

  constructor(private http: HttpClient) {}

  getUnidadesFuncionales(empresaId?: number): Observable<UnidadFuncional[]> {
    let params = new HttpParams();
    if (empresaId) {
      params = params.set('empresa_id', empresaId.toString());
    }

    return this.http.get<{ success?: boolean; data: UnidadFuncional[] } | UnidadFuncional[]>(
      this.apiUrl,
      { params }
    ).pipe(
      map(response => Array.isArray(response) ? response : (response.data ?? []))
    );
  }

  /**
   * Obtiene las unidades funcionales del usuario autenticado
   * Filtra por las empresas asignadas al usuario
   */
  getUnidadesFuncionalesDelUsuario(): Observable<UnidadFuncional[]> {
    return this.http.get<{ success?: boolean; data: UnidadFuncional[] }>(
      `${this.turnosApiUrl}/del-usuario`
    ).pipe(
      map(response => response.data ?? [])
    );
  }

  /**
   * Obtiene las unidades funcionales de una empresa específica
   */
  getUnidadesFuncionalesPorEmpresa(empresaId: number): Observable<UnidadFuncional[]> {
    return this.getUnidadesFuncionales(empresaId).pipe(
      map(unidades => unidades.map(u => ({
        ...u,
        nombre_con_prefijo: u.empresa?.prefijo ? `${u.empresa.prefijo}-${u.nombre}` : u.nombre,
        prefijo: u.empresa?.prefijo || 'N/A',
        sede_nombre: u.sede?.nombre || 'No especificada'
      })))
    );
  }

  /**
   * Obtiene los empleados de una unidad funcional
   */
  getEmpleadosUnidad(idUnidad: number, search?: string): Observable<any[]> {
    let params = new HttpParams();
    if (search) {
      params = params.set('search', search);
    }

    return this.http.get<{ success?: boolean; data: any[] }>(
      `${this.turnosApiUrl}/${idUnidad}/empleados`,
      { params }
    ).pipe(
      map(response => response.data ?? [])
    );
  }

  getUnidadFuncional(id: number): Observable<UnidadFuncional> {
    return this.http.get<{ success?: boolean; data: UnidadFuncional } | UnidadFuncional>(
      `${this.apiUrl}/${id}`
    ).pipe(
      map(response => ('data' in response && response.data) ? response.data : response as UnidadFuncional)
    );
  }

  buscarPorCodigo(codigo: string, empresaId?: number): Observable<UnidadFuncional | null> {
    let params = new HttpParams().set('codigo', codigo);
    if (empresaId) {
      params = params.set('empresa_id', empresaId.toString());
    }

    return this.http.get<{ success?: boolean; data: UnidadFuncional | null }>(
      `${this.apiUrl}/buscar`,
      { params }
    ).pipe(
      map(response => response.data ?? null)
    );
  }

  createUnidadFuncional(data: CreateUnidadFuncionalRequest): Observable<UnidadFuncional> {
    return this.http.post<{ success?: boolean; data: UnidadFuncional } | UnidadFuncional>(
      this.apiUrl,
      data
    ).pipe(
      map(response => ('data' in response && response.data) ? response.data : response as UnidadFuncional)
    );
  }

  updateUnidadFuncional(id: number, data: Partial<CreateUnidadFuncionalRequest>): Observable<UnidadFuncional> {
    return this.http.put<{ success?: boolean; data: UnidadFuncional } | UnidadFuncional>(
      `${this.apiUrl}/${id}`,
      data
    ).pipe(
      map(response => ('data' in response && response.data) ? response.data : response as UnidadFuncional)
    );
  }

  deleteUnidadFuncional(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
