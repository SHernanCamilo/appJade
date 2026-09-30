export type TipoCampoFormulario =
  | 'text'
  | 'time'
  | 'date'
  | 'datetime'
  | 'radio'
  | 'checkbox'
  | 'textarea'
  | 'tabla';

export interface CampoFormularioDef {
  key: string;
  seccion: string;
  label: string;
  tipo: TipoCampoFormulario;
  requeridoPorDefecto: boolean;
}

export interface FormularioParametrizable {
  codigo: string;
  titulo: string;
  descripcion: string;
  parametrizable: boolean;
  campos: CampoFormularioDef[];
}

export interface OpcionCatalogoCampo {
  codigo: string;
  descripcion: string;
}

export const CAMPOS_CATALOGO_CODIGO = ['procedimientos', 'medicamentos', 'destino1Reps'] as const;

export function esCampoCatalogo(key: string): boolean {
  return (CAMPOS_CATALOGO_CODIGO as readonly string[]).includes(key);
}

export interface CampoParametro {
  key: string;
  visible: boolean;
  requerido: boolean;
  label: string;
  opciones?: OpcionCatalogoCampo[];
}

export interface CampoParametroRow extends CampoParametro {
  seccion: string;
  tipo: TipoCampoFormulario;
  opciones: OpcionCatalogoCampo[];
}

export interface FormParametrosGuardados {
  formulario: string;
  campos: CampoParametro[];
  updatedAt?: string | null;
}

export function normalizarOpcionesCatalogo(
  raw: OpcionCatalogoCampo[] | null | undefined
): OpcionCatalogoCampo[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map(o => ({
      codigo: String(o?.codigo ?? '').trim(),
      descripcion: String(o?.descripcion ?? '').trim()
    }))
    .filter(o => o.codigo !== '' || o.descripcion !== '');
}

export function mergeCamposCatalogo(
  catalogo: CampoFormularioDef[],
  guardados: CampoParametro[] | null | undefined
): CampoParametroRow[] {
  const map = new Map((guardados ?? []).map(c => [c.key, c]));
  return catalogo.map(def => {
    const saved = map.get(def.key);
    return {
      key: def.key,
      seccion: def.seccion,
      tipo: def.tipo,
      visible: saved?.visible ?? true,
      requerido: saved?.requerido ?? def.requeridoPorDefecto,
      label: (saved?.label ?? def.label).trim() || def.label,
      opciones: esCampoCatalogo(def.key) ? normalizarOpcionesCatalogo(saved?.opciones) : []
    };
  });
}

export function toCamposPayload(rows: CampoParametroRow[]): CampoParametro[] {
  return rows.map(row => ({
    key: row.key,
    visible: row.visible,
    requerido: row.visible ? row.requerido : false,
    label: row.label.trim(),
    ...(esCampoCatalogo(row.key)
      ? { opciones: normalizarOpcionesCatalogo(row.opciones) }
      : {})
  }));
}

export function camposAMapa(campos: CampoParametro[] | null | undefined): Map<string, CampoParametro> {
  return new Map((campos ?? []).map(c => [c.key, c]));
}
