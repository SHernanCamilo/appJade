import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { CheckboxModule } from 'primeng/checkbox';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';

import { CierreCuadroService, ParametroCierre, EstadoUnidad } from '../services/cierre-cuadro.service';

@Component({
  selector: 'app-cierre-cuadro',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    ButtonModule, DialogModule, DropdownModule, InputTextModule,
    CheckboxModule, ToastModule, TooltipModule, TagModule
  ],
  providers: [MessageService],
  templateUrl: './cierre-cuadro.component.html',
  styleUrls: ['./cierre-cuadro.component.css']
})
export class CierreCuadroComponent implements OnInit {

  // Filtros
  selectedAnio = new Date().getFullYear();
  selectedMes = new Date().getMonth() + 1;
  mesOptions = [
    { label: 'Enero', value: 1 }, { label: 'Febrero', value: 2 }, { label: 'Marzo', value: 3 },
    { label: 'Abril', value: 4 }, { label: 'Mayo', value: 5 }, { label: 'Junio', value: 6 },
    { label: 'Julio', value: 7 }, { label: 'Agosto', value: 8 }, { label: 'Septiembre', value: 9 },
    { label: 'Octubre', value: 10 }, { label: 'Noviembre', value: 11 }, { label: 'Diciembre', value: 12 }
  ];

  // Parámetros
  parametro: ParametroCierre = {
    tipo_bloqueo: 'automatico', tipo_nomina: 'mensual',
    dia_cierre: 0, hora_cierre: '', aplica_mes_actual: true, activo: true
  };
  parametroCargado = false;
  tipoBloqueoOptions = [{ label: 'Automático por fechas', value: 'automatico' }, { label: 'Manual', value: 'manual' }];
  tipoNominaOptions = [{ label: 'Mensual', value: 'mensual' }, { label: 'Quincenal', value: 'quincenal' }];

  // Estado unidades
  unidades: EstadoUnidad[] = [];
  unidadesFiltradas: EstadoUnidad[] = [];
  seleccionadas: Set<number> = new Set();
  busqueda = '';
  isLoading = false;

  // Desbloqueo
  showDesbloqueoDialog = false;
  unidadDesbloquear: EstadoUnidad | null = null;
  motivoDesbloqueo = '';

  constructor(private service: CierreCuadroService, private message: MessageService) {}

  ngOnInit(): void {
    this.cargarParametros();
    // No cargar estado de unidades al inicio — solo cuando sea necesario (tipo Manual)
  }

  cargarParametros(): void {
    this.service.getParametros().subscribe({
      next: (params) => {
        if (params.length) this.parametro = params[0];
        this.parametroCargado = true;
        // Solo cargar unidades si es tipo manual
        if (this.parametro.tipo_bloqueo === 'manual') {
          this.cargarEstado();
        }
      },
      error: () => { this.parametroCargado = true; }
    });
  }

  guardarParametro(): void {
    this.service.guardarParametro(this.parametro).subscribe({
      next: () => {
        this.toast('success', 'Parámetro guardado');
        if (this.parametro.tipo_bloqueo === 'manual' && !this.unidades.length) {
          this.cargarEstado();
        }
      },
      error: () => this.toast('error', 'Error al guardar parámetro')
    });
  }

  onTipoBloqueoChange(): void {
    if (this.parametro.tipo_bloqueo === 'manual' && !this.unidades.length) {
      this.cargarEstado();
    }
  }

  cargarEstado(): void {
    this.isLoading = true;
    this.service.getEstado(this.selectedAnio, this.selectedMes).subscribe({
      next: (data) => { this.unidades = data; this.filtrar(); this.isLoading = false; },
      error: () => { this.isLoading = false; this.toast('error', 'Error al cargar estado'); }
    });
  }

  filtrar(): void {
    if (!this.busqueda) { this.unidadesFiltradas = this.unidades; return; }
    const term = this.busqueda.toLowerCase();
    this.unidadesFiltradas = this.unidades.filter(u =>
      u.nombre.toLowerCase().includes(term) || u.codigo.toLowerCase().includes(term)
    );
  }

  toggleSeleccion(id: number): void {
    this.seleccionadas.has(id) ? this.seleccionadas.delete(id) : this.seleccionadas.add(id);
  }

  seleccionarTodas(): void {
    const abiertas = this.unidadesFiltradas.filter(u => !u.bloqueado);
    if (this.seleccionadas.size === abiertas.length) {
      this.seleccionadas.clear();
    } else {
      abiertas.forEach(u => this.seleccionadas.add(u.id));
    }
  }

  bloquearSeleccionadas(): void {
    if (!this.seleccionadas.size) { this.toast('warn', 'Selecciona al menos una unidad'); return; }
    if (!confirm(`¿Bloquear ${this.seleccionadas.size} unidades para ${this.mesOptions[this.selectedMes-1].label} ${this.selectedAnio}?`)) return;

    this.service.bloquear(Array.from(this.seleccionadas), this.selectedAnio, this.selectedMes).subscribe({
      next: (res) => {
        this.toast('success', res.message);
        this.seleccionadas.clear();
        this.cargarEstado();
      },
      error: () => this.toast('error', 'Error al bloquear')
    });
  }

  abrirDesbloqueo(unidad: EstadoUnidad): void {
    this.unidadDesbloquear = unidad;
    this.motivoDesbloqueo = '';
    this.showDesbloqueoDialog = true;
  }

  confirmarDesbloqueo(): void {
    if (!this.unidadDesbloquear || !this.motivoDesbloqueo) return;
    this.service.desbloquear(this.unidadDesbloquear.id, this.selectedAnio, this.selectedMes, this.motivoDesbloqueo).subscribe({
      next: () => {
        this.toast('success', 'Unidad desbloqueada');
        this.showDesbloqueoDialog = false;
        this.cargarEstado();
      },
      error: () => this.toast('error', 'Error al desbloquear')
    });
  }

  onPeriodoChange(): void { this.seleccionadas.clear(); this.cargarEstado(); }

  ejecutarCierreManual(): void {
    if (!confirm('¿Ejecutar el cierre automático ahora? Esto bloqueará todos los cuadros según la configuración.')) return;
    this.service.ejecutarAutomatico().subscribe({
      next: (res) => { this.toast('success', res.message || 'Cierre ejecutado'); this.cargarEstado(); },
      error: () => this.toast('error', 'Error al ejecutar cierre')
    });
  }

  get totalBloqueadas(): number { return this.unidades.filter(u => u.bloqueado).length; }
  get totalAbiertas(): number { return this.unidades.filter(u => !u.bloqueado).length; }

  private toast(severity: string, detail: string): void {
    this.message.add({ severity, summary: severity === 'success' ? 'OK' : severity === 'warn' ? 'Aviso' : 'Error', detail });
  }
}
