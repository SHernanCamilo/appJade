import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { InputTextModule } from 'primeng/inputtext';
import { ChartModule } from 'primeng/chart';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { TabViewModule } from 'primeng/tabview';

import { InventarioService } from '../../../core/services/inventario.service';
import { ReporteFarmacia, ReporteTiempos } from '../../../core/models/inventario.model';
import * as XLSX from 'xlsx';

/**
 * Tablero unificado de Farmacia (tipo BI).
 * Consolida en una sola vista Pedidos + Órdenes de Compra + Recepciones Técnicas.
 */
@Component({
  selector: 'app-reportes-farmacia',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    TableModule, ButtonModule, DropdownModule, CalendarModule,
    InputTextModule, ChartModule, SkeletonModule, TooltipModule, ToastModule,
    TabViewModule
  ],
  providers: [MessageService],
  templateUrl: './reportes.component.html',
  styleUrls: ['./reportes.component.css']
})
export class ReportesComponent implements OnInit {
  private readonly inventarioService = inject(InventarioService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);

  // ── Estado ────────────────────────────────────────────────
  isLoading = signal<boolean>(false);
  data = signal<ReporteFarmacia | null>(null);

  /** Fecha de hoy para el encabezado. */
  hoy = new Date();

  // ── Filtros ───────────────────────────────────────────────
  /** Rango de fechas [desde, hasta]. Por defecto: últimos 45 días. */
  rangoFechas: Date[] = [
    new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
    new Date()
  ];
  filtroProveedor = '';
  filtroEstadoPedido: string | null = null;
  filtroEstadoRecepcion: string | null = null;
  filtroSucursalId: number | null = null;

  sucursales = signal<{ id: number; nombre: string }[]>([]);

  estadoPedidoOptions = [
    { label: 'Todos los estados', value: null },
    { label: 'Pendiente', value: 'pendiente' },
    { label: 'Aprobado', value: 'aprobado' },
    { label: 'En Proceso', value: 'en_proceso' },
    { label: 'En Tránsito', value: 'en_transito' },
    { label: 'Recibido', value: 'recibido' },
    { label: 'Rechazado', value: 'rechazado' },
    { label: 'Cancelado', value: 'cancelado' },
  ];

  estadoRecepcionOptions = [
    { label: 'Todos los estados', value: null },
    { label: 'Recepcionado', value: 'recepcionado' },
    { label: 'Confirmado', value: 'confirmado' },
  ];

  // ── Datos derivados para los gráficos ─────────────────────

  /** Gráfico de líneas: evolución de los 3 procesos. */
  evolucionChart = computed(() => {
    const ev = this.data()?.evolucion;
    if (!ev) return null;
    return {
      labels: ev.labels.map(l => this.formatoDiaCorto(l)),
      datasets: [
        {
          label: 'Pedidos',
          data: ev.pedidos,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.12)',
          fill: true, tension: 0.4, borderWidth: 2,
          pointRadius: 0, pointHoverRadius: 4,
        },
        {
          label: 'Órdenes de Compra',
          data: ev.ordenes,
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139,92,246,0.10)',
          fill: true, tension: 0.4, borderWidth: 2,
          pointRadius: 0, pointHoverRadius: 4,
        },
        {
          label: 'Recepciones',
          data: ev.recepciones,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16,185,129,0.10)',
          fill: true, tension: 0.4, borderWidth: 2,
          pointRadius: 0, pointHoverRadius: 4,
        },
      ],
    };
  });

  evolucionOptions = {
    maintainAspectRatio: false,
    responsive: true,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: {
        position: 'top' as const,
        align: 'start' as const,
        labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, font: { size: 11 } },
      },
      tooltip: { padding: 10, cornerRadius: 6 },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
      y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 }, precision: 0 } },
    },
  };

  /** Dona: distribución de pedidos por estado. */
  estadosChart = computed(() => {
    const items = this.data()?.pedidos_por_estado?.items || [];
    if (items.length === 0) return null;
    return {
      labels: items.map(i => i.label),
      datasets: [{
        data: items.map(i => i.total),
        backgroundColor: items.map(i => this.colorEstado(i.estado)),
        borderWidth: 0,
        hoverOffset: 6,
      }],
    };
  });

  estadosOptions = {
    maintainAspectRatio: false,
    responsive: true,
    cutout: '68%',
    plugins: { legend: { display: false }, tooltip: { padding: 10, cornerRadius: 6 } },
  };

  /** Barras horizontales: productos por categoría. */
  categoriasChart = computed(() => {
    const cats = this.data()?.productos_por_categoria || [];
    if (cats.length === 0) return null;
    const paleta = ['#3b82f6', '#60a5fa', '#8b5cf6', '#10b981', '#94a3b8', '#f59e0b'];
    return {
      labels: cats.map(c => c.categoria),
      datasets: [{
        data: cats.map(c => c.total),
        backgroundColor: cats.map((_, i) => paleta[i % paleta.length]),
        borderRadius: 4,
        barThickness: 14,
      }],
    };
  });

  categoriasOptions = {
    indexAxis: 'y' as const,
    maintainAspectRatio: false,
    responsive: true,
    plugins: { legend: { display: false }, tooltip: { padding: 10, cornerRadius: 6 } },
    scales: {
      x: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } },
      y: { grid: { display: false }, ticks: { font: { size: 10 } } },
    },
  };

  /** Total de pedidos que va en el centro de la dona. */
  totalEstados = computed(() => this.data()?.pedidos_por_estado?.total ?? 0);

  // ═══════════════════════════════════════════════════════════
  //  TAB "TIEMPOS DE GESTIÓN"
  // ═══════════════════════════════════════════════════════════

  /** Tab activo (0 = Resumen, 1 = Tiempos de gestión). */
  tabActivo = 0;

  isLoadingTiempos = signal<boolean>(false);
  tiempos = signal<ReporteTiempos | null>(null);

  // Filtros dinámicos por etapa (cada rango es independiente).
  rangoPedido: Date[] | null = null;
  rangoOrden: Date[] | null = null;
  rangoRecepcion: Date[] | null = null;
  filtroProveedorT = '';
  filtroSucursalIdT: number | null = null;
  umbralOk = 7;
  umbralAlerta = 15;

  /** Gráfico de barras: promedio de días por etapa. */
  etapasChart = computed(() => {
    const etapas = this.tiempos()?.promedios_por_etapa || [];
    if (etapas.length === 0) return null;
    return {
      labels: etapas.map(e => e.etapa),
      datasets: [{
        label: 'Días promedio',
        data: etapas.map(e => e.dias ?? 0),
        backgroundColor: ['#3b82f6', '#f59e0b', '#8b5cf6'],
        borderRadius: 6,
        barThickness: 40,
      }],
    };
  });

  etapasOptions = {
    maintainAspectRatio: false,
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        padding: 10, cornerRadius: 6,
        callbacks: { label: (ctx: any) => `${ctx.raw} días en promedio` },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
      y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 }, precision: 0 } },
    },
  };

  /** Dona: distribución del tiempo OC → Recepción por rangos (a tiempo/alerta/crítico). */
  distribucionChart = computed(() => {
    const dist = this.tiempos()?.distribucion_oc_recepcion || [];
    if (dist.length === 0 || dist.every(d => d.total === 0)) return null;
    const colorNivel: Record<string, string> = { ok: '#10b981', alerta: '#f59e0b', critico: '#ef4444' };
    return {
      labels: dist.map(d => d.rango),
      datasets: [{
        data: dist.map(d => d.total),
        backgroundColor: dist.map(d => colorNivel[d.nivel] || '#94a3b8'),
        borderWidth: 0,
        hoverOffset: 6,
      }],
    };
  });

  distribucionOptions = {
    maintainAspectRatio: false,
    responsive: true,
    cutout: '62%',
    plugins: {
      legend: { position: 'bottom' as const, labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, font: { size: 11 } } },
      tooltip: { padding: 10, cornerRadius: 6 },
    },
  };

  ngOnInit(): void {
    this.cargarSucursales();
    this.aplicarFiltros();
  }

  /** Al cambiar de tab: carga los tiempos la primera vez que se abre. */
  onTabChange(index: number): void {
    this.tabActivo = index;
    if (index === 1 && !this.tiempos()) {
      this.aplicarFiltrosTiempos();
    }
  }

  // ── Carga del reporte de tiempos ──────────────────────────
  aplicarFiltrosTiempos(): void {
    this.isLoadingTiempos.set(true);

    const filtros: Record<string, any> = {
      pedido_desde:    this.aFecha(this.rangoPedido?.[0]),
      pedido_hasta:    this.aFecha(this.rangoPedido?.[1] ?? this.rangoPedido?.[0]),
      orden_desde:     this.aFecha(this.rangoOrden?.[0]),
      orden_hasta:     this.aFecha(this.rangoOrden?.[1] ?? this.rangoOrden?.[0]),
      recepcion_desde: this.aFecha(this.rangoRecepcion?.[0]),
      recepcion_hasta: this.aFecha(this.rangoRecepcion?.[1] ?? this.rangoRecepcion?.[0]),
      proveedor:       this.filtroProveedorT?.trim() || null,
      sucursal_id:     this.filtroSucursalIdT,
      umbral_ok:       this.umbralOk,
      umbral_alerta:   this.umbralAlerta,
    };

    this.inventarioService.getReporteTiempos(filtros).subscribe({
      next: (res) => {
        this.isLoadingTiempos.set(false);
        if (res.success && res.data) {
          this.tiempos.set(res.data);
        } else {
          this.tiempos.set(null);
          this.messageService.add({ severity: 'warn', summary: 'Sin datos', detail: 'No se obtuvieron tiempos para los filtros seleccionados.' });
        }
      },
      error: (err) => {
        this.isLoadingTiempos.set(false);
        this.tiempos.set(null);
        this.messageService.add({
          severity: 'error', summary: 'Error',
          detail: err?.error?.message || 'No se pudo cargar el reporte de tiempos.',
        });
      },
    });
  }

  limpiarFiltrosTiempos(): void {
    this.rangoPedido = null;
    this.rangoOrden = null;
    this.rangoRecepcion = null;
    this.filtroProveedorT = '';
    this.filtroSucursalIdT = null;
    this.umbralOk = 7;
    this.umbralAlerta = 15;
    this.aplicarFiltrosTiempos();
  }

  /** Días → texto legible ('—' si es null). */
  dias(v: number | null | undefined): string {
    return v === null || v === undefined ? '—' : `${v} d`;
  }

  /** Clase de badge para el semáforo de tiempo. */
  badgeSemaforo(nivel: string): string {
    switch (nivel) {
      case 'ok':      return 'rep-badge rep-badge--success';
      case 'alerta':  return 'rep-badge rep-badge--warn';
      case 'critico': return 'rep-badge rep-badge--danger';
      default:        return 'rep-badge rep-badge--muted';
    }
  }

  /** Etiqueta del semáforo. */
  labelSemaforo(nivel: string): string {
    switch (nivel) {
      case 'ok':      return 'A tiempo';
      case 'alerta':  return 'Alerta';
      case 'critico': return 'Crítico';
      default:        return 'Pendiente';
    }
  }

  /** Exporta el detalle de tiempos a Excel. */
  exportarTiemposExcel(): void {
    const t = this.tiempos();
    if (!t || t.detalle.length === 0) {
      this.messageService.add({ severity: 'warn', summary: 'Sin datos', detail: 'No hay tiempos para exportar.' });
      return;
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      t.detalle.map(d => ({
        'N° OC': d.numero_orden_compra,
        'N° Pedido': d.numero_pedido || '',
        'Proveedor': d.proveedor,
        'Estado': d.estado_label,
        'Fecha Pedido': d.fecha_pedido || '',
        'Fecha OC': d.fecha_orden || '',
        'Fecha Recepción': d.fecha_recepcion || '',
        'Días Pedido→OC': d.dias_pedido_oc ?? '',
        'Días OC→Recepción': d.dias_oc_recepcion ?? '',
        'Días Ciclo Total': d.dias_ciclo_total ?? '',
        'Estado tiempo': this.labelSemaforo(d.semaforo),
      }))), 'Tiempos de Gestión');
    XLSX.writeFile(wb, `Tiempos_Gestion_${this.aFecha(new Date())}.xlsx`);
    this.messageService.add({ severity: 'success', summary: 'Exportado', detail: 'El reporte de tiempos se descargó en Excel.' });
  }

  // ── Carga de datos ────────────────────────────────────────
  private cargarSucursales(): void {
    this.inventarioService.getSucursalesDisponibles().subscribe({
      next: (res: any) => {
        const lista = res?.success && Array.isArray(res.data) ? res.data : [];
        this.sucursales.set(lista.map((s: any) => ({ id: s.id, nombre: s.nombre })));
      },
      error: () => this.sucursales.set([]),
    });
  }

  aplicarFiltros(): void {
    this.isLoading.set(true);

    const filtros: Record<string, any> = {
      fecha_desde: this.aFecha(this.rangoFechas?.[0]),
      fecha_hasta: this.aFecha(this.rangoFechas?.[1] ?? this.rangoFechas?.[0]),
      proveedor: this.filtroProveedor?.trim() || null,
      estado_pedido: this.filtroEstadoPedido,
      estado_recepcion: this.filtroEstadoRecepcion,
      sucursal_id: this.filtroSucursalId,
    };

    this.inventarioService.getReporteDashboard(filtros).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res.success && res.data) {
          this.data.set(res.data);
        } else {
          this.data.set(null);
          this.messageService.add({ severity: 'warn', summary: 'Sin datos', detail: 'No se obtuvieron datos para los filtros seleccionados.' });
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.data.set(null);
        console.error('Error cargando reporte:', err);
        this.messageService.add({
          severity: 'error', summary: 'Error',
          detail: err?.error?.message || 'No se pudo cargar el tablero de reportes.',
        });
      },
    });
  }

  limpiarFiltros(): void {
    this.rangoFechas = [new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), new Date()];
    this.filtroProveedor = '';
    this.filtroEstadoPedido = null;
    this.filtroEstadoRecepcion = null;
    this.filtroSucursalId = null;
    this.aplicarFiltros();
  }

  // ── Navegación a los módulos de origen ────────────────────
  irAPedidos(): void {
    this.router.navigate(['/inventario/farmacia/pedidos']);
  }

  irAOrdenes(): void {
    this.router.navigate(['/inventario/farmacia/ordenCompra']);
  }

  irARecepciones(): void {
    this.router.navigate(['/inventario/farmacia/recepcionTecnica']);
  }

  // ── Exportación ───────────────────────────────────────────
  /** Exporta el tablero completo a Excel, una hoja por bloque. */
  exportarExcel(): void {
    const d = this.data();
    if (!d) {
      this.messageService.add({ severity: 'warn', summary: 'Sin datos', detail: 'No hay datos para exportar.' });
      return;
    }

    const wb = XLSX.utils.book_new();

    // Resumen (KPIs)
    const kpis = d.kpis;
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{
      'Desde': d.rango.desde,
      'Hasta': d.rango.hasta,
      'Total Pedidos': kpis.total_pedidos,
      'Órdenes de Compra': kpis.total_ordenes,
      'Recepciones Técnicas': kpis.total_recepciones,
      'Productos Recibidos': kpis.productos_recibidos,
      'Pendientes por Recibir': kpis.pendientes_recibir,
      'Incidencias': kpis.incidencias,
      'Valor Total Compras': kpis.valor_total_compras,
    }]), 'Resumen');

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      d.ultimos_pedidos.map(p => ({
        'N° Pedido': p.numero_pedido, 'Proveedor': p.proveedor,
        'Fecha': p.fecha_pedido, 'Estado': p.estado_label,
        'Ítems': p.total_articulos, 'Valor': p.valor,
      }))), 'Pedidos');

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      d.ultimas_ordenes.map(o => ({
        'N° OC': o.numero_orden_compra, 'OC Indigo': o.oc_indigo || '',
        'Proveedor': o.proveedor_nombre || '', 'Fecha': o.fecha_orden,
        'Estado': o.estado_label, 'Ítems': o.items, 'Valor': o.valor,
      }))), 'Ordenes de Compra');

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      d.ultimas_recepciones.map(r => ({
        'N° Recepción': r.numero_recepcion || '', 'OC': r.numero_orden_compra || '',
        'Fecha': r.fecha_recepcion, 'Estado': r.estado_label,
        'Ítems': r.total_items, 'Recibidos': r.items_recibidos,
      }))), 'Recepciones');

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      d.resumen_por_proveedor.map(p => ({
        'Proveedor': p.proveedor, 'Órdenes': p.ordenes,
        'Recepciones': p.recepciones, 'Productos': p.productos, 'Valor': p.valor,
      }))), 'Por Proveedor');

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      d.productos_mas_solicitados.map((p, i) => ({
        '#': i + 1, 'Código': p.codigo_producto,
        'Producto': p.producto_nombre, 'Cantidad': p.cantidad,
      }))), 'Top Productos');

    XLSX.writeFile(wb, `Reporte_Farmacia_${d.rango.desde}_a_${d.rango.hasta}.xlsx`);
    this.messageService.add({ severity: 'success', summary: 'Exportado', detail: 'El reporte se descargó en Excel.' });
  }

  // ── Helpers de presentación ───────────────────────────────

  /** Convierte un Date a 'YYYY-MM-DD' sin desfase de zona horaria. */
  private aFecha(d?: Date | null): string | null {
    if (!d) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  /** '2026-09-14' → 'Sep 14' para el eje del gráfico. */
  private formatoDiaCorto(iso: string): string {
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const [, m, d] = iso.split('-');
    const mi = Math.max(0, Math.min(11, Number(m) - 1));
    return `${meses[mi]} ${Number(d)}`;
  }

  /** Color por estado, consistente entre dona y badges. */
  colorEstado(estado: string): string {
    switch ((estado || '').toLowerCase()) {
      case 'pendiente':
      case 'borrador':
      case 'solicitado':   return '#f59e0b';
      case 'en_proceso':   return '#3b82f6';
      case 'aprobado':
      case 'confirmado':   return '#8b5cf6';
      case 'en_transito':
      case 'en_sitio':     return '#06b6d4';
      case 'parcial':      return '#a78bfa';
      case 'recibido':
      case 'recibida':
      case 'recepcionado': return '#10b981';
      case 'rechazado':
      case 'rechazada':
      case 'cancelado':
      case 'cancelada':    return '#ef4444';
      default:             return '#94a3b8';
    }
  }

  /** Clase del badge de estado (misma paleta que los módulos de origen). */
  badgeEstado(estado: string): string {
    switch ((estado || '').toLowerCase()) {
      case 'pendiente':
      case 'borrador':
      case 'solicitado':   return 'rep-badge rep-badge--warn';
      case 'en_proceso':   return 'rep-badge rep-badge--info';
      case 'aprobado':
      case 'confirmado':   return 'rep-badge rep-badge--purple';
      case 'en_transito':
      case 'en_sitio':     return 'rep-badge rep-badge--cyan';
      case 'recibido':
      case 'recibida':
      case 'recepcionado': return 'rep-badge rep-badge--success';
      case 'rechazado':
      case 'rechazada':
      case 'cancelado':
      case 'cancelada':    return 'rep-badge rep-badge--danger';
      default:             return 'rep-badge rep-badge--muted';
    }
  }

  /** Porcentaje de avance de una recepción (para la barra). */
  avanceRecepcion(r: { total_items: number; items_recibidos: number }): number {
    if (!r?.total_items) return 0;
    return Math.min(100, Math.round((r.items_recibidos / r.total_items) * 100));
  }
}
