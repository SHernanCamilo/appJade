import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ContextoService, Empresa, Sucursal, Sede } from '../../../core/services/contexto.service';

@Component({
  selector: 'app-selector-contexto',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './selector-contexto.component.html',
  styleUrls: ['./selector-contexto.component.css']
})
export class SelectorContextoComponent implements OnInit {
  empresas: Empresa[] = [];
  sucursales: Sucursal[] = [];
  sedes: Sede[] = [];

  empresaSeleccionada: number | null = null;
  sucursalSeleccionada: number | null = null;
  sedeSeleccionada: number | null = null;

  cargando = false;
  mostrarSelector = false;

  constructor(private contextoService: ContextoService) {}

  ngOnInit() {
    this.cargarEmpresas();
    this.cargarContextoActual();
  }

  cargarEmpresas() {
    this.contextoService.obtenerEmpresasDisponibles().subscribe({
      next: (response: any) => {
        if (response.success) {
          this.empresas = response.data;
        }
      },
      error: (error) => {
        console.error('Error cargando empresas:', error);
      }
    });
  }

  cargarContextoActual() {
    const contexto = this.contextoService.getContextoActual();
    if (contexto) {
      this.empresaSeleccionada = contexto.empresa_id;
      this.sucursalSeleccionada = contexto.sucursal_id;
      this.sedeSeleccionada = contexto.sede_id;

      if (this.empresaSeleccionada) {
        this.onEmpresaChange();
      }
    }
  }

  onEmpresaChange() {
    this.sucursales = [];
    this.sedes = [];
    this.sucursalSeleccionada = null;
    this.sedeSeleccionada = null;

    if (this.empresaSeleccionada) {
      const empresa = this.empresas.find(e => e.id === this.empresaSeleccionada);
      if (empresa && empresa.sucursales) {
        this.sucursales = empresa.sucursales;
      }
    }
  }

  onSucursalChange() {
    this.sedes = [];
    this.sedeSeleccionada = null;

    if (this.sucursalSeleccionada) {
      const sucursal = this.sucursales.find(s => s.id === this.sucursalSeleccionada);
      if (sucursal && sucursal.sedes) {
        this.sedes = sucursal.sedes;
      }
    }
  }

  aplicarContexto() {
    if (!this.empresaSeleccionada) {
      alert('Debes seleccionar una empresa');
      return;
    }

    this.cargando = true;

    this.contextoService.cambiarContexto(
      this.empresaSeleccionada,
      this.sucursalSeleccionada || undefined,
      this.sedeSeleccionada || undefined
    ).subscribe({
      next: (response) => {
        if (response.success) {
          console.log('Contexto actualizado exitosamente');
          this.mostrarSelector = false;
          // Recargar la página para aplicar el nuevo contexto
          window.location.reload();
        }
      },
      error: (error) => {
        console.error('Error actualizando contexto:', error);
        alert('Error al actualizar el contexto');
      },
      complete: () => {
        this.cargando = false;
      }
    });
  }

  toggleSelector() {
    this.mostrarSelector = !this.mostrarSelector;
  }

  getContextoTexto(): string {
    const contexto = this.contextoService.getContextoActual();
    if (!contexto || !contexto.empresa) {
      return 'Sin contexto';
    }

    let texto = contexto.empresa.nombre;
    if (contexto.sucursal) {
      texto += ` - ${contexto.sucursal.nombre}`;
    }
    if (contexto.sede) {
      texto += ` - ${contexto.sede.nombre}`;
    }

    return texto;
  }
}
