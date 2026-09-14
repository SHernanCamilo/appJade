import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule, Table } from 'primeng/table';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { CheckboxModule } from 'primeng/checkbox';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { InventarioService } from '../../../core/services/inventario.service';
import { PermissionService } from '../../../core/services/permission.service';
import { Pedido, PedidoDetalle, ProductoItem } from '../../../core/models/inventario.model';
import * as XLSX from 'xlsx';

interface StatusOption {
  label: string;
  value: string;
  severity: 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast';
}

interface SucursalDisponible {
  id: number;
  nombre: string;
  prefijo: string;
  principal: boolean;
  almacen: string | null;
  almacen_codigo: string | null;
}

@Component({
  selector: 'app-pedidos',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    TableModule, SkeletonModule, TagModule,
    ButtonModule, TooltipModule, InputTextModule,
    DialogModule, DropdownModule, OverlayPanelModule, CheckboxModule,
    ToastModule, ConfirmDialogModule
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './pedidos.component.html',
  styleUrls: ['./pedidos.component.css']
})
export class PedidosComponent implements OnInit {
  @ViewChild('dt') dt!: Table;

  pedidos: Pedido[] = [];
  statusFilter: string = '';
  isLoading: boolean = false;
  searchValue: string = '';

  // Modal states
  showOrderModal: boolean = false;
  showNewOrderModal: boolean = false;
  currentOrder: Pedido | null = null;
  isLoadingOrder: boolean = false;
  
  // Trazabilidad
  trazabilidadSearch: string = '';
  filteredTrazabilidad: any[] = [];

  // Bulk upload
  bulkFile: File | null = null;
  bulkRows: Record<string, string>[] = [];
  bulkStatus: string = '';
  isBulkValidating: boolean = false;
  bulkErrors: string[] = [];
  bulkWarnings: string[] = [];
  isDragOver: boolean = false;

  // Sucursales / Almacén (por permisos del usuario)
  sucursales: SucursalDisponible[] = [];
  accesoTotal: boolean = false;          // admin / nacional (recursivo)
  filtroSucursalId: number | null = null; // filtro del listado
  loadingSucursales: boolean = false;

  // Modal de resultado de validación de productos (adelante, no escondido)
  showValidationModal: boolean = false;
  validationValidCount: number = 0;

  // Estado del guardado del pedido (para el loader y bloquear el botón)
  isSavingOrder: boolean = false;
  saveOrderError: string = '';

  // New order form
  newOrder = {
    sucursal_id: null as number | null,
    warehouse: '' as string,
    warehouse_code: '' as string,
    order_type: 'order_general',
    order_date: new Date().toISOString().slice(0, 16),
    observations: '',
    items: [] as ProductoItem[]
  };

  // ¿Debe mostrarse el selector de sucursal?
  // Aparece cuando el usuario puede elegir entre varias sucursales
  // (acceso nacional/total, o tiene más de una sucursal disponible).
  get mostrarSelectorSucursal(): boolean {
    return this.accesoTotal || this.sucursales.length > 1;
  }

  newProduct: ProductoItem = {
    product_code: '', product_name: '', product_type: '', quantity: 1,
    price: 0, brand: '', rotation_type: '', average_cost: 0
  };

  // Autocompletado del producto por código (consulta el parquet vía backend)
  isLookingUpProduct: boolean = false;   // spinner mientras consulta
  productLookupError: string = '';       // mensaje si no se encuentra
  productFound: boolean = false;         // true cuando el código fue validado OK
  private lookupTimer: any = null;       // debounce del input de código
  private lastLookupCode: string = '';   // evita consultar el mismo código repetido

  // ── Filtro tipo Excel por columna (checkboxes de valores únicos) ──────────
  // Selección aplicada por campo: { campo: Set<valores seleccionados> }.
  excelFilters: Record<string, Set<string>> = {};
  // Estado temporal del panel abierto (antes de "Aceptar").
  excelFilterCampo: string = '';
  excelFilterBuscar: string = '';
  excelFilterValoresPendientes: Set<string> = new Set();

  /** Ítems visibles tras aplicar los filtros tipo Excel de cada columna. */
  get itemsFiltrados(): ProductoItem[] {
    const campos = Object.keys(this.excelFilters);
    if (campos.length === 0) return this.newOrder.items;

    return this.newOrder.items.filter(item =>
      campos.every(campo => {
        const sel = this.excelFilters[campo];
        if (!sel || sel.size === 0) return true;
        return sel.has(this.valorCampo(item, campo));
      })
    );
  }

  /** Total del pedido (el precio de cada ítem ya es Cantidad × Costo Promedio). */
  get totalPedido(): number {
    return this.itemsFiltrados.reduce((acc, i) => acc + (i.price || 0), 0);
  }

  /** Valor de un campo del ítem, normalizado a texto para comparar/agrupar. */
  private valorCampo(item: any, campo: string): string {
    const v = item?.[campo];
    if (v === null || v === undefined || v === '') return '(Vacío)';
    return String(v).trim();
  }

  /** ¿La columna tiene un filtro activo? (para pintar el embudo). */
  columnaFiltrada(campo: string): boolean {
    return !!this.excelFilters[campo] && this.excelFilters[campo].size > 0;
  }

  /** Abre el panel de filtro de una columna: carga sus valores únicos. */
  abrirFiltroColumna(campo: string): void {
    this.excelFilterCampo = campo;
    this.excelFilterBuscar = '';
    // Preseleccionar lo ya aplicado, o todo si no hay filtro.
    const aplicados = this.excelFilters[campo];
    this.excelFilterValoresPendientes = aplicados
      ? new Set(aplicados)
      : new Set(this.valoresUnicosDe(campo));
  }

  /** Valores únicos (ordenados) de un campo sobre los ítems del pedido. */
  valoresUnicosDe(campo: string): string[] {
    const set = new Set<string>();
    this.newOrder.items.forEach(i => set.add(this.valorCampo(i, campo)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
  }

  /** Valores del campo actual filtrados por el buscador del panel. */
  get valoresPanelFiltro(): string[] {
    const term = this.excelFilterBuscar.trim().toLowerCase();
    const todos = this.valoresUnicosDe(this.excelFilterCampo);
    return term ? todos.filter(v => v.toLowerCase().includes(term)) : todos;
  }

  estaSeleccionadoValor(valor: string): boolean {
    return this.excelFilterValoresPendientes.has(valor);
  }

  toggleValorFiltro(valor: string, checked: boolean): void {
    if (checked) this.excelFilterValoresPendientes.add(valor);
    else this.excelFilterValoresPendientes.delete(valor);
  }

  get todosSeleccionadosPanel(): boolean {
    const visibles = this.valoresPanelFiltro;
    return visibles.length > 0 && visibles.every(v => this.excelFilterValoresPendientes.has(v));
  }

  toggleSeleccionarTodoPanel(checked: boolean): void {
    const visibles = this.valoresPanelFiltro;
    if (checked) visibles.forEach(v => this.excelFilterValoresPendientes.add(v));
    else visibles.forEach(v => this.excelFilterValoresPendientes.delete(v));
  }

  /** Aplica el filtro de la columna: guarda la selección (null = sin filtro). */
  aplicarFiltroColumna(overlay?: any): void {
    const todos = this.valoresUnicosDe(this.excelFilterCampo);
    const sel = this.excelFilterValoresPendientes;
    // Si están todos seleccionados, es como no filtrar → quitar el filtro.
    if (sel.size === 0 || sel.size === todos.length) {
      delete this.excelFilters[this.excelFilterCampo];
    } else {
      this.excelFilters[this.excelFilterCampo] = new Set(sel);
    }
    overlay?.hide();
  }

  /** Limpia el filtro de la columna actual. */
  limpiarFiltroColumna(overlay?: any): void {
    delete this.excelFilters[this.excelFilterCampo];
    this.excelFilterValoresPendientes = new Set(this.valoresUnicosDe(this.excelFilterCampo));
    overlay?.hide();
  }

  /** Limpia todos los filtros de columna. */
  limpiarTodosLosFiltros(): void {
    this.excelFilters = {};
  }

  get hayFiltrosExcelActivos(): boolean {
    return Object.keys(this.excelFilters).length > 0;
  }

  /** Recalcula el Precio de la línea del formulario: Cantidad × Costo Promedio. */
  recalcularPrecioForm(): void {
    const cantidad = Number(this.newProduct.quantity) || 0;
    const costo = Number(this.newProduct.average_cost) || 0;
    this.newProduct.price = +(cantidad * costo).toFixed(2);
  }

  statusOptions: StatusOption[] = [
    { label: 'Borrador', value: 'borrador', severity: 'secondary' },
    { label: 'Pendiente', value: 'pendiente', severity: 'warn' },
    { label: 'Solicitado', value: 'solicitado', severity: 'warn' },
    { label: 'Aprobado', value: 'aprobado', severity: 'success' },
    { label: 'En Proceso', value: 'en_proceso', severity: 'info' },
    { label: 'Parcial', value: 'parcial', severity: 'info' },
    { label: 'En Tránsito', value: 'en_transito', severity: 'info' },
    { label: 'Recibido', value: 'recibido', severity: 'success' },
    { label: 'Rechazado', value: 'rechazado', severity: 'danger' },
    { label: 'Cancelado', value: 'cancelado', severity: 'danger' }
  ];

  constructor(
    private inventarioService: InventarioService,
    private permissionService: PermissionService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadSucursales();
    this.loadPedidos();
  }

  /** ¿El usuario puede confirmar pedidos? (rol Jefe de Almacén con permiso). */
  get puedeConfirmarPedido(): boolean {
    return this.permissionService.hasPermission('confirmar-pedido');
  }

  /** ¿El pedido está en un estado confirmable? (borrador/solicitado/pendiente sin gestionar). */
  esConfirmable(pedido: Pedido): boolean {
    const estado = String(pedido?.estado || '').trim().toLowerCase();
    // 'pendiente' y '' cubren pedidos creados por el flujo actual que aún no se aprueban.
    return ['borrador', 'solicitado', 'pendiente', ''].includes(estado);
  }

  /** Confirma (aprueba) el pedido — acción del Jefe de Almacén. */
  confirmarPedido(pedido: Pedido): void {
    this.confirmationService.confirm({
      header: 'Confirmar pedido',
      message: `¿Confirmar el pedido <strong>${pedido.numero_pedido}</strong>? Pasará a estado Aprobado y quedará disponible para compras.`,
      icon: 'bi bi-check2-circle',
      acceptLabel: 'Sí, confirmar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-success',
      rejectButtonStyleClass: 'p-button-text p-button-secondary',
      accept: () => {
        this.inventarioService.confirmarPedido(pedido.id).subscribe({
          next: (res: any) => {
            if (res.success) {
              this.messageService.add({ severity: 'success', summary: 'Pedido confirmado', detail: `El pedido ${pedido.numero_pedido} fue aprobado.` });
              this.loadPedidos();
            } else {
              this.messageService.add({ severity: 'error', summary: 'Error', detail: res.message || 'No se pudo confirmar el pedido.' });
            }
          },
          error: (err: any) => {
            const msg = err?.status === 403
              ? 'No tienes permiso para confirmar pedidos (requiere el permiso confirmar-pedido).'
              : (err?.error?.message || 'Error al confirmar el pedido.');
            this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
          }
        });
      }
    });
  }

  /** Rechaza el pedido — acción del Jefe de Almacén (mismo permiso). */
  rechazarPedido(pedido: Pedido): void {
    this.confirmationService.confirm({
      header: 'Rechazar pedido',
      message: `¿Rechazar el pedido <strong>${pedido.numero_pedido}</strong>? Esta acción marca el pedido como Rechazado.`,
      icon: 'bi bi-x-circle text-danger',
      acceptLabel: 'Sí, rechazar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text p-button-secondary',
      accept: () => {
        this.inventarioService.rechazarPedido(pedido.id).subscribe({
          next: (res: any) => {
            if (res.success) {
              this.messageService.add({ severity: 'success', summary: 'Pedido rechazado', detail: `El pedido ${pedido.numero_pedido} fue rechazado.` });
              this.loadPedidos();
            } else {
              this.messageService.add({ severity: 'error', summary: 'Error', detail: res.message || 'No se pudo rechazar el pedido.' });
            }
          },
          error: (err: any) => {
            const msg = err?.status === 403
              ? 'No tienes permiso para rechazar pedidos (requiere el permiso confirmar-pedido).'
              : (err?.error?.message || 'Error al rechazar el pedido.');
            this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
          }
        });
      }
    });
  }

  /** Carga las sucursales/almacenes disponibles según los permisos del usuario. */
  loadSucursales(): void {
    this.loadingSucursales = true;
    this.inventarioService.getSucursalesDisponiblesPedido().subscribe({
      next: (res: any) => {
        this.loadingSucursales = false;
        this.sucursales = res?.success ? (res.data || []) : [];
        this.accesoTotal = !!res?.meta?.acceso_total;

        // Preseleccionar: la principal, o la única disponible.
        const principal = this.sucursales.find(s => s.principal);
        const preseleccion = principal || (this.sucursales.length === 1 ? this.sucursales[0] : null);
        if (preseleccion) {
          this.newOrder.sucursal_id = preseleccion.id;
          this.aplicarAlmacenPorSucursal(preseleccion.id);
        }
      },
      error: () => {
        this.loadingSucursales = false;
        this.sucursales = [];
      }
    });
  }

  /** Al cambiar la sucursal en el formulario, fija el almacén asociado. */
  onSucursalChange(): void {
    this.aplicarAlmacenPorSucursal(this.newOrder.sucursal_id);
  }

  private aplicarAlmacenPorSucursal(sucursalId: number | null): void {
    const suc = this.sucursales.find(s => s.id === sucursalId) || null;
    this.newOrder.warehouse = suc?.almacen || '';
    this.newOrder.warehouse_code = suc?.almacen_codigo || '';
  }

  loadPedidos(): void {
    this.isLoading = true;
    const filters: any = {};
    if (this.statusFilter) filters.estado = this.statusFilter;
    // El backend ya restringe por permisos; este filtro es una vista adicional
    // para que el usuario nacional acote a una sucursal puntual.
    if (this.filtroSucursalId) filters.sucursal_id = this.filtroSucursalId;

    this.inventarioService.getPedidos(filters).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.pedidos = res.success ? res.data : [];
      },
      error: () => {
        this.isLoading = false;
        this.pedidos = [];
      }
    });
  }

  onGlobalFilter(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.dt.filterGlobal(value, 'contains');
  }

  /** Normaliza el estado a minúsculas (el backend puede enviar BORRADOR, etc.). */
  private normEstado(estado: string | undefined | null): string {
    return String(estado || '').trim().toLowerCase();
  }

  getStatusLabel(estado: string): string {
    const e = this.normEstado(estado);
    return this.statusOptions.find(s => s.value === e)?.label || estado || '—';
  }

  getStatusSeverity(estado: string): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' {
    const e = this.normEstado(estado);
    return this.statusOptions.find(s => s.value === e)?.severity || 'secondary';
  }

  /** Clases del badge de estado (normaliza mayúsculas del backend). */
  badgeClass(estado: string): Record<string, boolean> {
    const e = this.normEstado(estado);
    return {
      'bg-secondary text-white': e === 'borrador',
      'bg-warning text-dark': e === 'pendiente' || e === 'solicitado',
      'bg-info text-dark': e === 'en_proceso' || e === 'en_transito' || e === 'parcial',
      'bg-success': e === 'aprobado' || e === 'recibido',
      'bg-danger': e === 'cancelado' || e === 'rechazado',
    };
  }

  // ==========================================
  // MODALS
  // ==========================================
  openNewOrderModal(): void {
    this.showNewOrderModal = true;
    this.newOrder.items = [];
    // Asegurar una sucursal preseleccionada al abrir (principal o única).
    if (!this.newOrder.sucursal_id) {
      const principal = this.sucursales.find(s => s.principal) || (this.sucursales.length === 1 ? this.sucursales[0] : null);
      if (principal) {
        this.newOrder.sucursal_id = principal.id;
      }
    }
    this.aplicarAlmacenPorSucursal(this.newOrder.sucursal_id);
    this.saveOrderError = '';
    this.limpiarTodosLosFiltros();
    this.clearProductForm();
  }

  closeNewOrderModal(): void {
    this.showNewOrderModal = false;
    this.saveOrderError = '';
  }

  viewOrder(pedido: Pedido): void {
    this.showOrderModal = true;
    this.isLoadingOrder = true;
    this.trazabilidadSearch = '';
    this.inventarioService.getPedido(pedido.id).subscribe({
      next: (res) => {
        this.isLoadingOrder = false;
        if (res.success) {
          this.currentOrder = res.data;
          this.filteredTrazabilidad = this.currentOrder?.trazabilidad || [];
        }
      },
      error: () => { this.isLoadingOrder = false; }
    });
  }

  filterTrazabilidad(): void {
    if (!this.currentOrder?.trazabilidad) return;
    
    const term = this.trazabilidadSearch.toLowerCase();
    this.filteredTrazabilidad = this.currentOrder.trazabilidad.filter(t => 
      t.estado.toLowerCase().includes(term) ||
      (t.usuario?.name || '').toLowerCase().includes(term) ||
      (t.comentarios || '').toLowerCase().includes(term)
    );
  }

  exportTraceabilityExcel(): void {
    if (!this.currentOrder) return;
    
    // Preparar datos de productos
    const productos = (this.currentOrder.detalles || []).map(d => ({
      'Código': d.codigo_producto,
      'Producto': d.producto_nombre,
      'Cant. Solicitada': d.cantidad_solicitada,
      'Última OC': 'Sin OC',
      'Proveedor': '-',
      'Cant. Recibida': d.cantidad_recibida,
      'Estado': this.getStatusLabel(d.estado),
      'Cumplimiento': `${((d.cantidad_recibida / d.cantidad_solicitada) * 100) || 0}%`
    }));

    // Preparar datos de trazabilidad
    const trazabilidad = (this.currentOrder.trazabilidad || []).map(t => ({
      'Fecha': new Date(t.created_at).toLocaleString(),
      'Estado': this.getStatusLabel(t.estado),
      'Usuario': t.usuario?.name || 'Sistema',
      'Comentarios': t.comentarios || '-'
    }));

    const wb = XLSX.utils.book_new();
    
    const wsProductos = XLSX.utils.json_to_sheet(productos);
    XLSX.utils.book_append_sheet(wb, wsProductos, 'Productos Solicitados');
    
    if (trazabilidad.length > 0) {
      const wsTrazabilidad = XLSX.utils.json_to_sheet(trazabilidad);
      XLSX.utils.book_append_sheet(wb, wsTrazabilidad, 'Historial Trazabilidad');
    }

    XLSX.writeFile(wb, `Trazabilidad_Pedido_${this.currentOrder.numero_pedido}.xlsx`);
  }

  closeOrderModal(): void {
    this.showOrderModal = false;
    this.currentOrder = null;
  }

  // ==========================================
  // PRODUCT FORM
  // ==========================================

  /**
   * Se dispara mientras se escribe el código. Aplica un pequeño debounce y luego
   * consulta el producto (parquet vía backend) para autocompletar los campos.
   */
  onProductCodeInput(): void {
    const code = (this.newProduct.product_code || '').trim();
    // Al cambiar el código, se invalida lo autocompletado previo.
    this.productFound = false;
    this.productLookupError = '';

    if (this.lookupTimer) clearTimeout(this.lookupTimer);
    if (code.length < 3) return; // evita consultas con códigos muy cortos

    this.lookupTimer = setTimeout(() => this.lookupProducto(code), 500);
  }

  /** Consulta inmediata al salir del campo código (blur) o al presionar Enter. */
  onProductCodeBlur(): void {
    const code = (this.newProduct.product_code || '').trim();
    if (code.length >= 3 && !this.productFound && !this.isLookingUpProduct) {
      if (this.lookupTimer) clearTimeout(this.lookupTimer);
      this.lookupProducto(code);
    }
  }

  /**
   * Valida el código contra el catálogo (mismo camino parquet que la carga masiva)
   * y autocompleta Producto, Tipo, Marca, Costo Promedio y Precio.
   */
  private lookupProducto(code: string): void {
    if (this.isLookingUpProduct && code === this.lastLookupCode) return;
    this.lastLookupCode = code;
    this.isLookingUpProduct = true;
    this.productLookupError = '';
    this.productFound = false;

    // Reutiliza el endpoint de validación (parquet + fallback GraphQL).
    this.inventarioService.validateBulkProducts([
      { product_code: code, quantity: this.newProduct.quantity || 1 }
    ]).subscribe({
      next: (res: any) => {
        this.isLookingUpProduct = false;
        const item = res?.success && Array.isArray(res.data) ? res.data[0] : null;

        if (item) {
          // Campos autocompletados desde el catálogo (quedan bloqueados en el form).
          this.newProduct.product_code = item.product_code || code;
          this.newProduct.product_name = item.product_name || '';
          this.newProduct.product_type = item.product_type || item.tipo_producto || '';
          this.newProduct.brand = item.brand || '';
          this.newProduct.average_cost = Number(item.average_cost || 0);
          this.productFound = true;
          // El precio de la línea = Cantidad × Costo Promedio (automático).
          this.recalcularPrecioForm();
        } else {
          const err = (res?.errors && res.errors[0]) ? res.errors[0] : `No se encontró el producto con código ${code}.`;
          this.productLookupError = err;
        }
      },
      error: () => {
        this.isLookingUpProduct = false;
        this.productLookupError = 'Error de conexión al validar el producto.';
      }
    });
  }

  addProduct(): void {
    if (!this.newProduct.product_code || !this.newProduct.quantity) return;
    // Exigir que el producto haya sido validado contra el catálogo.
    if (!this.productFound) {
      this.productLookupError = 'Primero valida el código del producto (debe existir en el catálogo).';
      return;
    }
    this.newOrder.items.push({ ...this.newProduct });
    this.clearProductForm();
  }

  clearProductForm(): void {
    this.newProduct = {
      product_code: '', product_name: '', product_type: '', quantity: 1,
      price: 0, brand: '', rotation_type: '', average_cost: 0
    };
    this.productFound = false;
    this.productLookupError = '';
    this.lastLookupCode = '';
    this.isLookingUpProduct = false;
  }

  /** Quita un ítem (por referencia, para que funcione con la tabla filtrada). */
  removeProduct(item: ProductoItem): void {
    const idx = this.newOrder.items.indexOf(item);
    if (idx >= 0) this.newOrder.items.splice(idx, 1);
  }

  /**
   * Carga un ítem ya agregado al formulario para editar su cantidad/rotación.
   * Lo saca de la lista; al pulsar "Agregar" vuelve a entrar con los cambios.
   */
  editItem(item: ProductoItem): void {
    if (!item) return;
    this.newProduct = { ...item };
    // El producto ya fue validado al agregarlo; se marca como válido para reagregar.
    this.productFound = true;
    this.productLookupError = '';
    this.recalcularPrecioForm();
    const idx = this.newOrder.items.indexOf(item);
    if (idx >= 0) this.newOrder.items.splice(idx, 1);
  }

  /** ¿El formulario de nuevo pedido es válido para enviarse? */
  get puedeGuardarPedido(): boolean {
    const sucursalOk = !this.mostrarSelectorSucursal || !!this.newOrder.sucursal_id;
    return this.newOrder.items.length > 0 && sucursalOk;
  }

  saveOrder(): void {
    if (this.isSavingOrder) return; // evita doble envío
    this.saveOrderError = '';

    if (this.mostrarSelectorSucursal && !this.newOrder.sucursal_id) {
      this.saveOrderError = 'Selecciona la sucursal donde vas a realizar el pedido.';
      return;
    }
    if (this.newOrder.items.length === 0) {
      this.saveOrderError = 'Agrega al menos un producto al pedido.';
      return;
    }

    // Contrato backend: sucursal_id define el consecutivo (prefijo) y el almacén;
    // los detalles usan codigo_producto/producto_nombre/cantidad_solicitada.
    const payload = {
      sucursal_id: this.newOrder.sucursal_id,
      almacen: this.newOrder.warehouse || null,
      fecha_pedido: this.newOrder.order_date,
      observaciones: this.buildObservaciones(),
      detalles: this.newOrder.items.map(i => ({
        codigo_producto: i.product_code,
        producto_nombre: i.product_name,
        producto_tipo: i.product_type || null,
        producto_marca: i.brand || null,
        producto_promedio: i.average_cost ?? null,
        producto_rotacion: i.rotation_type || null,
        cantidad_solicitada: i.quantity,
        // precio_unitario = costo promedio (unitario); el total = cantidad × costo.
        precio_unitario: i.average_cost || 0
      }))
    };

    this.isSavingOrder = true;
    this.inventarioService.createPedido(payload).subscribe({
      next: (res) => {
        this.isSavingOrder = false;
        if (res.success) {
          this.closeNewOrderModal();
          this.loadPedidos();
        } else {
          this.saveOrderError = res.message || 'No se pudo crear el pedido.';
        }
      },
      error: (err) => {
        this.isSavingOrder = false;
        this.saveOrderError = err?.error?.message || err?.error?.error || 'Error al crear el pedido. Intenta de nuevo.';
        console.error('Error saving pedido:', err);
      }
    });
  }

  /** Compone las observaciones incluyendo tipo de pedido y almacén (como el legacy). */
  private buildObservaciones(): string {
    const partes: string[] = [];
    if (this.newOrder.observations?.trim()) {
      partes.push(this.newOrder.observations.trim());
    }
    const tipo = this.getTipoPedidoLabel(this.newOrder.order_type);
    if (tipo) partes.push(`Tipo: ${tipo}`);
    if (this.newOrder.warehouse) partes.push(`Almacén: ${this.newOrder.warehouse}`);
    return partes.join(' | ');
  }

  private getTipoPedidoLabel(value: string): string {
    switch (value) {
      case 'order_general': return 'Pedido General';
      case 'order_spontaneous': return 'Pedido Espontáneo';
      case 'order_urgencies': return 'Pedido Urgencias';
      default: return value;
    }
  }

  confirmOrder(id: number): void {
    if (confirm('¿Confirmar este pedido?')) {
      this.inventarioService.changePedidoEstado(id, 'en_proceso').subscribe({
        next: () => this.loadPedidos(),
        error: (err) => console.error('Error', err)
      });
    }
  }

  cancelOrder(id: number): void {
    if (confirm('¿Cancelar este pedido?')) {
      this.inventarioService.changePedidoEstado(id, 'cancelado').subscribe({
        next: () => this.loadPedidos(),
        error: (err) => console.error('Error', err)
      });
    }
  }

  // ==========================================
  // BULK UPLOAD
  // ==========================================
  downloadTemplate(): void {
    const data = [
      { product_code: '3001.05585', quantity: 10, rotation_type: 'media' },
      { product_code: '3001.05586', quantity: 25, rotation_type: 'alta' }
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pedidos');
    XLSX.writeFile(wb, 'plantilla_pedidos.xlsx');
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(): void {
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processFile(files[0]);
    }
  }

  onFileSelect(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.processFile(file);
  }

  private async processFile(file: File): Promise<void> {
    this.bulkFile = file;
    this.bulkStatus = '';
    this.bulkErrors = [];
    this.bulkWarnings = [];
    this.bulkRows = [];

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      this.bulkRows = rows.map(row => {
        const normalized: Record<string, string> = {};
        Object.keys(row).forEach(key => {
          normalized[key.trim().toLowerCase()] = String(row[key]).trim();
        });
        return normalized;
      }).filter(r => Object.values(r).some(v => v !== ''));

      this.bulkStatus = `${this.bulkRows.length} filas encontradas. Haga clic en "Procesar carga" para validar.`;
    } catch {
      this.bulkStatus = 'Error al leer el archivo Excel.';
      this.bulkFile = null;
    }
  }

  clearBulkFile(): void {
    this.bulkFile = null;
    this.bulkRows = [];
    this.bulkStatus = '';
    this.bulkErrors = [];
    this.bulkWarnings = [];
    const fileInput = document.getElementById('bulkFileInput') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }

  processBulkOrders(): void {
    if (this.bulkRows.length === 0) return;

    this.isBulkValidating = true;
    this.bulkStatus = 'Validando productos en el servidor...';
    this.bulkErrors = [];
    this.bulkWarnings = [];

    this.inventarioService.validateBulkProducts(this.bulkRows).subscribe({
      next: (res) => {
        this.isBulkValidating = false;
        if (res.success) {
          const validItems: ProductoItem[] = res.data || [];
          this.bulkErrors = res.errors || [];
          this.bulkWarnings = res.warnings || [];

          this.validationValidCount = validItems.length;

          if (validItems.length > 0) {
            this.openNewOrderModal();
            this.newOrder.items = validItems.map((vi: any) => ({
              product_code: vi.product_code,
              product_name: vi.product_name,
              product_type: vi.product_type || vi.tipo_producto || '',
              quantity: vi.quantity,
              rotation_type: vi.rotation_type,
              price: vi.price,
              average_cost: vi.average_cost,
              brand: vi.brand
            }));
            this.bulkStatus = `${validItems.length} producto(s) cargados al formulario.`;
          } else {
            this.bulkStatus = 'No se encontraron productos válidos para importar.';
          }

          // Mostrar el resultado al frente para que el usuario quede notificado.
          this.showValidationModal = true;
        } else {
          this.bulkStatus = 'Error al validar: ' + res.message;
        }
      },
      error: () => {
        this.isBulkValidating = false;
        this.bulkStatus = 'Error de conexión al validar archivo.';
      }
    });
  }

  closeValidationModal(): void {
    this.showValidationModal = false;
  }
}
