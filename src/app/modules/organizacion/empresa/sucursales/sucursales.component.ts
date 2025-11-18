import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { SucursalService, Sucursal, CreateSucursalRequest } from '../services/sucursal.service';
import { EmpresaService, Empresa } from '../services/empresa.service';

// PrimeNG Imports
import { TableModule, Table } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService, ConfirmationService } from 'primeng/api';

@Component({
  selector: 'app-sucursales',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    ReactiveFormsModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    DialogModule,
    ToastModule,
    ConfirmDialogModule,
    TagModule,
    TooltipModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './sucursales.component.html',
  styleUrls: ['./sucursales.component.css']
})
export class SucursalesComponent implements OnInit {
  @ViewChild('dt') dt!: Table;
  
  sucursales: Sucursal[] = [];
  sucursalesFiltered: Sucursal[] = [];
  empresas: Empresa[] = [];
  sucursalForm!: FormGroup;
  isLoading = false;
  isSubmitting = false;
  showForm = false;
  editMode = false;
  currentSucursalId?: number;
  selectedEmpresaFilter: number | null = null;

  constructor(
    private fb: FormBuilder,
    private sucursalService: SucursalService,
    private empresaService: EmpresaService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    this.loadEmpresas();
    this.loadSucursales();
  }

  initForm(): void {
    this.sucursalForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      id_Empresa: [null, [Validators.required]]
    });
  }

  loadEmpresas(): void {
    this.empresaService.getEmpresas().subscribe({
      next: (empresas) => {
        this.empresas = empresas.filter(e => e.estado === 1);
      },
      error: (error) => {
        console.error('Error cargando empresas:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error al cargar las empresas'
        });
      }
    });
  }

  loadSucursales(): void {
    this.isLoading = true;
    
    this.sucursalService.getSucursales().subscribe({
      next: (sucursales) => {
        this.sucursales = sucursales;
        this.sucursalesFiltered = sucursales;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error cargando sucursales:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error al cargar las sucursales'
        });
        this.isLoading = false;
        this.sucursales = [];
      }
    });
  }

  toggleForm(): void {
    this.showForm = !this.showForm;
    if (!this.showForm) {
      this.sucursalForm.reset();
      this.editMode = false;
      this.currentSucursalId = undefined;
    }
  }

  onSubmit(): void {
    if (this.sucursalForm.invalid) {
      this.sucursalForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;

    const sucursalData: CreateSucursalRequest = this.sucursalForm.value;

    if (this.editMode && this.currentSucursalId) {
      this.sucursalService.updateSucursal(this.currentSucursalId, sucursalData).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Sucursal actualizada exitosamente'
          });
          this.sucursalForm.reset();
          this.showForm = false;
          this.editMode = false;
          this.loadSucursales();
          this.isSubmitting = false;
        },
        error: (error) => {
          console.error('Error actualizando sucursal:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: error.error?.message || 'Error al actualizar la sucursal'
          });
          this.isSubmitting = false;
        }
      });
    } else {
      this.sucursalService.createSucursal(sucursalData).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Sucursal creada exitosamente'
          });
          this.sucursalForm.reset();
          this.showForm = false;
          this.loadSucursales();
          this.isSubmitting = false;
        },
        error: (error) => {
          console.error('Error creando sucursal:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: error.error?.message || 'Error al crear la sucursal'
          });
          this.isSubmitting = false;
        }
      });
    }
  }

  editSucursal(sucursal: Sucursal): void {
    this.editMode = true;
    this.currentSucursalId = sucursal.id;
    this.sucursalForm.patchValue({
      nombre: sucursal.nombre,
      id_Empresa: sucursal.id_Empresa
    });
    this.showForm = true;
  }

  deleteSucursal(sucursal: Sucursal): void {
    this.confirmationService.confirm({
      message: `¿Estás seguro de eliminar la sucursal "${sucursal.nombre}"?`,
      header: 'Confirmar Eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.sucursalService.deleteSucursal(sucursal.id).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: 'Sucursal eliminada exitosamente'
            });
            this.loadSucursales();
          },
          error: (error) => {
            console.error('Error eliminando sucursal:', error);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Error al eliminar la sucursal'
            });
          }
        });
      }
    });
  }

  filterByEmpresa(event: any): void {
    if (event.value) {
      this.sucursalesFiltered = this.sucursales.filter(s => s.id_Empresa === event.value);
    } else {
      this.sucursalesFiltered = this.sucursales;
    }
  }

  onGlobalFilter(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.dt.filterGlobal(input.value, 'contains');
  }
}
