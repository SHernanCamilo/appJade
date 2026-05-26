import { Grupo } from './grupo.model';

export type EstadoCuadro = 'borrador' | 'publicado' | 'cerrado';

export interface Cuadro {
  id: number;
  id_grupo: number;
  anio: number;
  mes: number;
  estado: EstadoCuadro;
  observaciones: string | null;
  creado_por?: number;
  publicado_por?: number | null;
  fecha_publicacion?: string | null;
  cerrado_por?: number | null;
  fecha_cierre?: string | null;
  nombre_mes?: string;
  grupo?: Grupo;
}

export interface CuadroGrilla {
  cuadro: Cuadro;
  empleados: EmpleadoGrilla[];
  dias: number[];
  grilla: {
    [idEmpleado: number]: {
      [fecha: string]: CeldaGrilla;
    };
  };
}

export interface EmpleadoGrilla {
  id: number;
  nombre: string;
  cargo: string | null;
}

export interface CeldaGrilla {
  id: number;
  es_descanso: boolean;
  es_festivo: boolean;
  id_plantilla: number | null;
  plantilla: {
    id: number;
    codigo: string;
    nombre: string;
    hora_inicio: string;
    hora_fin: string;
    color_hex: string;
  } | null;
  observacion: string | null;
}

export const ESTADO_CUADRO_CONFIG: Record<EstadoCuadro, { label: string; color: string; severity: string; icon: string }> = {
  borrador:  { label: 'Borrador',  color: '#95A5A6', severity: 'secondary', icon: 'pi-pencil' },
  publicado: { label: 'Publicado', color: '#27AE60', severity: 'success',   icon: 'pi-check-circle' },
  cerrado:   { label: 'Cerrado',   color: '#2C3E50', severity: 'contrast',  icon: 'pi-lock' },
};
