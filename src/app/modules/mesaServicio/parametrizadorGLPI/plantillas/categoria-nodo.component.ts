import { Component, EventEmitter, Injectable, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { TooltipModule } from 'primeng/tooltip';
import {
  GLPI_CATEGORIA_NIVEL_MAX,
  GlpiAnsOpcion,
  GlpiPrioridad
} from '../interfaces/glpi-plantilla.interface';

@Injectable()
export class GlpiCategoriaBusqueda {
  texto = '';
}

@Injectable()
export class GlpiCategoriaAnsOpciones {
  opciones: GlpiAnsOpcion[] = [];
}

@Component({
  selector: 'app-glpi-categoria-nodo',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    TooltipModule,
    GlpiCategoriaNodoComponent
  ],
  templateUrl: './categoria-nodo.component.html',
  styleUrl: './categoria-nodo.component.css'
})
export class GlpiCategoriaNodoComponent {
  @Input({ required: true }) nodo!: FormGroup;
  @Input() nivel = 1;
  @Input() submitted = false;
  /** Posición entre hermanas (1-based) para enumerar hojas. */
  @Input() indice = 1;
  @Output() eliminar = new EventEmitter<void>();

  readonly nivelMaximo = GLPI_CATEGORIA_NIVEL_MAX;
  expandido = false;

  constructor(
    private fb: FormBuilder,
    private busquedaState: GlpiCategoriaBusqueda,
    private ansOpciones: GlpiCategoriaAnsOpciones
  ) {}

  get opcionesAns(): GlpiAnsOpcion[] {
    return this.ansOpciones.opciones;
  }

  get busqueda(): string {
    return this.busquedaState.texto;
  }

  get hijas(): FormArray {
    return this.nodo.get('hijas') as FormArray;
  }

  get esHoja(): boolean {
    return this.hijas.length === 0;
  }

  get puedeAgregarHija(): boolean {
    return this.nivel < this.nivelMaximo;
  }

  get cantidadEnArbol(): number {
    return this.contarDescendientes(this.hijas);
  }

  get etiquetaCantidad(): string {
    if (this.esHoja) {
      return `${this.indice}.`;
    }
    return String(this.cantidadEnArbol);
  }

  get tooltipCantidad(): string {
    if (this.esHoja) {
      return `Categoría ${this.indice}`;
    }
    const n = this.cantidadEnArbol;
    return n === 1 ? '1 categoría en este árbol' : `${n} categorías en este árbol`;
  }

  get hayBusqueda(): boolean {
    return this.normalizar(this.busqueda).length > 0;
  }

  get coincide(): boolean {
    if (!this.hayBusqueda) {
      return false;
    }
    return this.normalizar(this.nodo.get('nombre')?.value).includes(this.normalizar(this.busqueda));
  }

  get visible(): boolean {
    if (!this.hayBusqueda) {
      return true;
    }
    return this.ramaCoincide(this.nodo, this.normalizar(this.busqueda));
  }

  get estaExpandido(): boolean {
    if (this.hayBusqueda && this.visible && !this.esHoja) {
      return true;
    }
    return this.expandido;
  }

  toggleRama(): void {
    if (this.esHoja) {
      return;
    }
    this.expandido = !this.expandido;
  }

  get placeholder(): string {
    if (this.nivel === 1) {
      return 'Categoría padre. Ej: EQUIPO DE COMPUTO';
    }
    if (this.nivel === this.nivelMaximo) {
      return 'Subcategoría hija. Ej: Limpieza de equipos';
    }
    return `Categoría nivel ${this.nivel}`;
  }

  agregarHija(): void {
    if (!this.puedeAgregarHija) {
      return;
    }
    this.expandido = true;
    const primera = this.opcionesAns[0];
    this.hijas.push(this.fb.group({
      nombre: ['', Validators.required],
      prioridad: [primera?.prioridad ?? 'baja', Validators.required],
      ans_nombre: [primera?.value ?? '', Validators.required],
      hijas: this.fb.array([])
    }));
  }

  onAnsChange(): void {
    const nombre = String(this.nodo.get('ans_nombre')?.value || '').trim();
    const opcion = this.opcionesAns.find((item) => item.value === nombre);
    if (opcion) {
      this.nodo.patchValue({ prioridad: opcion.prioridad as GlpiPrioridad }, { emitEvent: false });
    }
  }

  quitarHija(index: number): void {
    this.hijas.removeAt(index);
  }

  campoInvalido(nombre: string): boolean {
    const control = this.nodo.get(nombre);
    return !!control && control.invalid && (control.touched || this.submitted);
  }

  private contarDescendientes(hijas: FormArray): number {
    let total = hijas.length;
    for (const control of hijas.controls) {
      const nested = (control as FormGroup).get('hijas') as FormArray | null;
      if (nested?.length) {
        total += this.contarDescendientes(nested);
      }
    }
    return total;
  }

  private ramaCoincide(grupo: FormGroup, q: string): boolean {
    if (this.normalizar(grupo.get('nombre')?.value).includes(q)) {
      return true;
    }
    const hijas = grupo.get('hijas') as FormArray | null;
    return !!hijas?.controls.some((control) => this.ramaCoincide(control as FormGroup, q));
  }

  private normalizar(valor: unknown): string {
    return String(valor || '')
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }
}
