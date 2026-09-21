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
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
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
    TooltipModule,
    ToastModule,
    ConfirmDialogModule
  ],
  providers: [ConfirmationService, MessageService],
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

  // Opciones de estado para los dropdowns (consistentes en header y filtro de columna).
  estadoOptions = [
    { label: 'Todos los estados', value: '' },
    { label: 'Pendiente', value: 'pendiente' },
    { label: 'En tránsito', value: 'en_transito' },
    { label: 'Confirmado', value: 'confirmado' },
    { label: 'En sitio', value: 'en_sitio' },
    { label: 'Recibida', value: 'recibida' },
    { label: 'Cancelada', value: 'cancelada' },
  ];

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

  // Modal Crear / Editar Orden de Compra
  showCreateModal = signal<boolean>(false);
  isCreating = signal<boolean>(false);
  newOrdenPedidoSelected = signal<Pedido | null>(null);
  newOrdenDetalles = signal<PedidoDetalle[]>([]);
  isLoadingPedidoDetalle = signal<boolean>(false);

  // Id de la OC en edición (null = modo creación). Cambia el título, el botón y el endpoint.
  editingOrdenId = signal<number | null>(null);
  isEditMode = computed(() => this.editingOrdenId() !== null);

  // Ítems que se agregan a la OC (uno por uno, con su cantidad a comprar).
  // Reemplaza la selección por checkbox: el usuario elige producto + cantidad y lo agrega.
  selectedItems = signal<any[]>([]);

  // Formulario "Agregar producto": producto elegido del pedido + cantidad a comprar.
  ocProductoSel = signal<any | null>(null);
  ocCantidad = signal<number | null>(null);

  // Proveedores (vista Indigo). Se elige uno para la OC.
  proveedores = signal<any[]>([]);
  isLoadingProveedores = signal<boolean>(false);
  proveedorSeleccionado = signal<any | null>(null);

  /** Nombre de la sucursal tomada del pedido seleccionado (solo lectura, no editable). */
  sucursalPedidoNombre = computed(() => {
    const id = this.selectedSucursalId();
    if (id === null) return '';
    const suc = this.sucursales().find(s => s.id === id);
    return suc?.nombre ?? '';
  });

  /**
   * ¿La sucursal viene heredada del pedido? (el pedido trae sucursal_id).
   * Si es true → campo readonly. Si es false → hay que dejar elegir la sucursal
   * (fallback para pedidos históricos que no tienen sucursal asignada).
   */
  sucursalHeredadaDelPedido = signal<boolean>(false);

  /** Productos del pedido que todavía NO se han agregado a la OC (para el selector). */
  productosDisponibles = computed(() => {
    const yaAgregados = new Set(
      (this.selectedItems() || []).map((d: any) => String(d.id ?? d.pedido_detalle_id ?? d.codigo_producto))
    );
    return (this.newOrdenDetalles() || []).filter((d: any) => {
      const key = String(d.id ?? d.pedido_detalle_id ?? d.codigo_producto);
      const cod = String(d.codigo_producto ?? '').trim();
      return cod !== '' && !yaAgregados.has(key);
    });
  });

  // Computados
  hasSelectedPedido = computed(() => this.selectedPedido() !== null);
  selectedItemsCount = computed(() => {
    const pedido = this.selectedPedido();
    // Si no tenemos los detalles cargados en la lista general, usamos total_articulos
    return pedido ? (pedido.total_articulos || 0) : 0;
  });

  constructor(
    private inventarioService: InventarioService,
    private route: ActivatedRoute,
    private confirmationService: ConfirmationService,
    private messageService: MessageService
  ) { }

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

  /** Carga el catálogo de proveedores (vista Indigo) para el selector de la OC. */
  loadProveedores(): void {
    if (this.proveedores().length > 0) return; // ya cargados
    this.isLoadingProveedores.set(true);
    this.inventarioService.getProveedores().subscribe({
      next: (res) => {
        this.isLoadingProveedores.set(false);
        this.proveedores.set(res.success && Array.isArray(res.data) ? res.data : []);
      },
      error: (err) => {
        this.isLoadingProveedores.set(false);
        console.error('Error cargando proveedores:', err);
        this.proveedores.set([]);
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

  /** Acepta el valor directo (p-dropdown) o un evento de <select> nativo. */
  onStatusFilterChange(value: any): void {
    const val = (value && value.target) ? value.target.value : value;
    this.statusFilterOrdenes.set(val ?? '');
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
      this.messageService.add({ severity: 'warn', summary: 'Dato requerido', detail: 'Por favor ingrese un número de Orden de Compra.' });
      return;
    }

    // Preguntar/exigir la sucursal destino para que el consecutivo sea el correcto.
    const sucursalId = this.selectedSucursalId();
    if (!sucursalId) {
      this.messageService.add({ severity: 'warn', summary: 'Sucursal requerida', detail: 'Seleccione la sucursal destino. El consecutivo se genera según la sucursal.' });
      return;
    }

    const suc = this.sucursales().find(s => s.id === sucursalId);
    this.confirmationService.confirm({
      header: 'Sincronizar desde Indigo',
      message: `Se sincronizará la orden <strong>${num}</strong> hacia la sucursal "<strong>${suc?.nombre ?? sucursalId}</strong>". ¿Continuar?`,
      icon: 'bi bi-cloud-download',
      acceptLabel: 'Sí, sincronizar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-primary',
      rejectButtonStyleClass: 'p-button-text p-button-secondary',
      accept: () => {
        this.isSyncing.set(true);
        this.inventarioService.syncOrdenCompra(num, sucursalId).subscribe({
          next: (res: any) => {
            this.isSyncing.set(false);
            if (res.success) {
              if (res.ya_existia) {
                this.messageService.add({ severity: 'info', summary: 'Ya registrada', detail: `La orden ${num} ya está registrada en el sistema.` });
              } else {
                this.messageService.add({ severity: 'success', summary: 'Sincronizada', detail: res.message || `Orden ${num} sincronizada.` });
              }
              this.numeroOrdenSync.set('');
              this.loadOrdenes();
            } else {
              this.messageService.add({ severity: 'error', summary: 'Error', detail: res.message || 'No se pudo sincronizar.' });
            }
          },
          error: (err: any) => {
            this.isSyncing.set(false);
            console.error('Error syncing:', err);
            this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'Ocurrió un error al sincronizar con INDIGO.' });
          }
        });
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

  /** Números de pedido relacionados a la OC, como texto (ej. "TJA-2026-000001"). */
  pedidosRelacionadosTexto(oc: OrdenCompra | null): string {
    const peds = oc?.pedidos_relacionados ?? [];
    return peds.map(p => p.numero_pedido).filter(Boolean).join(', ');
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
      this.messageService.add({ severity: 'warn', summary: 'No permitido', detail: 'Solo se pueden confirmar órdenes en estado pendiente.' });
      return;
    }

    this.confirmationService.confirm({
      header: 'Confirmar orden de compra',
      message: `¿Confirmar la orden <strong>${oc.numero_orden_compra}</strong>? Esto actualizará los pedidos vinculados.`,
      icon: 'bi bi-check2-circle',
      acceptLabel: 'Sí, confirmar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-success',
      rejectButtonStyleClass: 'p-button-text p-button-secondary',
      accept: () => {
        this.isProcessingAction.set(true);
        this.inventarioService.changeOrdenEstado(oc.id, 'CONFIRMADO').subscribe({
          next: (res) => {
            this.isProcessingAction.set(false);
            if (res.success) {
              this.messageService.add({ severity: 'success', summary: 'Orden confirmada', detail: `La orden ${oc.numero_orden_compra} fue confirmada.` });
              this.loadOrdenes();
            } else {
              this.messageService.add({ severity: 'error', summary: 'Error', detail: res.message || 'No se pudo confirmar la orden.' });
            }
          },
          error: (err) => {
            this.isProcessingAction.set(false);
            console.error('Error confirmando OC:', err);
            const msg = err?.status === 403
              ? 'No tienes permiso para confirmar órdenes de compra.'
              : (err?.error?.message || 'Ocurrió un error al confirmar la orden.');
            this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
          }
        });
      }
    });
  }

  eliminarOrden(oc: OrdenCompra): void {
    if (!this.canEdit(oc)) {
      this.messageService.add({ severity: 'warn', summary: 'No permitido', detail: 'Solo puedes eliminar órdenes creadas desde el aplicativo, propias y en estado pendiente.' });
      return;
    }

    this.confirmationService.confirm({
      header: 'Eliminar orden de compra',
      message: `¿Eliminar la orden <strong>${oc.numero_orden_compra}</strong>? Esta acción no se puede deshacer.`,
      icon: 'bi bi-exclamation-triangle text-danger',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text p-button-secondary',
      accept: () => {
        this.isProcessingAction.set(true);
        this.inventarioService.deleteOrdenCompra(oc.id).subscribe({
          next: (res) => {
            this.isProcessingAction.set(false);
            if (res.success) {
              this.messageService.add({ severity: 'success', summary: 'Orden eliminada', detail: `La orden ${oc.numero_orden_compra} fue eliminada.` });
              this.loadOrdenes();
            } else {
              this.messageService.add({ severity: 'error', summary: 'Error', detail: res.message || 'No se pudo eliminar la orden.' });
            }
          },
          error: (err) => {
            this.isProcessingAction.set(false);
            console.error('Error eliminando OC:', err);
            this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'Ocurrió un error al eliminar la orden.' });
          }
        });
      }
    });
  }

  // ==========================================
  // PEDIDOS CONFIRMADOS
  // ==========================================
  loadPedidos(): void {
    this.isLoadingPedidos.set(true);
    // Pedidos listos para generar OC: los CONFIRMADOS por el Jefe de Almacén
    // quedan en estado 'aprobado', y los que ya tienen compra parcial pasan a
    // 'en_proceso' (aún se les puede seguir comprando). Se traen ambos.
    // El backend restringe además por la sucursal del usuario.
    this.inventarioService.getPedidos({ estado: 'aprobado,en_proceso' }).subscribe({
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
    this.editingOrdenId.set(null);
    this.selectedItems.set([]);
    this.ocProductoSel.set(null);
    this.ocCantidad.set(null);
    this.proveedorSeleccionado.set(null);
    this.sucursalHeredadaDelPedido.set(false);
    this.loadProveedores();
    this.showCreateModal.set(true);
    if (pedidoPrefill) {
      this.newOrdenPedidoSelected.set(pedidoPrefill);
      this.aplicarSucursalDelPedido(pedidoPrefill);
      this.fetchPedidoDetailsForCreation(pedidoPrefill.id);
    } else {
      this.newOrdenPedidoSelected.set(null);
      this.newOrdenDetalles.set([]);
    }
  }

  /** Abre el modal en modo EDICIÓN cargando la OC existente y sus ítems. */
  openEditModal(oc: OrdenCompra): void {
    if (!this.canEdit(oc)) {
      this.messageService.add({ severity: 'warn', summary: 'No permitido', detail: 'Solo puedes editar órdenes creadas desde el aplicativo, propias y en estado pendiente.' });
      return;
    }
    this.editingOrdenId.set(oc.id);
    this.newOrdenPedidoSelected.set(null);
    this.selectedItems.set([]);
    this.proveedorSeleccionado.set(null);
    this.loadProveedores();
    this.showCreateModal.set(true);
    this.isLoadingPedidoDetalle.set(true);

    this.inventarioService.getOrdenCompra(oc.id).subscribe({
      next: (res) => {
        this.isLoadingPedidoDetalle.set(false);
        if (res.success && res.data) {
          // Preseleccionar la sucursal de la OC si viene (readonly en edición).
          if ((res.data as any).sucursal_id) {
            this.selectedSucursalId.set((res.data as any).sucursal_id);
            this.sucursalHeredadaDelPedido.set(true);
          } else {
            this.sucursalHeredadaDelPedido.set(false);
          }
          // Preseleccionar el proveedor de la OC (por nombre) si está en el catálogo.
          const provNombre = (res.data as any).proveedor_nombre || (res.data as any).proveedor;
          if (provNombre) {
            const match = this.proveedores().find(p => p.nombre === provNombre);
            this.proveedorSeleccionado.set(match ?? { nombre: provNombre, nit: '' });
          }
          const detalles = ((res.data.detalles as any[]) || []).map(d => ({
            ...d,
            codigo_producto: d.codigo_producto_indigo ?? d.codigo_producto ?? d.producto_codigo,
            producto_nombre: d.producto_nombre,
            cantidad_solicitada: d.cantidad_solicitada_compra ?? d.cantidad_solicitada ?? 0,
            cantidad_a_comprar: d.cantidad_solicitada_compra ?? 0,
          }));
          this.newOrdenDetalles.set(detalles as PedidoDetalle[]);
          // En edición: todos los ítems existentes quedan seleccionados.
          this.selectedItems.set([...detalles]);
        } else {
          this.newOrdenDetalles.set([]);
        }
      },
      error: (err) => {
        this.isLoadingPedidoDetalle.set(false);
        console.error('Error cargando OC para editar:', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la orden para editar.' });
      }
    });
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
    this.newOrdenPedidoSelected.set(null);
    this.newOrdenDetalles.set([]);
    this.selectedItems.set([]);
    this.editingOrdenId.set(null);
    this.ocProductoSel.set(null);
    this.ocCantidad.set(null);
    this.proveedorSeleccionado.set(null);
    this.sucursalHeredadaDelPedido.set(false);
  }

  onDropdownPedidoChange(event: any): void {
    const pedido = event.value; // Ya pasamos el objeto completo en options
    if (pedido && pedido.id) {
      this.newOrdenPedidoSelected.set(pedido);
      // La sucursal de la OC = la del pedido (se quema, no se elige a mano).
      this.aplicarSucursalDelPedido(pedido);
      this.fetchPedidoDetailsForCreation(pedido.id);
    } else {
      this.newOrdenPedidoSelected.set(null);
      this.newOrdenDetalles.set([]);
      this.selectedItems.set([]);
    }
  }

  /**
   * Fija la sucursal de la OC a partir del pedido. Si el pedido tiene sucursal,
   * se hereda (readonly). Si no la tiene (pedido histórico), se deja elegir a mano.
   */
  private aplicarSucursalDelPedido(pedido: any): void {
    const sucId = pedido?.sucursal_id ?? null;
    if (sucId) {
      this.selectedSucursalId.set(sucId);
      this.sucursalHeredadaDelPedido.set(true);
    } else {
      // El pedido no trae sucursal: dejar elegir (preseleccionar la principal si existe).
      this.sucursalHeredadaDelPedido.set(false);
      const principal = this.sucursales().find(s => s.principal);
      this.selectedSucursalId.set(principal ? principal.id : null);
    }
  }

  // ── Agregar / quitar productos a la OC (uno por uno) ────────────
  /** Al elegir un producto en el selector, precarga la cantidad con la solicitada. */
  onOcProductoChange(event: any): void {
    const prod = event?.value ?? null;
    this.ocProductoSel.set(prod);
    this.ocCantidad.set(prod ? (prod.cantidad_solicitada ?? null) : null);
  }

  /** Agrega el producto elegido (con su cantidad) a la lista de la OC. */
  agregarProductoOc(): void {
    const prod = this.ocProductoSel();
    const cant = Number(this.ocCantidad() ?? 0);
    if (!prod) {
      this.messageService.add({ severity: 'warn', summary: 'Producto requerido', detail: 'Seleccione un producto del pedido.' });
      return;
    }
    if (cant <= 0) {
      this.messageService.add({ severity: 'warn', summary: 'Cantidad inválida', detail: 'La cantidad a comprar debe ser mayor a 0.' });
      return;
    }

    const max = Number(prod.cantidad_solicitada ?? 0);
    // Si se compra MÁS de lo solicitado, no se bloquea: se avisa y se pide confirmar
    // (puede pasar que se compre por encima de lo pedido). Igual que el aviso de Indigo.
    if (max > 0 && cant > max) {
      const exceso = cant - max;
      this.confirmationService.confirm({
        header: 'Compra por encima de lo solicitado',
        message: `El producto <strong>${prod.producto_nombre}</strong> se solicitó por <strong>${max}</strong> y vas a comprar <strong>${cant}</strong> ` +
                 `(<strong>${exceso}</strong> más de lo solicitado). ¿Deseas continuar?`,
        icon: 'bi bi-exclamation-triangle text-warning',
        acceptLabel: 'Sí, comprar de más',
        rejectLabel: 'Ajustar cantidad',
        acceptButtonStyleClass: 'p-button-warning',
        rejectButtonStyleClass: 'p-button-text p-button-secondary',
        accept: () => this.confirmarAgregarItem(prod, cant, true),
      });
      return;
    }

    this.confirmarAgregarItem(prod, cant, false);
  }

  /** Efectivamente agrega el ítem a la lista (marcando si excede lo solicitado). */
  private confirmarAgregarItem(prod: any, cant: number, excedeSolicitado: boolean): void {
    const item = { ...prod, cantidad_a_comprar: cant, excede_solicitado: excedeSolicitado };
    this.selectedItems.update(items => [...items, item]);
    if (excedeSolicitado) {
      this.messageService.add({
        severity: 'info', summary: 'Producto agregado',
        detail: `${prod.producto_nombre}: se comprarán ${cant} (por encima de lo solicitado).`
      });
    }
    // Limpiar el formulario para el siguiente.
    this.ocProductoSel.set(null);
    this.ocCantidad.set(null);
  }

  /** Quita un producto de la lista de la OC. */
  quitarProductoOc(item: any): void {
    this.selectedItems.update(items => items.filter(i => i !== item));
  }

  fetchPedidoDetailsForCreation(pedidoId: number): void {
    this.isLoadingPedidoDetalle.set(true);
    this.inventarioService.getPedido(pedidoId).subscribe({
      next: (res) => {
        this.isLoadingPedidoDetalle.set(false);
        if (res.success && res.data.detalles) {
          // Inicializar la cantidad a comprar = cantidad solicitada (editable).
          const detalles = (res.data.detalles as any[]).map(d => ({
            ...d,
            cantidad_a_comprar: d.cantidad_solicitada ?? 0,
          }));
          this.newOrdenDetalles.set(detalles as PedidoDetalle[]);
          // El usuario agrega los productos uno por uno con el selector; no se preselecciona.
          this.selectedItems.set([]);
          this.ocProductoSel.set(null);
          this.ocCantidad.set(null);
        } else {
          this.newOrdenDetalles.set([]);
          this.selectedItems.set([]);
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
    const sucursalId = this.selectedSucursalId();
    // Si la sucursal NO se hereda del pedido (histórico o edición sin sucursal),
    // el usuario debe elegirla explícitamente.
    if (!this.sucursalHeredadaDelPedido() && !sucursalId) {
      this.messageService.add({ severity: 'warn', summary: 'Sucursal requerida', detail: 'Seleccione la sucursal de la orden. El consecutivo se genera según la sucursal.' });
      return;
    }

    // Solo los ítems agregados con código válido y cantidad a comprar > 0 se relacionan a la OC.
    // El filtro por código evita insertar líneas basura (código/nombre vacíos) como pasó antes.
    const seleccionados = (this.selectedItems() || []).filter((d: any) => {
      const cant = Number(d.cantidad_a_comprar ?? 0);
      const cod = String(d.codigo_producto ?? '').trim();
      return cant > 0 && cod !== '';
    });
    if (seleccionados.length === 0) {
      this.messageService.add({ severity: 'warn', summary: 'Sin productos válidos', detail: 'Seleccione al menos un producto con código y cantidad a comprar mayor a 0.' });
      return;
    }

    const detalles = seleccionados.map((d: any) => ({
      pedido_detalle_id: d.id ?? d.pedido_detalle_id ?? null,
      codigo_producto: d.codigo_producto,
      codigo_producto_indigo: d.codigo_producto,
      producto_nombre: d.producto_nombre,
      cantidad_solicitada_compra: Number(d.cantidad_a_comprar ?? d.cantidad_solicitada ?? 0),
    }));

    // ── Modo EDICIÓN ────────────────────────────────────────────
    const editId = this.editingOrdenId();
    if (editId !== null) {
      const payload = {
        sucursal_id: sucursalId,
        fecha_orden: new Date().toISOString().substring(0, 10),
        proveedor_nombre: this.proveedorSeleccionado()?.nombre ?? null,
        detalles,
      };
      this.isCreating.set(true);
      this.inventarioService.updateOrdenCompra(editId, payload).subscribe({
        next: (res) => {
          this.isCreating.set(false);
          if (res.success) {
            this.messageService.add({ severity: 'success', summary: 'Orden actualizada', detail: 'La orden de compra fue actualizada.' });
            this.closeCreateModal();
            this.loadOrdenes();
          } else {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: res.message || 'No se pudo actualizar la orden.' });
          }
        },
        error: (err) => {
          this.isCreating.set(false);
          console.error('Error actualizando OC:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'Ocurrió un error al actualizar la orden.' });
        }
      });
      return;
    }

    // ── Modo CREACIÓN ───────────────────────────────────────────
    const pedido = this.newOrdenPedidoSelected();
    if (!pedido) {
      this.messageService.add({ severity: 'warn', summary: 'Pedido requerido', detail: 'Debe seleccionar un pedido para continuar.' });
      return;
    }

    const payload = {
      pedido_id: pedido.id,
      sucursal_id: sucursalId,
      fecha_orden: new Date().toISOString().substring(0, 10),
      proveedor_nombre: this.proveedorSeleccionado()?.nombre ?? null,
      detalles,
    };

    this.isCreating.set(true);
    this.inventarioService.createOrdenCompra(payload).subscribe({
      next: (res) => {
        this.isCreating.set(false);
        if (res.success) {
          this.messageService.add({ severity: 'success', summary: 'Orden creada', detail: `Orden de compra creada para el pedido ${pedido.numero_pedido} (${detalles.length} productos).` });
          this.closeCreateModal();
          this.loadOrdenes();
          this.setTab('ordenes');
          this.selectedPedido.set(null);
        } else {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: res.message || 'No se pudo crear la orden.' });
        }
      },
      error: (err) => {
        this.isCreating.set(false);
        console.error('Error creando OC:', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'Ocurrió un error al crear la orden de compra.' });
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
