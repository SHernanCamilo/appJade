import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { environment } from '../../environments/environment';
import {
  loadCredentials, saveCredentials, getOrCreateDeviceId,
  clearCredentials, requestPersistence, getDeviceFingerprint
} from './device-persistence.service';

interface UnidadUrgencias {
  IdSede: string;
  Sede: string;
  IdUnidad: number;
  Unidad: string;
  PacientesEsperaTriage: number;
  TiempoEsperaTriage: number;
  PacientesEsperaConsulta: number;
  TII: number;
  TIII: number;
}

interface SedeAgrupada {
  nombre: string;
  unidades: UnidadUrgencias[];
}

type TableroMode = 'pairing' | 'active' | 'private';

/**
 * Tablero de Urgencias — tres modos:
 *
 * 1. EMPAREJAMIENTO: la TV muestra un campo para ingresar el código de 6 dígitos.
 *    Una vez emparejada, guarda device_secret en localStorage y pasa a modo activo.
 *
 * 2. ACTIVO (público): usa EventSource (SSE) con device_secret. Sesión permanente.
 *    Si la TV se reinicia, reconecta sola sin pedir código otra vez.
 *
 * 3. PRIVADO: usuario logueado con JWT (comportamiento original).
 */
@Component({
  selector: 'app-tablero-urgencias',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tablero-urgencias.component.html',
  styleUrl: './tablero-urgencias.component.css'
})
export class TableroUrgenciasComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);

  // Estado del tablero
  readonly mode = signal<TableroMode>('pairing');
  readonly sedes = signal<SedeAgrupada[]>([]);
  readonly sedeSeleccionada = signal<SedeAgrupada | null>(null);
  readonly unidadSeleccionada = signal<UnidadUrgencias | null>(null);
  readonly isLoading = signal(true);
  readonly lastUpdate = signal<Date | null>(null);
  readonly sucursalUsuario = signal<string | null>(null);
  readonly logoEmpresa = signal<string>('assets/media/tablero-urgencias/Logo-Medilaser.png');
  readonly connected = signal(true);
  /** true cuando el backend sirve el ultimo dato bueno porque Python fallo */
  readonly dataStale = signal(false);

  // Emparejamiento
  readonly pairingCode = signal('');
  readonly pairingError = signal('');
  readonly pairingLoading = signal(false);
  readonly deviceName = signal('');

  // Carrusel
  readonly slides = [
    'assets/media/tablero-urgencias/Triage 1.png',
    'assets/media/tablero-urgencias/Triage 2.png',
    'assets/media/tablero-urgencias/Triage 3.png',
    'assets/media/tablero-urgencias/Triage 4.png',
    'assets/media/tablero-urgencias/Triage 5 .png',
  ];
  readonly currentSlide = signal(0);

  readonly totalPacientes = computed(() => {
    const u = this.unidadSeleccionada();
    return u ? u.PacientesEsperaTriage + u.PacientesEsperaConsulta : 0;
  });

  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  private slideInterval: ReturnType<typeof setInterval> | null = null;
  private watchdogInterval: ReturnType<typeof setInterval> | null = null;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;

  private readonly CACHE_KEY = 'tablero_urgencias_cache';

  // ─── Resiliencia de conexión ───────────────────────────────────────────
  /** URL activa de polling (para reconectar tras un fallo). */
  private activePollUrl: string | null = null;
  /** Intentos de reintento consecutivos (para backoff exponencial). */
  private retryAttempts = 0;
  /** Timestamp del último dato recibido con éxito (epoch ms). */
  private lastSuccessAt = 0;
  /** Intervalo normal de polling (ms). */
  private readonly POLL_INTERVAL_MS = 15_000;
  /** Si pasan más de estos ms sin datos, el watchdog fuerza reconexión. */
  private readonly STALE_THRESHOLD_MS = 60_000;
  /** Backoff máximo entre reintentos (ms). */
  private readonly MAX_BACKOFF_MS = 60_000;

  // Handlers enlazados (para poder removerlos en ngOnDestroy)
  private readonly onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      // La TV despertó / la pestaña volvió a foco → forzar refresco inmediato
      this.forceReconnect('visibility');
    }
  };
  private readonly onOnline = () => this.forceReconnect('online');
  private readonly onOffline = () => this.connected.set(false);

  ngOnInit(): void {
    // Solicitar almacenamiento persistente (Chrome kiosk lo concede automáticamente)
    requestPersistence();

    // Iniciar la detección de modo con persistencia multi-capa
    this.initializeDevice();

    // Carrusel siempre activo
    this.slideInterval = setInterval(() => {
      this.currentSlide.set((this.currentSlide() + 1) % this.slides.length);
    }, 10_000);

    // Listeners de recuperación: despertar de la TV, red que vuelve
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('online', this.onOnline);
    window.addEventListener('offline', this.onOffline);

    // Watchdog: cada 20s verifica que sigamos recibiendo datos
    this.watchdogStartedAt = Date.now();
    this.watchdogInterval = setInterval(() => this.checkWatchdog(), 20_000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    if (this.slideInterval) clearInterval(this.slideInterval);
    if (this.watchdogInterval) clearInterval(this.watchdogInterval);
    if (this.retryTimeout) clearTimeout(this.retryTimeout);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('online', this.onOnline);
    window.removeEventListener('offline', this.onOffline);
  }

  /**
   * Watchdog: si el navegador congeló el setInterval (kiosk en reposo) o la
   * conexión murió sin lanzar error, detecta que hace mucho no llegan datos
   * y fuerza una reconexión. Esta es la red de seguridad principal contra
   * las TVs que quedan "pegadas".
   */
  private checkWatchdog(): void {
    if (this.mode() === 'pairing') return;
    if (!this.activePollUrl && this.mode() !== 'private') return;

    // Referencia de tiempo: el último éxito o, si nunca hubo, el arranque del
    // watchdog. Sin esto, una TV que arrancó con el servidor caído (lastSuccessAt
    // sigue en 0) nunca era rescatada porque el watchdog solo actuaba con
    // lastSuccessAt > 0. Ahora también recupera del arranque en frío.
    const reference = this.lastSuccessAt > 0 ? this.lastSuccessAt : this.watchdogStartedAt;
    const elapsed = Date.now() - reference;

    if (elapsed > this.STALE_THRESHOLD_MS) {
      // Hace más del umbral que no recibimos datos → algo se congeló o el
      // servidor estuvo caído. Forzar reconexión limpia.
      this.connected.set(false);
      this.forceReconnect('watchdog');
    }
  }

  /** Momento en que arrancó el watchdog, para el rescate en arranque en frío. */
  private watchdogStartedAt = 0;

  /**
   * Fuerza una reconexión inmediata: reinicia el timer de polling y pide datos ya.
   */
  private forceReconnect(reason: string): void {
    if (this.mode() === 'pairing') return;

    // Modo privado: solo recargar
    if (this.mode() === 'private') {
      this.cargarDatos();
      return;
    }

    // Sin URL de polling (p. ej. el reconnect inicial nunca logró el secret):
    // reintentar la inicialización en vez de quedarse muerta.
    if (!this.activePollUrl) {
      this.retryInitialize();
      return;
    }

    // Reinicio limpio: matar el intervalo Y el reintento pendiente antes de
    // relanzar. Antes el refreshInterval seguía vivo en paralelo al retry, y se
    // acumulaban fetches solapados que saturaban al servidor cuando volvia.
    if (this.retryTimeout) { clearTimeout(this.retryTimeout); this.retryTimeout = null; }
    this.retryAttempts = 0;
    this.restartPolling();
    this.fetchPublicData(this.activePollUrl);
  }

  /**
   * Reintenta la deteccion de dispositivo cuando la TV quedó sin sesión activa
   * (por ejemplo el reconnect inicial falló porque el servidor estaba caído).
   * Evita que la TV se quede clavada en "pantalla de código" tras un corte.
   */
  private retryInitialize(): void {
    if (this.mode() === 'pairing') {
      // Si mostramos la pantalla de código, reintentar por si ya tiene secret
      void this.initializeDevice();
    }
  }

  /** Reinicia el setInterval de polling normal (15s). */
  private restartPolling(): void {
    if (this.refreshInterval) { clearInterval(this.refreshInterval); this.refreshInterval = null; }
    if (this.activePollUrl) {
      this.refreshInterval = setInterval(
        () => this.fetchPublicData(this.activePollUrl!),
        this.POLL_INTERVAL_MS
      );
    }
  }

  // =========================================================================
  // DETERMINAR MODO — Persistencia multi-capa
  // =========================================================================

  /**
   * Inicializa el dispositivo intentando recuperar credenciales de 3 capas:
   *   1. localStorage (rápido)
   *   2. IndexedDB (sobrevive a limpieza de cache)
   *   3. Cookie de 10 años (último recurso)
   *
   * Si encuentra el secret en cualquier capa, resincroniza las demás y
   * pasa a modo activo. Así la TV nunca pierde la conexión.
   */
  private async initializeDevice(): Promise<void> {
    // Generar/recuperar el deviceId (UUID físico único de esta TV)
    const deviceId = await getOrCreateDeviceId();

    // Intentar recuperar credenciales de las 3 capas
    const creds = await loadCredentials();

    if (creds?.deviceSecret) {
      // Tiene secret → modo activo directo
      this.deviceName.set(creds.deviceName || '');
      this.mode.set('active');
      this.loadFromCache();
      this.connectSSE(creds.deviceSecret);
      this.cargarLogoEmpresa();
      return;
    }

    // Sin secret en ninguna capa → intentar reconexión por deviceId
    const legacyToken = this.route.snapshot.queryParamMap.get('t');
    if (legacyToken && legacyToken.length >= 10) {
      this.mode.set('active');
      this.loadFromCache();
      this.connectSSE(null, legacyToken);
      this.cargarLogoEmpresa();
      return;
    }

    // Intentar reconexión automática: enviar deviceId al backend
    this.attemptReconnect(deviceId);
  }

  /**
   * Intenta reconectar la TV por su deviceId (UUID).
   * El backend busca un dispositivo activo emparejado con ese deviceId.
   */
  private attemptReconnect(deviceId: string): void {
    const fingerprint = getDeviceFingerprint();

    // Aunque no haya deviceId (cache totalmente limpio), intentamos por
    // fingerprint+IP. El backend decide si puede reconectar.
    if (!deviceId && !fingerprint) {
      this.continueWithoutSecret();
      return;
    }

    const url = `${environment.URL_SERVICIOS}/public/tableros/urgencias/reconnect`;

    this.http.post<{
      success: boolean;
      device_secret?: string;
      name?: string;
      sede?: string;
    }>(url, { device_id: deviceId, fingerprint }).subscribe({
      next: async (res) => {
        if (res.success && res.device_secret) {
          // Reconectado: guardar en las 3 capas
          await saveCredentials({
            deviceSecret: res.device_secret,
            deviceName: res.name ?? '',
            deviceId: deviceId,
          });
          this.reconnectAttempts = 0;
          this.deviceName.set(res.name ?? '');
          this.mode.set('active');
          this.loadFromCache();
          this.connectSSE(res.device_secret);
          this.cargarLogoEmpresa();
        } else {
          // 404 real (dispositivo no reconocido) → pedir código
          this.continueWithoutSecret();
        }
      },
      error: (err) => {
        // Un 404 es "no te reconozco" → pantalla de código.
        // Pero un error de RED (servidor caído al arrancar, status 0/5xx) NO
        // debe tirar la sesión: se reintenta unas veces antes de rendirse.
        // Antes, un corte de 1 segundo al encender la TV la mandaba a pedir
        // código aunque tuviera el device guardado en el backend.
        const esNoReconocido = err?.status === 404;
        if (!esNoReconocido && this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
          this.reconnectAttempts++;
          const delay = Math.min(2000 * this.reconnectAttempts, 15_000);
          setTimeout(() => this.attemptReconnect(deviceId), delay);
          return;
        }
        this.continueWithoutSecret();
      }
    });
  }

  /** Reintentos de la reconexión inicial ante fallos de red (no de 404). */
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;

  /** Flujo si no hay device_secret ni se pudo reconectar. */
  private continueWithoutSecret(): void {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user?.token) {
          this.mode.set('private');
          this.initPrivateMode();
          return;
        }
      } catch { /* no es JSON válido */ }
    }

    this.mode.set('pairing');
    this.isLoading.set(false);
  }

  // =========================================================================
  // EMPAREJAMIENTO (código de 6 dígitos)
  // =========================================================================

  submitPairingCode(): void {
    const code = this.pairingCode().trim();
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      this.pairingError.set('Ingrese un código de 6 dígitos.');
      return;
    }

    this.pairingLoading.set(true);
    this.pairingError.set('');

    const url = `${environment.URL_SERVICIOS}/public/tableros/urgencias/pair`;

    this.http.post<{
      success: boolean;
      device_secret?: string;
      name?: string;
      sede?: string;
      message?: string;
      error?: string;
    }>(url, { code, device_id: localStorage.getItem('tablero_device_id') ?? '' }).subscribe({
      next: async (res) => {
        this.pairingLoading.set(false);

        if (res.success && res.device_secret) {
          // Emparejado: guardar en las 3 capas (localStorage + IndexedDB + cookie)
          const deviceId = await getOrCreateDeviceId();
          await saveCredentials({
            deviceSecret: res.device_secret,
            deviceName: res.name ?? '',
            deviceId: deviceId,
          });
          this.deviceName.set(res.name ?? '');
          this.mode.set('active');
          this.connectSSE(res.device_secret);
          this.cargarLogoEmpresa();
        } else {
          this.pairingError.set(res.message ?? 'Código inválido.');
        }
      },
      error: (err) => {
        this.pairingLoading.set(false);
        const msg = err?.error?.message ?? 'Error de conexión. Intente nuevamente.';
        this.pairingError.set(msg);
      }
    });
  }

  // =========================================================================
  // MODO ACTIVO — Polling cada 30s (más estable que SSE con Apache + PHP-FPM)
  // =========================================================================

  private connectSSE(deviceSecret: string | null, legacyToken?: string): void {
    // Polling al endpoint /data cada 15 segundos.
    // Apache + PHP-FPM bufferea SSE, así que usamos polling con reconexión
    // resiliente (backoff, watchdog, recuperación al despertar la TV).
    let url: string;
    if (deviceSecret) {
      url = `${environment.URL_SERVICIOS}/public/tableros/urgencias/data?d=${deviceSecret}`;
    } else if (legacyToken) {
      url = `${environment.URL_SERVICIOS}/public/tableros/urgencias/data?token=${legacyToken}`;
    } else {
      return;
    }

    this.activePollUrl = url;

    // Cargar datos inmediatamente
    this.fetchPublicData(url);

    // Polling cada 15 segundos — cambios en la view se reflejan en <15s
    this.restartPolling();
  }

  private fetchPublicData(url: string): void {
    this.http.get<{ success: boolean; data: UnidadUrgencias[]; sede?: string; timestamp?: string; error?: string; stale?: boolean; reason?: string }>(url).subscribe({
      next: (res) => {
        // El backend devuelve HTTP 200 con success:false SOLO cuando Python fallo
        // y ademas no hay dato en cache (arranque en frio con el servicio caido).
        // Eso NO es exito: no renovar lastSuccessAt y reintentar con backoff.
        if (res.success === false) {
          console.warn('[Tablero] Sin datos (Python caido, sin cache). Motivo:', res.reason);
          this.connected.set(false);
          this.dataStale.set(false);
          if (this.refreshInterval) { clearInterval(this.refreshInterval); this.refreshInterval = null; }
          this.scheduleRetryWithBackoff();
          return;
        }

        if (res.data?.length > 0) {
          this.agruparPorSede(res.data);
          this.lastUpdate.set(new Date());
          this.saveToCache(res.data);
          if (res.sede) this.sucursalUsuario.set(res.sede);
        }

        // `stale:true` = Python fallo pero el backend sirvio el ultimo dato bueno.
        // La TV sigue mostrando informacion en vez de ponerse en rojo por un pico;
        // se marca "datos en cache" en el footer para que se sepa que no es fresco.
        // La conexion se considera VIVA (hay datos), asi el watchdog no reinicia.
        this.dataStale.set(res.stale === true);

        this.connected.set(true);
        this.isLoading.set(false);
        this.lastSuccessAt = Date.now();
        this.recoverFromError();
      },
      error: (err) => {
        if (err.status === 401) {
          // Dispositivo revocado: limpiar TODAS las capas y volver a pantalla de código
          clearCredentials();
          this.stopAllTimers();
          this.mode.set('pairing');
          this.pairingError.set('El dispositivo fue desactivado. Solicite un nuevo código al administrador.');
          return;
        }
        // Error de red/servidor: marcar desconectado y reintentar con backoff.
        // Se pausa el intervalo de 15s para que NO dispare fetches en paralelo
        // al reintento; el backoff es el único que reintenta mientras dure el fallo.
        this.connected.set(false);
        if (this.refreshInterval) { clearInterval(this.refreshInterval); this.refreshInterval = null; }
        this.scheduleRetryWithBackoff();
      }
    });
  }

  /**
   * Vuelve al ciclo normal tras recuperarse de un fallo: resetea el backoff y
   * reactiva el intervalo de 15s si estaba pausado.
   */
  private recoverFromError(): void {
    if (this.retryAttempts === 0 && this.refreshInterval) return; // ya estaba normal

    this.retryAttempts = 0;
    if (this.retryTimeout) { clearTimeout(this.retryTimeout); this.retryTimeout = null; }
    if (!this.refreshInterval) this.restartPolling();
  }

  /**
   * Reintento con backoff exponencial + jitter.
   * En vez de esperar el ciclo normal de 15s (que puede estar congelado),
   * programa un reintento activo que crece: 2s, 4s, 8s... hasta 60s max,
   * con jitter aleatorio para no saturar el servidor si vuelve de golpe.
   */
  private scheduleRetryWithBackoff(): void {
    if (this.retryTimeout || !this.activePollUrl) return;

    this.retryAttempts++;
    // Tope del exponente a 6 (2^6 = 64s ya supera el MAX_BACKOFF): evita que un
    // corte largo lleve retryAttempts a cientos y Math.pow(2, N) desborde.
    const exp = Math.min(this.retryAttempts, 6);
    const base = Math.min(1000 * Math.pow(2, exp), this.MAX_BACKOFF_MS);
    const jitter = Math.random() * 1000; // 0-1s aleatorio
    const delay = base + jitter;

    this.retryTimeout = setTimeout(() => {
      this.retryTimeout = null;
      if (this.activePollUrl) this.fetchPublicData(this.activePollUrl);
    }, delay);
  }

  private stopAllTimers(): void {
    if (this.refreshInterval) { clearInterval(this.refreshInterval); this.refreshInterval = null; }
    if (this.retryTimeout) { clearTimeout(this.retryTimeout); this.retryTimeout = null; }
    this.activePollUrl = null;
  }

  private saveToCache(data: UnidadUrgencias[]): void {
    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify({ data, timestamp: new Date().toISOString() }));
    } catch { /* storage lleno */ }
  }

  private loadFromCache(): void {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY);
      if (cached) {
        const { data } = JSON.parse(cached);
        if (data?.length > 0) {
          this.agruparPorSede(data);
          this.isLoading.set(false);
        }
      }
    } catch { /* sin cache */ }
  }

  // =========================================================================
  // MODO PRIVADO — HTTP polling (usuario logueado)
  // =========================================================================

  private initPrivateMode(): void {
    this.cargarDatos();
    this.cargarLogoEmpresa();
    this.refreshInterval = setInterval(() => this.cargarDatos(), 15_000);
  }

  cargarDatos(): void {
    const url = `${environment.URL_SERVICIOS}/tableros/urgencias`;

    this.http.get<{ success: boolean; data: UnidadUrgencias[]; sucursal?: string }>(url).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.agruparPorSede(res.data);
          this.lastUpdate.set(new Date());
          this.connected.set(true);
          this.lastSuccessAt = Date.now();
          if (res.sucursal) this.sucursalUsuario.set(res.sucursal);
        }
        this.isLoading.set(false);
      },
      error: () => { this.isLoading.set(false); this.connected.set(false); }
    });
  }

  // =========================================================================
  // UI
  // =========================================================================

  seleccionarSede(sede: SedeAgrupada): void {
    this.sedeSeleccionada.set(this.sedeSeleccionada() === sede ? null : sede);
    this.unidadSeleccionada.set(null);
  }

  seleccionarUnidad(unidad: UnidadUrgencias): void {
    this.unidadSeleccionada.set(unidad);
  }

  volver(): void { this.unidadSeleccionada.set(null); }

  formatMinutos(minutos: number): string {
    if (!minutos || minutos <= 0) return '0 min';
    if (minutos < 60) return `${minutos} min`;
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }

  // Signal que se incrementa cada vez que los datos cambian — usado para re-triggear animaciones
  readonly dataVersion = signal(0);

  private agruparPorSede(data: UnidadUrgencias[]): void {
    const map = new Map<string, UnidadUrgencias[]>();
    for (const row of data) {
      const key = row.Sede ?? 'Sin Sede';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    this.sedes.set([...map.entries()].map(([nombre, unidades]) => ({ nombre, unidades })));

    // Si hay una unidad seleccionada, actualizarla con los datos frescos
    const current = this.unidadSeleccionada();
    if (current) {
      const updated = data.find(
        u => u.IdSede === current.IdSede && u.IdUnidad === current.IdUnidad
      );
      if (updated) {
        this.unidadSeleccionada.set(updated);
      }
    }

    // Incrementar versión para que Angular detecte el cambio y dispare animaciones
    this.dataVersion.update(v => v + 1);
  }

  private cargarLogoEmpresa(): void {
    // En modo público el logo ya es el de Medilaser (asset local, sin API)
    // En modo privado intentamos cargar el de la empresa del usuario
    if (this.mode() === 'private') {
      try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          const empresa = user?.empresas?.[0];
          if (empresa?.id) {
            this.http.get<{ logo_url?: string }>(`${environment.URL_SERVICIOS}/empresas/${empresa.id}/logo-base64`).subscribe({
              next: (res) => { if (res.logo_url) this.logoEmpresa.set(res.logo_url); }
            });
          }
        }
      } catch { /* mantener logo por defecto */ }
    }
  }
}
