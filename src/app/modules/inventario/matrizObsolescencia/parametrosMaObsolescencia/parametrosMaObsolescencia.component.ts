import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PermissionService } from '../../../../core/services/permission.service';
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';

// PrimeNG Imports
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TabViewModule } from 'primeng/tabview';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DropdownModule } from 'primeng/dropdown';
import { CheckboxModule } from 'primeng/checkbox';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { AvatarModule } from 'primeng/avatar';
import { SkeletonModule } from 'primeng/skeleton';
import { FormsModule } from '@angular/forms';

// Services
import { MatrizObsParametrosService, GrupoParametro, Parametro } from '../services/matriz-obs-parametros.service';
import { MatrizObsAgentesService, MatrizObsAgente } from '../services/matriz-obs-agentes.service';
import { EmpresaService, Empresa } from '../../../organizacion/empresa/services/empresa.service';
import { SucursalService, Sucursal } from '../../../organizacion/empresa/services/sucursal.service';
import { SedeService, Sede } from '../../../organizacion/empresa/services/sede.service';

interface TipoEquipo {
  id: number;
  tipo: string;
  vidaUtil: number;
  frecuencia: string;
}

interface RangoEdad {
  id: number;
  rango: string;
  puntaje: number;
}

interface CaracteristicaMinima {
  id: number;
  nombre: string;
  valor: string | number;
}

interface ConceptoPuntaje {
  id: number;
  puntaje: string;
  concepto: string;
  color: string;
  textColor: string;
}

interface Procesador {
  id?: number;
  nombre: string;
  anio_lanzamiento: number | null;
}

@Component({
  selector: 'app-parametros-ma-obsolescencia',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule,
    FormsModule,
    ButtonModule,
    ToastModule,
    TabViewModule,
    InputTextModule,
    InputNumberModule,
    DropdownModule,
    CheckboxModule,
    TableModule,
    DialogModule,
    TooltipModule,
    AvatarModule,
    SkeletonModule,
    HasPermissionDirective
  ],
  providers: [MessageService],
  templateUrl: './parametrosMaObsolescencia.component.html',
  styleUrl: './parametrosMaObsolescencia.component.css'
})
export class ParametrosMaObsolescenciaComponent implements OnInit {
  
  // Parámetros Generales
  parametrosGenerales = {
    diasAlerta: 90,
    diasCritico: 30,
    porcentajeObsolescencia: 75,
    habilitarNotificaciones: true,
    frecuenciaAnalisis: 'mensual'
  };

  // Parámetros Agentes
  parametrosAgentes = {
    tiempoRespuestaMax: 48,
    capacidadMaxAgentes: 100,
    prioridadAlta: true,
    asignacionAutomatica: true,
    tipoAsignacion: 'round-robin'
  };

  // Tipos de Equipos
  tiposEquipos: TipoEquipo[] = [];

  // Rangos de Edad
  rangosEdad: RangoEdad[] = [];

  // Características Mínimas
  caracteristicasMinimas: CaracteristicaMinima[] = [];

  // Conceptos de Puntaje
  conceptosPuntaje: ConceptoPuntaje[] = [];

  // Agentes
  agentes: MatrizObsAgente[] = [];

  // Procesadores
  procesadores: Procesador[] = [];
  procesadoresFiltrados: Procesador[] = [];
  busquedaProcesador: string = '';
  isLoadingProcesadores: boolean = false;

  todosParametros: Parametro[] = [];
  
  // Estado de cálculos
  calculandoValores: boolean = false;
  
  // Estados de carga
  isLoadingParametros: boolean = false;
  isLoadingAgentes: boolean = false;

  // Opciones para dropdowns de agentes
  empresasOptions: Empresa[] = [];
  sucursalesOptions: Sucursal[] = [];
  sedesOptions: Sede[] = [];

  // Dialog para agregar/editar
  displayDialog: boolean = false;
  displayDialogRango: boolean = false;
  displayDialogCaracteristica: boolean = false;
  displayDialogConcepto: boolean = false;
  displayDialogAgente: boolean = false;
  displayDialogProcesador: boolean = false;
  
  equipoSeleccionado: TipoEquipo = { id: 0, tipo: '', vidaUtil: 0, frecuencia: '' };
  rangoSeleccionado: RangoEdad = { id: 0, rango: '', puntaje: 0 };
  caracteristicaSeleccionada: CaracteristicaMinima = { id: 0, nombre: '', valor: '' };
  conceptoSeleccionado: ConceptoPuntaje = { id: 0, puntaje: '', concepto: '', color: '', textColor: '' };
  agenteSeleccionado: MatrizObsAgente = { tag: '', nomenclatura: '', id_empresa: 0, id_sucursal: 0, id_sede: 0 };
  procesadorSeleccionado: Procesador = { nombre: '', anio_lanzamiento: null };
  
  esNuevo: boolean = true;

  frecuenciaOpciones = [
    { label: 'Diario', value: 'diario' },
    { label: 'Semanal', value: 'semanal' },
    { label: 'Mensual', value: 'mensual' },
    { label: 'Trimestral', value: 'trimestral' }
  ];

  frecuenciaEquipoOpciones = [
    { label: 'Mensual', value: 'Mensual' },
    { label: 'Trimestral', value: 'Trimestral' },
    { label: 'Semestral', value: 'Semestral' },
    { label: 'Anual', value: 'Anual' }
  ];

  tipoAsignacionOpciones = [
    { label: 'Round Robin', value: 'round-robin' },
    { label: 'Por Carga', value: 'por-carga' },
    { label: 'Por Especialidad', value: 'por-especialidad' },
    { label: 'Manual', value: 'manual' }
  ];

  constructor(
    private messageService: MessageService,
    private matrizService: MatrizObsParametrosService,
    private agentesService: MatrizObsAgentesService,
    private empresaService: EmpresaService,
    private sucursalService: SucursalService,
    private sedeService: SedeService,
    public permissionService: PermissionService
  ) {}

  // Métodos de verificación de permisos
  canRecalcularSoloNuevos(): boolean {
    return this.permissionService.hasPermission('inv-matriz-paramatriz-recalculando-solo-nuevos');
  }
  // Métodos de verificación de permisos
  canRecalcularTodos(): boolean {
    return this.permissionService.hasPermission('inv-matriz-paramatriz-recalculando-todos');
  }
  canParametrosActivosEditar(): boolean {
    return this.permissionService.hasPermission('inv-matriz-parametros-de-activos-editar');
  }
  canParametrosActivosEliminar(): boolean {
    return this.permissionService.hasPermission('inv-matriz-paramatriz-activos-eliminar');
  }

  canParametrosImportarProcesadores(): boolean {
    return this.permissionService.hasPermission('inv-matriz-paramatriz-impor-procesador');
  }


  ngOnInit(): void {
    this.cargarDatos();
    this.cargarAgentes();
    this.cargarEmpresas();
    this.cargarTodosParametros();
    this.cargarProcesadores();
  }

  /**
   * Cargar todos los datos desde el backend
   */
  cargarDatos(): void {
    this.isLoadingParametros = true;
    
    this.matrizService.getGrupos().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.procesarGrupos(response.data);
        }
        this.isLoadingParametros = false;
      },
      error: (error) => {
        console.error('Error al cargar datos:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los parámetros',
          life: 3000
        });
        this.isLoadingParametros = false;
      }
    });
  }

  /**
   * Procesar los grupos y asignar a las variables correspondientes
   */
  procesarGrupos(grupos: GrupoParametro[]): void {
    grupos.forEach(grupo => {
      switch (grupo.nombre) {
        case 'Rangos de Edad':
          this.rangosEdad = this.mapearRangosEdad(grupo.parametros || []);
          break;
        case 'Características Mínimas Computador':
          this.caracteristicasMinimas = this.mapearCaracteristicas(grupo.parametros || []);
          break;
        case 'Conceptos de Puntaje':
          this.conceptosPuntaje = this.mapearConceptos(grupo.parametros || []);
          break;
        case 'Tipos de Equipos':
          this.tiposEquipos = this.mapearTiposEquipos(grupo.parametros || []);
          break;
      }
    });
  }

  /**
   * Mapear parámetros a rangos de edad
   */
  mapearRangosEdad(parametros: Parametro[]): RangoEdad[] {
    return parametros.map(p => ({
      id: p.id,
      rango: this.formatearRango(p.rango_i, p.rango_f),
      puntaje: parseInt(p.valor || '0')
    }));
  }

  /**
   * Mapear parámetros a características mínimas
   */
  mapearCaracteristicas(parametros: Parametro[]): CaracteristicaMinima[] {
    return parametros.map(p => ({
      id: p.id,
      nombre: p.nombre,
      valor: p.valor || ''
    }));
  }

  /**
   * Mapear parámetros a conceptos de puntaje
   */
  mapearConceptos(parametros: Parametro[]): ConceptoPuntaje[] {
    const colores: { [key: string]: { color: string, textColor: string } } = {
      'OBSOLETO': { color: '#dc3545', textColor: '#ffffff' },
      'POTENCIALMENTE': { color: '#ffc107', textColor: '#000000' },
      'FUNCIONAL': { color: '#0dcaf0', textColor: '#000000' },
      'ÓPTIMO': { color: '#198754', textColor: '#ffffff' }
    };

    return parametros.map(p => ({
      id: p.id,
      puntaje: this.formatearRango(p.rango_i, p.rango_f),
      concepto: p.nombre,
      color: colores[p.nombre]?.color || '#6c757d',
      textColor: colores[p.nombre]?.textColor || '#ffffff'
    }));
  }

  /**
   * Mapear parámetros a tipos de equipos
   */
  mapearTiposEquipos(parametros: Parametro[]): TipoEquipo[] {
    return parametros.map(p => ({
      id: p.id,
      tipo: p.nombre,
      vidaUtil: parseInt(p.valor || '0'),
      frecuencia: p.frecuencia || ''
    }));
  }

  /**
   * Formatear rango para mostrar
   */
  formatearRango(inicio?: number, fin?: number): string {
    if (inicio === undefined || fin === undefined) return '0';
    if (inicio === fin) return inicio.toString();
    if (inicio === 0 && fin === 0) return '0';
    return `> ${inicio} < ${fin}`;
  }

  guardarCambios(): void {
    this.messageService.add({
      severity: 'success',
      summary: 'Éxito',
      detail: 'Parámetros guardados correctamente',
      life: 3000
    });
  }

  restablecerParametros(): void {
    // Restablecer valores por defecto
    this.parametrosGenerales = {
      diasAlerta: 90,
      diasCritico: 30,
      porcentajeObsolescencia: 75,
      habilitarNotificaciones: true,
      frecuenciaAnalisis: 'mensual'
    };

    this.parametrosAgentes = {
      tiempoRespuestaMax: 48,
      capacidadMaxAgentes: 100,
      prioridadAlta: true,
      asignacionAutomatica: true,
      tipoAsignacion: 'round-robin'
    };

    this.messageService.add({
      severity: 'info',
      summary: 'Información',
      detail: 'Parámetros restablecidos a valores por defecto',
      life: 3000
    });
  }

  // Métodos para gestión de tipos de equipos
  nuevoEquipo(): void {
    this.esNuevo = true;
    this.equipoSeleccionado = { id: 0, tipo: '', vidaUtil: 3, frecuencia: 'Anual' };
    this.displayDialog = true;
  }

  editarEquipo(equipo: TipoEquipo): void {
    this.esNuevo = false;
    this.equipoSeleccionado = { ...equipo };
    this.displayDialog = true;
  }

  eliminarEquipo(equipo: TipoEquipo): void {
    this.matrizService.deleteParametro(equipo.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.tiposEquipos = this.tiposEquipos.filter(e => e.id !== equipo.id);
          this.messageService.add({
            severity: 'success',
            summary: 'Eliminado',
            detail: 'Tipo de equipo eliminado correctamente',
            life: 3000
          });
        }
      },
      error: (error) => {
        console.error('Error:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo eliminar el tipo de equipo',
          life: 3000
        });
      }
    });
  }

  guardarEquipo(): void {
    if (this.esNuevo) {
      const nuevoParametro: Partial<Parametro> = {
        id_grupo: 4, // ID del grupo "Tipos de Equipos" - ajustar según tu BD
        nombre: this.equipoSeleccionado.tipo,
        valor: this.equipoSeleccionado.vidaUtil.toString(),
        frecuencia: this.equipoSeleccionado.frecuencia
      };

      this.matrizService.createParametro(nuevoParametro).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.tiposEquipos.push({
              id: response.data.id,
              tipo: response.data.nombre,
              vidaUtil: parseInt(response.data.valor || '0'),
              frecuencia: response.data.frecuencia || ''
            });
            this.messageService.add({
              severity: 'success',
              summary: 'Agregado',
              detail: 'Tipo de equipo agregado correctamente',
              life: 3000
            });
          }
        },
        error: (error) => {
          console.error('Error:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo agregar el tipo de equipo',
            life: 3000
          });
        }
      });
    } else {
      const parametroActualizado: Partial<Parametro> = {
        nombre: this.equipoSeleccionado.tipo,
        valor: this.equipoSeleccionado.vidaUtil.toString(),
        frecuencia: this.equipoSeleccionado.frecuencia
      };

      this.matrizService.updateParametro(this.equipoSeleccionado.id, parametroActualizado).subscribe({
        next: (response) => {
          if (response.success) {
            const index = this.tiposEquipos.findIndex(e => e.id === this.equipoSeleccionado.id);
            if (index !== -1) {
              this.tiposEquipos[index] = this.equipoSeleccionado;
            }
            this.messageService.add({
              severity: 'success',
              summary: 'Actualizado',
              detail: 'Tipo de equipo actualizado correctamente',
              life: 3000
            });
          }
        },
        error: (error) => {
          console.error('Error:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo actualizar el tipo de equipo',
            life: 3000
          });
        }
      });
    }
    this.displayDialog = false;
  }

  cancelarDialog(): void {
    this.displayDialog = false;
  }

  // Métodos para Rangos de Edad
  agregarRangoEdad(): void {
    this.esNuevo = true;
    this.rangoSeleccionado = { id: 0, rango: '', puntaje: 0 };
    this.displayDialogRango = true;
  }

  editarRangoEdad(rango: RangoEdad): void {
    this.esNuevo = false;
    this.rangoSeleccionado = { ...rango };
    this.displayDialogRango = true;
  }

  guardarRangoEdad(): void {
    if (this.esNuevo) {
      const nuevoParametro: Partial<Parametro> = {
        id_grupo: 1, // ID del grupo "Rangos de Edad"
        nombre: 'Rango',
        valor: this.rangoSeleccionado.puntaje.toString(),
        rango_i: this.extraerRangoInicio(this.rangoSeleccionado.rango),
        rango_f: this.extraerRangoFin(this.rangoSeleccionado.rango)
      };

      this.matrizService.createParametro(nuevoParametro).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.rangosEdad.push({
              id: response.data.id,
              rango: this.rangoSeleccionado.rango,
              puntaje: parseInt(response.data.valor || '0')
            });
            this.messageService.add({
              severity: 'success',
              summary: 'Agregado',
              detail: 'Rango agregado correctamente',
              life: 3000
            });
          }
        },
        error: (error) => {
          console.error('Error:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo agregar el rango',
            life: 3000
          });
        }
      });
    } else {
      const parametroActualizado: Partial<Parametro> = {
        valor: this.rangoSeleccionado.puntaje.toString(),
        rango_i: this.extraerRangoInicio(this.rangoSeleccionado.rango),
        rango_f: this.extraerRangoFin(this.rangoSeleccionado.rango)
      };

      this.matrizService.updateParametro(this.rangoSeleccionado.id, parametroActualizado).subscribe({
        next: (response) => {
          if (response.success) {
            const index = this.rangosEdad.findIndex(r => r.id === this.rangoSeleccionado.id);
            if (index !== -1) {
              this.rangosEdad[index] = this.rangoSeleccionado;
            }
            this.messageService.add({
              severity: 'success',
              summary: 'Actualizado',
              detail: 'Rango actualizado correctamente',
              life: 3000
            });
          }
        },
        error: (error) => {
          console.error('Error:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo actualizar el rango',
            life: 3000
          });
        }
      });
    }
    this.displayDialogRango = false;
  }

  eliminarRangoEdad(rango: RangoEdad): void {
    this.matrizService.deleteParametro(rango.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.rangosEdad = this.rangosEdad.filter(r => r.id !== rango.id);
          this.messageService.add({
            severity: 'success',
            summary: 'Eliminado',
            detail: 'Rango eliminado correctamente',
            life: 3000
          });
        }
      },
      error: (error) => {
        console.error('Error:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo eliminar el rango',
          life: 3000
        });
      }
    });
  }

  extraerRangoInicio(rango: string): number {
    // Extraer el número inicial del rango (ej: "<= 5 Años" -> 0, "> 5 Años <= 8 Años" -> 5)
    const match = rango.match(/>\s*(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  extraerRangoFin(rango: string): number {
    // Extraer el número final del rango (ej: "<= 5 Años" -> 5, "> 5 Años <= 8 Años" -> 8)
    const match = rango.match(/<=\s*(\d+)/);
    return match ? parseInt(match[1]) : 999;
  }

  // Métodos para Características Mínimas
  agregarCaracteristica(): void {
    this.esNuevo = true;
    this.caracteristicaSeleccionada = { id: 0, nombre: '', valor: '' };
    this.displayDialogCaracteristica = true;
  }

  editarCaracteristica(caract: CaracteristicaMinima): void {
    this.esNuevo = false;
    this.caracteristicaSeleccionada = { ...caract };
    this.displayDialogCaracteristica = true;
  }

  guardarCaracteristica(): void {
    if (this.esNuevo) {
      const nuevoParametro: Partial<Parametro> = {
        id_grupo: 2, // ID del grupo "Características Mínimas Computador"
        nombre: this.caracteristicaSeleccionada.nombre,
        valor: this.caracteristicaSeleccionada.valor.toString()
      };

      this.matrizService.createParametro(nuevoParametro).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.caracteristicasMinimas.push({
              id: response.data.id,
              nombre: response.data.nombre,
              valor: response.data.valor || ''
            });
            this.messageService.add({
              severity: 'success',
              summary: 'Agregado',
              detail: 'Característica agregada correctamente',
              life: 3000
            });
          }
        },
        error: (error) => {
          console.error('Error:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo agregar la característica',
            life: 3000
          });
        }
      });
    } else {
      const parametroActualizado: Partial<Parametro> = {
        nombre: this.caracteristicaSeleccionada.nombre,
        valor: this.caracteristicaSeleccionada.valor.toString()
      };

      this.matrizService.updateParametro(this.caracteristicaSeleccionada.id, parametroActualizado).subscribe({
        next: (response) => {
          if (response.success) {
            const index = this.caracteristicasMinimas.findIndex(c => c.id === this.caracteristicaSeleccionada.id);
            if (index !== -1) {
              this.caracteristicasMinimas[index] = this.caracteristicaSeleccionada;
            }
            this.messageService.add({
              severity: 'success',
              summary: 'Actualizado',
              detail: 'Característica actualizada correctamente',
              life: 3000
            });
          }
        },
        error: (error) => {
          console.error('Error:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo actualizar la característica',
            life: 3000
          });
        }
      });
    }
    this.displayDialogCaracteristica = false;
  }

  eliminarCaracteristica(caract: CaracteristicaMinima): void {
    this.matrizService.deleteParametro(caract.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.caracteristicasMinimas = this.caracteristicasMinimas.filter(c => c.id !== caract.id);
          this.messageService.add({
            severity: 'success',
            summary: 'Eliminado',
            detail: 'Característica eliminada correctamente',
            life: 3000
          });
        }
      },
      error: (error) => {
        console.error('Error:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo eliminar la característica',
          life: 3000
        });
      }
    });
  }

  // Métodos para Conceptos de Puntaje
  agregarConcepto(): void {
    this.esNuevo = true;
    this.conceptoSeleccionado = { id: 0, puntaje: '', concepto: '', color: '#6c757d', textColor: '#ffffff' };
    this.displayDialogConcepto = true;
  }

  editarConcepto(concepto: ConceptoPuntaje): void {
    this.esNuevo = false;
    this.conceptoSeleccionado = { ...concepto };
    this.displayDialogConcepto = true;
  }

  guardarConcepto(): void {
    if (this.esNuevo) {
      const rangos = this.parsearPuntaje(this.conceptoSeleccionado.puntaje);
      const nuevoParametro: Partial<Parametro> = {
        id_grupo: 3, // ID del grupo "Conceptos de Puntaje"
        nombre: this.conceptoSeleccionado.concepto,
        valor: rangos.valor || undefined,
        rango_i: rangos.inicio,
        rango_f: rangos.fin
      };

      this.matrizService.createParametro(nuevoParametro).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.conceptosPuntaje.push({
              id: response.data.id,
              puntaje: this.conceptoSeleccionado.puntaje,
              concepto: response.data.nombre,
              color: this.conceptoSeleccionado.color,
              textColor: this.conceptoSeleccionado.textColor
            });
            this.messageService.add({
              severity: 'success',
              summary: 'Agregado',
              detail: 'Concepto agregado correctamente',
              life: 3000
            });
          }
        },
        error: (error) => {
          console.error('Error:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo agregar el concepto',
            life: 3000
          });
        }
      });
    } else {
      const rangos = this.parsearPuntaje(this.conceptoSeleccionado.puntaje);
      const parametroActualizado: Partial<Parametro> = {
        nombre: this.conceptoSeleccionado.concepto,
        valor: rangos.valor || undefined,
        rango_i: rangos.inicio,
        rango_f: rangos.fin
      };

      this.matrizService.updateParametro(this.conceptoSeleccionado.id, parametroActualizado).subscribe({
        next: (response) => {
          if (response.success) {
            const index = this.conceptosPuntaje.findIndex(c => c.id === this.conceptoSeleccionado.id);
            if (index !== -1) {
              this.conceptosPuntaje[index] = this.conceptoSeleccionado;
            }
            this.messageService.add({
              severity: 'success',
              summary: 'Actualizado',
              detail: 'Concepto actualizado correctamente',
              life: 3000
            });
          }
        },
        error: (error) => {
          console.error('Error:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo actualizar el concepto',
            life: 3000
          });
        }
      });
    }
    this.displayDialogConcepto = false;
  }

  eliminarConcepto(concepto: ConceptoPuntaje): void {
    this.matrizService.deleteParametro(concepto.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.conceptosPuntaje = this.conceptosPuntaje.filter(c => c.id !== concepto.id);
          this.messageService.add({
            severity: 'success',
            summary: 'Eliminado',
            detail: 'Concepto eliminado correctamente',
            life: 3000
          });
        }
      },
      error: (error) => {
        console.error('Error:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo eliminar el concepto',
          life: 3000
        });
      }
    });
  }

  parsearPuntaje(puntaje: string): { inicio: number, fin: number, valor: string | null } {
    // Parsear el puntaje para extraer rangos (ej: "> 0 < 60" -> inicio: 0, fin: 60)
    if (puntaje === '0') {
      return { inicio: 0, fin: 0, valor: '0' };
    }
    if (puntaje === '100') {
      return { inicio: 100, fin: 100, valor: '100' };
    }
    const match = puntaje.match(/>\s*(\d+)\s*<\s*(\d+)/);
    if (match) {
      return { inicio: parseFloat(match[1]), fin: parseFloat(match[2]), valor: null };
    }
    const matchGte = puntaje.match(/>=\s*(\d+)\s*<\s*(\d+)/);
    if (matchGte) {
      return { inicio: parseFloat(matchGte[1]), fin: parseFloat(matchGte[2]), valor: null };
    }
    return { inicio: 0, fin: 0, valor: null };
  }

  // ==================== MÉTODOS PARA AGENTES ====================

  /**
   * Cargar todos los agentes
   */
  cargarAgentes(): void {
    this.isLoadingAgentes = true;
    
    this.agentesService.getAgentes().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.agentes = response.data;
        }
        this.isLoadingAgentes = false;
      },
      error: (error) => {
        console.error('Error al cargar agentes:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los agentes',
          life: 3000
        });
        this.isLoadingAgentes = false;
      }
    });
  }

  /**
   * Agregar nuevo agente
   */
  agregarAgente(): void {
    this.esNuevo = true;
    this.agenteSeleccionado = { 
      tag: '', 
      nomenclatura: '',
      id_empresa: 0, 
      id_sucursal: 0, 
      id_sede: 0 
    };
    
    // Reset dropdown options
    this.sucursalesOptions = [];
    this.sedesOptions = [];
    
    this.displayDialogAgente = true;
  }

  /**
   * Editar agente existente
   */
  editarAgente(agente: MatrizObsAgente): void {
    this.esNuevo = false;
    this.agenteSeleccionado = { ...agente };
    
    // Cargar datos para los dropdowns basados en el agente seleccionado
    if (agente.id_empresa) {
      this.cargarSucursales(agente.id_empresa);
      
      if (agente.id_sucursal) {
        this.cargarSedes(agente.id_sucursal);
      }
    }
    
    this.displayDialogAgente = true;
  }

  /**
   * Guardar agente (crear o actualizar)
   */
  guardarAgente(): void {
    // Validar campos requeridos
    if (!this.agenteSeleccionado.tag || !this.agenteSeleccionado.tag.trim()) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'El tag del agente es requerido',
        life: 3000
      });
      return;
    }

    // Validar nomenclatura
    if (!this.agenteSeleccionado.nomenclatura || !this.agenteSeleccionado.nomenclatura.trim()) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'La nomenclatura es requerida',
        life: 3000
      });
      return;
    }

    // Validar formato de nomenclatura (2-10 caracteres, solo mayúsculas y números)
    const nomenclaturaRegex = /^[A-Z0-9]{2,10}$/;
    if (!nomenclaturaRegex.test(this.agenteSeleccionado.nomenclatura)) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'La nomenclatura debe tener entre 2 y 10 caracteres (solo letras mayúsculas y números)',
        life: 3000
      });
      return;
    }

    if (!this.agenteSeleccionado.id_empresa || this.agenteSeleccionado.id_empresa <= 0) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Debe seleccionar una empresa',
        life: 3000
      });
      return;
    }

    if (!this.agenteSeleccionado.id_sucursal || this.agenteSeleccionado.id_sucursal <= 0) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Debe seleccionar una sucursal',
        life: 3000
      });
      return;
    }

    // Preparar datos del agente
    const agenteData: MatrizObsAgente = {
      ...this.agenteSeleccionado,
      // Solo id_sede es opcional, convertir 0 a undefined para que no se envíe
      id_sede: this.agenteSeleccionado.id_sede && this.agenteSeleccionado.id_sede > 0 ? this.agenteSeleccionado.id_sede : undefined
    };

    console.log('Datos del agente a enviar:', agenteData); // Para debug

    if (this.esNuevo) {
      this.agentesService.createAgente(agenteData).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.agentes.push(response.data);
            this.messageService.add({
              severity: 'success',
              summary: 'Agregado',
              detail: 'Agente agregado correctamente',
              life: 3000
            });
          }
        },
        error: (error) => {
          console.error('Error completo:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: error.error?.message || 'No se pudo agregar el agente',
            life: 3000
          });
        }
      });
    } else {
      this.agentesService.updateAgente(this.agenteSeleccionado.id!, agenteData).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            const index = this.agentes.findIndex(a => a.id === this.agenteSeleccionado.id);
            if (index !== -1) {
              this.agentes[index] = response.data;
            }
            this.messageService.add({
              severity: 'success',
              summary: 'Actualizado',
              detail: 'Agente actualizado correctamente',
              life: 3000
            });
          }
        },
        error: (error) => {
          console.error('Error completo:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: error.error?.message || 'No se pudo actualizar el agente',
            life: 3000
          });
        }
      });
    }
    this.displayDialogAgente = false;
  }

  /**
   * Eliminar agente
   */
  eliminarAgente(agente: MatrizObsAgente): void {
    this.agentesService.deleteAgente(agente.id!).subscribe({
      next: (response) => {
        if (response.success) {
          this.agentes = this.agentes.filter(a => a.id !== agente.id);
          this.messageService.add({
            severity: 'success',
            summary: 'Eliminado',
            detail: 'Agente eliminado correctamente',
            life: 3000
          });
        }
      },
      error: (error) => {
        console.error('Error:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo eliminar el agente',
          life: 3000
        });
      }
    });
  }

  /**
   * Cancelar dialog de agente
   */
  cancelarDialogAgente(): void {
    this.displayDialogAgente = false;
  }

  /**
   * Cargar empresas para el dropdown
   */
  cargarEmpresas(): void {
    this.empresaService.getEmpresas().subscribe({
      next: (empresas: Empresa[]) => {
        this.empresasOptions = empresas.filter((empresa: Empresa) => empresa.estado === 1); // Solo empresas activas
      },
      error: (error: any) => {
        console.error('Error al cargar empresas:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar las empresas',
          life: 3000
        });
      }
    });
  }

  /**
   * Cargar sucursales basadas en la empresa seleccionada
   */
  cargarSucursales(idEmpresa: number): void {
    this.sucursalService.getSucursalesPorEmpresa(idEmpresa).subscribe({
      next: (sucursales: Sucursal[]) => {
        this.sucursalesOptions = sucursales;
      },
      error: (error: any) => {
        console.error('Error al cargar sucursales:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar las sucursales',
          life: 3000
        });
      }
    });
  }

  /**
   * Cargar sedes basadas en la sucursal seleccionada
   */
  cargarSedes(idSucursal: number): void {
    this.sedeService.getSedesPorSucursal(idSucursal).subscribe({
      next: (sedes: Sede[]) => {
        this.sedesOptions = sedes;
      },
      error: (error: any) => {
        console.error('Error al cargar sedes:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar las sedes',
          life: 3000
        });
      }
    });
  }

  /**
   * Manejar cambio de empresa
   */
  onEmpresaChange(event: any): void {
    const idEmpresa = event.value;
    if (idEmpresa) {
      this.cargarSucursales(idEmpresa);
      // Reset sucursal y sede cuando cambia la empresa
      this.agenteSeleccionado.id_sucursal = 0;
      this.agenteSeleccionado.id_sede = 0;
      this.sedesOptions = [];
    } else {
      this.sucursalesOptions = [];
      this.sedesOptions = [];
    }
  }

  /**
   * Manejar cambio de sucursal
   */
  onSucursalChange(event: any): void {
    const idSucursal = event.value;
    if (idSucursal) {
      this.cargarSedes(idSucursal);
      // Reset sede cuando cambia la sucursal
      this.agenteSeleccionado.id_sede = 0;
    } else {
      this.sedesOptions = [];
    }
  }

  /**
   * Obtener nombre de empresa por ID
   */
  getNombreEmpresa(idEmpresa: number): string {
    const empresa = this.empresasOptions.find(e => e.id === idEmpresa);
    return empresa ? empresa.nombre : `Empresa ${idEmpresa}`;
  }

  /**
   * Obtener nombre de sucursal por ID
   */
  getNombreSucursal(idSucursal: number): string {
    const sucursal = this.sucursalesOptions.find(s => s.id === idSucursal);
    if (sucursal) return sucursal.nombre;
    
    // Si no está en las opciones actuales, hacer una consulta directa
    return `Sucursal ${idSucursal}`;
  }

  /**
   * Obtener nombre de sede por ID
   */
  getNombreSede(idSede: number): string {
    const sede = this.sedesOptions.find(s => s.id === idSede);
    if (sede) return sede.nombre;
    
    // Si no está en las opciones actuales, hacer una consulta directa
    return `Sede ${idSede}`;
  }

  /**
   * Generar color para el tag del agente
   */
  getTagColor(tag: string): string {
    const colors = [
      '#6f42c1', // Púrpura
      '#20c997', // Verde azulado
      '#fd7e14', // Naranja
      '#e83e8c', // Rosa
      '#6610f2', // Índigo
      '#17a2b8', // Cian
      '#28a745', // Verde
      '#dc3545', // Rojo
      '#ffc107', // Amarillo
      '#007bff'  // Azul
    ];
    
    // Generar un índice basado en el hash del tag
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  }

  /**
   * Referencia a Math para usar en el template
   */
  Math = Math;

  /**
   * Ejecutar cálculos automáticos
   */
  ejecutarCalculos(soloNuevos: boolean = false): void {
    this.calculandoValores = true;
    
    const opciones = {
      batch_size: 50,
      force: !soloNuevos,
      solo_nuevos: soloNuevos
    };

    this.matrizService.ejecutarCalculos(opciones).subscribe({
      next: (response) => {
        this.calculandoValores = false;
        
        if (response.success) {
          const data = response.data;
          let mensaje = 'Cálculos ejecutados exitosamente';
          
          if (data.total !== undefined) {
            mensaje += `\n- Total procesados: ${data.procesados || data.total}`;
            mensaje += `\n- Exitosos: ${data.exitosos}`;
            if (data.errores > 0) {
              mensaje += `\n- Errores: ${data.errores}`;
            }
          }
          
          this.messageService.add({
            severity: 'success',
            summary: 'Cálculos Completados',
            detail: mensaje,
            life: 5000
          });
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: response.message || 'Error ejecutando cálculos',
            life: 4000
          });
        }
      },
      error: (error) => {
        this.calculandoValores = false;
        console.error('Error ejecutando cálculos:', error);
        
        let errorMessage = 'Error ejecutando cálculos automáticos';
        if (error.error?.message) {
          errorMessage = error.error.message;
        }
        
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: errorMessage,
          life: 4000
        });
      }
    });
  }

  // ==================== MÉTODOS PARA FÓRMULAS DE CÁLCULO ====================

  /**
   * Cargar todos los parámetros disponibles
   */
  cargarTodosParametros(): void {
    this.matrizService.getGrupos().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.todosParametros = [];
          response.data.forEach(grupo => {
            if (grupo.parametros) {
              this.todosParametros.push(...grupo.parametros);
            }
          });
        }
      },
      error: (error) => {
        console.error('Error al cargar parámetros:', error);
      }
    });
  }

  /**
   * ========================================
   * MÉTODOS PARA GESTIÓN DE PROCESADORES
   * ========================================
   */

  /**
   * Cargar todos los procesadores
   */
  cargarProcesadores(): void {
    this.isLoadingProcesadores = true;
    
    this.matrizService.getProcesadores().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.procesadores = response.data;
          this.procesadoresFiltrados = [...this.procesadores];
        }
        this.isLoadingProcesadores = false;
      },
      error: (error) => {
        console.error('Error al cargar procesadores:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los procesadores',
          life: 3000
        });
        this.isLoadingProcesadores = false;
      }
    });
  }
  
  /**
   * Filtrar procesadores por búsqueda
   */
  filtrarProcesadores(): void {
    if (!this.busquedaProcesador || this.busquedaProcesador.trim() === '') {
      this.procesadoresFiltrados = [...this.procesadores];
      return;
    }
    
    const busqueda = this.busquedaProcesador.toLowerCase().trim();
    this.procesadoresFiltrados = this.procesadores.filter(procesador =>
      procesador.nombre.toLowerCase().includes(busqueda)
    );
  }

  /**
   * Editar procesador existente
   */
  editarProcesador(procesador: Procesador): void {
    this.esNuevo = false;
    this.procesadorSeleccionado = { ...procesador };
    this.displayDialogProcesador = true;
  }

  /**
   * Guardar procesador (solo edición)
   */
  guardarProcesador(): void {
    if (!this.procesadorSeleccionado.nombre.trim()) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'El nombre del procesador es requerido',
        life: 3000
      });
      return;
    }

    this.matrizService.updateProcesador(this.procesadorSeleccionado.id!, this.procesadorSeleccionado).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const index = this.procesadores.findIndex(p => p.id === this.procesadorSeleccionado.id);
          if (index !== -1) {
            this.procesadores[index] = response.data;
          }
          
          // Actualizar también el array filtrado
          const indexFiltrado = this.procesadoresFiltrados.findIndex(p => p.id === this.procesadorSeleccionado.id);
          if (indexFiltrado !== -1) {
            this.procesadoresFiltrados[indexFiltrado] = response.data;
          }
          
          this.messageService.add({
            severity: 'success',
            summary: 'Actualizado',
            detail: 'Procesador actualizado correctamente',
            life: 3000
          });
          this.displayDialogProcesador = false;
        }
      },
      error: (error) => {
        console.error('Error:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo actualizar el procesador',
          life: 3000
        });
      }
    });
  }

  /**
   * Eliminar procesador
   */
  eliminarProcesador(procesador: Procesador): void {
    if (!procesador.id) return;
    
    this.matrizService.deleteProcesador(procesador.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.procesadores = this.procesadores.filter(p => p.id !== procesador.id);
          this.procesadoresFiltrados = this.procesadoresFiltrados.filter(p => p.id !== procesador.id);
          this.messageService.add({
            severity: 'success',
            summary: 'Eliminado',
            detail: 'Procesador eliminado correctamente',
            life: 3000
          });
        }
      },
      error: (error) => {
        console.error('Error:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo eliminar el procesador',
          life: 3000
        });
      }
    });
  }

  /**
   * Importar procesadores desde activos
   */
  importarProcesadoresDesdeActivos(): void {
    this.isLoadingProcesadores = true;
    
    this.matrizService.importarProcesadoresDesdeActivos().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.messageService.add({
            severity: 'success',
            summary: 'Importación Exitosa',
            detail: `Se importaron ${response.data.importados} procesadores. ${response.data.duplicados} ya existían.`,
            life: 5000
          });
          this.cargarProcesadores();
        }
        this.isLoadingProcesadores = false;
      },
      error: (error) => {
        console.error('Error:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron importar los procesadores',
          life: 3000
        });
        this.isLoadingProcesadores = false;
      }
    });
  }

  /**
   * ========================================
   * MÉTODOS PARA GESTIÓN DE TIPOS DE RAM
   * ========================================
   */

}
