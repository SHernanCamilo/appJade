export interface Grupo {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  id_empresa: number;
  id_sede: number | null;
  estado: boolean;
  empresa?: { id: number; nombre: string };
  sede?: { id: number; nombre: string };
  encargado_actual?: GrupoEncargado | null;
}

export interface GrupoEncargado {
  id: number;
  id_grupo: number;
  id_user: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  motivo_cambio: string | null;
  registrado_por?: number;
  user?: { id: number; name: string; email: string };
}

export interface GrupoEmpleado {
  id: number;
  id_grupo: number;
  id_empleado: number;
  fecha_ingreso: string;
  fecha_salida: string | null;
  estado: boolean;
  empleado?: {
    id: number;
    nombre: string;
    cargo?: { nombre_cargo: string };
  };
}
