import { Component, OnInit, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { TooltipModule } from 'primeng/tooltip';
import { InventarioService } from '../../../core/services/inventario.service';
import { OrdenCompra, Pedido, PedidoDetalle, SucursalOption } from '../../../core/models/inventario.model';

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

  // Sucursales (para el selector y para preguntar destino al sincronizar)
  sucursales = signal<SucursalOption[]>([]);
  selectedSucursalId = signal<number | null>(null);

  // Filtros client-side para la tabla de OC (los inputs de columna filtran sobre los datos ya cargados)
  filterNumeroOC   = signal<string>('');
  filterProveedor  = signal<string>('');
  filterCreadoPor  = signal<string>('');
  filterFecha      = signal<string>('');

  // Computed: aplica todos los filtros de columna sobre las OC ya cargadas del backend.
  ordenesFiltradas = computed(() => {
    let lista = this.ordenes();
    const numOC    = this.filterNumeroOC().trim().toLowerCase();
    const prov     = this.filterProveedor().trim().toLowerCase();
    const creado   = this.filterCreadoPor().trim().toLowerCase();
    const fecha    = this.filterFecha().trim();

    if (numOC)  lista = lista.filter(o =>
      (o.numero_orden_compra ?? '').toLowerCase().includes(numOC) ||
      (o.oc_indigo ?? '').toLowerCase().includes(numOC));
    if (prov)   lista = lista.filter(o =>
      (o.proveedor_nombre ?? o.proveedor ?? '').toLowerCase().includes(prov));
    if (creado) lista = lista.filter(o =>
      (o.creado_por_nombre ?? '').toLowerCase().includes(creado));
    if (fecha)  lista = lista.filter(o => {
      const f = (o.fecha_orden ?? '').replace('T', ' ').substring(0, 10);
      return f.includes(fecha.replace(/\//g, '-'));
    });
    return lista;
  });

  // Computed: hay algún filtro de columna activo (para mostrar botón "Limpiar filtros")
  hayFiltrosActivos = computed(() =>
    this.filterNumeroOC().trim() !== '' ||
    this.filterProveedor().trim() !== '' ||
    this.filterCreadoPor().trim() !== '' ||
    this.filterFecha().trim() !== '' ||
    this.statusFilterOrdenes() !== ''
  );

  limpiarFiltros(): void {
    this.filterNumeroOC.set('');
    this.filterProveedor.set('');
    this.filterCreadoPor.set('');
    this.filterFecha.set('');
    this.statusFilterOrdenes.set('');
    this.loadOrdenes();
  }

  // Acciones sobre una OC
  isProcessingAction = signal<boolean>(false);

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

  constructor(private inventarioService: InventarioService, private route: ActivatedRoute) { }

  ngOnInit(): void {
    const qpStatus = this.route.snapshot.queryParamMap.get('status');
    if (qpStatus) this.statusFilterOrdenes.set(qpStatus);
    this.loadSucursales();
    this.loadOrdenes();
    this.loadPedidos();
  }

  // ==========================================
  // SUCURSALES
  // ==========================================
  loadSucursales(): void {
    this.inventarioService.getSucursalesDisponibles().subscribe({
      next: (res) => {
        if (res.success && Array.isArray(res.data)) {
          this.sucursales.set(res.data as SucursalOption[]);
          // Preseleccionar la sucursal principal del usuario si existe.
          const principal = (res.data as SucursalOption[]).find(s => s.principal);
          if (principal) this.selectedSucursalId.set(principal.id);
        } else {
          this.sucursales.set([]);
        }
      },
      error: (err) => {
        console.error('Error cargando sucursales:', err);
        this.sucursales.set([]);
      }
    });
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
    const params = filter ? { estado: filter } : {};

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

    // Preguntar/exigir la sucursal destino para que el consecutivo sea el correcto.
    const sucursalId = this.selectedSucursalId();
    if (!sucursalId) {
      alert('Seleccione la sucursal hacia la que se sincroniza la orden. El consecutivo se genera según la sucursal.');
      return;
    }

    const suc = this.sucursales().find(s => s.id === sucursalId);
    const confirmMsg = `Se sincronizará la orden ${num} hacia la sucursal "${suc?.nombre ?? sucursalId}". ¿Continuar?`;
    if (!confirm(confirmMsg)) return;

    this.isSyncing.set(true);
    this.inventarioService.syncOrdenCompra(num, sucursalId).subscribe({
      next: (res: any) => {
        this.isSyncing.set(false);
        if (res.success) {
          if (res.ya_existia) {
            // La OC ya estaba en el sistema: no crea nueva, informa al usuario.
            alert(`ℹ️ La orden ${num} ya está registrada en el sistema.\n\n${res.message}`);
          } else {
            alert(`✅ ${res.message}`);
          }
          this.numeroOrdenSync.set('');
          this.loadOrdenes();
        } else {
          alert('Error: ' + (res.message || 'No se pudo sincronizar.'));
        }
      },
      error: (err: any) => {
        this.isSyncing.set(false);
        console.error('Error syncing:', err);
        alert(err?.error?.message || 'Ocurrió un error al sincronizar con INDIGO.');
      }
    });
  }

  // ==========================================
  // ACCIONES SOBRE UNA OC (confirmar / editar / eliminar)
  // ==========================================

  /** Una OC solo puede editarse/eliminarse si el backend lo permite (propia, aplicativo, pendiente). */
  canEdit(oc: OrdenCompra): boolean {
    return !!oc?.puede_editar && !oc?.es_sincronizada;
  }

  /** Confirmar es válido mientras esté pendiente (aplica también a sincronizadas). */
  canConfirm(oc: OrdenCompra): boolean {
    return (oc?.estado?.toLowerCase() === 'pendiente');
  }

  isSincronizada(oc: OrdenCompra): boolean {
    return !!oc?.es_sincronizada || !!oc?.oc_indigo;
  }

  origenLabel(oc: OrdenCompra): string {
    return this.isSincronizada(oc) ? 'Indigo' : 'Aplicativo';
  }

  origenBadgeClass(oc: OrdenCompra): string {
    return this.isSincronizada(oc) ? 'bg-primary-subtle text-primary' : 'bg-success-subtle text-success';
  }

  /** Marca si a la OC le faltan datos clave (proveedor o ítems). */
  tieneDatosIncompletos(oc: OrdenCompra): boolean {
    const sinProveedor = !(oc?.proveedor_nombre || oc?.proveedor);
    const sinItems = !((oc?.items_count ?? oc?.total_items ?? 0) > 0);
    return sinProveedor || sinItems;
  }

  confirmarOrden(oc: OrdenCompra): void {
    if (!this.canConfirm(oc)) {
      alert('Solo se pueden confirmar órdenes en estado pendiente.');
      return;
    }
    if (!confirm(`¿Confirmar la orden ${oc.numero_orden_compra}? Esto actualizará los pedidos vinculados.`)) return;

    this.isProcessingAction.set(true);
    this.inventarioService.changeOrdenEstado(oc.id, 'CONFIRMADO').subscribe({
      next: (res) => {
        this.isProcessingAction.set(false);
        if (res.success) {
          alert('Orden confirmada.');
          this.loadOrdenes();
        } else {
          alert('Error: ' + (res.message || 'No se pudo confirmar la orden.'));
        }
      },
      error: (err) => {
        this.isProcessingAction.set(false);
        console.error('Error confirmando OC:', err);
        alert(err?.error?.message || 'Ocurrió un error al confirmar la orden.');
      }
    });
  }

  eliminarOrden(oc: OrdenCompra): void {
    if (!this.canEdit(oc)) {
      alert('Solo puedes eliminar órdenes creadas desde el aplicativo, propias y en estado pendiente.');
      return;
    }
    if (!confirm(`¿Eliminar la orden ${oc.numero_orden_compra}? Esta acción no se puede deshacer.`)) return;

    this.isProcessingAction.set(true);
    this.inventarioService.deleteOrdenCompra(oc.id).subscribe({
      next: (res) => {
        this.isProcessingAction.set(false);
        if (res.success) {
          alert('Orden eliminada.');
          this.loadOrdenes();
        } else {
          alert('Error: ' + (res.message || 'No se pudo eliminar la orden.'));
        }
      },
      error: (err) => {
        this.isProcessingAction.set(false);
        console.error('Error eliminando OC:', err);
        alert(err?.error?.message || 'Ocurrió un error al eliminar la orden.');
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

    const sucursalId = this.selectedSucursalId();
    if (!sucursalId) {
      alert('Seleccione la sucursal de la orden. El consecutivo se genera según la sucursal.');
      return;
    }

    // Construir los detalles a partir de los ítems del pedido cargados en el modal.
    const detalles = (this.newOrdenDetalles() || []).map((d: any) => ({
      pedido_detalle_id: d.id ?? d.pedido_detalle_id ?? null,
      codigo_producto: d.codigo_producto,
      producto_nombre: d.producto_nombre,
      cantidad_solicitada_compra: d.cantidad_a_comprar ?? d.cantidad_solicitada ?? 0,
    }));

    const payload = {
      pedido_id: pedido.id,
      sucursal_id: sucursalId,
      fecha_orden: new Date().toISOString().substring(0, 10),
      detalles,
    };

    this.isCreating.set(true);
    this.inventarioService.createOrdenCompra(payload).subscribe({
      next: (res) => {
        this.isCreating.set(false);
        if (res.success) {
          alert(`Orden de compra creada para el pedido: ${pedido.numero_pedido}.`);
          this.closeCreateModal();
          this.loadOrdenes();
          this.setTab('ordenes');
          this.selectedPedido.set(null);
        } else {
          alert('Error: ' + (res.message || 'No se pudo crear la orden.'));
        }
      },
      error: (err) => {
        this.isCreating.set(false);
        console.error('Error creando OC:', err);
        alert(err?.error?.message || 'Ocurrió un error al crear la orden de compra.');
      }
    });
  }

  // ==========================================
  // HELPERS
  // ==========================================
  getStatusBadge(status: string): string {
    const st = status?.toLowerCase() || '';
    if (st === 'borrador' || st === 'solicitado' || st === 'pendiente') return 'bg-warning text-dark';
    if (st === 'confirmado' || st === 'en_proceso' || st === 'en_transito' || st === 'parcial' || st === 'en_sitio') return 'bg-info text-dark';
    if (st === 'recibida' || st === 'recibido') return 'bg-success';
    if (st === 'cancelada' || st === 'cancelado' || st === 'rechazado') return 'bg-danger';
    return 'bg-secondary';
  }

  getStatusText(status: string): string {
    const st = status?.toLowerCase() || '';
    if (st === 'borrador') return 'Borrador';
    if (st === 'solicitado') return 'Solicitado';
    if (st === 'confirmado' || st === 'en_proceso') return 'Confirmado';
    if (st === 'en_sitio') return 'En Sitio';
    if (st === 'parcial') return 'Parcial';
    if (st === 'en_transito') return 'En tránsito';
    if (st === 'recibida' || st === 'recibido') return 'Recibida';
    if (st === 'cancelada' || st === 'cancelado') return 'Cancelada';
    return status;
  }
}
