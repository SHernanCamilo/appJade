import { HttpErrorResponse } from '@angular/common/http';

export interface FabricFiltersRequiredError {
  success: false;
  requires_filters: true;
  message: string;
  suggestions?: string[];
  columns?: Array<{ name: string; type: string; nullable?: boolean }>;
  heavy_view?: boolean;
  schema?: string;
  view_name?: string;
}

export function isFiltersRequiredError(error: unknown): error is HttpErrorResponse & { error: FabricFiltersRequiredError } {
  if (!(error instanceof HttpErrorResponse)) {
    return false;
  }
  return error.status === 422 && !!error.error?.requires_filters;
}

export function handleFabricError(error: HttpErrorResponse): string {
  switch (error.status) {
    case 422:
      if (error.error?.requires_filters) {
        return error.error.message;
      }
      return error.error?.message ?? 'Filtros requeridos para esta vista.';
    case 429:
      return `Demasiadas solicitudes. Reintente en ${error.error?.retry_after ?? 60}s.`;
    case 503:
      if (String(error.error?.detail ?? error.error?.message ?? '').includes('Conversion failed')) {
        return 'Error en la fuente de datos: formato de fecha incompatible en la vista. Contacte al administrador de Fabric.';
      }
      return error.error?.message ?? 'Microsoft Fabric no disponible. Reintente en unos segundos.';
    case 504:
      return 'La consulta tardó demasiado. Aplique más filtros.';
    default:
      return error.error?.message ?? 'Error inesperado consultando datos.';
  }
}
