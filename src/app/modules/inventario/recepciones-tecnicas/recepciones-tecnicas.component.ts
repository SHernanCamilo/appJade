import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { SkeletonModule } from 'primeng/skeleton';
import { CheckboxModule } from 'primeng/checkbox';
import { InventarioService } from '../../../core/services/inventario.service';
import { OrdenCompra, RecepcionItem } from '../../../core/models/inventario.model';

interface RecepcionFormData {
  codigo_producto: string;
  producto_nombre: string;
  cantidad_solicitada_compra: number;
  cantidad_recibida: number;
  numero_lote: string;
  fecha_vencimiento: string;
  codigo_sanitario: string; // CUM o Registro INVIMA
  concepto_recepcion: 'aceptado' | 'rechazado' | 'cuarentena' | '';
  es_medicamento_vital: boolean;
  observaciones: string;
}

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
    DropdownModule,
    SkeletonModule,
    CheckboxModule
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

  // Búsqueda
  globalFilterFields = ['numero_orden_compra', 'oc_indigo', 'creado_por_nombre'];

  // Modal Ver Detalles
  showDetailsModal = signal<boolean>(false);
  currentReception = signal<OrdenCompra | null>(null);
  currentDetails = signal<RecepcionItem[]>([]);
  isLoadingDetails = signal<boolean>(false);

  // Modal Realizar Recepción Técnica
  showReceptionModal = signal<boolean>(false);
  isSubmittingReception = signal<boolean>(false);
  currentReceptionForm = signal<RecepcionFormData[]>([]);
  receptionGlobalObservations = signal<string>('');

  conceptoOptions = [
    { label: 'Seleccionar...', value: '' },
    { label: 'Aceptado', value: 'aceptado' },
    { label: 'Cuarentena', value: 'cuarentena' },
    { label: 'Rechazado', value: 'rechazado' }
  ];

  constructor(private inventarioService: InventarioService) {}

  ngOnInit(): void {
    this.loadCompras();
  }

  loadCompras(): void {
    this.isLoading.set(true);
    const status = this.currentView() === 'pending' ? 'confirmado,en_sitio,parcial' : 'recibida';
    
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
      error: (err) => {
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
    if (confirm('¿Confirmar llegada de la orden al sitio?')) {
      this.inventarioService.confirmarRecepcion(id).subscribe({
        next: (res) => {
          if (res.success) {
            this.loadCompras(); // Recargar para actualizar el estado
          } else {
            alert('Error: ' + res.message);
          }
        },
        error: (err) => console.error(err)
      });
    }
  }

  // --- Realizar Recepción Técnica ---
  openReceptionModal(orden: OrdenCompra): void {
    if (!orden.compra_id) return;
    
    this.currentReception.set(orden);
    this.showReceptionModal.set(true);
    this.isLoadingDetails.set(true);
    this.currentReceptionForm.set([]);
    this.receptionGlobalObservations.set('');

    // Cargar detalles pendientes de la orden de compra
    this.inventarioService.getRecepcion(orden.compra_id).subscribe({
      next: (res) => {
        this.isLoadingDetails.set(false);
        if (res.success && res.data) {
          const formItems: RecepcionFormData[] = res.data.map((item: any) => ({
            codigo_producto: item.codigo_producto,
            producto_nombre: item.producto_nombre,
            cantidad_solicitada_compra: item.cantidad_solicitada_compra,
            cantidad_recibida: item.cantidad_solicitada_compra, // Sugerimos la cantidad total por defecto
            numero_lote: '',
            fecha_vencimiento: '',
            codigo_sanitario: '',
            concepto_recepcion: 'aceptado', // Sugerimos aceptado por defecto
            es_medicamento_vital: false,
            observaciones: ''
          }));
          this.currentReceptionForm.set(formItems);
        }
      },
      error: (err) => {
        this.isLoadingDetails.set(false);
        console.error('Error loading details for reception:', err);
      }
    });
  }

  closeReceptionModal(): void {
    this.showReceptionModal.set(false);
    this.currentReception.set(null);
    this.currentReceptionForm.set([]);
  }

  submitReception(): void {
    const orden = this.currentReception();
    if (!orden || !orden.compra_id) return;

    // Validación básica
    const formItems = this.currentReceptionForm();
    const hasErrors = formItems.some(item => 
      item.cantidad_recibida > 0 && (!item.numero_lote || !item.fecha_vencimiento || !item.concepto_recepcion)
    );

    if (hasErrors) {
      alert('Por favor complete Lote, Vencimiento y Concepto para todos los ítems que está recibiendo.');
      return;
    }

    this.isSubmittingReception.set(true);
    const payload = {
      compra_id: orden.compra_id,
      observaciones: this.receptionGlobalObservations(),
      items: formItems.filter(i => i.cantidad_recibida > 0) // Solo enviar los que se reciben
    };

    // Usar cualquier método existente para enviar (ej: store)
    // Asumiendo que inventarioService.createReception maneja el POST /api/inventario/recepciones
    this.inventarioService.createReception(payload).subscribe({
      next: (res) => {
        if (res.success) {
          // Si todo salió bien, podríamos confirmar directamente o esperar otro paso.
          // Aquí directamente cerramos y recargamos.
          this.closeReceptionModal();
          this.loadCompras();
        } else {
          this.isSubmittingReception.set(false);
          alert('Error: ' + res.message);
        }
      },
      error: (err) => {
        this.isSubmittingReception.set(false);
        console.error(err);
        alert('Ocurrió un error al guardar la recepción técnica.');
      }
    });
  }

  // --- Ver Detalles (Completadas) ---
  viewDetails(orden: OrdenCompra): void {
    if (!orden.compra_id) return;
    
    this.currentReception.set(orden);
    this.showDetailsModal.set(true);
    this.isLoadingDetails.set(true);
    
    this.inventarioService.getRecepcion(orden.compra_id).subscribe({
      next: (res) => {
        this.isLoadingDetails.set(false);
        if (res.success) {
          this.currentDetails.set(res.data);
        }
      },
      error: (err) => {
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
      case 'confirmado': return 'warn';
      case 'en_sitio': return 'info';
      case 'parcial': return 'secondary';
      case 'recibida': return 'success';
      default: return 'info';
    }
  }
}
