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
import { MessageService, ConfirmationService } from 'primeng/api';

// Services
import { PlantillaService, Plantilla } from '../services/plantilla.service';

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
    SkeletonModule
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

  formData = this.emptyForm();

  constructor(
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private plantillaService: PlantillaService,
    
    
  ) {}

  ngOnInit(): void {
    this.loadPlantillas();
  }

  emptyForm() {
    return {
      nombre: '',
      descripcion: '',
      hora_inicio: '',
      hora_fin: '',
      activo: true
    };
  }

  loadPlantillas(): void {
    this.isLoading = true;
    this.plantillaService.getPlantillas().subscribe({
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
        p.descripcion?.toLowerCase().includes(term)
      );
    }
    this.plantillasFiltradas = result;
  }

  limpiarFiltros(): void {
    this.searchTerm = '';
    this.aplicarFiltros();
  }

  abrirFormulario(): void {
    this.editMode = false;
    this.currentId = undefined;
    this.submitted = false;
    this.formData = this.emptyForm();
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
    nombre:      plantilla.nombre,
    descripcion: plantilla.descripcion ?? '',
    hora_inicio: this.horaParaInput(plantilla.hora_inicio),  // "8:30" → "08:30"
    hora_fin:    this.horaParaInput(plantilla.hora_fin),
    activo:      plantilla.activo ?? true,
  };
  this.showFormDialog = true;
}
onSubmit(): void {
  this.submitted = true;
  if (!this.formData.nombre || !this.formData.hora_inicio || !this.formData.hora_fin) return;

  this.isSubmitting = true;

  // Solo los campos que el controller de Laravel valida
  const payload = {
    nombre:          this.formData.nombre,
    descripcion:     this.formData.descripcion ?? null,
    hora_inicio:     this.normalizarHora(this.formData.hora_inicio),
    hora_fin:        this.normalizarHora(this.formData.hora_fin),
    activo:          this.formData.activo,
  };

  console.log('=== PAYLOAD ===', JSON.stringify(payload));

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
      message: `¿Eliminar la plantilla ${plantilla.nombre}?`,
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
}
