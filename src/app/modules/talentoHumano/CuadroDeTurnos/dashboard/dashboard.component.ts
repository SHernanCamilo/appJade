import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

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
import { GrupoService, Grupo } from '../services/grupo.service';
import { CuadroService, Cuadro } from '../services/cuadro.service';
import { UnidadFuncionalService } from '../../../organizacion/empresa/services/unidad-funcional.service';
import { ContextoService } from '../../../../core/services/contexto.service';

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
  grupos: Grupo[] = [];
  gruposOptions: any[] = [];
  selectedGrupo: number | null = null;
  selectedMes: any = null;
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

  // Información de Sede (solo lectura)
  sedeInfo: any = null;

  // Gestionar
  cuadros: Cuadro[] = [];
  isLoadingCuadros = false;

  constructor(
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private grupoService: GrupoService,
    private cuadroService: CuadroService,
    private unidadFuncionalService: UnidadFuncionalService,
    private contextoService: ContextoService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadEmpresas();
    this.loadGrupos();
    this.loadCuadros();
    this.generarMeses();
  }

  /**
   * Cargar empresas disponibles para el usuario autenticado
   */
  loadEmpresas(): void {
    this.isLoadingEmpresas = true;
    this.contextoService.obtenerEmpresasDisponibles().subscribe({
      next: (empresas: any[]) => {
        this.empresas = empresas;
        this.empresasOptions = empresas.map((e: any) => ({
          label: e.nombre,
          value: e.id
        }));
        
        // Si solo hay una empresa, seleccionarla automáticamente
        if (empresas.length === 1) {
          this.selectedEmpresa = empresas[0].id;
          this.onEmpresaChange();
        }
        
        this.isLoadingEmpresas = false;
      },
      error: (error: any) => {
        console.error('Error al cargar empresas:', error);
        this.messageService.add({
          severity: 'warn',
          summary: 'Advertencia',
          detail: 'No se pudieron cargar las empresas disponibles'
        });
        this.isLoadingEmpresas = false;
      }
    });
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
   * Cargar unidades funcionales de una empresa específica
   */
  loadUnidadesFuncionalesPorEmpresa(empresaId: number): void {
    this.isLoadingUnidades = true;
    // Usar el servicio para obtener unidades funcionales filtradas por empresa
    this.unidadFuncionalService.getUnidadesFuncionalesPorEmpresa(empresaId).subscribe({
      next: (unidades: any[]) => {
        this.unidadesFuncionales = unidades;
        // Mostrar unidades con prefijo si está disponible
        this.unidadesFuncionalesOptions = unidades.map((u: any) => ({
          label: u.nombre_con_prefijo ? `${u.nombre_con_prefijo}` : `${u.codigo} - ${u.nombre}`,
          value: u.id,
          prefijo: u.prefijo,
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

  loadGrupos(): void {
    this.grupoService.getGrupos().subscribe({
      next: (grupos) => {
        this.grupos = grupos;
        this.gruposOptions = grupos.map(g => ({
          label: g.nombre,
          value: g.id
        }));
      },
      error: (error) => {
        console.error('Error al cargar grupos:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los grupos'
        });
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
      this.gruposOptions = this.grupos.map(g => ({
        label: g.nombre,
        value: g.id
      }));
      this.empleados = [];
      this.empleadosOptions = [];
      this.selectedEmpleado = null;
      this.sedeInfo = null;
      return;
    }

    // Cargar empleados de la unidad funcional
    this.loadEmpleadosUnidad(this.selectedUnidadFuncional);

    // Obtener información de la unidad para mostrar la sede
    const unidadSeleccionada = this.unidadesFuncionales.find(u => u.id === this.selectedUnidadFuncional);
    if (unidadSeleccionada) {
      this.sedeInfo = {
        nombre: unidadSeleccionada.nombre,
        prefijo: unidadSeleccionada.prefijo || 'N/A',
        codigo: unidadSeleccionada.codigo,
        sede: unidadSeleccionada.sede_nombre || 'No especificada'
      };
    }

    // Filtrar grupos por unidad funcional seleccionada
    const gruposFiltrados = this.grupos.filter(g => 
      g.id_unidad_funcional === this.selectedUnidadFuncional
    );

    this.gruposOptions = gruposFiltrados.map(g => ({
      label: g.nombre,
      value: g.id
    }));

    // Limpiar selección de grupo si no está en los filtrados
    if (this.selectedGrupo && !gruposFiltrados.find(g => g.id === this.selectedGrupo)) {
      this.selectedGrupo = null;
    }
  }

  loadEmpleadosUnidad(idUnidad: number): void {
    this.isLoadingEmpleados = true;
    this.unidadFuncionalService.getEmpleadosUnidad(idUnidad).subscribe({
      next: (empleados: any[]) => {
        this.empleados = empleados;
        this.empleadosOptions = empleados.map((e: any) => ({
          label: `${e.nombre} (${e.cedula || e.email})`,
          value: e.id
        }));
        this.isLoadingEmpleados = false;
      },
      error: (error: any) => {
        console.error('Error al cargar empleados:', error);
        this.messageService.add({
          severity: 'warn',
          summary: 'Advertencia',
          detail: 'No se pudieron cargar los empleados de la unidad'
        });
        this.isLoadingEmpleados = false;
      }
    });
  }

  verCuadro(): void {
    if (!this.selectedGrupo || !this.selectedMes) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'Selecciona un grupo y un mes'
      });
      return;
    }

    // Buscar si existe un cuadro para este grupo y mes
    const cuadroExistente = this.cuadros.find(c => 
      c.grupo_id === this.selectedGrupo && 
      c.mes === this.selectedMes.mes && 
      c.year === this.selectedMes.year
    );

    if (cuadroExistente) {
      this.router.navigate(['/talentoHumano/turnos/cuadro', cuadroExistente.id, 'grilla'], {
        queryParams: { mes: this.selectedMes.mes, year: this.selectedMes.year }
      });
    } else {
      this.messageService.add({
        severity: 'info',
        summary: 'No encontrado',
        detail: 'No existe un cuadro para este período. Créalo primero.'
      });
    }
  }

  crearNuevoCuadro(): void {
    if (!this.selectedGrupo || !this.selectedMes) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'Selecciona un grupo y un mes'
      });
      return;
    }

    const nuevoCuadro: Cuadro = {
      grupo_id: this.selectedGrupo,
      mes: this.selectedMes.mes,
      year: this.selectedMes.year,
      estado: 'borrador'
    };

    this.cuadroService.createCuadro(nuevoCuadro).subscribe({
      next: (cuadro) => {
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: 'Cuadro creado exitosamente'
        });
        this.loadCuadros();
        this.router.navigate(['/talentoHumano/turnos/cuadro', cuadro.id, 'grilla'], {
          queryParams: { mes: this.selectedMes.mes, year: this.selectedMes.year }
        });
      },
      error: (error) => {
        console.error('Error al crear cuadro:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo crear el cuadro'
        });
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
      borrador: 'warn',
      publicado: 'success',
      cerrado: 'info'
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
}
