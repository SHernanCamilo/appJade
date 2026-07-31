import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventarioService } from '../../../core/services/inventario.service';

@Component({
  selector: 'app-productos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './productos.component.html',
  styleUrls: ['./productos.component.css']
})
export class ProductosComponent implements OnInit {
  productos: any[] = [];
  searchTerm: string = '';
  isLoading: boolean = false;

  constructor(private inventarioService: InventarioService) {}

  ngOnInit(): void {
    this.loadProductos();
  }

  loadProductos(): void {
    this.isLoading = true;
    const filters = this.searchTerm ? { search: this.searchTerm } : {};
    
    this.inventarioService.getProductos(filters).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          this.productos = res.data;
        } else {
          this.productos = [];
        }
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Error loading productos:', err);
      }
    });
  }

  onSearchChange(): void {
    // Podría usarse un debounce aquí, pero por simplicidad de migración llamamos directo.
    this.loadProductos();
  }
}
