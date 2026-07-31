import { Festivo, TurnoEmpleado } from '../services/calculo-horas.service';
import { Plantilla } from '../services/plantilla.service';

export interface UnidadFuncionalTurno {
  id: number;
  nombre: string;
  codigo?: string;
  empresa?: { id: number; nombre: string };
  sede?: { id: number; nombre: string };
}

export interface EmpleadoTurno {
  id: number;
  nombre: string;
  cargoRelacion?: { nombre_cargo?: string };
}

export interface DropdownOption<T = unknown> {
  label: string;
  value: number;
  data?: T;
}

export interface TurnoEditForm {
  idAsignacionIndividual: number | null;
  fecha: string;
  idPlantilla: number | null;
  esDescanso: boolean;
  observacion: string;
  tieneEvento: boolean;
  eventoInicio: string;
  eventoFin: string;
}

export interface CalendarTurnoEvent {
  id?: string;
  title: string;
  start: string;
  backgroundColor?: string;
  borderColor?: string;
  display?: string;
  extendedProps?: {
    turno?: TurnoEmpleado;
    color_hex?: string;
    codigo?: string;
    tieneEvento?: boolean;
  };
}

export interface AsignacionBulkPayload {
  id_empleado: number;
  fecha: string;
  es_descanso: boolean;
  id_plantilla: number | null;
  observacion: string | null;
  hora_inicio_override_2?: string;
  hora_fin_override_2?: string;
}

export interface AsignacionMasivaResponse {
  success: boolean;
  message: string;
  data?: {
    exitosas: unknown[];
    errores: { index: number; error: string }[];
    total: number;
    total_ok: number;
    total_err: number;
  };
}

export interface RangoHorario {
  inicio: string;
  fin: string;
  color: string;
  etiqueta: string;
  esEvento?: boolean;
}

export const EMPTY_TURNO_EDIT_FORM: TurnoEditForm = {
  idAsignacionIndividual: null,
  fecha: '',
  idPlantilla: null,
  esDescanso: false,
  observacion: '',
  tieneEvento: false,
  eventoInicio: '',
  eventoFin: ''
};

export function buildUnidadLabel(u: UnidadFuncionalTurno): string {
  return `${u.nombre} (${u.empresa?.nombre ?? 'Sin empresa'} - ${u.sede?.nombre ?? 'Sin sede'})`;
}

export function getRangosPlantilla(plantilla: Plantilla | null, evento?: { inicio: string; fin: string } | null): RangoHorario[] {
  if (!plantilla) return [];
  const color = plantilla.color_hex ?? '#3b82f6';
  const rangos: RangoHorario[] = [{
    inicio: plantilla.hora_inicio,
    fin: plantilla.hora_fin,
    color,
    etiqueta: plantilla.nombre
  }];
  if (plantilla.hora_inicio_2 && plantilla.hora_fin_2) {
    rangos.push({
      inicio: plantilla.hora_inicio_2,
      fin: plantilla.hora_fin_2,
      color,
      etiqueta: `${plantilla.nombre} (2)`
    });
  }
  if (evento?.inicio && evento?.fin) {
    rangos.push({
      inicio: evento.inicio,
      fin: evento.fin,
      color: '#f97316',
      etiqueta: 'Horas extra',
      esEvento: true
    });
  }
  return rangos;
}

export type { Festivo, Plantilla, TurnoEmpleado };
