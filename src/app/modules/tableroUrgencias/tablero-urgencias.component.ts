import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { environment } from '../../environments/environment';
import {
  loadCredentials, saveCredentials, getOrCreateDeviceId,
  clearCredentials, requestPersistence
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

  private readonly CACHE_KEY = 'tablero_urgencias_cache';

  ngOnInit(): void {
    // Solicitar almacenamiento persistente (Chrome kiosk lo concede automáticamente)
    requestPersistence();

    // Iniciar la detección de modo con persistencia multi-capa
    this.initializeDevice();

    // Carrusel siempre activo
    this.slideInterval = setInterval(() => {
      this.currentSlide.set((this.currentSlide() + 1) % this.slides.length);
    }, 10_000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    if (this.slideInterval) clearInterval(this.slideInterval);
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
    if (!deviceId) {
      this.continueWithoutSecret();
      return;
    }

    const url = `${environment.URL_SERVICIOS}/public/tableros/urgencias/reconnect`;

    this.http.post<{
      success: boolean;
      device_secret?: string;
      name?: string;
      sede?: string;
    }>(url, { device_id: deviceId }).subscribe({
      next: async (res) => {
        if (res.success && res.device_secret) {
          // Reconectado: guardar en las 3 capas
          await saveCredentials({
            deviceSecret: res.device_secret,
            deviceName: res.name ?? '',
            deviceId: deviceId,
          });
          this.deviceName.set(res.name ?? '');
          this.mode.set('active');
          this.loadFromCache();
          this.connectSSE(res.device_secret);
          this.cargarLogoEmpresa();
        } else {
          this.continueWithoutSecret();
        }
      },
      error: () => this.continueWithoutSecret()
    });
  }

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
    // Apache + PHP-FPM bufferea SSE, así que mantenemos polling pero a 15s
    // para que los cambios de la view se reflejen rápido.
    let url: string;
    if (deviceSecret) {
      url = `${environment.URL_SERVICIOS}/public/tableros/urgencias/data?d=${deviceSecret}`;
    } else if (legacyToken) {
      url = `${environment.URL_SERVICIOS}/public/tableros/urgencias/data?token=${legacyToken}`;
    } else {
      return;
    }

    // Cargar datos inmediatamente
    this.fetchPublicData(url);

    // Polling cada 15 segundos — cambios en la view se reflejan en <15s
    this.refreshInterval = setInterval(() => this.fetchPublicData(url), 15_000);
  }

  private fetchPublicData(url: string): void {
    this.http.get<{ success: boolean; data: UnidadUrgencias[]; sede?: string; timestamp?: string; error?: string }>(url).subscribe({
      next: (res) => {
        if (res.success && res.data?.length > 0) {
          this.agruparPorSede(res.data);
          this.lastUpdate.set(new Date());
          this.connected.set(true);
          this.isLoading.set(false);
          if (res.sede) this.sucursalUsuario.set(res.sede);
          this.saveToCache(res.data);
        }
      },
      error: (err) => {
        if (err.status === 401) {
          // Dispositivo revocado: limpiar TODAS las capas y volver a pantalla de código
          clearCredentials();
          if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
          }
          this.mode.set('pairing');
          this.pairingError.set('El dispositivo fue desactivado. Solicite un nuevo código al administrador.');
          return;
        }
        // Cualquier otro error: no mostrar nada, mantener último dato
        this.connected.set(false);
      }
    });
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
          if (res.sucursal) this.sucursalUsuario.set(res.sucursal);
        }
        this.isLoading.set(false);
      },
      error: () => { this.isLoading.set(false); }
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
