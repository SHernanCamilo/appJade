/**
 * Servicio de persistencia multi-capa para el device_secret del tablero.
 *
 * Problema: si Chrome kiosk limpia localStorage al reiniciar, la TV pierde
 * el token y pide código de nuevo.
 *
 * Solución: guardar el device_secret en 3 capas independientes:
 *   1. localStorage (más rápido, pero vulnerable a limpieza)
 *   2. IndexedDB (con navigator.storage.persist() para evitar evicción)
 *   3. Cookie de larga duración (10 años, SameSite=Lax)
 *
 * Al cargar, intenta recuperar de cualquiera de las 3 capas.
 * Si encuentra en una pero no en las otras, las resincroniza.
 *
 * Cada TV genera un UUID aleatorio la primera vez que carga (deviceId),
 * distinto del device_secret. Ese deviceId es lo que identifica físicamente
 * la TV y también se guarda en las 3 capas.
 */

const DB_NAME = 'tablero_persistence';
const DB_VERSION = 1;
const STORE_NAME = 'secrets';

const LS_SECRET_KEY = 'tablero_device_secret';
const LS_NAME_KEY = 'tablero_device_name';
const LS_DEVICE_ID_KEY = 'tablero_device_id';

const COOKIE_SECRET = 'tds';
const COOKIE_DEVICE_ID = 'tdid';
const COOKIE_MAX_AGE = 315360000; // 10 años en segundos

export interface DeviceCredentials {
  deviceSecret: string;
  deviceName: string;
  deviceId: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// API PÚBLICA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Intenta recuperar las credenciales de cualquiera de las 3 capas.
 * Si encuentra en una pero no en las otras, las resincroniza.
 */
export async function loadCredentials(): Promise<DeviceCredentials | null> {
  const fromLs = loadFromLocalStorage();
  const fromIdb = await loadFromIndexedDB();
  const fromCookie = loadFromCookie();

  // Prioridad: localStorage > IndexedDB > Cookie
  const best = fromLs ?? fromIdb ?? fromCookie;

  if (!best) return null;

  // Resincronizar las capas que falten
  await saveCredentials(best);

  return best;
}

/**
 * Guarda las credenciales en las 3 capas simultáneamente.
 */
export async function saveCredentials(creds: DeviceCredentials): Promise<void> {
  saveToLocalStorage(creds);
  await saveToIndexedDB(creds);
  saveToCookie(creds);
}

/**
 * Obtiene o genera el deviceId (UUID físico de esta TV).
 * Persiste en las 3 capas para que sobreviva a cualquier limpieza.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  // Intentar recuperar de las 3 capas
  const fromLs = localStorage.getItem(LS_DEVICE_ID_KEY);
  const fromIdb = await getFromIndexedDB('deviceId');
  const fromCookie = getCookieValue(COOKIE_DEVICE_ID);

  const existing = fromLs ?? fromIdb ?? fromCookie;

  if (existing) {
    // Resincronizar
    localStorage.setItem(LS_DEVICE_ID_KEY, existing);
    await putToIndexedDB('deviceId', existing);
    setCookie(COOKIE_DEVICE_ID, existing);
    return existing;
  }

  // Generar nuevo UUID
  const newId = generateUUID();
  localStorage.setItem(LS_DEVICE_ID_KEY, newId);
  await putToIndexedDB('deviceId', newId);
  setCookie(COOKIE_DEVICE_ID, newId);
  return newId;
}

/**
 * Borra las credenciales de todas las capas (al revocar el dispositivo).
 */
export async function clearCredentials(): Promise<void> {
  localStorage.removeItem(LS_SECRET_KEY);
  localStorage.removeItem(LS_NAME_KEY);
  await deleteFromIndexedDB('secret');
  await deleteFromIndexedDB('name');
  deleteCookie(COOKIE_SECRET);
}

/**
 * Solicita almacenamiento persistente al browser.
 * Chrome lo concede automáticamente si el sitio está instalado como PWA
 * o tiene un Service Worker activo. En modo kiosk normalmente se concede.
 */
export async function requestPersistence(): Promise<boolean> {
  if (navigator.storage?.persist) {
    return await navigator.storage.persist();
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// CAPA 1: localStorage
// ═══════════════════════════════════════════════════════════════════════════

function loadFromLocalStorage(): DeviceCredentials | null {
  const secret = localStorage.getItem(LS_SECRET_KEY);
  if (!secret) return null;

  return {
    deviceSecret: secret,
    deviceName: localStorage.getItem(LS_NAME_KEY) ?? '',
    deviceId: localStorage.getItem(LS_DEVICE_ID_KEY) ?? '',
  };
}

function saveToLocalStorage(creds: DeviceCredentials): void {
  localStorage.setItem(LS_SECRET_KEY, creds.deviceSecret);
  localStorage.setItem(LS_NAME_KEY, creds.deviceName);
  if (creds.deviceId) {
    localStorage.setItem(LS_DEVICE_ID_KEY, creds.deviceId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CAPA 2: IndexedDB (sobrevive a limpieza de localStorage)
// ═══════════════════════════════════════════════════════════════════════════

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getFromIndexedDB(key: string): Promise<string | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function putToIndexedDB(key: string, value: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
  } catch { /* silenciar errores de IDB */ }
}

async function deleteFromIndexedDB(key: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
  } catch { /* silenciar */ }
}

async function loadFromIndexedDB(): Promise<DeviceCredentials | null> {
  const secret = await getFromIndexedDB('secret');
  if (!secret) return null;

  const name = await getFromIndexedDB('name');
  const deviceId = await getFromIndexedDB('deviceId');

  return {
    deviceSecret: secret,
    deviceName: name ?? '',
    deviceId: deviceId ?? '',
  };
}

async function saveToIndexedDB(creds: DeviceCredentials): Promise<void> {
  await putToIndexedDB('secret', creds.deviceSecret);
  await putToIndexedDB('name', creds.deviceName);
  if (creds.deviceId) {
    await putToIndexedDB('deviceId', creds.deviceId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CAPA 3: Cookies de larga duración
// ═══════════════════════════════════════════════════════════════════════════

function getCookieValue(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${COOKIE_MAX_AGE}; path=/; SameSite=Lax`;
}

function deleteCookie(name: string): void {
  document.cookie = `${name}=; max-age=0; path=/`;
}

function loadFromCookie(): DeviceCredentials | null {
  const secret = getCookieValue(COOKIE_SECRET);
  if (!secret) return null;

  return {
    deviceSecret: secret,
    deviceName: '', // Las cookies no guardan el nombre (ahorrar espacio)
    deviceId: getCookieValue(COOKIE_DEVICE_ID) ?? '',
  };
}

function saveToCookie(creds: DeviceCredentials): void {
  setCookie(COOKIE_SECRET, creds.deviceSecret);
  if (creds.deviceId) {
    setCookie(COOKIE_DEVICE_ID, creds.deviceId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════════════════

function generateUUID(): string {
  // crypto.randomUUID() disponible en contextos seguros (HTTPS / localhost)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback para navegadores sin randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Genera un fingerprint estable del dispositivo basado en caracteristicas
 * del navegador/pantalla. NO es unico (varias TVs iguales dan el mismo hash),
 * por eso el backend lo combina con la IP. Sirve como ultimo recurso de
 * reconexion cuando la TV perdio device_id + secret de las 3 capas.
 *
 * Estable: sobrevive a limpieza de cache porque se recalcula igual cada vez.
 */
export function getDeviceFingerprint(): string {
  try {
    const parts = [
      navigator.userAgent,
      navigator.language,
      `${screen.width}x${screen.height}x${screen.colorDepth}`,
      `${new Date().getTimezoneOffset()}`,
      `${navigator.hardwareConcurrency ?? 0}`,
    ];
    const str = parts.join('|');
    // Hash simple (djb2) — no necesita ser criptografico
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
    }
    return 'fp_' + (hash >>> 0).toString(16);
  } catch {
    return '';
  }
}
