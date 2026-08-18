export type GlpiPrioridad = 'baja' | 'media' | 'alta' | 'muy_alta';
export type GlpiUnidadTiempo = 'minuto' | 'hora' | 'dia';

export interface GlpiPlantillaAns {
  id?: number;
  plantilla_id?: number;
  prioridad: GlpiPrioridad;
  tiempo_asignacion?: number | null;
  unidad_asignacion?: GlpiUnidadTiempo;
  tiempo_solucion?: number | null;
  unidad_solucion?: GlpiUnidadTiempo;
  nombre_sla_solucion?: string | null;
  nombre_regla?: string | null;
}

export interface GlpiCategoriaNodo {
  id?: number;
  nombre: string;
  prioridad?: GlpiPrioridad;
  ans_nombre?: string | null;
  nivel?: number;
  ruta_completa?: string | null;
  hijas?: GlpiCategoriaNodo[];
  categoria?: string;
  subcategoria?: string;
}

export interface GlpiAnsOpcion {
  label: string;
  value: string;
  prioridad: GlpiPrioridad;
}

export interface GlpiPlantillaCategoria extends GlpiCategoriaNodo {
  plantilla_id?: number;
  parent_id?: number | null;
  glpi_itilcategories_id?: number | null;
}

export interface GlpiPlantilla {
  id?: number;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  id_empresa?: number | null;
  nombre_entidad?: string | null;
  grupo_tecnico?: string | null;
  sla_asignacion?: string | null;
  prefijo_regla?: string;
  estado?: boolean;
  created_by?: number | null;
  created_at?: string;
  updated_at?: string;
  categorias_count?: number;
  empresa?: { id: number; nombre: string } | null;
  ans?: GlpiPlantillaAns[];
  categorias?: GlpiCategoriaNodo[];
}

export interface GlpiPlantillaPayload {
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  id_empresa?: number | null;
  nombre_entidad?: string | null;
  grupo_tecnico?: string | null;
  sla_asignacion?: string | null;
  prefijo_regla?: string;
  estado?: boolean;
  ans: GlpiPlantillaAns[];
  categorias: GlpiCategoriaNodo[];
}

export const GLPI_CATEGORIA_NIVEL_MAX = 4;

export const GLPI_PRIORIDADES: { label: string; value: GlpiPrioridad; nombre: string }[] = [
  { label: 'Baja', value: 'baja', nombre: 'BAJA' },
  { label: 'Media', value: 'media', nombre: 'MEDIA' },
  { label: 'Alta', value: 'alta', nombre: 'ALTA' },
  { label: 'Muy alta', value: 'muy_alta', nombre: 'MUY ALTA' }
];

export const GLPI_UNIDADES: { label: string; value: GlpiUnidadTiempo }[] = [
  { label: 'Minutos', value: 'minuto' },
  { label: 'Horas', value: 'hora' },
  { label: 'Días', value: 'dia' }
];
