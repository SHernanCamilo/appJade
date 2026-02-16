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
        { name: 'Solicitudes de Anticipos', route: '/financiera/anticipos/solicitudes', icon: 'bi-file-earmark-text' }
      ]
    }
  ];
}
