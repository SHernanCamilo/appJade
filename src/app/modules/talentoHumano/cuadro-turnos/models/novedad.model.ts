export type EstadoNovedad = 'pendiente' | 'aprobado' | 'rechazado';

export interface NovedadTipo {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  afecta_turno: boolean;
  requiere_reemplazo: boolean;
  requiere_aprobacion: boolean;
  color_hex: string;
  estado: boolean;
}

export interface Novedad {
  id: number;
  id_cuadro: number;
  id_asignacion: number | null;
  id_empleado: number;
  id_novedad_tipo: number;
  id_empleado_reemplaza: number | null;
  fecha_inicio: string;
  fecha_fin: string;
  estado: EstadoNovedad;
  motivo: string | null;
  observacion: string | null;
  solicitado_por?: number;
  aprobado_por?: number | null;
  fecha_aprobacion?: string | null;
  comentario_aprobacion?: string | null;
  empleado?: { id: number; nombre: string };
  novedad_tipo?: NovedadTipo;
  empleado_reemplaza?: { id: number; nombre: string } | null;
}

export const ESTADO_NOVEDAD_CONFIG: Record<EstadoNovedad, { label: string; severity: string; color: string }> = {
  pendiente: { label: 'Pendiente', severity: 'warn',    color: '#F39C12' },
  aprobado:  { label: 'Aprobado',  severity: 'success', color: '#27AE60' },
  rechazado: { label: 'Rechazado', severity: 'danger',  color: '#E74C3C' },
};
