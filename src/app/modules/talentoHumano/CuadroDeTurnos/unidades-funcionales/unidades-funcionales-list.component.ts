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
import { CheckboxModule } from 'primeng/checkbox';
import { MessageService, ConfirmationService } from 'primeng/api';

// Services
import { UnidadFuncionalService, UnidadFuncional } from '../services/unidad-funcional.service';
import { EmpresaService } from '../../../organizacion/empresa/services/empresa.service';
import { SedeService } from '../../../organizacion/empresa/services/sede.service';

@Component({
  selector: 'app-unidades-funcionales-list',
  standalone: true,
  imports: [
    CommonModule, RouterModule, FormsModule,
    TableModule, ButtonModule, InputTextModule, DialogModule, ToastModule,
    ConfirmDialogModule, TagModule, TooltipModule, SkeletonModule,
    DropdownModule, CheckboxModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './unidades-funcionales-list.component.html',
  styleUrl: './unidades-funcionales-list.component.css'
})
export class UnidadesFuncionalesListComponent implements OnInit {

  unidades: UnidadFuncional[] = [];
  unidadesFiltradas: UnidadFuncional[] = [];
  isLoading = false;
  isSubmitting = false;

  searchTerm = '';
  showFormDialog = false;
  editMode = false;
  currentId?: number;
  submitted = false;

  // Catálogo de empresas
  empresas: any[] = [];
  empresasOptions: any[] = [];
  // Catálogo de sedes (en cascada con la empresa seleccionada)
  sedes: any[] = [];
  sedesOptions: any[] = [];

  formData = this.emptyForm();

  constructor(
    private message: MessageService,
    private confirm: ConfirmationService,
    private unidadService: UnidadFuncionalService,
    private empresaService: EmpresaService,
    private sedeService: SedeService
  ) {}

  ngOnInit(): void {
    this.loadEmpresas();
    this.loadUnidades();
  }

  emptyForm() {
    return {
      codigo: '',
      nombre: '',
      id_empresa: null as number | null,
      id_sede: null as number | null,
      estado: true
    };
  }

  // ================== Catálogos ==================

  loadEmpresas(): void {
    this.empresaService.getEmpresas().subscribe({
      next: (empresas: any) => {
        const data = Array.isArray(empresas) ? empresas : (empresas?.data ?? []);
        this.empresas = data;
        this.empresasOptions = data.map((e: any) => ({ label: e.nombre, value: e.id }));
      },
      error: () => this.message.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las empresas' })
    });
  }

  /** Carga sedes de la empresa seleccionada y limpia la sede previa. */
  onEmpresaChange(): void {
    this.formData.id_sede = null;
    this.cargarSedes(this.formData.id_empresa);
  }

  private cargarSedes(idEmpresa: number | null): void {
    this.sedes = [];
    this.sedesOptions = [];
    if (!idEmpresa) return;

    this.sedeService.getSedesPorEmpresa(idEmpresa).subscribe({
      next: (sedes: any) => {
        const data = Array.isArray(sedes) ? sedes : (sedes?.data ?? []);
        this.sedes = data;
        this.sedesOptions = data.map((s: any) => ({ label: s.nombre, value: s.id }));
      },
      error: () => {
        this.sedes = [];
        this.sedesOptions = [];
      }
    });
  }

  // ================== CRUD ==================

  loadUnidades(): void {
    this.isLoading = true;
    this.unidadService.getUnidadesFuncionales().subscribe({
      next: (r) => {
        this.unidades = r.data || [];
        this.aplicarFiltros();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.message.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las unidades funcionales' });
      }
    });
  }

  aplicarFiltros(): void {
    let result = [...this.unidades];
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(u =>
        u.nombre?.toLowerCase().includes(term) ||
        u.codigo?.toLowerCase().includes(term)
      );
    }
    this.unidadesFiltradas = result;
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
    this.sedes = [];
    this.sedesOptions = [];
    this.showFormDialog = true;
  }

  editarUnidad(u: any): void {
    this.editMode = true;
    this.currentId = u.id;
    this.submitted = false;
    this.formData = {
      codigo: u.codigo || '',
      nombre: u.nombre || '',
      id_empresa: u.id_empresa || null,
      id_sede: u.id_sede || null,
      estado: u.estado !== undefined ? !!u.estado : true
    };
    // Cargar sedes y conservar la sede seleccionada actual
    if (this.formData.id_empresa) {
      const sedeActual = this.formData.id_sede;
      this.cargarSedes(this.formData.id_empresa);
      // Restaurar después de la carga (la respuesta llega más tarde)
      setTimeout(() => { this.formData.id_sede = sedeActual; }, 350);
    }
    this.showFormDialog = true;
  }

  onSubmit(): void {
    this.submitted = true;
    if (!this.formData.codigo || !this.formData.nombre || !this.formData.id_empresa) {
      this.message.add({ severity: 'warn', summary: 'Faltan datos', detail: 'Completa código, nombre y empresa' });
      return;
    }

    this.isSubmitting = true;
    const request$ = this.editMode
      ? this.unidadService.updateUnidadFuncional(this.currentId!, this.formData as any)
      : this.unidadService.createUnidadFuncional(this.formData as any);

    request$.subscribe({
      next: () => {
        this.message.add({
          severity: 'success', summary: 'Éxito',
          detail: this.editMode ? 'Unidad actualizada' : 'Unidad creada'
        });
        this.showFormDialog = false;
        this.isSubmitting = false;
        this.loadUnidades();
      },
      error: (err) => {
        this.isSubmitting = false;
        const msg = err?.error?.message || 'No se pudo guardar la unidad funcional';
        this.message.add({ severity: 'error', summary: 'Error', detail: msg });
      }
    });
  }

  eliminarUnidad(u: any): void {
    this.confirm.confirm({
      message: `¿Desactivar la unidad funcional ${u.nombre}?`,
      header: 'Confirmar',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, desactivar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.unidadService.deleteUnidadFuncional(u.id).subscribe({
          next: () => {
            this.message.add({ severity: 'success', summary: 'Éxito', detail: 'Unidad desactivada' });
            this.loadUnidades();
          },
          error: () => this.message.add({ severity: 'error', summary: 'Error', detail: 'No se pudo desactivar la unidad' })
        });
      }
    });
  }

  empresaNombre(id?: number): string {
    if (!id) return '—';
    const e = this.empresas.find(x => x.id === id);
    return e?.nombre || '—';
  }
}
