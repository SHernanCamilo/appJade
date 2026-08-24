import { Injectable } from '@angular/core';
import { HyperFormula, FunctionPlugin, FunctionArgumentType } from 'hyperformula';
import esES from 'hyperformula/i18n/languages/esES';
import { lookupInView, countInView, sumInView } from './view-registry.service';

/**
 * Funciones personalizadas que consultan OTRAS VISTAS ya cargadas.
 *
 * Por que un plugin y no registrar cada vista como hoja de HyperFormula:
 * si registraramos las vistas como hojas, HyperFormula mantendria una SEGUNDA
 * copia completa de los datos en memoria. Con 5 vistas de cientos de miles de
 * filas eso duplica el consumo. En cambio el plugin consulta los arrays que ya
 * tenemos en memoria, usando indices Map construidos de forma perezosa.
 *
 * Limitacion conocida: HyperFormula no sabe que estas funciones dependen de
 * datos externos, asi que no recalcula sola cuando una vista se refresca.
 * Por eso FormulaEngineService.recalculate() fuerza el recalculo.
 */
class ViewLookupPlugin extends FunctionPlugin {
  buscarVista(ast: any, state: any) {
    return this.runFunction(ast.args, state, this.metadata('BUSCARVISTA'),
      (view: string, keyCol: string, value: unknown, returnCol: string) =>
        lookupInView(view, keyCol, value, returnCol),
    );
  }

  contarVista(ast: any, state: any) {
    return this.runFunction(ast.args, state, this.metadata('CONTARVISTA'),
      (view: string, col: string, value: unknown) => countInView(view, col, value),
    );
  }

  sumarVista(ast: any, state: any) {
    return this.runFunction(ast.args, state, this.metadata('SUMARVISTA'),
      (view: string, sumCol: string, filterCol: string, filterValue: unknown) =>
        sumInView(view, sumCol, filterCol, filterValue),
    );
  }
}

ViewLookupPlugin.implementedFunctions = {
  BUSCARVISTA: {
    method: 'buscarVista',
    parameters: [
      { argumentType: FunctionArgumentType.STRING },
      { argumentType: FunctionArgumentType.STRING },
      { argumentType: FunctionArgumentType.SCALAR },
      { argumentType: FunctionArgumentType.STRING },
    ],
  },
  CONTARVISTA: {
    method: 'contarVista',
    parameters: [
      { argumentType: FunctionArgumentType.STRING },
      { argumentType: FunctionArgumentType.STRING },
      { argumentType: FunctionArgumentType.SCALAR },
    ],
  },
  SUMARVISTA: {
    method: 'sumarVista',
    parameters: [
      { argumentType: FunctionArgumentType.STRING },
      { argumentType: FunctionArgumentType.STRING },
      { argumentType: FunctionArgumentType.STRING },
      { argumentType: FunctionArgumentType.SCALAR },
    ],
  },
};

const VIEW_PLUGIN_TRANSLATIONS = {
  esES: { BUSCARVISTA: 'BUSCARVISTA', CONTARVISTA: 'CONTARVISTA', SUMARVISTA: 'SUMARVISTA' },
  enGB: { BUSCARVISTA: 'LOOKUPVIEW',  CONTARVISTA: 'COUNTVIEW',   SUMARVISTA: 'SUMVIEW' },
};

/**
 * El registro de idioma y de plugins es GLOBAL y debe ocurrir ANTES de crear
 * cualquier instancia del motor. Se hace una sola vez por sesion.
 */
let bootstrapped = false;
function bootstrapHyperFormula(): void {
  if (bootstrapped) return;
  try {
    HyperFormula.registerLanguage('esES', esES);
  } catch { /* ya registrado */ }
  try {
    HyperFormula.registerFunctionPlugin(ViewLookupPlugin, VIEW_PLUGIN_TRANSLATIONS);
  } catch { /* ya registrado */ }
  bootstrapped = true;
}

/**
 * Servicio que encapsula HyperFormula para evaluar formulas tipo Excel.
 *
 * Nombres de funcion en espanol (SUMA, PROMEDIO, SI, BUSCARV...) mas las
 * funciones propias del visor (BUSCARVISTA, CONTARVISTA, SUMARVISTA).
 */
@Injectable({ providedIn: 'root' })
export class FormulaEngineService {
  /**
   * UNA sola instancia del motor con VARIAS hojas dentro (una por cada hoja de
   * analisis que abra el usuario). Antes se destruia y recreaba el motor en cada
   * hoja nueva, lo que borraba las formulas de las hojas anteriores. Con varias
   * hojas en la misma instancia tambien se pueden referenciar entre ellas
   * (=Analisis1!A1) igual que en Excel.
   */
  private hf: HyperFormula | null = null;

  /** nombre de hoja -> sheetId interno de HyperFormula */
  private readonly sheetIds = new Map<string, number>();

  private ensureEngine(): HyperFormula {
    if (!this.hf) {
      bootstrapHyperFormula();
      this.hf = HyperFormula.buildEmpty({
        licenseKey: 'gpl-v3',
        language: 'esES',
        // Separadores igual que Excel en espanol (es-CO): =SUMA(A1;B1), decimales con coma.
        // Sin esto HyperFormula espera =SUMA(A1,B1) y cualquier formula con
        // varios argumentos devuelve #ERROR!
        functionArgSeparator: ';',
        decimalSeparator: ',',
        thousandSeparator: '.',
        useColumnIndex: true,
        useStats: false,
      });
    }
    return this.hf;
  }

  /**
   * Garantiza que exista una hoja con ese nombre. Si ya existe no la toca,
   * asi que se puede llamar cada vez que el usuario vuelve a la hoja sin
   * perder lo que ya habia escrito.
   *
   * @param name Nombre de la hoja (debe ser unico y estable)
   * @param rows Filas iniciales (solo se usan al crearla)
   * @param cols Columnas iniciales (solo se usan al crearla)
   */
  ensureSheet(name: string, rows = 100, cols = 26): void {
    const hf = this.ensureEngine();
    if (this.sheetIds.has(name)) return;

    // HyperFormula sanea el nombre; hay que leer el que realmente asigno
    const realName = hf.addSheet(name);
    const id = hf.getSheetId(realName)!;
    this.sheetIds.set(name, id);

    // Reservar la matriz con celdas vacias para que las referencias A1:Z100 existan
    const empty: (string | number | boolean | null)[][] =
      Array.from({ length: rows }, () => new Array(cols).fill(null));
    hf.setSheetContent(id, empty);
  }

  /** Elimina la hoja del motor (al cerrar la pestana). */
  removeSheet(name: string): void {
    const id = this.sheetIds.get(name);
    if (id === undefined || !this.hf) return;
    try { this.hf.removeSheet(id); } catch { /* ya no existe */ }
    this.sheetIds.delete(name);
  }

  destroy(): void {
    if (this.hf) {
      this.hf.destroy();
      this.hf = null;
    }
    this.sheetIds.clear();
  }

  private idOf(sheetName: string): number | null {
    const id = this.sheetIds.get(sheetName);
    return id === undefined ? null : id;
  }

  /** Escribe una celda. Si empieza con '=' se interpreta como formula. */
  setCellValue(sheetName: string, row: number, col: number, value: string | number | boolean | null): void {
    const sheet = this.idOf(sheetName);
    if (sheet === null || !this.hf) return;
    try {
      this.hf.setCellContents({ sheet, row, col }, value);
    } catch (e) {
      console.warn('[FormulaEngine] setCellValue fallo', { sheetName, row, col, value }, e);
    }
  }

  /** Lee el valor CALCULADO de una celda. */
  getCellValue(sheetName: string, row: number, col: number): unknown {
    const sheet = this.idOf(sheetName);
    if (sheet === null || !this.hf) return null;
    const v = this.hf.getCellValue({ sheet, row, col });
    // Los errores de HyperFormula llegan como objeto: mostrarlos como Excel (#¡VALOR!)
    if (v !== null && typeof v === 'object' && 'value' in (v as object)) {
      return String((v as { value?: unknown }).value ?? '#¡ERROR!');
    }
    return v;
  }

  /** Devuelve la formula cruda de una celda, o null si es un valor plano. */
  getCellFormula(sheetName: string, row: number, col: number): string | null {
    const sheet = this.idOf(sheetName);
    if (sheet === null || !this.hf) return null;
    const s = this.hf.getCellSerialized({ sheet, row, col });
    return typeof s === 'string' && s.startsWith('=') ? s : null;
  }

  isFormula(value: unknown): boolean {
    return typeof value === 'string' && value.trim().startsWith('=');
  }

  /**
   * Fuerza el recalculo de todas las formulas.
   *
   * Necesario tras refrescar los datos de una vista: BUSCARVISTA/CONTARVISTA/
   * SUMARVISTA leen arrays externos al motor, asi que HyperFormula no detecta
   * el cambio y devuelve el resultado en cache.
   *
   * Se reescribe cada celda de formula (borrar + volver a poner) en vez de usar
   * `rebuildAndRecalculate()`: ese metodo reconstruye el registro de funciones y
   * pierde los plugins registrados de forma global, con lo que todas las
   * BUSCARVISTA pasan a devolver #¿NOMBRE?. Verificado en probe-formula.mjs.
   */
  recalculate(): void {
    const hf = this.hf;
    if (!hf) return;

    // 1. Recolectar formulas FUERA del batch: dentro, la evaluacion esta
    //    suspendida y getSheetSerialized lanza EvaluationSuspendedError.
    const pending: Array<{ sheet: number; row: number; col: number; formula: string }> = [];
    for (const sheet of this.sheetIds.values()) {
      let content: unknown[][];
      try { content = hf.getSheetSerialized(sheet) as unknown[][]; } catch { continue; }
      content.forEach((row, r) => {
        row.forEach((cell, c) => {
          if (typeof cell === 'string' && cell.startsWith('=')) {
            pending.push({ sheet, row: r, col: c, formula: cell });
          }
        });
      });
    }
    if (pending.length === 0) return;

    // 2. Reescribir en un solo batch para recalcular una sola vez
    hf.batch(() => {
      for (const p of pending) {
        const addr = { sheet: p.sheet, row: p.row, col: p.col };
        hf.setCellContents(addr, null);
        hf.setCellContents(addr, p.formula);
      }
    });
    console.log(`[FormulaEngine] Recalculadas ${pending.length} formulas`);
  }

  /** Valida la sintaxis de una formula sin escribirla en ninguna celda. */
  validate(formula: string, sheetName?: string): { ok: boolean; error?: string } {
    const hf = this.hf;
    if (!hf) return { ok: false, error: 'Motor no inicializado' };
    const sheet = sheetName ? this.idOf(sheetName) : [...this.sheetIds.values()][0] ?? null;
    if (sheet === null) return { ok: false, error: 'Sin hoja de calculo activa' };
    try {
      const result = hf.calculateFormula(formula, sheet);
      if (result !== null && typeof result === 'object' && 'type' in (result as object)) {
        return { ok: false, error: String((result as { value?: unknown }).value ?? 'Error') };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Formula invalida' };
    }
  }

  hasSheet(name: string): boolean { return this.sheetIds.has(name); }

  get isReady(): boolean { return this.hf !== null; }

  get sheetNames(): string[] { return [...this.sheetIds.keys()]; }
}
