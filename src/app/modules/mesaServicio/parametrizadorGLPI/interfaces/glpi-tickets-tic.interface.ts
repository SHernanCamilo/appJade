export type GlpiTicketAlerta = 'vencido' | 'por_vencer' | 'en_tiempo' | 'sin_ans';

export interface GlpiTicketTic {
  id: number;
  titulo: string;
  prioridad_id: number;
  prioridad: string;
  estado_id: number;
  estado: string;
  solicitante: string;
  tecnico: string;
  categoria: string;
  grupo: string;
  grupos: string[];
  grupo_actual: string;
  nivel: number;
  entidad: string;
  entidad_corta: string;
  fecha_apertura: string;
  vence_ans: string | null;
  ans: string;
  alerta: GlpiTicketAlerta;
  alerta_horas: number;
  minutos_restantes: number | null;
  tiempo_texto: string;
  url: string | null;
}

export interface GlpiTicketEntidadResumen {
  nombre: string;
  corta: string;
  total: number;
  vencidos: number;
  por_vencer: number;
}

export interface GlpiTicketConteo {
  total: number;
  vencidos: number;
  por_vencer: number;
  en_tiempo: number;
  sin_ans: number;
}

export interface GlpiTicketNivelResumen extends GlpiTicketConteo {
  nivel: number;
  nombre: string;
}

export interface GlpiTicketGrupoResumen extends GlpiTicketConteo {
  nombre: string;
  nivel: number;
}

export interface GlpiTableroTic {
  generado_en: string;
  grupo: { id: number; nombre: string };
  alerta_horas: number;
  url_glpi: string | null;
  resumen: {
    abiertos: number;
    vencidos: number;
    por_vencer: number;
    en_tiempo: number;
    sin_ans: number;
  };
  niveles: GlpiTicketNivelResumen[];
  grupos_tecnicos: GlpiTicketGrupoResumen[];
  entidades: GlpiTicketEntidadResumen[];
  tickets: GlpiTicketTic[];
}
