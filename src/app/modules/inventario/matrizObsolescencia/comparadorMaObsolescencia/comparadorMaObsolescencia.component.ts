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
import { MessageService } from 'primeng/api';

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
    TabViewModule
  ],
  providers: [MessageService],
  templateUrl: './comparadorMaObsolescencia.component.html',
  styleUrl: './comparadorMaObsolescencia.component.css'
})
export class ComparadorMaObsolescenciaComponent {

  archivo: File | null = null;
  isDragOver = false;
  isComparando = false;
  isExportando = false;
  isDescargandoPlantilla = false;

  resultado: ResultadoComparador | null = null;
  activeTabIndex = 0;
  expandedRows: Record<string, boolean> = {};
  rowsPerPage = 25;

  constructor(
    private activosService: MatrizObsActivosService,
    private messageService: MessageService
  ) {}

  get resumen(): ResumenComparador | null {
    return this.resultado?.resumen ?? null;
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
    this.expandedRows = {};
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
    this.expandedRows = {};

    this.activosService.compararExcel(this.archivo).subscribe({
      next: (res) => {
        this.isComparando = false;
        this.resultado = res.data;
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

      this.agregarHoja(wb, 'Diferencias', this.filasDiferencias(r.diferencias), [
        { header: 'Fila Excel', key: 'fila_excel', width: 12 },
        { header: 'PLACA', key: 'placa', width: 16 },
        { header: 'SERIAL', key: 'serial', width: 18 },
        { header: 'Equipo BD', key: 'nombre_equipo', width: 28 },
        { header: 'ID GLPI', key: 'id_activo_glpi', width: 12 },
        { header: 'Coincide por', key: 'coincidencia_por', width: 14 },
        { header: 'Campo', key: 'campo', width: 22 },
        { header: 'Valor Excel', key: 'excel', width: 28 },
        { header: 'Valor BD', key: 'bd', width: 28 }
      ]);

      this.agregarHoja(wb, 'Iguales', r.iguales, [
        { header: 'Fila Excel', key: 'fila_excel', width: 12 },
        { header: 'PLACA', key: 'placa', width: 16 },
        { header: 'SERIAL', key: 'serial', width: 18 },
        { header: 'Equipo BD', key: 'nombre_equipo', width: 28 },
        { header: 'ID GLPI', key: 'id_activo_glpi', width: 12 },
        { header: 'Coincide por', key: 'coincidencia_por', width: 14 }
      ]);

      this.agregarHoja(wb, 'Solo en Excel', r.solo_excel, [
        { header: 'Fila Excel', key: 'fila_excel', width: 12 },
        { header: 'PLACA', key: 'placa', width: 16 },
        { header: 'SERIAL', key: 'serial', width: 18 },
        { header: 'Sucursal / Sede', key: 'sucursal_sede', width: 24 },
        { header: 'MARCA', key: 'marca', width: 16 },
        { header: 'TIPO DE EQUIPO', key: 'tipo', width: 18 },
        { header: 'REFERENCIA', key: 'referencia', width: 22 },
        { header: 'UBICACIÓN', key: 'ubicacion', width: 22 }
      ]);

      this.agregarHoja(wb, 'Solo en BD', r.solo_bd, [
        { header: 'ID GLPI', key: 'id_activo_glpi', width: 12 },
        { header: 'Equipo', key: 'nombre_equipo', width: 28 },
        { header: 'PLACA', key: 'placa', width: 16 },
        { header: 'SERIAL', key: 'serial', width: 18 },
        { header: 'Sucursal / Sede', key: 'sucursal_sede', width: 24 },
        { header: 'MARCA', key: 'marca', width: 16 },
        { header: 'TIPO DE EQUIPO', key: 'tipo', width: 18 },
        { header: 'UBICACIÓN', key: 'ubicacion', width: 22 }
      ]);

      if (r.sin_clave.length) {
        this.agregarHoja(wb, 'Sin placa ni serial', r.sin_clave, [
          { header: 'Fila Excel', key: 'fila_excel', width: 12 },
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
    return por;
  }

  severityCoincidencia(por: string): 'success' | 'info' | 'warn' {
    if (por === 'placa+serial') return 'success';
    if (por === 'placa') return 'info';
    return 'warn';
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
  }

  private filasDiferencias(items: CoincidenciaComparador[]): Array<Record<string, string | number>> {
    const filas: Array<Record<string, string | number>> = [];
    for (const item of items) {
      if (!item.campos?.length) {
        filas.push({
          fila_excel: item.fila_excel,
          placa: item.placa,
          serial: item.serial,
          nombre_equipo: item.nombre_equipo,
          id_activo_glpi: item.id_activo_glpi ?? '',
          coincidencia_por: item.coincidencia_por,
          campo: '',
          excel: '',
          bd: ''
        });
        continue;
      }
      for (const campo of item.campos) {
        filas.push({
          fila_excel: item.fila_excel,
          placa: item.placa,
          serial: item.serial,
          nombre_equipo: item.nombre_equipo,
          id_activo_glpi: item.id_activo_glpi ?? '',
          coincidencia_por: item.coincidencia_por,
          campo: campo.etiqueta,
          excel: campo.excel,
          bd: campo.bd
        });
      }
    }
    return filas;
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
