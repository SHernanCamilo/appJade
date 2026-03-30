// ============================================================================
// MODELOS DEL MOTOR DE FLUJOS GENÉRICO - Módulo Global
// Reutilizable para: Anticipos, Horas Extras, Permisos, Eventos, etc.
// ============================================================================

export type EstadoFlujo = 'en_progreso' | 'completado' | 'rechazado';
export type AccionAprobacion = 'aprobado' | 'rechazado' | 'observacion';
export type EstrategiaAprobador = 'fijo' | 'unidad_funcional' | 'prefijo_sucursal';

// ============================================================================
// DEFINICIONES DE FLUJO
// ============================================================================

export interface WfDefinicion {
  id: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  modulo: string;
  id_empresa?: number;
  estado: boolean;
  pasos?: WfPaso[];
  reglas?: WfRegla[];
  created_at?: string;
  updated_at?: string;
}

export interface WfPaso {
  id: number;
  id_definicion: number;
  orden: number;
  nombre_paso: string;
  descripcion?: string;
  rol_aprobador: string;
  es_opcional: boolean;
  permite_rechazo: boolean;
  aprobadores?: WfAprobador[];
}

export interface WfRegla {
  id: number;
  id_definicion: number;
  prioridad: number;
  condiciones: CondicionesRegla;
  descripcion?: string;
  estado: boolean;
}

export interface CondicionesRegla {
  nivel_min?: number;
  nivel_max?: number;
  prefijo_sucursal?: string;
  monto_min?: number;
  monto_max?: number;
  cobertura?: 'nacional' | 'internacional';
  id_unidad_funcional?: number;
  [key: string]: any;
}

export interface WfAprobador {
  id: number;
  id_paso: number;
  estrategia: EstrategiaAprobador;
  id_user?: number;
  user?: { id: number; name: string; email: string };
  id_unidad_funcional?: number;
  unidad_funcional?: { id: number; codigo: string; nombre: string };
  prefijo_sucursal?: string;
  es_suplente: boolean;
}

// ============================================================================
// INSTANCIAS Y APROBACIONES
// ============================================================================

export interface WfInstancia {
  id: number;
  id_definicion: number;
  definicion?: WfDefinicion;
  modulo: string;
  modulo_record_id: number;
  id_paso_actual?: number;
  paso_actual?: WfPaso;
  estado: EstadoFlujo;
  aprobaciones?: WfAprobacion[];
  created_at: string;
  updated_at?: string;
}

export interface WfAprobacion {
  id: number;
  id_instancia: number;
  id_paso: number;
  paso?: WfPaso;
  id_user: number;
  user?: { id: number; name: string; email: string };
  accion: AccionAprobacion;
  comentario?: string;
  monto_autorizado?: number;
  fecha_accion: string;
}

export interface WfNotificacion {
  id: number;
  id_instancia: number;
  id_user: number;
  tipo: string;
  mensaje: string;
  leida: boolean;
  fecha_lectura?: string;
  created_at: string;
}

// ============================================================================
// REQUESTS CRUD
// ============================================================================

export interface CrearDefinicionRequest {
  codigo: string;
  nombre: string;
  descripcion?: string;
  modulo: string;
  id_empresa?: number;
  estado: boolean;
}

export interface CrearPasoRequest {
  id_definicion: number;
  orden: number;
  nombre_paso: string;
  descripcion?: string;
  rol_aprobador: string;
  es_opcional: boolean;
  permite_rechazo: boolean;
}

export interface CrearReglaRequest {
  id_definicion: number;
  prioridad: number;
  condiciones: CondicionesRegla;
  descripcion?: string;
  estado: boolean;
}

export interface CrearAprobadorRequest {
  id_paso: number;
  estrategia: EstrategiaAprobador;
  id_user?: number;
  id_unidad_funcional?: number;
  prefijo_sucursal?: string;
  es_suplente: boolean;
}

// ============================================================================
// RESPONSES GENÉRICAS
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  current_page: number;
  per_page: number;
  last_page: number;
}
