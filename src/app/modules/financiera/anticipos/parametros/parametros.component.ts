import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

// PrimeNG Imports
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService, ConfirmationService } from 'primeng/api';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { CheckboxModule } from 'primeng/checkbox';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { InputTextarea } from 'primeng/inputtextarea';
import { TabViewModule } from 'primeng/tabview';
import { DialogModule } from 'primeng/dialog';

interface Parametro {
  id?: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  valor: string;
  tipo_dato: string;
  estado: boolean;
}

interface Regla {
  id: number;
  id_concepto: number;
  descripcion: string;
  valor_tope: number;
  concepto?: {
    tipo: { nombre: string };
    clase: { nombre: string };
    modalidad: { nombre: string };
  };
}

interface Cargo {
  id: number;
  codigo: string;
  nombre: string;
  departamento: string;
  selected?: boolean;
}

@Component({
  selector: 'app-parametros-anticipos',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ButtonModule,
    ToastModule,
    CardModule,
    TableModule,
    TagModule,
    SkeletonModule,
    InputTextModule,
    TooltipModule,
    CheckboxModule,
    DropdownModule,
    InputNumberModule,
    ConfirmDialogModule,
    InputTextarea,
    TabViewModule,
    DialogModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './parametros.component.html',
  styleUrl: './parametros.component.css'
})
export class ParametrosAnticiposComponent implements OnInit {
  
  // Tab activo
  activeTabIndex = 0;
  
  // Estados de carga
  isLoading = false;
  isSaving = false;
  isLoadingCargos = false;
  
  // TAB 1: CONFIGURACIÓN
  parametros: Parametro[] = [];
  totalRecords = 0;
  parametroActual: Parametro = this.getEmptyParametro();
  modoEdicion = false;
  parametroEditandoId: number | null = null;
  
  tiposDatoOptions = [
    { label: 'Texto', value: 'texto' },
    { label: 'Número', value: 'numero' },
    { label: 'Decimal', value: 'decimal' },
    { label: 'Booleano', value: 'booleano' },
    { label: 'Fecha', value: 'fecha' }
  ];

  // TAB 2: REGLAS/CARGOS
  reglasDisponibles: Regla[] = [];
  reglaSeleccionada: Regla | null = null;
  cargosAsignados: Cargo[] = [];
  todosLosCargos: Cargo[] = [];
  busquedaCargo = '';
  mostrarModalCargos = false;

  constructor(
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit(): void {
    this.loadParametros();
    this.loadReglasDisponibles();
    this.loadTodosLosCargos();
  }

  /**
   * TAB 1: CONFIGURACIÓN - MÉTODOS
   */
  
  private getEmptyParametro(): Parametro {
    return {
      codigo: '',
      nombre: '',
      descripcion: '',
      valor: '',
      tipo_dato: 'texto',
      estado: true
    };
  }

  loadParametros(): void {
    this.isLoading = true;
    
    setTimeout(() => {
      this.parametros = [
        {
          id: 1,
          codigo: 'DIAS_MAX_ANTICIPO',
          nombre: 'Días máximos para solicitar anticipo',
          descripcion: 'Número de días antes del viaje para solicitar anticipo',
          valor: '15',
          tipo_dato: 'numero',
          estado: true
        },
        {
          id: 2,
          codigo: 'PORC_MAX_ANTICIPO',
          nombre: 'Porcentaje máximo de anticipo',
          descripcion: 'Porcentaje máximo del valor total que se puede anticipar',
          valor: '80',
          tipo_dato: 'numero',
          estado: true
        },
        {
          id: 3,
          codigo: 'REQUIERE_APROBACION',
          nombre: 'Requiere aprobación',
          descripcion: 'Indica si los anticipos requieren aprobación',
          valor: 'true',
          tipo_dato: 'booleano',
          estado: true
        }
      ];
      this.totalRecords = this.parametros.length;
      this.isLoading = false;
    }, 1000);
  }

  guardarParametro(): void {
    if (!this.parametroActual.codigo || this.parametroActual.codigo.trim() === '') {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'El código es obligatorio',
        life: 3000
      });
      return;
    }

    if (!this.parametroActual.nombre || this.parametroActual.nombre.trim() === '') {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'El nombre es obligatorio',
        life: 3000
      });
      return;
    }

    if (!this.parametroActual.valor || this.parametroActual.valor.trim() === '') {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'El valor es obligatorio',
        life: 3000
      });
      return;
    }

    if (this.modoEdicion && this.parametroEditandoId) {
      const index = this.parametros.findIndex(p => p.id === this.parametroEditandoId);
      if (index !== -1) {
        this.parametros[index] = { ...this.parametroActual, id: this.parametroEditandoId };
      }
      this.messageService.add({
        severity: 'success',
        summary: 'Éxito',
        detail: 'Parámetro actualizado correctamente',
        life: 3000
      });
    } else {
      const nuevoParametro = {
        ...this.parametroActual,
        id: this.parametros.length + 1
      };
      this.parametros = [...this.parametros, nuevoParametro];
      this.totalRecords = this.parametros.length;
      
      this.messageService.add({
        severity: 'success',
        summary: 'Éxito',
        detail: 'Parámetro agregado correctamente',
        life: 3000
      });
    }

    this.limpiarFormulario();
  }

  editarParametro(parametro: Parametro): void {
    this.modoEdicion = true;
    this.parametroEditandoId = parametro.id || null;
    this.parametroActual = { ...parametro };
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelarEdicion(): void {
    this.limpiarFormulario();
    this.messageService.add({
      severity: 'info',
      summary: 'Cancelado',
      detail: 'Edición cancelada',
      life: 3000
    });
  }

  limpiarFormulario(): void {
    this.parametroActual = this.getEmptyParametro();
    this.modoEdicion = false;
    this.parametroEditandoId = null;
  }

  eliminarParametro(parametro: Parametro): void {
    this.confirmationService.confirm({
      message: '¿Está seguro de eliminar este parámetro?',
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.parametros = this.parametros.filter(p => p.id !== parametro.id);
        this.totalRecords = this.parametros.length;
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: 'Parámetro eliminado correctamente',
          life: 3000
        });
      }
    });
  }

  getTipoDatoLabel(tipo: string): string {
    const option = this.tiposDatoOptions.find(t => t.value === tipo);
    return option ? option.label : tipo;
  }

  /**
   * TAB 2: REGLAS/CARGOS - MÉTODOS
   */
  
  loadReglasDisponibles(): void {
    // Simulación - En producción vendría del backend
    setTimeout(() => {
      this.reglasDisponibles = [
        {
          id: 1,
          id_concepto: 1,
          descripcion: 'Máximo por desayuno',
          valor_tope: 20000,
          concepto: {
            tipo: { nombre: 'Viajes' },
            clase: { nombre: 'Alimentación' },
            modalidad: { nombre: 'Desayuno' }
          }
        },
        {
          id: 3,
          id_concepto: 1,
          descripcion: 'Máximo por almuerzo',
          valor_tope: 35000,
          concepto: {
            tipo: { nombre: 'Viajes' },
            clase: { nombre: 'Alimentación' },
            modalidad: { nombre: 'Almuerzo' }
          }
        },
        {
          id: 5,
          id_concepto: 1,
          descripcion: 'Máximo por cena',
          valor_tope: 25000,
          concepto: {
            tipo: { nombre: 'Viajes' },
            clase: { nombre: 'Alimentación' },
            modalidad: { nombre: 'Cena' }
          }
        },
        {
          id: 7,
          id_concepto: 2,
          descripcion: 'Máximo transporte intermunicipal',
          valor_tope: 150000,
          concepto: {
            tipo: { nombre: 'Viajes' },
            clase: { nombre: 'Transporte' },
            modalidad: { nombre: 'Intermunicipal' }
          }
        }
      ];
    }, 500);
  }

  loadTodosLosCargos(): void {
    // Simulación - En producción vendría del backend
    setTimeout(() => {
      this.todosLosCargos = [
        { id: 1, codigo: 'DIR-001', nombre: 'Director General', departamento: 'Dirección', selected: false },
        { id: 5, codigo: 'GER-001', nombre: 'Gerente de Operaciones', departamento: 'Operaciones', selected: false },
        { id: 6, codigo: 'GER-002', nombre: 'Gerente Financiero', departamento: 'Finanzas', selected: false },
        { id: 7, codigo: 'COORD-001', nombre: 'Coordinador de Proyectos', departamento: 'Proyectos', selected: false },
        { id: 8, codigo: 'COORD-002', nombre: 'Coordinador de RRHH', departamento: 'Recursos Humanos', selected: false },
        { id: 10, codigo: 'AUX-001', nombre: 'Auxiliar Administrativo', departamento: 'Administración', selected: false },
        { id: 12, codigo: 'TEC-001', nombre: 'Técnico de Campo', departamento: 'Operaciones', selected: false }
      ];
    }, 500);
  }

  onReglaChange(): void {
    if (this.reglaSeleccionada) {
      this.loadCargosAsignados();
    } else {
      this.cargosAsignados = [];
    }
  }

  loadCargosAsignados(): void {
    if (!this.reglaSeleccionada) return;
    
    this.isLoadingCargos = true;
    
    // Simulación - En producción vendría del backend
    setTimeout(() => {
      // Ejemplo: La regla 1 (Desayuno) está asignada a los cargos 1, 5, 6, 7, 8
      if (this.reglaSeleccionada?.id === 1) {
        this.cargosAsignados = [
          { id: 1, codigo: 'DIR-001', nombre: 'Director General', departamento: 'Dirección' },
          { id: 5, codigo: 'GER-001', nombre: 'Gerente de Operaciones', departamento: 'Operaciones' },
          { id: 6, codigo: 'GER-002', nombre: 'Gerente Financiero', departamento: 'Finanzas' },
          { id: 7, codigo: 'COORD-001', nombre: 'Coordinador de Proyectos', departamento: 'Proyectos' },
          { id: 8, codigo: 'COORD-002', nombre: 'Coordinador de RRHH', departamento: 'Recursos Humanos' }
        ];
      } else {
        this.cargosAsignados = [];
      }
      this.isLoadingCargos = false;
    }, 800);
  }

  getConceptoInfo(regla: Regla): string {
    if (!regla.concepto) return 'N/A';
    return `${regla.concepto.tipo.nombre} > ${regla.concepto.clase.nombre} > ${regla.concepto.modalidad.nombre}`;
  }

  cargosFiltrados(): Cargo[] {
    if (!this.busquedaCargo) return this.todosLosCargos;
    
    const busqueda = this.busquedaCargo.toLowerCase();
    return this.todosLosCargos.filter(cargo => 
      cargo.nombre.toLowerCase().includes(busqueda) ||
      cargo.codigo.toLowerCase().includes(busqueda) ||
      cargo.departamento.toLowerCase().includes(busqueda)
    );
  }

  isCargoAsignado(cargo: Cargo): boolean {
    return this.cargosAsignados.some(c => c.id === cargo.id);
  }

  toggleCargo(cargo: Cargo): void {
    if (this.isCargoAsignado(cargo)) {
      return; // No permitir desmarcar cargos ya asignados desde el modal
    }
    cargo.selected = !cargo.selected;
  }

  guardarAsignacionCargos(): void {
    const cargosSeleccionados = this.todosLosCargos.filter(c => c.selected && !this.isCargoAsignado(c));
    
    if (cargosSeleccionados.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'Debe seleccionar al menos un cargo',
        life: 3000
      });
      return;
    }

    // Agregar los nuevos cargos a la lista de asignados
    this.cargosAsignados = [...this.cargosAsignados, ...cargosSeleccionados];
    
    // Limpiar selección
    this.todosLosCargos.forEach(c => c.selected = false);
    this.busquedaCargo = '';
    this.mostrarModalCargos = false;

    this.messageService.add({
      severity: 'success',
      summary: 'Éxito',
      detail: `${cargosSeleccionados.length} cargo(s) asignado(s) correctamente`,
      life: 3000
    });
  }

  desasignarCargo(cargo: Cargo): void {
    this.confirmationService.confirm({
      message: `¿Está seguro de desasignar el cargo "${cargo.nombre}" de esta regla?`,
      header: 'Confirmar desasignación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, desasignar',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.cargosAsignados = this.cargosAsignados.filter(c => c.id !== cargo.id);
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: 'Cargo desasignado correctamente',
          life: 3000
        });
      }
    });
  }

  /**
   * MÉTODOS COMUNES
   */
  
  getSeverity(estado: boolean): 'success' | 'danger' {
    return estado ? 'success' : 'danger';
  }

  getEstadoTexto(estado: boolean): string {
    return estado ? 'Activo' : 'Inactivo';
  }
}