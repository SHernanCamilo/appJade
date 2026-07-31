/** Convierte "HH:mm" o "HH:mm:ss" a minutos desde medianoche (0–1440). */
export function timeToMinutes(time: string | null | undefined): number {
  if (!time) return 0;
  const parts = time.substring(0, 5).split(':').map(Number);
  return parts[0] * 60 + parts[1];
}

/** Formato corto 12h para UI. */
export function formatHora12(time: string | null | undefined): string {
  if (!time) return '--:--';
  const mins = timeToMinutes(time);
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h24 >= 12 ? 'p.m.' : 'a.m.';
  const h12 = h24 % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Duración en horas entre dos tiempos (soporta cruce de medianoche). */
export function duracionHoras(inicio: string, fin: string): number {
  let start = timeToMinutes(inicio);
  let end = timeToMinutes(fin);
  if (end <= start) end += 24 * 60;
  return Math.round((end - start) / 60 * 100) / 100;
}

/** Ángulo en grados para reloj 24h (0:00 arriba, sentido horario). */
export function minutosToAngle(minutes: number): number {
  return (minutes / (24 * 60)) * 360;
}

export function polar(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** Arco SVG entre dos ángulos (grados). */
export function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  if (endDeg - startDeg >= 360) endDeg = startDeg + 359.99;
  const start = polar(cx, cy, r, endDeg);
  const end = polar(cx, cy, r, startDeg);
  const large = endDeg - startDeg <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y}`;
}

/** Tinte suave para fondo de evento en calendario. */
export function hexToRgba(hex: string, alpha = 0.18): string {
  const h = hex.replace('#', '');
  if (h.length < 6) return `rgba(59, 130, 246, ${alpha})`;
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
