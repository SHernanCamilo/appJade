import { Component, OnInit, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { TooltipModule } from 'primeng/tooltip';
import { InventarioService } from '../../../core/services/inventario.service';
import { OrdenCompra, Pedido, PedidoDetalle } from '../../../core/models/inventario.model';

@Component({
  selector: 'app-ordenes-compra',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    SkeletonModule, 
    TableModule, 
    DialogModule, 
    ButtonModule, 
    InputTextModule,
    DropdownModule,
    TooltipModule
  ],
  templateUrl: './ordenes-compra.component.html',
  styleUrls: ['./ordenes-compra.component.css']
})
export class OrdenesCompraComponent implements OnInit {
  // Estado general
  activeTab = signal<'pedidos' | 'ordenes'>('ordenes');
  
  // Datos de Órdenes de Compra
  ordenes = signal<OrdenCompra[]>([]);
  isLoadingOrdenes = signal<boolean>(false);
  statusFilterOrdenes = signal<string>('');
  
  // Datos de Pedidos Confirmados
  pedidos = signal<Pedido[]>([]);
  isLoadingPedidos = signal<boolean>(false);
  selectedPedido = signal<Pedido | null>(null);

  // Modal Sincronización
  isSyncing = signal<boolean>(false);
  numeroOrdenSync = signal<string>('');

  // Modal Ver Detalles Orden
  showDetailsModal = signal<boolean>(false);
  currentOrden = signal<OrdenCompra | null>(null);
  isLoadingOrdenDetalle = signal<boolean>(false);

  // Modal Crear Orden de Compra
  showCreateModal = signal<boolean>(false);
  isCreating = signal<boolean>(false);
  newOrdenPedidoSelected = signal<Pedido | null>(null);
  newOrdenDetalles = signal<PedidoDetalle[]>([]);
  isLoadingPedidoDetalle = signal<boolean>(false);

  // Computados
  hasSelectedPedido = computed(() => this.selectedPedido() !== null);
  selectedItemsCount = computed(() => {
    const pedido = this.selectedPedido();
    // Si no tenemos los detalles cargados en la lista general, usamos total_articulos
    return pedido ? (pedido.total_articulos || 0) : 0;
  });

  constructor(private inventarioService: InventarioService) {}

  ngOnInit(): void {
    // Cargar ambas listas al inicio para tenerlas listas
    this.loadOrdenes();
    this.loadPedidos();
  }

  // ==========================================
  // NAVEGACIÓN Y TABS
  // ==========================================
  setTab(tab: 'pedidos' | 'ordenes'): void {
    this.activeTab.set(tab);
    if (tab === 'pedidos' && this.pedidos().length === 0) {
      this.loadPedidos();
    }
  }

  // ==========================================
  // ÓRDENES DE COMPRA
  // ==========================================
  loadOrdenes(): void {
    this.isLoadingOrdenes.set(true);
    const filter = this.statusFilterOrdenes();
    const params = filter ? { status: filter } : {};
    
    this.inventarioService.getOrdenesCompra(params).subscribe({
      next: (res) => {
        this.isLoadingOrdenes.set(false);
        if (res.success) {
          this.ordenes.set(res.data);
        } else {
          this.ordenes.set([]);
        }
      },
      error: (err) => {
        this.isLoadingOrdenes.set(false);
        console.error('Error loading ordenes de compra:', err);
      }
    });
  }

  onStatusFilterChange(event: any): void {
    this.statusFilterOrdenes.set(event.target.value);
    this.loadOrdenes();
  }

  viewOrden(id: number): void {
    this.showDetailsModal.set(true);
    this.isLoadingOrdenDetalle.set(true);
    this.inventarioService.getOrdenCompra(id).subscribe({
      next: (res) => {
        this.isLoadingOrdenDetalle.set(false);
        if (res.success) {
          this.currentOrden.set(res.data);
        }
      },
      error: (err) => {
        this.isLoadingOrdenDetalle.set(false);
        console.error('Error viewing orden:', err);
      }
    });
  }

  closeDetailsModal(): void {
    this.showDetailsModal.set(false);
    this.currentOrden.set(null);
  }

  syncFromIndigo(): void {
    const num = this.numeroOrdenSync();
    if (!num) {
      alert('Por favor ingrese un número de Orden de Compra.');
      return;
    }

    this.isSyncing.set(true);
    this.inventarioService.syncOrdenCompra(num).subscribe({
      next: (res) => {
        this.isSyncing.set(false);
        if (res.success) {
          alert('Sincronización exitosa.');
          this.numeroOrdenSync.set('');
          this.loadOrdenes();
        } else {
          alert('Error: ' + res.message);
        }
      },
      error: (err) => {
        this.isSyncing.set(false);
        console.error('Error syncing:', err);
        alert('Ocurrió un error al sincronizar con INDIGO.');
      }
    });
  }

  // ==========================================
  // PEDIDOS CONFIRMADOS
  // ==========================================
  loadPedidos(): void {
    this.isLoadingPedidos.set(true);
    // Solicitamos pedidos que estén listos para ser procesados (ej. 'confirmado' o 'en_proceso')
    // El backend de AppCertec maneja estado='en_proceso' para los que van a compras,
    // o podemos traer todos los pedidos para probar visualmente.
    this.inventarioService.getPedidos({ estado: 'en_proceso' }).subscribe({
      next: (res) => {
        this.isLoadingPedidos.set(false);
        if (res.success) {
          this.pedidos.set(res.data);
        } else {
          this.pedidos.set([]);
        }
      },
      error: (err) => {
        this.isLoadingPedidos.set(false);
        console.error('Error loading pedidos:', err);
      }
    });
  }

  onPedidoSelect(event: any): void {
    // Cuando el usuario selecciona una fila
    this.selectedPedido.set(event.data);
  }

  onPedidoUnselect(event: any): void {
    this.selectedPedido.set(null);
  }

  // ==========================================
  // CREACIÓN DE ORDEN DE COMPRA (MODAL)
  // ==========================================
  openCreateModal(pedidoPrefill: Pedido | null = null): void {
    this.showCreateModal.set(true);
    if (pedidoPrefill) {
      this.newOrdenPedidoSelected.set(pedidoPrefill);
      this.fetchPedidoDetailsForCreation(pedidoPrefill.id);
    } else {
      this.newOrdenPedidoSelected.set(null);
      this.newOrdenDetalles.set([]);
    }
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
    this.newOrdenPedidoSelected.set(null);
    this.newOrdenDetalles.set([]);
  }

  onDropdownPedidoChange(event: any): void {
    const pedido = event.value; // Ya pasamos el objeto completo en options
    if (pedido && pedido.id) {
      this.newOrdenPedidoSelected.set(pedido);
      this.fetchPedidoDetailsForCreation(pedido.id);
    } else {
      this.newOrdenPedidoSelected.set(null);
      this.newOrdenDetalles.set([]);
    }
  }

  fetchPedidoDetailsForCreation(pedidoId: number): void {
    this.isLoadingPedidoDetalle.set(true);
    this.inventarioService.getPedido(pedidoId).subscribe({
      next: (res) => {
        this.isLoadingPedidoDetalle.set(false);
        if (res.success && res.data.detalles) {
          this.newOrdenDetalles.set(res.data.detalles);
        } else {
          this.newOrdenDetalles.set([]);
        }
      },
      error: (err) => {
        this.isLoadingPedidoDetalle.set(false);
        console.error('Error fetching pedido details:', err);
        this.newOrdenDetalles.set([]);
      }
    });
  }

  submitCrearOrden(): void {
    const pedido = this.newOrdenPedidoSelected();
    if (!pedido) {
      alert('Debe seleccionar un pedido para continuar.');
      return;
    }
    
    // Aquí se conectaría con un endpoint real como createOrdenCompra()
    // Por el momento simulamos la acción como lo solicitó el usuario para establecer la UI
    this.isCreating.set(true);
    
    // Simulación de delay
    setTimeout(() => {
      this.isCreating.set(false);
      alert(`Orden de compra enviada para procesar el pedido: ${pedido.numero_pedido}.`);
      this.closeCreateModal();
      // Opcionalmente recargar órdenes y cambiar a la pestaña de órdenes
      this.loadOrdenes();
      this.setTab('ordenes');
      this.selectedPedido.set(null); // Limpiar selección
    }, 1000);
  }

  // ==========================================
  // HELPERS
  // ==========================================
  getStatusBadge(status: string): string {
    const st = status?.toLowerCase() || '';
    if (st === 'pending' || st === 'pendiente') return 'bg-warning text-dark';
    if (st === 'in_transit' || st === 'en_proceso') return 'bg-info text-dark';
    if (st === 'received' || st === 'recibida' || st === 'confirmado') return 'bg-success';
    if (st === 'cancelled' || st === 'cancelada') return 'bg-danger';
    return 'bg-secondary';
  }
  
  getStatusText(status: string): string {
    const st = status?.toLowerCase() || '';
    if (st === 'pending') return 'Pendiente';
    if (st === 'in_transit') return 'En tránsito';
    if (st === 'received') return 'Recibida';
    if (st === 'cancelled') return 'Cancelada';
    if (st === 'en_proceso') return 'Confirmado'; // Mostramos en proceso como confirmado según contexto de compras
    return status;
  }
}
