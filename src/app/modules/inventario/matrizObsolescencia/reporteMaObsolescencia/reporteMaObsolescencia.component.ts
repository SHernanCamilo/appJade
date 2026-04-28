import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatrizObsActivosService, ActivoMatriz, FiltrosActivos } from '../services/matriz-obs-activos.service';
import { CierreInventarioService, CierreInventario } from '../services/cierre-inventario.service';
import { ExcelExportService, ExcelColumn, ExcelReportHeader } from '../../../../core/services/excel-export.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';

// PrimeNG
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { ChartModule } from 'primeng/chart';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { SelectButtonModule } from 'primeng/selectbutton';
import { BadgeModule } from 'primeng/badge';

interface ResumenEmpresa {
  empresa_id: number;
  empresa_nombre: string;
  total: number;
  optimo: number;
  funcional: number;
  potencial: number;
  obsoleto: number;
  puntaje_promedio: number;
  porcentaje_optimo: number;
  porcentaje_obsoleto: number;
}

interface FiltroOption {
  label: string;
  value: any;
}

@Component({
  selector: 'app-reporte-ma-obsolescencia',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ButtonModule,
    ToastModule,
    TableModule,
    TagModule,
    InputTextModule,
    MultiSelectModule,
    SkeletonModule,
    TooltipModule,
    ChartModule,
    CardModule,
    DividerModule,
    SelectButtonModule,
    BadgeModule,
    HasPermissionDirective
  ],
  providers: [MessageService],
  templateUrl: './reporteMaObsolescencia.component.html',
  styleUrl: './reporteMaObsolescencia.component.css'
})
export class ReporteMaObsolescenciaComponent implements OnInit, OnDestroy {

  // ─── Estado de carga ───────────────────────────────────────────────────────
  isLoadingInicial = false;
  isExporting = false;

  // ─── Dataset completo (fuente de verdad) ──────────────────────────────────
  private _todosLosActivos: ActivoMatriz[] = [];
  get todosLosActivos(): ActivoMatriz[] { return this._todosLosActivos; }

  // ─── Filtros multi-selección ───────────────────────────────────────────────
  selectedEmpresas:   number[]  = [];
  selectedSucursales: number[]  = [];
  selectedSedes:      number[]  = [];
  selectedEstados:    string[]  = [];
  selectedTipos:      string[]  = [];
  selectedMarcas:     string[]  = [];
  searchTerm = '';

  // Opciones de filtros (construidas desde los datos)
  empresasOptions:   FiltroOption[] = [];
  sucursalesOptions: FiltroOption[] = [];
  sedesOptions:      FiltroOption[] = [];
  tiposOptions:      FiltroOption[] = [];
  marcasOptions:     FiltroOption[] = [];

  estadosOptions: FiltroOption[] = [
    { label: 'Óptimo',        value: 'optimo'    },
    { label: 'Funcional',     value: 'funcional' },
    { label: 'Potencializar', value: 'potencial' },
    { label: 'Obsoleto',      value: 'obsoleto'  }
  ];

  // ─── Datos procesados (resultado de aplicar filtros) ──────────────────────
  activosFiltrados: ActivoMatriz[] = [];
  resumenPorEmpresa: ResumenEmpresa[] = [];
  totalGeneral = { total: 0, optimo: 0, funcional: 0, potencial: 0, obsoleto: 0, puntaje_promedio: 0 };

  // ─── Gráficos ──────────────────────────────────────────────────────────────
  barChartData: any = {};
  barChartOptions: any = {};
  donutChartData: any = {};
  donutChartOptions: any = {};

  // ─── Gráfico de línea (evolución por cierres) ──────────────────────────────
  lineChartData: any = {};
  lineChartOptions: any = {};
  isLoadingCierres = false;
  private _todosCierres: CierreInventario[] = [];

  // ─── Vista ─────────────────────────────────────────────────────────────────
  vistaOptions = [
    { label: 'Resumen', value: 'resumen' },
    { label: 'Detalle', value: 'detalle' }
  ];
  vistaActual = 'resumen';

  // ─── Paginación tabla detalle (client-side) ────────────────────────────────
  paginaActual = 0;
  rowsPerPage  = 25;

  get activosPaginados(): ActivoMatriz[] {
    const start = this.paginaActual * this.rowsPerPage;
    return this.activosFiltrados.slice(start, start + this.rowsPerPage);
  }

  // ─── Chips de filtros activos ──────────────────────────────────────────────
  get hayFiltrosActivos(): boolean {
    return (
      this.selectedEmpresas.length > 0   ||
      this.selectedSucursales.length > 0 ||
      this.selectedSedes.length > 0      ||
      this.selectedEstados.length > 0    ||
      this.selectedTipos.length > 0      ||
      this.selectedMarcas.length > 0     ||
      this.searchTerm.trim().length > 0
    );
  }

  get totalFiltrosActivos(): number {
    return (
      this.selectedEmpresas.length   +
      this.selectedSucursales.length +
      this.selectedSedes.length      +
      this.selectedEstados.length    +
      this.selectedTipos.length      +
      this.selectedMarcas.length     +
      (this.searchTerm.trim() ? 1 : 0)
    );
  }

  constructor(
    private activosService: MatrizObsActivosService,
    private cierreService: CierreInventarioService,
    private messageService: MessageService,
    private excelExportService: ExcelExportService,
    public permissionService: PermissionService
  ) {}

  ngOnInit(): void {
    this.initChartOptions();
    this.cargarTodosLosActivos();
    this.cargarGraficaCierres();
  }

  ngOnDestroy(): void {}

  // ─── Carga inicial (una sola vez) ──────────────────────────────────────────

  cargarTodosLosActivos(): void {
    this.isLoadingInicial = true;

    this.activosService.getActivosPorPermisos({ per_page: 9999 }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this._todosLosActivos = response.data;
          this.construirOpcionesDeFiltros(response.data);
          this.aplicarFiltros();
        }
        this.isLoadingInicial = false;
      },
      error: () => {
        this.showError('Error al cargar los datos del reporte');
        this.isLoadingInicial = false;
      }
    });
  }

  // ─── Construcción de opciones ──────────────────────────────────────────────

  private construirOpcionesDeFiltros(activos: ActivoMatriz[]): void {
    const empMap  = new Map<number, string>();
    const sucMap  = new Map<number, string>();
    const sedMap  = new Map<number, string>();
    const tipSet  = new Set<string>();
    const marSet  = new Set<string>();

    activos.forEach(a => {
      if (a.id_empresa  && a.empresa)  empMap.set(a.id_empresa,  a.empresa.nombre);
      if (a.id_sucursal && a.sucursal) sucMap.set(a.id_sucursal, a.sucursal.nombre);
      if (a.id_sede     && a.sede)     sedMap.set(a.id_sede,     a.sede.nombre);
      if (a.detalle?.tipo)  tipSet.add(a.detalle.tipo);
      if (a.detalle?.marca) marSet.add(a.detalle.marca);
    });

    this.empresasOptions   = this.mapToOptions(empMap);
    this.sucursalesOptions = this.mapToOptions(sucMap);
    this.sedesOptions      = this.mapToOptions(sedMap);
    this.tiposOptions      = Array.from(tipSet).sort().map(v => ({ label: v, value: v }));
    this.marcasOptions     = Array.from(marSet).sort().map(v => ({ label: v, value: v }));
  }

  private mapToOptions(map: Map<number, string>): FiltroOption[] {
    return Array.from(map.entries())
      .map(([value, label]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  // ─── Filtrado local ────────────────────────────────────────────────────────

  aplicarFiltros(): void {
    this.paginaActual = 0;
    const term = this.searchTerm.trim().toLowerCase();

    this.activosFiltrados = this._todosLosActivos.filter(a => {
      // Empresa
      if (this.selectedEmpresas.length > 0 && !this.selectedEmpresas.includes(a.id_empresa)) return false;
      // Sucursal
      if (this.selectedSucursales.length > 0 && (!a.id_sucursal || !this.selectedSucursales.includes(a.id_sucursal))) return false;
      // Sede
      if (this.selectedSedes.length > 0 && (!a.id_sede || !this.selectedSedes.includes(a.id_sede))) return false;
      // Estado
      if (this.selectedEstados.length > 0 && !this.selectedEstados.includes(this.getEstadoActivo(a))) return false;
      // Tipo
      if (this.selectedTipos.length > 0 && (!a.detalle?.tipo || !this.selectedTipos.includes(a.detalle.tipo))) return false;
      // Marca
      if (this.selectedMarcas.length > 0 && (!a.detalle?.marca || !this.selectedMarcas.includes(a.detalle.marca))) return false;
      // Búsqueda de texto
      if (term) {
        const haystack = [
          a.nombre_equipo, a.agente, a.serial, a.placa,
          a.empresa?.nombre, a.sucursal?.nombre, a.sede?.nombre,
          a.detalle?.tipo, a.detalle?.marca, a.detalle?.procesador,
          a.detalle?.sistema_operativo, a.usuario_glpi
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });

    this.procesarResumen(this.activosFiltrados);
  }

  limpiarFiltros(): void {
    this.selectedEmpresas   = [];
    this.selectedSucursales = [];
    this.selectedSedes      = [];
    this.selectedEstados    = [];
    this.selectedTipos      = [];
    this.selectedMarcas     = [];
    this.searchTerm         = '';
    this.aplicarFiltros();
  }

  onVistaChange(): void {
    this.paginaActual = 0;
  }

  onPageChange(event: any): void {
    this.paginaActual = Math.floor(event.first / event.rows);
    this.rowsPerPage  = event.rows;
  }

  // ─── Procesamiento de resumen ──────────────────────────────────────────────

  private procesarResumen(activos: ActivoMatriz[]): void {
    const empresaMap = new Map<number, ResumenEmpresa>();

    activos.forEach(activo => {
      const empId  = activo.id_empresa || 0;
      const empNom = activo.empresa?.nombre || 'Sin empresa';
      const estado = this.getEstadoActivo(activo);

      if (!empresaMap.has(empId)) {
        empresaMap.set(empId, {
          empresa_id: empId, empresa_nombre: empNom,
          total: 0, optimo: 0, funcional: 0, potencial: 0, obsoleto: 0,
          puntaje_promedio: 0, porcentaje_optimo: 0, porcentaje_obsoleto: 0
        });
      }

      const r = empresaMap.get(empId)!;
      r.total++;
      r.puntaje_promedio += Number(activo.puntaje) || 0;
      if      (estado === 'optimo')    r.optimo++;
      else if (estado === 'funcional') r.funcional++;
      else if (estado === 'potencial') r.potencial++;
      else                             r.obsoleto++;
    });

    this.resumenPorEmpresa = Array.from(empresaMap.values()).map(r => ({
      ...r,
      puntaje_promedio:    r.total > 0 ? Math.round(r.puntaje_promedio / r.total) : 0,
      porcentaje_optimo:   r.total > 0 ? Math.round((r.optimo   / r.total) * 100) : 0,
      porcentaje_obsoleto: r.total > 0 ? Math.round((r.obsoleto / r.total) * 100) : 0
    })).sort((a, b) => b.total - a.total);

    const tot = this.resumenPorEmpresa.reduce(
      (acc, r) => ({
        total: acc.total + r.total,
        optimo: acc.optimo + r.optimo,
        funcional: acc.funcional + r.funcional,
        potencial: acc.potencial + r.potencial,
        obsoleto: acc.obsoleto + r.obsoleto,
        puntaje_promedio: acc.puntaje_promedio + r.puntaje_promedio * r.total
      }),
      { total: 0, optimo: 0, funcional: 0, potencial: 0, obsoleto: 0, puntaje_promedio: 0 }
    );

    this.totalGeneral = {
      ...tot,
      puntaje_promedio: tot.total > 0 ? Math.round(tot.puntaje_promedio / tot.total) : 0
    };

    this.actualizarGraficos();
    this.actualizarGraficaLinea();
  }

  // ─── Gráficos ──────────────────────────────────────────────────────────────

  private initChartOptions(): void {
    this.barChartOptions = {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, padding: 15, font: { size: 11 } } },
        tooltip: { callbacks: { label: (ctx: any) => `${ctx.dataset.label}: ${ctx.parsed.x} equipos` } }
      },
      scales: {
        x: { stacked: true, beginAtZero: true },
        y: { stacked: true, ticks: { font: { size: 10 } } }
      }
    };

    this.donutChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, padding: 15 } },
        tooltip: {
          callbacks: {
            label: (ctx: any) => {
              const total = ctx.dataset.data.reduce((a: number, b: number) => a + b, 0);
              const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : '0';
              return `${ctx.label}: ${ctx.parsed} (${pct}%)`;
            }
          }
        }
      }
    };

    this.lineChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16, font: { size: 12 } } },
        tooltip: {
          callbacks: {
            label: (ctx: any) => `${ctx.dataset.label}: ${ctx.parsed.y} equipos`
          }
        }
      },
      scales: {
        x: {
          ticks: { font: { size: 11 }, maxRotation: 35 },
          grid: { color: 'rgba(0,0,0,0.05)' }
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Estado (equipos)', font: { size: 12 } },
          grid: { color: 'rgba(0,0,0,0.05)' }
        }
      }
    };
  }

  private actualizarGraficos(): void {
    const top10 = this.resumenPorEmpresa.slice(0, 10);
    this.barChartData = {
      labels: top10.map(r => r.empresa_nombre),
      datasets: [
        { label: 'Óptimo',        data: top10.map(r => r.optimo),    backgroundColor: '#10B981' },
        { label: 'Funcional',     data: top10.map(r => r.funcional), backgroundColor: '#3B82F6' },
        { label: 'Potencializar', data: top10.map(r => r.potencial), backgroundColor: '#F59E0B' },
        { label: 'Obsoleto',      data: top10.map(r => r.obsoleto),  backgroundColor: '#EF4444' }
      ]
    };

    this.donutChartData = {
      labels: ['Óptimo', 'Funcional', 'Potencializar', 'Obsoleto'],
      datasets: [{
        data: [this.totalGeneral.optimo, this.totalGeneral.funcional, this.totalGeneral.potencial, this.totalGeneral.obsoleto],
        backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#EF4444'],
        borderWidth: 2, borderColor: '#ffffff'
      }]
    };
  }

  cargarGraficaCierres(): void {
    this.isLoadingCierres = true;
    this.cierreService.getCierres({ per_page: 50 }).subscribe({
      next: (res) => {
        this._todosCierres = res.data
          .filter(c => c.estado === 'cerrado' && c.fecha_fin_proceso)
          .sort((a, b) => new Date(a.fecha_fin_proceso!).getTime() - new Date(b.fecha_fin_proceso!).getTime());
        this.isLoadingCierres = false;
        this.actualizarGraficaLinea();
      },
      error: () => { this.isLoadingCierres = false; }
    });
  }

  private actualizarGraficaLinea(): void {
    const cierres = this._todosCierres;
    if (!cierres.length) { this.lineChartData = {}; return; }

    const labels = cierres.map(c => {
      const d = new Date(c.fecha_fin_proceso!);
      return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' });
    });

    // Si hay filtro de empresa, recalcular proporciones usando los activos filtrados
    const empresasFiltradas = this.selectedEmpresas;
    let optimos: number[], funcionales: number[], potenciales: number[], obsoletos: number[];

    if (empresasFiltradas.length > 0) {
      // Calcular la proporción de cada empresa en el total actual y aplicarla a los cierres
      const totalFiltrado = this.activosFiltrados.length || 1;
      const totalGlobal   = this._todosLosActivos.length || 1;
      const ratio = totalFiltrado / totalGlobal;

      optimos     = cierres.map(c => Math.round((c.total_optimo    ?? 0) * ratio));
      funcionales = cierres.map(c => Math.round((c.total_funcional ?? 0) * ratio));
      potenciales = cierres.map(c => Math.round((c.total_potencial ?? 0) * ratio));
      obsoletos   = cierres.map(c => Math.round((c.total_obsoleto  ?? 0) * ratio));
    } else {
      optimos     = cierres.map(c => c.total_optimo    ?? 0);
      funcionales = cierres.map(c => c.total_funcional ?? 0);
      potenciales = cierres.map(c => c.total_potencial ?? 0);
      obsoletos   = cierres.map(c => c.total_obsoleto  ?? 0);
    }

    const makeDataset = (label: string, data: number[], color: string) => ({
      label,
      data,
      borderColor: color,
      backgroundColor: color + '22',
      pointBackgroundColor: color,
      pointRadius: 4,
      pointHoverRadius: 6,
      tension: 0.3,
      fill: false
    });

    this.lineChartData = {
      labels,
      datasets: [
        makeDataset('Óptimo',        optimos,     '#10B981'),
        makeDataset('Funcional',     funcionales, '#3B82F6'),
        makeDataset('Potencializar', potenciales, '#F59E0B'),
        makeDataset('Obsoleto',      obsoletos,   '#EF4444'),
      ]
    };
  }

  // ─── Helpers de estado ─────────────────────────────────────────────────────

  getEstadoActivo(activo: ActivoMatriz): string {
    const p = Number(activo.puntaje);
    if (p >= 100)            return 'optimo';
    if (p >= 60 && p < 100) return 'funcional';
    if (p > 0  && p < 60)   return 'potencial';
    return 'obsoleto';
  }

  getPuntajeSeverity(puntaje: number): 'success' | 'info' | 'warn' | 'danger' {
    if (puntaje >= 100) return 'success';
    if (puntaje >= 60)  return 'info';
    if (puntaje > 0)    return 'warn';
    return 'danger';
  }

  getEstadoLabel(estado: string): string {
    const map: Record<string, string> = {
      optimo: 'Óptimo', funcional: 'Funcional', potencial: 'Potencializar', obsoleto: 'Obsoleto'
    };
    return map[estado] || estado;
  }

  getEstadoSeverity(estado: string): 'success' | 'info' | 'warn' | 'danger' {
    const map: Record<string, 'success' | 'info' | 'warn' | 'danger'> = {
      optimo: 'success', funcional: 'info', potencial: 'warn', obsoleto: 'danger'
    };
    return map[estado] || 'info';
  }

  getSaludColor(porcentaje: number): string {
    if (porcentaje >= 70) return '#10B981';
    if (porcentaje >= 40) return '#F59E0B';
    return '#EF4444';
  }

  getBarWidth(valor: number, total: number): number {
    return total > 0 ? Math.round((valor / total) * 100) : 0;
  }

  // ─── Chips: etiquetas de filtros activos ───────────────────────────────────

  getChipsFiltros(): { label: string; tipo: string; value: any }[] {
    const chips: { label: string; tipo: string; value: any }[] = [];

    this.selectedEmpresas.forEach(v => {
      const o = this.empresasOptions.find(x => x.value === v);
      if (o) chips.push({ label: o.label, tipo: 'empresa', value: v });
    });
    this.selectedSucursales.forEach(v => {
      const o = this.sucursalesOptions.find(x => x.value === v);
      if (o) chips.push({ label: o.label, tipo: 'sucursal', value: v });
    });
    this.selectedSedes.forEach(v => {
      const o = this.sedesOptions.find(x => x.value === v);
      if (o) chips.push({ label: o.label, tipo: 'sede', value: v });
    });
    this.selectedEstados.forEach(v => {
      chips.push({ label: this.getEstadoLabel(v), tipo: 'estado', value: v });
    });
    this.selectedTipos.forEach(v => {
      chips.push({ label: v, tipo: 'tipo', value: v });
    });
    this.selectedMarcas.forEach(v => {
      chips.push({ label: v, tipo: 'marca', value: v });
    });
    if (this.searchTerm.trim()) {
      chips.push({ label: `"${this.searchTerm.trim()}"`, tipo: 'search', value: this.searchTerm });
    }
    return chips;
  }

  removerChip(chip: { tipo: string; value: any }): void {
    switch (chip.tipo) {
      case 'empresa':   this.selectedEmpresas   = this.selectedEmpresas.filter(v => v !== chip.value); break;
      case 'sucursal':  this.selectedSucursales = this.selectedSucursales.filter(v => v !== chip.value); break;
      case 'sede':      this.selectedSedes      = this.selectedSedes.filter(v => v !== chip.value); break;
      case 'estado':    this.selectedEstados    = this.selectedEstados.filter(v => v !== chip.value); break;
      case 'tipo':      this.selectedTipos      = this.selectedTipos.filter(v => v !== chip.value); break;
      case 'marca':     this.selectedMarcas     = this.selectedMarcas.filter(v => v !== chip.value); break;
      case 'search':    this.searchTerm = ''; break;
    }
    this.aplicarFiltros();
  }

  // ─── Exportar ──────────────────────────────────────────────────────────────

  exportarReporte(): void {
    this.isExporting = true;
    this.generarExcelReporte(this.activosFiltrados)
      .then(() => {
        this.showSuccess('Reporte exportado correctamente');
        this.isExporting = false;
      })
      .catch(() => {
        this.showError('Error al generar el archivo Excel');
        this.isExporting = false;
      });
  }

  private async generarExcelReporte(activos: ActivoMatriz[]): Promise<void> {
    const header: ExcelReportHeader = {
      title: 'Reporte Matriz de Obsolescencia',
      subtitle: `Generado el ${new Date().toLocaleDateString('es-CO')} | ${this.buildFilterDescription()}`
    };

    const columns: ExcelColumn[] = [
      { header: 'Empresa',        key: 'empresa',     width: 30 },
      { header: 'Sucursal',       key: 'sucursal',    width: 25 },
      { header: 'Sede',           key: 'sede',        width: 20 },
      { header: 'Nombre Equipo',  key: 'nombre',      width: 30 },
      { header: 'Agente',         key: 'agente',      width: 15 },
      { header: 'Serial',         key: 'serial',      width: 18 },
      { header: 'Tipo',           key: 'tipo',        width: 18 },
      { header: 'Marca',          key: 'marca',       width: 18 },
      { header: 'Procesador',     key: 'procesador',  width: 25 },
      { header: 'RAM (GB)',       key: 'ram',         width: 12 },
      { header: 'Disco (GB)',     key: 'disco',       width: 12 },
      { header: 'S.O.',           key: 'so',          width: 25 },
      { header: 'Puntaje (%)',    key: 'puntaje',     width: 14 },
      { header: 'Estado',         key: 'estado',      width: 16 },
      { header: 'Fecha Compra',   key: 'fecha',       width: 16 },
      { header: 'Edad (años)',    key: 'edad',        width: 14 },
      { header: 'Incidencias 6m', key: 'incidencias', width: 16 }
    ];

    const rows = activos.map(a => ({
      empresa:     a.empresa?.nombre || '-',
      sucursal:    a.sucursal?.nombre || '-',
      sede:        a.sede?.nombre || '-',
      nombre:      a.nombre_equipo,
      agente:      a.agente,
      serial:      a.serial || '-',
      tipo:        a.detalle?.tipo || '-',
      marca:       a.detalle?.marca || '-',
      procesador:  a.detalle?.procesador || '-',
      ram:         a.detalle?.tamano_ram ?? '-',
      disco:       a.detalle?.tamano_disco ?? '-',
      so:          a.detalle?.sistema_operativo || '-',
      puntaje:     a.puntaje,
      estado:      this.getEstadoLabel(this.getEstadoActivo(a)),
      fecha:       a.detalle?.fecha_compra || '-',
      edad:        a.detalle?.edad ?? '-',
      incidencias: a.detalle?.incidencias_6_meses ?? 0
    }));

    await this.excelExportService.exportToExcel(
      rows, columns, 'Reporte Matriz', 'reporte-matriz-obsolescencia', undefined, header
    );
  }

  private buildFilterDescription(): string {
    const parts: string[] = [];
    if (this.selectedEmpresas.length)   parts.push(`Empresas: ${this.selectedEmpresas.map(v => this.empresasOptions.find(o => o.value === v)?.label).join(', ')}`);
    if (this.selectedSucursales.length) parts.push(`Sucursales: ${this.selectedSucursales.map(v => this.sucursalesOptions.find(o => o.value === v)?.label).join(', ')}`);
    if (this.selectedSedes.length)      parts.push(`Sedes: ${this.selectedSedes.map(v => this.sedesOptions.find(o => o.value === v)?.label).join(', ')}`);
    if (this.selectedEstados.length)    parts.push(`Estados: ${this.selectedEstados.map(v => this.getEstadoLabel(v)).join(', ')}`);
    if (this.selectedTipos.length)      parts.push(`Tipos: ${this.selectedTipos.join(', ')}`);
    if (this.selectedMarcas.length)     parts.push(`Marcas: ${this.selectedMarcas.join(', ')}`);
    if (this.searchTerm.trim())         parts.push(`Búsqueda: "${this.searchTerm.trim()}"`);
    return parts.length > 0 ? parts.join(' | ') : 'Sin filtros aplicados';
  }

  // ─── Notificaciones ────────────────────────────────────────────────────────

  private showSuccess(msg: string): void {
    this.messageService.add({ severity: 'success', summary: 'Éxito', detail: msg, life: 3000 });
  }

  private showError(msg: string): void {
    this.messageService.add({ severity: 'error', summary: 'Error', detail: msg, life: 5000 });
  }
}
