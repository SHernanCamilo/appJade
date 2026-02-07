import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PermissionService } from '../../../../core/services/permission.service';
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { SedeService, Sede, CreateSedeRequest } from '../services/sede.service';
import { SucursalService, Sucursal } from '../services/sucursal.service';
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
  selector: 'app-sedes',
  standalone: true,
  imports: [
    CommonModule, 
    HasPermissionDirective,
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
  templateUrl: './sedes.component.html',
  styleUrls: ['./sedes.component.css']
})
export class SedesComponent implements OnInit {
  @ViewChild('dt') dt!: Table;
  @ViewChild('globalFilter') globalFilter!: ElementRef;
  
  sedes: Sede[] = [];
  sedesFiltered: Sede[] = [];
  empresas: Empresa[] = [];
  sucursales: Sucursal[] = [];
  sucursalesFiltered: Sucursal[] = [];
  sedeForm!: FormGroup;
  isLoading = false;
  isSubmitting = false;
  showForm = false;
  editMode = false;
  currentSedeId?: number;
  selectedEmpresa: number | null = null;
  selectedEmpresaFilter: number | null = null;

  constructor(
    private fb: FormBuilder,
    private sedeService: SedeService,
    private sucursalService: SucursalService,
    private empresaService: EmpresaService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    public permissionService: PermissionService
  ) {
    this.initForm();
  }

  canCreate(): boolean {
    return this.permissionService.hasPermission('org-sede-crear');
  }

  canEdit(): boolean {
    return this.permissionService.hasPermission('org-sede-editar');
  }

  canDelete(): boolean {
    return this.permissionService.hasPermission('org-sede-eliminar');
  }

  canSearch(): boolean {
    return this.permissionService.hasPermission('org-sede-buscar');
  }



  

  ngOnInit(): void {
    this.loadEmpresas();
    this.loadSucursales();
    this.loadSedes();
  }

  initForm(): void {
    this.sedeForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      id_Sucursal: [null, [Validators.required]]
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
    this.sucursalService.getSucursales().subscribe({
      next: (sucursales) => {
        this.sucursales = sucursales;
      },
      error: (error) => {
        console.error('Error cargando sucursales:', error);
      }
    });
  }

  loadSedes(): void {
    this.isLoading = true;
    
    this.sedeService.getSedes().subscribe({
      next: (sedes) => {
        this.sedes = sedes;
        this.sedesFiltered = [...sedes]; // Inicializar el array filtrado
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error cargando sedes:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error al cargar las sedes'
        });
        this.isLoading = false;
        this.sedes = [];
        this.sedesFiltered = [];
      }
    });
  }

  onEmpresaChange(event: any): void {
    if (event.value) {
      this.sucursalesFiltered = this.sucursales.filter(s => s.id_Empresa === event.value);
      this.sedeForm.patchValue({ id_Sucursal: null });
    } else {
      this.sucursalesFiltered = [];
      this.sedeForm.patchValue({ id_Sucursal: null });
    }
  }

  toggleForm(): void {
    this.showForm = !this.showForm;
    if (!this.showForm) {
      this.sedeForm.reset();
      this.editMode = false;
      this.currentSedeId = undefined;
      this.selectedEmpresa = null;
      this.sucursalesFiltered = [];
    }
  }

  onSubmit(): void {
    if (this.sedeForm.invalid) {
      this.sedeForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;

    const sedeData: CreateSedeRequest = this.sedeForm.value;

    if (this.editMode && this.currentSedeId) {
      this.sedeService.updateSede(this.currentSedeId, sedeData).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Sede actualizada exitosamente'
          });
          this.sedeForm.reset();
          this.showForm = false;
          this.editMode = false;
          this.selectedEmpresa = null;
          this.loadSedes();
          this.isSubmitting = false;
        },
        error: (error) => {
          console.error('Error actualizando sede:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: error.error?.message || 'Error al actualizar la sede'
          });
          this.isSubmitting = false;
        }
      });
    } else {
      this.sedeService.createSede(sedeData).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Sede creada exitosamente'
          });
          this.sedeForm.reset();
          this.showForm = false;
          this.selectedEmpresa = null;
          this.loadSedes();
          this.isSubmitting = false;
        },
        error: (error) => {
          console.error('Error creando sede:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: error.error?.message || 'Error al crear la sede'
          });
          this.isSubmitting = false;
        }
      });
    }
  }

  editSede(sede: Sede): void {
    this.editMode = true;
    this.currentSedeId = sede.id;
    
    // Establecer la empresa para filtrar las sucursales
    if (sede.sucursal?.id_Empresa) {
      this.selectedEmpresa = sede.sucursal.id_Empresa;
      this.sucursalesFiltered = this.sucursales.filter(s => s.id_Empresa === sede.sucursal?.id_Empresa);
    }
    
    this.sedeForm.patchValue({
      nombre: sede.nombre,
      id_Sucursal: sede.id_Sucursal
    });
    this.showForm = true;
  }

  deleteSede(sede: Sede): void {
    this.confirmationService.confirm({
      message: `¿Estás seguro de eliminar la sede "${sede.nombre}"?`,
      header: 'Confirmar Eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.sedeService.deleteSede(sede.id).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: 'Sede eliminada exitosamente'
            });
            this.loadSedes();
          },
          error: (error) => {
            console.error('Error eliminando sede:', error);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Error al eliminar la sede'
            });
          }
        });
      }
    });
  }

  filterByEmpresa(event: any): void {
    this.selectedEmpresaFilter = event.value;
    
    if (event.value) {
      this.sedesFiltered = this.sedes.filter(s => s.sucursal?.id_Empresa === event.value);
    } else {
      this.sedesFiltered = [...this.sedes];
    }
    
    // Limpiar el filtro global cuando se cambia el filtro de empresa
    if (this.dt) {
      this.dt.clear();
    }
  }

  clearFilters(): void {
    this.selectedEmpresaFilter = null;
    this.sedesFiltered = [...this.sedes];
    
    // Limpiar el input de búsqueda global usando ViewChild
    if (this.globalFilter && this.globalFilter.nativeElement) {
      this.globalFilter.nativeElement.value = '';
    }
  }

  onGlobalFilter(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    
    if (value) {
      // Aplicar filtro global sobre los datos ya filtrados por empresa
      let dataToFilter = this.selectedEmpresaFilter 
        ? this.sedes.filter(s => s.sucursal?.id_Empresa === this.selectedEmpresaFilter)
        : this.sedes;
      
      this.sedesFiltered = dataToFilter.filter(sede => 
        sede.nombre.toLowerCase().includes(value.toLowerCase()) ||
        (sede.sucursal?.nombre || '').toLowerCase().includes(value.toLowerCase()) ||
        (sede.sucursal?.empresa?.nombre || '').toLowerCase().includes(value.toLowerCase())
      );
    } else {
      // Si no hay texto de búsqueda, mostrar según filtro de empresa
      this.filterByEmpresa({ value: this.selectedEmpresaFilter });
    }
  }
}
