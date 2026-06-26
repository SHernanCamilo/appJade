import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { environment } from '../../../../environments/environment';

/**
 * CUADRO GRILLA — Vista de planificación mensual grupal
 * 
 * Muestra una tabla: Filas = Empleados, Columnas = Días del mes
 * Cada celda muestra el turno asignado (código/color de plantilla o "D" si es descanso)
 * 
 * Flujo: Empresa → Sucursal → Sede → Unidad Funcional → Grilla de todos los empleados
 * 
 * Usa los mismos endpoints que cuadro-mes-empleado para filtros,
 * y luego carga los turnos de TODOS los empleados de la unidad.
 */
@Component({
  selector: 'app-cuadro-grilla',
  standalone: true,
  imports: [
    CommonModule, RouterModule, FormsModule,
    ButtonModule, DropdownModule, ToastModule, TooltipModule, SkeletonModule
  ],
  providers: [MessageService],
  templateUrl: './cuadro-grilla.component.html',
  styleUrl: './cuadro-grilla.component.css'
})
export class CuadroGrillaComponent implements OnInit {

  // ───── Filtros ─────
  empresasOptions: any[] = [];
  selectedEmpresa: number | null = null;

  sucursalesOptions: any[] = [];
  selectedSucursal: number | null = null;

  sedesOptions: any[] = [];
  selectedSede: number | null = null;

  unidadOptions: any[] = [];
  selectedUnidad: number | null = null;

  // ───── Control de acceso ─────
  esTransversal = false;
  unidadesResponsable: any[] = [];

  // ───── Mes/Año ─────
  mesOptions = [
    { label: 'Enero', value: 1 }, { label: 'Febrero', value: 2 }, { label: 'Marzo', value: 3 },
    { label: 'Abril', value: 4 }, { label: 'Mayo', value: 5 }, { label: 'Junio', value: 6 },
    { label: 'Julio', value: 7 }, { label: 'Agosto', value: 8 }, { label: 'Septiembre', value: 9 },
    { label: 'Octubre', value: 10 }, { label: 'Noviembre', value: 11 }, { label: 'Diciembre', value: 12 }
  ];
  anioOptions: { label: string; value: number }[] = [];
  selectedMes = new Date().getMonth() + 1;
  selectedAnio = new Date().getFullYear();

  // ───── Grilla ─────
  empleados: any[] = [];
  diasMes: number[] = [];
  isLoading = false;

  constructor(
    private http: HttpClient,
    private message: MessageService
  ) {}

  /**
   * Inicializa opciones de año y carga datos según el rol del usuario
   */
  ngOnInit(): void {
    const y = new Date().getFullYear();
    for (let i = y - 1; i <= y + 1; i++) this.anioOptions.push({ label: String(i), value: i });
    this.cargarDatosIniciales();
  }

  // ═══════════════════════════════════════════════════════════
  // CARGA INICIAL — Empresas según rol
  // ═══════════════════════════════════════════════════════════

  /**
   * Carga las unidades del usuario para determinar acceso,
   * luego carga empresas según si es transversal o limitado.
   */
  private cargarDatosIniciales(): void {
    this.http.get<any>(`${environment.URL_SERVICIOS}/turnos/unidades-funcionales/del-usuario`).subscribe({
      next: (response) => {
        this.unidadesResponsable = response.data || [];
        const accessLevel = response.access_level;
        this.esTransversal = (accessLevel === 'super_admin' || accessLevel === 'transversal');

        // Cargar empresas según rol
        this.http.get<any>(`${environment.URL_SERVICIOS}/contexto/empresas-disponibles`).subscribe({
          next: (empResponse) => {
            const empresas = empResponse.data || empResponse || [];
            if (Array.isArray(empresas) && empresas.length > 0) {
              this.empresasOptions = empresas.map((e: any) => ({ label: e.nombre, value: e.id }));
            } else if (this.esTransversal) {
              this.http.get<any>(`${environment.URL_SERVICIOS}/empresas-activas`).subscribe({
                next: (r) => {
                  this.empresasOptions = (r.data || []).map((e: any) => ({ label: e.nombre, value: e.id }));
                  this.autoSeleccionarEmpresa();
                }
              });
              return;
            }
            this.autoSeleccionarEmpresa();
          }
        });
      },
      error: () => this.toast('error', 'Error al cargar datos')
    });
  }

  /**
   * Selecciona automáticamente la primera empresa si hay opciones
   */
  private autoSeleccionarEmpresa(): void {
    if (this.empresasOptions.length >= 1) {
      this.selectedEmpresa = this.empresasOptions[0].value;
      setTimeout(() => this.onEmpresaChange(), 100);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // CASCADA DE FILTROS
  // ═══════════════════════════════════════════════════════════

  /**
   * Cuando cambia la empresa: carga sucursales
   * - Transversal: todas las sucursales de la empresa
   * - Limitado: solo las de sus unidades asignadas
   */
  onEmpresaChange(): void {
    if (!this.selectedEmpresa) return;
    this.selectedSucursal = null; this.sedesOptions = []; this.selectedSede = null;
    this.unidadOptions = []; this.selectedUnidad = null; this.empleados = [];

    if (this.esTransversal) {
      this.http.get<any>(`${environment.URL_SERVICIOS}/sucursales-por-empresa/${this.selectedEmpresa}`).subscribe({
        next: (r) => {
          this.sucursalesOptions = (Array.isArray(r) ? r : (r.data || [])).map((s: any) => ({ label: s.nombre, value: s.id }));
          if (this.sucursalesOptions.length >= 1) {
            this.selectedSucursal = this.sucursalesOptions[0].value;
            setTimeout(() => this.onSucursalChange(), 100);
          }
        }
      });
    } else {
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

  /**
   * Cuando cambia la sucursal: carga sedes
   * Si no hay sedes, carga unidades directamente
   */
  onSucursalChange(): void {
    if (!this.selectedSucursal) return;
    this.selectedSede = null; this.unidadOptions = []; this.selectedUnidad = null; this.empleados = [];

    if (this.esTransversal) {
      this.http.get<any>(`${environment.URL_SERVICIOS}/sedes-por-sucursal/${this.selectedSucursal}`).subscribe({
        next: (r) => {
          this.sedesOptions = (Array.isArray(r) ? r : (r.data || [])).map((s: any) => ({ label: s.nombre, value: s.id }));
          if (this.sedesOptions.length >= 1) {
            this.selectedSede = this.sedesOptions[0].value;
            setTimeout(() => this.onSedeChange(), 100);
          } else {
            this.cargarUnidades();
          }
        }
      });
    } else {
      const unidadesSuc = this.unidadesResponsable.filter(u => u.empresa?.id === this.selectedEmpresa && u.sucursal?.id === this.selectedSucursal);
      const sedeMap = new Map<number, any>();
      unidadesSuc.forEach((u: any) => { if (u.sede) sedeMap.set(u.sede.id, u.sede); });
      this.sedesOptions = Array.from(sedeMap.values()).map(s => ({ label: s.nombre, value: s.id }));
      if (this.sedesOptions.length >= 1) {
        this.selectedSede = this.sedesOptions[0].value;
        setTimeout(() => this.onSedeChange(), 100);
      } else {
        this.unidadOptions = unidadesSuc.map(u => ({ label: u.nombre, value: u.id }));
        if (this.unidadOptions.length >= 1) {
          this.selectedUnidad = this.unidadOptions[0].value;
          setTimeout(() => this.cargarGrilla(), 100);
        }
      }
    }
  }

  /**
   * Cuando cambia la sede: carga unidades funcionales de esa sede
   */
  onSedeChange(): void {
    if (!this.selectedSede) return;

    if (this.esTransversal) {
      this.cargarUnidades();
    } else {
      const unidadesSede = this.unidadesResponsable.filter(u =>
        u.empresa?.id === this.selectedEmpresa && u.sucursal?.id === this.selectedSucursal && u.sede?.id === this.selectedSede
      );
      this.unidadOptions = unidadesSede.map(u => ({ label: u.nombre, value: u.id }));
      if (this.unidadOptions.length >= 1) {
        this.selectedUnidad = this.unidadOptions[0].value;
        setTimeout(() => this.cargarGrilla(), 100);
      }
    }
  }

  /**
   * Carga unidades funcionales desde el backend (para transversal)
   */
  private cargarUnidades(): void {
    const params: any = { id_empresa: this.selectedEmpresa };
    if (this.selectedSucursal) params.id_sucursal = this.selectedSucursal;
    if (this.selectedSede) params.id_sede = this.selectedSede;

    this.http.get<any>(`${environment.URL_SERVICIOS}/turnos/unidades-funcionales`, { params }).subscribe({
      next: (r) => {
        this.unidadOptions = (r.data || []).map((u: any) => ({ label: u.nombre, value: u.id }));
        if (this.unidadOptions.length >= 1) {
          this.selectedUnidad = this.unidadOptions[0].value;
          setTimeout(() => this.cargarGrilla(), 100);
        }
      }
    });
  }

  /**
   * Cuando cambia la unidad: recarga la grilla
   */
  onUnidadChange(): void {
    if (this.selectedUnidad) this.cargarGrilla();
  }

  /**
   * Cuando cambia mes o año: recarga la grilla
   */
  onMesAnioChange(): void {
    if (this.selectedUnidad) this.cargarGrilla();
  }

  // ═══════════════════════════════════════════════════════════
  // GRILLA — Cargar todos los empleados y sus turnos
  // ═══════════════════════════════════════════════════════════

  /**
   * Carga la grilla completa:
   * 1. Obtiene empleados de la unidad funcional (pivote)
   * 2. Para cada empleado, obtiene sus turnos del mes
   * 3. Construye la estructura: empleado.dias[1..31] = turno
   */
  cargarGrilla(): void {
    if (!this.selectedUnidad) return;

    this.isLoading = true;
    this.empleados = [];

    // Calcular días del mes
    const diasEnMes = new Date(this.selectedAnio, this.selectedMes, 0).getDate();
    this.diasMes = Array.from({ length: diasEnMes }, (_, i) => i + 1);

    // 1. Cargar empleados de la unidad
    this.http.get<any>(`${environment.URL_SERVICIOS}/turnos/unidades-funcionales/${this.selectedUnidad}/empleados`).subscribe({
      next: (response) => {
        const empleadosBase = response.data || [];

        if (empleadosBase.length === 0) {
          this.isLoading = false;
          this.toast('info', 'No hay empleados en esta unidad');
          return;
        }

        // 2. Para cada empleado, cargar sus turnos del mes
        let completados = 0;
        this.empleados = empleadosBase.map((emp: any) => ({ ...emp, dias: {} }));

        this.empleados.forEach((emp: any, index: number) => {
          this.http.get<any>(`${environment.URL_SERVICIOS}/turnos/empleados/${emp.id}/cuadro-mes`, {
            params: { mes: this.selectedMes.toString(), anio: this.selectedAnio.toString() }
          }).subscribe({
            next: (cuadroResp) => {
              const turnos = cuadroResp.data?.turnos || [];
              // Indexar por día
              turnos.forEach((t: any) => {
                const dia = new Date(t.fecha + 'T00:00:00').getDate();
                this.empleados[index].dias[dia] = {
                  es_descanso: t.es_descanso,
                  plantilla: t.plantilla
                };
              });
              completados++;
              if (completados === this.empleados.length) this.isLoading = false;
            },
            error: () => {
              completados++;
              if (completados === this.empleados.length) this.isLoading = false;
            }
          });
        });
      },
      error: () => {
        this.isLoading = false;
        this.toast('error', 'Error al cargar empleados');
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  // UTILIDADES DE CELDA — Obtener datos del turno para la vista
  // ═══════════════════════════════════════════════════════════

  /**
   * Obtiene el objeto turno de un empleado en un día específico
   * @returns null si no hay turno asignado
   */
  getTurno(empleado: any, dia: number): any {
    return empleado.dias?.[dia] || null;
  }

  /**
   * Retorna la etiqueta corta para mostrar en la celda:
   * - "D" si es descanso
   * - Primeras 3 letras del nombre de la plantilla si tiene turno
   * - Vacío si no hay nada
   */
  getTurnoLabel(empleado: any, dia: number): string {
    const turno = this.getTurno(empleado, dia);
    if (!turno) return '';
    if (turno.es_descanso) return 'D';
    return turno.plantilla?.nombre?.substring(0, 3) || 'T';
  }

  /**
   * Retorna el color hex de la plantilla para colorear la celda
   * - Gris si es descanso
   * - Color de la plantilla si tiene turno
   * - Vacío si no hay nada
   */
  getTurnoColor(empleado: any, dia: number): string {
    const turno = this.getTurno(empleado, dia);
    if (!turno) return '';
    if (turno.es_descanso) return '#94a3b8';
    return turno.plantilla?.color_hex || '#6366f1';
  }

  /**
   * Retorna el nombre del mes seleccionado para mostrar en el header
   */
  getNombreMes(): string {
    return this.mesOptions[this.selectedMes - 1]?.label || '';
  }

  // ═══════════════════════════════════════════════════════════
  // UTILIDADES
  // ═══════════════════════════════════════════════════════════

  private toast(severity: string, detail: string): void {
    this.message.add({ severity, summary: severity === 'error' ? 'Error' : 'Info', detail });
  }
}
