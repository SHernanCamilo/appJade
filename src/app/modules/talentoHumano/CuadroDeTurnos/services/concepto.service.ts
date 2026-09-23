import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, tap, shareReplay, finalize } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

export interface Concepto {
  id?: number;
  id_empresa?: number | null;
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

  // Variables disponibles (globales): estas si se cachean.
  private cacheVariables: string[] | null = null;
  private variablesEnVuelo$: Observable<string[]> | null = null;

  constructor(private http: HttpClient) {}

  /** Obtener conceptos POR EMPRESA (opcionalmente filtrando por activo/tipo). */
  getAll(params?: { id_empresa?: number | null; activo?: boolean; tipo_concepto?: string }): Observable<Concepto[]> {
    const query: any = {};
    if (params?.id_empresa != null) query.id_empresa = params.id_empresa;
    if (params?.activo != null) query.activo = params.activo;
    if (params?.tipo_concepto) query.tipo_concepto = params.tipo_concepto;
    return this.http
      .get<{ success: boolean; data: Concepto[] }>(this.apiBase, { params: query })
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

  /** Obtener lista de variables disponibles para fórmulas (con cache) */
  getVariables(forzarRecarga = false): Observable<string[]> {
    if (!forzarRecarga && this.cacheVariables) {
      return of(this.cacheVariables);
    }
    if (this.variablesEnVuelo$) {
      return this.variablesEnVuelo$;
    }
    this.variablesEnVuelo$ = this.http
      .get<{ success: boolean; data: string[] }>(`${this.apiBase}/variables`)
      .pipe(
        map(r => r.data),
        tap(data => this.cacheVariables = data),
        finalize(() => this.variablesEnVuelo$ = null),
        shareReplay(1)
      );
    return this.variablesEnVuelo$;
  }
}
