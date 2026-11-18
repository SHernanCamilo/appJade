import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ResumenInventario, RopaInventarioService } from '../services/ropa-inventario.service';

@Component({
  selector: 'app-lista-inventario-ropa',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './lista-inventario-ropa.component.html',
  styleUrl: './lista-inventario-ropa.component.css'
})
export class ListaInventarioRopaComponent implements OnInit {
  private readonly service = inject(RopaInventarioService);

  periodo = '';
  filas: ResumenInventario[] = [];
  cargando = false;
  error = '';

  ngOnInit(): void {
    this.buscar();
  }

  buscar(): void {
    this.cargando = true;
    this.error = '';
    this.service.listar(this.periodo || undefined).subscribe({
      next: resp => {
        this.cargando = false;
        this.filas = resp.data ?? [];
      },
      error: (err: HttpErrorResponse) => {
        this.cargando = false;
        this.error = err.error?.message || 'No se pudieron cargar los inventarios.';
      }
    });
  }
}
