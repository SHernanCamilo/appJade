/**
 * Construye la clase CSS completa para Bootstrap Icons.
 * Soporta los formatos usados en BD: "building", "bi-building", "bi bi-building".
 */
export function buildBootstrapIconClass(icono?: string | null, fallback = 'circle'): string {
  if (!icono || !icono.trim()) {
    return `bi bi-${fallback}`;
  }

  const trimmed = icono.trim();

  if (/^bi\s+bi-/i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('bi-')) {
    return `bi ${trimmed}`;
  }

  return `bi bi-${trimmed.replace(/^bi\s+/, '')}`;
}
