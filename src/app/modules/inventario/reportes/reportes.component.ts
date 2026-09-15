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

import { InventarioService } from '../../../core/services/inventario.service';
import { ReporteFarmacia } from '../../../core/models/inventario.model';
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
    InputTextModule, ChartModule, SkeletonModule, TooltipModule, ToastModule
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

  ngOnInit(): void {
    this.cargarSucursales();
    this.aplicarFiltros();
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
