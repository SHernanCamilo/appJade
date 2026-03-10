import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../auth/auth.service';
import { MatrizObsActivosService, ActivoMatriz, FiltrosActivos } from '../services/matriz-obs-activos.service';
import { MatrizObsParametrosService } from '../services/matriz-obs-parametros.service';
import { ExcelExportService, ExcelColumn } from '../../../../core/services/excel-export.service';

// PrimeNG Imports
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { SkeletonModule } from 'primeng/skeleton';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { ChartModule } from 'primeng/chart';
import { ProgressBarModule } from 'primeng/progressbar';
import { CalendarModule } from 'primeng/calendar';
import { TabViewModule } from 'primeng/tabview';
import { InputNumberModule } from 'primeng/inputnumber';

interface EmpresaPermiso {
  empresa_id: number;
  sucursal_id: number | null;
  sede_id: number | null;
  recursivo: boolean;
}

interface MatrizItem {
  campo: string;
  valor: any;
  tipo?: 'texto' | 'fecha' | 'puntaje' | 'valoracion';
  icono?: string;
  destacado?: boolean;
}

@Component({
  selector: 'app-dashboard-ma-obsolescencia',
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
    InputTextModule,
    InputNumberModule,
    DropdownModule,
    SkeletonModule,
    DialogModule,
    TooltipModule,
    ChartModule,
    ProgressBarModule,
    CalendarModule,
    TabViewModule
  ],
  providers: [MessageService],
  templateUrl: './dashboardMaObsolescencia.component.html',
  styleUrl: './dashboardMaObsolescencia.component.css'
})
export class DashboardMaObsolescenciaComponent implements OnInit, OnDestroy {
  
  // Data
  activos: ActivoMatriz[] = [];
  empresasPermisos: EmpresaPermiso[] = [];

  // Sincronización
  isSyncing = false;
  
  // Loading states
  isLoading = false;
  isLoadingStats = false;
  isLoadingCards = false;
  isCalculatingValues = false;
  
  // Pagination
  totalRecords = 0;
  currentPage = 1;
  rowsPerPage = 10;
  
  // Filters
  searchTerm = '';
  selectedEmpresa: number | null = null;
  selectedSucursal: number | null = null;
  selectedSede: number | null = null;
  
  // Filter options
  empresasOptions: any[] = [];
  sucursalesOptions: any[] = [];
  sedesOptions: any[] = [];
  
  // Data for filters
  empresasList: any[] = [];
  sucursalesList: any[] = [];
  sedesList: any[] = [];
  
  // Stats
  stats = {
    totalActivos: 0
  };

  // Estadísticas por estado
  estadisticasPorEstado = {
    optimo: 0,
    funcional: 0,
    potencial: 0,
    obsoleto: 0
  };

  // Estadísticas por tipo para gráfico circular
  estadisticasPorTipo: any[] = [];
  isLoadingGrafico = false;

  // Datos para el gráfico de Chart.js
  chartData: any = {};
  chartOptions: any = {};

  // Datos para el gráfico de barras por ubicación
  barChartData: any = {};
  barChartOptions: any = {};
  estadisticasPorUbicacion: any[] = [];
  isLoadingBarChart = false;

  // Modal Matriz Completa
  mostrarMatrizCompleta = false;
  activoSeleccionado: ActivoMatriz | null = null;
  matrizCompleta: MatrizItem[] = [];
  
  // Campos editables del modal
  camposEditables = {
    ubicacion: '',
    tipo_unidad: '',
    fecha_compra: '',
    modalidad: '',
    proveedor: '',
    max_ram: null as number | null
  };
  
  // Estado de guardado
  isSavingMatriz = false;

  // Modal de selección de formato de exportación
  mostrarModalExportacion = false;

  // Modal Matriz Completa Todos
  mostrarMatrizCompletaTodos = false;
  activosMatrizCompleta: ActivoMatriz[] = [];
  isLoadingMatrizCompleta = false;
  totalRecordsCompleta = 0;
  currentPageCompleta = 1;
  rowsPerPageCompleta = 10;
  searchTermTodos = '';
  
  // Edición de celdas en tabla
  clonedActivos: { [s: string]: ActivoMatriz } = {};
  editingMaxRamId: number | null = null;

  // Tab activo
  activeTabIndex = 0;

  // Modal de equipos filtrados
  mostrarModalEquipos = false;
  equiposFiltrados: any[] = [];
  tituloModalEquipos = '';
  isLoadingModalEquipos = false;
  totalRecordsModal = 0;
  currentPageModal = 1;
  rowsPerPageModal = 10;
  filtroActualModal: any = {};

  constructor(
    private authService: AuthService,
    private activosService: MatrizObsActivosService,
    private messageService: MessageService,
    private parametrosService: MatrizObsParametrosService,
    private excelExportService: ExcelExportService
  ) {
    this.initChartOptions();
    this.initBarChartOptions();
  }

  ngOnInit(): void {
    this.loadUserPermissions();
    this.loadActivos();
    this.loadStats(); // Esto carga todo incluyendo las empresas para los filtros
  }

  /**
   * Inicializar opciones del gráfico de barras
   */
  private initBarChartOptions(): void {
    try {
      this.barChartOptions = {
        indexAxis: 'y', // Barras horizontales
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              usePointStyle: true,
              padding: 15,
              font: {
                size: 11
              }
            }
          },
          tooltip: {
            callbacks: {
              title: (context: any) => {
                return context[0].label;
              },
              label: (context: any) => {
                const datasetLabel = context.dataset.label || '';
                const value = context.parsed.x || 0;
                return `${datasetLabel}: ${value} equipos`;
              }
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            beginAtZero: true,
            ticks: {
              font: {
                size: 10
              }
            }
          },
          y: {
            stacked: true,
            ticks: {
              font: {
                size: 10
              }
            }
          }
        },
        onClick: (event: any, activeElements: any[]) => {
          if (activeElements && activeElements.length > 0) {
            const index = activeElements[0].index;
            if (this.estadisticasPorUbicacion[index]) {
              this.abrirModalEquiposPorUbicacion(this.estadisticasPorUbicacion[index].ubicacion);
            }
          }
        }
      };
    } catch (error) {
      console.error('Error inicializando opciones del gráfico de barras:', error);
      this.barChartOptions = {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false
      };
    }
  }

  /**
   * Actualizar datos del gráfico de barras
   */
  private updateBarChartData(): void {
    if (this.estadisticasPorUbicacion.length === 0) {
      this.barChartData = {};
      return;
    }

    const ubicaciones = this.estadisticasPorUbicacion.map(item => item.ubicacion);
    
    this.barChartData = {
      labels: ubicaciones,
      datasets: [
        {
          label: 'Óptimo',
          data: this.estadisticasPorUbicacion.map(item => item.distribucion.optimo),
          backgroundColor: '#10B981',
          borderColor: '#10B981',
          borderWidth: 1
        },
        {
          label: 'Funcional',
          data: this.estadisticasPorUbicacion.map(item => item.distribucion.funcional),
          backgroundColor: '#3B82F6',
          borderColor: '#3B82F6',
          borderWidth: 1
        },
        {
          label: 'Potencial',
          data: this.estadisticasPorUbicacion.map(item => item.distribucion.potencial),
          backgroundColor: '#F59E0B',
          borderColor: '#F59E0B',
          borderWidth: 1
        },
        {
          label: 'Obsoleto',
          data: this.estadisticasPorUbicacion.map(item => item.distribucion.obsoleto),
          backgroundColor: '#EF4444',
          borderColor: '#EF4444',
          borderWidth: 1
        }
      ]
    };
  }

  /**
   * Inicializar opciones del gráfico
   */
  private initChartOptions(): void {
    try {
      this.chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              usePointStyle: true,
              padding: 20,
              font: {
                size: 12
              }
            }
          },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const label = context.label || '';
                const value = context.parsed || 0;
                const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                return `${label}: ${value} equipos (${percentage}%)`;
              }
            }
          }
        },
        cutout: '60%',
        onClick: (event: any, activeElements: any[]) => {
          if (activeElements && activeElements.length > 0) {
            const index = activeElements[0].index;
            const principales = this.getTiposPrincipales();
            if (principales[index]) {
              this.abrirModalEquiposPorTipo(principales[index].tipo);
            }
          }
        }
      };
    } catch (error) {
      console.error('Error inicializando opciones del gráfico:', error);
      // Opciones básicas como fallback
      this.chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%'
      };
    }
  }

  /**
   * Actualizar datos del gráfico
   */
  private updateChartData(): void {
    if (this.estadisticasPorTipo.length === 0) {
      this.chartData = {};
      return;
    }

    const principales = this.getTiposPrincipales();
    
    this.chartData = {
      labels: principales.map(tipo => `${tipo.tipo} (${tipo.total})`),
      datasets: [
        {
          data: principales.map(tipo => tipo.total),
          backgroundColor: principales.map((_, index) => this.getColorForTipo(index)),
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverBorderWidth: 3
        }
      ]
    };
  }

  /**
   * Cargar permisos del usuario desde la sesión
   */
  private loadUserPermissions(): void {
    const currentUser = this.authService.currentUser;
    
    if (!currentUser) {
      this.showError('No se pudo obtener la información del usuario');
      return;
    }

    // Extraer permisos de empresas
    if (currentUser.empresas && Array.isArray(currentUser.empresas)) {
      this.empresasPermisos = currentUser.empresas.map((empresa: any) => {
        const pivot = empresa.pivot || {};
        return {
          empresa_id: empresa.id,
          sucursal_id: pivot.id_sucursal || null,
          sede_id: pivot.id_sede || null,
          recursivo: Boolean(pivot.recursivo)
        };
      });

      if (this.empresasPermisos.length === 0) {
        this.showInfo('Tienes acceso a todos los activos del sistema');
      }
    } else {
      this.empresasPermisos = [];
    }
  }

  /**
   * Cargar activos según permisos
   */
  loadActivos(): void {
    this.isLoading = true;

    const filtros: FiltrosActivos = {
      page: this.currentPage,
      per_page: this.rowsPerPage
    };

    if (this.searchTerm) {
      filtros.search = this.searchTerm;
    }

    if (this.selectedEmpresa) {
      filtros.empresa_id = this.selectedEmpresa;
    }

    if (this.selectedSucursal) {
      filtros.sucursal_id = this.selectedSucursal;
    }

    if (this.selectedSede) {
      filtros.sede_id = this.selectedSede;
    }

    this.activosService.getActivosPorPermisos(filtros).subscribe({
      next: (response) => {
        this.activos = response.data;
        this.totalRecords = response.total;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error cargando activos:', error);
        this.showError('Error al cargar los activos');
        this.isLoading = false;
        this.activos = [];
      }
    });
  }

  /**
   * Cargar estadísticas
   */
  loadStats(): void {
    this.isLoadingStats = true;
    this.isLoadingCards = true;
    
    // Cargar estadísticas por estado (que ahora calcula todo)
    this.loadEstadisticasPorEstado();
    
    this.isLoadingStats = false;
  }

  /**
   * Cargar estadísticas por estado de obsolescencia
   */
  private loadEstadisticasPorEstado(): void {
    const filtros: FiltrosActivos = {
      per_page: 9999
    };

    if (this.selectedEmpresa) {
      filtros.empresa_id = this.selectedEmpresa;
    }
    if (this.selectedSucursal) {
      filtros.sucursal_id = this.selectedSucursal;
    }
    if (this.selectedSede) {
      filtros.sede_id = this.selectedSede;
    }

    this.activosService.getActivosPorPermisos(filtros).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const activos = response.data;
          
          if (!this.selectedEmpresa && !this.selectedSucursal && !this.selectedSede) {
            this.cargarEmpresasDesdeActivos(activos);
          }
          
          this.estadisticasPorEstado = {
            optimo: activos.filter(a => a.puntaje >= 80).length,
            funcional: activos.filter(a => a.puntaje >= 60 && a.puntaje < 80).length,
            potencial: activos.filter(a => a.puntaje >= 40 && a.puntaje < 60).length,
            obsoleto: activos.filter(a => a.puntaje < 40).length
          };
          
          this.stats.totalActivos = activos.length;
          this.calcularEstadisticasPorTipo(activos);
          this.calcularEstadisticasPorUbicacion(activos);
          
          // Marcar como cargado
          this.isLoadingCards = false;
        }
      },
      error: (error) => {
        console.error('Error cargando estadísticas:', error);
        this.estadisticasPorEstado = {
          optimo: 0,
          funcional: 0,
          potencial: 0,
          obsoleto: 0
        };
        this.stats.totalActivos = 0;
        this.isLoadingCards = false;
      }
    });
  }

  /**
   * Cargar empresas desde los activos (para los dropdowns de filtros)
   */
  private cargarEmpresasDesdeActivos(activos: ActivoMatriz[]): void {
    const empresasMap = new Map<number, { id: number; nombre: string }>();
    
    activos.forEach(activo => {
      if (activo.empresa && activo.id_empresa) {
        if (!empresasMap.has(activo.id_empresa)) {
          empresasMap.set(activo.id_empresa, {
            id: activo.id_empresa,
            nombre: activo.empresa.nombre
          });
        }
      }
    });
    
    this.empresasList = Array.from(empresasMap.values())
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
    
    this.empresasOptions = this.empresasList.map(emp => ({
      label: emp.nombre,
      value: emp.id
    }));
  }

  /**
   * Calcular estadísticas por tipo de equipo localmente
   */
  private calcularEstadisticasPorTipo(activos: ActivoMatriz[]): void {
    this.isLoadingGrafico = true;

    const tipoMap = new Map<string, { total: number; optimo: number; funcional: number; potencial: number; obsoleto: number }>();
    
    activos.forEach(activo => {
      const tipo = activo.detalle?.tipo || 'Sin tipo';
      
      if (!tipoMap.has(tipo)) {
        tipoMap.set(tipo, { total: 0, optimo: 0, funcional: 0, potencial: 0, obsoleto: 0 });
      }
      
      const stats = tipoMap.get(tipo)!;
      stats.total++;
      
      if (activo.puntaje >= 80) stats.optimo++;
      else if (activo.puntaje >= 60) stats.funcional++;
      else if (activo.puntaje >= 40) stats.potencial++;
      else stats.obsoleto++;
    });
    
    this.estadisticasPorTipo = Array.from(tipoMap.entries()).map(([tipo, stats]) => ({
      tipo,
      total: stats.total,
      optimo: stats.optimo,
      funcional: stats.funcional,
      potencial: stats.potencial,
      obsoleto: stats.obsoleto
    }));
    
    this.estadisticasPorTipo.sort((a, b) => b.total - a.total);
    this.updateChartData();
    this.isLoadingGrafico = false;
  }

  /**
   * Calcular estadísticas por ubicación localmente
   */
  private calcularEstadisticasPorUbicacion(activos: ActivoMatriz[]): void {
    this.isLoadingBarChart = true;

    const ubicacionMap = new Map<string, { total: number; optimo: number; funcional: number; potencial: number; obsoleto: number }>();
    
    activos.forEach(activo => {
      let ubicacion = 'Sin empresa';
      
      if (activo.empresa) {
        ubicacion = activo.empresa.nombre;
        if (activo.sucursal) {
          ubicacion += ` - ${activo.sucursal.nombre}`;
        }
      }
      
      if (!ubicacionMap.has(ubicacion)) {
        ubicacionMap.set(ubicacion, { total: 0, optimo: 0, funcional: 0, potencial: 0, obsoleto: 0 });
      }
      
      const stats = ubicacionMap.get(ubicacion)!;
      stats.total++;
      
      if (activo.puntaje >= 80) stats.optimo++;
      else if (activo.puntaje >= 60) stats.funcional++;
      else if (activo.puntaje >= 40) stats.potencial++;
      else stats.obsoleto++;
    });
    
    this.estadisticasPorUbicacion = Array.from(ubicacionMap.entries()).map(([ubicacion, stats]) => ({
      ubicacion,
      total: stats.total,
      distribucion: {
        optimo: stats.optimo,
        funcional: stats.funcional,
        potencial: stats.potencial,
        obsoleto: stats.obsoleto
      }
    }));
    
    this.estadisticasPorUbicacion.sort((a, b) => b.total - a.total);
    this.updateBarChartData();
    this.isLoadingBarChart = false;
  }



  /**
   * Manejar cambio de página (lazy loading)
   */
  onPageChange(event: any): void {
    this.currentPage = Math.floor(event.first / event.rows) + 1;
    this.rowsPerPage = event.rows;
    this.loadActivos();
  }

  /**
   * Buscar activos
   */
  onSearch(): void {
    this.currentPage = 1;
    this.loadActivos();
  }

  /**
   * Limpiar búsqueda
   */
  clearSearch(): void {
    this.searchTerm = '';
    this.selectedEmpresa = null;
    this.selectedSucursal = null;
    this.selectedSede = null;
    this.currentPage = 1;
    this.loadActivos();
  }

  /**
   * Obtener severity del tag según puntaje
   */
  getPuntajeSeverity(puntaje: number): 'success' | 'info' | 'warn' | 'danger' {
    if (puntaje >= 80) return 'success';
    if (puntaje >= 60) return 'info';
    if (puntaje >= 40) return 'warn';
    return 'danger';
  }

  /**
   * Obtener los principales tipos de equipo para el gráfico (máximo 5)
   */
  getTiposPrincipales(): any[] {
    return this.estadisticasPorTipo.slice(0, 5);
  }

  /**
   * Obtener el total de equipos por ubicación
   */
  getTotalEquiposUbicacion(): number {
    return this.estadisticasPorUbicacion.reduce((sum, ubicacion) => sum + ubicacion.total, 0);
  }

  /**
   * Obtener el color para cada tipo de equipo
   */
  getColorForTipo(index: number): string {
    const colors = [
      '#10B981', // Verde esmeralda
      '#3B82F6', // Azul
      '#F59E0B', // Amarillo/Naranja
      '#EF4444', // Rojo
      '#8B5CF6', // Púrpura
      '#06B6D4', // Cian
      '#F97316', // Naranja
      '#84CC16', // Lima
      '#EC4899', // Rosa
      '#6B7280'  // Gris
    ];
    return colors[index % colors.length];
  }

  /**
   * Formatear fecha
   */
  formatDate(date: string): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Verificar si el usuario tiene acceso total
   */
  tieneAccesoTotal(): boolean {
    return this.empresasPermisos.length === 0;
  }

  /**
   * Obtener descripción de permisos
   */
  getDescripcionPermisos(): string {
    if (this.tieneAccesoTotal()) {
      return 'Acceso total a todos los activos';
    }

    const empresasRecursivas = this.empresasPermisos.filter(p => p.recursivo && !p.sucursal_id).length;
    const sucursalesRecursivas = this.empresasPermisos.filter(p => p.recursivo && p.sucursal_id).length;
    const especificas = this.empresasPermisos.filter(p => !p.recursivo).length;

    const partes: string[] = [];
    if (empresasRecursivas > 0) partes.push(`${empresasRecursivas} empresa(s) completa(s)`);
    if (sucursalesRecursivas > 0) partes.push(`${sucursalesRecursivas} sucursal(es) completa(s)`);
    if (especificas > 0) partes.push(`${especificas} asignación(es) específica(s)`);

    return `Acceso a: ${partes.join(', ')}`;
  }

  /**
   * Cargar activos para matriz completa
   */
  loadActivosMatrizCompleta(): void {
    this.isLoadingMatrizCompleta = true;

    const filtros: FiltrosActivos = {
      page: this.currentPageCompleta,
      per_page: this.rowsPerPageCompleta
    };

    if (this.searchTermTodos) {
      filtros.search = this.searchTermTodos;
    }

    // Aplicar filtros usando las mismas variables del dashboard
    if (this.selectedEmpresa) {
      filtros.empresa_id = this.selectedEmpresa;
    }
    if (this.selectedSucursal) {
      filtros.sucursal_id = this.selectedSucursal;
    }
    if (this.selectedSede) {
      filtros.sede_id = this.selectedSede;
    }

    this.activosService.getActivosPorPermisos(filtros).subscribe({
      next: (response) => {
        this.activosMatrizCompleta = response.data || [];
        this.totalRecordsCompleta = response.total || 0;
        this.isLoadingMatrizCompleta = false;
      },
      error: (error) => {
        console.error('Error cargando matriz completa:', error);
        this.showError('Error al cargar los activos para la matriz completa');
        this.isLoadingMatrizCompleta = false;
        this.activosMatrizCompleta = [];
      }
    });
  }

  /**
   * Manejar cambio de página en matriz completa
   */
  onPageChangeCompleta(event: any): void {
    this.currentPageCompleta = Math.floor(event.first / event.rows) + 1;
    this.rowsPerPageCompleta = event.rows;
    this.loadActivosMatrizCompleta();
  }

  /**
   * Buscar en matriz completa
   */
  buscarEnMatrizCompleta(): void {
    this.currentPageCompleta = 1;
    this.loadActivosMatrizCompleta();
  }

  /**
   * Exportar todos los activos a Excel
   */
  exportarTodosLosActivos(): void {
    // Abrir modal de selección de formato
    this.mostrarModalExportacion = true;
  }

  /**
   * Cerrar modal de exportación
   */
  cerrarModalExportacion(): void {
    this.mostrarModalExportacion = false;
  }

  /**
   * Exportar en formato Excel
   */
  exportarExcel(): void {
    this.cerrarModalExportacion();
    this.showInfo('Preparando exportación a Excel...');
    
    const filtros: FiltrosActivos = {
      per_page: 9999
    };

    // Aplicar filtros usando las mismas variables del dashboard
    if (this.selectedEmpresa) {
      filtros.empresa_id = this.selectedEmpresa;
    }
    if (this.selectedSucursal) {
      filtros.sucursal_id = this.selectedSucursal;
    }
    if (this.selectedSede) {
      filtros.sede_id = this.selectedSede;
    }
    if (this.searchTermTodos) {
      filtros.search = this.searchTermTodos;
    }

    this.activosService.getActivosPorPermisos(filtros).subscribe({
      next: (response) => {
        if (response.success && response.data && response.data.length > 0) {
          this.generarExcel(response.data);
          this.showSuccess(`Se exportaron ${response.data.length} activos correctamente a Excel`);
        } else {
          this.showWarn('No hay datos para exportar');
        }
      },
      error: (error) => {
        console.error('Error exportando activos:', error);
        this.showError('Error al exportar los activos');
      }
    });
  }

  /**
   * Exportar en formato PDF
   */
  exportarPDF(): void {
    this.cerrarModalExportacion();
    this.showInfo('La exportación a PDF estará disponible próximamente');
    // TODO: Implementar exportación a PDF
  }

  /**
   * Generar archivo Excel con los datos de activos
   */
  /**
   * Generar archivo Excel con los datos de activos usando el servicio
   */
  private async generarExcel(activos: ActivoMatriz[]): Promise<void> {
    // Definir las columnas (CONCEPTO primero, como en la tabla)
    const columns: ExcelColumn[] = [
      { header: 'CONCEPTO', key: 'concepto', width: 15 },
      { header: 'NOMBRE EQUIPO', key: 'nombreEquipo', width: 25 },
      { header: 'SUCURSAL/SEDE', key: 'sucursalSede', width: 30 },
      { header: 'TAG AGENTE', key: 'tagAgente', width: 15 },
      { header: 'PLACA', key: 'placa', width: 15 },
      { header: 'MARCA', key: 'marca', width: 15 },
      { header: 'TIPO EQUIPO', key: 'tipoEquipo', width: 15 },
      { header: 'REFERENCIA', key: 'referencia', width: 20 },
      { header: 'SERIAL', key: 'serial', width: 20 },
      { header: 'UBICACIÓN', key: 'ubicacion', width: 20 },
      { header: 'TIPO UNIDAD', key: 'tipoUnidad', width: 15 },
      { header: 'FECHA COMPRA', key: 'fechaCompra', width: 15 },
      { header: 'MODALIDAD COMPRA', key: 'modalidadCompra', width: 18 },
      { header: 'PROVEEDOR', key: 'proveedor', width: 20 },
      { header: 'EDAD (Años)', key: 'edad', width: 12 },
      { header: 'EDAD VS VUTIL', key: 'edadVsVutil', width: 15 },
      { header: 'VALORACIÓN EDAD', key: 'valoracionEdad', width: 18 },
      { header: 'RAM (GB)', key: 'ram', width: 12 },
      { header: 'MAX RAM (GB)', key: 'maxRam', width: 12 },
      { header: 'GENERACIÓN RAM', key: 'generacionRam', width: 15 },
      { header: 'VALORACIÓN RAM', key: 'valoracionRam', width: 18 },
      { header: 'PROCESADOR', key: 'procesador', width: 25 },
      { header: 'NÚMERO PROCESADOR', key: 'numeroProcesador', width: 18 },
      { header: 'VALORACIÓN PROCESADOR', key: 'valoracionProcesador', width: 22 },
      { header: 'TIPO DISCO', key: 'tipoDisco', width: 15 },
      { header: 'DISCO (GB)', key: 'disco', width: 12 },
      { header: 'INTERFAZ CONEXIÓN', key: 'interfazConexion', width: 18 },
      { header: 'VALORACIÓN DISCO', key: 'valoracionDisco', width: 18 },
      { header: '#INCIDENCIAS 6 MESES', key: 'incidencias', width: 20 },
      { header: 'PUNTAJE', key: 'puntaje', width: 10 }
    ];

    // Transformar los datos al formato requerido
    const excelData = activos.map(activo => {
      const detalle = activo.detalle as any;
      const empresa = activo.empresa?.nombre || '-';
      const sucursal = activo.sucursal?.nombre || '';
      const ubicacionEmpresa = sucursal ? `${empresa} - ${sucursal}` : empresa;

      return {
        concepto: this.getConceptoCorto(activo.puntaje),
        nombreEquipo: activo.nombre_equipo || '-',
        sucursalSede: ubicacionEmpresa,
        tagAgente: activo.agente || '-',
        placa: activo.placa || '-',
        marca: detalle?.marca || '-',
        tipoEquipo: detalle?.tipo || '-',
        referencia: detalle?.referencia || '-',
        serial: activo.serial || '-',
        ubicacion: activo.ubicacion || '-',
        tipoUnidad: detalle?.tipo_unidad || '-',
        fechaCompra: detalle?.fecha_compra || '-',
        modalidadCompra: detalle?.modalidad || '-',
        proveedor: detalle?.proveedor || '-',
        edad: detalle?.edad !== null && detalle?.edad !== undefined ? detalle.edad : '-',
        edadVsVutil: detalle?.edad_v_util !== null && detalle?.edad_v_util !== undefined ? `${detalle.edad_v_util}%` : '-',
        valoracionEdad: detalle?.valoracion_edad || '-',
        ram: detalle?.tamano_ram !== null && detalle?.tamano_ram !== undefined ? detalle.tamano_ram : '-',
        maxRam: detalle?.max_ram !== null && detalle?.max_ram !== undefined ? detalle.max_ram : (detalle?.tamano_ram !== null && detalle?.tamano_ram !== undefined ? detalle.tamano_ram * 2 : '-'),
        generacionRam: detalle?.generacion_ram || '-',
        valoracionRam: detalle?.valoracion_ram || '-',
        procesador: detalle?.procesador || '-',
        numeroProcesador: detalle?.numero_procesador !== null && detalle?.numero_procesador !== undefined ? detalle.numero_procesador : '-',
        valoracionProcesador: detalle?.valoracion_procesador || '-',
        tipoDisco: detalle?.tipo_disco || '-',
        disco: detalle?.tamano_disco !== null && detalle?.tamano_disco !== undefined ? detalle.tamano_disco : '-',
        interfazConexion: detalle?.interfaz_conexion || '-',
        valoracionDisco: detalle?.valoracion_disco || '-',
        incidencias: detalle?.incidencias_6_meses !== null && detalle?.incidencias_6_meses !== undefined ? detalle.incidencias_6_meses : '0',
        puntaje: activo.puntaje || 0
      };
    });

    // Usar el servicio para exportar con colores condicionales
    await this.excelExportService.exportToExcelWithCustomization(
      excelData,
      columns,
      'Matriz Obsolescencia',
      'Matriz_Obsolescencia',
      {
        headerBackgroundColor: 'FF4472C4', // Azul
        headerFontColor: 'FFFFFFFF', // Blanco
        headerFontSize: 11,
        headerHeight: 20,
        dataBorderColor: 'FFD3D3D3', // Gris claro
        applyBorders: true
      },
      (worksheet) => {
        // Aplicar colores a la columna CONCEPTO (columna A, índice 1)
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber > 1) { // Saltar encabezados
            const conceptoCell = row.getCell(1); // Primera columna (CONCEPTO)
            const concepto = conceptoCell.value?.toString() || '';

            // Aplicar colores según el concepto
            if (concepto === 'Óptimo') {
              conceptoCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF10B981' } // Verde
              };
              conceptoCell.font = { color: { argb: 'FFFFFFFF' }, bold: true }; // Texto blanco
            } else if (concepto === 'Funcional') {
              conceptoCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'F9F516' } // Amarillo
              };
              conceptoCell.font = { color: { argb: 'FF000000' }, bold: true }; // Texto negro
            } else if (concepto === 'Potencializar') {
              conceptoCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'F9B116' } // Naranja/Mostaza
              };
              conceptoCell.font = { color: { argb: 'FFFFFFFF' }, bold: true }; // Texto blanco
            } else if (concepto === 'Obsoleto') {
              conceptoCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFEF4444' } // Rojo
              };
              conceptoCell.font = { color: { argb: 'FFFFFFFF' }, bold: true }; // Texto blanco
            }

            // Centrar el texto
            conceptoCell.alignment = { vertical: 'middle', horizontal: 'center' };
          }
        });
      }
    );
  }

  /**
   * Ver matriz completa de un activo
   */
  verMatrizCompleta(activo: ActivoMatriz): void {
    this.activoSeleccionado = activo;
    
    // Cargar campos editables con los valores actuales
    this.camposEditables = {
      ubicacion: activo.ubicacion || '',
      tipo_unidad: (activo.detalle as any)?.tipo_unidad || '',
      fecha_compra: (activo.detalle as any)?.fecha_compra || '',
      modalidad: (activo.detalle as any)?.modalidad || '',
      proveedor: (activo.detalle as any)?.proveedor || '',
      max_ram: (activo.detalle as any)?.max_ram || null
    };
    
    this.generarMatrizCompleta(activo);
    this.mostrarMatrizCompleta = true;
  }

  /**
   * Generar datos para la matriz completa
   */
  private generarMatrizCompleta(activo: ActivoMatriz): void {
    this.matrizCompleta = [
      // Información básica
      { campo: 'Sucursal / Sede', valor: activo.empresa?.nombre || '-', icono: 'pi pi-building' },
      { campo: 'TAG AGENTE', valor: activo.agente, icono: 'pi pi-tag' },
      { campo: 'NOMBRE EQUIPO', valor: activo.nombre_equipo, icono: 'pi pi-desktop', destacado: true },
      { campo: 'PLACA', valor: activo.placa || '-', icono: 'pi pi-id-card' },
      { campo: 'MARCA', valor: activo.detalle?.marca || '-', icono: 'pi pi-bookmark' },
      { campo: 'TIPO DE EQUIPO', valor: activo.detalle?.tipo || '-', icono: 'pi pi-cog' },
      { campo: 'REFERENCIA', valor: activo.detalle?.referencia || '-', icono: 'pi pi-info-circle' },
      { campo: 'SERIAL', valor: activo.serial || '-', icono: 'pi pi-barcode' },
      { campo: 'UBICACIÓN', valor: activo.ubicacion || '-', icono: 'pi pi-map-marker' },
      { campo: 'TIPO DE UNIDAD', valor: (activo.detalle as any)?.tipo_unidad || ' - ', icono: 'pi pi-box' },
      
      // Fechas y compras
      { campo: 'FECHA DE COMPRA', valor: (activo.detalle as any)?.fecha_compra || '-', tipo: 'fecha', icono: 'pi pi-calendar' },
      { campo: 'MODALIDAD DE COMPRA', valor: (activo.detalle as any)?.modalidad || 'No especificada', icono: 'pi pi-shopping-cart' },
      { campo: 'PROVEEDOR', valor: (activo.detalle as any)?.proveedor || 'No especificado', icono: 'pi pi-users' },
      
      // Edad y valoración
      { campo: 'EDAD (Años)', valor: (activo.detalle as any)?.edad !== null ? `${(activo.detalle as any).edad} año(s)` : '-', icono: 'pi pi-clock' },
      { campo: 'Edad Vs Vutil', valor: this.formatEdadVsVutil((activo.detalle as any)?.edad_v_util), icono: 'pi pi-chart-line' },
      { campo: 'Valoración EDAD', valor: (activo.detalle as any)?.valoracion_edad || this.getValoracionEdad(activo.created_at), tipo: 'valoracion', icono: 'pi pi-star' },
      
      // RAM
      { campo: 'RAM (GB)', valor: activo.detalle?.tamano_ram ? `${activo.detalle.tamano_ram} GB` : '-', icono: 'pi pi-microchip' },
      { campo: 'MaxRAM (GB)', valor: (activo.detalle as any)?.max_ram ? `${(activo.detalle as any).max_ram} GB` : (activo.detalle?.tamano_ram ? `${activo.detalle.tamano_ram * 2} GB (calculado)` : '-'), icono: 'pi pi-microchip' },
      { campo: 'GENERACIÓN RAM', valor: activo.detalle?.generacion_ram || '-', icono: 'pi pi-microchip' },
      { campo: 'Valoración RAM', valor: (activo.detalle as any)?.valoracion_ram || this.getValoracionRAM(activo.detalle?.tamano_ram || null), tipo: 'valoracion', icono: 'pi pi-star' },
      
      // Procesador
      { campo: 'Procesador', valor: activo.detalle?.procesador || '-', icono: 'pi pi-microchip' },
      { campo: 'Numero Procesador', valor: activo.detalle?.numero_procesador?.toString() || '-', icono: 'pi pi-microchip' },
      { campo: 'Valoración Procesador', valor: (activo.detalle as any)?.valoracion_procesador || this.getValoracionProcesador(activo.detalle?.procesador || null), tipo: 'valoracion', icono: 'pi pi-star' },
      
      // Disco
      { campo: 'Tipo Disco', valor: activo.detalle?.tipo_disco || '-', icono: 'pi pi-database' },
      { campo: 'Disco (GB)', valor: activo.detalle?.tamano_disco ? `${activo.detalle.tamano_disco} GB` : '-', icono: 'pi pi-database' },
      { campo: 'Interfaz Conexión', valor: activo.detalle?.interfaz_conexion || '-', icono: 'pi pi-link' },
      { campo: 'Valoración Disco', valor: (activo.detalle as any)?.valoracion_disco || this.getValoracionDisco(activo.detalle?.tipo_disco || null), tipo: 'valoracion', icono: 'pi pi-star' },
      
      // Incidencias y puntaje final
      { campo: '#Incidencias 6 Meses', valor: (activo.detalle as any)?.incidencias_6_meses !== null && (activo.detalle as any)?.incidencias_6_meses !== undefined ? (activo.detalle as any).incidencias_6_meses.toString() : '0', icono: 'pi pi-exclamation-triangle' },
      { campo: 'Puntaje', valor: activo.puntaje, tipo: 'puntaje', icono: 'pi pi-chart-bar', destacado: true },
      { campo: 'Concepto', valor: this.getConceptoCorto(activo.puntaje), icono: 'pi pi-comment' }
    ];
  }

  /**
   * Obtener valoración de edad
   */
  getValoracionEdad(fechaCreacion: string): string {
    if (!fechaCreacion) return 'No disponible';
    
    const fechaCreado = new Date(fechaCreacion);
    const ahora = new Date();
    const diferencia = ahora.getTime() - fechaCreado.getTime();
    const anos = Math.floor(diferencia / (1000 * 60 * 60 * 24 * 365));
    
    if (anos <= 2) return 'Excelente';
    if (anos <= 4) return 'Bueno';
    if (anos <= 6) return 'Regular';
    return 'Crítico';
  }

  /**
   * Obtener valoración de RAM
   */
  getValoracionRAM(tamanoRam: number | null): string {
    if (!tamanoRam) return 'No disponible';
    
    if (tamanoRam >= 16) return 'Excelente';
    if (tamanoRam >= 8) return 'Bueno';
    if (tamanoRam >= 4) return 'Regular';
    return 'Crítico';
  }

  /**
   * Obtener valoración de procesador
   */
  getValoracionProcesador(procesador: string | null): string {
    if (!procesador) return 'No disponible';
    
    const proc = procesador.toLowerCase();
    if (proc.includes('i7') || proc.includes('i9') || proc.includes('ryzen 7') || proc.includes('ryzen 9')) {
      return 'Sin Datos';
    }
    if (proc.includes('i5') || proc.includes('ryzen 5')) {
      return 'Sin Datos';
    }
    if (proc.includes('i3') || proc.includes('ryzen 3')) {
      return 'Sin Datos';
    }
    return 'Básico';
  }

  /**
   * Obtener valoración de disco
   */
  getValoracionDisco(tipoDisco: string | null): string {
    if (!tipoDisco) return 'No disponible';
    
    const tipo = tipoDisco.toLowerCase();
    if (tipo.includes('ssd') || tipo.includes('nvme')) {
      return 'Excelente';
    }
    if (tipo.includes('hdd') || tipo.includes('sata')) {
      return 'Regular';
    }
    return 'Básico';
  }

  /**
   * Obtener concepto corto según puntaje (para tag)
   */
  getConceptoCorto(puntaje: number): string {
    if (puntaje >= 80) return 'Óptimo';
    if (puntaje >= 60) return 'Funcional';
    if (puntaje >= 40) return 'Potencializar';
    return 'Obsoleto';
  }

  /**
   * Obtener severity para valoraciones
   */
  getValoracionSeverity(valoracion: string): 'success' | 'info' | 'warn' | 'danger' {
    if (!valoracion) return 'info';
    
    const val = valoracion.toLowerCase();
    if (val.includes('excelente') || val.includes('muy bueno')) return 'success';
    if (val.includes('bueno') || val.includes('aceptable')) return 'info';
    if (val.includes('regular') || val.includes('medio')) return 'warn';
    return 'danger';
  }

  /**
   * Obtener valoración de edad formateada para la tabla
   */
  getValoracionEdadFormateada(activo: ActivoMatriz): string {
    const valoracion = this.getDetalleProperty(activo, 'valoracion_edad');
    
    // Si hay valoración y es numérica, mostrarla
    if (valoracion !== null && valoracion !== undefined && valoracion !== '') {
      // Verificar si es un número
      const numValue = parseFloat(valoracion);
      if (!isNaN(numValue)) {
        return numValue.toString();
      }
      // Si no es número pero tiene valor, mostrarlo
      return valoracion;
    }
    
    // Si no hay datos, mostrar "Sin datos"
    return 'Sin datos';
  }

  /**
   * Obtener severity para valoración de edad
   */
  getValoracionEdadSeverity(activo: ActivoMatriz): 'success' | 'danger' {
    const valoracion = this.getDetalleProperty(activo, 'valoracion_edad');
    
    // Si hay valoración y es numérica, verde
    if (valoracion !== null && valoracion !== undefined && valoracion !== '') {
      const numValue = parseFloat(valoracion);
      if (!isNaN(numValue)) {
        return 'success';
      }
    }
    
    // Si no hay datos, rojo
    return 'danger';
  }

  /**
   * Obtener valoración de RAM formateada para la tabla
   */
  getValoracionRAMFormateada(activo: ActivoMatriz): string {
    const valoracion = this.getDetalleProperty(activo, 'valoracion_ram');
    
    if (valoracion !== null && valoracion !== undefined && valoracion !== '') {
      const numValue = parseFloat(valoracion);
      if (!isNaN(numValue)) {
        return numValue.toString();
      }
      return valoracion;
    }
    
    return 'Sin datos';
  }

  /**
   * Obtener severity para valoración de RAM
   */
  getValoracionRAMSeverity(activo: ActivoMatriz): 'success' | 'danger' {
    const valoracion = this.getDetalleProperty(activo, 'valoracion_ram');
    
    if (valoracion !== null && valoracion !== undefined && valoracion !== '') {
      const numValue = parseFloat(valoracion);
      if (!isNaN(numValue)) {
        return 'success';
      }
    }
    
    return 'danger';
  }

  /**
   * Obtener valoración de Procesador formateada para la tabla
   */
  getValoracionProcesadorFormateada(activo: ActivoMatriz): string {
    const valoracion = this.getDetalleProperty(activo, 'valoracion_procesador');
    
    if (valoracion !== null && valoracion !== undefined && valoracion !== '') {
      const numValue = parseFloat(valoracion);
      if (!isNaN(numValue)) {
        return numValue.toString();
      }
      return valoracion;
    }
    
    return 'Sin datos';
  }

  /**
   * Obtener severity para valoración de Procesador
   */
  getValoracionProcesadorSeverity(activo: ActivoMatriz): 'success' | 'danger' {
    const valoracion = this.getDetalleProperty(activo, 'valoracion_procesador');
    
    if (valoracion !== null && valoracion !== undefined && valoracion !== '') {
      const numValue = parseFloat(valoracion);
      if (!isNaN(numValue)) {
        return 'success';
      }
    }
    
    return 'danger';
  }

  /**
   * Obtener valoración de Disco formateada para la tabla
   */
  getValoracionDiscoFormateada(activo: ActivoMatriz): string {
    const valoracion = this.getDetalleProperty(activo, 'valoracion_disco');
    
    if (valoracion !== null && valoracion !== undefined && valoracion !== '') {
      const numValue = parseFloat(valoracion);
      if (!isNaN(numValue)) {
        return numValue.toString();
      }
      return valoracion;
    }
    
    return 'Sin datos';
  }

  /**
   * Obtener severity para valoración de Disco
   */
  getValoracionDiscoSeverity(activo: ActivoMatriz): 'success' | 'danger' {
    const valoracion = this.getDetalleProperty(activo, 'valoracion_disco');
    
    if (valoracion !== null && valoracion !== undefined && valoracion !== '') {
      const numValue = parseFloat(valoracion);
      if (!isNaN(numValue)) {
        return 'success';
      }
    }
    
    return 'danger';
  }

  /**
   * Cerrar modal de matriz completa
   */
  cerrarMatrizCompleta(): void {
    this.mostrarMatrizCompleta = false;
    this.activoSeleccionado = null;
    this.matrizCompleta = [];
  }

  /**
   * Abrir equipo en GLPI en nueva pestaña
   */
  abrirEnGLPI(idActivoGlpi: number): void {
    if (!idActivoGlpi) {
      this.showError('Este activo no tiene ID de GLPI asociado');
      return;
    }
    
    const url = `http://aqsolutions.tech/front/computer.form.php?id=${idActivoGlpi}`;
    window.open(url, '_blank');
  }

  /**
   * Guardar cambios de la matriz completa
   */
  guardarMatrizCompleta(): void {
    if (!this.activoSeleccionado) {
      this.showError('No hay activo seleccionado');
      return;
    }

    this.isSavingMatriz = true;

    // Preparar datos para actualizar
    const datosActualizar = {
      id: this.activoSeleccionado.id,
      ubicacion: this.camposEditables.ubicacion,
      detalle: {
        tipo_unidad: this.camposEditables.tipo_unidad,
        fecha_compra: this.camposEditables.fecha_compra,
        modalidad: this.camposEditables.modalidad,
        proveedor: this.camposEditables.proveedor,
        max_ram: this.camposEditables.max_ram
      }
    };

    // Llamar al servicio para actualizar
    this.activosService.actualizarActivo(datosActualizar).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.showSuccess('Activo actualizado correctamente. Recalculando valores...');
          
          // Actualizar el activo seleccionado con los nuevos valores
          if (this.activoSeleccionado) {
            this.activoSeleccionado.ubicacion = this.camposEditables.ubicacion;
            if (this.activoSeleccionado.detalle) {
              (this.activoSeleccionado.detalle as any).tipo_unidad = this.camposEditables.tipo_unidad;
              (this.activoSeleccionado.detalle as any).fecha_compra = this.camposEditables.fecha_compra;
              (this.activoSeleccionado.detalle as any).modalidad = this.camposEditables.modalidad;
              (this.activoSeleccionado.detalle as any).proveedor = this.camposEditables.proveedor;
              (this.activoSeleccionado.detalle as any).max_ram = this.camposEditables.max_ram;
            }
          }
          
          // Recalcular solo este activo
          this.recalcularActivo(this.activoSeleccionado!.id);
        } else {
          this.isSavingMatriz = false;
          this.showError(response.message || 'Error al actualizar el activo');
        }
      },
      error: (error: any) => {
        this.isSavingMatriz = false;
        console.error('Error actualizando activo:', error);
        
        let errorMessage = 'Error al actualizar el activo';
        if (error.error?.message) {
          errorMessage = error.error.message;
        }
        
        this.showError(errorMessage);
      }
    });
  }

  /**
   * Recalcular valores de un activo específico
   */
  private recalcularActivo(activoId: number): void {
    this.parametrosService.ejecutarCalculos({
      activo_id: activoId,
      force: true
    }).subscribe({
      next: (response: any) => {
        this.isSavingMatriz = false;
        
        if (response.success) {
          this.showSuccess('Valores recalculados correctamente');
          
          // Recargar el activo actualizado desde el servidor
          this.activosService.getActivo(activoId).subscribe({
            next: (activoResponse: any) => {
              if (activoResponse.success && activoResponse.data) {
                // Actualizar el activo seleccionado con los datos recalculados
                this.activoSeleccionado = activoResponse.data;
                
                // Regenerar la matriz con los nuevos valores calculados
                if (this.activoSeleccionado) {
                  this.generarMatrizCompleta(this.activoSeleccionado);
                  
                  // Recargar campos editables por si cambiaron
                  this.camposEditables = {
                    ubicacion: this.activoSeleccionado.ubicacion || '',
                    tipo_unidad: (this.activoSeleccionado.detalle as any)?.tipo_unidad || '',
                    fecha_compra: (this.activoSeleccionado.detalle as any)?.fecha_compra || '',
                    modalidad: (this.activoSeleccionado.detalle as any)?.modalidad || '',
                    proveedor: (this.activoSeleccionado.detalle as any)?.proveedor || '',
                    max_ram: (this.activoSeleccionado.detalle as any)?.max_ram || null
                  };
                }
              }
              
              // Recargar la lista de activos para reflejar el nuevo puntaje
              this.loadActivos();
              this.loadStats();
            },
            error: (error: any) => {
              console.error('Error recargando activo:', error);
              // Aún así recargar la lista
              this.loadActivos();
              this.loadStats();
            }
          });
        } else {
          this.showWarn('Activo guardado pero no se pudo recalcular: ' + (response.message || ''));
          // Recargar la lista de activos de todas formas
          this.loadActivos();
          this.loadStats();
        }
      },
      error: (error: any) => {
        this.isSavingMatriz = false;
        console.error('Error recalculando activo:', error);
        this.showWarn('Activo guardado pero no se pudo recalcular. Intente recalcular manualmente.');
        
        // Recargar la lista de activos de todas formas
        this.loadActivos();
        this.loadStats();
      }
    });
  }

  /**
   * Obtener activos por estado de obsolescencia
   */
  getActivosPorEstado(estado: string): number {
    switch (estado) {
      case 'optimo':
        return this.estadisticasPorEstado.optimo;
      case 'funcional':
        return this.estadisticasPorEstado.funcional;
      case 'potencial':
        return this.estadisticasPorEstado.potencial;
      case 'obsoleto':
        return this.estadisticasPorEstado.obsoleto;
      default:
        return 0;
    }
  }

  /**
   * Obtener clase CSS según puntaje
   */
  getPuntajeClass(puntaje: number): string {
    if (puntaje >= 80) return 'optimo';
    if (puntaje >= 60) return 'funcional';
    if (puntaje >= 40) return 'potencial';
    return 'obsoleto';
  }

  /**
   * Obtener estado textual según puntaje
   */
  getPuntajeEstado(puntaje: number): string {
    if (puntaje >= 80) return 'Óptimo';
    if (puntaje >= 60) return 'Funcional';
    if (puntaje >= 40) return 'Potencializar';
    return 'Obsoleto';
  }

  /**
   * Formatear edad vs vida útil como porcentaje
   */
  formatEdadVsVutil(valor: any): string {
    if (valor === null || valor === undefined) {
      return 'En evaluación';
    }
    
    // Convertir a número si es string
    const numericValue = typeof valor === 'string' ? parseFloat(valor) : valor;
    
    if (isNaN(numericValue)) {
      return 'En evaluación';
    }
    
    // Formatear como porcentaje con 2 decimales
    return `${numericValue.toFixed(2)}%`;
  }

  /**
   * Métodos auxiliares para acceder a propiedades extendidas del detalle
   */
  getDetalleProperty(activo: ActivoMatriz, property: string): any {
    return (activo.detalle as any)?.[property];
  }

  getDetalleValueOrDefault(activo: ActivoMatriz, property: string, defaultValue: any = null): any {
    const value = (activo.detalle as any)?.[property];
    // For numeric values, we want to show 0 when it's actually 0
    if (value === 0 || value === '0') {
      return value;
    }
    // For other falsy values (null, undefined, empty string), use default
    return value || defaultValue;
  }

  // Message helpers
  private showSuccess(message: string): void {
    this.messageService.add({
      severity: 'success',
      summary: 'Éxito',
      detail: message
    });
  }

  private showError(message: string): void {
    this.messageService.add({
      severity: 'error',
      summary: 'Error',
      detail: message,
      life: 5000
    });
  }

  private showInfo(message: string): void {
    this.messageService.add({
      severity: 'info',
      summary: 'Información',
      detail: message,
      life: 4000
    });
  }

  private showWarn(message: string): void {
    this.messageService.add({
      severity: 'warn',
      summary: 'Advertencia',
      detail: message,
      life: 5000
    });
  }

  /**
   * Actualizar datos y ejecutar cálculos automáticos
   */
  actualizarDatosConCalculos(): void {
    this.isCalculatingValues = true;
    
    // Primero cargar los datos
    this.loadActivos();
    this.loadStats();
    
    // Luego ejecutar cálculos automáticos (recalcular todo)
    this.parametrosService.ejecutarCalculos({
      batch_size: 50,
      force: true, // Recalcular todo
      solo_nuevos: false
    }).subscribe({
      next: (response) => {
        this.isCalculatingValues = false;
        
        if (response.success) {
          const data = response.data;
          let mensaje = 'Datos actualizados y cálculos ejecutados exitosamente';
          
          if (data.total !== undefined) {
            mensaje += `\n- Total procesados: ${data.procesados || data.total}`;
            mensaje += `\n- Exitosos: ${data.exitosos}`;
            if (data.errores > 0) {
              mensaje += `\n- Errores: ${data.errores}`;
            }
          }
          
          this.showSuccess(mensaje);
          
          // Recargar datos después de los cálculos
          setTimeout(() => {
            this.loadActivos();
            this.loadStats();
          }, 1000);
          
        } else {
          this.showError(response.message || 'Error ejecutando cálculos automáticos');
        }
      },
      error: (error) => {
        this.isCalculatingValues = false;
        console.error('Error ejecutando cálculos:', error);
        
        let errorMessage = 'Error ejecutando cálculos automáticos';
        if (error.error?.message) {
          errorMessage = error.error.message;
        }
        
        this.showError(errorMessage);
        
        // Aún así mostrar los datos actualizados
        this.showInfo('Datos básicos actualizados, pero los cálculos fallaron');
      }
    });
  }

  /**
   * Manejar cambio de tab
   */
  onTabChange(event: any): void {
    // Si se cambia al tab de Matriz Completa (índice 1)
    if (event.index === 1) {
      // Cargar empresas para los filtros si no están cargadas
      if (this.empresasOptions.length === 0) {
        this.loadEmpresas();
      }
      
      // Cargar los datos de la matriz completa
      this.loadActivosMatrizCompleta();
    }
  }

  /**
   * Abrir modal con equipos filtrados por tipo
   */
  abrirModalEquiposPorTipo(tipo: string): void {
    this.tituloModalEquipos = `Equipos de tipo: ${tipo}`;
    this.filtroActualModal = {
      tipo: tipo,
      empresa_id: this.selectedEmpresa,
      sucursal_id: this.selectedSucursal,
      sede_id: this.selectedSede
    };
    this.currentPageModal = 1;
    this.cargarEquiposFiltrados();
    this.mostrarModalEquipos = true;
  }

  /**
   * Abrir modal con equipos filtrados por ubicación
   */
  abrirModalEquiposPorUbicacion(ubicacion: string): void {
    this.tituloModalEquipos = `Equipos en: ${ubicacion}`;
    this.filtroActualModal = {
      ubicacion: ubicacion
      // NO incluir empresa_id, sucursal_id, sede_id aquí
      // porque la ubicación ya contiene esa información
    };
    this.currentPageModal = 1;
    this.cargarEquiposFiltrados();
    this.mostrarModalEquipos = true;
  }

  /**
   * Cargar equipos filtrados para el modal
   */
  cargarEquiposFiltrados(): void {
    this.isLoadingModalEquipos = true;

    const filtros = {
      ...this.filtroActualModal,
      page: this.currentPageModal,
      per_page: this.rowsPerPageModal
    };

    this.parametrosService.getEquiposPorFiltro(filtros).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.equiposFiltrados = response.data;
          this.totalRecordsModal = response.total || 0;
        } else {
          this.equiposFiltrados = [];
          this.totalRecordsModal = 0;
        }
        this.isLoadingModalEquipos = false;
      },
      error: (error) => {
        console.error('Error cargando equipos filtrados:', error);
        this.showError('Error al cargar los equipos');
        this.equiposFiltrados = [];
        this.totalRecordsModal = 0;
        this.isLoadingModalEquipos = false;
      }
    });
  }

  /**
   * Manejar cambio de página en modal de equipos
   */
  onPageChangeModal(event: any): void {
    this.currentPageModal = Math.floor(event.first / event.rows) + 1;
    this.rowsPerPageModal = event.rows;
    this.cargarEquiposFiltrados();
  }

  /**
   * Cerrar modal de equipos filtrados
   */
  cerrarModalEquipos(): void {
    this.mostrarModalEquipos = false;
    this.equiposFiltrados = [];
    this.filtroActualModal = {};
    this.tituloModalEquipos = '';
  }

  /**
   * Limpiar recursos al destruir el componente
   */
  ngOnDestroy(): void {
    // Limpieza si es necesaria
  }

  /**
   * Cargar lista de empresas desde los activos disponibles
   */
  loadEmpresas(): void {
    this.loadEntidadesDesdeActivos('empresa', {});
  }

  /**
   * Cargar sucursales por empresa desde los activos disponibles
   */
  loadSucursalesPorEmpresa(empresaId: number): void {
    this.loadEntidadesDesdeActivos('sucursal', { empresa_id: empresaId });
  }

  /**
   * Cargar sedes por sucursal desde los activos disponibles
   */
  loadSedesPorSucursal(sucursalId: number): void {
    this.loadEntidadesDesdeActivos('sede', { 
      empresa_id: this.selectedEmpresa!, 
      sucursal_id: sucursalId 
    });
  }

  /**
   * Método genérico para cargar entidades desde activos
   */
  private loadEntidadesDesdeActivos(tipo: 'empresa' | 'sucursal' | 'sede', filtrosExtra: any): void {
    const filtros: FiltrosActivos = {
      per_page: 9999,
      ...filtrosExtra
    };

    this.activosService.getActivosPorPermisos(filtros).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const activos = response.data;
          const entidadesMap = new Map<number, { id: number; nombre: string }>();
          
          activos.forEach(activo => {
            const entidad = tipo === 'empresa' ? activo.empresa : 
                          tipo === 'sucursal' ? activo.sucursal : 
                          activo.sede;
            const idKey = tipo === 'empresa' ? activo.id_empresa : 
                        tipo === 'sucursal' ? activo.id_sucursal : 
                        activo.id_sede;
            
            if (entidad && idKey) {
              if (!entidadesMap.has(idKey)) {
                entidadesMap.set(idKey, {
                  id: idKey,
                  nombre: entidad.nombre
                });
              }
            }
          });
          
          const lista = Array.from(entidadesMap.values())
            .sort((a, b) => a.nombre.localeCompare(b.nombre));
          
          const opciones = lista.map(item => ({
            label: item.nombre,
            value: item.id
          }));

          // Asignar a las propiedades correspondientes
          if (tipo === 'empresa') {
            this.empresasList = lista;
            this.empresasOptions = opciones;
          } else if (tipo === 'sucursal') {
            this.sucursalesList = lista;
            this.sucursalesOptions = opciones;
          } else {
            this.sedesList = lista;
            this.sedesOptions = opciones;
          }
        }
      },
      error: (error) => {
        console.error(`Error cargando ${tipo}s:`, error);
        this.showError(`Error al cargar las ${tipo}s`);
      }
    });
  }

  /**
   * Limpiar filtros dependientes
   */
  private limpiarFiltrosDependientes(nivel: 'empresa' | 'sucursal'): void {
    if (nivel === 'empresa') {
      this.selectedSucursal = null;
      this.selectedSede = null;
      this.sucursalesOptions = [];
      this.sedesOptions = [];
      this.sucursalesList = [];
      this.sedesList = [];
    } else if (nivel === 'sucursal') {
      this.selectedSede = null;
      this.sedesOptions = [];
      this.sedesList = [];
    }
  }

  /**
   * Manejar cambio de empresa
   */
  onEmpresaChange(): void {
    this.limpiarFiltrosDependientes('empresa');

    if (this.selectedEmpresa) {
      this.loadSucursalesPorEmpresa(this.selectedEmpresa);
    }

    this.aplicarFiltros();
  }

  /**
   * Manejar cambio de sucursal
   */
  onSucursalChange(): void {
    this.limpiarFiltrosDependientes('sucursal');

    if (this.selectedSucursal) {
      this.loadSedesPorSucursal(this.selectedSucursal);
    }

    this.aplicarFiltros();
  }

  /**
   * Manejar cambio de sede
   */
  onSedeChange(): void {
    this.aplicarFiltros();
  }

  /**
   * Aplicar filtros y recargar datos
   */
  aplicarFiltros(): void {
    this.currentPage = 1;
    this.currentPageCompleta = 1;
    this.loadActivos();
    this.loadStats();
    
    // Si estamos en el tab de Matriz Completa, recargar también esos datos
    if (this.activeTabIndex === 1) {
      this.loadActivosMatrizCompleta();
    }
  }

  /**
   * Limpiar todos los filtros
   */
  limpiarFiltros(): void {
    this.selectedEmpresa = null;
    this.limpiarFiltrosDependientes('empresa');
    this.aplicarFiltros();
  }

  /**
   * Obtener nombre de entidad por ID
   */
  private getEntityName(lista: any[], id: number): string {
    const entity = lista.find(e => e.id === id);
    return entity ? entity.nombre : '';
  }

  /**
   * Obtener nombre de empresa por ID
   */
  getEmpresaName(empresaId: number): string {
    return this.getEntityName(this.empresasList, empresaId);
  }

  /**
   * Obtener nombre de sucursal por ID
   */
  getSucursalName(sucursalId: number): string {
    return this.getEntityName(this.sucursalesList, sucursalId);
  }

  /**
   * Obtener nombre de sede por ID
   */
  getSedeName(sedeId: number): string {
    return this.getEntityName(this.sedesList, sedeId);
  }

  /**
   * Sincronizar un activo individual
   */
  sincronizarActivoIndividual(activo: ActivoMatriz): void {
    if (!activo.id_activo_glpi) {
      this.showError('Este activo no tiene ID de GLPI asociado');
      return;
    }
    
    activo.isSyncing = true;

    this.parametrosService.sincronizarActivoEspecifico(activo.id_activo_glpi).subscribe({
      next: (response) => {
        activo.isSyncing = false;
        
        if (response.success) {
          this.showSuccess(`Activo "${activo.nombre_equipo}" sincronizado correctamente`);
          setTimeout(() => {
            this.loadActivos();
            this.loadStats();
          }, 1000);
        } else {
          this.showError(response.message || 'Error al sincronizar el activo');
        }
      },
      error: (error) => {
        activo.isSyncing = false;
        console.error('Error sincronizando activo:', error);
        
        let errorMessage = 'Error al sincronizar el activo';
        if (error.status === 404) {
          errorMessage = 'Activo no encontrado en GLPI';
        } else if (error.status === 401) {
          errorMessage = 'No tienes permisos para sincronizar activos';
        } else if (error.error?.message) {
          errorMessage = error.error.message;
        }
        
        this.showError(errorMessage);
      }
    });
  }

  /**
   * Verificar si se está editando MaxRAM de un activo
   */
  isEditingMaxRam(activo: ActivoMatriz): boolean {
    return this.editingMaxRamId === activo.id;
  }

  /**
   * Iniciar edición de MaxRAM
   */
  startEditMaxRam(activo: ActivoMatriz): void {
    // Guardar copia del valor original
    this.clonedActivos[activo.id.toString()] = { ...activo };
    this.editingMaxRamId = activo.id;
  }

  /**
   * Guardar cambios de MaxRAM
   */
  saveMaxRam(activo: ActivoMatriz): void {
    const maxRam = (activo.detalle as any)?.max_ram;
    
    // Validar que max_ram sea un número válido
    if (maxRam !== null && maxRam !== undefined && maxRam !== '') {
      const numValue = parseFloat(maxRam.toString());
      if (isNaN(numValue) || numValue < 0) {
        this.showError('El valor de MaxRAM debe ser un número válido mayor o igual a 0');
        this.cancelEditMaxRam(activo);
        return;
      }
    }

    // Preparar datos para actualizar
    const datosActualizar = {
      id: activo.id,
      detalle: {
        max_ram: maxRam ? parseFloat(maxRam.toString()) : null
      }
    };

    // Guardar en el backend
    this.activosService.actualizarActivo(datosActualizar).subscribe({
      next: (response: any) => {
        if (response.success) {
          delete this.clonedActivos[activo.id.toString()];
          this.editingMaxRamId = null;
          this.showSuccess('MaxRAM actualizado correctamente');
        } else {
          this.showError(response.message || 'Error al actualizar MaxRAM');
          this.cancelEditMaxRam(activo);
        }
      },
      error: (error: any) => {
        console.error('Error actualizando MaxRAM:', error);
        this.showError('Error al actualizar MaxRAM');
        this.cancelEditMaxRam(activo);
      }
    });
  }

  /**
   * Cancelar edición de MaxRAM
   */
  cancelEditMaxRam(activo: ActivoMatriz): void {
    const cloned = this.clonedActivos[activo.id.toString()];
    if (cloned && cloned.detalle) {
      (activo.detalle as any).max_ram = (cloned.detalle as any)?.max_ram;
    }
    delete this.clonedActivos[activo.id.toString()];
    this.editingMaxRamId = null;
  }
}