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
  // Estado reactivo con signals
  readonly sedes = signal<SedeAgrupada[]>([]);
  readonly sedeSeleccionada = signal<SedeAgrupada | null>(null);
  readonly unidadSeleccionada = signal<UnidadUrgencias | null>(null);
  readonly isLoading = signal(true);
  readonly error = signal('');
  readonly lastUpdate = signal<Date | null>(null);
  readonly sucursalUsuario = signal<string | null>(null);

  // Computed
  readonly totalPacientes = computed(() => {
    const unidad = this.unidadSeleccionada();
    if (!unidad) return 0;
    return unidad.PacientesEsperaTriage + unidad.PacientesEsperaConsulta;
  });

  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  private readonly apiUrl = `${environment.URL_SERVICIOS}/tablero-urgencias`;

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.cargarDatos();
    this.refreshInterval = setInterval(() => this.cargarDatos(), 30_000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  cargarDatos(): void {
    // Si hay token, enviarlo para que el backend filtre por sucursal
    const token = localStorage.getItem('token') || '';
    const url = token
      ? `${this.apiUrl}?token=${encodeURIComponent(token)}`
      : this.apiUrl;

    this.http.get<{ success: boolean; data: UnidadUrgencias[]; sucursal?: string; filtered?: boolean }>(url).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.agruparPorSede(res.data);
          this.lastUpdate.set(new Date());
          if (res.sucursal) {
            this.sucursalUsuario.set(res.sucursal);
          }
        }
        this.isLoading.set(false);
        this.error.set('');
      },
      error: () => {
        this.error.set('No se pudo cargar el tablero de urgencias.');
        this.isLoading.set(false);
      }
    });
  }

  seleccionarSede(sede: SedeAgrupada): void {
    if (this.sedeSeleccionada() === sede) {
      this.sedeSeleccionada.set(null);
    } else {
      this.sedeSeleccionada.set(sede);
      this.unidadSeleccionada.set(null);
    }
  }

  seleccionarUnidad(unidad: UnidadUrgencias): void {
    this.unidadSeleccionada.set(unidad);
  }

  volver(): void {
    this.unidadSeleccionada.set(null);
  }

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
}
