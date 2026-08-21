import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextarea } from 'primeng/inputtextarea';
import { DropdownModule } from 'primeng/dropdown';
import { InputSwitchModule } from 'primeng/inputswitch';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ChipModule } from 'primeng/chip';
import { MessageModule } from 'primeng/message';

import { ConceptoService, Concepto, ProbarFormulaResponse } from '../services/concepto.service';

@Component({
  selector: 'app-conceptos-cuadro',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    InputTextarea,
    DropdownModule,
    InputSwitchModule,
    TagModule,
    TooltipModule,
    ChipModule,
    MessageModule
  ],
  templateUrl: './conceptos-cuadro.component.html',
  styleUrls: ['./conceptos-cuadro.component.css']
})
export class ConceptosCuadroComponent implements OnInit {

  conceptos: Concepto[] = [];
  variablesDisponibles: string[] = [];
  loading = false;

  // Modal crear/editar
  showModal = false;
  editMode = false;
  conceptoForm: Concepto = this.emptyConcepto();

  tiposConcepto = [
    { label: 'Devengado', value: 'devengado' },
    { label: 'Deducido', value: 'deducido' }
  ];

  // Probar fórmula
  showProbarPanel = false;
  variablesPrueba: { [key: string]: number } = {};
  resultadoPrueba: ProbarFormulaResponse | null = null;
  probando = false;

  constructor(private conceptoService: ConceptoService) {}

  ngOnInit(): void {
    this.cargarConceptos();
    this.cargarVariables();
  }

  cargarConceptos(): void {
    this.loading = true;
    this.conceptoService.getAll().subscribe({
      next: (data) => { this.conceptos = data; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  cargarVariables(): void {
    this.conceptoService.getVariables().subscribe({
      next: (vars) => { this.variablesDisponibles = vars; }
    });
  }

  // ── Modal ────────────────────────────────────────────────────────────────

  abrirCrear(): void {
    this.editMode = false;
    this.conceptoForm = this.emptyConcepto();
    this.resultadoPrueba = null;
    this.showProbarPanel = false;
    this.showModal = true;
  }

  abrirEditar(concepto: Concepto): void {
    this.editMode = true;
    this.conceptoForm = { ...concepto };
    this.resultadoPrueba = null;
    this.showProbarPanel = false;
    this.showModal = true;
  }

  guardar(): void {
    if (this.editMode && this.conceptoForm.id) {
      this.conceptoService.update(this.conceptoForm.id, this.conceptoForm).subscribe({
        next: () => { this.showModal = false; this.cargarConceptos(); },
        error: (err) => { alert(err?.error?.message || 'Error al guardar'); }
      });
    } else {
      this.conceptoService.create(this.conceptoForm).subscribe({
        next: () => { this.showModal = false; this.cargarConceptos(); },
        error: (err) => { alert(err?.error?.message || 'Error al crear'); }
      });
    }
  }

  eliminar(concepto: Concepto): void {
    if (!confirm(`¿Eliminar concepto "${concepto.codigo} - ${concepto.nombre}"?`)) return;
    this.conceptoService.delete(concepto.id!).subscribe({
      next: () => { this.cargarConceptos(); }
    });
  }

  // ── Fórmula ──────────────────────────────────────────────────────────────

  insertarVariable(variable: string): void {
    this.conceptoForm.formula += `[${variable}]`;
  }

  toggleProbar(): void {
    this.showProbarPanel = !this.showProbarPanel;
    if (this.showProbarPanel) {
      this.prepararVariablesPrueba();
    }
  }

  prepararVariablesPrueba(): void {
    this.variablesPrueba = {};
    const regex = /\[([^\]]+)\]/g;
    let match;
    while ((match = regex.exec(this.conceptoForm.formula)) !== null) {
      this.variablesPrueba[match[1]] = 0;
    }
    this.resultadoPrueba = null;
  }

  probarFormula(): void {
    this.probando = true;
    this.conceptoService.probarFormula({
      formula: this.conceptoForm.formula,
      variables: this.variablesPrueba
    }).subscribe({
      next: (res) => { this.resultadoPrueba = res; this.probando = false; },
      error: () => { this.probando = false; }
    });
  }

  getVariablesPruebaKeys(): string[] {
    return Object.keys(this.variablesPrueba);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private emptyConcepto(): Concepto {
    return { codigo: '', nombre: '', tipo_concepto: 'devengado', formula: '', activo: true };
  }

  get formValido(): boolean {
    return !!(this.conceptoForm.codigo?.trim()
      && this.conceptoForm.nombre?.trim()
      && this.conceptoForm.tipo_concepto
      && this.conceptoForm.formula?.trim());
  }
}
