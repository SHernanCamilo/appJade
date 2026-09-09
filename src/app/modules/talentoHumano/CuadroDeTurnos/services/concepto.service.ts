import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, tap, shareReplay, finalize } from 'rxjs/operators';
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

  // Cache en memoria (servicio singleton). Evita re-pedir al reentrar a config.
  private cacheConceptos = new Map<string, Concepto[]>();
  private cacheVariables: string[] | null = null;

  // Peticiones en vuelo (evita duplicar llamadas simultaneas: precarga + hijo).
  private conceptosEnVuelo = new Map<string, Observable<Concepto[]>>();
  private variablesEnVuelo$: Observable<string[]> | null = null;

  constructor(private http: HttpClient) {}

  private conceptosKey(params?: { activo?: boolean; tipo_concepto?: string }): string {
    if (!params) return 'all';
    return `act:${params.activo ?? ''}|tipo:${params.tipo_concepto ?? ''}`;
  }

  /** Invalida la cache de conceptos (usar tras mutaciones). */
  private invalidarCacheConceptos(): void {
    this.cacheConceptos.clear();
  }

  /** Obtener todos los conceptos (con cache en memoria) */
  getAll(params?: { activo?: boolean; tipo_concepto?: string }, forzarRecarga = false): Observable<Concepto[]> {
    const key = this.conceptosKey(params);
    if (!forzarRecarga && this.cacheConceptos.has(key)) {
      return of(this.cacheConceptos.get(key)!);
    }
    // Reutilizar peticion en curso para la misma clave (evita duplicados)
    const enVuelo = this.conceptosEnVuelo.get(key);
    if (enVuelo) {
      return enVuelo;
    }
    const obs = this.http
      .get<{ success: boolean; data: Concepto[] }>(this.apiBase, { params: params as any })
      .pipe(
        map(r => r.data),
        tap(data => this.cacheConceptos.set(key, data)),
        finalize(() => this.conceptosEnVuelo.delete(key)),
        shareReplay(1)
      );
    this.conceptosEnVuelo.set(key, obs);
    return obs;
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
      .pipe(map(r => r.data), tap(() => this.invalidarCacheConceptos()));
  }

  /** Actualizar concepto */
  update(id: number, data: Concepto): Observable<Concepto> {
    return this.http
      .put<{ success: boolean; data: Concepto }>(`${this.apiBase}/${id}`, data)
      .pipe(map(r => r.data), tap(() => this.invalidarCacheConceptos()));
  }

  /** Eliminar concepto */
  delete(id: number): Observable<void> {
    return this.http
      .delete<{ success: boolean }>(`${this.apiBase}/${id}`)
      .pipe(map(() => undefined), tap(() => this.invalidarCacheConceptos()));
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
