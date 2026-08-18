export type GlpiComparacionEstado =
  | 'ok'
  | 'falta_glpi'
  | 'extra_glpi'
  | 'diferente'
  | 'tildes'
  | 'espacios'
  | 'tildes_espacios';

export interface GlpiEntidadNodo {
  id: number;
  nombre: string;
  ruta: string;
  nivel: number;
  parent_id: number | null;
  hijas: GlpiEntidadNodo[];
}

export interface GlpiComparacionResumen {
  ok: number;
  faltan: number;
  extra: number;
  diferencias: number;
  total: number;
}

export interface GlpiComparacionFila {
  tipo?: 'categoria' | 'regla';
  estado: GlpiComparacionEstado;
  detalle: string;
  ruta?: string;
  nivel?: number;
  es_hoja?: boolean;
  prioridad?: string | null;
  plantilla?: Record<string, unknown> | null;
  glpi?: Record<string, unknown> | null;
  campo?: string;
  esperado?: string;
}

export interface GlpiComparacionCampo {
  campo: string;
  esperado: string;
  glpi: string;
  estado: GlpiComparacionEstado;
  detalle: string;
}

export interface GlpiAnsPlantillaOpcion {
  key: string;
  prioridad: string;
  nombre: string;
  label: string;
  disabled?: boolean;
}

export interface GlpiComparacionRegla {
  tipo: 'regla';
  prioridad: string;
  nombre: string;
  estado: GlpiComparacionEstado;
  existe: boolean;
  detalle: string;
  ans_key?: string | null;
  glpi_id?: number;
  plantilla?: Record<string, unknown> | null;
  glpi?: Record<string, unknown> | null;
  seccion_regla: GlpiComparacionCampo[];
  criterios: GlpiComparacionCampo[];
  acciones: GlpiComparacionCampo[];
  ans?: GlpiComparacionCampo[];
}

export interface GlpiComparacionResultado {
  entidad: { id: number; nombre: string; ruta: string };
  plantilla: { id: number; codigo: string; nombre: string; prefijo_regla?: string };
  resumen: GlpiComparacionResumen;
  categorias: GlpiComparacionFila[];
  ans_plantilla?: GlpiAnsPlantillaOpcion[];
  reglas: GlpiComparacionRegla[];
}
