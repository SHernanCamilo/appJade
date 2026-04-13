// ============================================================================
// MODELOS DE ANTICIPOS V2 — Ciclo de vida completo
// ============================================================================

// Estados completos del ciclo de vida
export type EstadoSolicitud =
  | 'borrador'
  | 'pendiente_jefe' | 'rechazado_jefe'
  | 'pendiente_financiero' | 'rechazado_financiero'
  | 'autorizado' | 'en_viaje'
  | 'pendiente_legalizacion' | 'legalizado'
  | 'pendiente_reintegro' | 'reintegrado'
  | 'pendiente_excedente' | 'aprobado_excedente' | 'rechazado_excedente'
  | 'cerrado';

export type Cobertura = 'nacional' | 'internacional';
export type TipoCiudad = 'A' | 'B' | 'C';

// Acciones disponibles por estado
export const ACCIONES_POR_ESTADO: Record<EstadoSolicitud, string[]> = {
  borrador: ['enviar'],
  pendiente_jefe: ['aprobar', 'rechazar'],
  rechazado_jefe: [],
  pendiente_financiero: ['aprobar', 'rechazar'],
  rechazado_financiero: [],
  autorizado: ['desembolsar'],
  en_viaje: [],
  pendiente_legalizacion: ['legalizar'],
  legalizado: ['decidir-contabilidad'],
  pendiente_reintegro: ['registrar-devolucion'],
  reintegrado: ['cerrar'],
  pendiente_excedente: ['aprobar-excedente', 'rechazar-excedente'],
  aprobado_excedente: ['cerrar'],
  rechazado_excedente: ['cerrar'],
  cerrado: [],
};

// Quién actúa en cada estado
export const ROL_POR_ESTADO: Record<EstadoSolicitud, string> = {
  borrador: 'solicitante',
  pendiente_jefe: 'jefe_inmediato',
  rechazado_jefe: 'ninguno',
  pendiente_financiero: 'financiero',
  rechazado_financiero: 'ninguno',
  autorizado: 'tesoreria',
  en_viaje: 'sistema',
  pendiente_legalizacion: 'solicitante',
  legalizado: 'contabilidad',
  pendiente_reintegro: 'solicitante',
  reintegrado: 'contabilidad',
  pendiente_excedente: 'financiero',
  aprobado_excedente: 'contabilidad',
  rechazado_excedente: 'contabilidad',
  cerrado: 'ninguno',
};

// ── SOLICITUD ───────────────────────────────────────────────────────────────

export interface Solicitud {
  id: number;
  numero_solicitud: string;
  id_empleado: number;
  empleado?: EmpleadoSolicitud;
  unidad_funcional: string | null;
  id_sede_origen: number;
  id_ciudad_destino: number;
  ciudad_destino?: Ciudad;
  fecha_salida: string;
  fecha_regreso: string;
  motivo: string;
  cobertura: Cobertura;
  monto_solicitado: number;
  monto_autorizado: number | null;
  monto_legalizado: number | null;
  monto_reintegro: number | null;
  monto_excedente: number | null;
  estado: EstadoSolicitud;
  radicado_por: number;
  observaciones: string | null;
  items?: SolicitudItem[];
  created_at: string;
  updated_at?: string;
}

export interface SolicitudItem {
  id?: number;
  id_solicitud?: number;
  id_concepto: number;
  id_regla?: number;
  descripcion: string;
  cantidad: number;
  valor_unitario: number;
  valor_total: number;
}

// ── EMPLEADO ────────────────────────────────────────────────────────────────

export interface EmpleadoSolicitud {
  id: number;
  nombre: string;
  cargo: string;
  nivel_jerarquico: number;
  unidad_funcional?: string;
}

// ── CIUDAD ──────────────────────────────────────────────────────────────────

export interface Ciudad {
  id: number;
  nombre: string;
  departamento: string;
  tipo_ciudad: TipoCiudad;
  estado?: boolean;
}

// ── CÁLCULO DE TOPES ────────────────────────────────────────────────────────

export interface CalculoTopesRequest {
  id_empleado: number;
  id_ciudad_destino: number;
  fecha_salida: string;
  fecha_regreso: string;
  cobertura?: Cobertura;
}

/** Item individual devuelto por el backend en calcular-topes */
export interface TopeItem {
  id_concepto: number;
  id_regla: number;
  descripcion: string;
  cantidad: number;
  valor_unitario: number | string;
  valor_total: number;
}

/** Respuesta real del backend POST /api/anticipos/calcular-topes */
export interface CalculoTopesResponse {
  alimentacion_diario?: number;
  alimentacion_total?: number;
  transporte_diario?: number | string;
  transporte_total?: number;
  total?: number;
  dias?: number;
  nivel_jerarquico?: number;
  tipo_ciudad: TipoCiudad;
  items: TopeItem[];
  // Campos opcionales legacy
  dias_viaje?: number;
  monto_total_estimado?: number;
  flujo_asignado?: { id: number; nombre: string; pasos: { orden: number; nombre: string; rol: string }[] };
}

// ── REQUESTS ────────────────────────────────────────────────────────────────

export interface CrearSolicitudRequest {
  id_empleado: number;
  id_sede_origen?: number;
  id_ciudad_destino: number;
  fecha_salida: string;
  fecha_regreso: string;
  motivo: string;
  cobertura: Cobertura;
  items?: SolicitudItem[];
}

export interface AprobarSolicitudRequest {
  comentario?: string;
  monto_autorizado?: number;
}

export interface RechazarSolicitudRequest {
  comentario: string;
}

export interface LegalizarRequest {
  monto_legalizado: number;
  observaciones?: string;
}

export interface DecidirContabilidadRequest {
  decision: 'aceptar' | 'sobrante' | 'excedente';
  comentario?: string;
}

// ── APROBACIONES ────────────────────────────────────────────────────────────

export interface Aprobacion {
  id: number;
  usuario: { id: number; nombre: string; email: string };
  rol_aprobador: string;
  accion: 'aprobado' | 'rechazado' | 'observacion';
  comentario?: string;
  monto_autorizado?: number;
  fecha_accion: string;
}

// ── RESPONSES GENÉRICAS ─────────────────────────────────────────────────────

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
