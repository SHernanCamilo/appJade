const UNIDADES = [
  '', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE',
  'DIECIOCHO', 'DIECINUEVE', 'VEINTE'
];

const DECENAS = [
  '', '', 'VEINTI', 'TREINTA', 'CUARENTA', 'CINCUENTA',
  'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'
];

const CENTENAS = [
  '', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
  'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'
];

function centenas(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'CIEN';

  if (n <= 20) return UNIDADES[n];

  if (n < 30) {
    return n === 20 ? 'VEINTE' : `VEINTI${UNIDADES[n - 20]}`;
  }

  if (n < 100) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    return u === 0 ? DECENAS[d] : `${DECENAS[d]} Y ${UNIDADES[u]}`;
  }

  const c = Math.floor(n / 100);
  const resto = n % 100;
  return resto === 0 ? CENTENAS[c] : `${CENTENAS[c]} ${centenas(resto)}`;
}

function seccion(n: number, divisor: number, singular: string, plural: string): string {
  const cantidad = Math.floor(n / divisor);
  if (cantidad === 0) return '';
  if (cantidad === 1) return `${centenas(cantidad)} ${singular}`.trim();
  return `${centenas(cantidad)} ${plural}`.trim();
}

function convertirEntero(n: number): string {
  if (n === 0) return 'CERO';

  const billones = seccion(n, 1_000_000_000_000, 'BILLON', 'BILLONES');
  n %= 1_000_000_000_000;
  const milMillones = seccion(n, 1_000_000_000, 'MIL MILLON', 'MIL MILLONES');
  n %= 1_000_000_000;
  const millones = seccion(n, 1_000_000, 'MILLON', 'MILLONES');
  n %= 1_000_000;
  const miles = seccion(n, 1000, 'MIL', 'MIL');
  n %= 1000;
  const resto = centenas(n);

  return [billones, milMillones, millones, miles, resto].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

/** Convierte un monto a texto en pesos colombianos (entero). */
export function numeroALetrasPesos(valor: number): string {
  const entero = Math.round(Math.abs(Number(valor) || 0));
  let letras = convertirEntero(entero);

  // Ajuste: "UN MILLON" / "UN BILLON"
  letras = letras
    .replace(/^UN MIL MILLON\b/, 'UN MIL MILLON')
    .replace(/^UN MILLON\b/, 'UN MILLON')
    .replace(/^UN BILLON\b/, 'UN BILLON');

  // Preferir VEINTITRES / VEINTICUATRO... sin espacio (estilo del formato)
  letras = letras.replace(/VEINTI ([A-ZÁÉÍÓÚÑ]+)/g, 'VEINTI$1');

  return `${letras} PESOS M/CTE`;
}

export function formatearMonedaCop(valor: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(valor) || 0);
}

export function formatearFechaCorta(valor: unknown): string {
  if (valor == null || valor === '') return '';
  const raw = String(valor);
  const iso = raw.includes('T') ? raw.split('T')[0] : raw.substring(0, 10);
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'numeric', year: 'numeric' });
}

export function formatearFechaLarga(fecha: Date = new Date()): string {
  return fecha.toLocaleDateString('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}
