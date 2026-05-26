export interface Plantilla {
  id: number;
  codigo: string;
  nombre: string;
  hora_inicio: string;       // "07:00:00"
  hora_fin: string;          // "15:00:00"
  duracion_horas: number;
  es_nocturno: boolean;
  color_hex: string;         // "#3498DB"
  id_empresa: number | null;
  estado: boolean;
  duracion_formateada?: string; // "07:00 - 15:00 (8h)"
}
