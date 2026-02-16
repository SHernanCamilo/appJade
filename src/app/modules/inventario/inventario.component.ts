import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { RippleModule } from 'primeng/ripple';

@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [CommonModule, RouterModule, CardModule, RippleModule],
  templateUrl: './inventario.component.html',
  styleUrl: './inventario.component.css'
})
export class InventarioComponent {
  dashboardCards = [
    {
      title: 'Matriz de Obsolescencia',
      icon: 'bi-grid-3x3-gap',
      description: 'Gestión y análisis de obsolescencia de equipos',
      color: 'primary',
      items: [
        { name: 'Dashboard', route: '/inventario/matrizObsolescencia/dashboardMaObsolescencia', icon: 'bi-speedometer2' },
        { name: 'Parámetros de Matriz', route: '/inventario/matrizObsolescencia/parametrosMaObsolescencia', icon: 'bi-sliders' }
      ]
    },
    {
      title: 'Interfaz Fracttal',
      icon: 'bi-arrow-left-right',
      description: 'Sincronización de equipos entre Fracttal y GLPI',
      color: 'success',
      items: [
        { name: 'Dashboard Fracttal-GLPI', route: '/inventario/interfazFracttal/dashboardFracttal', icon: 'bi-diagram-3' }
      ]
    }
  ];
}
