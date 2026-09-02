export type TipoCampoFormulario =
  | 'text'
  | 'time'
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

export interface CampoParametro {
  key: string;
  visible: boolean;
  requerido: boolean;
  label: string;
}

export interface CampoParametroRow extends CampoParametro {
  seccion: string;
  tipo: TipoCampoFormulario;
}

export interface FormParametrosGuardados {
  formulario: string;
  campos: CampoParametro[];
  updatedAt?: string | null;
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
      label: (saved?.label ?? def.label).trim() || def.label
    };
  });
}

export function toCamposPayload(rows: CampoParametroRow[]): CampoParametro[] {
  return rows.map(({ key, visible, requerido, label }) => ({
    key,
    visible,
    requerido: visible ? requerido : false,
    label: label.trim()
  }));
}

export function camposAMapa(campos: CampoParametro[] | null | undefined): Map<string, CampoParametro> {
  return new Map((campos ?? []).map(c => [c.key, c]));
}
