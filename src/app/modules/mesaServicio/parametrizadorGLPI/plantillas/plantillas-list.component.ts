import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService, ConfirmationService } from 'primeng/api';

import { PermissionService } from '../../../../core/services/permission.service';
import { SidebarService } from '../../../../complements/shared/sidebar/sidebar.service';
import { GlpiPlantillaService } from '../services/glpi-plantilla.service';
import { GlpiPlantilla } from '../interfaces/glpi-plantilla.interface';

@Component({
  selector: 'app-glpi-plantillas-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
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
export class GlpiPlantillasListComponent implements OnInit {
  plantillas: GlpiPlantilla[] = [];
  plantillasFiltradas: GlpiPlantilla[] = [];
  isLoading = false;
  searchTerm = '';

  constructor(
    private plantillaService: GlpiPlantillaService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private router: Router,
    private permissionService: PermissionService,
    private sidebarService: SidebarService
  ) {}

  ngOnInit(): void {
    this.cargarPlantillas();
  }

  get puedeCrear(): boolean {
    return this.tieneAccion('crear', 'mesa-glpi-plantilla-crear');
  }

  get puedeEditar(): boolean {
    return this.tieneAccion('editar', 'mesa-glpi-plantilla-editar');
  }

  get puedeEliminar(): boolean {
    return this.tieneAccion('eliminar', 'mesa-glpi-plantilla-eliminar');
  }

  private tieneAccion(accion: 'crear' | 'editar' | 'eliminar', codigo: string): boolean {
    if (this.permissionService.hasPermission(codigo)) {
      return true;
    }
    const basicos = this.sidebarService.getPermisosBasicos('MESA-GLPI-PLANTILLA');
    if (basicos) {
      if (accion === 'crear') return !!basicos.puede_crear;
      if (accion === 'editar') return !!basicos.puede_editar;
      return !!basicos.puede_eliminar;
    }
    return this.sidebarService.tieneAccesoModulo('MESA-GLPI-PLANTILLA');
  }

  cargarPlantillas(): void {
    this.isLoading = true;
    this.plantillaService.listar().subscribe({
      next: (data) => {
        this.plantillas = data;
        this.aplicarFiltros();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar las plantillas'
        });
      }
    });
  }

  aplicarFiltros(): void {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      this.plantillasFiltradas = [...this.plantillas];
      return;
    }

    this.plantillasFiltradas = this.plantillas.filter((p) => {
      return [p.codigo, p.nombre]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }

  nuevaPlantilla(): void {
    this.router.navigate(['/mesaServicio/parametrizadorGLPI/plantillas/nueva']);
  }

  editarPlantilla(plantilla: GlpiPlantilla): void {
    if (!plantilla.id) {
      return;
    }
    this.router.navigate(['/mesaServicio/parametrizadorGLPI/plantillas', plantilla.id]);
  }

  toggleEstado(plantilla: GlpiPlantilla): void {
    if (!plantilla.id) {
      return;
    }

    this.plantillaService.toggleEstado(plantilla.id).subscribe({
      next: (actualizada) => {
        plantilla.estado = actualizada.estado;
        this.messageService.add({
          severity: 'success',
          summary: 'Estado actualizado',
          detail: actualizada.estado ? 'Plantilla activada' : 'Plantilla desactivada'
        });
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo cambiar el estado'
        });
      }
    });
  }

  eliminarPlantilla(plantilla: GlpiPlantilla): void {
    this.confirmationService.confirm({
      message: `¿Eliminar la plantilla "${plantilla.nombre}"? Esta acción no se puede deshacer.`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        if (!plantilla.id) {
          return;
        }
        this.plantillaService.eliminar(plantilla.id).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Eliminada',
              detail: 'La plantilla se eliminó correctamente'
            });
            this.cargarPlantillas();
          },
          error: () => {
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
