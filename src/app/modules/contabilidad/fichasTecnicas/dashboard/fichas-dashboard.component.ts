import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';

import { BandejaFichas, DashboardFichas } from '../models/ficha.model';
import { FichasTecnicasService } from '../services/fichas-tecnicas.service';
import { interpretarErrorFicha } from '../shared/ficha-error.util';
import { AlertasVencimientoComponent } from './components/alertas-vencimiento.component';
import { GraficoDistribucionComponent } from './components/grafico-distribucion.component';
import { KpiCardsComponent } from './components/kpi-cards.component';

/**
 * Contenedor (smart) del dashboard de Fichas Técnicas.
 *
 * Solo orquesta: carga los datos y los reparte a los componentes
 * presentacionales. Reemplaza `generador/index.php` y `aprobador/index.php`,
 * donde los KPIs se calculaban con consultas sueltas embebidas en el HTML.
 *
 * El alcance de visibilidad (propias / sucursal / todas) lo resuelve el backend
 * a partir del JWT y los roles, así que aquí no hay filtros en cascada.
 */
@Component({
  selector: 'app-fichas-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    ToastModule,
    KpiCardsComponent,
    AlertasVencimientoComponent,
    GraficoDistribucionComponent,
  ],
  providers: [MessageService],
  templateUrl: './fichas-dashboard.component.html',
  styleUrl: './fichas-dashboard.component.css',
})
export class FichasDashboardComponent {
  private readonly validacion = inject(FichasTecnicasService);
  private readonly router = inject(Router);
  private readonly mensajes = inject(MessageService);

  protected readonly datos = signal<DashboardFichas | null>(null);
  protected readonly cargando = signal<boolean>(true);

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);

    this.validacion.dashboard().subscribe({
      next: (datos) => {
        this.datos.set(datos);
        this.cargando.set(false);
      },
      error: (error: unknown) => {
        this.cargando.set(false);
        const { mensaje } = interpretarErrorFicha(error);
        this.mensajes.add({
          severity: 'error',
          summary: 'No se pudieron cargar los indicadores',
          detail: mensaje,
          life: 6000,
        });
      },
    });
  }

  protected abrirBandeja(bandeja: BandejaFichas): void {
    void this.router.navigate(['/contabilidad/fichas-tecnicas/bandeja', bandeja]);
  }

  protected abrirFicha(id: number): void {
    void this.router.navigate(['/contabilidad/fichas-tecnicas/ficha', id]);
  }

  protected nuevaFicha(): void {
    void this.router.navigate(['/contabilidad/fichas-tecnicas/nueva']);
  }
}
