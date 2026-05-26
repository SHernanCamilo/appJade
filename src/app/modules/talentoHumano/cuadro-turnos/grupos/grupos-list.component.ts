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
import { TextareaModule } from 'primeng/textarea';
import { MessageService, ConfirmationService } from 'primeng/api';

import { GrupoService } from '../services/grupo.service';
import { Grupo } from '../models/grupo.model';

@Component({
  selector: 'app-grupos-list',
  standalone: true,
  imports: [
    CommonModule, RouterModule, FormsModule,
    TableModule, ButtonModule, TagModule, ToastModule, DialogModule,
    DropdownModule, InputTextModule, SkeletonModule, TooltipModule,
    ConfirmDialogModule, TextareaModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './grupos-list.component.html',
  styleUrl: './grupos-list.component.css'
})
export class GruposListComponent implements OnInit {

  grupos: Grupo[] = [];
  isLoading = false;
  isSaving = false;
  showDialog = false;
  editMode = false;
  editId: number | null = null;

  form: Partial<Grupo> = { codigo: '', nombre: '', descripcion: '', id_empresa: 1, id_sede: null };

  constructor(
    private grupoService: GrupoService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit(): void { this.cargar(); }

  cargar(): void {
    this.isLoading = true;
    this.grupoService.getAll().subscribe({
      next: (data: Grupo[]) => { this.grupos = data; this.isLoading = false; },
      error: () => { this.grupos = []; this.isLoading = false; this.toast('error', 'No se pudieron cargar los grupos'); }
    });
  }

  abrirNuevo(): void {
    this.editMode = false; this.editId = null;
    this.form = { codigo: '', nombre: '', descripcion: '', id_empresa: 1, id_sede: null };
    this.showDialog = true;
  }

  editar(g: Grupo): void {
    this.editMode = true; this.editId = g.id;
    this.form = { codigo: g.codigo, nombre: g.nombre, descripcion: g.descripcion ?? '', id_empresa: g.id_empresa, id_sede: g.id_sede };
    this.showDialog = true;
  }

  guardar(): void {
    if (!this.form.codigo || !this.form.nombre) { this.toast('warn', 'Código y nombre son obligatorios'); return; }
    this.isSaving = true;
    const op$ = this.editMode && this.editId
      ? this.grupoService.update(this.editId, this.form)
      : this.grupoService.create(this.form);
    op$.subscribe({
      next: () => { this.toast('success', this.editMode ? 'Grupo actualizado' : 'Grupo creado'); this.showDialog = false; this.isSaving = false; this.cargar(); },
      error: (e: any) => { this.toast('error', e.error?.message || 'Error al guardar'); this.isSaving = false; }
    });
  }

  eliminar(g: Grupo): void {
    this.confirmationService.confirm({
      message: `¿Desactivar el grupo "${g.nombre}"?`,
      header: 'Confirmar',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.grupoService.delete(g.id).subscribe({
          next: () => { this.toast('success', 'Grupo desactivado'); this.cargar(); },
          error: (e: any) => this.toast('error', e.error?.message || 'Error')
        });
      }
    });
  }

  private toast(s: string, d: string) { this.messageService.add({ severity: s, summary: s === 'error' ? 'Error' : s === 'warn' ? 'Advertencia' : 'Éxito', detail: d, life: 3500 }); }
}
