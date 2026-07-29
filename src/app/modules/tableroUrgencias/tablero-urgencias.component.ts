import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
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

@Component({
  selector: 'app-tablero-urgencias',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tablero-urgencias.component.html',
  styleUrl: './tablero-urgencias.component.css'
})
export class TableroUrgenciasComponent implements OnInit, OnDestroy {
  readonly sedes = signal<SedeAgrupada[]>([]);
  readonly sedeSeleccionada = signal<SedeAgrupada | null>(null);
  readonly unidadSeleccionada = signal<UnidadUrgencias | null>(null);
  readonly isLoading = signal(true);
  readonly error = signal('');
  readonly lastUpdate = signal<Date | null>(null);
  readonly sucursalUsuario = signal<string | null>(null);
  readonly logoEmpresa = signal<string>('assets/media/logos/jade-one-horizontal-dark.png');

  // Carrusel — banners de triage individuales
  readonly slides = [
    'assets/media/tablero-urgencias/Triage 1.JPG',
    'assets/media/tablero-urgencias/Triage 2.JPG',
    'assets/media/tablero-urgencias/Triage 3.JPG',
    'assets/media/tablero-urgencias/Triage 4.JPG',
    'assets/media/tablero-urgencias/Triage 5 .JPG',
  ];
  readonly currentSlide = signal(0);

  readonly totalPacientes = computed(() => {
    const u = this.unidadSeleccionada();
    return u ? u.PacientesEsperaTriage + u.PacientesEsperaConsulta : 0;
  });

  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  private slideInterval: ReturnType<typeof setInterval> | null = null;
  private readonly apiUrl = `${environment.URL_SERVICIOS}/tableros/urgencias`;

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.cargarDatos();
    this.cargarLogoEmpresa();
    this.refreshInterval = setInterval(() => this.cargarDatos(), 30_000);
    this.slideInterval = setInterval(() => {
      this.currentSlide.set((this.currentSlide() + 1) % this.slides.length);
    }, 10_000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    if (this.slideInterval) clearInterval(this.slideInterval);
  }

  cargarDatos(): void {
    this.http.get<{ success: boolean; data: UnidadUrgencias[]; sucursal?: string }>(this.apiUrl).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.agruparPorSede(res.data);
          this.lastUpdate.set(new Date());
          if (res.sucursal) this.sucursalUsuario.set(res.sucursal);
        }
        this.isLoading.set(false);
        this.error.set('');
      },
      error: (err) => {
        this.error.set(err.status === 403
          ? 'No tiene permisos para ver el tablero.'
          : 'No se pudo cargar el tablero de urgencias.');
        this.isLoading.set(false);
      }
    });
  }

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
    // Intentar cargar logo de la empresa desde la sesión del usuario
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
