import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, signal, computed, inject, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
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

/**
 * Tablero de Urgencias — dos modos de operación:
 *
 * 1. PÚBLICO (TV sin login):
 *    URL: /tableroUrgencias?t=TOKEN_SECRETO
 *    Usa EventSource (SSE) — el servidor push datos cada 30s.
 *    No necesita JWT. Si el SSE falla, muestra el último dato del cache.
 *    No muestra errores técnicos: solo el logo hasta que se recupere.
 *
 * 2. PRIVADO (usuario logueado desde la plataforma):
 *    URL: /tableroUrgencias (sin token)
 *    Usa HTTP polling con JWT cada 30s (comportamiento original).
 */
@Component({
  selector: 'app-tablero-urgencias',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tablero-urgencias.component.html',
  styleUrl: './tablero-urgencias.component.css'
})
export class TableroUrgenciasComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly zone = inject(NgZone);

  readonly sedes = signal<SedeAgrupada[]>([]);
  readonly sedeSeleccionada = signal<SedeAgrupada | null>(null);
  readonly unidadSeleccionada = signal<UnidadUrgencias | null>(null);
  readonly isLoading = signal(true);
  readonly lastUpdate = signal<Date | null>(null);
  readonly sucursalUsuario = signal<string | null>(null);
  readonly logoEmpresa = signal<string>('assets/media/logos/jade-one-horizontal-dark.png');
  readonly connected = signal(true);

  // Carrusel — banners de triage individuales
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

  /** Modo público (token en URL) o privado (usuario logueado) */
  private publicToken: string | null = null;
  private eventSource: EventSource | null = null;
  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  private slideInterval: ReturnType<typeof setInterval> | null = null;

  private readonly CACHE_KEY = 'tablero_urgencias_cache';

  ngOnInit(): void {
    // Detectar modo: si hay token en la URL, es público (TV)
    this.publicToken = this.route.snapshot.queryParamMap.get('t');

    if (this.publicToken) {
      this.initPublicMode();
    } else {
      this.initPrivateMode();
    }

    // Carrusel de slides siempre activo
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
  // MODO PÚBLICO — SSE (TV sin login)
  // =========================================================================

  private initPublicMode(): void {
    // Cargar cache del navegador inmediatamente (la TV muestra algo mientras conecta)
    this.loadFromCache();
    this.cargarLogoEmpresa();
    this.connectSSE();
  }

  private connectSSE(): void {
    const url = `${environment.URL_SERVICIOS}/public/tableros/urgencias/stream?token=${this.publicToken}`;

    // EventSource se ejecuta fuera de NgZone para no disparar change detection en cada keep-alive
    this.zone.runOutsideAngular(() => {
      this.eventSource = new EventSource(url);

      this.eventSource.addEventListener('data', (event: MessageEvent) => {
        this.zone.run(() => this.handleSseData(event));
      });

      this.eventSource.addEventListener('reconnect', () => {
        // El servidor pide reconexión limpia (después de 1h)
        this.eventSource?.close();
        setTimeout(() => this.connectSSE(), 2000);
      });

      this.eventSource.onerror = () => {
        this.zone.run(() => {
          this.connected.set(false);
          // No mostrar error: la TV sigue mostrando el último dato del cache.
          // EventSource reconecta automáticamente (comportamiento del browser).
        });
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

        // Guardar en cache del navegador para resiliencia
        this.saveToCache(payload.data);
      }
      // Si success=false, no hacemos nada: la TV sigue mostrando el último dato
    } catch {
      // JSON parse error: ignorar, mantener pantalla actual
    }
  }

  private saveToCache(data: UnidadUrgencias[]): void {
    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify({
        data,
        timestamp: new Date().toISOString()
      }));
    } catch { /* localStorage lleno o no disponible */ }
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
    } catch { /* sin cache, esperar SSE */ }
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
      error: () => {
        // En modo privado tampoco mostramos errores técnicos al tablero
        this.isLoading.set(false);
      }
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
            next: (res) => {
              if (res.logo_url) this.logoEmpresa.set(res.logo_url);
            }
          });
        }
      }
    } catch { /* usar logo por defecto */ }
  }
}
