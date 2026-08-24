import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

export interface WorkbookState {
  sheets: Array<{ id: string; label: string; schema: string; viewName: string; active: boolean; kind?: string }>;
  activeSheetId: string;
  hiddenColumns: string[];
  filters: any[];
  pivotConfig: any;
  zoom: number;
  /** Formulas escritas por el usuario en hojas de calculo (por hoja, Map<celda, formula>) */
  formulas?: Record<string, Record<string, string>>;
}

// ─── Workbook (Mis Excels) ──────────────────────────────────────────────────

export interface SavedWorkbookView {
  schema: string;
  viewName: string;
  label: string;
}

export interface SavedWorkbook {
  id: number;
  name: string;
  description: string | null;
  views: SavedWorkbookView[];
  viewCount: number;
  viewNames: string[];
  is_favorite: boolean;
  last_opened_at: string | null;
  updated_at: string;
  created_at: string;
  /** Solo viene en show(), no en index() */
  state?: WorkbookState | null;
}

/**
 * Servicio para persistir y restaurar el estado del workbook en el backend.
 * 
 * Endpoints:
 *   GET  /api/fabric/viewer/workbook/{schema}/{view} -> Cargar estado
 *   POST /api/fabric/viewer/workbook/save            -> Guardar estado
 *   GET  /api/fabric/viewer/workbooks                -> Listar workbooks del usuario
 */
@Injectable({ providedIn: 'root' })
export class WorkbookStateService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.URL_SERVICIOS}/fabric/viewer`;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Guarda el estado del workbook (debounced 3 segundos).
   */
  save(schema: string, viewName: string, state: WorkbookState): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.http.post(`${this.baseUrl}/workbook/save`, {
        schema_name: schema,
        view_name: viewName,
        name: 'default',
        state
      }).subscribe({
        next: () => console.log('[WorkbookState] Guardado'),
        error: (err) => console.warn('[WorkbookState] Error al guardar:', err.message),
      });
    }, 3000);
  }

  /**
   * Carga el estado guardado del workbook.
   * Retorna null si no existe.
   */
  load(schema: string, viewName: string): Promise<WorkbookState | null> {
    return new Promise((resolve) => {
      this.http.get<any>(`${this.baseUrl}/workbook/${schema}/${viewName}`).subscribe({
        next: (res) => resolve(res?.data?.state ?? null),
        error: () => resolve(null),
      });
    });
  }

  /**
   * Lista todos los workbooks del usuario.
   */
  list(): Promise<Array<{ id: number; schema_name: string; view_name: string; name: string; updated_at: string }>> {
    return new Promise((resolve) => {
      this.http.get<any>(`${this.baseUrl}/workbooks`).subscribe({
        next: (res) => resolve(res?.data ?? []),
        error: () => resolve([]),
      });
    });
  }

  /**
   * Elimina un workbook guardado.
   */
  delete(id: number): Promise<boolean> {
    return new Promise((resolve) => {
      this.http.delete<any>(`${this.baseUrl}/workbook/${id}`).subscribe({
        next: (res) => resolve(res?.success ?? false),
        error: () => resolve(false),
      });
    });
  }

  /** Cancela cualquier guardado pendiente */
  cancelPending(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Workbook Manager (Mis Excels)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Lista los workbooks guardados del usuario (tarjetas de "Mis Excels").
   * No trae el campo `state` (puede pesar MBs).
   */
  listWorkbooks(): Promise<SavedWorkbook[]> {
    return new Promise((resolve) => {
      this.http.get<{ success: boolean; data: SavedWorkbook[] }>(
        `${this.baseUrl}/my-workbooks`
      ).subscribe({
        next: (res) => resolve(res?.data ?? []),
        error: () => resolve([]),
      });
    });
  }

  /**
   * Carga un workbook completo (con su estado) para restaurarlo en el visor.
   */
  loadWorkbook(id: number): Promise<SavedWorkbook | null> {
    return new Promise((resolve) => {
      this.http.get<{ success: boolean; data: SavedWorkbook }>(
        `${this.baseUrl}/my-workbook/${id}`
      ).subscribe({
        next: (res) => resolve(res?.data ?? null),
        error: () => resolve(null),
      });
    });
  }

  /**
   * Crea un nuevo workbook.
   */
  createWorkbook(data: {
    name: string;
    description?: string;
    views: SavedWorkbookView[];
    state?: WorkbookState;
  }): Promise<SavedWorkbook | null> {
    return new Promise((resolve) => {
      this.http.post<{ success: boolean; data: SavedWorkbook }>(
        `${this.baseUrl}/my-workbook`, data
      ).subscribe({
        next: (res) => resolve(res?.data ?? null),
        error: () => resolve(null),
      });
    });
  }

  /**
   * Actualiza nombre, descripcion o favorito de un workbook.
   */
  updateWorkbook(id: number, data: Partial<{
    name: string;
    description: string;
    views: SavedWorkbookView[];
    is_favorite: boolean;
  }>): Promise<boolean> {
    return new Promise((resolve) => {
      this.http.put<{ success: boolean }>(
        `${this.baseUrl}/my-workbook/${id}`, data
      ).subscribe({
        next: (res) => resolve(res?.success ?? false),
        error: () => resolve(false),
      });
    });
  }

  /**
   * Auto-save del estado UI de un workbook (debounced internamente).
   * Es el endpoint liviano que se llama cada 3s mientras trabaja.
   */
  private wbSaveTimer: ReturnType<typeof setTimeout> | null = null;

  saveWorkbookState(id: number, state: WorkbookState): void {
    if (this.wbSaveTimer) clearTimeout(this.wbSaveTimer);
    this.wbSaveTimer = setTimeout(() => {
      this.http.put(`${this.baseUrl}/my-workbook/${id}/state`, { state }).subscribe({
        next: () => console.log('[WorkbookState] Auto-save workbook', id),
        error: (err) => console.warn('[WorkbookState] Error auto-save workbook:', err.message),
      });
    }, 3000);
  }

  /**
   * Elimina un workbook guardado.
   */
  deleteWorkbook(id: number): Promise<boolean> {
    return new Promise((resolve) => {
      this.http.delete<{ success: boolean }>(
        `${this.baseUrl}/my-workbook/${id}`
      ).subscribe({
        next: (res) => resolve(res?.success ?? false),
        error: () => resolve(false),
      });
    });
  }
}
