import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import * as ExcelJS from 'exceljs';
import {
  MatrizObsActivosService,
  ResultadoComparador,
  ResumenComparador,
  CoincidenciaComparador,
  CampoDiferencia,
  FilaExcelComparador,
  FilaBdComparador
} from '../services/matriz-obs-activos.service';

import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { TabViewModule } from 'primeng/tabview';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';

type TabComparador = 'diferencias' | 'iguales' | 'solo_excel' | 'solo_bd' | 'sin_clave';

@Component({
  selector: 'app-comparador-ma-obsolescencia',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ButtonModule,
    ToastModule,
    TableModule,
    TagModule,
    InputTextModule,
    SkeletonModule,
    TooltipModule,
    TabViewModule,
    ConfirmDialogModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './comparadorMaObsolescencia.component.html',
  styleUrl: './comparadorMaObsolescencia.component.css'
})
export class ComparadorMaObsolescenciaComponent {

  archivo: File | null = null;
  isDragOver = false;
  isComparando = false;
  isExportando = false;
  isDescargandoPlantilla = false;
  isAplicandoCompra = false;

  resultado: ResultadoComparador | null = null;
  activeTabIndex = 0;
  expandedRows: Record<string, boolean> = {};
  expandedRowsOk: Record<string, boolean> = {};
  rowsPerPage = 25;
  private itemsCompraCache: Array<{ id_activo: number; fecha_compra?: string; modalidad?: string; max_ram?: string }> = [];

  readonly columnasMatriz: Array<{ key: string; header: string; width: string }> = [
    { key: 'concepto', header: 'Concepto', width: '120px' },
    { key: 'nombre_equipo', header: 'Nombre Equipo', width: '160px' },
    { key: 'sucursal_sede', header: 'Sucursal/Sede', width: '160px' },
    { key: 'agente', header: 'TAG Agente', width: '110px' },
    { key: 'placa', header: 'Placa', width: '120px' },
    { key: 'marca', header: 'Marca', width: '120px' },
    { key: 'tipo', header: 'Tipo Equipo', width: '130px' },
    { key: 'referencia', header: 'Referencia', width: '150px' },
    { key: 'serial', header: 'Serial', width: '130px' },
    { key: 'ubicacion', header: 'Ubicación', width: '130px' },
    { key: 'tipo_unidad', header: 'Tipo Unidad', width: '120px' },
    { key: 'fecha_compra', header: 'Fecha Compra', width: '120px' },
    { key: 'modalidad', header: 'Modalidad Compra', width: '140px' },
    { key: 'procesador', header: 'Procesador', width: '180px' },
    { key: 'generacion_ram', header: 'Generación / SODIMM', width: '140px' },
    { key: 'edad', header: 'Edad', width: '80px' },
    { key: 'valoracion_edad', header: 'Valoración Edad', width: '130px' },
    { key: 'ram', header: 'RAM', width: '80px' },
    { key: 'max_ram', header: 'MemRam', width: '90px' },
    { key: 'valoracion_ram', header: 'Valoración Memoria', width: '140px' },
    { key: 'valoracion_procesador', header: 'Valoración Procesador', width: '150px' },
    { key: 'tipo_disco', header: 'Tipo Disco', width: '110px' },
    { key: 'disco', header: 'Disco', width: '90px' },
    { key: 'valoracion_disco', header: 'Valoración Disco', width: '130px' },
    { key: 'puntaje', header: 'Puntaje', width: '90px' }
  ];

  private readonly camposSinComparar = new Set([
    'ubicacion',
    'tipo_unidad',
    'procesador',
    'max_ram',
    'tipo_disco',
    'puntaje'
  ]);

  constructor(
    private activosService: MatrizObsActivosService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) {}

  get resumen(): ResumenComparador | null {
    return this.resultado?.resumen ?? null;
  }

  get itemsCompraExcel(): Array<{ id_activo: number; fecha_compra?: string; modalidad?: string; max_ram?: string }> {
    return this.itemsCompraCache;
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
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.setArchivo(file);
    }
  }

  onFileSelect(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.setArchivo(file);
    }
  }

  quitarArchivo(event?: Event): void {
    event?.stopPropagation();
    this.archivo = null;
    this.resultado = null;
    this.itemsCompraCache = [];
    this.expandedRows = {};
    this.expandedRowsOk = {};
    const input = document.getElementById('comparadorFileInput') as HTMLInputElement | null;
    if (input) {
      input.value = '';
    }
  }

  comparar(): void {
    if (!this.archivo || this.isComparando) {
      return;
    }

    this.isComparando = true;
    this.resultado = null;
    this.itemsCompraCache = [];
    this.expandedRows = {};
    this.expandedRowsOk = {};

    this.activosService.compararExcel(this.archivo).subscribe({
      next: (res) => {
        this.isComparando = false;
        this.resultado = this.indexarDiferencias(res.data);
        this.itemsCompraCache = this.construirItemsCompra(this.resultado);
        this.activeTabIndex = (res.data.resumen.diferencias > 0) ? 0 : 1;
        this.messageService.add({
          severity: 'success',
          summary: 'Comparación lista',
          detail: `${res.data.resumen.filas_validas} filas del Excel vs ${res.data.resumen.activos_bd} activos en BD`,
          life: 4000
        });
      },
      error: (err) => {
        this.isComparando = false;
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo comparar',
          detail: err?.message || 'Error al procesar el archivo',
          life: 6000
        });
      }
    });
  }

  confirmarAplicarCompra(): void {
    const items = this.itemsCompraExcel;
    if (!items.length || this.isAplicandoCompra) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Sin datos',
        detail: 'Ningún activo cruzado tiene FECHA DE COMPRA, MODALIDAD DE COMPRA o MaxRam en el Excel',
        life: 4000
      });
      return;
    }

    this.confirmationService.confirm({
      header: 'Copiar fecha, modalidad y MaxRam',
      message: `Se copiará FECHA DE COMPRA, MODALIDAD DE COMPRA y MaxRam (MemRam) del Excel a ${items.length} activos cruzados. Los valores vacíos del Excel no se tocan.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Copiar a la matriz',
      rejectLabel: 'Cancelar',
      accept: () => this.aplicarCompra()
    });
  }

  private aplicarCompra(): void {
    const items = this.itemsCompraExcel;
    if (!items.length) {
      return;
    }

    this.isAplicandoCompra = true;
    this.activosService.aplicarFechaYModalidad(items).subscribe({
      next: (res) => {
        this.isAplicandoCompra = false;
        this.messageService.add({
          severity: 'success',
          summary: 'Valores copiados',
          detail: `${res.data.actualizados} actualizados` +
            (res.data.omitidos ? `, ${res.data.omitidos} omitidos` : '') +
            (res.data.errores ? `, ${res.data.errores} con error` : ''),
          life: 5000
        });
        if (this.archivo) {
          this.comparar();
        }
      },
      error: (err) => {
        this.isAplicandoCompra = false;
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo copiar',
          detail: err?.message || 'Error al actualizar los activos',
          life: 6000
        });
      }
    });
  }

  descargarPlantilla(): void {
    if (this.isDescargandoPlantilla) {
      return;
    }
    this.isDescargandoPlantilla = true;

    this.activosService.descargarPlantillaComparador().subscribe({
      next: (blob) => {
        this.isDescargandoPlantilla = false;
        this.descargarBlob(blob, 'plantilla_comparador_matriz_obsolescencia.xlsx');
      },
      error: (err) => {
        this.isDescargandoPlantilla = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Plantilla',
          detail: err?.message || 'No se pudo descargar la plantilla',
          life: 4000
        });
      }
    });
  }

  async exportarResultado(): Promise<void> {
    if (!this.resultado || this.isExportando) {
      return;
    }

    this.isExportando = true;
    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = 'JadeOne';
      const r = this.resultado;

      this.agregarHojaMatriz(wb, 'Diferencias', r.diferencias, true);
      this.agregarHojaMatriz(wb, 'Iguales', r.iguales, false);

      this.agregarHoja(wb, 'Solo en Excel', r.solo_excel, [
        { header: 'Fila Excel', key: 'fila_excel', width: 12 },
        { header: 'Recurso/id', key: 'recurso_id', width: 16 },
        { header: 'PLACA', key: 'placa', width: 16 },
        { header: 'SERIAL', key: 'serial', width: 18 },
        { header: 'Sucursal / Sede', key: 'sucursal_sede', width: 24 },
        { header: 'MARCA', key: 'marca', width: 16 },
        { header: 'TIPO DE EQUIPO', key: 'tipo', width: 18 },
        { header: 'REFERENCIA', key: 'referencia', width: 22 },
        { header: 'UBICACIÓN', key: 'ubicacion', width: 22 },
        { header: 'Puntaje', key: 'puntaje', width: 12 },
        { header: 'Concepto', key: 'concepto', width: 16 }
      ]);

      this.agregarHoja(wb, 'Solo en BD', r.solo_bd, [
        { header: 'Recurso/id', key: 'recurso_id', width: 16 },
        { header: 'ID GLPI', key: 'id_activo_glpi', width: 12 },
        { header: 'Equipo', key: 'nombre_equipo', width: 28 },
        { header: 'PLACA', key: 'placa', width: 16 },
        { header: 'SERIAL', key: 'serial', width: 18 },
        { header: 'Sucursal / Sede', key: 'sucursal_sede', width: 24 },
        { header: 'MARCA', key: 'marca', width: 16 },
        { header: 'TIPO DE EQUIPO', key: 'tipo', width: 18 },
        { header: 'UBICACIÓN', key: 'ubicacion', width: 22 },
        { header: 'Puntaje', key: 'puntaje', width: 12 },
        { header: 'Concepto', key: 'concepto', width: 16 }
      ]);

      if (r.sin_clave.length) {
        this.agregarHoja(wb, 'Sin clave', r.sin_clave, [
          { header: 'Fila Excel', key: 'fila_excel', width: 12 },
          { header: 'Recurso/id', key: 'recurso_id', width: 16 },
          { header: 'Sucursal / Sede', key: 'sucursal_sede', width: 24 },
          { header: 'MARCA', key: 'marca', width: 16 },
          { header: 'TIPO DE EQUIPO', key: 'tipo', width: 18 },
          { header: 'UBICACIÓN', key: 'ubicacion', width: 22 }
        ]);
      }

      const buffer = await wb.xlsx.writeBuffer();
      this.descargarBlob(
        new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `comparacion_matriz_obsolescencia_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Exportar',
        detail: 'No se pudo generar el Excel de resultados',
        life: 4000
      });
    } finally {
      this.isExportando = false;
    }
  }

  irATab(tab: TabComparador): void {
    const map: Record<TabComparador, number> = {
      diferencias: 0,
      iguales: 1,
      solo_excel: 2,
      solo_bd: 3,
      sin_clave: 4
    };
    this.activeTabIndex = map[tab];
  }

  etiquetaCoincidencia(por: string): string {
    if (por === 'placa+serial') return 'Placa + serial';
    if (por === 'placa') return 'Placa';
    if (por === 'serial') return 'Serial';
    if (por === 'recurso') return 'Recurso/id';
    return por;
  }

  severityCoincidencia(por: string): 'success' | 'info' | 'warn' {
    if (por === 'placa+serial') return 'success';
    if (por === 'placa') return 'info';
    if (por === 'recurso') return 'info';
    return 'warn';
  }

  encabezadosMapeados(): Array<{ excel: string; campo: string }> {
    if (!this.resultado?.campos_mapeados) {
      return [];
    }
    return Object.entries(this.resultado.campos_mapeados).map(([excel, campo]) => ({ excel, campo }));
  }

  totalIguales(row: CoincidenciaComparador): number {
    if (row.total_iguales != null) {
      return row.total_iguales;
    }
    return row.campos?.filter(c => c.igual).length ?? 0;
  }

  campoDe(row: CoincidenciaComparador, key: string): CampoDiferencia | undefined {
    return row.camposMap?.[key] ?? row.campos?.find(c => c.campo === key);
  }

  esDistinto(row: CoincidenciaComparador, key: string): boolean {
    if (this.camposSinComparar.has(key)) {
      return false;
    }
    return !!this.campoDe(row, key);
  }

  valorCelda(row: CoincidenciaComparador, key: string): string {
    const valores: Record<string, string | number | null | undefined> = {
      concepto: row.concepto ?? row.concepto_bd,
      nombre_equipo: row.nombre_equipo,
      sucursal_sede: row.sucursal_sede,
      agente: row.agente,
      placa: row.placa,
      marca: row.marca,
      tipo: row.tipo,
      referencia: row.referencia,
      serial: row.serial,
      ubicacion: row.ubicacion,
      tipo_unidad: row.tipo_unidad,
      fecha_compra: row.fecha_compra ?? row.fecha_compra_bd,
      modalidad: row.modalidad ?? row.modalidad_bd,
      procesador: row.procesador,
      generacion_ram: row.generacion_ram,
      edad: row.edad,
      valoracion_edad: row.valoracion_edad,
      ram: row.ram,
      max_ram: row.max_ram,
      valoracion_ram: row.valoracion_ram,
      valoracion_procesador: row.valoracion_procesador,
      tipo_disco: row.tipo_disco,
      disco: row.disco,
      valoracion_disco: row.valoracion_disco,
      puntaje: row.puntaje ?? row.puntaje_bd
    };

    const directo = valores[key];
    if (directo !== undefined && directo !== null && String(directo).trim() !== '') {
      return String(directo);
    }

    const campo = this.campoDe(row, key);
    return campo?.bd || campo?.excel || '—';
  }

  tooltipDiff(row: CoincidenciaComparador, key: string): string {
    const campo = this.campoDe(row, key);
    if (!campo || campo.igual) {
      return '';
    }
    return `Excel: ${campo.excel || '—'}   ·   Matriz: ${campo.bd || '—'}`;
  }

  private setArchivo(file: File): void {
    const nombre = file.name.toLowerCase();
    if (!nombre.endsWith('.xlsx') && !nombre.endsWith('.xls')) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Archivo no válido',
        detail: 'Cargue un Excel (.xlsx o .xls)',
        life: 4000
      });
      return;
    }
    this.archivo = file;
    this.resultado = null;
    this.itemsCompraCache = [];
  }

  private indexarDiferencias(data: ResultadoComparador): ResultadoComparador {
    const indexar = (rows: CoincidenciaComparador[]): CoincidenciaComparador[] =>
      rows.map(row => {
        const camposMap: Record<string, CampoDiferencia> = {};
        for (const campo of row.campos ?? []) {
          camposMap[campo.campo] = campo;
        }
        return { ...row, camposMap };
      });

    return {
      ...data,
      diferencias: indexar(data.diferencias ?? []),
      iguales: indexar(data.iguales ?? []),
      advertencias: data.advertencias ?? [],
      solo_excel: data.solo_excel ?? [],
      solo_bd: data.solo_bd ?? [],
      sin_clave: data.sin_clave ?? []
    };
  }

  private construirItemsCompra(resultado: ResultadoComparador): Array<{ id_activo: number; fecha_compra?: string; modalidad?: string; max_ram?: string }> {
    const items: Array<{ id_activo: number; fecha_compra?: string; modalidad?: string; max_ram?: string }> = [];
    for (const row of [...resultado.iguales, ...resultado.diferencias]) {
      const fecha = (row.fecha_compra_excel || '').trim();
      const modalidad = (row.modalidad_excel || '').trim();
      const maxRam = (row.max_ram_excel || '').trim();
      if (!fecha && !modalidad && !maxRam) {
        continue;
      }
      items.push({
        id_activo: row.id_activo,
        fecha_compra: fecha || undefined,
        modalidad: modalidad || undefined,
        max_ram: maxRam || undefined
      });
    }
    return items;
  }

  private agregarHojaMatriz(
    wb: ExcelJS.Workbook,
    nombre: string,
    rows: CoincidenciaComparador[],
    pintarDiferencias: boolean
  ): void {
    const columns = [
      { header: 'Cruce', key: 'cruce', width: 16 },
      ...this.columnasMatriz.map(col => ({
        header: col.header,
        key: col.key,
        width: Math.max(12, Math.round(parseInt(col.width, 10) / 7) || 14)
      }))
    ];

    const ws = wb.addWorksheet(nombre);
    ws.columns = columns;
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: columns.length }
    };

    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A5F' }
    };
    header.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    header.height = 22;

    for (const row of rows) {
      const excelRow = ws.addRow([
        this.etiquetaCoincidencia(row.coincidencia_por),
        ...this.columnasMatriz.map(col => this.valorCelda(row, col.key))
      ]);
      excelRow.alignment = { vertical: 'middle' };

      if (!pintarDiferencias) {
        continue;
      }

      this.columnasMatriz.forEach((col, index) => {
        if (!this.esDistinto(row, col.key)) {
          return;
        }
        const cell = excelRow.getCell(index + 2);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFDE68A' }
        };
        cell.font = { bold: true };
        const nota = this.tooltipDiff(row, col.key);
        if (nota) {
          cell.note = nota;
        }
      });
    }
  }

  private agregarHoja(
    wb: ExcelJS.Workbook,
    nombre: string,
    data: Array<Record<string, unknown>> | CoincidenciaComparador[] | FilaExcelComparador[] | FilaBdComparador[],
    columns: Array<{ header: string; key: string; width: number }>
  ): void {
    const ws = wb.addWorksheet(nombre);
    ws.columns = columns;
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A5F' }
    };
    header.alignment = { vertical: 'middle', horizontal: 'center' };
    header.height = 20;

    for (const row of data as Array<Record<string, unknown>>) {
      const values = columns.map(col => row[col.key] ?? '');
      ws.addRow(values);
    }
  }

  private descargarBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}
