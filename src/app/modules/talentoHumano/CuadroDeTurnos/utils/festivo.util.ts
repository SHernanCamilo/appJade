import { Festivo } from '../services/calculo-horas.service';

/** Normaliza fecha de festivo a YYYY-MM-DD (evita desfases por timezone). */
export function normalizarFechaFestivo(fecha: string): string {
  if (!fecha) return '';
  return fecha.substring(0, 10);
}

export function filtrarFestivosPorMes(festivos: Festivo[], mes: number, anio: number): Festivo[] {
  return festivos.filter(f => {
    const [y, m] = normalizarFechaFestivo(f.fecha).split('-').map(Number);
    return y === anio && m === mes;
  });
}

export function fechasFestivoSet(festivos: Festivo[]): Set<string> {
  return new Set(festivos.map(f => normalizarFechaFestivo(f.fecha)));
}
