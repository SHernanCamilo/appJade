import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../auth/auth.service';
import { MatrizObsActivosService, ActivoMatriz, FiltrosActivos } from '../services/matriz-obs-activos.service';
import { MatrizObsParametrosService } from '../services/matriz-obs-parametros.service';

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
    DropdownModule,
    SkeletonModule,
    DialogModule,
    TooltipModule,
    ChartModule,
    ProgressBarModule
  ],
  providers: [MessageService],
  templateUrl: './dashboardMaObsolescencia.component.html',
  styleUrl: './dashboardMaObsolescencia.component.css'
})
export class DashboardMaObsolescenciaComponent implements OnInit, OnDestroy {
  
  // Data
  activos: ActivoMatriz[] = [];
  empresasPermisos: EmpresaPermiso[] = [];
  
  // Loading states
  isLoading = false;
  isLoadingStats = false;
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
  
  // Stats
  stats = {
    totalActivos: 0,
    activosRecientes: 0,
    empresasConAcceso: 0,
    promedioObsolescencia: 0
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
  promedioGeneral = 0;
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

  // Modal Matriz Completa Todos
  mostrarMatrizCompletaTodos = false;
  activosMatrizCompleta: ActivoMatriz[] = [];
  isLoadingMatrizCompleta = false;
  totalRecordsCompleta = 0;
  currentPageCompleta = 1;
  rowsPerPageCompleta = 25;
  searchTermTodos = '';

  // Sincronización
  isSyncing = false;
  isCancelling = false;
  currentSyncId: string | null = null;
  syncCheckInterval: any = null;
  
  // Progreso de sincronización
  syncProgress = {
    percentage: 0,
    current: 0,
    total: 0,
    processed: 0,
    created: 0,
    updated: 0,
    errors: 0,
    message: 'Iniciando sincronización...'
  };

  constructor(
    private authService: AuthService,
    private activosService: MatrizObsActivosService,
    private messageService: MessageService,
    private parametrosService: MatrizObsParametrosService
  ) {
    this.initChartOptions();
    this.initBarChartOptions();
  }

  ngOnInit(): void {
    this.loadUserPermissions();
    this.loadActivos();
    this.loadStats();
    
    // Cargar estadísticas después de un pequeño delay para asegurar que Chart.js esté disponible
    setTimeout(() => {
      this.loadEstadisticasPorTipo();
      this.loadEstadisticasPorUbicacion();
    }, 100);
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
        cutout: '60%'
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

    console.log('👤 Usuario actual:', currentUser);
    console.log('🏢 Empresas del usuario:', currentUser.empresas);

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

      console.log('✅ Permisos de empresas cargados:', this.empresasPermisos);
      
      // Si no tiene empresas asignadas, tiene acceso a todo
      if (this.empresasPermisos.length === 0) {
        console.log('⚠️ Usuario sin empresas asignadas - Acceso total');
        this.showInfo('Tienes acceso a todos los activos del sistema');
      } else {
        const empresasRecursivas = this.empresasPermisos.filter(p => p.recursivo && !p.sucursal_id).length;
        const sucursalesRecursivas = this.empresasPermisos.filter(p => p.recursivo && p.sucursal_id).length;
        const asignacionesEspecificas = this.empresasPermisos.filter(p => !p.recursivo).length;
        
        console.log(`📊 Resumen de permisos:
          - Empresas completas (recursivo): ${empresasRecursivas}
          - Sucursales recursivas: ${sucursalesRecursivas}
          - Asignaciones específicas: ${asignacionesEspecificas}
        `);
      }
    } else {
      console.log('⚠️ Usuario sin empresas asignadas - Acceso total');
      this.empresasPermisos = [];
    }
  }

  /**
   * Cargar activos según permisos
   */
  loadActivos(): void {
    console.log('🚀 === INICIO CARGA ACTIVOS PRINCIPALES ===');
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

    console.log('🔍 Cargando activos principales con filtros:', filtros);

    this.activosService.getActivosPorPermisos(filtros).subscribe({
      next: (response) => {
        console.log('✅ === RESPUESTA ACTIVOS PRINCIPALES ===');
        console.log('📊 Respuesta RAW:', response);
        console.log('📋 Datos procesados:', {
          success: response.success,
          total: response.total,
          current_page: response.current_page,
          data_length: response.data?.length || 0
        });

        // DEBUG: Verificar estructura de cada activo
        if (response.data && response.data.length > 0) {
          console.log('🔍 === ANÁLISIS ACTIVOS PRINCIPALES ===');
          response.data.forEach((activo, index) => {
            if (index < 2) { // Solo los primeros 2
              console.log(`📋 Activo Principal ${index + 1}:`, {
                id: activo.id,
                nombre_equipo: activo.nombre_equipo,
                agente: activo.agente,
                empresa: activo.empresa?.nombre || 'NULL',
                detalles: activo.detalle ? 'TIENE DETALLES' : 'SIN DETALLES',
                detalles_raw: activo.detalle
              });
            }
          });
        }

        this.activos = response.data;
        this.totalRecords = response.total;
        this.isLoading = false;
        
        console.log('✅ Activos principales cargados:', {
          total: response.total,
          pagina: response.current_page,
          registros: response.data.length,
          this_activos_length: this.activos.length
        });
        console.log('🏁 === FIN CARGA ACTIVOS PRINCIPALES ===');
      },
      error: (error) => {
        console.error('❌ Error cargando activos principales:', error);
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

    this.activosService.getEstadisticas().subscribe({
      next: (response) => {
        if (response.success) {
          this.stats = {
            totalActivos: response.data.total_activos || 0,
            activosRecientes: response.data.activos_recientes || 0,
            empresasConAcceso: response.data.empresas_con_acceso || 0,
            promedioObsolescencia: response.data.promedio_obsolescencia || 0
          };
        }
        this.isLoadingStats = false;
        
        // Cargar estadísticas por estado
        this.loadEstadisticasPorEstado();
      },
      error: (error) => {
        console.error('Error cargando estadísticas:', error);
        this.isLoadingStats = false;
      }
    });
  }

  /**
   * Cargar estadísticas por estado de obsolescencia
   */
  private loadEstadisticasPorEstado(): void {
    // Obtener todos los activos sin paginación para calcular estadísticas
    const filtros: FiltrosActivos = {
      per_page: 9999 // Un número muy alto para obtener todos
    };

    this.activosService.getActivosPorPermisos(filtros).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const activos = response.data;
          
          this.estadisticasPorEstado = {
            optimo: activos.filter(a => a.puntaje >= 80).length,
            funcional: activos.filter(a => a.puntaje >= 60 && a.puntaje < 80).length,
            potencial: activos.filter(a => a.puntaje >= 40 && a.puntaje < 60).length,
            obsoleto: activos.filter(a => a.puntaje < 40).length
          };
          
          console.log('📊 Estadísticas por estado calculadas:', this.estadisticasPorEstado);
        }
      },
      error: (error) => {
        console.error('Error cargando estadísticas por estado:', error);
        // Mantener valores por defecto
        this.estadisticasPorEstado = {
          optimo: 0,
          funcional: 0,
          potencial: 0,
          obsoleto: 0
        };
      }
    });
  }

  /**
   * Cargar estadísticas por tipo de equipo
   */
  loadEstadisticasPorTipo(): void {
    this.isLoadingGrafico = true;

    this.parametrosService.getEstadisticasPorTipo().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.estadisticasPorTipo = response.data.tipos || [];
          this.promedioGeneral = response.data.resumen?.promedio_general || 0;
          
          // Actualizar datos del gráfico
          this.updateChartData();
          
          console.log('📊 Estadísticas por tipo cargadas:', {
            tipos: this.estadisticasPorTipo.length,
            promedio: this.promedioGeneral,
            datos: this.estadisticasPorTipo
          });
        }
        this.isLoadingGrafico = false;
      },
      error: (error) => {
        console.error('Error cargando estadísticas por tipo:', error);
        this.isLoadingGrafico = false;
        this.estadisticasPorTipo = [];
        this.chartData = {};
      }
    });
  }

  /**
   * Cargar estadísticas por ubicación
   */
  loadEstadisticasPorUbicacion(): void {
    this.isLoadingBarChart = true;

    this.parametrosService.getEstadisticasPorUbicacion().subscribe({
      next: (response) => {
        console.log('📊 Respuesta estadísticas por ubicación:', response);
        
        if (response.success && response.data) {
          this.estadisticasPorUbicacion = response.data.ubicaciones || [];
          
          // Actualizar datos del gráfico de barras
          this.updateBarChartData();
          
          console.log('📊 Estadísticas por ubicación cargadas:', {
            ubicaciones: this.estadisticasPorUbicacion.length,
            datos: this.estadisticasPorUbicacion
          });
          
          if (this.estadisticasPorUbicacion.length === 0) {
            console.log('⚠️ No se encontraron datos de ubicación');
          }
        } else {
          console.log('❌ Respuesta sin éxito o sin datos:', response);
          this.estadisticasPorUbicacion = [];
        }
        this.isLoadingBarChart = false;
      },
      error: (error) => {
        console.error('❌ Error cargando estadísticas por ubicación:', error);
        console.error('Detalles del error:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          error_body: error.error
        });
        
        this.isLoadingBarChart = false;
        this.estadisticasPorUbicacion = [];
        this.barChartData = {};
        
        // Mostrar mensaje de error al usuario
        this.showError('Error al cargar estadísticas por ubicación: ' + (error.error?.message || error.message));
      }
    });
  }

  /**
   * Manejar cambio de página (lazy loading)
   */
  onPageChange(event: any): void {
    console.log('📄 Evento de paginación:', event);
    
    // Para lazy loading, el evento tiene una estructura diferente
    this.currentPage = Math.floor(event.first / event.rows) + 1;
    this.rowsPerPage = event.rows;
    
    console.log('📄 Nueva página:', this.currentPage, 'Filas por página:', this.rowsPerPage);
    
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
   * Obtener el total de equipos
   */
  getTotalEquipos(): number {
    return this.estadisticasPorTipo.reduce((sum, tipo) => sum + tipo.total, 0);
  }

  /**
   * Obtener el total de equipos por ubicación
   */
  getTotalEquiposUbicacion(): number {
    return this.estadisticasPorUbicacion.reduce((sum, ubicacion) => sum + ubicacion.total, 0);
  }

  /**
   * Obtener el porcentaje de equipos bien utilizados (puntaje >= 60)
   */
  getPorcentajeBienUtilizados(): number {
    if (this.estadisticasPorTipo.length === 0) return 0;
    
    const totalEquipos = this.estadisticasPorTipo.reduce((sum, tipo) => sum + tipo.total, 0);
    const equiposBienUtilizados = this.estadisticasPorTipo.reduce((sum, tipo) => 
      sum + tipo.distribucion.optimo + tipo.distribucion.funcional, 0);
    
    return totalEquipos > 0 ? Math.round((equiposBienUtilizados / totalEquipos) * 100) : 0;
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
   * Abrir matriz completa de todos los activos
   */
  abrirMatrizCompletaTodos(): void {
    console.log('🎯 === ABRIENDO MATRIZ COMPLETA TODOS ===');
    console.log('📊 Estado antes de abrir:', {
      mostrarMatrizCompletaTodos: this.mostrarMatrizCompletaTodos,
      currentPageCompleta: this.currentPageCompleta,
      searchTermTodos: this.searchTermTodos,
      activosMatrizCompleta_length: this.activosMatrizCompleta.length
    });

    this.mostrarMatrizCompletaTodos = true;
    this.currentPageCompleta = 1;
    this.searchTermTodos = '';
    
    console.log('📊 Estado después de configurar:', {
      mostrarMatrizCompletaTodos: this.mostrarMatrizCompletaTodos,
      currentPageCompleta: this.currentPageCompleta,
      searchTermTodos: this.searchTermTodos
    });
    
    console.log('🚀 Llamando a loadActivosMatrizCompleta...');
    this.loadActivosMatrizCompleta();
  }

  /**
   * Cargar activos para matriz completa
   */
  loadActivosMatrizCompleta(): void {
    console.log('🚀 === INICIO CARGA MATRIZ COMPLETA ===');
    console.log('📊 Estado actual:', {
      isLoadingMatrizCompleta: this.isLoadingMatrizCompleta,
      currentPageCompleta: this.currentPageCompleta,
      rowsPerPageCompleta: this.rowsPerPageCompleta,
      searchTermTodos: this.searchTermTodos,
      totalRecordsCompleta: this.totalRecordsCompleta
    });

    this.isLoadingMatrizCompleta = true;

    const filtros: FiltrosActivos = {
      page: this.currentPageCompleta,
      per_page: this.rowsPerPageCompleta
    };

    if (this.searchTermTodos) {
      filtros.search = this.searchTermTodos;
    }

    console.log('🔍 Filtros enviados al servicio:', filtros);
    console.log('🌐 URL del servicio:', this.activosService);

    // Log del usuario actual y permisos
    const currentUser = this.authService.currentUser;
    console.log('👤 Usuario actual para matriz completa:', {
      id: currentUser?.id,
      name: currentUser?.name,
      empresas: currentUser?.empresas?.length || 0,
      tieneAccesoTotal: this.tieneAccesoTotal()
    });

    console.log('📡 Llamando a getActivosPorPermisos...');
    const startTime = performance.now();

    this.activosService.getActivosPorPermisos(filtros).subscribe({
      next: (response) => {
        const endTime = performance.now();
        const duration = endTime - startTime;

        console.log('✅ === RESPUESTA EXITOSA MATRIZ COMPLETA ===');
        console.log('⏱️  Tiempo de respuesta:', duration.toFixed(2) + 'ms');
        console.log('📊 Respuesta completa RAW:', response);
        console.log('📊 Tipo de response:', typeof response);
        console.log('📊 Es array response.data?:', Array.isArray(response.data));
        console.log('📋 Estructura de datos:', {
          success: response.success,
          total: response.total,
          per_page: response.per_page,
          current_page: response.current_page,
          last_page: response.last_page,
          data_length: response.data?.length || 0,
          data_type: typeof response.data,
          first_item: response.data?.[0] || null
        });

        // DEBUG DETALLADO: Verificar cada propiedad de la respuesta
        console.log('🔬 === ANÁLISIS DETALLADO DE LA RESPUESTA ===');
        console.log('🔍 response.success:', response.success, typeof response.success);
        console.log('🔍 response.data:', response.data);
        console.log('🔍 response.data es null?:', response.data === null);
        console.log('🔍 response.data es undefined?:', response.data === undefined);
        console.log('🔍 response.data.length:', response.data?.length);

        // Verificar si los activos tienen detalles
        if (response.data && response.data.length > 0) {
          console.log('🔍 === ANÁLISIS COMPLETO DE ACTIVOS ===');
          response.data.forEach((activo, index) => {
            console.log(`\n📋 ACTIVO ${index + 1} (ID: ${activo.id}):`);
            console.log('  📝 Datos básicos:', {
              id: activo.id,
              nombre_equipo: activo.nombre_equipo,
              agente: activo.agente,
              placa: activo.placa,
              serial: activo.serial,
              ubicacion: activo.ubicacion,
              puntaje: activo.puntaje,
              id_empresa: activo.id_empresa,
              id_sucursal: activo.id_sucursal,
              id_sede: activo.id_sede
            });
            
            console.log('  🏢 Relaciones:', {
              empresa: activo.empresa ? {
                id: activo.empresa.id,
                nombre: activo.empresa.nombre
              } : 'NULL',
              sucursal: activo.sucursal ? {
                id: activo.sucursal.id,
                nombre: activo.sucursal.nombre
              } : 'NULL',
              sede: activo.sede ? {
                id: activo.sede.id,
                nombre: activo.sede.nombre
              } : 'NULL'
            });
            
            console.log('  🔧 Detalles técnicos:', {
              tiene_detalles: !!activo.detalle,
              detalles_raw: activo.detalle,
              detalles_procesados: activo.detalle ? {
                marca: activo.detalle.marca,
                tipo: activo.detalle.tipo,
                referencia: activo.detalle.referencia,
                tamano_ram: activo.detalle.tamano_ram,
                generacion_ram: activo.detalle.generacion_ram,
                procesador: activo.detalle.procesador,
                numero_procesador: activo.detalle.numero_procesador,
                tipo_disco: activo.detalle.tipo_disco,
                tamano_disco: activo.detalle.tamano_disco,
                interfaz_conexion: activo.detalle.interfaz_conexion
              } : 'NO HAY DETALLES'
            });
            
            console.log('  📅 Fechas:', {
              created_at: activo.created_at,
              updated_at: activo.updated_at,
              date_u_sincronizacion: activo.date_u_sincronizacion,
              usuario_modificacion: activo.usuario_modificacion
            });
          });
        } else {
          console.log('⚠️ NO HAY DATOS EN response.data');
          console.log('🔍 response.data valor:', response.data);
          console.log('🔍 response completo:', JSON.stringify(response, null, 2));
        }

        // ASIGNACIÓN CON DEBUG
        console.log('📝 === ASIGNANDO DATOS AL COMPONENTE ===');
        console.log('🔄 Antes de asignar:');
        console.log('  - this.activosMatrizCompleta.length:', this.activosMatrizCompleta.length);
        console.log('  - this.totalRecordsCompleta:', this.totalRecordsCompleta);
        console.log('  - this.isLoadingMatrizCompleta:', this.isLoadingMatrizCompleta);

        this.activosMatrizCompleta = response.data || [];
        this.totalRecordsCompleta = response.total || 0;
        this.isLoadingMatrizCompleta = false;
        
        console.log('🔄 Después de asignar:');
        console.log('  - this.activosMatrizCompleta.length:', this.activosMatrizCompleta.length);
        console.log('  - this.totalRecordsCompleta:', this.totalRecordsCompleta);
        console.log('  - this.isLoadingMatrizCompleta:', this.isLoadingMatrizCompleta);
        console.log('  - this.activosMatrizCompleta[0]:', this.activosMatrizCompleta[0]);
        
        console.log('🏁 === FIN CARGA MATRIZ COMPLETA ===');
      },
      error: (error) => {
        const endTime = performance.now();
        const duration = endTime - startTime;

        console.error('❌ === ERROR EN MATRIZ COMPLETA ===');
        console.error('⏱️  Tiempo hasta error:', duration.toFixed(2) + 'ms');
        console.error('🚨 Error completo:', error);
        console.error('📊 Detalles del error:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          url: error.url,
          error_body: error.error
        });

        this.showError('Error al cargar los activos para la matriz completa');
        this.isLoadingMatrizCompleta = false;
        this.activosMatrizCompleta = [];
        
        console.log('💥 Estado después del error:', {
          activosMatrizCompleta_length: this.activosMatrizCompleta.length,
          isLoadingMatrizCompleta: this.isLoadingMatrizCompleta
        });
        console.log('🏁 === FIN ERROR MATRIZ COMPLETA ===');
      }
    });
  }

  /**
   * Manejar cambio de página en matriz completa
   */
  onPageChangeCompleta(event: any): void {
    console.log('📄 Evento de paginación matriz completa:', event);
    
    // Para lazy loading, calcular la página desde first y rows
    this.currentPageCompleta = Math.floor(event.first / event.rows) + 1;
    this.rowsPerPageCompleta = event.rows;
    
    console.log('📄 Nueva página matriz completa:', this.currentPageCompleta, 'Filas por página:', this.rowsPerPageCompleta);
    
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
   * Limpiar búsqueda en matriz completa
   */
  limpiarBusquedaCompleta(): void {
    this.searchTermTodos = '';
    this.currentPageCompleta = 1;
    this.loadActivosMatrizCompleta();
  }

  /**
   * Cerrar modal de matriz completa todos
   */
  cerrarMatrizCompletaTodos(): void {
    this.mostrarMatrizCompletaTodos = false;
    this.activosMatrizCompleta = [];
    this.searchTermTodos = '';
  }

  /**
   * Exportar matriz completa (placeholder)
   */
  exportarMatrizCompleta(): void {
    this.showInfo('Funcionalidad de exportación de matriz completa en desarrollo');
  }

  /**
   * Exportar todos los activos (placeholder)
   */
  exportarTodosLosActivos(): void {
    this.showInfo('Funcionalidad de exportación de todos los activos en desarrollo');
  }

  /**
   * Ver matriz completa de un activo
   */
  verMatrizCompleta(activo: ActivoMatriz): void {
    this.activoSeleccionado = activo;
    this.generarMatrizCompleta(activo);
    this.mostrarMatrizCompleta = true;
    console.log('🔍 Matriz completa para:', activo.nombre_equipo);
    console.log('📋 Datos generados:', this.matrizCompleta);
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
      { campo: 'MaxRAM (GB)', valor: activo.detalle?.tamano_ram ? `${activo.detalle.tamano_ram * 2} GB` : '-', icono: 'pi pi-microchip' },
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
      { campo: 'Concepto', valor: this.getConceptoPuntaje(activo.puntaje), icono: 'pi pi-comment' }
    ];
  }

  /**
   * Obtener última sincronización formateada
   */
  getUltimaSincronizacion(): string {
    if (!this.activoSeleccionado?.date_u_sincronizacion) {
      return '-';
    }
    return this.formatDate(this.activoSeleccionado.date_u_sincronizacion);
  }

  /**
   * Calcular edad del equipo en años
   */
  calcularEdadEquipo(fechaCreacion: string): string {
    if (!fechaCreacion) return '-';
    
    const fechaCreado = new Date(fechaCreacion);
    const ahora = new Date();
    const diferencia = ahora.getTime() - fechaCreado.getTime();
    const anos = Math.floor(diferencia / (1000 * 60 * 60 * 24 * 365));
    
    return `${anos} año(s)`;
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
      return 'Excelente';
    }
    if (proc.includes('i5') || proc.includes('ryzen 5')) {
      return 'Bueno';
    }
    if (proc.includes('i3') || proc.includes('ryzen 3')) {
      return 'Regular';
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
   * Obtener concepto según puntaje
   */
  getConceptoPuntaje(puntaje: number): string {
    if (puntaje >= 80) return 'Excelente - Equipo en óptimas condiciones';
    if (puntaje >= 60) return 'Bueno - Equipo en buenas condiciones';
    if (puntaje >= 40) return 'Regular - Considerar actualización';
    return 'Crítico - Requiere reemplazo urgente';
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
   * Cerrar modal de matriz completa
   */
  cerrarMatrizCompleta(): void {
    this.mostrarMatrizCompleta = false;
    this.activoSeleccionado = null;
    this.matrizCompleta = [];
  }

  /**
   * Exportar matriz a PDF (placeholder)
   */
  exportarMatrizPDF(): void {
    this.showInfo('Funcionalidad de exportación en desarrollo');
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
    this.loadEstadisticasPorTipo();
    this.loadEstadisticasPorUbicacion();
    
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
            this.loadEstadisticasPorTipo();
            this.loadEstadisticasPorUbicacion();
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
   * Alternar sincronización (iniciar o cancelar)
   */
  toggleSincronizacion(): void {
    if (this.isSyncing) {
      this.cancelarSincronizacion();
    } else {
      this.iniciarSincronizacion();
    }
  }

  /**
   * Iniciar sincronización de equipos desde GLPI
   */
  iniciarSincronizacion(): void {
    console.log('🔄 Iniciando sincronización de equipos desde GLPI...');
    this.isSyncing = true;
    this.isCancelling = false;
    
    // Resetear progreso
    this.syncProgress = {
      percentage: 0,
      current: 0,
      total: 0,
      processed: 0,
      created: 0,
      updated: 0,
      errors: 0,
      message: 'Iniciando sincronización...'
    };

    this.parametrosService.sincronizarEquipos().subscribe({
      next: (response) => {
        console.log('✅ Respuesta de sincronización:', response);
        if (response.success && response.data) {
          this.currentSyncId = response.data.sync_id;
          this.syncProgress.message = 'Sincronización en progreso...';
          
          // Iniciar polling para verificar el estado y progreso
          this.startSyncStatusPolling();
          
          this.showInfo('Sincronización iniciada. Puede tomar varios minutos...');
        } else {
          this.isSyncing = false;
          this.showError(response.message || 'Error al iniciar la sincronización');
        }
      },
      error: (error) => {
        this.isSyncing = false;
        console.error('❌ Error en sincronización:', error);
        this.handleSyncError(error);
      }
    });
  }

  /**
   * Manejar errores de sincronización
   */
  private handleSyncError(error: any, customMessage?: string): void {
    let errorMessage = customMessage || 'Error al iniciar la sincronización';
    
    console.log('🔍 Detalles del error:', {
      status: error.status,
      statusText: error.statusText,
      url: error.url,
      error: error.error
    });
    
    if (error.status === 404) {
      errorMessage = 'La ruta de sincronización no fue encontrada. URL: ' + error.url;
    } else if (error.status === 401) {
      errorMessage = 'No tienes permisos para ejecutar la sincronización. Verifica tu autenticación.';
    } else if (error.status === 403) {
      errorMessage = 'Acceso denegado para ejecutar la sincronización.';
    } else if (error.status === 0) {
      errorMessage = 'No se pudo conectar con el servidor. Verifica la conexión de red.';
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    }
    
    this.showError(errorMessage);
  }

  /**
   * Cancelar sincronización en curso
   */
  cancelarSincronizacion(): void {
    if (!this.currentSyncId) {
      this.isSyncing = false;
      return;
    }

    console.log('⏹️ Cancelando sincronización...');
    this.isCancelling = true;

    this.parametrosService.cancelarSincronizacion(this.currentSyncId).subscribe({
      next: (response) => {
        if (response.success) {
          this.showWarn('Sincronización cancelada');
          this.stopSyncStatusPolling();
          this.isSyncing = false;
          this.isCancelling = false;
          this.currentSyncId = null;
          
          // Recargar datos
          this.loadActivos();
          this.loadStats();
        } else {
          this.isCancelling = false;
          this.showError(response.message || 'Error al cancelar la sincronización');
        }
      },
      error: (error) => {
        this.isCancelling = false;
        console.error('Error cancelando sincronización:', error);
        this.showError(error.error?.message || 'Error al cancelar la sincronización');
      }
    });
  }

  /**
   * Iniciar polling para verificar el estado de la sincronización
   */
  private startSyncStatusPolling(): void {
    // Verificar cada 5 segundos
    this.syncCheckInterval = setInterval(() => {
      if (this.currentSyncId) {
        this.checkSyncStatus();
      }
    }, 5000);
  }

  /**
   * Detener polling de estado
   */
  private stopSyncStatusPolling(): void {
    if (this.syncCheckInterval) {
      clearInterval(this.syncCheckInterval);
      this.syncCheckInterval = null;
    }
  }

  /**
   * Verificar estado de la sincronización
   */
  private checkSyncStatus(): void {
    if (!this.currentSyncId) return;

    this.parametrosService.getEstadoSincronizacion(this.currentSyncId).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const status = response.data.status;
          const progress = response.data.progress;
          
          // Actualizar progreso
          if (progress) {
            this.syncProgress = {
              percentage: progress.percentage || 0,
              current: progress.current || 0,
              total: progress.total || 0,
              processed: progress.processed || 0,
              created: progress.created || 0,
              updated: progress.updated || 0,
              errors: progress.errors || 0,
              message: progress.message || 'Procesando...'
            };
          }
          
          if (status === 'completed') {
            this.showSuccess('Sincronización completada exitosamente');
            this.stopSyncStatusPolling();
            this.isSyncing = false;
            this.currentSyncId = null;
            
            // Recargar todos los datos
            this.loadActivos();
            this.loadStats();
            this.loadEstadisticasPorTipo();
            this.loadEstadisticasPorUbicacion();
            
          } else if (status === 'cancelled') {
            this.stopSyncStatusPolling();
            this.isSyncing = false;
            this.currentSyncId = null;
            
          } else if (status === 'error') {
            this.showError('La sincronización finalizó con errores');
            this.stopSyncStatusPolling();
            this.isSyncing = false;
            this.currentSyncId = null;
          }
          // Si status === 'running', continuar polling
        }
      },
      error: (error) => {
        console.error('Error verificando estado de sincronización:', error);
        // No detener el polling por un error puntual
      }
    });
  }

  /**
   * Obtener texto del botón de sincronización
   */
  getSyncButtonText(): string {
    if (this.isCancelling) {
      return 'Cancelando...';
    }
    if (this.isSyncing) {
      return 'Cancelar Sincronización';
    }
    return 'Sincronizar Equipos';
  }

  /**
   * Limpiar recursos al destruir el componente
   */
  ngOnDestroy(): void {
    this.stopSyncStatusPolling();
  }

  /**
   * Sincronizar un activo individual
   */
  sincronizarActivoIndividual(activo: ActivoMatriz): void {
    if (!activo.id_activo_glpi) {
      this.showError('Este activo no tiene ID de GLPI asociado');
      return;
    }

    console.log('🔄 Sincronizando activo individual:', activo.id_activo_glpi);
    
    // Marcar el activo como sincronizando
    activo.isSyncing = true;

    this.parametrosService.sincronizarActivoEspecifico(activo.id_activo_glpi).subscribe({
      next: (response) => {
        activo.isSyncing = false;
        
        if (response.success) {
          this.showSuccess(`Activo "${activo.nombre_equipo}" sincronizado correctamente`);
          
          // Recargar la lista de activos para mostrar los datos actualizados
          setTimeout(() => {
            this.loadActivos();
            this.loadStats();
            this.loadEstadisticasPorTipo();
            this.loadEstadisticasPorUbicacion();
          }, 1000);
          
        } else {
          this.showError(response.message || 'Error al sincronizar el activo');
        }
      },
      error: (error) => {
        activo.isSyncing = false;
        console.error('Error sincronizando activo individual:', error);
        
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
}

