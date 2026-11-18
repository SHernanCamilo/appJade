import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DropdownModule } from 'primeng/dropdown';
import { ChartModule } from 'primeng/chart';
import { HttpErrorResponse } from '@angular/common/http';
import * as XLSX from 'xlsx';
import {
  FilaReportePropio,
  RopaEmpresa,
  RopaInventarioService,
  RopaUnidadOpcion
} from '../services/ropa-inventario.service';

interface Opcion {
  id: number;
  nombre: string;
}

interface ResumenReporte {
  fijo: number;
  encontrado: number;
  faltante: number;
  sobrante: number;
  cobertura: number;
  unidades: number;
  prendas: number;
  mayorFaltante: { nombre: string; valor: number } | null;
  mayorSobrante: { nombre: string; valor: number } | null;
}

@Component({
  selector: 'app-reporte-propio',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DropdownModule, ChartModule],
  templateUrl: './reporte-propio.component.html',
  styleUrls: ['./reporte-propio.component.css', '../shared/ropa-page-header.css']
})
export class ReportePropioComponent implements OnInit {
  private readonly service = inject(RopaInventarioService);

  unidades: RopaUnidadOpcion[] = [];
  empresas: RopaEmpresa[] = [];
  debeElegirEmpresa = true;
  empresaId: number | null = null;
  sucursalId: number | null = null;
  sedeId: number | null = null;
  unidadId: number | null = null;
  periodo = '';
  busqueda = '';
  filas: FilaReportePropio[] = [];
  abierta: number | null = null;
  cargando = false;
  consultado = false;
  consultaGeneral = false;
  error = '';
  graficaFijo: { labels: string[]; datasets: unknown[] } | null = null;
  graficaFaltante: { labels: string[]; datasets: unknown[] } | null = null;
  graficaDona: { labels: string[]; datasets: unknown[] } | null = null;
  resumen: ResumenReporte | null = null;
  readonly opcionesFijo = {
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, color: '#6b7280', font: { size: 11 } } } },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#9ca3af', maxRotation: 40, minRotation: 0, font: { size: 10 } } },
      y: { beginAtZero: true, grid: { color: '#f3f4f6' }, ticks: { color: '#9ca3af' } }
    }
  };
  readonly opcionesFaltante = {
    indexAxis: 'y',
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (item: { parsed: { x: number } }) => {
            const valor = Number(item.parsed.x);
            return valor < 0 ? `Sobrante ${Math.abs(valor)}` : `Faltante ${valor}`;
          }
        }
      }
    },
    scales: {
      x: { beginAtZero: true, grid: { color: '#f3f4f6' }, ticks: { color: '#9ca3af' } },
      y: { grid: { display: false }, ticks: { color: '#6b7280', font: { size: 10 } } }
    }
  };
  readonly opcionesDona = {
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, color: '#6b7280', font: { size: 11 } } } }
  };

  ngOnInit(): void {
    const hoy = new Date();
    this.periodo = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    this.service.empresas().subscribe({
      next: resp => {
        this.empresas = resp.data ?? [];
        this.debeElegirEmpresa = resp.debe_elegir;
        if (!this.debeElegirEmpresa && this.empresas.length === 1) this.empresaId = this.empresas[0].id;
      },
      error: () => { this.error = 'No se pudieron cargar las empresas.'; }
    });
    this.service.unidades().subscribe({
      next: resp => { this.unidades = resp.data ?? []; },
      error: () => { this.error = 'No se pudieron cargar las sedes.'; }
    });
  }

  get sucursales(): Opcion[] {
    const mapa = new Map<number, string>();
    for (const unidad of this.unidades) {
      if (this.empresaId !== null && Number(unidad.empresa_id) !== Number(this.empresaId)) continue;
      if (unidad.sucursal_id && unidad.sucursal_nombre) {
        mapa.set(unidad.sucursal_id, unidad.sucursal_nombre);
      }
    }
    return [...mapa.entries()].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  get sedes(): Opcion[] {
    const mapa = new Map<number, string>();
    for (const unidad of this.unidades) {
      if (this.sucursalId && unidad.sucursal_id !== this.sucursalId) continue;
      if (unidad.sede_id && unidad.sede_nombre) mapa.set(unidad.sede_id, unidad.sede_nombre);
    }
    return [...mapa.entries()].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  get unidadesSede(): Array<{ id: number; etiqueta: string }> {
    return this.unidades
      .filter(unidad => {
        if (this.sucursalId && unidad.sucursal_id !== this.sucursalId) return false;
        if (this.sedes.length === 0) return true;
        return unidad.sede_id === this.sedeId;
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .map(unidad => ({ id: unidad.id, etiqueta: `${unidad.codigo} — ${unidad.nombre}` }));
  }

  get filasVisibles(): FilaReportePropio[] {
    const texto = this.busqueda.trim().toLowerCase();
    if (!texto) return this.filas;
    return this.filas.filter(fila => {
      const campos = [fila.periodo, fila.sucursal, fila.sede, fila.unidad, fila.prenda, fila.faltante];
      return campos.some(campo => (campo ?? '').toLowerCase().includes(texto));
    });
  }

  alElegirEmpresa(id: number | null): void {
    this.empresaId = id;
    this.sucursalId = null;
    this.sedeId = null;
    this.unidadId = null;
    this.limpiar();
  }

  alElegirSucursal(id: number | null): void {
    this.sucursalId = id;
    this.sedeId = null;
    this.unidadId = null;
    this.consultar();
  }

  alElegirSede(id: number | null): void {
    this.sedeId = id;
    this.unidadId = null;
    this.consultar();
  }

  alElegirUnidad(id: number | null): void {
    this.unidadId = id;
    this.consultar();
  }

  consultar(): void {
    if (this.sucursalId === null || !this.periodo || (this.sedes.length > 0 && this.sedeId === null)) {
      this.limpiar();
      return;
    }
    this.cargando = true;
    this.error = '';
    this.abierta = null;
    this.service.reportePropio(this.sucursalId, this.sedeId, this.periodo, this.unidadId).subscribe({
      next: resp => {
        this.cargando = false;
        this.consultado = true;
        this.consultaGeneral = !!resp.consulta_general;
        this.filas = resp.data ?? [];
        this.armarGraficas();
      },
      error: (err: HttpErrorResponse) => {
        this.cargando = false;
        this.consultado = true;
        this.filas = [];
        this.armarGraficas();
        this.error = err.error?.message || 'No se pudo consultar el reporte.';
      }
    });
  }

  alternar(indice: number): void {
    this.abierta = this.abierta === indice ? null : indice;
  }

  dosDecimales(valor: string | number | null): string {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero.toFixed(2) : '';
  }

  porcentaje(valor: number): string {
    return valor.toFixed(1);
  }

  formato(valor: number): string {
    return Number.isInteger(valor) ? String(valor) : valor.toFixed(2);
  }

  copiar(): void {
    const lineas = [this.encabezados.join('\t'), ...this.filasVisibles.map(fila => this.valores(fila).join('\t'))];
    navigator.clipboard.writeText(lineas.join('\n')).catch(() => {
      this.error = 'No se pudo copiar la tabla.';
    });
  }

  excel(): void {
    this.descargar('xlsx');
  }

  csv(): void {
    this.descargar('csv');
  }

  private descargar(formato: 'xlsx' | 'csv'): void {
    const filas = this.filasVisibles.map(fila => this.valores(fila));
    const hoja = XLSX.utils.aoa_to_sheet([this.encabezados, ...filas]);
    if (formato === 'xlsx') {
      hoja['!cols'] = [
        { wch: 22 }, { wch: 18 }, { wch: 34 }, { wch: 28 },
        { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
        { wch: 12 }, { wch: 18 }, { wch: 14 }
      ];
      const formatos = ['', '', '', '', '0', '0', '0', '0.00', '0.00', '0', ''];
      for (let fila = 1; fila <= filas.length; fila++) {
        formatos.forEach((formatoNumero, columna) => {
          if (!formatoNumero) return;
          const celda = hoja[XLSX.utils.encode_cell({ r: fila, c: columna })];
          if (celda && typeof celda.v === 'number') celda.z = formatoNumero;
        });
      }
    }
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Reporte');
    XLSX.writeFile(libro, `reporte-inventario-${this.periodo}.${formato}`);
  }

  private get encabezados(): string[] {
    return ['SUCURSAL', 'SEDE', 'UND FUNCIONAL', 'PRENDA', 'CAMAS', 'CAMA MEDICO', 'PERSONAL', 'CONSTANTE', 'FIJO', 'CANT ENCONTRADA', 'FALTANTE'];
  }

  private valores(fila: FilaReportePropio): Array<string | number | null> {
    return [
      fila.sucursal, fila.sede, fila.unidad, fila.prenda,
      fila.camas, fila.camas_medico, fila.personal,
      Number(this.dosDecimales(fila.constante)), Number(this.dosDecimales(fila.fijo)),
      fila.cantidad, fila.faltante
    ];
  }

  private armarGraficas(): void {
    const mapa = new Map<string, { nombre: string; fijo: number; cantidad: number; faltante: number }>();
    for (const fila of this.filas) {
      const nombre = fila.prenda || 'Sin prenda';
      const actual = mapa.get(nombre) ?? { nombre, fijo: 0, cantidad: 0, faltante: 0 };
      actual.fijo += this.aNumero(fila.fijo);
      actual.cantidad += Number(fila.cantidad) || 0;
      actual.faltante += this.aNumero(fila.faltante);
      mapa.set(nombre, actual);
    }
    const todas = [...mapa.values()];
    if (todas.length === 0) {
      this.graficaFijo = null;
      this.graficaFaltante = null;
      this.graficaDona = null;
      this.resumen = null;
      return;
    }
    const fijo = todas.reduce((suma, prenda) => suma + prenda.fijo, 0);
    const encontrado = todas.reduce((suma, prenda) => suma + prenda.cantidad, 0);
    const faltante = todas.reduce((suma, prenda) => suma + Math.max(prenda.faltante, 0), 0);
    const sobrante = todas.reduce((suma, prenda) => suma + Math.max(-prenda.faltante, 0), 0);
    const mayorFaltante = [...todas].sort((a, b) => b.faltante - a.faltante)[0];
    const mayorSobrante = [...todas].sort((a, b) => a.faltante - b.faltante)[0];
    this.resumen = {
      fijo,
      encontrado,
      faltante,
      sobrante,
      cobertura: fijo > 0 ? (encontrado / fijo) * 100 : 0,
      unidades: new Set(this.filas.map(fila => fila.unidad).filter(Boolean)).size,
      prendas: todas.length,
      mayorFaltante: mayorFaltante && mayorFaltante.faltante > 0
        ? { nombre: mayorFaltante.nombre, valor: mayorFaltante.faltante }
        : null,
      mayorSobrante: mayorSobrante && mayorSobrante.faltante < 0
        ? { nombre: mayorSobrante.nombre, valor: Math.abs(mayorSobrante.faltante) }
        : null
    };

    const prendas = [...todas].sort((a, b) => b.faltante - a.faltante).slice(0, 10);
    const mayorBarra = Math.max(...prendas.map(prenda => prenda.faltante));
    const etiquetas = prendas.map(prenda => this.corto(prenda.nombre));
    this.graficaFijo = {
      labels: etiquetas,
      datasets: [
        { label: 'Fijo', data: prendas.map(prenda => prenda.fijo), backgroundColor: '#dbe4ff', borderRadius: 8, maxBarThickness: 28 },
        { label: 'Encontrado', data: prendas.map(prenda => prenda.cantidad), backgroundColor: '#3b82f6', borderRadius: 8, maxBarThickness: 28 }
      ]
    };
    this.graficaFaltante = {
      labels: etiquetas,
      datasets: [{
        data: prendas.map(prenda => prenda.faltante),
        backgroundColor: prendas.map(prenda => prenda.faltante < 0 ? '#f59e0b' : prenda.faltante === mayorBarra ? '#3b82f6' : '#dbe4ff'),
        borderRadius: 8,
        maxBarThickness: 18
      }]
    };

    const conFalta = todas.filter(prenda => prenda.faltante > 0).sort((a, b) => b.faltante - a.faltante);
    const resto = conFalta.slice(1).reduce((suma, prenda) => suma + prenda.faltante, 0);
    this.graficaDona = conFalta.length === 0
      ? { labels: ['Cubierto'], datasets: [{ data: [1], backgroundColor: ['#3b82f6'], borderWidth: 0 }] }
      : {
          labels: resto > 0 ? [this.corto(conFalta[0].nombre), 'Otras prendas'] : [this.corto(conFalta[0].nombre)],
          datasets: [{
            data: resto > 0 ? [conFalta[0].faltante, resto] : [conFalta[0].faltante],
            backgroundColor: resto > 0 ? ['#3b82f6', '#e5e7eb'] : ['#3b82f6'],
            borderWidth: 0
          }]
        };
  }

  private aNumero(valor: string | number | null): number {
    const texto = String(valor ?? '').trim();
    if (texto.startsWith('+')) {
      const sobrante = Number(texto.slice(1));
      return Number.isFinite(sobrante) ? -sobrante : 0;
    }
    const numero = Number(texto);
    return Number.isFinite(numero) ? numero : 0;
  }

  private corto(nombre: string): string {
    return nombre.length > 22 ? `${nombre.slice(0, 20)}…` : nombre;
  }

  private limpiar(): void {
    this.filas = [];
    this.graficaFijo = null;
    this.graficaFaltante = null;
    this.graficaDona = null;
    this.resumen = null;
    this.consultado = false;
    this.consultaGeneral = false;
    this.abierta = null;
    this.error = '';
  }
}
