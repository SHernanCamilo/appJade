import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import * as XLSX from 'xlsx';
import {
  EventSolicitud,
  EventSolicitudService
} from '../services/event-solicitud.service';
import { ContextoService, Empresa, Sucursal } from '../../../../core/services/contexto.service';
import { ExcelColumn, ExcelExportService } from '../../../../core/services/excel-export.service';
import { environment } from '../../../../environments/environment';
import { DataTableComponent } from '../../../../complements/shared/data-table/data-table.component';
import { TableColumn } from '../../../../complements/shared/data-table/table-column.model';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { TextareaModule } from 'primeng/textarea';
import { SkeletonModule } from 'primeng/skeleton';
import { ConfirmationService, MessageService } from 'primeng/api';
import { SucursalService } from '../../../organizacion/empresa/services/sucursal.service';

interface AmbitoEmpresa {
  id: number;
  nombre: string;
  prefijo?: string;
  sucursales: Sucursal[];
}

@Component({
  selector: 'app-digitalizacion-eventos',
  standalone: true,
  imports: [
    CommonModule, RouterModule, FormsModule,
    ButtonModule, InputTextModule, DialogModule,
    ToastModule, ConfirmDialogModule, TagModule, TooltipModule,
    TextareaModule, SkeletonModule, DataTableComponent
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './digitalizacion.component.html',
  styleUrl: './digitalizacion.component.css'
})
export class DigitalizacionEventosComponent implements OnInit {
  pendientes: EventSolicitud[] = [];
  seleccion: EventSolicitud[] = [];
  columns: TableColumn[] = [];
  isLoading = false;
  isProcesando = false;
  searchTerm = '';

  showDetalle = false;
  detalle?: EventSolicitud;
  historial: any[] = [];
  isLoadingHistorial = false;

  showExcelDialog = false;
  isImportando = false;
  isExportando = false;
  comentarioMasivo = '';

  vista: 'selector' | 'cola' = 'selector';
  empresas: AmbitoEmpresa[] = [];
  empresasFiltradas: AmbitoEmpresa[] = [];
  isLoadingAmbitos = false;
  filtroAmbito = '';
  empresaSeleccionada: AmbitoEmpresa | null = null;
  sucursalSeleccionada: Sucursal | null = null;

  constructor(
    private solicitudService: EventSolicitudService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private excelExportService: ExcelExportService,
    private contextoService: ContextoService,
    private sucursalService: SucursalService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.columns = [
      { field: 'consecutivo', header: 'Consecutivo', sortable: true },
      { field: 'empleado', header: 'Funcionario', sortable: true },
      { field: 'documento', header: 'Documento' },
      { field: 'unidad_funcional', header: 'U. Funcional', sortable: true },
      { field: 'novedad', header: 'Novedad' },
      { field: 'fecha_nov_ini', header: 'Inicio', sortable: true },
      { field: 'fecha_nov_fin', header: 'Fin', sortable: true },
      { field: 'horas', header: 'Horas' },
      { field: 'estado', header: 'Estado', sortable: true }
    ];
    this.cargarAmbitos();
  }

  cargarAmbitos(): void {
    this.isLoadingAmbitos = true;
    this.contextoService.obtenerEmpresasDisponibles().pipe(
      switchMap((empresas: Empresa[]) => {
        if (empresas?.length) {
          return forkJoin(
            empresas.map(emp =>
              emp.sucursales?.length
                ? of(this.toAmbito(emp, emp.sucursales))
                : this.sucursalService.getSucursalesPorEmpresa(emp.id).pipe(
                    map(sucursales => this.toAmbito(emp, sucursales)),
                    catchError(() => of(this.toAmbito(emp, [])))
                  )
            )
          );
        }
        return this.http.get<{ success: boolean; data: { id: number; nombre: string; prefijo?: string }[] }>(
          `${environment.URL_SERVICIOS}/empresas-activas`
        ).pipe(
          switchMap(r => {
            const lista = r.data || [];
            if (!lista.length) return of([] as AmbitoEmpresa[]);
            return forkJoin(
              lista.map(emp =>
                this.sucursalService.getSucursalesPorEmpresa(emp.id).pipe(
                  map(sucursales => this.toAmbito(emp, sucursales)),
                  catchError(() => of(this.toAmbito(emp, [])))
                )
              )
            );
          }),
          catchError(() => of([] as AmbitoEmpresa[]))
        );
      })
    ).subscribe({
      next: (empresas) => {
        this.empresas = empresas;
        this.aplicarFiltroAmbito();
        this.isLoadingAmbitos = false;
      },
      error: () => {
        this.empresas = [];
        this.empresasFiltradas = [];
        this.isLoadingAmbitos = false;
      }
    });
  }

  private toAmbito(
    emp: { id: number; nombre: string; prefijo?: string },
    sucursales: Sucursal[] | any[]
  ): AmbitoEmpresa {
    return {
      id: emp.id,
      nombre: emp.nombre,
      prefijo: emp.prefijo,
      sucursales: (sucursales || []).map((s: any) => ({
        id: s.id,
        nombre: s.nombre,
        id_Empresa: s.id_Empresa ?? s.id_empresa ?? emp.id,
        sedes: s.sedes
      }))
    };
  }

  aplicarFiltroAmbito(): void {
    const term = this.filtroAmbito.trim().toLowerCase();
    if (!term) {
      this.empresasFiltradas = this.empresas;
      return;
    }
    this.empresasFiltradas = this.empresas
      .map(emp => ({
        ...emp,
        sucursales: emp.sucursales.filter(s =>
          s.nombre.toLowerCase().includes(term) || String((s as any).prefijo || '').toLowerCase().includes(term)
        )
      }))
      .filter(emp =>
        emp.nombre.toLowerCase().includes(term) ||
        (emp.prefijo || '').toLowerCase().includes(term) ||
        emp.sucursales.length > 0
      );
  }

  get etiquetaAmbito(): string {
    if (!this.empresaSeleccionada) return '';
    if (this.sucursalSeleccionada) {
      return `${this.empresaSeleccionada.nombre} · ${this.sucursalSeleccionada.nombre}`;
    }
    return `${this.empresaSeleccionada.nombre} · Todas las sucursales`;
  }

  entrarAmbito(empresa: AmbitoEmpresa, sucursal: Sucursal | null): void {
    this.empresaSeleccionada = empresa;
    this.sucursalSeleccionada = sucursal;
    this.vista = 'cola';
    this.searchTerm = '';
    this.seleccion = [];
    this.cargarPendientes();
  }

  volverAlSelector(): void {
    this.vista = 'selector';
    this.pendientes = [];
    this.seleccion = [];
    this.searchTerm = '';
  }

  colorCard(index: number): string {
    const colors = ['blue', 'teal', 'violet', 'amber', 'rose', 'indigo'];
    return colors[index % colors.length];
  }

  cargarPendientes(): void {
    this.isLoading = true;
    this.solicitudService.getPendientesDigitalizar({
      search: this.searchTerm,
      empresa_id: this.empresaSeleccionada?.id,
      sucursal_id: this.sucursalSeleccionada?.id
    }).subscribe({
      next: (res) => {
        this.pendientes = res.data || [];
        this.seleccion = this.seleccion.filter(s => this.pendientes.some(p => p.id === s.id));
        this.isLoading = false;
      },
      error: () => {
        this.pendientes = [];
        this.seleccion = [];
        this.isLoading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo cargar la cola de digitalización'
        });
      }
    });
  }

  aplicarBusqueda(): void {
    this.cargarPendientes();
  }

  limpiarBusqueda(): void {
    this.searchTerm = '';
    this.cargarPendientes();
  }

  nombreEmpleado(ev: EventSolicitud | undefined): string {
    if (!ev) return '—';
    const emp: any = ev.empleado;
    if (!emp) return '—';
    return typeof emp === 'string' ? emp : (emp.nombre || '—');
  }

  documentoEmpleado(ev: EventSolicitud): string {
    const emp: any = ev.empleado;
    if (emp && typeof emp === 'object') {
      return emp.numero_identificacion || '—';
    }
    return '—';
  }

  novedadLabel(ev: EventSolicitud): string {
    const n = ev.novedad;
    if (!n) return '—';
    if (typeof n === 'string') return n;
    const codigo = n.codigo ? `${n.codigo} - ` : '';
    return `${codigo}${n.descripcion || '—'}`;
  }

  calcularHoras(inicio?: string, fin?: string): string {
    if (!inicio || !fin) return '—';
    try {
      const parse = (f: string) => new Date(f.includes(' ') ? f.replace(' ', 'T') : f);
      const dIni = parse(inicio);
      const dFin = parse(fin);
      if (isNaN(dIni.getTime()) || isNaN(dFin.getTime())) return '—';
      const diffMs = dFin.getTime() - dIni.getTime();
      if (diffMs <= 0) return '0 h';
      const totalMin = Math.round(diffMs / 60000);
      const horas = Math.floor(totalMin / 60);
      const minutos = totalMin % 60;
      return minutos === 0 ? `${horas} h` : `${horas} h ${minutos} min`;
    } catch {
      return '—';
    }
  }

  formatearFecha(fecha: any): string {
    if (!fecha) return '—';
    try {
      const date = fecha instanceof Date
        ? fecha
        : new Date(typeof fecha === 'string' && fecha.includes(' ') ? fecha.replace(' ', 'T') : fecha);
      if (isNaN(date.getTime())) return String(fecha);
      return date.toLocaleDateString('es-CO', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: false
      });
    } catch {
      return String(fecha);
    }
  }

  getEstadoLabel(estado: EventSolicitud['estado']): string {
    const codigo = this.getEstadoCodigo(estado);
    const map: Record<number, string> = {
      1: 'Registrado', 2: 'Aprobado', 3: 'Autorizado',
      4: 'Rechazado', 5: 'Digitalizado', 6: 'Anulado'
    };
    return map[codigo] || String(estado || 'Sin estado');
  }

  getEstadoSeverity(estado: EventSolicitud['estado']): 'success' | 'info' | 'warn' | 'danger' {
    return this.getEstadoCodigo(estado) === 3 ? 'info' : 'warn';
  }

  private getEstadoCodigo(estado: number | string): number {
    if (typeof estado === 'number') return estado;
    const map: Record<string, number> = {
      registrado: 1, proceso: 1, aprobada: 2, aprobado: 2,
      autorizada: 3, autorizado: 3, rechazada: 4, rechazado: 4,
      digitalizada: 5, digitalizado: 5, anulado: 6, anulada: 6
    };
    return map[(estado || '').toString().toLowerCase().trim()] ?? 0;
  }

  digitalizarUno(evento: EventSolicitud): void {
    this.confirmationService.confirm({
      message: `¿Digitalizar el evento ${evento.consecutivo}? Nómina lo tomará para el pago.`,
      header: 'Confirmar digitalización',
      icon: 'pi pi-upload',
      acceptLabel: 'Sí, digitalizar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-success',
      accept: () => this.ejecutarDigitalizacion([evento.id])
    });
  }

  digitalizarSeleccionados(): void {
    if (this.seleccion.length === 0 || this.isProcesando) return;
    this.confirmationService.confirm({
      message: `¿Digitalizar ${this.seleccion.length} evento(s)? Quedarán listos para el pago en nómina.`,
      header: 'Digitalizar seleccionados',
      icon: 'pi pi-upload',
      acceptLabel: 'Sí, digitalizar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-success',
      accept: () => this.ejecutarDigitalizacion(this.seleccion.map(e => e.id))
    });
  }

  private ejecutarDigitalizacion(ids: number[]): void {
    if (ids.length === 0) return;
    this.isProcesando = true;

    this.solicitudService.digitalizarMasivo({
      ids,
      comentario: this.comentarioMasivo.trim() || undefined
    }).subscribe({
      next: (res) => {
        const fallidos = res.data?.fallidos || [];
        if (res.data?.exitosos) {
          this.messageService.add({
            severity: fallidos.length ? 'warn' : 'success',
            summary: 'Digitalización',
            detail: res.message
          });
        }
        if (fallidos.length) {
          this.messageService.add({
            severity: res.data?.exitosos ? 'warn' : 'error',
            summary: 'No se digitalizaron todos',
            detail: fallidos.map(f => `${f.consecutivo || f.id}: ${f.message}`).join('; ')
          });
        }
        this.comentarioMasivo = '';
        this.seleccion = [];
        this.isProcesando = false;
        this.cerrarDetalle();
        this.cargarPendientes();
      },
      error: (err) => {
        this.isProcesando = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.message || 'No se pudo digitalizar'
        });
      }
    });
  }

  abrirDetalle(evento: EventSolicitud): void {
    this.detalle = evento;
    this.historial = [];
    this.showDetalle = true;
    this.isLoadingHistorial = true;
    this.solicitudService.getHistorial(evento.id).subscribe({
      next: (res) => {
        this.historial = res.data?.aprobaciones || [];
        this.isLoadingHistorial = false;
      },
      error: () => {
        this.historial = [];
        this.isLoadingHistorial = false;
      }
    });
  }

  cerrarDetalle(): void {
    this.showDetalle = false;
    this.detalle = undefined;
    this.historial = [];
  }

  async exportarPendientes(): Promise<void> {
    if (this.pendientes.length === 0 || this.isExportando) return;
    this.isExportando = true;
    try {
      const columnas: ExcelColumn[] = [
        { header: 'Consecutivo', key: 'consecutivo', width: 18, isText: true },
        { header: 'Estado destino', key: 'estado_destino', width: 16 },
        { header: 'Funcionario', key: 'empleado', width: 32 },
        { header: 'Documento', key: 'documento', width: 16, isText: true },
        { header: 'U. Funcional', key: 'unidad_funcional', width: 28 },
        { header: 'Novedad', key: 'novedad', width: 28 },
        { header: 'Inicio', key: 'inicio', width: 20 },
        { header: 'Fin', key: 'fin', width: 20 },
        { header: 'Horas', key: 'horas', width: 12 }
      ];
      const datos = this.pendientes.map(ev => ({
        consecutivo: ev.consecutivo,
        estado_destino: 'Digitalizado',
        empleado: this.nombreEmpleado(ev),
        documento: this.documentoEmpleado(ev),
        unidad_funcional: ev.unidad_funcional || '—',
        novedad: this.novedadLabel(ev),
        inicio: this.formatearFecha(ev.fecha_nov_ini),
        fin: this.formatearFecha(ev.fecha_nov_fin),
        horas: this.calcularHoras(ev.fecha_nov_ini, ev.fecha_nov_fin)
      }));
      await this.excelExportService.exportToExcel(
        datos, columnas, 'Pendientes', 'eventos_pendientes_digitalizar', undefined,
        { title: 'Eventos pendientes de digitalización', subtitle: 'Columna A = consecutivo para el cargue masivo' }
      );
      this.messageService.add({ severity: 'success', summary: 'Excel', detail: 'Archivo generado' });
    } catch {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo exportar' });
    } finally {
      this.isExportando = false;
    }
  }

  onArchivoExcel(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const nombre = file.name.toLowerCase();
    if (!nombre.endsWith('.xlsx') && !nombre.endsWith('.xls')) {
      this.messageService.add({ severity: 'warn', summary: 'Archivo', detail: 'Use un Excel .xlsx o .xls' });
      input.value = '';
      return;
    }

    this.isImportando = true;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const wb = XLSX.read(reader.result, { type: 'array' });
        const consecutivos = this.extraerConsecutivos(wb);
        if (consecutivos.length === 0) {
          this.messageService.add({
            severity: 'warn',
            summary: 'Excel vacío',
            detail: 'No se encontraron consecutivos en la columna A'
          });
          this.isImportando = false;
          input.value = '';
          return;
        }

        this.solicitudService.digitalizarMasivo({
          consecutivos,
          comentario: this.comentarioMasivo.trim() || undefined
        }).subscribe({
          next: (res) => {
            const fallidos = res.data?.fallidos || [];
            this.messageService.add({
              severity: res.data?.exitosos && !fallidos.length ? 'success' : (res.data?.exitosos ? 'warn' : 'error'),
              summary: 'Cargue masivo',
              detail: res.message
            });
            if (fallidos.length) {
              this.messageService.add({
                severity: 'warn',
                summary: 'Filas no procesadas',
                detail: fallidos.map(f => `${f.consecutivo || f.id}: ${f.message}`).join('; '),
                life: 8000
              });
            }
            this.comentarioMasivo = '';
            this.showExcelDialog = false;
            this.isImportando = false;
            input.value = '';
            this.cargarPendientes();
          },
          error: (err) => {
            this.isImportando = false;
            input.value = '';
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: err.error?.message || 'No se pudo procesar el Excel'
            });
          }
        });
      } catch {
        this.isImportando = false;
        input.value = '';
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo leer el Excel' });
      }
    };
    reader.readAsArrayBuffer(file);
  }

  private extraerConsecutivos(wb: XLSX.WorkBook): string[] {
    const valores = new Set<string>();
    for (const sheetName of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[sheetName], { header: 1, defval: '' });
      rows.forEach((row, index) => {
        const raw = String(row?.[0] ?? '').trim();
        if (!raw) return;
        if (index === 0 && /consecutivo|serie|codigo/i.test(raw)) return;
        valores.add(raw);
      });
    }
    return Array.from(valores);
  }

  accionHistorial(accion?: string): string {
    const valor = (accion || '').toLowerCase();
    if (valor === 'aprobado') return 'Aprobado';
    if (valor === 'rechazado') return 'Rechazado';
    return accion || '—';
  }
}
