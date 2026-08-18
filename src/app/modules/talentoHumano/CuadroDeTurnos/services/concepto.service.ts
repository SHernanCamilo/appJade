import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

export interface Concepto {
  id?: number;
  codigo: string;
  nombre: string;
  tipo_concepto: 'devengado' | 'deducido';
  formula: string;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ProbarFormulaRequest {
  formula: string;
  variables: { [key: string]: number };
}

export interface ProbarFormulaResponse {
  success: boolean;
  resultado: number;
  formula_resuelta: string;
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class ConceptoService {

  private apiBase = `${environment.URL_SERVICIOS}/turnos/conceptos`;

  constructor(private http: HttpClient) {}

  /** Obtener todos los conceptos */
  getAll(params?: { activo?: boolean; tipo_concepto?: string }): Observable<Concepto[]> {
    return this.http
      .get<{ success: boolean; data: Concepto[] }>(this.apiBase, { params: params as any })
      .pipe(map(r => r.data));
  }

  /** Obtener concepto por ID */
  getById(id: number): Observable<Concepto> {
    return this.http
      .get<{ success: boolean; data: Concepto }>(`${this.apiBase}/${id}`)
      .pipe(map(r => r.data));
  }

  /** Crear concepto */
  create(data: Concepto): Observable<Concepto> {
    return this.http
      .post<{ success: boolean; data: Concepto }>(this.apiBase, data)
      .pipe(map(r => r.data));
  }

  /** Actualizar concepto */
  update(id: number, data: Concepto): Observable<Concepto> {
    return this.http
      .put<{ success: boolean; data: Concepto }>(`${this.apiBase}/${id}`, data)
      .pipe(map(r => r.data));
  }

  /** Eliminar concepto */
  delete(id: number): Observable<void> {
    return this.http
      .delete<{ success: boolean }>(`${this.apiBase}/${id}`)
      .pipe(map(() => undefined));
  }

  /** Probar fórmula con valores de prueba */
  probarFormula(data: ProbarFormulaRequest): Observable<ProbarFormulaResponse> {
    return this.http.post<ProbarFormulaResponse>(`${this.apiBase}/probar-formula`, data);
  }

  /** Obtener lista de variables disponibles para fórmulas */
  getVariables(): Observable<string[]> {
    return this.http
      .get<{ success: boolean; data: string[] }>(`${this.apiBase}/variables`)
      .pipe(map(r => r.data));
  }
}
