import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  CierreInventarioService,
  CierreInventario,
  CierreDetalle,
  CierreConfig,
  ResumenEmpresaCierre,
  ComparacionCierres,
} from '../services/cierre-inventario.service';
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';

// PrimeNG
import { ButtonModule }      from 'primeng/button';
import { ToastModule }       from 'primeng/toast';
import { TableModule }       from 'primeng/table';
import { TagModule }         from 'primeng/tag';
import { InputTextModule }   from 'primeng/inputtext';
import { SkeletonModule }    from 'primeng/skeleton';
import { TooltipModule }     from 'primeng/tooltip';
import { ChartModule }       from 'primeng/chart';
import { DialogModule }      from 'primeng/dialog';
import { DropdownModule }    from 'primeng/dropdown';
import { InputSwitchModule } from 'primeng/inputswitch';
import { InputNumberModule } from 'primeng/inputnumber';
import { TabViewModule }     from 'primeng/tabview';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { TextareaModule }    from 'primeng/textarea';

@Component({
  selector: 'app-cierre-inventario',
  standalone: true,
  imports: [
    CommonModule, RouterModule, FormsModule,
    ButtonModule, ToastModule, TableModule, TagModule,
    InputTextModule, SkeletonModule, TooltipModule,
    ChartModule, DialogModule, DropdownModule,
    InputSwitchModule, InputNumberModule, TabViewModule,
    ConfirmDialogModule, TextareaModule,
    HasPermissionDirective,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './cierreInventario.component.html',
  styleUrl:    './cierreInventario.component.css',
})
export class CierreInventarioComponent implements OnInit, OnDestroy {

  // ─── Estado de carga ───────────────────────────────────────────────────────
  isLoadingLista    = false;
  isEjecutando      = false;
  isLoadingDetalle  = false;
  isLoadingResumen  = false;
  isLoadingConfig   = false;
  isSavingConfig    = false;
  isLoadingCompar   = false;

  // ─── Lista de cierres ──────────────────────────────────────────────────────
  cierres:      CierreInventario[] = [];
  totalCierres  = 0;
  paginaCierres = 1;
  rowsCierres   = 10;

  // ─── Modal: Nuevo cierre ───────────────────────────────────────────────────
  mostrarModalNuevo = false;
  nuevoCierre = { nombre: '', periodo: '', descripcion: '' };

  // ─── Modal: Detalle de cierre ──────────────────────────────────────────────
  mostrarModalDetalle  = false;
  cierreSeleccionado:  CierreInventario | null = null;
  detalleActivos:      CierreDetalle[] = [];
  totalDetalle         = 0;
  paginaDetalle        = 1;
  rowsDetalle          = 25;
  searchDetalle        = '';
  filtroEstadoDetalle: string | null = null;
  resumenEmpresas:     ResumenEmpresaCierre[] = [];
  tabDetalleActivo     = 0;

  // Gráfico del detalle
  donutDetalle:    any = {};
  donutOpts:       any = {};
  barEmpresa:      any = {};
  barEmpresaOpts:  any = {};

  // ─── Modal: Configuración ──────────────────────────────────────────────────
  mostrarModalConfig = false;
  config: CierreConfig = {
    id: 1,
    recalcular_antes_de_cerrar: true,
    incluir_sin_puntaje:        true,
    incluir_inactivos:          false,
    notificar_al_cerrar:        false,
    emails_notificacion:        null,
    max_cierres_a_conservar:    24,
    modificado_por:             null,
    updated_at:                 '',
  };

  // ─── Modal: Comparación ────────────────────────────────────────────────────
  mostrarModalCompar  = false;
  cierreAId:  number | null = null;
  cierreBId:  number | null = null;
  comparacion: ComparacionCierres | null = null;
  cierresOptions: { label: string; value: number }[] = [];

  // ─── Filtros de estado para dropdown ──────────────────────────────────────
  estadosDetalleOpts = [
    { label: 'Todos',         value: null },
    { label: 'Óptimo',        value: 'optimo' },
    { label: 'Funcional',     value: 'funcional' },
    { label: 'Potencializar', value: 'potencial' },
    { label: 'Obsoleto',      value: 'obsoleto' },
  ];

  constructor(
    private svc:         CierreInventarioService,
    private msgSvc:      MessageService,
    private confirmSvc:  ConfirmationService,
  ) {}

  ngOnInit(): void {
    this.initChartOpts();
    this.cargarCierres();
  }

  ngOnDestroy(): void {}

  // ─── Carga de lista ────────────────────────────────────────────────────────

  cargarCierres(): void {
    this.isLoadingLista = true;
    this.svc.getCierres({ page: this.paginaCierres, per_page: this.rowsCierres }).subscribe({
      next: (r) => {
        this.cierres      = r.data;
        this.totalCierres = r.total;
        this.cierresOptions = r.data
          .filter(c => c.estado === 'cerrado')
          .map(c => ({ label: `${c.nombre} (${c.periodo ?? c.created_at.slice(0,10)})`, value: c.id }));
        this.isLoadingLista = false;
      },
      error: (e) => { this.showError(e.message); this.isLoadingLista = false; },
    });
  }

  onPageCierres(event: any): void {
    this.paginaCierres = Math.floor(event.first / event.rows) + 1;
    this.rowsCierres   = event.rows;
    this.cargarCierres();
  }

  // ─── Nuevo cierre ──────────────────────────────────────────────────────────

  abrirModalNuevo(): void {
    this.nuevoCierre = { nombre: '', periodo: '', descripcion: '' };
    this.mostrarModalNuevo = true;
  }

  ejecutarCierre(): void {
    if (!this.nuevoCierre.nombre.trim()) {
      this.showWarn('El nombre del cierre es obligatorio');
      return;
    }

    this.isEjecutando = true;
    this.svc.crearCierre({
      nombre:      this.nuevoCierre.nombre.trim(),
      periodo:     this.nuevoCierre.periodo.trim() || undefined,
      descripcion: this.nuevoCierre.descripcion.trim() || undefined,
    }).subscribe({
      next: (r) => {
        this.mostrarModalNuevo = false;
        this.isEjecutando      = false;
        if (r.data.estado === 'cerrado') {
          this.showSuccess(r.message);
        } else {
          this.showWarn(`Cierre creado con estado: ${r.data.estado}. ${r.data.mensaje_error ?? ''}`);
        }
        this.cargarCierres();
      },
      error: (e) => {
        this.isEjecutando = false;
        this.showError(e.message);
      },
    });
  }

  // ─── Ver detalle ───────────────────────────────────────────────────────────

  verDetalle(cierre: CierreInventario): void {
    this.cierreSeleccionado = cierre;
    this.tabDetalleActivo   = 0;
    this.paginaDetalle      = 1;
    this.searchDetalle      = '';
    this.filtroEstadoDetalle = null;
    this.mostrarModalDetalle = true;
    this.cargarDetalleActivos();
    this.cargarResumenEmpresas();
  }

  cargarDetalleActivos(): void {
    if (!this.cierreSeleccionado) return;
    this.isLoadingDetalle = true;
    this.svc.getDetalle(this.cierreSeleccionado.id, {
      page:                this.paginaDetalle,
      per_page:            this.rowsDetalle,
      search:              this.searchDetalle || undefined,
      estado_obsolescencia: this.filtroEstadoDetalle ?? undefined,
    }).subscribe({
      next: (r) => {
        this.detalleActivos = r.data;
        this.totalDetalle   = r.total;
        this.isLoadingDetalle = false;
      },
      error: (e) => { this.showError(e.message); this.isLoadingDetalle = false; },
    });
  }

  cargarResumenEmpresas(): void {
    if (!this.cierreSeleccionado) return;
    this.isLoadingResumen = true;
    this.svc.getResumenPorEmpresa(this.cierreSeleccionado.id).subscribe({
      next: (r) => {
        this.resumenEmpresas = r.data;
        this.actualizarGraficosDetalle();
        this.isLoadingResumen = false;
      },
      error: (e) => { this.showError(e.message); this.isLoadingResumen = false; },
    });
  }

  onPageDetalle(event: any): void {
    this.paginaDetalle = Math.floor(event.first / event.rows) + 1;
    this.rowsDetalle   = event.rows;
    this.cargarDetalleActivos();
  }

  buscarEnDetalle(): void {
    this.paginaDetalle = 1;
    this.cargarDetalleActivos();
  }

  onFiltroEstadoChange(): void {
    this.paginaDetalle = 1;
    this.cargarDetalleActivos();
  }

  // ─── Configuración ─────────────────────────────────────────────────────────

  abrirConfig(): void {
    this.isLoadingConfig = true;
    this.mostrarModalConfig = true;
    this.svc.getConfig().subscribe({
      next: (r) => { this.config = r.data; this.isLoadingConfig = false; },
      error: (e) => { this.showError(e.message); this.isLoadingConfig = false; },
    });
  }

  guardarConfig(): void {
    this.isSavingConfig = true;
    this.svc.updateConfig(this.config).subscribe({
      next: (r) => {
        this.config = r.data;
        this.isSavingConfig = false;
        this.mostrarModalConfig = false;
        this.showSuccess(r.message);
      },
      error: (e) => { this.showError(e.message); this.isSavingConfig = false; },
    });
  }

  // ─── Comparación ───────────────────────────────────────────────────────────

  abrirComparacion(): void {
    this.comparacion    = null;
    this.cierreAId      = null;
    this.cierreBId      = null;
    this.mostrarModalCompar = true;
  }

  ejecutarComparacion(): void {
    if (!this.cierreAId || !this.cierreBId) {
      this.showWarn('Selecciona dos cierres para comparar');
      return;
    }
    this.isLoadingCompar = true;
    this.svc.compararCierres(this.cierreAId, this.cierreBId).subscribe({
      next: (r) => { this.comparacion = r.data; this.isLoadingCompar = false; },
      error: (e) => { this.showError(e.message); this.isLoadingCompar = false; },
    });
  }

  // ─── Eliminar ──────────────────────────────────────────────────────────────

  confirmarEliminar(cierre: CierreInventario): void {
    this.confirmSvc.confirm({
      message: `¿Eliminar el cierre "<strong>${cierre.nombre}</strong>"? Esta acción no se puede deshacer.`,
      header:  'Confirmar eliminación',
      icon:    'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.eliminarCierre(cierre.id),
    });
  }

  private eliminarCierre(id: number): void {
    this.svc.eliminarCierre(id).subscribe({
      next: (r) => { this.showSuccess(r.message); this.cargarCierres(); },
      error: (e) => this.showError(e.message),
    });
  }

  // ─── Gráficos ──────────────────────────────────────────────────────────────

  private initChartOpts(): void {
    this.donutOpts = {
      responsive: true, maintainAspectRatio: false, cutout: '60%',
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, padding: 12, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: (ctx: any) => {
              const total = ctx.dataset.data.reduce((a: number, b: number) => a + b, 0);
              const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : '0';
              return `${ctx.label}: ${ctx.parsed} (${pct}%)`;
            },
          },
        },
      },
    };

    this.barEmpresaOpts = {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, padding: 12, font: { size: 11 } } },
        tooltip: { callbacks: { label: (ctx: any) => `${ctx.dataset.label}: ${ctx.parsed.x}` } },
      },
      scales: {
        x: { stacked: true, beginAtZero: true },
        y: { stacked: true, ticks: { font: { size: 10 } } },
      },
    };
  }

  private actualizarGraficosDetalle(): void {
    if (!this.cierreSeleccionado) return;
    const c = this.cierreSeleccionado;

    // Donut global del cierre
    this.donutDetalle = {
      labels: ['Óptimo', 'Funcional', 'Potencializar', 'Obsoleto'],
      datasets: [{
        data: [c.total_optimo, c.total_funcional, c.total_potencial, c.total_obsoleto],
        backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#EF4444'],
        borderWidth: 2, borderColor: '#fff',
      }],
    };

    // Barra por empresa (top 10)
    const top10 = this.resumenEmpresas.slice(0, 10);
    this.barEmpresa = {
      labels: top10.map(r => r.nombre_empresa ?? 'Sin empresa'),
      datasets: [
        { label: 'Óptimo',        data: top10.map(r => r.optimo),    backgroundColor: '#10B981' },
        { label: 'Funcional',     data: top10.map(r => r.funcional), backgroundColor: '#3B82F6' },
        { label: 'Potencializar', data: top10.map(r => r.potencial), backgroundColor: '#F59E0B' },
        { label: 'Obsoleto',      data: top10.map(r => r.obsoleto),  backgroundColor: '#EF4444' },
      ],
    };
  }

  // ─── Helpers de UI ─────────────────────────────────────────────────────────

  getEstadoCierreSeverity(estado: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary'> = {
      cerrado:    'success',
      procesando: 'info',
      pendiente:  'warn',
      error:      'danger',
    };
    return map[estado] ?? 'secondary';
  }

  getEstadoCierreLabel(estado: string): string {
    const map: Record<string, string> = {
      cerrado: 'Cerrado', procesando: 'Procesando',
      pendiente: 'Pendiente', error: 'Error',
    };
    return map[estado] ?? estado;
  }

  getEstadoObsSeverity(estado: string): 'success' | 'info' | 'warn' | 'danger' {
    const map: Record<string, 'success' | 'info' | 'warn' | 'danger'> = {
      optimo: 'success', funcional: 'info', potencial: 'warn', obsoleto: 'danger',
    };
    return map[estado] ?? 'info';
  }

  getEstadoObsLabel(estado: string): string {
    const map: Record<string, string> = {
      optimo: 'Óptimo', funcional: 'Funcional', potencial: 'Potencializar', obsoleto: 'Obsoleto',
    };
    return map[estado] ?? estado;
  }

  getDeltaClass(delta: number): string {
    if (delta > 0) return 'delta-positivo';
    if (delta < 0) return 'delta-negativo';
    return 'delta-neutro';
  }

  getDeltaIcon(delta: number): string {
    if (delta > 0) return 'pi pi-arrow-up';
    if (delta < 0) return 'pi pi-arrow-down';
    return 'pi pi-minus';
  }

  /** Para obsoleto y potencial, subir es malo (rojo) */
  getDeltaClassInverso(delta: number): string {
    if (delta > 0) return 'delta-negativo';
    if (delta < 0) return 'delta-positivo';
    return 'delta-neutro';
  }

  getBarWidth(valor: number, total: number): number {
    return total > 0 ? Math.round((valor / total) * 100) : 0;
  }

  getSaludColor(pct: number): string {
    if (pct >= 70) return '#10B981';
    if (pct >= 40) return '#F59E0B';
    return '#EF4444';
  }

  formatDate(iso: string | null): string {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('es-CO', {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  }

  // ─── Notificaciones ────────────────────────────────────────────────────────

  private showSuccess(msg: string): void {
    this.msgSvc.add({ severity: 'success', summary: 'Éxito',      detail: msg, life: 4000 });
  }
  private showError(msg: string): void {
    this.msgSvc.add({ severity: 'error',   summary: 'Error',      detail: msg, life: 6000 });
  }
  private showWarn(msg: string): void {
    this.msgSvc.add({ severity: 'warn',    summary: 'Atención',   detail: msg, life: 4000 });
  }
}
