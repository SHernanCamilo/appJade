import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { RippleModule } from 'primeng/ripple';

@Component({
  selector: 'app-financiera',
  standalone: true,
  imports: [CommonModule, RouterModule, CardModule, RippleModule],
  templateUrl: './financiera.component.html',
  styleUrl: './financiera.component.css'
})
export class FinancieraComponent {
  dashboardCards = [
    {
      title: 'Anticipos',
      icon: 'bi-cash-coin',
      description: 'Gestión de solicitudes y aprobación de anticipos',
      color: 'primary',
      items: [
        { name: 'Solicitudes', route: '/financiera/anticipos/solicitudes', icon: 'bi-file-earmark-text' },
        { name: 'Parámetros', route: '/financiera/anticipos/parametros', icon: 'bi-sliders' },
        { name: 'Configuración de Flujos', route: '/financiera/anticipos/configuracion', icon: 'bi-gear' }
      ]
    }
  ];
}
