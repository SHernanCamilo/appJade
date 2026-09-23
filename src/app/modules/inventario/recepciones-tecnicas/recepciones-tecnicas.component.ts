import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { InventarioService } from '../../../core/services/inventario.service';
import { OrdenCompra, RecepcionItem } from '../../../core/models/inventario.model';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-recepciones-tecnicas',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    TableModule,
    TagModule,
    ButtonModule,
    TooltipModule,
    DialogModule,
    InputTextModule,
    SkeletonModule
  ],
  templateUrl: './recepciones-tecnicas.component.html',
  styleUrls: ['./recepciones-tecnicas.component.css']
})
export class RecepcionesTecnicasComponent implements OnInit {
  // Estado general
  currentView = signal<'pending' | 'completed'>('pending');
  isLoading = signal<boolean>(false);
  
  // Datos
  comprasPendientes = signal<OrdenCompra[]>([]);
  comprasCompletadas = signal<OrdenCompra[]>([]);

  // BÃºsqueda
  globalFilterFields = ['numero_orden_compra', 'oc_indigo', 'creado_por_nombre'];

  // Modal Ver Detalles
  showDetailsModal = signal<boolean>(false);
  currentReception = signal<OrdenCompra | null>(null);
  currentDetails = signal<RecepcionItem[]>([]);
  isLoadingDetails = signal<boolean>(false);

  private readonly location = inject(Location);

  constructor(private inventarioService: InventarioService, private router: Router) {}

  ngOnInit(): void {
    this.loadCompras();
  }

  loadCompras(): void {
    this.isLoading.set(true);
    const status = this.currentView() === 'pending' ? 'confirmado,en_sitio,parcial' : 'RECEPCIONADO,CONFIRMADO';
    
    this.inventarioService.getRecepciones({ status }).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res.success) {
          if (this.currentView() === 'pending') {
            this.comprasPendientes.set(res.data);
          } else {
            this.comprasCompletadas.set(res.data);
          }
        } else {
          this.currentView() === 'pending' ? this.comprasPendientes.set([]) : this.comprasCompletadas.set([]);
        }
      },
      error: (err: any) => {
        this.isLoading.set(false);
        console.error('Error loading recepciones:', err);
      }
    });
  }

  setView(view: 'pending' | 'completed'): void {
    this.currentView.set(view);
    this.loadCompras();
  }

  confirmArrival(id: number | undefined): void {
    if (!id) return;
    if (confirm('Â¿Confirmar llegada de la orden al sitio?')) {
      this.inventarioService.confirmarRecepcion(id).subscribe({
        next: (res) => {
          if (res.success) {
            this.loadCompras(); // Recargar para actualizar el estado
          } else {
            alert('Error: ' + res.message);
          }
        },
        error: (err: any) => console.error(err)
      });
    }
  }

  // --- Abrir Vista Excel en una pestaña nueva (pantalla completa, sin layout) ---
  openReceptionExcel(orden: OrdenCompra): void {
    if (!orden.compra_id) return;

    const urlTree = this.router.createUrlTree(['/recepcionExcel', orden.compra_id]);
    const url = this.router.serializeUrl(urlTree);
    // prepareExternalUrl respeta el base-href en producción
    const fullUrl = this.location.prepareExternalUrl(url);

    window.open(fullUrl, '_blank');
  }

  // --- Ver Detalles (Completadas) ---
  viewDetails(orden: OrdenCompra): void {
    if (!orden.id) return;
    
    this.currentReception.set(orden);
    this.showDetailsModal.set(true);
    this.isLoadingDetails.set(true);
    
    this.inventarioService.getRecepcion(orden.id).subscribe({
      next: (res) => {
        this.isLoadingDetails.set(false);
        if (res.success) {
          this.currentDetails.set(res.data);
        }
      },
      error: (err: any) => {
        this.isLoadingDetails.set(false);
        console.error('Error viewing details:', err);
      }
    });
  }

  closeDetailsModal(): void {
    this.showDetailsModal.set(false);
    this.currentReception.set(null);
    this.currentDetails.set([]);
  }

  // Helpers
  getProgress(recibidos: number | undefined, total: number | undefined): number {
    if (!total || total === 0) return 0;
    return Math.round(((recibidos || 0) / total) * 100);
  }

  getSeverityTag(estado: string): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' {
    switch (estado?.toLowerCase()) {
      case 'recepcionado': return 'info';
      case 'confirmado': return this.currentView() === 'completed' ? 'success' : 'warn';
      case 'en_sitio': return 'info';
      case 'parcial': return 'secondary';
      case 'recibida': return 'success';
      default: return 'info';
    }
  }

  calculateSampleFallback(item: any): number {
    const qty = Math.floor(Number(item?.cantidad_recibida ?? 0));
    if (Boolean(item?.muestra_exclusion)) return qty;
    if (item?.muestra_poblacion && Number(item.muestra_poblacion) > 0) return Number(item.muestra_poblacion);
    if (!qty || qty <= 0) return 0;
    const rules = [
      { min: 2, max: 8, sample: 2 },
      { min: 9, max: 15, sample: 3 },
      { min: 16, max: 25, sample: 5 },
      { min: 26, max: 50, sample: 8 },
      { min: 51, max: 90, sample: 13 },
      { min: 91, max: 150, sample: 20 },
      { min: 151, max: 280, sample: 32 },
      { min: 281, max: 500, sample: 50 },
      { min: 501, max: 1200, sample: 80 },
      { min: 1201, max: 3200, sample: 125 },
      { min: 3201, max: 10000, sample: 200 },
      { min: 10001, max: 35000, sample: 315 },
      { min: 35001, max: 150000, sample: 500 },
      { min: 150001, max: 500000, sample: 800 },
      { min: 500001, max: 2147483647, sample: 1250 },
    ];
    const rule = rules.find(r => qty >= r.min && qty <= r.max);
    return rule ? rule.sample : qty;
  }

  /** Normaliza el valor de cumplimiento (acepta string, boolean o número). */
  formatCumple(value: any): string {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'string') return value;
    return (value === true || value === 1) ? 'Cumple' : 'No Cumple';
  }

  /** Clase de color para el badge de cumplimiento. */
  cumpleClass(value: any): string {
    const label = this.formatCumple(value);
    if (label === 'Cumple') return 'badge bg-success-subtle text-success border border-success';
    if (label === 'No Cumple') return 'badge bg-danger-subtle text-danger border border-danger';
    return 'text-muted';
  }

  /** Exporta el detalle recepcionado a Excel (mismas columnas de la tabla). */
  exportDetailsExcel(): void {
    const items = this.currentDetails();
    if (!items || items.length === 0) return;

    const recepcion = this.currentReception();
    const filas = items.map((item: any) => ({
      'Código': item.codigo_producto,
      'Producto': item.producto_nombre,
      'Tipo': item.tipo_producto || item.producto_tipo || '',
      'Cant. Solicitada': item.cantidad_solicitada ?? item.cantidad_solicitada_compra ?? '',
      'Cant. Recibida': item.cantidad_recibida || 0,
      'Muestra': this.calculateSampleFallback(item),
      'Lote': item.numero_lote || '',
      'Vencimiento': item.fecha_vencimiento ? String(item.fecha_vencimiento).substring(0, 10) : '',
      'Reg. Sanitario': item.codigo_sanitario || '',
      'Aspecto': this.formatCumple(item.aspecto_cumple),
      'Embalaje': this.formatCumple(item.embalaje_cumple),
      'Contenido': this.formatCumple(item.contenido_cumple),
      'Concepto': item.concepto_recepcion || 'Pendiente',
      'Observaciones': item.observaciones_recepcion || item.observaciones || ''
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(filas);
    XLSX.utils.book_append_sheet(wb, ws, 'Recepción');
    const nombre = recepcion?.numero_recepcion || recepcion?.numero_orden_compra || 'recepcion';
    XLSX.writeFile(wb, `Recepcion_${nombre}.xlsx`);
  }
}
