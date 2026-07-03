import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PermissionService } from '../../../../core/services/permission.service';
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { SedeService, Sede, CreateSedeRequest } from '../services/sede.service';
import { SucursalService, Sucursal } from '../services/sucursal.service';
import { EmpresaService, Empresa } from '../services/empresa.service';
import { DataTableComponent } from '../../../../complements/shared/data-table/data-table.component';
import { TableColumn } from '../../../../complements/shared/data-table/table-column.model';

// PrimeNG Imports
import { TableModule } from 'primeng/table';
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
    TooltipModule,
    DataTableComponent
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './sedes.component.html',
  styleUrls: ['./sedes.component.css']
})
export class SedesComponent implements OnInit {
  sedes: Sede[] = [];
  columns: TableColumn[] = [];
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
        this.buildColumns();
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
        this.buildColumns();
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
      }
    });
  }

  buildColumns(): void {
    const sucursalOptions = [...new Map(
      this.sucursales.map(s => [s.nombre, { label: s.nombre, value: s.nombre }])
    ).values()];

    this.columns = [
      { field: 'nombre', header: 'Sede', sortable: true, filter: true, filterType: 'text' },
      {
        field: 'sucursal.nombre',
        header: 'Sucursal',
        sortable: true,
        filter: true,
        filterType: 'select',
        filterOptions: sucursalOptions
      },
      {
        field: 'sucursal.empresa.nombre',
        header: 'Empresa',
        sortable: true,
        filter: true,
        filterType: 'select',
        filterOptions: this.empresas.map(e => ({ label: e.nombre, value: e.nombre }))
      },
      {
        field: 'created_at',
        header: 'Fecha de Creación',
        sortable: true,
        pipe: 'date',
        pipeFormat: 'dd/MM/yyyy'
      }
    ];
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
}
