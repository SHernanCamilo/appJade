/**
 * Catalogo de formulas para el autocompletado de la barra de formulas.
 *
 * Los nombres estan en espanol porque el motor (HyperFormula) se inicializa
 * con el paquete de idioma esES. Los nombres en ingles tambien funcionan,
 * pero el autocompletado sugiere los espanoles por consistencia con Excel ES.
 */

export interface FormulaDef {
  /** Nombre de la funcion, en mayusculas (SUMA, BUSCARV...) */
  name: string;
  /** Categoria para agrupar en el desplegable */
  category: 'Matematicas' | 'Estadisticas' | 'Logicas' | 'Texto' | 'Fecha' | 'Busqueda' | 'Vistas';
  /** Firma legible: SUMA(numero1; [numero2]; ...) */
  syntax: string;
  /** Que hace, en una linea */
  description: string;
  /** Ejemplo concreto listo para copiar */
  example: string;
}

export const FORMULA_CATALOG: FormulaDef[] = [
  // ── Vistas (funciones propias del visor) ────────────────────────────────
  {
    name: 'BUSCARVISTA',
    category: 'Vistas',
    syntax: 'BUSCARVISTA(vista; columna_clave; valor; columna_resultado)',
    description: 'Busca un valor en otra vista YA CARGADA y devuelve el dato de otra columna. Equivale a BUSCARV entre hojas.',
    example: '=BUSCARVISTA("VW_Censo_Eal";"Identificacion";A2;"NombrePaciente")',
  },
  {
    name: 'CONTARVISTA',
    category: 'Vistas',
    syntax: 'CONTARVISTA(vista; columna; valor)',
    description: 'Cuenta cuantas filas de una vista cargada tienen ese valor en la columna indicada.',
    example: '=CONTARVISTA("VW_Censo_Eal";"Sede";"Bogota")',
  },
  {
    name: 'SUMARVISTA',
    category: 'Vistas',
    syntax: 'SUMARVISTA(vista; columna_suma; columna_filtro; valor_filtro)',
    description: 'Suma una columna numerica de una vista cargada, filtrando por otra columna.',
    example: '=SUMARVISTA("VW_Censo_Eal";"DiasEstancia";"Sede";"Bogota")',
  },

  // ── Matematicas ──────────────────────────────────────────────────────────
  { name: 'SUMA',      category: 'Matematicas', syntax: 'SUMA(numero1; [numero2]; ...)', description: 'Suma todos los numeros de un rango.',                 example: '=SUMA(A1:A10)' },
  { name: 'PRODUCTO',  category: 'Matematicas', syntax: 'PRODUCTO(numero1; [numero2]; ...)', description: 'Multiplica todos los numeros.',                    example: '=PRODUCTO(A1:A5)' },
  { name: 'REDONDEAR', category: 'Matematicas', syntax: 'REDONDEAR(numero; decimales)', description: 'Redondea a la cantidad de decimales indicada.',        example: '=REDONDEAR(A1;2)' },
  { name: 'ABS',       category: 'Matematicas', syntax: 'ABS(numero)',              description: 'Valor absoluto (sin signo).',                              example: '=ABS(A1)' },
  { name: 'ENTERO',    category: 'Matematicas', syntax: 'ENTERO(numero)',           description: 'Redondea hacia abajo al entero mas cercano.',              example: '=ENTERO(A1)' },
  { name: 'RESIDUO',   category: 'Matematicas', syntax: 'RESIDUO(numero; divisor)', description: 'Resto de una division.',                                   example: '=RESIDUO(A1;2)' },
  { name: 'POTENCIA',  category: 'Matematicas', syntax: 'POTENCIA(base; exponente)',description: 'Eleva un numero a una potencia.',                          example: '=POTENCIA(A1;2)' },
  { name: 'RAIZ',      category: 'Matematicas', syntax: 'RAIZ(numero)',             description: 'Raiz cuadrada.',                                           example: '=RAIZ(A1)' },
  { name: 'SUMAR.SI',  category: 'Matematicas', syntax: 'SUMAR.SI(rango; criterio; [rango_suma])', description: 'Suma solo las celdas que cumplen el criterio.', example: '=SUMAR.SI(B:B;">100";C:C)' },

  // ── Estadisticas ─────────────────────────────────────────────────────────
  { name: 'PROMEDIO',   category: 'Estadisticas', syntax: 'PROMEDIO(numero1; [numero2]; ...)', description: 'Media aritmetica del rango.',              example: '=PROMEDIO(A1:A10)' },
  { name: 'CONTAR',     category: 'Estadisticas', syntax: 'CONTAR(valor1; [valor2]; ...)',     description: 'Cuenta solo celdas con numeros.',          example: '=CONTAR(A1:A10)' },
  { name: 'CONTARA',    category: 'Estadisticas', syntax: 'CONTARA(valor1; [valor2]; ...)',    description: 'Cuenta celdas no vacias (texto incluido).',example: '=CONTARA(A1:A10)' },
  { name: 'CONTAR.SI',  category: 'Estadisticas', syntax: 'CONTAR.SI(rango; criterio)',        description: 'Cuenta las celdas que cumplen el criterio.',example: '=CONTAR.SI(B:B;"Activo")' },
  { name: 'MAX',        category: 'Estadisticas', syntax: 'MAX(numero1; [numero2]; ...)',      description: 'Valor mas alto del rango.',                example: '=MAX(A1:A10)' },
  { name: 'MIN',        category: 'Estadisticas', syntax: 'MIN(numero1; [numero2]; ...)',      description: 'Valor mas bajo del rango.',                example: '=MIN(A1:A10)' },
  { name: 'MEDIANA',    category: 'Estadisticas', syntax: 'MEDIANA(numero1; [numero2]; ...)',  description: 'Valor central del rango.',                 example: '=MEDIANA(A1:A10)' },
  { name: 'DESVEST',    category: 'Estadisticas', syntax: 'DESVEST(numero1; [numero2]; ...)',  description: 'Desviacion estandar de una muestra.',      example: '=DESVEST(A1:A10)' },

  // ── Logicas ──────────────────────────────────────────────────────────────
  { name: 'SI',        category: 'Logicas', syntax: 'SI(prueba; valor_si_verdadero; [valor_si_falso])', description: 'Devuelve un valor u otro segun una condicion.', example: '=SI(A1>100;"Alto";"Bajo")' },
  { name: 'Y',         category: 'Logicas', syntax: 'Y(logico1; [logico2]; ...)',   description: 'VERDADERO si TODAS las condiciones se cumplen.',   example: '=Y(A1>0;A1<100)' },
  { name: 'O',         category: 'Logicas', syntax: 'O(logico1; [logico2]; ...)',   description: 'VERDADERO si AL MENOS UNA condicion se cumple.',   example: '=O(A1="X";A1="Y")' },
  { name: 'NO',        category: 'Logicas', syntax: 'NO(logico)',                   description: 'Invierte VERDADERO/FALSO.',                        example: '=NO(A1>10)' },
  { name: 'SI.ERROR', category: 'Logicas', syntax: 'SI.ERROR(valor; valor_si_error)', description: 'Devuelve un alternativo si la formula da error. Ideal con BUSCARVISTA.', example: '=SI.ERROR(BUSCARVISTA("V";"K";A2;"C");"No encontrado")' },

  // ── Texto ────────────────────────────────────────────────────────────────
  { name: 'CONCATENAR', category: 'Texto', syntax: 'CONCATENAR(texto1; [texto2]; ...)', description: 'Une varios textos en uno.',                 example: '=CONCATENAR(A1;" ";B1)' },
  { name: 'IZQUIERDA',  category: 'Texto', syntax: 'IZQUIERDA(texto; [caracteres])',    description: 'Primeros N caracteres.',                    example: '=IZQUIERDA(A1;3)' },
  { name: 'DERECHA',    category: 'Texto', syntax: 'DERECHA(texto; [caracteres])',      description: 'Ultimos N caracteres.',                     example: '=DERECHA(A1;4)' },
  { name: 'EXTRAE',     category: 'Texto', syntax: 'EXTRAE(texto; inicio; caracteres)', description: 'Extrae N caracteres desde una posicion.',   example: '=EXTRAE(A1;2;5)' },
  { name: 'LARGO',      category: 'Texto', syntax: 'LARGO(texto)',                      description: 'Cantidad de caracteres.',                   example: '=LARGO(A1)' },
  { name: 'MAYUSC',     category: 'Texto', syntax: 'MAYUSC(texto)',                     description: 'Convierte a MAYUSCULAS.',                   example: '=MAYUSC(A1)' },
  { name: 'MINUSC',     category: 'Texto', syntax: 'MINUSC(texto)',                     description: 'Convierte a minusculas.',                   example: '=MINUSC(A1)' },
  { name: 'ESPACIOS',   category: 'Texto', syntax: 'ESPACIOS(texto)',                   description: 'Quita espacios sobrantes.',                 example: '=ESPACIOS(A1)' },
  { name: 'SUSTITUIR',  category: 'Texto', syntax: 'SUSTITUIR(texto; original; nuevo)', description: 'Reemplaza texto por otro.',                 example: '=SUSTITUIR(A1;"-";"")' },
  { name: 'VALOR',      category: 'Texto', syntax: 'VALOR(texto)',                      description: 'Convierte texto numerico a numero.',        example: '=VALOR(A1)' },

  // ── Fecha ────────────────────────────────────────────────────────────────
  { name: 'HOY',       category: 'Fecha', syntax: 'HOY()',                      description: 'Fecha de hoy.',                          example: '=HOY()' },
  { name: 'AHORA',     category: 'Fecha', syntax: 'AHORA()',                    description: 'Fecha y hora actuales.',                 example: '=AHORA()' },
  { name: 'AÑO',       category: 'Fecha', syntax: 'AÑO(fecha)',                 description: 'Extrae el ano de una fecha.',            example: '=AÑO(A1)' },
  { name: 'MES',       category: 'Fecha', syntax: 'MES(fecha)',                 description: 'Extrae el mes (1-12).',                  example: '=MES(A1)' },
  { name: 'DIA',       category: 'Fecha', syntax: 'DIA(fecha)',                 description: 'Extrae el dia del mes.',                 example: '=DIA(A1)' },
  { name: 'FECHA',     category: 'Fecha', syntax: 'FECHA(ano; mes; dia)',       description: 'Construye una fecha.',                   example: '=FECHA(2026;8;19)' },
  { name: 'DIAS360',   category: 'Fecha', syntax: 'DIAS360(fecha_inicio; fecha_fin; [metodo])', description: 'Dias entre dos fechas (ano comercial de 360 dias). Para dias reales: =B1-A1.', example: '=DIAS360(A1;B1)' },
  { name: 'DIASEM',    category: 'Fecha', syntax: 'DIASEM(fecha; [tipo])',      description: 'Dia de la semana como numero.',          example: '=DIASEM(A1;2)' },
  { name: 'FECHA.MES', category: 'Fecha', syntax: 'FECHA.MES(fecha; meses)',    description: 'Suma o resta meses a una fecha.',        example: '=FECHA.MES(A1;-1)' },
  { name: 'FIN.MES',   category: 'Fecha', syntax: 'FIN.MES(fecha; meses)',      description: 'Ultimo dia del mes indicado.',           example: '=FIN.MES(A1;0)' },

  // ── Busqueda (dentro de la misma hoja) ───────────────────────────────────
  { name: 'BUSCARV',   category: 'Busqueda', syntax: 'BUSCARV(valor; tabla; columna; [ordenado])', description: 'Busca en la PRIMERA columna de un rango de ESTA hoja. Para buscar en otra vista use BUSCARVISTA.', example: '=BUSCARV(A2;D:F;3;FALSO())' },
  { name: 'BUSCARH',   category: 'Busqueda', syntax: 'BUSCARH(valor; tabla; fila; [ordenado])',    description: 'Como BUSCARV pero horizontal.',        example: '=BUSCARH(A1;A1:F2;2;FALSO())' },
  { name: 'INDICE',    category: 'Busqueda', syntax: 'INDICE(rango; fila; [columna])',             description: 'Valor en una posicion del rango.',     example: '=INDICE(A1:C10;2;3)' },
  { name: 'COINCIDIR', category: 'Busqueda', syntax: 'COINCIDIR(valor; rango; [tipo])',            description: 'Posicion de un valor en el rango.',    example: '=COINCIDIR(A1;D:D;0)' },
];

/** Indice rapido por nombre */
export const FORMULA_BY_NAME = new Map(FORMULA_CATALOG.map(f => [f.name, f]));

/** Categorias en el orden en que se muestran en la guia de formulas */
export const FORMULA_CATEGORIES: FormulaDef['category'][] = [
  'Vistas', 'Matematicas', 'Estadisticas', 'Logicas', 'Texto', 'Fecha', 'Busqueda',
];

/**
 * Sugerencia devuelta al autocompletado. Puede ser una funcion, el nombre de
 * una vista cargada, o el nombre de una columna.
 */
export interface FormulaSuggestion {
  kind: 'function' | 'view' | 'column';
  /** Texto que se inserta */
  insert: string;
  /** Texto que se muestra como titulo */
  label: string;
  /** Linea secundaria (firma o categoria) */
  detail: string;
  /** Descripcion larga / ejemplo, para el tooltip */
  hint?: string;
}

/**
 * Construye las sugerencias para lo que el usuario esta escribiendo.
 *
 * Reglas:
 *  - Si el token actual empieza tras un `"` dentro de BUSCARVISTA/CONTARVISTA/
 *    SUMARVISTA, sugiere nombres de vista o de columna.
 *  - En cualquier otro caso, sugiere funciones cuyo nombre empieza por el token.
 */
export function buildFormulaSuggestions(
  text: string,
  caret: number,
  loadedViews: string[],
  columnsByView: Map<string, string[]>,
): FormulaSuggestion[] {
  if (!text.startsWith('=')) return [];

  const upTo = text.slice(0, caret);

  // ¿Estamos escribiendo dentro de una cadena entre comillas?
  const quoteCount = (upTo.match(/"/g) ?? []).length;
  const insideString = quoteCount % 2 === 1;

  if (insideString) {
    const lastQuote = upTo.lastIndexOf('"');
    const partial = upTo.slice(lastQuote + 1).toLowerCase();

    // Detectar la funcion de vista que la envuelve y en que argumento vamos
    const fnMatch = upTo.match(/(BUSCARVISTA|CONTARVISTA|SUMARVISTA)\s*\(([^()]*)$/i);
    if (fnMatch) {
      const argsSoFar = fnMatch[2];
      const argIndex = (argsSoFar.match(/[;,]/g) ?? []).length; // 0 = primer arg

      if (argIndex === 0) {
        // Primer argumento -> nombre de vista
        return loadedViews
          .filter(v => v.toLowerCase().includes(partial))
          .map(v => ({
            kind: 'view' as const,
            insert: v,
            label: v,
            detail: 'Vista cargada',
            hint: `${columnsByView.get(v)?.length ?? 0} columnas disponibles`,
          }));
      }

      // Argumentos siguientes -> columnas de la vista indicada en el primer arg
      const viewName = argsSoFar.match(/"([^"]+)"/)?.[1];
      const cols = viewName ? columnsByView.get(viewName) ?? [] : [];
      return cols
        .filter(c => c.toLowerCase().includes(partial))
        .map(c => ({
          kind: 'column' as const,
          insert: c,
          label: c,
          detail: `Columna de ${viewName}`,
        }));
    }

    return [];
  }

  // Token de funcion: ultima secuencia de letras/puntos antes del caret
  const token = (upTo.match(/[A-Za-zÁÉÍÓÚÑáéíóúñ.]+$/) ?? [''])[0].toUpperCase();
  if (token.length === 0) return [];

  return FORMULA_CATALOG
    .filter(f => f.name.startsWith(token))
    .slice(0, 12)
    .map(f => ({
      kind: 'function' as const,
      insert: `${f.name}(`,
      label: f.name,
      detail: f.syntax,
      hint: `${f.description}\nEjemplo: ${f.example}`,
    }));
}
