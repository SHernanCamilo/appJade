import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { EmpresaService, Empresa, CreateEmpresaRequest } from '../services/empresa.service';

// PrimeNG Imports
import { TableModule, Table } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TagModule } from 'primeng/tag';
import { AvatarModule } from 'primeng/avatar';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService, ConfirmationService } from 'primeng/api';

@Component({
  selector: 'app-maestro-empresa',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    ReactiveFormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    DialogModule,
    ToastModule,
    ConfirmDialogModule,
    TagModule,
    AvatarModule,
    TooltipModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './maestro-empresa.component.html',
  styleUrl: './maestro-empresa.component.css'
})
export class MaestroEmpresaComponent implements OnInit {
  @ViewChild('dt') dt!: Table;
  
  empresas: Empresa[] = [];
  empresaForm!: FormGroup;
  isLoading = false;
  isSubmitting = false;
  showForm = false;
  editMode = false;
  currentEmpresaId?: number;

  constructor(
    private fb: FormBuilder,
    private empresaService: EmpresaService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    this.loadEmpresas();
  }

  initForm(): void {
    this.empresaForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      prefijo: ['', [Validators.required]],
      nit: [null, [Validators.required]],
      telefono: [null, [Validators.required]],
      direccion: ['', [Validators.required]],
      rep_legal: ['', [Validators.required]],
      cc_rep_legal: [null, [Validators.required]],
      logo: [''],
      estado: [1]
    });
  }

  loadEmpresas(): void {
    this.isLoading = true;
    
    this.empresaService.getEmpresas().subscribe({
      next: (empresas) => {
        this.empresas = empresas;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error cargando empresas:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error al cargar las empresas'
        });
        this.isLoading = false;
        this.empresas = [];
      }
    });
  }

  toggleForm(): void {
    this.showForm = !this.showForm;
    if (!this.showForm) {
      this.empresaForm.reset({ estado: 1 });
      this.editMode = false;
      this.currentEmpresaId = undefined;
    }
  }

  onSubmit(): void {
    if (this.empresaForm.invalid) {
      this.empresaForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;

    const empresaData: CreateEmpresaRequest = this.empresaForm.value;

    if (this.editMode && this.currentEmpresaId) {
      this.empresaService.updateEmpresa(this.currentEmpresaId, empresaData).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Empresa actualizada exitosamente'
          });
          this.empresaForm.reset({ estado: 1 });
          this.showForm = false;
          this.editMode = false;
          this.loadEmpresas();
          this.isSubmitting = false;
        },
        error: (error) => {
          console.error('Error actualizando empresa:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: error.error?.message || 'Error al actualizar la empresa'
          });
          this.isSubmitting = false;
        }
      });
    } else {
      this.empresaService.createEmpresa(empresaData).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Empresa creada exitosamente'
          });
          this.empresaForm.reset({ estado: 1 });
          this.showForm = false;
          this.loadEmpresas();
          this.isSubmitting = false;
        },
        error: (error) => {
          console.error('Error creando empresa:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: error.error?.message || 'Error al crear la empresa'
          });
          this.isSubmitting = false;
        }
      });
    }
  }

  editEmpresa(empresa: Empresa): void {
    this.editMode = true;
    this.currentEmpresaId = empresa.id;
    this.empresaForm.patchValue(empresa);
    this.showForm = true;
  }

  toggleEstado(empresa: Empresa): void {
    this.confirmationService.confirm({
      message: `¿Estás seguro de ${empresa.estado === 1 ? 'desactivar' : 'activar'} la empresa "${empresa.nombre}"?`,
      header: 'Confirmar Cambio de Estado',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, continuar',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.empresaService.toggleEstado(empresa.id).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: 'Estado actualizado exitosamente'
            });
            this.loadEmpresas();
          },
          error: (error) => {
            console.error('Error cambiando estado:', error);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Error al cambiar el estado'
            });
          }
        });
      }
    });
  }

  deleteEmpresa(empresa: Empresa): void {
    this.confirmationService.confirm({
      message: `¿Estás seguro de eliminar la empresa "${empresa.nombre}"?`,
      header: 'Confirmar Eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.empresaService.deleteEmpresa(empresa.id).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: 'Empresa eliminada exitosamente'
            });
            this.loadEmpresas();
          },
          error: (error) => {
            console.error('Error eliminando empresa:', error);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Error al eliminar la empresa'
            });
          }
        });
      }
    });
  }

  getInitials(name: string): string {
    const words = name.split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  onGlobalFilter(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.dt.filterGlobal(input.value, 'contains');
  }
}
