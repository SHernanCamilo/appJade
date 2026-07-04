import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SkeletonModule } from 'primeng/skeleton';
import { InventarioService } from '../../../core/services/inventario.service';
import { OrdenCompra, RecepcionItem } from '../../../core/models/inventario.model';

@Component({
  selector: 'app-recepciones-tecnicas',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonModule],
  templateUrl: './recepciones-tecnicas.component.html',
  styleUrls: ['./recepciones-tecnicas.component.css']
})
export class RecepcionesTecnicasComponent implements OnInit {
  comprasPendientes: OrdenCompra[] = [];
  comprasCompletadas: OrdenCompra[] = [];
  currentView: 'pending' | 'completed' = 'pending';
  
  isLoading: boolean = false;
  showDetailsModal: boolean = false;
  currentReception: OrdenCompra | null = null;
  currentDetails: RecepcionItem[] = [];
  isLoadingDetails: boolean = false;

  constructor(private inventarioService: InventarioService) {}

  ngOnInit(): void {
    this.loadCompras();
  }

  loadCompras(): void {
    this.isLoading = true;
    const status = this.currentView === 'pending' ? 'confirmado,en_sitio' : 'recibida';
    this.inventarioService.getRecepciones({ status }).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          if (this.currentView === 'pending') {
            this.comprasPendientes = res.data;
          } else {
            this.comprasCompletadas = res.data;
          }
        } else {
          if (this.currentView === 'pending') this.comprasPendientes = [];
          else this.comprasCompletadas = [];
        }
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Error loading recepciones:', err);
      }
    });
  }

  setView(view: 'pending' | 'completed'): void {
    this.currentView = view;
    this.loadCompras();
  }

  confirmArrival(id: number | undefined): void {
    if (!id) return;
    if (confirm('¿Confirmar llegada de la orden al sitio?')) {
      this.inventarioService.confirmarRecepcion(id).subscribe({
        next: (res) => {
          if (res.success) {
            alert('Llegada confirmada exitosamente');
            this.loadCompras();
          } else {
            alert('Error: ' + res.message);
          }
        },
        error: (err) => console.error(err)
      });
    }
  }

  openExcelReception(id: number | undefined): void {
    if (!id) return;
    // Aquí idealmente abriríamos el componente de recepción completa.
    // Por simplicidad en la migración lo manejamos con la vista heredada o un aviso.
    alert('Esta funcionalidad abrirá el formato Excel de Recepción Técnica con INVIMA.');
    window.open(`/JadeInventory/pages/inventario/reception-excel.html?purchase_id=${id}`, '_blank');
  }

  viewDetails(id: number | undefined): void {
    if (!id) return;
    this.showDetailsModal = true;
    this.isLoadingDetails = true;
    this.currentReception = this.comprasCompletadas.find(c => c.compra_id == id) || null;
    
    this.inventarioService.getRecepcion(id).subscribe({
      next: (res) => {
        this.isLoadingDetails = false;
        if (res.success) {
          this.currentDetails = res.data;
        }
      },
      error: (err) => {
        this.isLoadingDetails = false;
        console.error('Error viewing details:', err);
      }
    });
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.currentReception = null;
    this.currentDetails = [];
  }

  getProgress(recibidos: number | undefined, total: number | undefined): number {
    if (!total || total === 0) return 0;
    return Math.round(((recibidos || 0) / total) * 100);
  }
}
