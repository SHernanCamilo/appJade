import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ColDef } from 'ag-grid-community';
import { environment } from '../../../environments/environment';

export interface EsquemaCatalogo {
  schema: string;
  codigo: string;
  nombre: string;
  es_delegado?: boolean;
  empresa_id?: number;
  empresa_nombre?: string;
}

export interface FabricViewerContext {
  success: boolean;
  user: string;
  grupos: string[];
  esquemas: string[];
  esquemas_catalogo?: EsquemaCatalogo[];
  departamento: string | null;
  catalogo?: Array<{ codigo: string; tipo: number; descripcion: string }>;
  /** true si el usuario tiene al menos un esquema solo por delegación */
  tiene_vistas_delegadas?: boolean;
}

export interface FabricView {
  schema: string;
  schemaDisplay: string;
  view_name: string;
  qualified_name: string;
  column_count: number;
  visible_for_site: boolean;
}

export type BiEstado = 'activo' | 'mantenimiento' | 'inactivo';

export interface VistaBi {
  schema: string;
  schemaDisplay: string;
  view_name: string;
  nombre: string;
  codigo: string;
  descripcion?: string;
  fuente?: string;
  /** visible_for_site de Fabric */
  estado: boolean;
  /** Estado administrativo en bi_vistas */
  bi_estado?: BiEstado;
  column_count: number;
}

export interface FabricColumn {
  name: string;
  type: string;
  nullable: boolean;
}

export interface FabricDataMeta {
  total: number;
  limit: number;
  offset: number;
  has_next: boolean;
  sort_col?: string;
  sort_dir?: string;
  elapsed_ms?: number;
  /** true cuando la vista supera el umbral de filas pesadas */
  heavy_view?: boolean;
}

export interface FabricDataQueryOptions {
  columns?: string[];
  filters?: Record<string, string>;
  limit?: number;
  offset?: number;
  sort_col?: string;
  sort_dir?: 'asc' | 'desc';
  /** Evita COUNT(*) en vistas grandes (ahorra hasta ~150s) */
  skip_count?: boolean;
}

export interface FabricDataResponse {
  success: boolean;
  data: Record<string, unknown>[];
  meta: FabricDataMeta;
  message?: string;
}

export interface VistaDatosResponse {
  success: boolean;
  columnDefs: ColDef[];
  rowData: Record<string, unknown>[];
  meta: FabricDataMeta;
  /** true mientras aún llegan más lotes desde Fabric */
  partial?: boolean;
}

interface FabricViewsApiResponse {
  success: boolean;
  grupos?: string[];
  esquemas?: string[];
  esquemas_catalogo?: EsquemaCatalogo[];
  departamento?: string | null;
  data?: {
    database?: string;
    site_label?: string;
    schemas_allowed?: string[];
    schemas?: Array<{
      schema: string;
      display: string;
      view_count: number;
      views: Array<{
        view_name: string;
        qualified_name: string;
        column_count: number;
        visible_for_site: boolean;
        bi_estado?: BiEstado;
      }>;
    }>;
  };
  message?: string;
}

interface FabricColumnsApiResponse {
  success: boolean;
  data?: {
    schema: string;
    view_name: string;
    qualified: string;
    column_count: number;
    columns: FabricColumn[];
  };
  message?: string;
}

function mapColumnType(type: string): string {
  const normalized = type.toLowerCase();
  if (['int', 'bigint', 'smallint', 'tinyint', 'decimal', 'numeric', 'float', 'real', 'money'].some(t => normalized.includes(t))) {
    return 'agNumberColumnFilter';
  }
  if (['date', 'time', 'datetime'].some(t => normalized.includes(t))) {
    return 'agDateColumnFilter';
  }
  return 'agTextColumnFilter';
}

/**
 * Detecta si un valor string es realmente una fecha (formato ISO: YYYY-MM-DD o YYYY-MM-DDTHH:mm:ss).
 */
function looksLikeDate(value: unknown): boolean {
  if (typeof value !== 'string' || value.length < 10) return false;
  return /^\d{4}-\d{2}-\d{2}/.test(value);
}

/**
 * Detecta si una columna debería tratarse como texto (preservar ceros iniciales).
 * Columnas como Placa, Codigo, NIT, Documento, etc.
 */
function shouldBeText(colName: string, sampleValues: unknown[]): boolean {
  const nameLC = colName.toLowerCase();
  // Columnas que típicamente tienen ceros al inicio
  const textPatterns = ['placa', 'codigo', 'cod', 'nit', 'documento', 'cedula', 'id_', 'num_', 'telefono', 'celular', 'consecutivo'];
  if (textPatterns.some(p => nameLC.includes(p))) return true;

  // Si algún valor empieza con "0" y tiene solo dígitos → es texto (código, no número)
  for (const val of sampleValues) {
    if (typeof val === 'string' && /^0\d+$/.test(val)) return true;
  }
  return false;
}

@Injectable({
  providedIn: 'root'
})
export class VistasService {
  /** Tamaño de lote al traer todos los registros desde Fabric (máx. backend). */
  static readonly CARGA_CHUNK = 5000;
  /** Mostrar la grilla al alcanzar este número de filas mientras sigue la carga. */
  static readonly CARGA_PREVIEW = 20000;

  private readonly baseUrl = `${environment.URL_SERVICIOS}/fabric/viewer`;

  constructor(private http: HttpClient) {}

  getContext(grupoTipo?: number): Observable<FabricViewerContext> {
    const params = grupoTipo != null ? { tipo: grupoTipo } : undefined;
    return this.http.get<FabricViewerContext>(`${this.baseUrl}/context`, { params });
  }

  getVistasPorEsquema(
    schema: string,
    refresh = false,
    grupoTipo?: number
  ): Observable<{ success: boolean; data: VistaBi[]; message?: string }> {
    const body: Record<string, unknown> = {
      schema_name: schema,
      refresh
    };
    if (grupoTipo != null) {
      body['tipo'] = grupoTipo;
    }

    return this.http.post<FabricViewsApiResponse>(`${this.baseUrl}/views`, body).pipe(
      map(response => ({
        success: response.success,
        message: response.message,
        esquemas_catalogo: response.esquemas_catalogo,
        data: this.flattenViews(response)
      }))
    );
  }

  getVistas(): Observable<{ success: boolean; data: VistaBi[]; message?: string; esquemas_catalogo?: EsquemaCatalogo[] }> {
    return this.http.post<FabricViewsApiResponse>(`${this.baseUrl}/views`, {}).pipe(
      map(response => ({
        success: response.success,
        message: response.message,
        esquemas_catalogo: response.esquemas_catalogo,
        data: this.flattenViews(response)
      }))
    );
  }

  getVista(schema: string, viewName: string): Observable<{ success: boolean; data: VistaBi | null }> {
    return this.getVistasPorEsquema(schema).pipe(
      map(response => ({
        success: response.success,
        data: response.data.find(v => v.schema === schema && v.view_name === viewName) ?? null
      }))
    );
  }

  getColumnas(schema: string, viewName: string): Observable<FabricColumnsApiResponse> {
    return this.http.post<FabricColumnsApiResponse>(`${this.baseUrl}/columns`, {
      schema_name: schema,
      view_name: viewName
    });
  }

  getVistaDatos(
    schema: string,
    viewName: string,
    options: FabricDataQueryOptions = {}
  ): Observable<VistaDatosResponse> {
    return this.http.post<FabricDataResponse>(`${this.baseUrl}/data`, this.buildDataPayload(schema, viewName, options)).pipe(
      map(response => ({
        success: response.success,
        columnDefs: this.buildColumnDefsFromRows(response.data),
        rowData: response.data ?? [],
        meta: response.meta ?? { total: 0, limit: 50, offset: 0, has_next: false }
      }))
    );
  }

  getVistaDatosCompleto(
    schema: string,
    viewName: string,
    options: FabricDataQueryOptions = {}
  ): Observable<VistaDatosResponse> {
    return new Observable(observer => {
      this.getColumnas(schema, viewName).subscribe({
        next: columnsResponse => {
          const columns = columnsResponse.data?.columns ?? [];
          const columnNames = columns.map(c => c.name);

          this.http.post<FabricDataResponse>(
            `${this.baseUrl}/data`,
            this.buildDataPayload(schema, viewName, { ...options, columns: columnNames })
          ).subscribe({
            next: dataResponse => {
              observer.next({
                success: dataResponse.success,
                columnDefs: this.buildColumnDefs(columns, dataResponse.data ?? []),
                rowData: dataResponse.data ?? [],
                meta: dataResponse.meta ?? { total: 0, limit: 50, offset: 0, has_next: false }
              });
              observer.complete();
            },
            error: err => observer.error(err)
          });
        },
        error: err => observer.error(err)
      });
    });
  }

  /**
   * Carga TODOS los registros de la vista en lotes y los concatena en memoria.
   * Emite una vista previa al llegar a CARGA_PREVIEW filas y sigue actualizando.
   */
  getVistaDatosTodos(
    schema: string,
    viewName: string,
    options: {
      filters?: Record<string, string>;
      sort_col?: string;
      sort_dir?: 'asc' | 'desc';
      onProgress?: (loaded: number, total: number) => void;
    } = {}
  ): Observable<VistaDatosResponse> {
    return new Observable(observer => {
      this.getColumnas(schema, viewName).subscribe({
        next: columnsResponse => {
          const columns = columnsResponse.data?.columns ?? [];
          const columnNames = columns.map(c => c.name);
          let previewStarted = false;

          const emitSnapshot = (
            merged: Record<string, unknown>[],
            meta: FabricDataMeta,
            partial: boolean
          ): void => {
            observer.next({
              success: true,
              columnDefs: this.buildColumnDefs(columns, merged),
              rowData: merged,
              meta: {
                ...meta,
                total: Math.max(meta.total, merged.length),
                limit: merged.length,
                offset: 0,
                has_next: partial
              },
              partial
            });
          };

          const fetchChunk = (
            offset: number,
            accumulated: Record<string, unknown>[]
          ): void => {
            this.http.post<FabricDataResponse>(`${this.baseUrl}/data`, this.buildDataPayload(schema, viewName, {
              columns: columnNames,
              filters: options.filters ?? {},
              limit: VistasService.CARGA_CHUNK,
              offset,
              sort_col: options.sort_col ?? '',
              sort_dir: options.sort_dir ?? 'asc',
              skip_count: true
            })).subscribe({
              next: dataResponse => {
                const chunk = dataResponse.data ?? [];
                const merged = accumulated.concat(chunk);
                const meta = dataResponse.meta ?? {
                  total: merged.length,
                  limit: VistasService.CARGA_CHUNK,
                  offset,
                  has_next: false
                };
                const total = meta.total;
                const stillLoading = meta.has_next && merged.length < total;

                options.onProgress?.(merged.length, total);

                const readyToPreview =
                  !previewStarted &&
                  (merged.length >= VistasService.CARGA_PREVIEW || !stillLoading);

                if (readyToPreview) {
                  previewStarted = true;
                  emitSnapshot(merged, meta, stillLoading);
                } else if (previewStarted && stillLoading) {
                  emitSnapshot(merged, meta, true);
                }

                if (stillLoading) {
                  fetchChunk(offset + VistasService.CARGA_CHUNK, merged);
                  return;
                }

                emitSnapshot(merged, meta, false);
                observer.complete();
              },
              error: err => observer.error(err)
            });
          };

          fetchChunk(0, []);
        },
        error: err => observer.error(err)
      });
    });
  }

  exportExcel(
    schema: string,
    viewName: string,
    options: {
      columns?: string[];
      filters?: Record<string, string>;
      sort_col?: string;
      sort_dir?: 'asc' | 'desc';
      max_rows?: number;
      format?: 'gzip' | 'excel';
    } = {}
  ): Observable<Blob> {
    return this.http.post(`${this.baseUrl}/export`, {
      schema_name: schema,
      view: viewName,
      columns: options.columns ?? [],
      filters: options.filters ?? {},
      sort_col: options.sort_col ?? '',
      sort_dir: options.sort_dir ?? 'asc',
      max_rows: options.max_rows ?? 50000,
      format: options.format ?? 'gzip'
    }, { responseType: 'blob' });
  }

  private buildDataPayload(
    schema: string,
    viewName: string,
    options: FabricDataQueryOptions
  ): Record<string, unknown> {
    const limit = options.limit ?? 50;
    const skipCount = options.skip_count ?? limit > 1000;

    return {
      schema_name: schema,
      view: viewName,
      columns: options.columns ?? [],
      filters: options.filters ?? {},
      limit,
      offset: options.offset ?? 0,
      sort_col: options.sort_col ?? '',
      sort_dir: options.sort_dir ?? 'asc',
      skip_count: skipCount
    };
  }

  private flattenViews(response: FabricViewsApiResponse): VistaBi[] {
    if (!response.success || !response.data?.schemas) {
      return [];
    }

    const allowedSchemas = new Set(
      (response.esquemas ?? response.data.schemas_allowed ?? []).map(s => s.toLowerCase())
    );

    const database = response.data.database ?? 'Fabric Lakehouse';
    const siteLabel = response.data.site_label ?? '';

    const nombresPorSchema = new Map(
      (response.esquemas_catalogo ?? []).map(item => [item.schema.toLowerCase(), item.nombre])
    );

    return response.data.schemas
      .filter(block => {
        if (allowedSchemas.size === 0) {
          return true;
        }
        return allowedSchemas.has((block.schema ?? '').toLowerCase());
      })
      .flatMap(schemaBlock =>
      (schemaBlock.views ?? []).map(view => ({
        schema: schemaBlock.schema,
        schemaDisplay: nombresPorSchema.get(schemaBlock.schema.toLowerCase()) ?? schemaBlock.display,
        view_name: view.view_name,
        nombre: view.view_name,
        codigo: view.qualified_name,
        descripcion: schemaBlock.display,
        fuente: siteLabel ? `${database} · ${siteLabel}` : database,
        estado: view.visible_for_site,
        bi_estado: view.bi_estado ?? 'activo',
        column_count: view.column_count
      }))
    );
  }

  private buildColumnDefs(columns: FabricColumn[], rows: Record<string, unknown>[]): ColDef[] {
    if (columns.length > 0) {
      return columns.map(col => {
        const colType = getColumnType(col.type);
        const sampleValues = rows.slice(0, 20).map(r => r[col.name]);

        // Si la API dice que es número pero los datos tienen ceros al inicio → tratar como texto
        const forceText = colType === 'number' && shouldBeText(col.name, sampleValues);

        // Si la API dice texto pero los valores parecen fechas → tratar como fecha
        const inferDate = colType === 'text' && sampleValues.some(v => looksLikeDate(v));

        let filter: string;
        let valueFormatter: ((params: any) => string) | undefined;
        let cellDataType: string | undefined;

        if (forceText) {
          filter = 'agTextColumnFilter';
          cellDataType = 'text';
        } else if (colType === 'date' || inferDate) {
          filter = 'agDateColumnFilter';
          // Formatear fechas para mostrar YYYY-MM-DD sin hora
          valueFormatter = (params: any) => {
            if (!params.value) return '';
            const val = String(params.value);
            // Si tiene T (ISO datetime) → solo mostrar la fecha
            return val.includes('T') ? val.split('T')[0] : val.substring(0, 10);
          };
        } else if (colType === 'number') {
          filter = 'agNumberColumnFilter';
        } else {
          filter = 'agTextColumnFilter';
        }

        const colDef: ColDef = {
          field: col.name,
          headerName: col.name.replace(/_/g, ' '),
          filter,
          minWidth: 120,
        };

        if (valueFormatter) colDef.valueFormatter = valueFormatter;
        if (cellDataType) colDef.cellDataType = cellDataType;

        // Para filtro de fechas, necesitamos un comparador que entienda strings ISO
        if (filter === 'agDateColumnFilter') {
          colDef.filterParams = {
            comparator: (filterDate: Date, cellValue: string) => {
              if (!cellValue) return -1;
              const cellDate = new Date(cellValue.substring(0, 10));
              if (cellDate < filterDate) return -1;
              if (cellDate > filterDate) return 1;
              return 0;
            }
          };
        }

        return colDef;
      });
    }

    return this.buildColumnDefsFromRows(rows);
  }

  private buildColumnDefsFromRows(rows: Record<string, unknown>[]): ColDef[] {
    const sample = rows[0];
    if (!sample) {
      return [];
    }

    return Object.keys(sample).map(key => {
      const sampleValues = rows.slice(0, 20).map(r => r[key]);
      const firstNonNull = sampleValues.find(v => v !== null && v !== undefined && v !== '');

      let filter: string;
      let valueFormatter: ((params: any) => string) | undefined;

      if (shouldBeText(key, sampleValues)) {
        filter = 'agTextColumnFilter';
      } else if (looksLikeDate(firstNonNull)) {
        filter = 'agDateColumnFilter';
        valueFormatter = (params: any) => {
          if (!params.value) return '';
          const val = String(params.value);
          return val.includes('T') ? val.split('T')[0] : val.substring(0, 10);
        };
      } else if (typeof firstNonNull === 'number') {
        filter = 'agNumberColumnFilter';
      } else {
        filter = 'agTextColumnFilter';
      }

      const colDef: ColDef = {
        field: key,
        headerName: key.replace(/_/g, ' '),
        filter,
        minWidth: 120
      };

      if (valueFormatter) colDef.valueFormatter = valueFormatter;

      if (filter === 'agDateColumnFilter') {
        colDef.filterParams = {
          comparator: (filterDate: Date, cellValue: string) => {
            if (!cellValue) return -1;
            const cellDate = new Date(cellValue.substring(0, 10));
            if (cellDate < filterDate) return -1;
            if (cellDate > filterDate) return 1;
            return 0;
          }
        };
      }

      return colDef;
    });
  }
}
