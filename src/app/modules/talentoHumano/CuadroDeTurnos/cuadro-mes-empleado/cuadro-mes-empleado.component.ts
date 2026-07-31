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
import { CalendarModule } from 'primeng/calendar';
import { MessageService } from 'primeng/api';

import { CalculoHorasService, CuadroMesEmpleado, DesgloseDia, Festivo } from '../services/calculo-horas.service';
import { PlantillaService, Plantilla } from '../services/plantilla.service';
import { AsignacionService } from '../services/asignacion.service';
import { FrecuenciaService, PrevisualizarResponse } from '../services/frecuencia.service';
import { CargaMasivaService, ImportResult } from '../services/carga-masiva.service';
import { CierreCuadroService } from '../services/cierre-cuadro.service';
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
  turno?: any;              // turno del primer empleado (compatibilidad con abrirEdicion)
  turnosEmpleados?: { idEmpleado: number; nombre: string; turno: any }[]; // turnos de todos los seleccionados
  desglose?: DesgloseDia;
}

@Component({
  selector: 'app-cuadro-mes-empleado',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    ButtonModule, DropdownModule, DialogModule, InputTextModule,
    CheckboxModule, ToastModule, TooltipModule, TagModule, SkeletonModule, OverlayPanelModule, CalendarModule
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

  /** Selección múltiple: hasta 3 empleados */
  selectedEmpleados: number[] = [];

  /** Compatibilidad con el resto del código (calendario, modal resumen, etc.) */
  get selectedEmpleado(): number | null {
    return this.selectedEmpleados[0] ?? null;
  }

  /** Mapa { idEmpleado → { idCuadro, cuadro } } para cada empleado seleccionado */
  cuadrosEmpleados: Map<number, { idCuadro: number | null; cuadro: any }> = new Map();

  // ───── CUADRO ACTUAL ─────
  idCuadroActual: number | null = null;  // Cuadro del primer empleado seleccionado (compatibilidad)
  cuadroBloqueado = false; // Si true, no se permite editar

  mesOptions: { label: string; value: number }[] = [
    { label: 'Enero', value: 1 }, { label: 'Febrero', value: 2 }, { label: 'Marzo', value: 3 },
    { label: 'Abril', value: 4 }, { label: 'Mayo', value: 5 }, { label: 'Junio', value: 6 },
    { label: 'Julio', value: 7 }, { label: 'Agosto', value: 8 }, { label: 'Septiembre', value: 9 },
    { label: 'Octubre', value: 10 }, { label: 'Noviembre', value: 11 }, { label: 'Diciembre', value: 12 }
  ];
  anioOptions: { label: string; value: number }[] = [];
  selectedMes = new Date().getMonth() + 1;
  selectedAnio = new Date().getFullYear();
  mesAnioFecha: Date = new Date();

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

  /** Nombres de los empleados seleccionados para mostrar en UI */
  get nombresSeleccionados(): string {
    if (!this.selectedEmpleados.length) return '';
    return this.selectedEmpleados
      .map(id => this.empleados.find(e => e.id === id)?.nombre?.split(' ')[0] || '...')
      .join(', ');
  }

  constructor(
    private calculoService: CalculoHorasService,
    private plantillaService: PlantillaService,
    private asignacionService: AsignacionService,
    private frecuenciaService: FrecuenciaService,
    private cargaMasivaService: CargaMasivaService,
    private cierreCuadroService: CierreCuadroService,
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

  // ───── Selector de Unidad (overlay) ─────
  showSelectorUnidad = false;
  busquedaUnidad = '';
  busquedaEmpleado = '';
  /** true cuando el usuario seleccionó manualmente una unidad — bloquea la auto-selección */
  private _unidadManualmenteSeleccionada = false;

  get unidadesFiltradas(): any[] {
    if (!this.busquedaUnidad) return this.unidadesResponsable;
    const term = this.busquedaUnidad.toLowerCase();
    return this.unidadesResponsable.filter(u =>
      u.nombre?.toLowerCase().includes(term) ||
      u.empresa?.nombre?.toLowerCase().includes(term) ||
      u.sucursal?.nombre?.toLowerCase().includes(term)
    );
  }

  get empleadosFiltrados(): any[] {
    if (!this.busquedaEmpleado) return this.empleados;
    const term = this.busquedaEmpleado.toLowerCase();
    return this.empleados.filter(e => e.nombre?.toLowerCase().includes(term));
  }

  seleccionarUnidadDesdeTabla(u: any): void {
    this._unidadManualmenteSeleccionada = true;  // ← bloquea auto-selección futura
    this.selectedUnidad = u.id;
    this.unidadActual = u;
    this.showSelectorUnidad = false;
    this.busquedaUnidad = '';
    this.empleados = [];
    this.empleadoOptions = [];
    this.selectedEmpleados = [];
    this.cuadrosEmpleados.clear();
    this.cuadro = null;
    this.diaSeleccionado = null;
    this.idCuadroActual = null;
    this.construirCalendario();
    this.asegurarCuadroUnidad();
    this.cargarEmpleadosUnidad();
  }

  /**
   * Toggle selección de empleado (máx 3).
   * Si ya está seleccionado, lo deselecciona.
   */
  seleccionarEmpleado(emp: any): void {
    const idx = this.selectedEmpleados.indexOf(emp.id);
    if (idx >= 0) {
      // Deseleccionar
      this.selectedEmpleados.splice(idx, 1);
      this.cuadrosEmpleados.delete(emp.id);
    } else {
      if (this.selectedEmpleados.length >= 3) {
        this.toastWarn('Puedes seleccionar máximo 3 empleados');
        return;
      }
      this.selectedEmpleados.push(emp.id);
      this.cargarCuadroEmpleado(emp.id);
    }
    // El calendario muestra el turno del primer seleccionado
    this.cuadro = this.selectedEmpleados.length
      ? (this.cuadrosEmpleados.get(this.selectedEmpleados[0])?.cuadro ?? null)
      : null;
    this.diaSeleccionado = null;
    this.showResumenModal = false;
    this.construirCalendario();
  }

  getIniciales(nombre: string): string {
    if (!nombre) return '??';
    const partes = nombre.split(' ');
    return (partes[0]?.[0] || '') + (partes[1]?.[0] || '');
  }

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
      this.onEmpresaChange();
    }
  }

  cargarUnidadesResponsable(): void { /* ya se cargan en cargarEmpresas */ }

  onEmpresaChange(): void {
    if (!this.selectedEmpresa) return;
    if (this._unidadManualmenteSeleccionada) return;

    this.selectedSucursal = null; this.sedesOptions = []; this.selectedSede = null;
    this.unidadOptions = []; this.selectedUnidad = null;
    this.empleados = []; this.empleadoOptions = []; this.selectedEmpleados = []; this.cuadrosEmpleados.clear();

    if (this.esTransversal) {
      // Transversal: traer TODAS las sucursales de la empresa
      this.http.get<any>(`${environment.URL_SERVICIOS}/sucursales-por-empresa/${this.selectedEmpresa}`).subscribe({
        next: (r) => {
          const sucursales = Array.isArray(r) ? r : (r.data || []);
          this.sucursalesOptions = sucursales.map((s: any) => ({ label: s.nombre, value: s.id }));
          if (this.sucursalesOptions.length >= 1) {
            this.selectedSucursal = this.sucursalesOptions[0].value;
            this.onSucursalChange();
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
        this.onSucursalChange();
      }
    }
  }

  onSucursalChange(): void {
    if (!this.selectedSucursal || !this.selectedEmpresa) return;
    if (this._unidadManualmenteSeleccionada) return;

    this.selectedSede = null; this.unidadOptions = []; this.selectedUnidad = null;
    this.empleados = []; this.empleadoOptions = []; this.selectedEmpleados = []; this.cuadrosEmpleados.clear();

    if (this.esTransversal) {
      // Transversal: traer TODAS las sedes de la sucursal
      this.http.get<any>(`${environment.URL_SERVICIOS}/sedes-por-sucursal/${this.selectedSucursal}`).subscribe({
        next: (r) => {
          const sedes = Array.isArray(r) ? r : (r.data || []);
          this.sedesOptions = sedes.map((s: any) => ({ label: s.nombre, value: s.id }));
          if (this.sedesOptions.length >= 1) {
            this.selectedSede = this.sedesOptions[0].value;
            this.onSedeChange();
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
        this.onSedeChange();
      } else {
        // Sin sedes: mostrar unidades directamente
        this.cargarUnidadesFiltradas(unidadesSuc);
      }
    }
  }

  onSedeChange(): void {
    if (!this.selectedSede) return;
    if (this._unidadManualmenteSeleccionada) return;

    if (this.esTransversal) {
      this.cargarUnidadesPorFiltro();
    } else {
      const unidadesSede = this.unidadesResponsable.filter(u =>
        u.empresa?.id === this.selectedEmpresa
        && u.sucursal?.id === this.selectedSucursal
        && u.sede?.id === this.selectedSede
      );
      this.cargarUnidadesFiltradas(unidadesSede);
    }
  }

  private cargarUnidadesPorFiltro(): void {
    if (this._unidadManualmenteSeleccionada) return;

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

    // Si el usuario ya eligió una unidad manualmente, no resetear ni auto-seleccionar
    if (this._unidadManualmenteSeleccionada) return;

    this.selectedUnidad = null; this.unidadActual = null;
    this.empleados = []; this.empleadoOptions = []; this.selectedEmpleados = []; this.cuadrosEmpleados.clear(); this.cuadro = null;

    if (this.unidadOptions.length >= 1) {
      this.selectedUnidad = this.unidadOptions[0].value;
      this.onUnidadChange();
    }
  }

  onUnidadChange(): void {
    if (!this.selectedUnidad) return;
    const op = this.unidadOptions.find(u => u.value === this.selectedUnidad);
    this.unidadActual = op?.data || null;
    this.empleados = []; this.empleadoOptions = []; this.selectedEmpleados = []; this.cuadrosEmpleados.clear();
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
    // Verificar si el cuadro está bloqueado
    this.cierreCuadroService.verificar(this.unidadActual.id, this.selectedAnio, this.selectedMes).subscribe({
      next: (bloqueado) => { this.cuadroBloqueado = bloqueado; },
      error: () => { this.cuadroBloqueado = false; }
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
    if (this.selectedEmpleados.length) {
      this.selectedEmpleados.forEach(id => this.cargarCuadroEmpleado(id));
    } else {
      this.cuadro = null;
      this.diaSeleccionado = null;
      this.showResumenModal = false;
      this.construirCalendario();
    }
  }

  /**
   * Carga el cuadro de UN empleado y guarda su idCuadro y datos en el mapa.
   *
   * Optimización: si ya tenemos el idCuadro de la unidad (idCuadroActual),
   * lo reutilizamos directamente sin llamar a ensure, evitando una llamada HTTP.
   */
  private cargarCuadroEmpleado(idEmpleado: number): void {
    const entry = this.cuadrosEmpleados.get(idEmpleado) ?? { idCuadro: null, cuadro: null };

    // Si ya tenemos el cuadro de la unidad, reutilizarlo (evita el POST ensure)
    const idCuadroDisponible = entry.idCuadro ?? this.idCuadroActual;

    if (idCuadroDisponible) {
      entry.idCuadro = idCuadroDisponible;
      this.cuadrosEmpleados.set(idEmpleado, entry);
      if (idEmpleado === this.selectedEmpleados[0]) {
        this.idCuadroActual = idCuadroDisponible;
      }
      this._fetchCuadroData(idEmpleado, entry);
    } else {
      // Fallback: ensure por unidad (no por empleado — evita el 422)
      if (this.unidadActual) {
        this.calculoService
          .ensureCuadroUnidad(this.unidadActual.id, this.selectedAnio, this.selectedMes)
          .subscribe({
            next: (response) => {
              entry.idCuadro = response.data.id_cuadro;
              this.cuadrosEmpleados.set(idEmpleado, entry);
              if (idEmpleado === this.selectedEmpleados[0]) {
                this.idCuadroActual = entry.idCuadro;
              }
              this._fetchCuadroData(idEmpleado, entry);
            },
            error: () => { this.isLoading = false; }
          });
      } else {
        this.isLoading = false;
      }
    }
  }

  /** Carga los datos del cuadro-mes para un empleado y actualiza el estado */
  private _fetchCuadroData(idEmpleado: number, entry: { idCuadro: number | null; cuadro: any }): void {
    this.calculoService
      .getCuadroMesEmpleado(idEmpleado, this.selectedAnio, this.selectedMes)
      .subscribe({
        next: data => {
          entry.cuadro = data;
          this.cuadrosEmpleados.set(idEmpleado, entry);
          // Actualizar festivos y cuadro principal desde el primer empleado
          if (idEmpleado === this.selectedEmpleados[0]) {
            this.cuadro = data;
            this.festivosMes = data.festivos || this.festivosMes;
          }
          // Reconstruir siempre — así cada empleado que llega aparece en el calendario
          this.construirCalendario();
          this.isLoading = false;
        },
        error: () => { this.isLoading = false; }
      });
  }

  /**
   * Asegurar que existe un cuadro para el empleado seleccionado
   * @deprecated Usar cargarCuadroEmpleado(id) directamente
   */
  private asegurarCuadroEmpleado(): void {
    if (!this.selectedEmpleado) return;
    this.cargarCuadroEmpleado(this.selectedEmpleado);
  }

  onMesAnioChange(): void {
    // Re-asegurar cuadro de unidad con nuevo mes/año
    if (this.selectedUnidad) {
      this.asegurarCuadroUnidad();
    }
    // Recargar cuadros de todos los empleados seleccionados
    if (this.selectedEmpleados.length) {
      this.cuadrosEmpleados.clear();
      this.selectedEmpleados.forEach(id => this.cargarCuadroEmpleado(id));
    } else {
      this.cargarFestivosYConstruirCalendario();
    }
  }

  // ═══════════════════════════════════════════════════════════
  // CARGAR CUADRO DEL EMPLEADO
  // ═══════════════════════════════════════════════════════════

  cargarCuadro(): void {
    if (!this.selectedEmpleados.length) {
      this.cuadro = null;
      this.diaSeleccionado = null;
      return;
    }
    this.isLoading = true;
    this.cuadrosEmpleados.clear();
    this.selectedEmpleados.forEach(id => this.cargarCuadroEmpleado(id));
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

    // ── Festivos ──
    const festivos = new Map<string, string>();
    const fuenteFestivos = (this.cuadro?.festivos && this.cuadro.festivos.length)
      ? this.cuadro.festivos
      : this.festivosMes;
    (fuenteFestivos || []).forEach(f => festivos.set(this.normalizarFecha(f.fecha), f.nombre));

    // ── Turnos combinados de TODOS los empleados seleccionados ──
    // Map<fecha, { idEmpleado, nombre, turno }[]>
    const turnosPorFecha = new Map<string, { idEmpleado: number; nombre: string; turno: any }[]>();

    this.selectedEmpleados.forEach(idEmpleado => {
      const entry = this.cuadrosEmpleados.get(idEmpleado);
      const cuadroEmp = entry?.cuadro;
      if (!cuadroEmp) return;

      const emp = this.empleados.find(e => e.id === idEmpleado);
      const nombreCorto = emp?.nombre?.split(' ')[0] ?? '?';

      (cuadroEmp.turnos || []).forEach((t: any) => {
        const fecha = this.normalizarFecha(t.fecha);
        if (!turnosPorFecha.has(fecha)) turnosPorFecha.set(fecha, []);
        turnosPorFecha.get(fecha)!.push({ idEmpleado, nombre: nombreCorto, turno: t });
      });
    });

    // Turno del primer empleado para compatibilidad con abrirEdicion (single-employee flow)
    const turnosPrimero = new Map<string, any>();
    if (this.selectedEmpleados.length > 0) {
      const primerCuadro = this.cuadrosEmpleados.get(this.selectedEmpleados[0])?.cuadro;
      (primerCuadro?.turnos || []).forEach((t: any) =>
        turnosPrimero.set(this.normalizarFecha(t.fecha), t)
      );
    }

    // Desglose del primer empleado
    const desgloseDias: { [k: string]: any } = {};
    const primerCuadroDesglose = this.cuadrosEmpleados.get(this.selectedEmpleados[0])?.cuadro
      ?? this.cuadro;
    Object.entries(primerCuadroDesglose?.por_dia || {}).forEach(([k, v]) => {
      desgloseDias[this.normalizarFecha(k)] = v;
    });

    const hoy = this.toIsoDate(new Date());
    const dias: DiaCalendario[] = [];

    // Relleno antes del día 1
    for (let i = 0; i < diaInicioSemana; i++) {
      const fecha = new Date(anio, mes - 1, 1 - (diaInicioSemana - i));
      dias.push(this.crearDiaRelleno(fecha));
    }

    // Días del mes
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
        turno: turnosPrimero.get(fechaStr),
        turnosEmpleados: turnosPorFecha.get(fechaStr) ?? [],
        desglose: desgloseDias[fechaStr]
      });
    }

    // Relleno hasta completar la última semana
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
    this.mostrarHorario1 = false;
    this.mostrarHorario2 = false;
    this.frecuenciaForm = this.emptyFrecuenciaForm();
    this.previsualizacionFrecuencia = null;

    if (dia.turno) {
      this.editForm.idAsignacion = dia.turno.id;
      this.editForm.esDescanso = !!dia.turno.es_descanso;
      this.editForm.idPlantilla = dia.turno.plantilla?.id ?? null;
      this.editForm.horaInicioOverride = dia.turno.hora_inicio ?? '';
      this.editForm.horaFinOverride = dia.turno.hora_fin ?? '';
      this.editForm.horaInicio2Override = dia.turno.hora_inicio_2 ?? '';
      this.editForm.horaFin2Override = dia.turno.hora_fin_2 ?? '';
      this.editForm.observacion = dia.turno.observacion ?? '';
      // Mostrar horarios si tienen override cargado
      this.mostrarHorario1 = !!(this.editForm.horaInicioOverride || this.editForm.horaFinOverride);
      this.mostrarHorario2 = !!(this.editForm.horaInicio2Override || this.editForm.horaFin2Override);
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
      observacion: '',
      tipoRegistro: 'normal' as string,
      horaExtraInicio: '',
      horaExtraFin: '',
      horaExtraInicioH: '',
      horaExtraInicioM: '',
      horaExtraAmpm: 'PM',
      horaExtraFinH: '',
      horaExtraFinM: '',
      horaExtraFinAmpm: 'PM',
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
    if (!this.selectedEmpleados.length) {
      this.toastWarn('Selecciona un usuario primero');
      return;
    }
    this.showResumenModal = true;
  }

  /** Deselecciona todos los empleados */
  limpiarSeleccion(): void {
    this.selectedEmpleados = [];
    this.cuadrosEmpleados.clear();
    this.cuadro = null;
    this.idCuadroActual = null;
    this.diaSeleccionado = null;
    this.showResumenModal = false;
    this.construirCalendario();
  }

  mostrarSelectorMesAnio(event: Event): void {
    // Deprecated: ahora usa p-calendar directo
  }

  seleccionarMes(mes: number): void {
    this.selectedMes = mes;
    this.mesAnioFecha = new Date(this.selectedAnio, mes - 1, 1);
    this.onMesAnioChange();
  }

  seleccionarAnio(anio: number): void {
    this.selectedAnio = anio;
    this.modoSeleccionarAnio = false;
    this.mesAnioFecha = new Date(anio, this.selectedMes - 1, 1);
    this.onMesAnioChange();
  }

  /** Cuando se selecciona desde el p-calendar month picker */
  onMesAnioCalendarChange(): void {
    if (this.mesAnioFecha) {
      this.selectedMes = this.mesAnioFecha.getMonth() + 1;
      this.selectedAnio = this.mesAnioFecha.getFullYear();
      this.onMesAnioChange();
    }
  }

  /** Botón flecha izquierda: mes anterior */
  mesAnterior(): void {
    if (this.selectedMes === 1) {
      this.selectedMes = 12;
      this.selectedAnio--;
    } else {
      this.selectedMes--;
    }
    this.mesAnioFecha = new Date(this.selectedAnio, this.selectedMes - 1, 1);
    this.onMesAnioChange();
  }

  /** Botón flecha derecha: mes siguiente */
  mesSiguiente(): void {
    if (this.selectedMes === 12) {
      this.selectedMes = 1;
      this.selectedAnio++;
    } else {
      this.selectedMes++;
    }
    this.mesAnioFecha = new Date(this.selectedAnio, this.selectedMes - 1, 1);
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
    // Reset toggles de horario libre
    this.mostrarHorario1 = false;
    this.mostrarHorario2 = false;
  }

  // Flags para mostrar/ocultar los horarios override
  mostrarHorario1 = false;
  mostrarHorario2 = false;

  // Exponer Math para usar en templates
  readonly Math = Math;

  /** true si la plantilla seleccionada es "Libre" (permite override de horarios) */
  get esPlantillaLibre(): boolean {
    if (!this.editForm.idPlantilla) return false;
    const p = this.plantillas.find(pl => pl.id === this.editForm.idPlantilla);
    return p?.codigo === 'LIB' || p?.nombre?.toLowerCase() === 'libre';
  }

  toggleHorario1(): void {
    this.mostrarHorario1 = !this.mostrarHorario1;
    if (!this.mostrarHorario1) {
      this.editForm.horaInicioOverride = '';
      this.editForm.horaFinOverride = '';
    }
  }

  toggleHorario2(): void {
    this.mostrarHorario2 = !this.mostrarHorario2;
    if (!this.mostrarHorario2) {
      this.editForm.horaInicio2Override = '';
      this.editForm.horaFin2Override = '';
    }
  }

  /**
   * Calcula la duración en horas entre dos strings HH:MM
   * Soporta turnos nocturnos (cruzan medianoche)
   */
  calcularDuracion(inicio: string, fin: string): number {
    if (!inicio || !fin) return 0;
    const [h1, m1] = inicio.split(':').map(Number);
    const [h2, m2] = fin.split(':').map(Number);
    if (isNaN(h1) || isNaN(h2)) return 0;
    let minutos = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (minutos < 0) minutos += 24 * 60; // cruza medianoche
    return minutos / 60;
  }

  /** Duración total del turno (horario 1 + horario 2 si existe) */
  get duracionTurnoHoras(): number {
    const plantilla = this.plantillas.find(p => p.id === this.editForm.idPlantilla);
    const usarOverride = this.esPlantillaLibre;

    const inicio1 = (usarOverride && this.editForm.horaInicioOverride) ? this.editForm.horaInicioOverride : (plantilla?.hora_inicio || '');
    const fin1    = (usarOverride && this.editForm.horaFinOverride) ? this.editForm.horaFinOverride : (plantilla?.hora_fin || '');
    const inicio2 = (usarOverride && this.editForm.horaInicio2Override) ? this.editForm.horaInicio2Override : (plantilla?.hora_inicio_2 || '');
    const fin2    = (usarOverride && this.editForm.horaFin2Override) ? this.editForm.horaFin2Override : (plantilla?.hora_fin_2 || '');

    const dur1 = this.calcularDuracion(inicio1, fin1);
    const dur2 = inicio2 && fin2 ? this.calcularDuracion(inicio2, fin2) : 0;
    return dur1 + dur2;
  }

  /** Hora de inicio efectiva para mostrar en el reloj */
  get horaInicioEfectiva(): string {
    const plantilla = this.plantillas.find(p => p.id === this.editForm.idPlantilla);
    // Solo usar override si es plantilla Libre
    if (this.esPlantillaLibre && this.editForm.horaInicioOverride) {
      return this.editForm.horaInicioOverride;
    }
    return plantilla?.hora_inicio || '';
  }

  /** Hora de fin efectiva para mostrar en el reloj */
  get horaFinEfectiva(): string {
    const plantilla = this.plantillas.find(p => p.id === this.editForm.idPlantilla);
    if (this.esPlantillaLibre && this.editForm.horaFinOverride) {
      return this.editForm.horaFinOverride;
    }
    return plantilla?.hora_fin || '';
  }

  /** Datos SVG para el reloj grande (viewBox 160x160, r=60) */
  get relojSvgDataLarge(): string {
    const inicio = this.horaInicioEfectiva;
    const fin    = this.horaFinEfectiva;
    if (!inicio || !fin) return '';
    const [h1, m1] = inicio.split(':').map(Number);
    const [h2, m2] = fin.split(':').map(Number);
    if (isNaN(h1) || isNaN(h2)) return '';

    const toAngle = (h: number, m: number) => ((h % 12) + m / 60) * 30;
    const a1 = toAngle(h1, m1);
    let   a2 = toAngle(h2, m2);
    if (a2 <= a1) a2 += 360;

    const polar = (cx: number, cy: number, r: number, deg: number) => {
      const rad = (deg - 90) * Math.PI / 180;
      return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    };
    const p1 = polar(80, 80, 60, a1);
    const p2 = polar(80, 80, 60, a2);
    const large = (a2 - a1) > 180 ? 1 : 0;
    return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A 60 60 0 ${large} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  get relojSvgData(): { arco: string; inicio: string; fin: string; duracion: string; color: string } | null {
    const inicio = this.horaInicioEfectiva;
    const fin = this.horaFinEfectiva;
    if (!inicio || !fin) return null;

    const [h1, m1] = inicio.split(':').map(Number);
    const [h2, m2] = fin.split(':').map(Number);
    if (isNaN(h1) || isNaN(h2)) return null;

    const toAngle = (h: number, m: number) => ((h % 12) + m / 60) * 30; // 360/12 = 30°
    const angleInicio = toAngle(h1, m1);
    let angleFin = toAngle(h2, m2);

    // Si fin <= inicio en el reloj de 12h, dar la vuelta
    if (angleFin <= angleInicio) angleFin += 360;
    const span = angleFin - angleInicio;

    const polarToCartesian = (cx: number, cy: number, r: number, deg: number) => {
      const rad = (deg - 90) * Math.PI / 180;
      return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    };

    const cx = 60, cy = 60, r = 45;
    const p1 = polarToCartesian(cx, cy, r, angleInicio);
    const p2 = polarToCartesian(cx, cy, r, angleFin);
    const largeArc = span > 180 ? 1 : 0;
    const arco = `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;

    const dur = this.duracionTurnoHoras;
    const durStr = dur > 0
      ? `${Math.floor(dur)}h ${Math.round((dur % 1) * 60).toString().padStart(2, '0')}m`
      : '--';

    // Color según duración
    const color = dur <= 4 ? '#10b981' : dur <= 8 ? '#6366f1' : '#f59e0b';

    return { arco, inicio: inicio.substring(0, 5), fin: fin.substring(0, 5), duracion: durStr, color };
  }

  // ═══════════════════════════════════════════════════════════
  // GUARDAR DÍA
  // ═══════════════════════════════════════════════════════════

  guardarDia(): void {
    if (!this.selectedEmpleados.length || !this.editForm.fecha) return;

    if (!this.editForm.esDescanso && !this.editForm.idPlantilla) {
      this.toastWarn('Selecciona un turno o marca "Descanso"');
      return;
    }

    // Si hay frecuencia configurada → generar turnos recurrentes
    if (this.frecuenciaForm.tipo_frecuencia && this.frecuenciaForm.tipo_frecuencia !== 'sin_programacion') {
      this.guardarConFrecuencia();
      return;
    }

    if (!this.idCuadroActual) {
      this.toastError('No se pudo obtener el ID del cuadro. Selecciona la unidad nuevamente.');
      return;
    }

    this.isSavingDay = true;

    if (this.selectedEmpleados.length === 1) {
      // Flujo simple: un solo empleado
      this.persistirAsignacion(this.idCuadroActual);
    } else {
      // Flujo masivo: guardar para todos los seleccionados
      this.persistirAsignacionMasiva();
    }
  }

  /**
   * Guarda el turno del día para todos los empleados seleccionados (hasta 3).
   * Usa el idCuadro de cada empleado del mapa cuadrosEmpleados.
   */
  private persistirAsignacionMasiva(): void {
    const total = this.selectedEmpleados.length;
    let completados = 0;
    let errores = 0;

    this.selectedEmpleados.forEach(idEmpleado => {
      const entry = this.cuadrosEmpleados.get(idEmpleado);
      const idCuadro = entry?.idCuadro;

      if (!idCuadro) {
        errores++;
        completados++;
        if (completados === total) this.finalizarGuardadoMasivo(errores, total);
        return;
      }

      const payload: any = {
        id_cuadro: idCuadro,
        id_empleado: idEmpleado,
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

      // Buscar si ya tiene asignación ese día (para hacer PUT en vez de POST)
      const cuadroData = entry?.cuadro;
      const turnoExistente = cuadroData?.turnos?.find((t: any) =>
        this.normalizarFecha(t.fecha) === this.editForm.fecha
      );
      const obs$ = turnoExistente?.id
        ? this.asignacionService.updateAsignacion(turnoExistente.id, payload)
        : this.asignacionService.createAsignacion(payload);

      obs$.subscribe({
        next: () => {
          completados++;
          if (completados === total) this.finalizarGuardadoMasivo(errores, total);
        },
        error: () => {
          errores++;
          completados++;
          if (completados === total) this.finalizarGuardadoMasivo(errores, total);
        }
      });
    });
  }

  private finalizarGuardadoMasivo(errores: number, total: number): void {
    this.isSavingDay = false;
    this.showEditDialog = false;
    if (errores === 0) {
      this.toastOk(`Turno asignado a ${total} empleado${total > 1 ? 's' : ''}`);
    } else {
      this.toastWarn(`${total - errores} de ${total} turnos guardados. Verifica los demás.`);
    }
    this.cargarCuadro();
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
        // Si hay hora extra registrada, guardarla también
        if (this.editForm.tipoRegistro === 'hora_extra' && this.editForm.horaExtraInicioH && this.editForm.horaExtraFinH) {
          this.guardarHoraExtra();
        } else {
          this.isSavingDay = false;
          this.showEditDialog = false;
          this.toastOk('Día actualizado');
          this.cargarCuadro();
        }
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

  /** Guarda la hora extra registrada en el modal */
  private guardarHoraExtra(): void {
    // Convertir 12h a 24h
    const convertir12a24 = (h: string, m: string, ampm: string): string => {
      let hour = parseInt(h || '0', 10);
      const min = parseInt(m || '0', 10);
      if (ampm === 'PM' && hour < 12) hour += 12;
      if (ampm === 'AM' && hour === 12) hour = 0;
      return `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
    };

    const horaInicio = convertir12a24(this.editForm.horaExtraInicioH, this.editForm.horaExtraInicioM, this.editForm.horaExtraAmpm);
    const horaFin = convertir12a24(this.editForm.horaExtraFinH, this.editForm.horaExtraFinM, this.editForm.horaExtraFinAmpm);

    const payload = {
      id_empleado: this.selectedEmpleado,
      id_cuadro: this.idCuadroActual,
      fecha: this.editForm.fecha,
      hora_inicio: horaInicio,
      hora_fin: horaFin,
      tipo: 'hora_extra',
      motivo: this.editForm.observacion || null,
    };

    this.http.post<any>(`${environment.URL_SERVICIOS}/turnos/horas-extras`, payload).subscribe({
      next: () => {
        this.isSavingDay = false;
        this.showEditDialog = false;
        this.toastOk('Turno + hora extra guardados');
        this.cargarCuadro();
      },
      error: () => {
        this.isSavingDay = false;
        this.showEditDialog = false;
        this.toastWarn('Turno guardado, pero error al registrar hora extra');
        this.cargarCuadro();
      }
    });
  }

  /** Calcula el porcentaje de progreso de la jornada (total / max * 100) */
  getProgresoJornada(): number {
    if (!this.cuadro?.jornada_max?.horas_max_mes || !this.cuadro?.totales?.total) return 0;
    const pct = (this.cuadro.totales.total / this.cuadro.jornada_max.horas_max_mes) * 100;
    return Math.min(pct, 100);
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
    if (!this.selectedEmpleados.length) {
      this.toastWarn('Selecciona al menos un empleado primero');
      return;
    }

    const nombres = this.nombresSeleccionados;
    if (!confirm(`¿Estás seguro de que deseas eliminar todos los turnos de ${this.selectedMes}/${this.selectedAnio} para: ${nombres}?\n\nEsta acción no se puede deshacer.`)) {
      return;
    }

    this.isLoading = true;
    let completados = 0;
    const total = this.selectedEmpleados.length;

    this.selectedEmpleados.forEach(idEmpleado => {
      this.calculoService
        .deleteCuadroMesEmpleado(idEmpleado, this.selectedAnio, this.selectedMes)
        .subscribe({
          next: () => {
            completados++;
            if (completados === total) {
              this.isLoading = false;
              this.toastOk('Turnos eliminados correctamente');
              this.cargarCuadro();
            }
          },
          error: () => {
            completados++;
            if (completados === total) {
              this.isLoading = false;
              this.toastError('Error al eliminar algunos cuadros');
              this.cargarCuadro();
            }
          }
        });
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
          const data = response.data as any;
          this.toastOk(`Festivos sincronizados: ${data?.insertados ?? 0} nuevos, ${data?.actualizados ?? 0} actualizados`);
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

  // ═══════════════════════════════════════════════════════════
  // FRECUENCIA — Programación recurrente de turnos
  // ═══════════════════════════════════════════════════════════

  /** Opciones para el dropdown de tipo de frecuencia */
  tipoFrecuenciaOptions = [
    { label: 'Sin programación', value: 'sin_programacion' },
    { label: 'Por número de días', value: 'por_numero_dias' },
    { label: 'Por días de la semana', value: 'por_dias_semana' },
    { label: 'Días del mes', value: 'dias_del_mes' },
  ];

  /** Checkboxes de días de la semana */
  diasSemanaCheckboxes = [
    { label: 'Dom', value: 0 },
    { label: 'Lun', value: 1 },
    { label: 'Mar', value: 2 },
    { label: 'Mié', value: 3 },
    { label: 'Jue', value: 4 },
    { label: 'Vie', value: 5 },
    { label: 'Sáb', value: 6 },
  ];

  /** Opciones de días del mes (1-31) */
  diasMesOpciones: number[] = Array.from({ length: 31 }, (_, i) => i + 1);

  /** Formulario de frecuencia */
  frecuenciaForm = this.emptyFrecuenciaForm();

  /** Estado de generación */
  isGenerandoFrecuencia = false;

  /** Resultado de previsualización */
  previsualizacionFrecuencia: PrevisualizarResponse | null = null;

  emptyFrecuenciaForm() {
    return {
      tipo_frecuencia: 'sin_programacion' as string,
      cada_n_dias: 1,
      dias_semana: [] as number[],
      dias_mes: [] as number[],
      fecha_inicio: '',
      fecha_fin: '',
      incluir_festivos: false,
      incluir_dominicales: false,
    };
  }

  /** Reset al cambiar tipo de frecuencia */
  onTipoFrecuenciaChange(): void {
    this.frecuenciaForm.cada_n_dias = 1;
    this.frecuenciaForm.dias_semana = [];
    this.frecuenciaForm.dias_mes = [];
    this.previsualizacionFrecuencia = null;
  }

  /** Toggle un día de la semana en el array */
  toggleDiaSemana(dia: number): void {
    const idx = this.frecuenciaForm.dias_semana.indexOf(dia);
    if (idx >= 0) {
      this.frecuenciaForm.dias_semana.splice(idx, 1);
    } else {
      this.frecuenciaForm.dias_semana.push(dia);
    }
    this.previsualizacionFrecuencia = null;
  }

  /** Toggle un día del mes en el array */
  toggleDiaMes(dia: number): void {
    const idx = this.frecuenciaForm.dias_mes.indexOf(dia);
    if (idx >= 0) {
      this.frecuenciaForm.dias_mes.splice(idx, 1);
    } else {
      this.frecuenciaForm.dias_mes.push(dia);
    }
    this.previsualizacionFrecuencia = null;
  }

  /** Previsualizar las fechas que se generarían (uso interno/futuro) */
  previsualizarFrecuencia(): void {
    // Método mantenido por compatibilidad pero no se expone en UI
  }

  /** @deprecated Usar guardarConFrecuencia() vía "Guardar cambios" */
  generarFrecuencia(): void {
    this.guardarConFrecuencia();
  }

  /** Guardar con frecuencia: genera turnos recurrentes desde el botón "Guardar cambios" */
  private guardarConFrecuencia(): void {
    if (!this.validarFrecuenciaForm()) return;
    if (!this.selectedEmpleados.length) {
      this.toastWarn('Selecciona al menos un empleado');
      return;
    }
    if (!this.editForm.idPlantilla && !this.editForm.esDescanso) {
      this.toastWarn('Selecciona un turno/plantilla primero');
      return;
    }

    this.isSavingDay = true;
    this.isGenerandoFrecuencia = true;

    const total = this.selectedEmpleados.length;
    let completados = 0;
    let totalOk = 0;
    let totalErr = 0;

    this.selectedEmpleados.forEach(idEmpleado => {
      this.frecuenciaService.generarDirecto({
        id_empleado: idEmpleado,
        id_plantilla: this.editForm.idPlantilla!,
        tipo_frecuencia: this.frecuenciaForm.tipo_frecuencia as any,
        cada_n_dias: this.frecuenciaForm.cada_n_dias,
        dias_semana: this.frecuenciaForm.dias_semana.length ? this.frecuenciaForm.dias_semana : undefined,
        dias_mes: this.frecuenciaForm.dias_mes.length ? this.frecuenciaForm.dias_mes : undefined,
        fecha_inicio: this.frecuenciaForm.fecha_inicio,
        fecha_fin: this.frecuenciaForm.fecha_fin,
        incluir_festivos: this.frecuenciaForm.incluir_festivos,
        incluir_dominicales: this.frecuenciaForm.incluir_festivos, // mismo valor
        es_descanso: this.editForm.esDescanso,
        hora_inicio_override: this.editForm.horaInicioOverride || null,
        hora_fin_override: this.editForm.horaFinOverride || null,
        observacion: this.editForm.observacion || undefined,
      }).subscribe({
        next: (res) => {
          completados++;
          totalOk += res?.data?.total_ok ?? 0;
          totalErr += res?.data?.total_err ?? 0;
          if (completados === total) this.finalizarGeneracionFrecuencia(totalOk, totalErr);
        },
        error: (err) => {
          completados++;
          totalErr++;
          if (completados === total) this.finalizarGeneracionFrecuencia(totalOk, totalErr);
        }
      });
    });
  }

  private finalizarGeneracionFrecuencia(ok: number, err: number): void {
    this.isGenerandoFrecuencia = false;
    this.isSavingDay = false;
    this.showEditDialog = false;
    if (err === 0) {
      this.toastOk(`${ok} turnos generados exitosamente`);
    } else {
      this.toastWarn(`${ok} turnos generados, ${err} con error`);
    }
    // Recargar el cuadro
    this.cargarCuadro();
  }

  /** Validación básica del formulario de frecuencia */
  private validarFrecuenciaForm(): boolean {
    if (!this.frecuenciaForm.tipo_frecuencia || this.frecuenciaForm.tipo_frecuencia === 'sin_programacion') {
      this.toastWarn('Selecciona un tipo de frecuencia');
      return false;
    }
    if (!this.frecuenciaForm.fecha_inicio || !this.frecuenciaForm.fecha_fin) {
      this.toastWarn('Indica las fechas de inicio y fin');
      return false;
    }
    if (this.frecuenciaForm.fecha_fin < this.frecuenciaForm.fecha_inicio) {
      this.toastWarn('La fecha fin debe ser posterior a la fecha inicio');
      return false;
    }
    if (this.frecuenciaForm.tipo_frecuencia === 'por_dias_semana' && !this.frecuenciaForm.dias_semana.length) {
      this.toastWarn('Selecciona al menos un día de la semana');
      return false;
    }
    if (this.frecuenciaForm.tipo_frecuencia === 'dias_del_mes' && !this.frecuenciaForm.dias_mes.length) {
      this.toastWarn('Selecciona al menos un día del mes');
      return false;
    }
    return true;
  }

  // ═══════════════════════════════════════════════════════════
  // CARGA MASIVA — Excel
  // ═══════════════════════════════════════════════════════════

  showCargaMasivaDialog = false;
  archivoSeleccionado: File | null = null;
  isImporting = false;
  resultadoImportacion: { exitosas: number; errores: { fila: number; mensaje: string }[] } | null = null;

  /** Descarga el formato Excel pre-llenado */
  descargarFormatoExcel(): void {
    if (!this.selectedUnidad) {
      this.toastWarn('Selecciona una unidad funcional primero');
      return;
    }
    this.cargaMasivaService.descargarFormato(this.selectedUnidad, this.selectedAnio, this.selectedMes);
    this.toastOk('Descargando formato...');
  }

  /** Evento cuando el usuario selecciona un archivo */
  onArchivoSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.archivoSeleccionado = input.files[0];
      this.resultadoImportacion = null;
    }
  }

  /** Elimina el archivo seleccionado */
  eliminarArchivoSeleccionado(): void {
    this.archivoSeleccionado = null;
    this.resultadoImportacion = null;
  }

  /** Ejecuta la importación del archivo */
  ejecutarImportacion(): void {
    if (!this.archivoSeleccionado || !this.selectedUnidad) return;

    this.isImporting = true;
    this.resultadoImportacion = null;

    this.cargaMasivaService.importar(
      this.archivoSeleccionado,
      this.selectedUnidad,
      this.selectedAnio,
      this.selectedMes
    ).subscribe({
      next: (res) => {
        this.isImporting = false;
        this.resultadoImportacion = res.data || { exitosas: 0, errores: [] };

        if (this.resultadoImportacion!.exitosas > 0) {
          this.toastOk(`${this.resultadoImportacion!.exitosas} turnos importados`);
          this.cargarCuadro();
        }
        if (this.resultadoImportacion!.errores?.length) {
          this.toastWarn(`${this.resultadoImportacion!.errores.length} errores encontrados`);
        }
      },
      error: (err) => {
        this.isImporting = false;
        this.toastError(err?.error?.message || 'Error al importar archivo');
      }
    });
  }

  /** Cierra el dialog de carga masiva */
  cerrarCargaMasiva(): void {
    this.showCargaMasivaDialog = false;
    this.archivoSeleccionado = null;
    this.resultadoImportacion = null;
  }
}
