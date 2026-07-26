import { Component, OnDestroy, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { AutoCompleteModule } from 'primeng/autocomplete';
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
    DialogModule,
    DropdownModule,
    AutoCompleteModule,
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
  pacienteQuery = '';
  pacienteSuggestions: { label: string; value: string }[] = [];
  selectedPaciente: string = '';
  profesionalFilter = '';
  profesionalOptions: { label: string; value: string }[] = [];

  // Estado
  isLoading = false;
  isLoadingProfesionales = false;
  consultado = false;
  showPdfDialog = false;
  pdfUrl = '';
  pdfTitle = '';

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
    this.loadProfesionales();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
  }

  // ─── Carga de profesionales (valores unicos) ────────────────────────────

  loadProfesionales(): void {
    this.isLoadingProfesionales = true;
    // Cargar solo 200 filas para extraer nombres unicos (no sobrecargar)
    this.vistasService.getVistaDatos(this.schema, this.viewName, {
      columns: ['Profesional'],
      limit: 200,
      offset: 0,
      filters: {},
    }).subscribe({
      next: (res) => {
        const profesionales = [...new Set(
          (res.rowData ?? []).map(r => r['Profesional'] as string).filter(Boolean)
        )].sort();
        this.profesionalOptions = profesionales.map(p => ({ label: p, value: p }));
        this.isLoadingProfesionales = false;
      },
      error: () => { this.isLoadingProfesionales = false; }
    });
  }

  // ─── Autocomplete paciente ──────────────────────────────────────────────

  searchPaciente(event: { query: string }): void {
    const query = event.query.trim();
    if (query.length < 3) {
      this.pacienteSuggestions = [];
      return;
    }

    this.vistasService.getVistaDatos(this.schema, this.viewName, {
      columns: ['Documento', 'Paciente'],
      limit: 20,
      offset: 0,
      filters: { Documento: `%${query}%` },
    }).subscribe({
      next: (res) => {
        const seen = new Set<string>();
        this.pacienteSuggestions = (res.rowData ?? [])
          .filter(r => {
            const key = `${r['Documento']}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .map(r => ({
            label: `${r['Documento']} - ${r['Paciente']}`,
            value: r['Documento'] as string,
          }));
      }
    });
  }

  onPacienteSelect(event: unknown): void {
    const item = (event as Record<string, unknown>)['value'] as Record<string, string> | undefined;
    if (item && item['value']) {
      this.selectedPaciente = item['value'];
    }
  }

  // ─── Consultar ──────────────────────────────────────────────────────────

  consultar(): void {
    // Extraer documento del paciente (puede ser string directo o objeto seleccionado)
    let doc = '';
    if (typeof this.selectedPaciente === 'string') {
      // El usuario escribio directamente o selecciono y quedo el label
      const match = this.selectedPaciente.match(/^(\d+)/);
      doc = match ? match[1] : this.selectedPaciente.trim();
    }
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

    // Convertir ruta SMB a formato file:// para abrir desde la red interna
    const fileUrl = this.smbToFileUrl(ruta);
    this.pdfTitle = `${row.Paciente} - ${row.Servicio}`;

    // Intentar abrir en nueva ventana (funciona si el usuario esta en la red)
    const win = window.open(fileUrl, '_blank');

    if (!win) {
      // Si el navegador bloquea, copiar al portapapeles
      this.copyToClipboard(ruta);
      this.messageService.add({
        severity: 'info',
        summary: 'Ruta copiada',
        detail: 'La ruta fue copiada al portapapeles. Peguela en Ejecutar (Win+R) o en el Explorador de archivos.',
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
