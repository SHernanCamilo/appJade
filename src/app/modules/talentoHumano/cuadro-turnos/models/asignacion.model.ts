import { Plantilla } from './plantilla.model';

export interface Asignacion {
  id: number;
  id_cuadro: number;
  id_empleado: number;
  fecha: string;
  id_plantilla: number | null;
  es_descanso: boolean;
  es_festivo: boolean;
  hora_inicio_override: string | null;
  hora_fin_override: string | null;
  observacion: string | null;
  hora_inicio_efectiva?: string;
  hora_fin_efectiva?: string;
  plantilla?: Plantilla;
  empleado?: { id: number; nombre: string };
}

export interface AsignacionMasiva {
  id_empleado: number;
  fecha: string;
  id_plantilla?: number | null;
  es_descanso?: boolean;
  es_festivo?: boolean;
  hora_inicio_override?: string | null;
  hora_fin_override?: string | null;
  observacion?: string | null;
}

export interface ResultadoMasivo {
  exitosas: Asignacion[];
  errores: { index: number; asignacion?: AsignacionMasiva; error: string }[];
  total: number;
  total_ok: number;
  total_err: number;
}
