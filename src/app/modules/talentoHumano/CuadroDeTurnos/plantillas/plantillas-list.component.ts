import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
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
import { SkeletonModule } from 'primeng/skeleton';
import { DropdownModule } from 'primeng/dropdown';
import { MessageService, ConfirmationService } from 'primeng/api';

// Services
import { PlantillaService, Plantilla } from '../services/plantilla.service';
import { EmpresaService } from '../../../organizacion/empresa/services/empresa.service';

interface EmpresaOption {
  id: number;
  nombre: string;
}

@Component({
  selector: 'app-plantillas-list',
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
    SkeletonModule,
    DropdownModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './plantillas-list.component.html',
  styleUrl: './plantillas-list.component.css'
})
export class PlantillasListComponent implements OnInit {

  plantillas: Plantilla[] = [];
  plantillasFiltradas: Plantilla[] = [];
  isLoading = false;
  isSubmitting = false;

  searchTerm = '';
  showFormDialog = false;
  editMode = false;
  currentId?: number;
  submitted = false;

  // Multi-empresa
  isSuperAdmin = false;
  userEmpresas: EmpresaOption[] = [];
  selectedEmpresaFilter: number | null = null;
  empresasLoaded = false;

  formData = this.emptyForm();

  constructor(
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private plantillaService: PlantillaService,
    private empresaService: EmpresaService
  ) {}

  ngOnInit(): void {
    this.loadUserContext();
  }

  /**
   * Carga el contexto del usuario desde localStorage y luego las plantillas
   */
  private loadUserContext(): void {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      this.loadPlantillas();
      return;
    }

    try {
      const user = JSON.parse(userStr);

      // Detectar super_admin
      const roles: string[] = user.roles ?? [];
      this.isSuperAdmin = roles.includes('super_admin');

      if (this.isSuperAdmin) {
        // Super admin: cargar TODAS las empresas desde la API
        this.empresaService.getEmpresas().subscribe({
          next: (empresas) => {
            this.userEmpresas = empresas.map(e => ({ id: e.id, nombre: e.nombre }));
            this.empresasLoaded = true;
            this.loadPlantillas();
          },
          error: (err) => {
            console.error('Error al cargar empresas:', err);
            this.empresasLoaded = true;
            this.loadPlantillas();
          }
        });
      } else {
        // Usuario normal: usar las empresas del localStorage
        if (user.empresas && Array.isArray(user.empresas)) {
          this.userEmpresas = user.empresas.map((e: any) => ({
            id: e.id,
            nombre: e.nombre
          }));
        }
        this.empresasLoaded = true;

        // Si tiene exactamente una empresa, preseleccionar
        if (this.userEmpresas.length === 1) {
          this.selectedEmpresaFilter = this.userEmpresas[0].id;
        }

        this.loadPlantillas();
      }
    } catch (e) {
      console.error('Error al leer datos del usuario:', e);
      this.loadPlantillas();
    }
  }

  emptyForm() {
    return {
      codigo: '',
      nombre: '',
      descripcion: '',
      hora_inicio: '',
      hora_fin: '',
      id_empresa: null as number | null,
      activo: true
    };
  }

  loadPlantillas(): void {
    this.isLoading = true;

    const params: any = {};

    // Si no es super_admin, filtrar por su empresa
    if (!this.isSuperAdmin && this.selectedEmpresaFilter) {
      params.id_empresa = this.selectedEmpresaFilter;
    } else if (this.isSuperAdmin && this.selectedEmpresaFilter) {
      params.id_empresa = this.selectedEmpresaFilter;
    }

    this.plantillaService.getPlantillas(params).subscribe({
      next: (plantillas) => {
        this.plantillas = plantillas;
        this.aplicarFiltros();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar plantillas:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar las plantillas'
        });
        this.isLoading = false;
      }
    });
  }

  aplicarFiltros(): void {
    let result = [...this.plantillas];
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(p =>
        p.nombre?.toLowerCase().includes(term) ||
        p.codigo?.toLowerCase().includes(term) ||
        p.descripcion?.toLowerCase().includes(term)
      );
    }
    this.plantillasFiltradas = result;
  }

  limpiarFiltros(): void {
    this.searchTerm = '';
    if (this.isSuperAdmin) {
      this.selectedEmpresaFilter = null;
    }
    this.aplicarFiltros();
    if (this.isSuperAdmin) {
      this.loadPlantillas();
    }
  }

  onEmpresaFilterChange(): void {
    this.loadPlantillas();
  }

  abrirFormulario(): void {
    this.editMode = false;
    this.currentId = undefined;
    this.submitted = false;
    this.formData = this.emptyForm();

    // Si no es super_admin y tiene una sola empresa, asignarla automáticamente
    if (!this.isSuperAdmin && this.userEmpresas.length === 1) {
      this.formData.id_empresa = this.userEmpresas[0].id;
    }

    this.showFormDialog = true;
  }

  private horaParaInput(hora: string): string {
    if (!hora) return '';
    const [h, m] = hora.split(':');
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
  }

  private normalizarHora(hora: string): string {
    if (!hora) return hora;
    const hhmm = hora.substring(0, 5);
    return hhmm.replace(/^0(\d):/, '$1:');
  }

  editarPlantilla(plantilla: any): void {
    this.editMode = true;
    this.currentId = plantilla.id;
    this.submitted = false;
    this.formData = {
      codigo:      plantilla.codigo ?? '',
      nombre:      plantilla.nombre,
      descripcion: plantilla.descripcion ?? '',
      hora_inicio: this.horaParaInput(plantilla.hora_inicio),
      hora_fin:    this.horaParaInput(plantilla.hora_fin),
      id_empresa:  plantilla.id_empresa ?? null,
      activo:      plantilla.activo ?? plantilla.estado ?? true,
    };
    this.showFormDialog = true;
  }

  onSubmit(): void {
    this.submitted = true;
    if (!this.formData.codigo || !this.formData.nombre || !this.formData.hora_inicio || !this.formData.hora_fin) return;

    // Validar que tenga empresa asignada
    if (!this.formData.id_empresa) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Atención',
        detail: 'Debe seleccionar una empresa'
      });
      return;
    }

    this.isSubmitting = true;

    const payload: any = {
      codigo:      this.formData.codigo,
      nombre:      this.formData.nombre,
      descripcion: this.formData.descripcion ?? null,
      hora_inicio: this.normalizarHora(this.formData.hora_inicio),
      hora_fin:    this.normalizarHora(this.formData.hora_fin),
      id_empresa:  this.formData.id_empresa,
      estado:      this.formData.activo,
    };

    const request = this.editMode
      ? this.plantillaService.updatePlantilla(this.currentId!, payload)
      : this.plantillaService.createPlantilla(payload);

    request.subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: this.editMode ? 'Plantilla actualizada' : 'Plantilla creada'
        });
        this.showFormDialog = false;
        this.isSubmitting = false;
        this.loadPlantillas();
      },
      error: (error) => {
        console.error('Error al guardar plantilla:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: error.error?.message ?? 'No se pudo guardar la plantilla'
        });
        this.isSubmitting = false;
      }
    });
  }

  eliminarPlantilla(plantilla: any): void {
    this.confirmationService.confirm({
      message: `¿Eliminar la plantilla "${plantilla.codigo} - ${plantilla.nombre}"?`,
      header: 'Confirmar Eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.plantillaService.deletePlantilla(plantilla.id).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: 'Plantilla eliminada'
            });
            this.loadPlantillas();
          },
          error: (error) => {
            console.error('Error al eliminar plantilla:', error);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'No se pudo eliminar la plantilla'
            });
          }
        });
      }
    });
  }

  /**
   * Obtiene el nombre de la empresa por ID
   */
  getNombreEmpresa(plantilla: any): string {
    if (plantilla.empresa?.nombre) return plantilla.empresa.nombre;
    if (!plantilla.id_empresa) return '—';
    const emp = this.userEmpresas.find(e => e.id === plantilla.id_empresa);
    return emp?.nombre ?? '—';
  }
}
