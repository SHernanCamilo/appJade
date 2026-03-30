// ============================================================================
// MODELOS DE ANTICIPOS - Sistema de Flujos Parametrizable
// ============================================================================

// Estados de Solicitud
export type EstadoSolicitud =
  | 'borrador'
  | 'pendiente_jefe'
  | 'rechazado_jefe'
  | 'pendiente_financiero'
  | 'rechazado_financiero'
  | 'autorizado'
  | 'en_viaje'
  | 'pendiente_legalizacion'
  | 'legalizado'
  | 'cerrado';

// Cobertura
export type Cobertura = 'nacional' | 'internacional';

// Tipo de Ciudad
export type TipoCiudad = 'A' | 'B' | 'C';

// ============================================================================
// SOLICITUDES
// ============================================================================

export interface Solicitud {
  id: number;
  numero_solicitud: string;
  id_empleado: number;
  empleado?: EmpleadoSolicitud;
  id_ciudad_destino: number;
  destino?: Ciudad;
  fecha_salida: string;
  fecha_regreso: string;
  motivo: string;
  cobertura: Cobertura;
  monto_solicitado: number;
  monto_autorizado?: number;
  estado: EstadoSolicitud;
  flujo?: FlujoInfo;
  items?: SolicitudItem[];
  historial_aprobaciones?: Aprobacion[];
  documentos?: Documento[];
  created_at: string;
  updated_at?: string;
}

export interface SolicitudItem {
  id?: number;
  id_solicitud?: number;
  id_concepto: number;
  concepto?: string;
  descripcion: string;
  cantidad: number;
  valor_unitario: number;
  valor_total: number;
}

export interface Documento {
  id: number;
  nombre_archivo: string;
  ruta: string;
  tipo_mime: string;
  tamano: number;
  uploaded_at: string;
}

// ============================================================================
// EMPLEADOS Y CARGOS
// ============================================================================

export interface EmpleadoSolicitud {
  id: number;
  nombre: string;
  cargo: string;
  nivel_jerarquico: 1 | 2 | 3 | 4;
  unidad_funcional?: string;
}

export interface Cargo {
  id_cargo: number;
  nombre_cargo: string;
  nivel_jerarquico: number;
}

// ============================================================================
// CIUDADES
// ============================================================================

export interface Ciudad {
  id: number;
  nombre: string;
  departamento: string;
  tipo_ciudad: TipoCiudad;
  estado: boolean;
}

// ============================================================================
// CÁLCULO DE TOPES
// ============================================================================

export interface CalculoTopesRequest {
  id_empleado: number;
  id_ciudad_destino: number;
  fecha_salida: string;
  fecha_regreso: string;
  cobertura: Cobertura;
}

export interface CalculoTopesResponse {
  empleado: {
    id: number;
    nombre: string;
    cargo: string;
    nivel_jerarquico: number;
    sucursal: string;
  };
  destino: {
    ciudad: string;
    tipo_ciudad: TipoCiudad;
  };
  dias_viaje: number;
  topes_alimentacion: {
    desayuno_diario: number;
    almuerzo_diario: number;
    cena_diario: number;
    total_diario: number;
    total_viaje: number;
  };
  topes_transporte: {
    transporte_interno_diario: number;
    total_viaje: number;
  };
  monto_total_estimado: number;
  flujo_asignado?: FlujoAsignado;
}

export interface FlujoAsignado {
  id: number;
  nombre: string;
  pasos: PasoFlujo[];
}

export interface PasoFlujo {
  orden: number;
  nombre: string;
  rol: string;
}

// ============================================================================
// FLUJO DE APROBACIÓN
// ============================================================================

export interface FlujoInfo {
  id: number;
  nombre: string;
  paso_actual: PasoActual;
  pasos_completados: PasoCompletado[];
  pasos_pendientes: PasoPendiente[];
}

export interface PasoActual {
  orden: number;
  nombre: string;
  aprobador?: Usuario;
}

export interface PasoCompletado {
  orden: number;
  nombre: string;
  aprobador: Usuario;
  fecha_aprobacion: string;
}

export interface PasoPendiente {
  orden: number;
  nombre: string;
}

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
}

// ============================================================================
// APROBACIONES
// ============================================================================

export interface Aprobacion {
  id: number;
  usuario: Usuario;
  rol_aprobador: string;
  accion: 'aprobado' | 'rechazado' | 'observacion';
  comentario?: string;
  monto_autorizado?: number;
  fecha_accion: string;
}

export interface AprobarSolicitudRequest {
  comentario?: string;
  monto_autorizado?: number;
}

export interface RechazarSolicitudRequest {
  comentario: string;
}

// ============================================================================
// REQUESTS
// ============================================================================

export interface CrearSolicitudRequest {
  id_empleado: number;
  id_ciudad_destino: number;
  fecha_salida: string;
  fecha_regreso: string;
  motivo: string;
  cobertura: Cobertura;
  items: SolicitudItem[];
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
  meta?: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
}
