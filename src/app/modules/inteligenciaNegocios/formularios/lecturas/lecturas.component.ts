import { Component, OnDestroy, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { DropdownModule } from 'primeng/dropdown';
import { MessageService } from 'primeng/api';
import { Subscription } from 'rxjs';

import { VistasService } from '../../services/vistas.service';
import { AG_GRID_LOCALE } from '../../../../core/config/ag-grid.config';
import { GridLoaderComponent } from '../../../../complements/shared/grid-loader/grid-loader.component';
import { handleFabricError } from '../../helpers/fabric-error.helper';
import { HttpErrorResponse } from '@angular/common/http';

interface LecturaRow {
  Documento: string;
  Paciente: string;
  Servicio: string;
  FechaLectura: string;
  Profesional: string;
  Ruta: string;
  [key: string]: unknown;
}

@Component({
  selector: 'app-lecturas',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AgGridAngular,
    ToastModule,
    TooltipModule,
    DropdownModule,
    GridLoaderComponent
  ],
  providers: [MessageService],
  templateUrl: './lecturas.component.html',
  styleUrl: './lecturas.component.css',
  encapsulation: ViewEncapsulation.None
})
export class LecturasComponent implements OnDestroy {
  private readonly schema = 'co';
  private readonly viewName = 'VW_ReportView_Imagenologia';

  // Filtros
  selectedPaciente = '';
  pacienteOptions: { label: string; value: string }[] = [];
  isLoadingPacientes = false;
  profesionalFilter = '';
  profesionalOptions: { label: string; value: string }[] = [];
  isLoadingProfesionales = false;

  // Estado
  isLoading = false;
  consultado = false;

  // Datos
  rowData: LecturaRow[] = [];
  columnDefs: ColDef[] = [
    { field: 'Documento', headerName: 'Documento', width: 120 },
    { field: 'Paciente', headerName: 'Paciente', width: 220 },
    { field: 'Servicio', headerName: 'Servicio', width: 200 },
    { field: 'FechaLectura', headerName: 'Fecha Lectura', width: 160 },
    { field: 'Profesional', headerName: 'Profesional', width: 200 },
    {
      field: 'Ruta',
      headerName: 'Lectura',
      width: 120,
      cellRenderer: (params: { value: string }) => {
        if (!params.value) return '-';
        return '<button class="btn-ver-pdf"><i class="pi pi-file-pdf"></i> Ver</button>';
      },
      onCellClicked: (event: { data: LecturaRow }) => this.openPdf(event.data)
    }
  ];

  localeText = AG_GRID_LOCALE;
  defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 100,
    floatingFilter: true,
  };

  private gridApi?: GridApi;
  private sub?: Subscription;

  constructor(
    private vistasService: VistasService,
    private messageService: MessageService
  ) {
    this.loadDropdowns();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
  }

  // ─── Cargar datos para los dropdowns ────────────────────────────────────

  private loadDropdowns(): void {
    this.isLoadingPacientes = true;
    this.isLoadingProfesionales = true;

    // Cargar pacientes y profesionales en una sola consulta (las primeras 1000 filas con datos)
    this.vistasService.getVistaDatos(this.schema, this.viewName, {
      columns: ['Documento', 'Paciente', 'Profesional'],
      limit: 1000,
      offset: 0,
      filters: {},
      sort_col: 'FechaLectura',
      sort_dir: 'desc',
    }).subscribe({
      next: (res) => {
        const rows = res.rowData ?? [];

        // Pacientes unicos
        const pacientesMap = new Map<string, string>();
        for (const r of rows) {
          const doc = r['Documento'] as string;
          const nombre = r['Paciente'] as string;
          if (doc && !pacientesMap.has(doc)) {
            pacientesMap.set(doc, `${doc} - ${nombre ?? ''}`);
          }
        }
        this.pacienteOptions = [...pacientesMap.entries()]
          .map(([value, label]) => ({ label, value }))
          .sort((a, b) => a.label.localeCompare(b.label));

        // Profesionales unicos
        const profs = [...new Set(
          rows.map(r => r['Profesional'] as string).filter(Boolean)
        )].sort();
        this.profesionalOptions = profs.map(p => ({ label: p, value: p }));

        this.isLoadingPacientes = false;
        this.isLoadingProfesionales = false;
      },
      error: () => {
        this.isLoadingPacientes = false;
        this.isLoadingProfesionales = false;
      }
    });
  }

  // ─── Consultar ──────────────────────────────────────────────────────────

  consultar(): void {
    const doc = this.selectedPaciente ?? '';
    const prof = this.profesionalFilter ?? '';

    if (!doc && !prof) {
      this.messageService.add({ severity: 'warn', summary: 'Filtro requerido', detail: 'Seleccione al menos un paciente o un profesional.', life: 4000 });
      return;
    }

    this.isLoading = true;
    this.consultado = false;

    const filters: Record<string, string> = {};
    if (doc) filters['Documento'] = doc;
    if (prof) filters['Profesional'] = prof;

    this.sub = this.vistasService.getVistaDatos(this.schema, this.viewName, {
      columns: [],
      limit: 500,
      offset: 0,
      filters,
      sort_col: 'FechaLectura',
      sort_dir: 'desc',
    }).subscribe({
      next: (res) => {
        this.rowData = (res.rowData ?? []) as LecturaRow[];
        this.consultado = true;
        this.isLoading = false;

        if (this.rowData.length === 0) {
          this.messageService.add({ severity: 'info', summary: 'Sin resultados', detail: 'No se encontraron lecturas con los filtros aplicados.', life: 4000 });
        }
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading = false;
        const detail = handleFabricError(err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail, life: 6000 });
      }
    });
  }

  // ─── Abrir PDF ──────────────────────────────────────────────────────────

  openPdf(row: LecturaRow): void {
    const ruta = row.Ruta;
    if (!ruta) {
      this.messageService.add({ severity: 'warn', summary: 'Sin archivo', detail: 'Esta lectura no tiene archivo PDF asociado.', life: 3000 });
      return;
    }

    // Intentar abrir via file:// directamente (transparente para el usuario)
    const fileUrl = this.smbToFileUrl(ruta);
    const win = window.open(fileUrl, '_blank');

    // Si el navegador bloquea, notificar
    if (!win) {
      this.messageService.add({
        severity: 'error',
        summary: 'No se pudo abrir',
        detail: 'El archivo no esta disponible desde este equipo. Verifique que esta conectado a la red de la clinica.',
        life: 6000
      });
    }
  }

  copyRuta(row: LecturaRow): void {
    if (!row.Ruta) return;
    this.copyToClipboard(row.Ruta);
    this.messageService.add({ severity: 'success', summary: 'Copiado', detail: 'Ruta copiada al portapapeles', life: 3000 });
  }

  private smbToFileUrl(smbPath: string): string {
    // \\server\share\path → file://///server/share/path
    return 'file:///' + smbPath.replace(/\\/g, '/');
  }

  private copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).catch(() => {
      // Fallback para navegadores que no soportan clipboard API
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    });
  }
}
