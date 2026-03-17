import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, map, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Contexto {
  id: number;
  user_id: number;
  empresa_id: number | null;
  sucursal_id: number | null;
  sede_id: number | null;
  ultima_actualizacion: string;
  empresa?: {
    id: number;
    nombre: string;
    prefijo: string;
  };
  sucursal?: {
    id: number;
    nombre: string;
  };
  sede?: {
    id: number;
    nombre: string;
  };
}

export interface Empresa {
  id: number;
  nombre: string;
  prefijo: string;
  sucursales?: Sucursal[];
}

export interface Sucursal {
  id: number;
  nombre: string;
  id_Empresa: number;
  sedes?: Sede[];
}

export interface Sede {
  id: number;
  nombre: string;
  id_sucursal: number;
}

@Injectable({
  providedIn: 'root'
})
export class ContextoService {
  private apiUrl = `${environment.URL_SERVICIOS}/contexto`;
  private contextoSubject = new BehaviorSubject<Contexto | null>(null);
  public contexto$ = this.contextoSubject.asObservable();

  constructor(private http: HttpClient) {
    this.cargarContexto();
  }

  /**
   * Cargar contexto actual del usuario
   */
  cargarContexto(): void {
    const token = localStorage.getItem('token');
    if (!token) {
      return;
    }

    this.http.get<any>(this.apiUrl).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.contextoSubject.next(response.data);
          console.log('Contexto cargado:', response.data);
        }
      },
      error: (error) => {
        console.error('Error cargando contexto:', error);
      }
    });
  }

  /**
   * Cambiar contexto del usuario
   */
  cambiarContexto(empresaId: number, sucursalId?: number, sedeId?: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/cambiar`, {
      empresa_id: empresaId,
      sucursal_id: sucursalId,
      sede_id: sedeId
    }).pipe(
      tap((response) => {
        if (response.success && response.data) {
          this.contextoSubject.next(response.data);
          console.log('Contexto actualizado:', response.data);
        }
      })
    );
  }

  /**
   * Obtener empresas disponibles para el usuario
   */
  obtenerEmpresasDisponibles(): Observable<Empresa[]> {
    return this.http.get<any>(`${this.apiUrl}/empresas-disponibles`).pipe(
      map((response) => response.success ? response.data : [])
    );
  }

  /**
   * Limpiar contexto
   */
  limpiarContexto(): Observable<any> {
    return this.http.delete<any>(this.apiUrl).pipe(
      tap((response) => {
        if (response.success) {
          this.contextoSubject.next(null);
        }
      })
    );
  }

  /**
   * Obtener contexto actual
   */
  getContextoActual(): Contexto | null {
    return this.contextoSubject.value;
  }

  /**
   * Obtener empresa actual
   */
  getEmpresaActual(): any {
    const contexto = this.contextoSubject.value;
    return contexto?.empresa || null;
  }

  /**
   * Obtener sucursal actual
   */
  getSucursalActual(): any {
    const contexto = this.contextoSubject.value;
    return contexto?.sucursal || null;
  }

  /**
   * Obtener sede actual
   */
  getSedeActual(): any {
    const contexto = this.contextoSubject.value;
    return contexto?.sede || null;
  }
}
