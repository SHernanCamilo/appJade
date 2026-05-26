import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageService, ConfirmationService } from 'primeng/api';

import { PlantillaService } from '../services/plantilla.service';
import { Plantilla } from '../models/plantilla.model';

@Component({
  selector: 'app-plantillas-list',
  standalone: true,
  imports: [
    CommonModule, RouterModule, FormsModule,
    TableModule, ButtonModule, TagModule, ToastModule, DialogModule,
    InputTextModule, InputNumberModule, SkeletonModule, TooltipModule,
    ConfirmDialogModule, CheckboxModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './plantillas-list.component.html',
  styleUrl: './plantillas-list.component.css'
})
export class PlantillasListComponent implements OnInit {

  plantillas: Plantilla[] = [];
  isLoading = false;
  isSaving = false;
  showDialog = false;
  editMode = false;
  editId: number | null = null;

  form: Partial<Plantilla> = this.emptyForm();

  constructor(
    private plantillaService: PlantillaService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit(): void { this.cargar(); }

  cargar(): void {
    this.isLoading = true;
    this.plantillaService.getAll().subscribe({
      next: (data: Plantilla[]) => { this.plantillas = data; this.isLoading = false; },
      error: () => { this.plantillas = []; this.isLoading = false; this.toast('error', 'No se pudieron cargar las plantillas'); }
    });
  }

  abrirNuevo(): void {
    this.editMode = false; this.editId = null;
    this.form = this.emptyForm();
    this.showDialog = true;
  }

  editar(p: Plantilla): void {
    this.editMode = true; this.editId = p.id;
    this.form = { ...p };
    this.showDialog = true;
  }

  guardar(): void {
    if (!this.form.codigo || !this.form.nombre || !this.form.hora_inicio || !this.form.hora_fin) {
      this.toast('warn', 'Código, nombre y horarios son obligatorios'); return;
    }
    this.isSaving = true;
    const op$ = this.editMode && this.editId
      ? this.plantillaService.update(this.editId, this.form)
      : this.plantillaService.create(this.form);
    op$.subscribe({
      next: () => { this.toast('success', this.editMode ? 'Plantilla actualizada' : 'Plantilla creada'); this.showDialog = false; this.isSaving = false; this.cargar(); },
      error: (e: any) => { this.toast('error', e.error?.message || 'Error'); this.isSaving = false; }
    });
  }

  eliminar(p: Plantilla): void {
    this.confirmationService.confirm({
      message: `¿Eliminar la plantilla "${p.nombre}"?`,
      header: 'Confirmar',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.plantillaService.delete(p.id).subscribe({
          next: () => { this.toast('success', 'Plantilla eliminada'); this.cargar(); },
          error: (e: any) => this.toast('error', e.error?.message || 'Error')
        });
      }
    });
  }

  private emptyForm(): Partial<Plantilla> {
    return { codigo: '', nombre: '', hora_inicio: '07:00', hora_fin: '15:00', duracion_horas: 8, es_nocturno: false, color_hex: '#3498DB', estado: true };
  }

  private toast(s: string, d: string) { this.messageService.add({ severity: s, summary: s === 'error' ? 'Error' : s === 'warn' ? 'Advertencia' : 'Éxito', detail: d, life: 3500 }); }
}
