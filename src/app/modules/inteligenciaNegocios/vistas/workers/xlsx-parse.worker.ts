/// <reference lib="webworker" />

/**
 * Web Worker para parsear archivos XLSX/CSV/NDJSON sin bloquear el hilo principal.
 *
 * El hilo principal envia un mensaje con:
 *   { type: 'parse', blob: ArrayBuffer, format: 'xlsx'|'csv'|'ndjson', knownColumns: string[] }
 *
 * El worker responde con mensajes progresivos:
 *   { type: 'progress', parsed: number, total: number }
 *   { type: 'chunk', rows: Record<string, unknown>[], offset: number }
 *   { type: 'done', totalRows: number, headers: string[] }
 *   { type: 'error', message: string }
 */

// XLSX se importa dentro del worker (no comparte modulos con Angular)
importScripts('https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js');
declare const XLSX: any;

const CHUNK_SIZE = 10_000; // Filas por mensaje de chunk

addEventListener('message', (event: MessageEvent) => {
  const { type, buffer, format, knownColumns } = event.data;

  if (type !== 'parse') return;

  try {
    if (format === 'xlsx' || format === 'zip') {
      parseXlsx(buffer, knownColumns ?? []);
    } else if (format === 'ndjson' || format === 'ndjson.gz') {
      parseNdjson(buffer);
    } else {
      parseCsv(buffer);
    }
  } catch (e: any) {
    postMessage({ type: 'error', message: e.message ?? 'Error en el worker de parseo' });
  }
});

function parseXlsx(buffer: ArrayBuffer, knownColumns: string[]): void {
  postMessage({ type: 'progress', parsed: 0, total: 0, phase: 'Descomprimiendo XLSX...' });

  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true, dense: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) { postMessage({ type: 'done', totalRows: 0, headers: [] }); return; }

  const sheet = workbook.Sheets[sheetName];
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });

  if (rawRows.length < 2) { postMessage({ type: 'done', totalRows: 0, headers: [] }); return; }

  postMessage({ type: 'progress', parsed: 0, total: rawRows.length, phase: 'Identificando columnas...' });

  // Encontrar fila de encabezados
  const knownSet = new Set(knownColumns.map(c => c.toLowerCase().trim()));
  let headerRowIdx = -1;

  for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
    const row = rawRows[i] as (string | null)[];
    const nonEmpty = row.filter(v => v !== null && String(v).trim() !== '');
    if (nonEmpty.length === 0) continue;

    if (knownSet.size > 0) {
      const matches = nonEmpty.filter(v => knownSet.has(String(v).toLowerCase().trim())).length;
      if (matches >= Math.min(3, knownSet.size)) { headerRowIdx = i; break; }
    } else if (nonEmpty.length >= 3) {
      headerRowIdx = i; break;
    }
  }
  if (headerRowIdx === -1) headerRowIdx = 0;

  const headers = (rawRows[headerRowIdx] as (string | null)[])
    .map(h => (h !== null ? String(h).trim() : ''));

  const totalDataRows = rawRows.length - headerRowIdx - 1;
  postMessage({ type: 'progress', parsed: 0, total: totalDataRows, phase: 'Procesando filas...' });

  // Procesar en chunks para poder reportar progreso
  let chunk: Record<string, unknown>[] = [];
  let offset = 0;

  for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
    const row = rawRows[i] as unknown[];
    if (row.every(v => v === null || v === '')) continue;

    const obj: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j];
      if (key) obj[key] = row[j] ?? null;
    }
    chunk.push(obj);

    if (chunk.length >= CHUNK_SIZE) {
      postMessage({ type: 'chunk', rows: chunk, offset });
      offset += chunk.length;
      chunk = [];
      postMessage({ type: 'progress', parsed: offset, total: totalDataRows, phase: 'Procesando filas...' });
    }
  }

  // Ultimo chunk
  if (chunk.length > 0) {
    postMessage({ type: 'chunk', rows: chunk, offset });
    offset += chunk.length;
  }

  postMessage({ type: 'done', totalRows: offset, headers: headers.filter(h => h !== '') });
}

function parseNdjson(buffer: ArrayBuffer): void {
  const text = new TextDecoder().decode(buffer);
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  const total = lines.length;

  postMessage({ type: 'progress', parsed: 0, total, phase: 'Parseando NDJSON...' });

  let chunk: Record<string, unknown>[] = [];
  let offset = 0;

  for (let i = 0; i < lines.length; i++) {
    try {
      chunk.push(JSON.parse(lines[i]));
    } catch { /* skip malformed */ }

    if (chunk.length >= CHUNK_SIZE) {
      postMessage({ type: 'chunk', rows: chunk, offset });
      offset += chunk.length;
      chunk = [];
      postMessage({ type: 'progress', parsed: offset, total, phase: 'Parseando NDJSON...' });
    }
  }

  if (chunk.length > 0) {
    postMessage({ type: 'chunk', rows: chunk, offset });
    offset += chunk.length;
  }

  const headers = offset > 0 ? Object.keys(chunk[0] ?? {}) : [];
  postMessage({ type: 'done', totalRows: offset, headers });
}

function parseCsv(buffer: ArrayBuffer): void {
  const text = new TextDecoder().decode(buffer);
  const lines = text.split('\n');
  if (lines.length < 2) { postMessage({ type: 'done', totalRows: 0, headers: [] }); return; }

  // BOM
  const firstLine = lines[0].replace(/^\uFEFF/, '');
  const delim = (firstLine.split(';').length > firstLine.split(',').length) ? ';' : ',';
  const headers = firstLine.split(delim).map(h => h.replace(/^"|"$/g, '').trim());

  const total = lines.length - 1;
  postMessage({ type: 'progress', parsed: 0, total, phase: 'Parseando CSV...' });

  let chunk: Record<string, unknown>[] = [];
  let offset = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(delim);
    const obj: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      let v = values[j] ?? '';
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      obj[headers[j]] = v === '' ? null : v;
    }
    chunk.push(obj);

    if (chunk.length >= CHUNK_SIZE) {
      postMessage({ type: 'chunk', rows: chunk, offset });
      offset += chunk.length;
      chunk = [];
      postMessage({ type: 'progress', parsed: offset, total, phase: 'Parseando CSV...' });
    }
  }

  if (chunk.length > 0) {
    postMessage({ type: 'chunk', rows: chunk, offset });
    offset += chunk.length;
  }

  postMessage({ type: 'done', totalRows: offset, headers });
}
