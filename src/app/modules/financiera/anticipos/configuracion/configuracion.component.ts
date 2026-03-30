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
import { AccordionModule } from 'primeng/accordion';

// Services
import { WorkflowService } from '../../../sistema/flujos/services/workflow.service';
import { WfDefinicion, WfPaso, WfRegla, WfAprobador, CondicionesRegla } from '../../../sistema/flujos/models/workflow.models';

@Component({
  selector: 'app-configuracion-anticipos',
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
    DialogModule,
    AccordionModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './configuracion.component.html',
  styleUrl: './configuracion.component.css'
})
export class ConfiguracionAnticiposComponent implements OnInit {
  
  // Tab activo
  activeTabIndex = 0;
  
  // Estados de carga
  isLoading = false;
  isSaving = false;
  
  // TAB 1: FLUJOS
  flujos: WfDefinicion[] = [];
  totalFlujos = 0;
  flujoSeleccionado: WfDefinicion | null = null;
  mostrarModalFlujo = false;
  
  // TAB 2: PASOS
  pasos: WfPaso[] = [];
  pasoSeleccionado: WfPaso | null = null;
  mostrarModalPaso = false;
  
  // TAB 3: REGLAS
  reglas: WfRegla[] = [];
  reglaSeleccionada: WfRegla | null = null;
  mostrarModalRegla = false;
  
  // TAB 4: APROBADORES
  aprobadores: WfAprobador[] = [];
  aprobadorSeleccionado: WfAprobador | null = null;
  mostrarModalAprobador = false;

  // Opciones
  modulosOptions = [
    { label: 'Anticipos', value: 'anticipos' },
    { label: 'Horas Extras', value: 'horas_extras' },
    { label: 'Permisos', value: 'permisos' },
    { label: 'Eventos', value: 'eventos' }
  ];

  estrategiasOptions = [
    { label: 'Usuario Fijo', value: 'fijo' },
    { label: 'Por Unidad Funcional', value: 'unidad_funcional' },
    { label: 'Por Prefijo Sucursal', value: 'prefijo_sucursal' }
  ];

  constructor(
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private workflowService: WorkflowService
  ) {}

  ngOnInit(): void {
    this.loadFlujos();
  }

  // ========================================================================
  // TAB 1: FLUJOS
  // ========================================================================

  loadFlujos(): void {
    this.isLoading = true;
    
    this.workflowService.listarDefiniciones({
      modulo: 'anticipos',
      page: 1,
      per_page: 50
    }).subscribe({
      next: (response) => {
        if (response.success) {
          this.flujos = response.data;
          this.totalFlujos = response.total;
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error cargando flujos:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los flujos',
          life: 3000
        });
        this.isLoading = false;
      }
    });
  }

  seleccionarFlujo(flujo: WfDefinicion): void {
    this.flujoSeleccionado = flujo;
    this.loadPasos(flujo.id);
    this.loadReglas(flujo.id);
  }

  // ========================================================================
  // TAB 2: PASOS
  // ========================================================================

  loadPasos(idDefinicion: number): void {
    this.workflowService.listarPasos(idDefinicion).subscribe({
      next: (response) => {
        if (response.success) {
          this.pasos = response.data;
        }
      },
      error: (error) => {
        console.error('Error cargando pasos:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los pasos',
          life: 3000
        });
      }
    });
  }

  seleccionarPaso(paso: WfPaso): void {
    this.pasoSeleccionado = paso;
    this.loadAprobadores(paso.id);
  }

  // ========================================================================
  // TAB 3: REGLAS
  // ========================================================================

  loadReglas(idDefinicion: number): void {
    this.workflowService.listarReglas(idDefinicion).subscribe({
      next: (response) => {
        if (response.success) {
          this.reglas = response.data;
        }
      },
      error: (error) => {
        console.error('Error cargando reglas:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar las reglas',
          life: 3000
        });
      }
    });
  }

  /**
   * Formatear condiciones de regla para mostrar
   */
  formatCondiciones(condiciones: CondicionesRegla): string {
    const partes: string[] = [];
    
    if (condiciones.nivel_min !== undefined || condiciones.nivel_max !== undefined) {
      const min = condiciones.nivel_min || 1;
      const max = condiciones.nivel_max || 4;
      partes.push(`Nivel ${min}-${max}`);
    }
    
    if (condiciones.prefijo_sucursal) {
      partes.push(`Sucursal: ${condiciones.prefijo_sucursal}`);
    }
    
    if (condiciones.monto_min !== undefined || condiciones.monto_max !== undefined) {
      if (condiciones.monto_min && condiciones.monto_max) {
        partes.push(`Monto: $${condiciones.monto_min.toLocaleString()} - $${condiciones.monto_max.toLocaleString()}`);
      } else if (condiciones.monto_min) {
        partes.push(`Monto > $${condiciones.monto_min.toLocaleString()}`);
      } else if (condiciones.monto_max) {
        partes.push(`Monto < $${condiciones.monto_max.toLocaleString()}`);
      }
    }
    
    if (condiciones.cobertura) {
      partes.push(`Cobertura: ${condiciones.cobertura}`);
    }
    
    return partes.join(' | ') || 'Sin condiciones';
  }

  // ========================================================================
  // TAB 4: APROBADORES
  // ========================================================================

  loadAprobadores(idPaso: number): void {
    this.workflowService.listarAprobadores(idPaso).subscribe({
      next: (response) => {
        if (response.success) {
          this.aprobadores = response.data;
        }
      },
      error: (error) => {
        console.error('Error cargando aprobadores:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los aprobadores',
          life: 3000
        });
      }
    });
  }

  /**
   * Formatear estrategia de aprobador
   */
  formatEstrategia(aprobador: WfAprobador): string {
    switch (aprobador.estrategia) {
      case 'fijo':
        return `Usuario: ${aprobador.user?.name || 'N/A'}`;
      case 'unidad_funcional':
        return `Unidad: ${aprobador.unidad_funcional?.nombre || 'N/A'}`;
      case 'prefijo_sucursal':
        return `Sucursal: ${aprobador.prefijo_sucursal || 'N/A'}`;
      default:
        return 'N/A';
    }
  }

  // ========================================================================
  // MÉTODOS COMUNES
  // ========================================================================
  
  getSeverity(estado: boolean): 'success' | 'danger' {
    return estado ? 'success' : 'danger';
  }

  getEstadoTexto(estado: boolean): string {
    return estado ? 'Activo' : 'Inactivo';
  }
}
