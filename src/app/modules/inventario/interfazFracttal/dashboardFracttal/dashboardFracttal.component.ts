import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

// PrimeNG Imports
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ChartModule } from 'primeng/chart';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  selector: 'app-dashboard-fracttal',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ButtonModule,
    ToastModule,
    CardModule,
    TableModule,
    TagModule,
    SkeletonModule,
    ChartModule,
    DropdownModule,
    CalendarModule,
    InputTextModule
  ],
  providers: [MessageService],
  templateUrl: './dashboardFracttal.component.html',
  styleUrl: './dashboardFracttal.component.css'
})
export class DashboardFracttalComponent implements OnInit {
  
  // Estados de carga
  isLoadingStats = false;
  isLoadingChart = false;
  isLoadingTable = false;
  
  // Estadísticas
  stats = {
    totalEquipos: 0,
    sincronizados: 0,
    pendientes: 0,
    errores: 0
  };
  
  // Datos para gráficos
  chartData: any = {};
  chartOptions: any = {};
  
  // Datos de tabla
  equipos: any[] = [];
  totalRecords = 0;
  
  // Filtros
  selectedEstado: string | null = null;
  selectedFecha: Date | null = null;
  searchTerm = '';
  
  // Opciones de filtros
  estadosOptions = [
    { label: 'Todos', value: null },
    { label: 'Sincronizado', value: 'sincronizado' },
    { label: 'Pendiente', value: 'pendiente' },
    { label: 'Error', value: 'error' }
  ];

  constructor(
    private messageService: MessageService
  ) {
    this.initChartOptions();
  }

  ngOnInit(): void {
    this.loadStats();
    this.loadChartData();
    this.loadEquipos();
  }

  /**
   * Inicializar opciones del gráfico
   */
  private initChartOptions(): void {
    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            padding: 15
          }
        }
      }
    };
  }

  /**
   * Cargar estadísticas
   */
  loadStats(): void {
    this.isLoadingStats = true;
    
    // Simulación de carga de datos
    setTimeout(() => {
      this.stats = {
        totalEquipos: 150,
        sincronizados: 120,
        pendientes: 25,
        errores: 5
      };
      this.isLoadingStats = false;
    }, 1000);
  }

  /**
   * Cargar datos del gráfico
   */
  loadChartData(): void {
    this.isLoadingChart = true;
    
    // Simulación de carga de datos
    setTimeout(() => {
      this.chartData = {
        labels: ['Sincronizados', 'Pendientes', 'Errores'],
        datasets: [
          {
            data: [120, 25, 5],
            backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
            hoverBackgroundColor: ['#059669', '#d97706', '#dc2626']
          }
        ]
      };
      this.isLoadingChart = false;
    }, 1200);
  }

  /**
   * Cargar equipos
   */
  loadEquipos(): void {
    this.isLoadingTable = true;
    
    // Simulación de carga de datos
    setTimeout(() => {
      this.equipos = [
        {
          id: 1,
          nombre: 'PC-001',
          tipo: 'Desktop',
          estado: 'sincronizado',
          fechaSincronizacion: new Date(),
          glpiId: 'GLPI-001',
          fracttalId: 'FRAC-001'
        },
        {
          id: 2,
          nombre: 'PC-002',
          tipo: 'Laptop',
          estado: 'pendiente',
          fechaSincronizacion: null,
          glpiId: 'GLPI-002',
          fracttalId: null
        },
        {
          id: 3,
          nombre: 'PC-003',
          tipo: 'Desktop',
          estado: 'error',
          fechaSincronizacion: new Date(),
          glpiId: 'GLPI-003',
          fracttalId: null
        }
      ];
      this.totalRecords = this.equipos.length;
      this.isLoadingTable = false;
    }, 1500);
  }

  /**
   * Sincronizar equipos
   */
  sincronizarEquipos(): void {
    this.messageService.add({
      severity: 'info',
      summary: 'Sincronización',
      detail: 'Iniciando sincronización de equipos...',
      life: 3000
    });
    
    // Aquí iría la lógica de sincronización
    setTimeout(() => {
      this.messageService.add({
        severity: 'success',
        summary: 'Éxito',
        detail: 'Equipos sincronizados correctamente',
        life: 3000
      });
      this.loadStats();
      this.loadChartData();
      this.loadEquipos();
    }, 2000);
  }

  /**
   * Aplicar filtros
   */
  aplicarFiltros(): void {
    this.loadEquipos();
  }

  /**
   * Limpiar filtros
   */
  limpiarFiltros(): void {
    this.selectedEstado = null;
    this.selectedFecha = null;
    this.searchTerm = '';
    this.loadEquipos();
  }

  /**
   * Obtener clase de severidad según estado
   */
  getSeverity(estado: string): 'success' | 'warn' | 'danger' | 'info' {
    switch (estado) {
      case 'sincronizado':
        return 'success';
      case 'pendiente':
        return 'warn';
      case 'error':
        return 'danger';
      default:
        return 'info';
    }
  }

  /**
   * Obtener etiqueta de estado
   */
  getEstadoLabel(estado: string): string {
    switch (estado) {
      case 'sincronizado':
        return 'Sincronizado';
      case 'pendiente':
        return 'Pendiente';
      case 'error':
        return 'Error';
      default:
        return estado;
    }
  }
}
