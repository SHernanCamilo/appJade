/**
 * Contratos de datos del módulo Fichas Técnicas Médicas.
 *
 * Reflejan las respuestas de `/api/fichas-tecnicas/*` del backend Laravel.
 * Ninguna interfaz usa `any`: si el backend agrega campos, se declaran aquí.
 */

// ─────────────────────────────────────────────────────────────────────────
// Envolturas de respuesta
// ─────────────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginationMeta {
  current_page: number;
  per_page: number;
  has_more: boolean;
  total?: number;
  last_page?: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: PaginationMeta;
}

// ─────────────────────────────────────────────────────────────────────────
// Estados del workflow (espejo del enum EstadoFicha de PHP)
// ─────────────────────────────────────────────────────────────────────────

export type EstadoCodigo =
  | 'borrador'
  | 'generada'
  | 'autorizada'
  | 'por_aprobar'
  | 'finalizada'
  | 'rechazada'
  | 'cancelada'
  | 'actualizacion_generada'
  | 'actualizacion_en_proceso'
  | 'actualizacion_autorizada'
  | 'actualizacion_finalizada'
  | 'actualizacion_rechazada';

export type VigenciaEstado = 'VIGENTE' | 'PROXIMA' | 'ALERTA' | 'CRITICA' | 'VENCIDA';

export type BandejaFichas =
  | 'borradores'
  | 'procesando'
  | 'por-autorizar'
  | 'por-aprobar'
  | 'rechazados'
  | 'finalizadas'
  | 'vencidas'
  | 'proximas-vencer';

export interface FichEstado {
  id: number;
  codigo: EstadoCodigo;
  descripcion: string;
  tipo: 'ficha' | 'actualizacion';
  color_hex: string;
  es_editable: boolean;
  es_final: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// Catálogos
// ─────────────────────────────────────────────────────────────────────────

export interface Agremiacion {
  id: number;
  nombre: string;
  nit: string | null;
  rep_legal?: string | null;
  cc_rep_legal?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  correo?: string | null;
  estado?: boolean;
}

export interface Especialidad {
  id: number;
  descripcion: string;
  perfil: string | null;
  estado?: boolean;
}

export interface Profesional {
  id: number;
  documento: string;
  nombre: string;
  tarjeta_profesional: string | null;
  correo?: string | null;
  telefono?: string | null;
  estado?: boolean;
  especialidades?: Especialidad[];
}

/** Fila de la vista v_fich_profesionales_especialidad. */
export interface ProfesionalDeEspecialidad {
  id_profesional: number;
  documento: string;
  profesional_nombre: string;
  tarjeta_profesional: string | null;
  especialidad_perfil: string | null;
}

export interface ObjetoContrato {
  id: number;
  descripcion: string;
  estado?: boolean;
}

export interface TipoServicio {
  id: number;
  descripcion: string;
  estado?: boolean;
}

export interface ObsItem {
  id: number;
  descripcion: string;
  estado?: boolean;
  tipos_servicio?: TipoServicio[];
}

export interface OpcionSimple {
  value: string;
  label: string;
}

export interface OpcionesFormulario {
  agremiaciones: Agremiacion[];
  especialidades: Especialidad[];
  objetos_contrato: ObjetoContrato[];
  tipos_servicio: TipoServicio[];
  formas_pago: OpcionSimple[];
  perfiles: OpcionSimple[];
}

/** Catálogos administrables por el rol Parametrizador. */
export type CatalogoNombre =
  | 'agremiaciones'
  | 'profesionales'
  | 'especialidades'
  | 'tipos-servicio'
  | 'objetos-contrato'
  | 'obs-items'
  | 'homologos';

// ─────────────────────────────────────────────────────────────────────────
// Tarifarios
// ─────────────────────────────────────────────────────────────────────────

export type TipoManual = 'ISS 2001' | 'SOAT' | 'INSTITUCIONAL';

export interface Cups {
  id: number;
  resolucion: '2077' | '2336' | '2641';
  subcategoria: string;
  desc_subcat: string;
  grupo: string | null;
  desc_grup: string | null;
  subgrupo: string | null;
  desc_subg: string | null;
  desc_cap?: string | null;
  tipo_serv?: string | null;
  pbs?: string | null;
}

export interface CupsGrupo {
  grupo: string;
  desc_grup: string;
}

export interface CupsSubgrupo {
  subgrupo: string;
  desc_subg: string;
  grupo: string;
}

export interface Homologo {
  id: number;
  code_cups: string;
  desc_cups: string;
  tipo_manual: TipoManual;
  code_manual: string;
  desc_manual: string;
  id_tipo_servicio?: number | null;
  uvr_grupo?: string | null;
  vlr_cirujano?: string | null;
  vlr_aneste?: string | null;
  valor: string | null;
  pbs?: boolean;
  tipo_servicio?: TipoServicio | null;
}

export interface TarifaSoat {
  id: number;
  vigencia: number;
  cod: string;
  descripcion: string;
  grupo: number | null;
  vlr_cirujano: string;
  vlr_anestesia: string;
  valor: string;
}

/** Trazabilidad: fichas vigentes que contratan un CUPS. */
export interface FichaPorCups {
  id: number;
  consecutivo: string | null;
  sucursal_nombre: string | null;
  sucursal_legacy: string | null;
  empresa_nombre: string | null;
  agremiacion_nombre: string;
  especialidad_descripcion: string;
  fecha_ini: string;
  fecha_fin: string;
  dias_restantes: number;
  vigencia_estado: VigenciaEstado;
  cups: string;
  cups_descripcion: string | null;
  tipo_liquidacion: string | null;
  forma_pago: string | null;
  variacion: string | null;
  valor: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Ficha técnica
// ─────────────────────────────────────────────────────────────────────────

export interface DetalleFicha {
  id: number;
  id_ficha: number;
  tipo_liquidacion: string | null;
  tipo_servicio: string | null;
  id_tipo_servicio: number | null;
  tipo_servicio_descripcion?: string | null;
  cups: string | null;
  cups_descripcion?: string | null;
  cups_resolucion?: string | null;
  grupo: string | null;
  grupo_descripcion?: string | null;
  subgrupo: string | null;
  subgrupo_descripcion?: string | null;
  forma_pago: string | null;
  homologo: string | null;
  homologo_tipo_manual?: TipoManual | null;
  homologo_descripcion?: string | null;
  variacion: string | null;
  valor: string;
  id_obs_item: number | null;
  obs_item_descripcion?: string | null;
  novedad: string | null;
}

export interface ObservacionFicha {
  id: number;
  id_ficha: number;
  desc_obs: string;
  created_at?: string;
}

export interface ComentarioFicha {
  id: number;
  id_ficha: number;
  id_usuario: number;
  id_estado: number | null;
  descripcion: string;
  created_at: string;
  usuario?: { id: number; name: string; email: string } | null;
}

export interface HistorialEstado {
  id: number;
  id_ficha: number;
  id_estado_anterior: number | null;
  id_estado_nuevo: number;
  id_usuario: number | null;
  observacion: string | null;
  created_at: string;
  estado_anterior?: { id: number; codigo: string; descripcion: string } | null;
  estado_nuevo?: { id: number; codigo: string; descripcion: string } | null;
  usuario?: { id: number; name: string; email: string } | null;
}

export interface Ficha {
  id: number;
  consecutivo: string | null;
  id_padre: number | null;
  version: number;
  id_empresa: number | null;
  id_sucursal: number | null;
  sucursal_legacy: string | null;
  id_agremiacion: number;
  id_objeto_contrato: number;
  id_especialidad: number;
  vlr_contrato: string;
  fecha_ini: string;
  fecha_fin: string;
  id_estado: number;
  id_user_reg: number;
  fecha_reg: string | null;
  user_autoriza_id: number | null;
  fecha_autoriza: string | null;
  obs_autoriza: string | null;
  user_aprueba_id: number | null;
  fecha_aprueba: string | null;
  obs_aprueba: string | null;
  obs_os: string | null;
  novedad: string | null;
  total_detalles: number;
  valor_total_detalles: string;
  total_profesionales: number;
  dias_restantes: number | null;
  vigencia_estado: VigenciaEstado | null;

  estado?: FichEstado;
  agremiacion?: Agremiacion;
  especialidad?: Especialidad;
  objetoContrato?: ObjetoContrato;
  empresa?: { id: number; nombre: string; prefijo: string } | null;
  sucursal?: { id: number; nombre: string } | null;
  generador?: { id: number; name: string; email: string } | null;
  autorizador?: { id: number; name: string; email: string } | null;
  aprobador?: { id: number; name: string; email: string } | null;
  profesionales?: Profesional[];
  detalles?: DetalleFicha[];
  observaciones?: ObservacionFicha[];
  comentarios?: ComentarioFicha[];
  padre?: Pick<Ficha, 'id' | 'consecutivo' | 'fecha_ini' | 'fecha_fin' | 'vlr_contrato'> | null;
  versiones?: Pick<Ficha, 'id' | 'id_padre' | 'consecutivo' | 'version' | 'id_estado'>[];
}

// ─────────────────────────────────────────────────────────────────────────
// Payloads de escritura
// ─────────────────────────────────────────────────────────────────────────

export interface CrearFichaPayload {
  id_agremiacion: number;
  id_objeto_contrato: number;
  id_especialidad: number;
  vlr_contrato: number;
  fecha_ini: string;
  fecha_fin: string;
  profesionales: number[];
  id_empresa?: number | null;
  id_sucursal?: number | null;
  sucursal_legacy?: string | null;
  id_padre?: number | null;
  obs_os?: string | null;
}

export type ActualizarFichaPayload = Partial<CrearFichaPayload> & {
  novedad?: string | null;
};

export interface DetallePayload {
  tipo_liquidacion?: string | null;
  tipo_servicio?: string | null;
  id_tipo_servicio?: number | null;
  cups?: string | null;
  grupo?: string | null;
  subgrupo?: string | null;
  forma_pago?: string | null;
  homologo?: string | null;
  variacion?: string | null;
  valor: number;
  id_obs_item?: number | null;
  novedad?: string | null;
}

export interface CrearActualizacionPayload {
  obs_os: string;
  fecha_ini?: string;
  fecha_fin?: string;
  vlr_contrato?: number;
  profesionales?: number[];
  detalles?: DetallePayload[];
}

// ─────────────────────────────────────────────────────────────────────────
// Conflictos de profesionales (regla crítica de negocio)
// ─────────────────────────────────────────────────────────────────────────

export interface ConflictoProfesional {
  id_profesional: number;
  nombre_profesional: string;
  documento: string;
  id_ficha: number;
  consecutivo: string;
  fecha_ini: string;
  fecha_fin: string;
  sucursal: string | null;
}

export interface RespuestaConflictos {
  success: boolean;
  tiene_conflictos: boolean;
  conflictos: ConflictoProfesional[];
}

/** Cuerpo de un 409 devuelto por el backend al guardar con conflictos. */
export interface ErrorConflicto {
  success: false;
  message: string;
  conflictos: ConflictoProfesional[];
}

// ─────────────────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────────────────

export interface IndicadoresFichas {
  total: number;
  borradores: number;
  en_proceso: number;
  por_aprobar: number;
  rechazadas: number;
  finalizadas: number;
  canceladas: number;
  vigentes: number;
  vencidas: number;
  proximas_vencer: number;
  valor_contratado: number;
}

export interface FichaProximaVencer {
  id: number;
  consecutivo: string | null;
  id_empresa: number | null;
  id_sucursal: number | null;
  sucursal_legacy: string | null;
  fecha_fin: string;
  vlr_contrato: string;
  agremiacion_nombre: string;
  especialidad_descripcion: string;
  dias_restantes: number;
  color_alerta: string;
}

export interface ResumenPorSucursal {
  id_empresa: number | null;
  id_sucursal: number | null;
  sucursal_legacy: string | null;
  total: number;
  borradores: number;
  por_aprobar: number;
  en_proceso: number;
  rechazadas: number;
  finalizadas: number;
  canceladas: number;
  vigentes: number;
  vencidas: number;
  proximas_vencer: number;
  valor_contratado: string;
}

export interface AgrupacionValor {
  especialidad_descripcion?: string;
  agremiacion_nombre?: string;
  total: number;
  valor: string;
}

export interface DashboardFichas {
  indicadores: IndicadoresFichas;
  proximas_vencer: FichaProximaVencer[];
  por_especialidad: AgrupacionValor[];
  por_agremiacion: AgrupacionValor[];
}

// ─────────────────────────────────────────────────────────────────────────
// Filtros de listado
// ─────────────────────────────────────────────────────────────────────────

export interface FiltrosFichas {
  bandeja?: BandejaFichas;
  buscar?: string;
  id_agremiacion?: number;
  id_especialidad?: number;
  id_estado?: number[];
  desde?: string;
  hasta?: string;
  id_empresa?: number;
  id_sucursal?: number;
  page?: number;
  per_page?: number;
}
