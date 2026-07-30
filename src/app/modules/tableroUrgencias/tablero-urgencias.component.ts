import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, signal, computed, inject, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { environment } from '../../environments/environment';

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
  private readonly zone = inject(NgZone);

  // Estado del tablero
  readonly mode = signal<TableroMode>('pairing');
  readonly sedes = signal<SedeAgrupada[]>([]);
  readonly sedeSeleccionada = signal<SedeAgrupada | null>(null);
  readonly unidadSeleccionada = signal<UnidadUrgencias | null>(null);
  readonly isLoading = signal(true);
  readonly lastUpdate = signal<Date | null>(null);
  readonly sucursalUsuario = signal<string | null>(null);
  readonly logoEmpresa = signal<string>('assets/media/logos/jade-one-horizontal-dark.png');
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

  private eventSource: EventSource | null = null;
  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  private slideInterval: ReturnType<typeof setInterval> | null = null;

  private readonly DEVICE_SECRET_KEY = 'tablero_device_secret';
  private readonly DEVICE_NAME_KEY = 'tablero_device_name';
  private readonly CACHE_KEY = 'tablero_urgencias_cache';

  ngOnInit(): void {
    this.determineMode();

    // Carrusel siempre activo
    this.slideInterval = setInterval(() => {
      this.currentSlide.set((this.currentSlide() + 1) % this.slides.length);
    }, 10_000);
  }

  ngOnDestroy(): void {
    this.eventSource?.close();
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    if (this.slideInterval) clearInterval(this.slideInterval);
  }

  // =========================================================================
  // DETERMINAR MODO
  // =========================================================================

  private determineMode(): void {
    // Si ya tiene device_secret guardado → modo activo (reconecta solo)
    const savedSecret = localStorage.getItem(this.DEVICE_SECRET_KEY);
    if (savedSecret) {
      this.deviceName.set(localStorage.getItem(this.DEVICE_NAME_KEY) ?? '');
      this.mode.set('active');
      this.loadFromCache();
      this.connectSSE(savedSecret);
      this.cargarLogoEmpresa();
      return;
    }

    // Si hay token legacy en URL → modo activo con token
    const legacyToken = this.route.snapshot.queryParamMap.get('t');
    if (legacyToken && legacyToken.length >= 10) {
      this.mode.set('active');
      this.loadFromCache();
      this.connectSSE(null, legacyToken);
      this.cargarLogoEmpresa();
      return;
    }

    // Si el usuario está logueado → modo privado (polling con JWT)
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

    // Sin secret ni login → pantalla de emparejamiento
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
    }>(url, { code }).subscribe({
      next: (res) => {
        this.pairingLoading.set(false);

        if (res.success && res.device_secret) {
          // Emparejado: guardar secret y pasar a modo activo
          localStorage.setItem(this.DEVICE_SECRET_KEY, res.device_secret);
          localStorage.setItem(this.DEVICE_NAME_KEY, res.name ?? '');
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
  // MODO ACTIVO — SSE (TV emparejada)
  // =========================================================================

  private connectSSE(deviceSecret: string | null, legacyToken?: string): void {
    let url: string;
    if (deviceSecret) {
      url = `${environment.URL_SERVICIOS}/public/tableros/urgencias/stream?d=${deviceSecret}`;
    } else if (legacyToken) {
      url = `${environment.URL_SERVICIOS}/public/tableros/urgencias/stream?token=${legacyToken}`;
    } else {
      return;
    }

    this.zone.runOutsideAngular(() => {
      this.eventSource = new EventSource(url);

      this.eventSource.addEventListener('data', (event: MessageEvent) => {
        this.zone.run(() => this.handleSseData(event));
      });

      this.eventSource.addEventListener('reconnect', () => {
        this.eventSource?.close();
        setTimeout(() => this.connectSSE(deviceSecret, legacyToken), 2000);
      });

      this.eventSource.onerror = () => {
        this.zone.run(() => this.connected.set(false));
      };

      this.eventSource.onopen = () => {
        this.zone.run(() => this.connected.set(true));
      };
    });
  }

  private handleSseData(event: MessageEvent): void {
    try {
      const payload = JSON.parse(event.data);

      if (payload.success && payload.data) {
        this.agruparPorSede(payload.data);
        this.lastUpdate.set(new Date());
        this.connected.set(true);
        this.isLoading.set(false);
        if (payload.sede) this.sucursalUsuario.set(payload.sede);
        this.saveToCache(payload.data);
      }
    } catch { /* ignorar errores de parse */ }
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
    this.refreshInterval = setInterval(() => this.cargarDatos(), 30_000);
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

  private agruparPorSede(data: UnidadUrgencias[]): void {
    const map = new Map<string, UnidadUrgencias[]>();
    for (const row of data) {
      const key = row.Sede ?? 'Sin Sede';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    this.sedes.set([...map.entries()].map(([nombre, unidades]) => ({ nombre, unidades })));
  }

  private cargarLogoEmpresa(): void {
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
    } catch { /* logo por defecto */ }
  }
}
