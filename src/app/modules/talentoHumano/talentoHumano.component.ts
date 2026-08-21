import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { RippleModule } from 'primeng/ripple';
import { SidebarService } from '../../complements/shared/sidebar/sidebar.service';
import { ModuleDashboardCard, ModuleDashboardService } from '../../core/services/module-dashboard.service';

@Component({
  selector: 'app-talento-humano',
  standalone: true,
  imports: [CommonModule, RouterModule, CardModule, RippleModule],
  templateUrl: './talentoHumano.component.html',
  styleUrl: './talentoHumano.component.css'
})
export class talentoHumanoComponent {
  dashboardCards = [
    {
      title: 'Eventos',
      icon: 'bi-calendar-event',
      description: 'Gestión de eventos y novedades',
      color: 'primary',
      items: [
        { name: 'Dashboard', route: '/talentoHumano/eventos/dashboard', icon: 'bi-speedometer2' },
        { name: 'Cargue', route: '/talentoHumano/eventos/cargue', icon: 'bi-upload' },
        { name: 'Parámetros', route: '/talentoHumano/eventos/parametros', icon: 'bi-gear' }
      ]
    },
    {
      title: 'Cuadro de Turnos',
      icon: 'bi-calendar-week',
      description: 'Gestión de horarios y turnos',
      color: 'secondary',
      items: [
        { name: 'Cuadro por Empleado', route: '/talentoHumano/turnos/cuadro-empleado', icon: 'bi-calendar3' },
        { name: 'Dashboard', route: '/talentoHumano/turnos/dashboard', icon: 'bi-speedometer2' },
        { name: 'Plantillas', route: '/talentoHumano/turnos/plantillas', icon: 'bi-clock' }
      ]
    }
  ];
}
