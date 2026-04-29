import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { RippleModule } from 'primeng/ripple';

@Component({
  selector: 'app-contabilidad',
  standalone: true,
  imports: [CommonModule, RouterModule, CardModule, RippleModule],
  templateUrl: './talentoHumano.component.html',
  styleUrl: './talentoHumano.component.css'
})
export class talentoHumanoComponent {
  dashboardCards = [
    {
      title: 'Personas',
      icon: 'bi-people',
      description: 'Gestión de terceros y personas',
      color: 'primary',
      items: [
        { name: 'Dashboard de Personas', route: '/contabilidad/personas/dashboard', icon: 'bi-speedometer2' },
        { name: 'Terceros', route: '/contabilidad/personas/terceros', icon: 'bi-briefcase' },
        { name: 'Personas', route: '/contabilidad/personas/personas', icon: 'bi-person' }
      ]
    }
  ];
}
