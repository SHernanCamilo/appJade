import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { RippleModule } from 'primeng/ripple';

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
        { name: 'Dashboard', route: '/talentoHumano/turnos/dashboard', icon: 'bi-speedometer2' },
        { name: 'Plantillas', route: '/talentoHumano/turnos/plantillas', icon: 'bi-clock' }
      ]
    }
  ];
}
