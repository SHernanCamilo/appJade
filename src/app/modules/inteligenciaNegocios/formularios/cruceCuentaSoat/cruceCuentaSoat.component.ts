import { Component, OnDestroy, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import { Subscription } from 'rxjs';

import { FabricDataMeta, VistasService } from '../../services/vistas.service';
import { AG_GRID_LOCALE } from '../../../../core/config/ag-grid.config';
import { GridLoaderComponent } from '../../../../complements/shared/grid-loader/grid-loader.component';
import { handleFabricError } from '../../helpers/fabric-error.helper';
import { AuthService } from '../../../auth/auth.service';
import { EmpresaService } from '../../../organizacion/empresa/services/empresa.service';
import { ConstanciaSoatExportService } from './services/constancia-soat-export.service';

type ExportModo = 'completa' | 'poliza';

@Component({
  selector: 'app-cruce-cuenta-soat',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    AgGridAngular,
    ToastModule,
    TooltipModule,
    DialogModule,
    GridLoaderComponent
  ],
  providers: [MessageService],
  templateUrl: './cruceCuentaSoat.component.html',
  styleUrl: './cruceCuentaSoat.component.css',
  encapsulation: ViewEncapsulation.None
})
export class CruceCuentaSoatComponent implements OnDestroy {
  /** Vista Fabric a consultar. */
  private readonly schema = 'fr';
  private readonly viewName = 'VW_Billing_Facturacion_Soat';
  private readonly filterColumn = 'Identificacion';

  numeroCc = '';
  isLoading = false;
  isExporting = false;
  consultado = false;
  ultimaConsulta = '';

  rowData: Record<string, unknown>[] = [];
  columnDefs: ColDef[] = [];
  meta: FabricDataMeta = { total: 0, limit: 100, offset: 0, has_next: false };

  pageSize = 100;
  paginaActual = 1;

  /** Diálogo de export PDF. */
  showExportDialog = false;
  exportModo: ExportModo = 'completa';
  polizaSeleccionada = '';
  polizasDisponibles: string[] = [];
  isLoadingExportData = false;
  private exportRowsCache: Record<string, unknown>[] = [];

  localeText = AG_GRID_LOCALE;

  defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 120,
    floatingFilter: true,
    cellClass: 'cell-copyable'
  };

  private gridApi?: GridApi;
  private dataSub?: Subscription;
  private exportSub?: Subscription;

  constructor(
    private readonly vistasService: VistasService,
    private readonly messageService: MessageService,
    private readonly authService: AuthService,
    private readonly empresaService: EmpresaService,
    private readonly constanciaExport: ConstanciaSoatExportService
  ) {}

  ngOnDestroy(): void {
    this.dataSub?.unsubscribe();
    this.exportSub?.unsubscribe();
  }

  get totalRegistros(): number {
    return this.meta.total < 0 ? this.rowData.length : this.meta.total;
  }

  get totalPaginas(): number {
    if (this.meta.total < 0) {
      return this.meta.has_next ? this.paginaActual + 1 : this.paginaActual;
    }
    return Math.ceil(this.meta.total / this.pageSize) || 1;
  }

  get canGoNext(): boolean {
    return this.meta.total < 0 ? this.meta.has_next : this.paginaActual < this.totalPaginas;
  }

  get canGoPrev(): boolean {
    return this.paginaActual > 1;
  }

  get ccValida(): boolean {
    return /^\d{5,20}$/.test(this.numeroCc.trim());
  }

  get puedeExportar(): boolean {
    return !!this.ultimaConsulta && this.totalRegistros > 0 && !this.isLoading && !this.isExporting;
  }

  get puedeConfirmarExport(): boolean {
    if (this.isExporting || this.isLoadingExportData) {
      return false;
    }
    if (!this.exportRowsCache.length) {
      return false;
    }
    if (this.exportModo === 'poliza') {
      return !!this.polizaSeleccionada.trim();
    }
    return true;
  }

  onCcInput(value: string): void {
    this.numeroCc = value.replace(/\D/g, '');
  }

  onCcKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.consultar();
    }
  }

  consultar(): void {
    const cc = this.numeroCc.trim();

    if (!cc) {
      this.messageService.add({
        severity: 'warn',
        summary: 'CC requerida',
        detail: 'Digite el número de cédula para consultar.',
        life: 4000
      });
      return;
    }

    if (!this.ccValida) {
      this.messageService.add({
        severity: 'warn',
        summary: 'CC inválida',
        detail: 'Ingrese solo números (entre 5 y 20 dígitos).',
        life: 4000
      });
      return;
    }

    this.paginaActual = 1;
    this.cargarDatos(cc);
  }

  limpiar(): void {
    this.dataSub?.unsubscribe();
    this.exportSub?.unsubscribe();
    this.numeroCc = '';
    this.rowData = [];
    this.columnDefs = [];
    this.meta = { total: 0, limit: this.pageSize, offset: 0, has_next: false };
    this.consultado = false;
    this.ultimaConsulta = '';
    this.paginaActual = 1;
    this.isLoading = false;
    this.isExporting = false;
    this.cerrarExportDialog();
  }

  recargar(): void {
    if (!this.ultimaConsulta) {
      return;
    }
    this.cargarDatos(this.ultimaConsulta);
  }

  /** Abre el pop de opciones: Completa o por Póliza. */
  abrirExportDialog(): void {
    if (!this.ultimaConsulta) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Sin consulta',
        detail: 'Consulte primero una cédula para exportar la constancia.',
        life: 4000
      });
      return;
    }

    this.exportModo = 'completa';
    this.polizaSeleccionada = '';
    this.polizasDisponibles = [];
    this.exportRowsCache = [];
    this.showExportDialog = true;

    // Si la grilla ya tiene todos los registros, no vuelve a consultar la API
    if (this.tieneTodosLosRegistrosEnGrilla()) {
      this.aplicarDatosExport(this.rowData);
      return;
    }

    this.cargarDatosExport();
  }

  cerrarExportDialog(): void {
    this.showExportDialog = false;
    this.exportModo = 'completa';
    this.polizaSeleccionada = '';
    this.polizasDisponibles = [];
    this.exportRowsCache = [];
    this.isLoadingExportData = false;
    this.exportSub?.unsubscribe();
  }

  onExportModoChange(): void {
    if (this.exportModo !== 'poliza') {
      this.polizaSeleccionada = '';
    } else if (!this.polizaSeleccionada && this.polizasDisponibles.length === 1) {
      this.polizaSeleccionada = this.polizasDisponibles[0];
    }
  }

  async confirmarExport(): Promise<void> {
    if (!this.puedeConfirmarExport || !this.ultimaConsulta) {
      return;
    }

    let rows = this.exportRowsCache;
    if (this.exportModo === 'poliza') {
      rows = this.constanciaExport.filtrarPorPoliza(rows, this.polizaSeleccionada);
      if (!rows.length) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Sin registros',
          detail: `No hay facturas para la póliza ${this.polizaSeleccionada}.`,
          life: 5000
        });
        return;
      }
    }

    this.isExporting = true;
    try {
      const firmante = await this.obtenerDatosFirmante();

      await this.constanciaExport.exportar({
        identificacion: this.ultimaConsulta,
        rows,
        firmanteNombre: firmante.nombre,
        firmanteCargo: firmante.cargo,
        empresaNombre: firmante.empresaNombre,
        logoUrl: firmante.logoUrl,
        logoBase64: firmante.logoBase64,
        ciudadEmision: firmante.ciudadEmision
      });

      const detalle = this.exportModo === 'poliza'
        ? `Constancia de la póliza ${this.polizaSeleccionada} (CC ${this.ultimaConsulta}).`
        : `Constancia completa de la CC ${this.ultimaConsulta}.`;

      this.messageService.add({
        severity: 'success',
        summary: 'PDF generado',
        detail: detalle,
        life: 4000
      });

      this.cerrarExportDialog();
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error al exportar',
        detail: error instanceof Error ? error.message : 'No se pudo generar el PDF.',
        life: 6000
      });
    } finally {
      this.isExporting = false;
    }
  }

  /** True si la página actual ya contiene el total de la consulta. */
  private tieneTodosLosRegistrosEnGrilla(): boolean {
    if (!this.rowData.length) {
      return false;
    }

    if (this.meta.total >= 0) {
      return this.rowData.length >= this.meta.total;
    }

    return this.paginaActual === 1 && !this.meta.has_next;
  }

  private aplicarDatosExport(rows: Record<string, unknown>[]): void {
    this.isLoadingExportData = false;
    this.exportRowsCache = rows;
    this.polizasDisponibles = this.constanciaExport.listarPolizas(rows);

    if (!rows.length) {
      this.messageService.add({
        severity: 'info',
        summary: 'Sin datos',
        detail: 'No hay facturas para generar la constancia.',
        life: 4000
      });
      this.cerrarExportDialog();
      return;
    }

    if (this.polizasDisponibles.length === 1) {
      this.polizaSeleccionada = this.polizasDisponibles[0];
    }
  }

  private cargarDatosExport(): void {
    this.exportSub?.unsubscribe();
    this.isLoadingExportData = true;

    this.exportSub = this.vistasService.getVistaDatosTodos(this.schema, this.viewName, {
      filters: { [this.filterColumn]: this.ultimaConsulta }
    }).subscribe({
      next: (response) => {
        if (response.partial) {
          return;
        }

        this.aplicarDatosExport(response.rowData ?? []);
      },
      error: (err: unknown) => {
        this.isLoadingExportData = false;
        const detail = err instanceof HttpErrorResponse
          ? handleFabricError(err)
          : 'No se pudieron obtener los datos para la constancia.';
        this.messageService.add({
          severity: 'error',
          summary: 'Error al exportar',
          detail,
          life: 7000
        });
        this.cerrarExportDialog();
      }
    });
  }

  irPagina(pagina: number): void {
    if (pagina < 1 || (this.meta.total >= 0 && pagina > this.totalPaginas)) {
      return;
    }
    this.paginaActual = pagina;
    this.cargarDatos(this.ultimaConsulta);
  }

  onPageSizeChange(): void {
    this.pageSize = Number(this.pageSize);
    this.paginaActual = 1;
    if (this.ultimaConsulta) {
      this.cargarDatos(this.ultimaConsulta);
    }
  }

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
  }

  /** Datos del firmante y logo real de la empresa (API, no solo sesión). */
  private async obtenerDatosFirmante(): Promise<{
    nombre: string;
    cargo: string;
    empresaNombre: string;
    logoUrl: string | null;
    logoBase64: string | null;
    ciudadEmision: string;
  }> {
    let user = this.authService.currentUser;

    const necesitaRefresh = !String(user?.cargo ?? '').trim() || !user?.empresas?.length;
    if (necesitaRefresh) {
      try {
        user = await new Promise<any>((resolve, reject) => {
          this.authService.me().subscribe({ next: resolve, error: reject });
        });
      } catch {
        // Si falla el refresh, usa lo que haya en sesión
      }
    }

    const nombre =
      String(
        user?.nombre_completo ||
        user?.nombre ||
        user?.name ||
        [user?.nombres, user?.apellidos].filter(Boolean).join(' ') ||
        ''
      ).trim();

    const cargo = String(user?.cargo ?? '').trim();
    const empresaSesion = Array.isArray(user?.empresas) ? user.empresas[0] : null;
    const empresaId = Number(empresaSesion?.id || empresaSesion?.empresa_id || 0);

    let empresaNombre = String(empresaSesion?.nombre ?? 'Clínica Medilaser S.A.').trim();
    let logoUrl = String(empresaSesion?.logo ?? '').trim() || null;
    let logoBase64: string | null = null;

    if (empresaId > 0) {
      try {
        const logoResp = await new Promise<{
          success: boolean;
          nombre?: string;
          logo_url?: string | null;
          logo_base64?: string | null;
        }>((resolve, reject) => {
          this.empresaService.getLogoBase64(empresaId).subscribe({ next: resolve, error: reject });
        });

        if (logoResp?.nombre) {
          empresaNombre = String(logoResp.nombre).trim();
        }
        if (logoResp?.logo_url) {
          logoUrl = String(logoResp.logo_url).trim();
        }
        if (logoResp?.logo_base64) {
          logoBase64 = String(logoResp.logo_base64);
        }
      } catch {
        // Si falla la API del logo, el export usará JadeOne como respaldo
      }
    }

    const ciudadEmision = String(
      user?.sede?.nombre ||
      user?.sucursal?.nombre ||
      ''
    ).trim();

    return { nombre, cargo, empresaNombre, logoUrl, logoBase64, ciudadEmision };
  }

  private cargarDatos(cc: string): void {
    this.dataSub?.unsubscribe();
    this.isLoading = true;
    this.consultado = true;
    this.ultimaConsulta = cc;

    const offset = (this.paginaActual - 1) * this.pageSize;

    this.dataSub = this.vistasService.getVistaDatos(this.schema, this.viewName, {
      filters: { [this.filterColumn]: cc },
      limit: this.pageSize,
      offset,
      skip_count: false
    }).subscribe({
      next: (response) => {
        this.columnDefs = response.columnDefs;
        this.rowData = response.rowData;
        this.meta = response.meta;
        this.isLoading = false;

        if (response.rowData.length === 0) {
          this.messageService.add({
            severity: 'info',
            summary: 'Sin resultados',
            detail: `No se encontraron facturas SOAT para la CC ${cc}.`,
            life: 5000
          });
        }

        queueMicrotask(() => this.gridApi?.sizeColumnsToFit());
      },
      error: (err: unknown) => {
        this.rowData = [];
        this.columnDefs = [];
        this.isLoading = false;

        const detail = err instanceof HttpErrorResponse
          ? handleFabricError(err)
          : 'No se pudo consultar la vista de facturación SOAT.';

        this.messageService.add({
          severity: 'error',
          summary: 'Error al consultar',
          detail,
          life: 7000
        });
      }
    });
  }
}
