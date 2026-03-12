import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

// PrimeNG Imports
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-dashboard-personas',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ButtonModule,
    ToastModule
  ],
  providers: [MessageService],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardPersonasComponent implements OnInit {

  constructor(
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    // Inicialización
  }

  /**
   * Cargar estadísticas
   */
  loadStats(): void {
    this.showInfo('Actualizando datos...');
    // TODO: Implementar llamada al servicio
  }

  /**
   * Mostrar mensaje de información
   */
  private showInfo(message: string): void {
    this.messageService.add({
      severity: 'info',
      summary: 'Información',
      detail: message,
      life: 3000
    });
  }
}
