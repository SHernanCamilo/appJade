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
import { InventarioService } from '../../../core/services/inventario.service';
import { Pedido, PedidoDetalle, ProductoItem } from '../../../core/models/inventario.model';
import * as XLSX from 'xlsx';

interface StatusOption {
  label: string;
  value: string;
  severity: 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast';
}

@Component({
  selector: 'app-pedidos',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    TableModule, SkeletonModule, TagModule,
    ButtonModule, TooltipModule, InputTextModule,
    DialogModule, DropdownModule
  ],
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

  // New order form
  newOrder = {
    warehouseSelect: '',
    order_type: 'order_general',
    order_date: new Date().toISOString().slice(0, 16),
    observations: '',
    items: [] as ProductoItem[]
  };

  newProduct: ProductoItem = {
    product_code: '', product_name: '', quantity: 1,
    price: 0, brand: '', rotation_type: '', average_cost: 0
  };

  statusOptions: StatusOption[] = [
    { label: 'Pendiente', value: 'pendiente', severity: 'warn' },
    { label: 'Orden realizada', value: 'en_proceso', severity: 'info' },
    { label: 'Recibido', value: 'recibido', severity: 'success' },
    { label: 'Aprobado', value: 'aprobado', severity: 'success' },
    { label: 'Rechazado', value: 'rechazado', severity: 'danger' },
    { label: 'Cancelado', value: 'cancelado', severity: 'danger' }
  ];

  constructor(private inventarioService: InventarioService) {}

  ngOnInit(): void {
    this.loadPedidos();
  }

  loadPedidos(): void {
    this.isLoading = true;
    const filters = this.statusFilter ? { estado: this.statusFilter } : {};
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

  getStatusLabel(estado: string): string {
    return this.statusOptions.find(s => s.value === estado)?.label || estado;
  }

  getStatusSeverity(estado: string): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' {
    return this.statusOptions.find(s => s.value === estado)?.severity || 'secondary';
  }

  // ==========================================
  // MODALS
  // ==========================================
  openNewOrderModal(): void {
    this.showNewOrderModal = true;
    this.newOrder.items = [];
    this.clearProductForm();
  }

  closeNewOrderModal(): void {
    this.showNewOrderModal = false;
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
  addProduct(): void {
    if (!this.newProduct.product_code || !this.newProduct.quantity) return;
    this.newOrder.items.push({ ...this.newProduct });
    this.clearProductForm();
  }

  clearProductForm(): void {
    this.newProduct = {
      product_code: '', product_name: '', quantity: 1,
      price: 0, brand: '', rotation_type: '', average_cost: 0
    };
  }

  removeProduct(index: number): void {
    this.newOrder.items.splice(index, 1);
  }

  saveOrder(): void {
    const payload = {
      branch_id: 1,
      order_type: this.newOrder.order_type,
      order_date: this.newOrder.order_date,
      observations: this.newOrder.observations,
      items: this.newOrder.items.map(i => ({
        product_code: i.product_code,
        product_name: i.product_name,
        quantity: i.quantity,
        price: i.price || 0,
        brand: i.brand,
        rotation_type: i.rotation_type,
        average_cost: i.average_cost
      }))
    };

    this.inventarioService.createPedido(payload).subscribe({
      next: (res) => {
        if (res.success) {
          this.closeNewOrderModal();
          this.loadPedidos();
        }
      },
      error: (err) => console.error('Error saving pedido:', err)
    });
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

          if (validItems.length > 0) {
            this.openNewOrderModal();
            this.newOrder.items = validItems.map(vi => ({
              product_code: vi.product_code,
              product_name: vi.product_name,
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
}
