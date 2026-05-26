import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { MessageService, ConfirmationService } from 'primeng/api';

import { CuadroService } from '../services/cuadro.service';
import { GrupoService } from '../services/grupo.service';
import { Cuadro, EstadoCuadro, ESTADO_CUADRO_CONFIG } from '../models/cuadro.model';
import { Grupo } from '../models/grupo.model';

@Component({
  selector: 'app-cuadros-list',
  standalone: true,
  imports: [
    CommonModule, RouterModule, FormsModule,
    TableModule, ButtonModule, TagModule, ToastModule, DialogModule,
    DropdownModule, InputTextModule, SkeletonModule, TooltipModule,
    ConfirmDialogModule, InputNumberModule, TextareaModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './cuadros-list.component.html',
  styleUrl: './cuadros-list.component.css'
})
export class CuadrosListComponent implements OnInit {

  cuadros: Cuadro[] = [];
  grupos: Grupo[] = [];
  isLoading = false;
  isSaving = false;

  // Filtros
  filtroGrupo: number | null = null;
  filtroAnio: number = new Date().getFullYear();
  filtroMes: number | null = null;
  filtroEstado: EstadoCuadro | null = null;

  // Modal nuevo cuadro
  showDialog = false;
  form = { id_grupo: null as number | null, anio: new Date().getFullYear(), mes: new Date().getMonth() + 1, observaciones: '' };

  estadoConfig = ESTADO_CUADRO_CONFIG;

  gruposOptions: { label: string; value: number }[] = [];
  mesesOptions = [
    { label: 'Enero', value: 1 }, { label: 'Febrero', value: 2 }, { label: 'Marzo', value: 3 },
    { label: 'Abril', value: 4 }, { label: 'Mayo', value: 5 }, { label: 'Junio', value: 6 },
    { label: 'Julio', value: 7 }, { label: 'Agosto', value: 8 }, { label: 'Septiembre', value: 9 },
    { label: 'Octubre', value: 10 }, { label: 'Noviembre', value: 11 }, { label: 'Diciembre', value: 12 }
  ];
  estadosOptions = [
    { label: 'Todos', value: null },
    { label: 'Borrador', value: 'borrador' },
    { label: 'Publicado', value: 'publicado' },
    { label: 'Cerrado', value: 'cerrado' }
  ];

  constructor(
    private cuadroService: CuadroService,
    private grupoService: GrupoService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit(): void {
    this.cargarGrupos();
    this.cargarCuadros();
  }

  cargarGrupos(): void {
    this.grupoService.getAll({ estado: true }).subscribe({
      next: (data: Grupo[]) => {
        this.grupos = data;
        this.gruposOptions = [{ label: 'Todos los grupos', value: null as any }, ...data.map((g: Grupo) => ({ label: g.nombre, value: g.id }))];
      },
      error: () => this.toast('error', 'No se pudieron cargar los grupos')
    });
  }

  cargarCuadros(): void {
    this.isLoading = true;
    this.cuadroService.getAll({
      id_grupo: this.filtroGrupo ?? undefined,
      anio: this.filtroAnio,
      mes: this.filtroMes ?? undefined,
      estado: this.filtroEstado ?? undefined
    }).subscribe({
      next: (data: Cuadro[]) => { this.cuadros = data; this.isLoading = false; },
      error: () => { this.cuadros = []; this.isLoading = false; this.toast('error', 'No se pudieron cargar los cuadros'); }
    });
  }

  abrirNuevo(): void {
    this.form = { id_grupo: null, anio: new Date().getFullYear(), mes: new Date().getMonth() + 1, observaciones: '' };
    this.showDialog = true;
  }

  guardar(): void {
    if (!this.form.id_grupo || !this.form.anio || !this.form.mes) {
      this.toast('warn', 'Grupo, año y mes son obligatorios');
      return;
    }
    this.isSaving = true;
    this.cuadroService.create({ id_grupo: this.form.id_grupo, anio: this.form.anio, mes: this.form.mes, observaciones: this.form.observaciones || undefined }).subscribe({
      next: () => { this.toast('success', 'Cuadro creado correctamente'); this.showDialog = false; this.isSaving = false; this.cargarCuadros(); },
      error: (e: any) => { this.toast('error', e.error?.message || 'Error al crear cuadro'); this.isSaving = false; }
    });
  }

  publicar(cuadro: Cuadro): void {
    this.confirmationService.confirm({
      message: `¿Publicar el cuadro de ${cuadro.nombre_mes ?? cuadro.mes}/${cuadro.anio}? Los empleados podrán verlo.`,
      header: 'Confirmar publicación',
      icon: 'pi pi-check-circle',
      acceptLabel: 'Sí, publicar',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.cuadroService.publicar(cuadro.id).subscribe({
          next: () => { this.toast('success', 'Cuadro publicado'); this.cargarCuadros(); },
          error: (e: any) => this.toast('error', e.error?.message || 'Error al publicar')
        });
      }
    });
  }

  cerrar(cuadro: Cuadro): void {
    this.confirmationService.confirm({
      message: `¿Cerrar el cuadro de ${cuadro.nombre_mes ?? cuadro.mes}/${cuadro.anio}? No se podrá editar.`,
      header: 'Confirmar cierre',
      icon: 'pi pi-lock',
      acceptLabel: 'Sí, cerrar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-warning',
      accept: () => {
        this.cuadroService.cerrar(cuadro.id).subscribe({
          next: () => { this.toast('success', 'Cuadro cerrado'); this.cargarCuadros(); },
          error: (e: any) => this.toast('error', e.error?.message || 'Error al cerrar')
        });
      }
    });
  }

  eliminar(cuadro: Cuadro): void {
    this.confirmationService.confirm({
      message: `¿Eliminar el cuadro de ${cuadro.nombre_mes ?? cuadro.mes}/${cuadro.anio}?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.cuadroService.delete(cuadro.id).subscribe({
          next: () => { this.toast('success', 'Cuadro eliminado'); this.cargarCuadros(); },
          error: (e: any) => this.toast('error', e.error?.message || 'Error al eliminar')
        });
      }
    });
  }

  getSeverity(estado: EstadoCuadro): any {
    return this.estadoConfig[estado]?.severity ?? 'secondary';
  }

  getLabel(estado: EstadoCuadro): string {
    return this.estadoConfig[estado]?.label ?? estado;
  }

  private toast(severity: string, detail: string): void {
    this.messageService.add({ severity, summary: severity === 'error' ? 'Error' : severity === 'warn' ? 'Advertencia' : 'Éxito', detail, life: 3500 });
  }
}
