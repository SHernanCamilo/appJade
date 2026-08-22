import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

// PrimeNG
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { TextareaModule } from 'primeng/textarea';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService, ConfirmationService } from 'primeng/api';

// Services
import { CuadroService, Cuadro } from '../services/cuadro.service';
import { CalculoHorasService } from '../services/calculo-horas.service';
import { UnidadFuncionalService } from '../../../organizacion/empresa/services/unidad-funcional.service';
import { ContextoService } from '../../../../core/services/contexto.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-dashboard-cuadro-turnos',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    DialogModule,
    ToastModule,
    ConfirmDialogModule,
    TagModule,
    TooltipModule,
    DropdownModule,
    CalendarModule,
    TextareaModule,
    SkeletonModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardCuadroDeTurnosComponent implements OnInit {

  activeTab: 'selector' | 'gestionar' | 'configuracion' = 'selector';

  // Empresas
  empresas: any[] = [];
  empresasOptions: any[] = [];
  selectedEmpresa: number | null = null;
  isLoadingEmpresas = false;

  // Selector
  selectedMes: any = null;
  selectedMesFecha: Date | null = null;
  mesesOptions: any[] = [];

  // Unidades Funcionales
  unidadesFuncionales: any[] = [];
  unidadesFuncionalesOptions: any[] = [];
  selectedUnidadFuncional: number | null = null;
  isLoadingUnidades = false;

  // Empleados
  empleados: any[] = [];
  empleadosOptions: any[] = [];
  selectedEmpleado: number | null = null;
  isLoadingEmpleados = false;

  // Gestionar
  cuadros: Cuadro[] = [];
  isLoadingCuadros = false;

  constructor(
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private cuadroService: CuadroService,
    private calculoService: CalculoHorasService,
    private unidadFuncionalService: UnidadFuncionalService,
    private contextoService: ContextoService,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadEmpresas();
    this.loadCuadros();
    this.generarMeses();
  }

  /**
   * Cargar empresas habilitadas para Cuadro de Turnos (filtrado por CUADRO_TURNOS_EMPRESAS en backend).
   */
  loadEmpresas(): void {
    this.isLoadingEmpresas = true;

    this.http.get<any>(`${environment.URL_SERVICIOS}/turnos/cuadro-turno-permisos/empresas`).subscribe({
      next: (response) => {
        this.empresas = response.data || [];
        this.empresasOptions = this.empresas.map((e: any) => ({ label: e.nombre, value: e.id }));
        this.isLoadingEmpresas = false;
        if (this.empresas.length === 1) {
          this.selectedEmpresa = this.empresas[0].id;
          this.onEmpresaChange();
        }
      },
      error: () => { this.isLoadingEmpresas = false; }
    });
  }

  /**
   * Cuando cambia la fecha del calendario mes/año
   */
  onMesFechaChange(): void {
    if (this.selectedMesFecha) {
      const mes = this.selectedMesFecha.getMonth() + 1;
      const anio = this.selectedMesFecha.getFullYear();
      this.selectedMes = { mes, anio, label: `${mes}/${anio}` };
    } else {
      this.selectedMes = null;
    }
  }

  /**
   * Cuando cambia la empresa, cargar unidades funcionales de esa empresa
   */
  onEmpresaChange(): void {
    if (!this.selectedEmpresa) {
      this.unidadesFuncionales = [];
      this.unidadesFuncionalesOptions = [];
      this.selectedUnidadFuncional = null;
      this.empleados = [];
      this.empleadosOptions = [];
      this.selectedEmpleado = null;
      return;
    }

    // Cargar unidades funcionales de la empresa seleccionada
    this.loadUnidadesFuncionalesPorEmpresa(this.selectedEmpresa);
  }

  /**
   * Cargar unidades funcionales filtradas por permisos del usuario.
   * Usa /del-usuario que respeta el access_level y filtra por empresa seleccionada.
   */
  loadUnidadesFuncionalesPorEmpresa(empresaId: number): void {
    this.isLoadingUnidades = true;
    this.http.get<any>(`${environment.URL_SERVICIOS}/turnos/unidades-funcionales/del-usuario`).subscribe({
      next: (response: any) => {
        const todasUnidades = response.data || [];
        // Filtrar por empresa seleccionada
        const unidades = todasUnidades.filter((u: any) => u.empresa?.id === empresaId || u.id_empresa === empresaId);
        this.unidadesFuncionales = unidades;
        this.unidadesFuncionalesOptions = unidades.map((u: any) => ({
          label: u.codigo ? `${u.codigo} - ${u.nombre}` : u.nombre,
          value: u.id,
          nombre: u.nombre
        }));
        this.isLoadingUnidades = false;
      },
      error: (error: any) => {
        console.error('Error al cargar unidades funcionales:', error);
        this.messageService.add({
          severity: 'warn',
          summary: 'Advertencia',
          detail: 'No se pudieron cargar las unidades funcionales'
        });
        this.isLoadingUnidades = false;
      }
    });
  }

  loadCuadros(): void {
    this.isLoadingCuadros = true;
    this.cuadroService.getCuadros().subscribe({
      next: (cuadros) => {
        this.cuadros = cuadros;
        this.isLoadingCuadros = false;
      },
      error: (error) => {
        console.error('Error al cargar cuadros:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los cuadros'
        });
        this.isLoadingCuadros = false;
      }
    });
  }

  generarMeses(): void {
    const meses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const currentYear = new Date().getFullYear();
    
    this.mesesOptions = [];
    for (let year = currentYear - 1; year <= currentYear + 1; year++) {
      for (let mes = 1; mes <= 12; mes++) {
        this.mesesOptions.push({
          label: `${meses[mes - 1]} ${year}`,
          value: { mes, year }
        });
      }
    }
  }

  onUnidadFuncionalChange(): void {
    if (!this.selectedUnidadFuncional) {
      this.empleados = [];
      this.empleadosOptions = [];
      this.selectedEmpleado = null;
      return;
    }
    this.loadEmpleadosUnidad(this.selectedUnidadFuncional);
  }

  loadEmpleadosUnidad(idUnidad: number): void {
    this.isLoadingEmpleados = true;
    this.unidadFuncionalService.getEmpleadosUnidad(idUnidad).subscribe({
      next: (empleados: any[]) => {
        this.empleados = empleados;
        this.empleadosOptions = empleados.map((e: any) => ({
          label: `${e.nombre}`,
          value: e.id
        }));
        this.isLoadingEmpleados = false;
      },
      error: () => {
        this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'No se pudieron cargar los empleados' });
        this.isLoadingEmpleados = false;
      }
    });
  }

  verCuadroDetalle(cuadro: Cuadro): void {
    this.router.navigate(['/talentoHumano/turnos/cuadro', cuadro.id, 'grilla'], {
      queryParams: { mes: cuadro.mes, year: cuadro.year }
    });
  }

  getEstadoSeverity(estado: string): 'success' | 'danger' | 'warn' | 'info' {
    const map: Record<string, 'success' | 'danger' | 'warn' | 'info'> = {
      creado: 'info',
      activo: 'success',
    };
    return map[estado] ?? 'info';
  }

  setTab(tab: 'selector' | 'gestionar' | 'configuracion'): void {
    this.activeTab = tab;
  }

  /**
   * Refrescar la página
   */
  refrescarPagina(): void {
    window.location.reload();
  }

  // ═══════════════════════════════════════════════════════════
  // REPORTES
  // ═══════════════════════════════════════════════════════════

  reportMode: 'personal' | 'unidad' = 'personal';
  reportData: any = null;

  generarReporte(): void {
    if (!this.selectedMes || !this.selectedUnidadFuncional) return;
    const mes = this.selectedMes.mes || (this.selectedMesFecha ? this.selectedMesFecha.getMonth() + 1 : null);
    const year = this.selectedMes.anio || this.selectedMes.year || (this.selectedMesFecha ? this.selectedMesFecha.getFullYear() : null);
    if (!mes || !year) return;

    if (this.reportMode === 'personal') {
      if (!this.selectedEmpleado) return;
      this.generarReportePersonal(this.selectedEmpleado, year, mes);
    } else {
      this.generarReporteUnidad(this.selectedUnidadFuncional, year, mes);
    }
  }

  private generarReportePersonal(idEmpleado: number, anio: number, mes: number): void {
    this.calculoService.getCuadroMesEmpleado(idEmpleado, anio, mes).subscribe({
      next: (data) => {
        const emp = this.empleados.find(e => e.id === idEmpleado) || data.empleado;
        const nombre = emp?.nombre || 'Empleado';
        this.reportData = this.construirGrillaReporte([{ id: idEmpleado, nombre, turnos: data.turnos }], anio, mes);
        // Guardar datos extras para la exportación
        this.reportData.totales = data.totales;
        this.reportData.horas_extras = data.horas_extras;
        this.reportData.empleado = { id: idEmpleado, nombre };
      },
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo generar el reporte' })
    });
  }

  private generarReporteUnidad(idUnidad: number, anio: number, mes: number): void {
    // Obtener todos los empleados de la unidad y sus turnos
    this.http.get<any>(`${environment.URL_SERVICIOS}/turnos/unidades-funcionales/${idUnidad}/empleados`).subscribe({
      next: (r) => {
        const empleadosUnidad = r.data || [];
        if (!empleadosUnidad.length) {
          this.messageService.add({ severity: 'info', summary: 'Info', detail: 'No hay empleados en esta unidad' });
          return;
        }
        // Cargar turnos de cada empleado
        let completados = 0;
        const filas: any[] = [];

        empleadosUnidad.forEach((emp: any) => {
          this.calculoService.getCuadroMesEmpleado(emp.id, anio, mes).subscribe({
            next: (data) => {
              filas.push({ id: emp.id, nombre: emp.nombre, turnos: data.turnos || [] });
              completados++;
              if (completados === empleadosUnidad.length) {
                this.reportData = this.construirGrillaReporte(filas, anio, mes);
              }
            },
            error: () => {
              filas.push({ id: emp.id, nombre: emp.nombre, turnos: [] });
              completados++;
              if (completados === empleadosUnidad.length) {
                this.reportData = this.construirGrillaReporte(filas, anio, mes);
              }
            }
          });
        });
      },
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar empleados' })
    });
  }

  private construirGrillaReporte(filas: { id: number; nombre: string; turnos: any[] }[], anio: number, mes: number): any {
    const diasEnMes = new Date(anio, mes, 0).getDate();
    const diasSemanaLetras = ['D','L','M','M','J','V','S'];
    const dias = [];
    for (let d = 1; d <= diasEnMes; d++) {
      const fecha = new Date(anio, mes - 1, d);
      dias.push({ numero: d, letra: diasSemanaLetras[fecha.getDay()], esDomingo: fecha.getDay() === 0, esFestivo: fecha.getDay() === 0 });
    }

    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const unidad = this.unidadesFuncionales.find(u => u.id === this.selectedUnidadFuncional);
    const titulo = this.reportMode === 'personal'
      ? `Turnos de ${filas[0]?.nombre || 'Empleado'}`
      : `Unidad: ${unidad?.nombre || 'Unidad Funcional'}`;
    const periodo = `${meses[mes - 1]} ${anio}`;

    const filasReporte = filas.map(f => {
      const turnoMap = new Map<string, any>();
      (f.turnos || []).forEach((t: any) => turnoMap.set(t.fecha?.substring(0, 10), t));

      let totalMinutos = 0;
      const celdas = [];
      for (let d = 1; d <= diasEnMes; d++) {
        const fechaStr = `${anio}-${String(mes).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const turno = turnoMap.get(fechaStr);
        const esFestivo = new Date(anio, mes - 1, d).getDay() === 0;

        if (turno && !turno.es_descanso && turno.plantilla) {
          const hi = turno.hora_inicio || turno.plantilla?.hora_inicio || '';
          const hf = turno.hora_fin || turno.plantilla?.hora_fin || '';
          const [h1, m1] = (hi || '').split(':').map(Number);
          const [h2, m2] = (hf || '').split(':').map(Number);
          let mins = !isNaN(h1) && !isNaN(h2) ? (h2 * 60 + m2) - (h1 * 60 + m1) : 0;
          if (mins < 0) mins += 24 * 60;
          totalMinutos += mins;
          celdas.push({
            turno: true, esDescanso: false, esFestivo,
            codigo: turno.plantilla.codigo || turno.plantilla.nombre?.substring(0,4) || 'T',
            color: (turno.plantilla.color_hex || '#6366f1') + '22',
            tooltip: `${turno.plantilla.nombre} (${hi?.substring(0,5)} - ${hf?.substring(0,5)})`
          });
        } else if (turno?.es_descanso) {
          celdas.push({ turno: false, esDescanso: true, esFestivo, codigo: '', color: '', tooltip: 'Descanso' });
        } else {
          celdas.push({ turno: false, esDescanso: false, esFestivo, codigo: '', color: '', tooltip: esFestivo ? 'Domingo' : 'Sin turno' });
        }
      }
      const totalHoras = `${Math.floor(totalMinutos / 60)}h ${(totalMinutos % 60).toString().padStart(2,'0')}m`;
      return { nombre: f.nombre, celdas, totalHoras };
    });

    return { titulo, periodo, dias, filas: filasReporte };
  }

  exportarExcel(): void {
    if (!this.reportData) return;
    import('exceljs').then(ExcelJS => {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Reporte Turnos');

      const empleado = this.reportData.empleado?.nombre || 'Empleado';
      const periodo = this.reportData.periodo || '';

      // ── Título ──
      ws.addRow([`Reporte de Turnos - ${empleado}`]);
      ws.addRow([`Periodo: ${periodo}`]);
      ws.addRow([]);

      // ── Grilla de turnos ──
      const headerRow = ['Empleado', ...this.reportData.dias.map((d: any) => `${d.numero} ${d.letra}`), 'Total'];
      ws.addRow(headerRow);

      this.reportData.filas.forEach((fila: any) => {
        const row = [fila.nombre, ...fila.celdas.map((c: any) => c.esDescanso ? 'D' : c.codigo || ''), fila.totalHoras];
        ws.addRow(row);
      });

      ws.addRow([]);

      // ── Totales de horas ──
      if (this.reportData.totales) {
        const t = this.reportData.totales;
        ws.addRow(['RESUMEN DE HORAS']);
        ws.addRow(['Horas Normales', `${t.normales} h`]);
        ws.addRow(['Horas Nocturnas', `${t.nocturnas} h`]);
        ws.addRow(['Horas Festivas', `${t.festivas} h`]);
        ws.addRow(['Horas Festivas Nocturnas', `${t.festivas_nocturnas} h`]);
        ws.addRow(['TOTAL', `${t.total} h`]);
        ws.addRow([]);
      }

      // ── Detalle de Horas Extras ──
      if (this.reportData.horas_extras && this.reportData.horas_extras.total_extras > 0) {
        const he = this.reportData.horas_extras;
        ws.addRow(['HORAS EXTRAS']);
        ws.addRow(['Total Extras', `${he.total_extras} h`]);
        ws.addRow(['Extras Diurnas (HED 25%)', `${he.extras_diurnas} h`]);
        ws.addRow(['Extras Nocturnas (HEN 75%)', `${he.extras_nocturnas} h`]);
        ws.addRow([]);

        // Detalle por día
        if (he.registros && he.registros.length > 0) {
          ws.addRow(['DETALLE HORAS EXTRAS POR DIA']);
          ws.addRow(['Fecha', 'Hora Inicio', 'Hora Fin', 'Tipo', 'Motivo']);
          he.registros.forEach((r: any) => {
            ws.addRow([r.fecha, r.hora_inicio, r.hora_fin, r.tipo || 'hora_extra', r.motivo || '']);
          });
        }
      }

      // ── Estilos ──
      ws.getRow(1).font = { bold: true, size: 14 };
      ws.getRow(2).font = { italic: true, size: 11 };
      ws.getRow(4).font = { bold: true };
      ws.getColumn(1).width = 30;

      // Ajustar ancho columnas de días
      for (let i = 2; i <= this.reportData.dias.length + 1; i++) {
        ws.getColumn(i).width = 6;
      }

      wb.xlsx.writeBuffer().then(buffer => {
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Reporte_Turnos_${empleado.replace(/\s+/g, '_')}_${periodo.replace(/\s+/g, '_')}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
      });
    });
  }
}
