import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { DropdownModule } from 'primeng/dropdown';
import { TableModule } from 'primeng/table';
import { InputSwitchModule } from 'primeng/inputswitch';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { firstValueFrom } from 'rxjs';

import {
  FORMULARIOS_PARAMETRIZABLES,
  formularioPorCodigo
} from './catalogs/formularios-parametrizables.catalog';
import {
  CampoParametroRow,
  FormularioParametrizable,
  mergeCamposCatalogo,
  toCamposPayload
} from './models/form-parametros.model';
import { FormParametrosService } from './services/form-parametros.service';

@Component({
  selector: 'app-formularios-parametros',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    ToastModule,
    DropdownModule,
    TableModule,
    InputSwitchModule,
    InputTextModule,
    TagModule,
    TooltipModule
  ],
  providers: [MessageService],
  templateUrl: './parametros.component.html',
  styleUrl: './parametros.component.css'
})
export class FormulariosParametrosComponent implements OnInit {
  readonly formularios = FORMULARIOS_PARAMETRIZABLES.filter(f => f.parametrizable);
  readonly formularioOptions = this.formularios.map(f => ({
    label: f.titulo,
    value: f.codigo
  }));

  codigoSeleccionado: string | null = null;
  formulario: FormularioParametrizable | null = null;
  campos: CampoParametroRow[] = [];
  filtro = '';
  isLoading = false;
  isSaving = false;

  constructor(
    private readonly parametrosService: FormParametrosService,
    private readonly messageService: MessageService
  ) {}

  ngOnInit(): void {
    if (this.formularios.length === 1) {
      void this.seleccionarFormulario(this.formularios[0].codigo);
    }
  }

  get camposVisibles(): CampoParametroRow[] {
    const q = this.filtro.trim().toLowerCase();
    if (!q) {
      return this.campos;
    }
    return this.campos.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.seccion.toLowerCase().includes(q) ||
      c.key.toLowerCase().includes(q)
    );
  }

  get totalVisibles(): number {
    return this.campos.filter(c => c.visible).length;
  }

  get totalRequeridos(): number {
    return this.campos.filter(c => c.visible && c.requerido).length;
  }

  async onFormularioChange(codigo: string | null): Promise<void> {
    await this.seleccionarFormulario(codigo);
  }

  onVisibleChange(row: CampoParametroRow): void {
    if (!row.visible) {
      row.requerido = false;
    }
  }

  onRequeridoChange(row: CampoParametroRow): void {
    if (row.requerido) {
      row.visible = true;
    }
  }

  async guardar(): Promise<void> {
    if (!this.codigoSeleccionado || this.isSaving) {
      return;
    }

    this.isSaving = true;
    try {
      await firstValueFrom(
        this.parametrosService.guardar(this.codigoSeleccionado, toCamposPayload(this.campos))
      );
      this.messageService.add({
        severity: 'success',
        summary: 'Parámetros guardados',
        detail: 'La configuración de campos quedó registrada.',
        life: 4000
      });
    } catch (err) {
      const httpErr = err as { error?: { message?: string } };
      this.messageService.add({
        severity: 'error',
        summary: 'No se pudo guardar',
        detail: httpErr?.error?.message || 'Ocurrió un error al guardar los parámetros.',
        life: 6000
      });
    } finally {
      this.isSaving = false;
    }
  }

  restaurarDefecto(): void {
    if (!this.formulario) {
      return;
    }
    this.campos = mergeCamposCatalogo(this.formulario.campos, null);
    this.messageService.add({
      severity: 'info',
      summary: 'Valores por defecto',
      detail: 'Se restauró la configuración original. Guarde para aplicarla.',
      life: 4000
    });
  }

  private async seleccionarFormulario(codigo: string | null): Promise<void> {
    this.codigoSeleccionado = codigo;
    this.filtro = '';
    const def = formularioPorCodigo(codigo ?? undefined);
    this.formulario = def ?? null;
    this.campos = [];

    if (!def) {
      return;
    }

    this.isLoading = true;
    try {
      const guardados = await firstValueFrom(this.parametrosService.obtener(def.codigo));
      this.campos = mergeCamposCatalogo(def.campos, guardados);
    } catch {
      this.campos = mergeCamposCatalogo(def.campos, null);
    } finally {
      this.isLoading = false;
    }
  }
}
