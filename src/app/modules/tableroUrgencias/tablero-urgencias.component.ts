import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

interface SedeData {
  nombre: string;
  unidades: UnidadData[];
}

interface UnidadData {
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

@Component({
  selector: 'app-tablero-urgencias',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tablero-urgencias.component.html',
  styleUrl: './tablero-urgencias.component.css'
})
export class TableroUrgenciasComponent implements OnInit, OnDestroy {
  sedes: SedeData[] = [];
  sedeSeleccionada: SedeData | null = null;
  unidadSeleccionada: UnidadData | null = null;
  isLoading = true;
  error = '';
  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  // Logo Medilaser (URL pública del logo corporativo)
  readonly logoUrl = 'assets/media/logos/jade-one-horizontal-dark.png';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.cargarDatos();
    // Auto-refresh cada 30 segundos
    this.refreshInterval = setInterval(() => this.cargarDatos(), 30000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  cargarDatos(): void {
    const url = `${environment.URL_SERVICIOS}/tablero-urgencias`;
    this.http.get<{ success: boolean; data: UnidadData[] }>(url).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.agruparPorSede(res.data);
        }
        this.isLoading = false;
      },
      error: () => {
        this.error = 'No se pudo cargar el tablero de urgencias.';
        this.isLoading = false;
      }
    });
  }

  private agruparPorSede(data: UnidadData[]): void {
    const sedeMap = new Map<string, UnidadData[]>();
    for (const row of data) {
      const key = row.Sede ?? 'Sin Sede';
      if (!sedeMap.has(key)) sedeMap.set(key, []);
      sedeMap.get(key)!.push(row);
    }
    this.sedes = [...sedeMap.entries()].map(([nombre, unidades]) => ({ nombre, unidades }));
  }

  seleccionarSede(sede: SedeData): void {
    this.sedeSeleccionada = this.sedeSeleccionada === sede ? null : sede;
    this.unidadSeleccionada = null;
  }

  seleccionarUnidad(unidad: UnidadData): void {
    this.unidadSeleccionada = unidad;
  }

  volver(): void {
    this.unidadSeleccionada = null;
  }

  volverASedes(): void {
    this.unidadSeleccionada = null;
    this.sedeSeleccionada = null;
  }

  formatMinutos(minutos: number): string {
    if (!minutos || minutos <= 0) return '0 min';
    if (minutos < 60) return `${minutos} min`;
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }
}
