import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';

import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { CheckboxModule } from 'primeng/checkbox';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { MessageService } from 'primeng/api';

import { CalculoHorasService, CuadroMesEmpleado, DesgloseDia, Festivo } from '../services/calculo-horas.service';
import { PlantillaService, Plantilla } from '../services/plantilla.service';
import { AsignacionService } from '../services/asignacion.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { environment } from '../../../../environments/environment';

interface Empleado {
  id: number;
  nombre: string;
}

interface DiaCalendario {
  fecha: string;            // YYYY-MM-DD
  numero: number;           // día del mes
  esDelMes: boolean;        // false si es relleno (mes anterior/siguiente)
  esHoy: boolean;
  esDomingo: boolean;
  esFestivo: boolean;
  nombreFestivo?: string;
  turno?: any;              // turno del empleado en ese día (si existe)
  desglose?: DesgloseDia;
}

@Component({
  selector: 'app-cuadro-mes-empleado',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    ButtonModule, DropdownModule, DialogModule, InputTextModule,
    CheckboxModule, ToastModule, TooltipModule, TagModule, SkeletonModule, OverlayPanelModule
  ],
  providers: [MessageService],
  templateUrl: './cuadro-mes-empleado.component.html',
  styleUrls: ['./cuadro-mes-empleado.component.css']
})
export class CuadroMesEmpleadoComponent implements OnInit {

  // ───── EMPRESAS ─────
  empresas: any[] = [];
  empresasOptions: any[] = [];
  selectedEmpresa: number | null = null;

  // ───── SUCURSALES ─────
  sucursalesOptions: any[] = [];
  selectedSucursal: number | null = null;

  // ───── SEDES ─────
  sedesOptions: any[] = [];
  selectedSede: number | null = null;

  // ───── UNIDADES FUNCIONALES ─────
  unidadesResponsable: any[] = [];
  unidadOptions: any[] = [];
  selectedUnidad: number | null = null;
  unidadActual: any = null;

  // ───── Filtros - EMPLEADOS ─────
  empleados: any[] = [];
  empleadoOptions: any[] = [];
  selectedEmpleado: number | null = null;

  // ───── CUADRO ACTUAL ─────
  idCuadroActual: number | null = null;  // Se establece cuando selecciona unidad

  mesOptions: { label: string; value: number }[] = [
    { label: 'Enero', value: 1 }, { label: 'Febrero', value: 2 }, { label: 'Marzo', value: 3 },
    { label: 'Abril', value: 4 }, { label: 'Mayo', value: 5 }, { label: 'Junio', value: 6 },
    { label: 'Julio', value: 7 }, { label: 'Agosto', value: 8 }, { label: 'Septiembre', value: 9 },
    { label: 'Octubre', value: 10 }, { label: 'Noviembre', value: 11 }, { label: 'Diciembre', value: 12 }
  ];
  anioOptions: { label: string; value: number }[] = [];
  selectedMes = new Date().getMonth() + 1;
  selectedAnio = new Date().getFullYear();

  // ───── Calendario ─────
  diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  calendario: DiaCalendario[] = [];
  cuadro: CuadroMesEmpleado | null = null;
  festivosMes: Festivo[] = [];
  isLoading = false;

  // Día seleccionado (panel derecho)
  diaSeleccionado: DiaCalendario | null = null;

  // ───── Modal de edición ─────
  showEditDialog = false;
  isSavingDay = false;
  plantillas: Plantilla[] = [];
  plantillaOptions: any[] = [];

  // Modal de resumen
  showResumenModal = false;

  // Selector Mes/Año
  modoSeleccionarAnio = false;
  @ViewChild('mesAnioPanel') mesAnioPanel: any;

  editForm = this.emptyEditForm();

  // Getter para el nombre del empleado en el modal
  get nombreEmpleadoResumen(): string {
    if (!this.selectedEmpleado) return 'Usuario';
    const empleado = this.empleados.find(e => e.id === this.selectedEmpleado);
    return empleado?.nombre || 'Usuario';
  }

  constructor(
    private calculoService: CalculoHorasService,
    private plantillaService: PlantillaService,
    private asignacionService: AsignacionService,
    private permissionService: PermissionService,
    private http: HttpClient,
    private message: MessageService
  ) {}

  ngOnInit(): void {
    const y = new Date().getFullYear();
    for (let i = y - 1; i <= y + 1; i++) this.anioOptions.push({ label: String(i), value: i });

    this.cargarEmpresas();
    this.cargarPlantillas();
    this.construirCalendario();
  }

  // ───── Control de acceso ─────
  esTransversal = false;

  // ═══════════════════════════════════════════════════════════
  // CARGAR DATOS INICIALES — UN SOLO ENDPOINT
  // ═══════════════════════════════════════════════════════════

  cargarEmpresas(): void {
    // 1. Cargar unidades del usuario (respeta roles)
    this.http.get<any>(`${environment.URL_SERVICIOS}/turnos/unidades-funcionales/del-usuario`).subscribe({
      next: (response) => {
        this.unidadesResponsable = response.data || [];
        const accessLevel = response.access_level;
        this.esTransversal = (accessLevel === 'super_admin' || accessLevel === 'transversal');

        // 2. Cargar empresas según el rol
        this.http.get<any>(`${environment.URL_SERVICIOS}/contexto/empresas-disponibles`).subscribe({
          next: (empResponse) => {
            const empresasUsuario = empResponse.data || empResponse || [];

            if (Array.isArray(empresasUsuario) && empresasUsuario.length > 0) {
              // Usuario con empresas asignadas → mostrar sus empresas
              this.empresas = empresasUsuario;
              this.empresasOptions = empresasUsuario.map((e: any) => ({ label: e.nombre, value: e.id }));
            } else if (this.esTransversal) {
              // Transversal sin empresas → cargar todas
              this.http.get<any>(`${environment.URL_SERVICIOS}/empresas-activas`).subscribe({
                next: (r) => {
                  this.empresas = r.data || [];
                  this.empresasOptions = this.empresas.map((e: any) => ({ label: e.nombre, value: e.id }));
                  this.autoSeleccionarEmpresa();
                }
              });
              return;
            }

            this.autoSeleccionarEmpresa();
          },
          error: () => {
            // Fallback: extraer empresas de unidades
            const empresasMap = new Map<number, any>();
            this.unidadesResponsable.forEach((u: any) => { if (u.empresa) empresasMap.set(u.empresa.id, u.empresa); });
            this.empresas = Array.from(empresasMap.values());
            this.empresasOptions = this.empresas.map(e => ({ label: e.nombre, value: e.id }));
            this.autoSeleccionarEmpresa();
          }
        });
      },
      error: () => this.toastError('Error al cargar datos')
    });
  }

  private autoSeleccionarEmpresa(): void {
    if (this.empresasOptions.length >= 1) {
      this.selectedEmpresa = this.empresasOptions[0].value;
      setTimeout(() => this.onEmpresaChange(), 100);
    }
  }

  cargarUnidadesResponsable(): void { /* ya se cargan en cargarEmpresas */ }

  onEmpresaChange(): void {
    if (!this.selectedEmpresa) return;

    this.selectedSucursal = null; this.sedesOptions = []; this.selectedSede = null;
    this.unidadOptions = []; this.selectedUnidad = null;
    this.empleados = []; this.empleadoOptions = []; this.selectedEmpleado = null;

    if (this.esTransversal) {
      // Transversal: traer TODAS las sucursales de la empresa
      this.http.get<any>(`${environment.URL_SERVICIOS}/sucursales-por-empresa/${this.selectedEmpresa}`).subscribe({
        next: (r) => {
          const sucursales = Array.isArray(r) ? r : (r.data || []);
          this.sucursalesOptions = sucursales.map((s: any) => ({ label: s.nombre, value: s.id }));
          if (this.sucursalesOptions.length >= 1) {
            this.selectedSucursal = this.sucursalesOptions[0].value;
            setTimeout(() => this.onSucursalChange(), 100);
          }
        }
      });
    } else {
      // Limitado: extraer sucursales de SUS unidades
      const unidadesEmpresa = this.unidadesResponsable.filter(u => u.empresa?.id === this.selectedEmpresa);
      const sucMap = new Map<number, any>();
      unidadesEmpresa.forEach((u: any) => { if (u.sucursal) sucMap.set(u.sucursal.id, u.sucursal); });
      this.sucursalesOptions = Array.from(sucMap.values()).map(s => ({ label: s.nombre, value: s.id }));
      if (this.sucursalesOptions.length >= 1) {
        this.selectedSucursal = this.sucursalesOptions[0].value;
        setTimeout(() => this.onSucursalChange(), 100);
      }
    }
  }

  onSucursalChange(): void {
    if (!this.selectedSucursal || !this.selectedEmpresa) return;

    this.selectedSede = null; this.unidadOptions = []; this.selectedUnidad = null;
    this.empleados = []; this.empleadoOptions = []; this.selectedEmpleado = null;

    if (this.esTransversal) {
      // Transversal: traer TODAS las sedes de la sucursal
      this.http.get<any>(`${environment.URL_SERVICIOS}/sedes-por-sucursal/${this.selectedSucursal}`).subscribe({
        next: (r) => {
          const sedes = Array.isArray(r) ? r : (r.data || []);
          this.sedesOptions = sedes.map((s: any) => ({ label: s.nombre, value: s.id }));
          if (this.sedesOptions.length >= 1) {
            this.selectedSede = this.sedesOptions[0].value;
            setTimeout(() => this.onSedeChange(), 100);
          } else {
            this.cargarUnidadesPorFiltro();
          }
        }
      });
    } else {
      // Limitado: extraer sedes de SUS unidades
      const unidadesSuc = this.unidadesResponsable.filter(u =>
        u.empresa?.id === this.selectedEmpresa && u.sucursal?.id === this.selectedSucursal
      );
      const sedeMap = new Map<number, any>();
      unidadesSuc.forEach((u: any) => { if (u.sede) sedeMap.set(u.sede.id, u.sede); });
      this.sedesOptions = Array.from(sedeMap.values()).map(s => ({ label: s.nombre, value: s.id }));
      if (this.sedesOptions.length >= 1) {
        this.selectedSede = this.sedesOptions[0].value;
        setTimeout(() => this.onSedeChange(), 100);
      } else {
        // Sin sedes: mostrar unidades directamente
        this.cargarUnidadesFiltradas(unidadesSuc);
      }
    }
  }

  onSedeChange(): void {
    if (!this.selectedSede) return;

    if (this.esTransversal) {
      this.cargarUnidadesPorFiltro();
    } else {
      // Limitado: filtrar de SUS unidades
      const unidadesSede = this.unidadesResponsable.filter(u =>
        u.empresa?.id === this.selectedEmpresa
        && u.sucursal?.id === this.selectedSucursal
        && u.sede?.id === this.selectedSede
      );
      this.cargarUnidadesFiltradas(unidadesSede);
    }
  }

  /**
   * Carga unidades desde el backend (para transversal)
   */
  private cargarUnidadesPorFiltro(): void {
    const params: any = { id_empresa: this.selectedEmpresa };
    if (this.selectedSucursal) params.id_sucursal = this.selectedSucursal;
    if (this.selectedSede) params.id_sede = this.selectedSede;

    this.http.get<any>(`${environment.URL_SERVICIOS}/turnos/unidades-funcionales`, { params }).subscribe({
      next: (response) => {
        this.cargarUnidadesFiltradas(response.data || []);
      },
      error: () => {
        this.unidadOptions = [];
      }
    });
  }

  private cargarUnidadesFiltradas(unidades: any[]): void {
    this.unidadOptions = unidades.map(u => ({ label: u.nombre, value: u.id, data: u }));
    this.selectedUnidad = null; this.unidadActual = null;
    this.empleados = []; this.empleadoOptions = []; this.selectedEmpleado = null; this.cuadro = null;

    if (this.unidadOptions.length >= 1) {
      this.selectedUnidad = this.unidadOptions[0].value;
      setTimeout(() => this.onUnidadChange(), 100);
    }
  }

  onUnidadChange(): void {
    if (!this.selectedUnidad) return;
    const op = this.unidadOptions.find(u => u.value === this.selectedUnidad);
    this.unidadActual = op?.data || null;
    this.empleados = []; this.empleadoOptions = []; this.selectedEmpleado = null;
    this.cuadro = null; this.diaSeleccionado = null; this.idCuadroActual = null;
    if (!this.unidadActual) return;
    this.asegurarCuadroUnidad();
    this.cargarEmpleadosUnidad();
  }

  private asegurarCuadroUnidad(): void {
    if (!this.unidadActual) return;
    this.calculoService.ensureCuadroUnidad(this.unidadActual.id, this.selectedAnio, this.selectedMes).subscribe({
      next: (r) => { this.idCuadroActual = r.data.id_cuadro; },
      error: () => this.toastError('No se pudo preparar el cuadro')
    });
  }

  cargarEmpleadosUnidad(): void {
    if (!this.unidadActual) return;
    this.http.get<any>(`${environment.URL_SERVICIOS}/turnos/unidades-funcionales/${this.unidadActual.id}/empleados`).subscribe({
      next: (r) => {
        this.empleados = r.data || [];
        this.empleadoOptions = this.empleados.map((e: any) => ({ label: e.nombre, value: e.id }));
        if (!this.empleados.length) this.toastInfo(`No hay empleados en ${this.unidadActual.nombre}`);
      },
      error: () => this.toastError('Error al cargar empleados')
    });
  }
  // ═══════════════════════════════════════════════════════════
  // CARGAR PLANTILLAS
  // ═══════════════════════════════════════════════════════════

  cargarPlantillas(): void {
    this.plantillaService.getPlantillas({ estado: true }).subscribe({
      next: ps => {
        this.plantillas = ps ?? [];
        this.plantillaOptions = [
          { label: '— Sin turno (descanso) —', value: null },
          ...this.plantillas.map(p => ({
            label: this.formatPlantillaLabel(p),
            value: p.id
          }))
        ];
      },
      error: () => this.toastError('No se pudieron cargar las plantillas')
    });
  }

  private formatPlantillaLabel(p: Plantilla): string {
    const r1 = `${p.hora_inicio?.substring(0, 5)} - ${p.hora_fin?.substring(0, 5)}`;
    if (p.hora_inicio_2 && p.hora_fin_2) {
      return `${p.nombre} (${r1} | ${p.hora_inicio_2.substring(0, 5)} - ${p.hora_fin_2.substring(0, 5)})`;
    }
    return `${p.nombre} (${r1})`;
  }

  // ═══════════════════════════════════════════════════════════
  // CARGAR FESTIVOS Y CONSTRUIR CALENDARIO
  // ═══════════════════════════════════════════════════════════

  cargarFestivosYConstruirCalendario(): void {
    this.calculoService.getFestivos(this.selectedAnio).subscribe({
      next: festivos => {
        this.festivosMes = festivos || [];
        this.construirCalendario();
      },
      error: () => {
        this.festivosMes = [];
        this.construirCalendario();
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  // CAMBIOS EN FILTROS
  // ═══════════════════════════════════════════════════════════

  onEmpleadoChange(): void {
    if (this.selectedEmpleado) {
      // Asegurar que existe un cuadro para este empleado
      this.asegurarCuadroEmpleado();
      this.cargarCuadro();
    } else {
      this.cuadro = null;
      this.diaSeleccionado = null;
      this.showResumenModal = false;
      this.construirCalendario();
    }
  }

  /**
   * Asegurar que existe un cuadro para el empleado seleccionado
   */
  private asegurarCuadroEmpleado(): void {
    if (!this.selectedEmpleado) return;

    this.calculoService
      .ensureCuadroEmpleado(this.selectedEmpleado, this.selectedAnio, this.selectedMes)
      .subscribe({
        next: (response) => {
          this.idCuadroActual = response.data.id_cuadro;
        },
        error: (err) => {
          // Fallback: intentar con la unidad si existe
          if (this.unidadActual) {
            this.asegurarCuadroUnidad();
          }
        }
      });
  }

  onMesAnioChange(): void {
    // Si hemos seleccionado una unidad, re-asegurar cuadro con nuevo mes/año
    if (this.selectedUnidad) {
      this.asegurarCuadroUnidad();
    }
    
    // Si tenemos empleado seleccionado, cargar su cuadro
    if (this.selectedEmpleado) {
      this.cargarCuadro();
    } else {
      this.cargarFestivosYConstruirCalendario();
    }
  }

  // ═══════════════════════════════════════════════════════════
  // CARGAR CUADRO DEL EMPLEADO
  // ═══════════════════════════════════════════════════════════

  cargarCuadro(): void {
    if (!this.selectedEmpleado) {
      this.cuadro = null;
      this.diaSeleccionado = null;
      return;
    }

    this.isLoading = true;
    this.calculoService
      .getCuadroMesEmpleado(this.selectedEmpleado, this.selectedAnio, this.selectedMes)
      .subscribe({
        next: data => {
          this.cuadro = data;
          this.festivosMes = data.festivos || this.festivosMes;
          this.construirCalendario();
          this.isLoading = false;
        },
        error: (err) => {
          this.isLoading = false;
          this.cuadro = null;
          this.construirCalendario();
          this.toastError('No se pudo cargar el cuadro del empleado');
        }
      });
  }

  // ═══════════════════════════════════════════════════════════
  // CONSTRUIR CALENDARIO
  // ═══════════════════════════════════════════════════════════

  private construirCalendario(): void {
    const anio = this.selectedAnio;
    const mes = this.selectedMes;
    const primerDia = new Date(anio, mes - 1, 1);
    const ultimoDia = new Date(anio, mes, 0);
    const diasEnMes = ultimoDia.getDate();
    const diaInicioSemana = primerDia.getDay();

    const festivos = new Map<string, string>();
    const fuenteFestivos = (this.cuadro?.festivos && this.cuadro.festivos.length)
      ? this.cuadro.festivos
      : this.festivosMes;
    (fuenteFestivos || []).forEach(f => festivos.set(this.normalizarFecha(f.fecha), f.nombre));

    const turnos = new Map<string, any>();
    (this.cuadro?.turnos || []).forEach(t => turnos.set(t.fecha, t));

    const desgloseDias = this.cuadro?.por_dia || {};
    const hoy = this.toIsoDate(new Date());

    const dias: DiaCalendario[] = [];

    // Relleno antes del día 1
    for (let i = 0; i < diaInicioSemana; i++) {
      const fecha = new Date(anio, mes - 1, 1 - (diaInicioSemana - i));
      dias.push(this.crearDiaRelleno(fecha));
    }

    // Días del mes seleccionado
    for (let d = 1; d <= diasEnMes; d++) {
      const fechaObj = new Date(anio, mes - 1, d);
      const fechaStr = this.toIsoDate(fechaObj);
      dias.push({
        fecha: fechaStr,
        numero: d,
        esDelMes: true,
        esHoy: fechaStr === hoy,
        esDomingo: fechaObj.getDay() === 0,
        esFestivo: festivos.has(fechaStr) || fechaObj.getDay() === 0,
        nombreFestivo: festivos.get(fechaStr),
        turno: turnos.get(fechaStr),
        desglose: desgloseDias[fechaStr]
      });
    }

    // Relleno hasta completar la última semana (múltiplo de 7)
    while (dias.length % 7 !== 0) {
      const last = dias[dias.length - 1];
      const lastDate = this.parseIsoDate(last.fecha);
      lastDate.setDate(lastDate.getDate() + 1);
      dias.push(this.crearDiaRelleno(lastDate));
    }

    this.calendario = dias;
  }

  private crearDiaRelleno(fecha: Date): DiaCalendario {
    return {
      fecha: this.toIsoDate(fecha),
      numero: fecha.getDate(),
      esDelMes: false,
      esHoy: false,
      esDomingo: fecha.getDay() === 0,
      esFestivo: false
    };
  }

  // ═══════════════════════════════════════════════════════════
  // SELECCIONAR DÍA Y EDITAR
  // ═══════════════════════════════════════════════════════════

  seleccionarDia(dia: DiaCalendario): void {
    if (!dia.esDelMes) return;
    this.diaSeleccionado = dia;
  }

  abrirEdicion(dia: DiaCalendario): void {
    if (!dia.esDelMes || !this.selectedEmpleado) return;
    this.diaSeleccionado = dia;

    this.editForm = this.emptyEditForm();
    this.editForm.fecha = dia.fecha;

    if (dia.turno) {
      this.editForm.idAsignacion = dia.turno.id;
      this.editForm.esDescanso = !!dia.turno.es_descanso;
      this.editForm.idPlantilla = dia.turno.plantilla?.id ?? null;
      this.editForm.horaInicioOverride = dia.turno.hora_inicio ?? '';
      this.editForm.horaFinOverride = dia.turno.hora_fin ?? '';
      this.editForm.horaInicio2Override = dia.turno.hora_inicio_2 ?? '';
      this.editForm.horaFin2Override = dia.turno.hora_fin_2 ?? '';
      this.editForm.observacion = dia.turno.observacion ?? '';
    }

    this.showEditDialog = true;
  }

  emptyEditForm() {
    return {
      idAsignacion: null as number | null,
      fecha: '',
      idPlantilla: null as number | null,
      esDescanso: false,
      horaInicioOverride: '',
      horaFinOverride: '',
      horaInicio2Override: '',
      horaFin2Override: '',
      observacion: ''
    };
  }

  cerrarEditDialog(): void {
    this.showEditDialog = false;
  }

  /**
   * ELIMINAR TURNO DEL DÍA INDIVIDUAL
   */
  eliminarTurnoDelDia(): void {
    if (!this.editForm.idAsignacion) {
      this.toastWarn('No hay turno para eliminar en este día');
      return;
    }

    if (!confirm(`¿Estás seguro de que deseas eliminar el turno del ${this.editForm.fecha}?`)) {
      return;
    }

    this.isSavingDay = true;
    this.asignacionService.deleteAsignacion(this.editForm.idAsignacion).subscribe({
      next: () => {
        this.isSavingDay = false;
        this.showEditDialog = false;
        this.toastOk('Turno eliminado');
        this.cargarCuadro();
      },
      error: (err) => {
        this.isSavingDay = false;
        const msg = err?.error?.message || 'No se pudo eliminar el turno';
        this.toastError(msg);
      }
    });
  }

  cerrarResumenModal(): void {
    this.showResumenModal = false;
  }

  abrirResumenModal(): void {
    if (!this.selectedEmpleado) {
      this.toastWarn('Selecciona un usuario primero');
      return;
    }
    this.showResumenModal = true;
  }

  mostrarSelectorMesAnio(): void {
    this.mesAnioPanel.toggle(event);
  }

  seleccionarMes(mes: number): void {
    this.selectedMes = mes;
    this.onMesAnioChange();
  }

  seleccionarAnio(anio: number): void {
    this.selectedAnio = anio;
    this.modoSeleccionarAnio = false;
    this.onMesAnioChange();
  }

  toggleModoAnio(): void {
    this.modoSeleccionarAnio = !this.modoSeleccionarAnio;
  }

  onPlantillaChange(): void {
    this.editForm.horaInicioOverride = '';
    this.editForm.horaFinOverride = '';
    this.editForm.horaInicio2Override = '';
    this.editForm.horaFin2Override = '';
  }

  // ═══════════════════════════════════════════════════════════
  // GUARDAR DÍA
  // ═══════════════════════════════════════════════════════════

  guardarDia(): void {
    if (!this.selectedEmpleado || !this.editForm.fecha) return;

    if (!this.editForm.esDescanso && !this.editForm.idPlantilla) {
      this.toastWarn('Selecciona un turno o marca "Descanso"');
      return;
    }

    // VALIDAR QUE TENGAMOS ID_CUADRO ALMACENADO
    if (!this.idCuadroActual) {
      this.toastError('No se pudo obtener el ID del cuadro. Selecciona la unidad nuevamente.');
      return;
    }

    this.isSavingDay = true;
    this.persistirAsignacion(this.idCuadroActual);
  }

  private persistirAsignacion(idCuadro: number): void {
    const payload: any = {
      id_cuadro: idCuadro,
      id_empleado: this.selectedEmpleado,
      fecha: this.editForm.fecha,
      es_descanso: this.editForm.esDescanso,
      id_plantilla: this.editForm.esDescanso ? null : this.editForm.idPlantilla,
      observacion: this.editForm.observacion || null
    };

    if (!this.editForm.esDescanso) {
      if (this.editForm.horaInicioOverride)  payload.hora_inicio_override   = this.editForm.horaInicioOverride;
      if (this.editForm.horaFinOverride)     payload.hora_fin_override      = this.editForm.horaFinOverride;
      if (this.editForm.horaInicio2Override) payload.hora_inicio_override_2 = this.editForm.horaInicio2Override;
      if (this.editForm.horaFin2Override)    payload.hora_fin_override_2    = this.editForm.horaFin2Override;
    }

    const obs$ = this.editForm.idAsignacion
      ? this.asignacionService.updateAsignacion(this.editForm.idAsignacion, payload)
      : this.asignacionService.createAsignacion(payload);

    obs$.subscribe({
      next: () => {
        this.isSavingDay = false;
        this.showEditDialog = false;
        this.toastOk('Día actualizado');
        this.cargarCuadro();
      },
      error: (err) => {
        this.isSavingDay = false;
        const msg = err?.error?.message || 'No se pudo guardar el día';
        this.toastError(msg);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  // UTILITARIOS
  // ═══════════════════════════════════════════════════════════

  formatHoras(h?: number): string {
    const v = Number(h ?? 0);
    return `${v.toFixed(2)} h`;
  }

  trackByFecha(_: number, d: DiaCalendario) { return d.fecha; }

  private toIsoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private parseIsoDate(iso: string): Date {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  private normalizarFecha(f: string): string {
    return (f || '').substring(0, 10);
  }

  refrescarPagina(): void {
    window.location.reload();
  }

  // ═══════════════════════════════════════════════════════════
  // ELIMINAR CUADRO COMPLETO
  // ═══════════════════════════════════════════════════════════

  eliminarCuadroCompleto(): void {
    if (!this.selectedEmpleado) {
      this.toastWarn('Selecciona un empleado primero');
      return;
    }

    if (!confirm(`¿Estás seguro de que deseas eliminar todos los turnos de ${this.selectedMes}/${this.selectedAnio}?\n\nEsta acción no se puede deshacer.`)) {
      return;
    }

    this.isLoading = true;
    this.calculoService
      .deleteCuadroMesEmpleado(this.selectedEmpleado, this.selectedAnio, this.selectedMes)
      .subscribe({
        next: (response) => {
          this.isLoading = false;
          this.toastOk(`${response.data.asignaciones_eliminadas} turnos eliminados`);
          this.cargarCuadro();
        },
        error: () => {
          this.isLoading = false;
          this.toastError('Error al eliminar el cuadro');
        }
      });
  }

  // ═══════════════════════════════════════════════════════════
  // SINCRONIZAR FESTIVOS
  // ═══════════════════════════════════════════════════════════

  sincronizarFestivos(): void {
    if (!confirm('¿Desea sincronizar los festivos desde la API externa? Esto puede tomar unos segundos.')) {
      return;
    }

    this.isLoading = true;
    this.calculoService.sincronizarFestivos(this.selectedAnio)
      .subscribe({
        next: (response) => {
          this.isLoading = false;
          const data = response.data;
          this.toastOk(`Festivos sincronizados: ${data.insertados} nuevos, ${data.actualizados} actualizados`);
          // Recargar festivos después de sincronizar
          this.cargarFestivosYConstruirCalendario();
        },
        error: (err) => {
          this.isLoading = false;
          this.toastError('Error al sincronizar festivos: ' + (err?.error?.message || 'Error desconocido'));
        }
      });
  }

  testConexionAPI(): void {
    this.calculoService.testConexionFestivos()
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.toastOk('✅ Conexión exitosa con API de festivos');
          } else {
            this.toastError('❌ ' + response.message);
          }
        },
        error: (err) => {
          this.toastError('Error de conexión: ' + (err?.error?.message || 'Error desconocido'));
        }
      });
  }

  private toastOk(detail: string)    { this.message.add({ severity: 'success', summary: 'Éxito', detail }); }
  private toastError(detail: string) { this.message.add({ severity: 'error',   summary: 'Error',  detail }); }
  private toastWarn(detail: string)  { this.message.add({ severity: 'warn',    summary: 'Aviso',  detail }); }
  private toastInfo(detail: string)  { this.message.add({ severity: 'info',    summary: 'Info',   detail }); }
}
