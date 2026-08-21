import { Component, DestroyRef, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DropdownModule } from 'primeng/dropdown';
import { InputSwitchModule } from 'primeng/inputswitch';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';

import { GlpiPlantillaService } from '../services/glpi-plantilla.service';
import { GlpiCategoriaNodoComponent } from './categoria-nodo.component';
import { GlpiCategoriaAnsOpciones, GlpiCategoriaBusqueda } from './glpi-categoria.state';
import {
  GLPI_PRIORIDADES,
  GLPI_UNIDADES,
  GlpiAnsOpcion,
  GlpiCategoriaNodo,
  GlpiPlantillaAns,
  GlpiPlantillaPayload,
  GlpiPrioridad
} from '../interfaces/glpi-plantilla.interface';

@Component({
  selector: 'app-glpi-plantilla-editor',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    DropdownModule,
    InputSwitchModule,
    ToastModule,
    TooltipModule,
    SkeletonModule,
    GlpiCategoriaNodoComponent
  ],
  providers: [MessageService, GlpiCategoriaBusqueda, GlpiCategoriaAnsOpciones],
  templateUrl: './plantilla-editor.component.html',
  styleUrl: './plantilla-editor.component.css'
})
export class GlpiPlantillaEditorComponent implements OnInit {
  readonly prioridades = GLPI_PRIORIDADES;
  readonly unidades = GLPI_UNIDADES;
  readonly maxAns = 20;

  form: FormGroup;
  isEdit = false;
  plantillaId?: number;
  isLoading = false;
  isSaving = false;
  submitted = false;

  get busquedaCategoria(): string {
    return this.busquedaState.texto;
  }

  set busquedaCategoria(valor: string) {
    this.busquedaState.texto = valor;
  }

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private plantillaService: GlpiPlantillaService,
    private messageService: MessageService,
    private busquedaState: GlpiCategoriaBusqueda,
    private ansOpciones: GlpiCategoriaAnsOpciones,
    private destroyRef: DestroyRef
  ) {
    this.form = this.fb.group({
      codigo: ['', [Validators.required, Validators.maxLength(40)]],
      nombre: ['', [Validators.required, Validators.maxLength(150)]],
      descripcion: [''],
      id_empresa: [null],
      nombre_entidad: [''],
      grupo_tecnico: [''],
      sla_asignacion: [''],
      prefijo_regla: ['TIC'],
      estado: [true],
      ans: this.fb.array(this.buildAnsControls('TIC')),
      categoriasPadre: this.fb.array([])
    });

    this.refrescarOpcionesAns();
    this.ans.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refrescarOpcionesAns());
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.isEdit = true;
      this.plantillaId = Number(idParam);
      this.cargarPlantilla(this.plantillaId);
    }
  }

  get ans(): FormArray {
    return this.form.get('ans') as FormArray;
  }

  get categoriasPadre(): FormArray {
    return this.form.get('categoriasPadre') as FormArray;
  }

  get coincidenciasCategoria(): number {
    const q = this.normalizarBusqueda(this.busquedaCategoria);
    if (!q) {
      return 0;
    }
    return this.contarCoincidencias(this.categoriasPadre, q);
  }

  etiquetaPrioridad(prioridad: string): string {
    return this.prioridades.find((p) => p.value === prioridad)?.label ?? prioridad;
  }

  agregarAns(): void {
    if (this.ans.length >= this.maxAns) {
      return;
    }
    const prefijo = String(this.form.get('prefijo_regla')?.value || 'TIC').trim().toUpperCase() || 'TIC';
    this.ans.push(this.buildAnsGroup('baja', prefijo));
  }

  quitarAns(index: number): void {
    if (this.ans.length <= 1) {
      return;
    }
    this.ans.removeAt(index);
  }

  onPrioridadAnsChange(index: number): void {
    const fila = this.ans.at(index);
    const prioridad = fila.get('prioridad')?.value as GlpiPrioridad;
    const prefijo = String(this.form.get('prefijo_regla')?.value || 'TIC').trim().toUpperCase() || 'TIC';
    const meta = this.prioridades.find((p) => p.value === prioridad);
    if (!meta) {
      return;
    }
    const nombre = `${meta.nombre} ${prefijo}`.trim();
    const sla = String(fila.get('nombre_sla_solucion')?.value || '').trim();
    const regla = String(fila.get('nombre_regla')?.value || '').trim();
    // Solo autocompleta si el usuario aún no personalizó los nombres.
    if (!sla || this.esNombreAnsPorDefecto(sla, prefijo)) {
      fila.patchValue({ nombre_sla_solucion: nombre });
    }
    if (!regla || this.esNombreAnsPorDefecto(regla, prefijo)) {
      fila.patchValue({ nombre_regla: nombre });
    }
  }

  agregarPadre(): void {
    this.categoriasPadre.push(this.buildNodoGroup());
  }

  quitarPadre(index: number): void {
    this.categoriasPadre.removeAt(index);
  }

  guardar(): void {
    this.submitted = true;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.messageService.add({
        severity: 'warn',
        summary: 'Revisa el formulario',
        detail: 'Completa los campos obligatorios antes de guardar'
      });
      return;
    }

    const payload = this.toPayload();
    this.isSaving = true;

    const request$ = this.isEdit && this.plantillaId
      ? this.plantillaService.actualizar(this.plantillaId, payload)
      : this.plantillaService.crear(payload);

    request$.subscribe({
      next: () => {
        this.isSaving = false;
        this.messageService.add({
          severity: 'success',
          summary: 'Guardado',
          detail: this.isEdit ? 'Plantilla actualizada' : 'Plantilla creada'
        });
        this.router.navigate(['/mesaServicio/parametrizadorGLPI/plantillas']);
      },
      error: (error) => {
        this.isSaving = false;
        const backendMessage = error?.error?.message
          || (error?.error?.errors ? Object.values(error.error.errors).flat().join(' ') : null);
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo guardar',
          detail: backendMessage || 'Revisa los datos e inténtalo de nuevo'
        });
      }
    });
  }

  cancelar(): void {
    this.router.navigate(['/mesaServicio/parametrizadorGLPI/plantillas']);
  }

  private cargarPlantilla(id: number): void {
    this.isLoading = true;
    this.plantillaService.obtener(id).subscribe({
      next: (plantilla) => {
        this.form.patchValue({
          codigo: plantilla.codigo,
          nombre: plantilla.nombre,
          descripcion: plantilla.descripcion ?? '',
          id_empresa: plantilla.id_empresa ?? null,
          nombre_entidad: plantilla.nombre_entidad ?? '',
          grupo_tecnico: plantilla.grupo_tecnico ?? '',
          sla_asignacion: plantilla.sla_asignacion ?? '',
          prefijo_regla: plantilla.prefijo_regla || 'TIC',
          estado: plantilla.estado !== false
        });

        this.patchAns(plantilla.ans || [], plantilla.prefijo_regla || 'TIC');
        this.cargarArbolCategorias(plantilla.categorias || []);
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo cargar la plantilla'
        });
        this.cancelar();
      }
    });
  }

  private cargarArbolCategorias(categorias: GlpiCategoriaNodo[]): void {
    this.categoriasPadre.clear();
    categorias.forEach((nodo) => {
      this.categoriasPadre.push(this.buildNodoGroup(nodo));
    });
  }

  private buildNodoGroup(nodo?: GlpiCategoriaNodo): FormGroup {
    const group = this.fb.group({
      nombre: [nodo?.nombre ?? nodo?.categoria ?? '', Validators.required],
      prioridad: [nodo?.prioridad ?? 'baja', Validators.required],
      ans_nombre: [this.inferirAnsNombre(nodo), Validators.required],
      hijas: this.fb.array([])
    });

    (nodo?.hijas || []).forEach((hija) => {
      (group.get('hijas') as FormArray).push(this.buildNodoGroup(hija));
    });

    return group;
  }

  private buildAnsControls(prefijo: string): FormGroup[] {
    return this.prioridades.map((p) => this.buildAnsGroup(p.value, prefijo));
  }

  private buildAnsGroup(prioridad: GlpiPrioridad, prefijo: string, fila?: GlpiPlantillaAns): FormGroup {
    const meta = this.prioridades.find((p) => p.value === prioridad) ?? this.prioridades[0];
    const defaults = `${meta.nombre} ${prefijo}`.trim();

    return this.fb.group({
      prioridad: [prioridad, Validators.required],
      tiempo_asignacion: [fila?.tiempo_asignacion ?? null],
      unidad_asignacion: [fila?.unidad_asignacion ?? 'hora'],
      tiempo_solucion: [fila?.tiempo_solucion ?? null],
      unidad_solucion: [fila?.unidad_solucion ?? 'hora'],
      nombre_sla_solucion: [fila?.nombre_sla_solucion || defaults],
      nombre_regla: [fila?.nombre_regla || defaults]
    });
  }

  private patchAns(ans: GlpiPlantillaAns[], prefijo: string): void {
    this.ans.clear();

    if (!ans.length) {
      this.buildAnsControls(prefijo).forEach((group) => this.ans.push(group));
      return;
    }

    ans.forEach((fila) => {
      const prioridad = (fila.prioridad || 'baja') as GlpiPrioridad;
      this.ans.push(this.buildAnsGroup(prioridad, prefijo, fila));
    });
    this.refrescarOpcionesAns();
  }

  private refrescarOpcionesAns(): void {
    const vistos = new Set<string>();
    const opciones: GlpiAnsOpcion[] = [];

    this.ans.controls.forEach((control, index) => {
      const prioridad = (control.get('prioridad')?.value || 'baja') as GlpiPrioridad;
      const nombre = String(control.get('nombre_regla')?.value || '').trim()
        || `${this.prioridades.find((p) => p.value === prioridad)?.nombre || prioridad} ${index + 1}`;
      if (vistos.has(nombre)) {
        return;
      }
      vistos.add(nombre);
      opciones.push({
        label: nombre,
        value: nombre,
        prioridad
      });
    });

    this.ansOpciones.opciones = opciones;
  }

  private inferirAnsNombre(nodo?: GlpiCategoriaNodo): string {
    const actual = String(nodo?.ans_nombre || '').trim();
    if (actual) {
      return actual;
    }
    const prioridad = (nodo?.prioridad || 'baja') as GlpiPrioridad;
    const porPrioridad = this.ansOpciones.opciones.find((item) => item.prioridad === prioridad);
    return porPrioridad?.value ?? this.ansOpciones.opciones[0]?.value ?? '';
  }

  private esNombreAnsPorDefecto(valor: string, prefijo: string): boolean {
    const normalizado = valor.trim().toUpperCase();
    return this.prioridades.some((p) => {
      const base = p.nombre.trim().toUpperCase();
      const conPrefijo = `${base} ${prefijo}`.trim().toUpperCase();
      return normalizado === base || normalizado === conPrefijo;
    });
  }

  private toPayload(): GlpiPlantillaPayload {
    const value = this.form.getRawValue();

    return {
      codigo: String(value.codigo || '').trim().toUpperCase(),
      nombre: String(value.nombre || '').trim(),
      descripcion: value.descripcion || null,
      id_empresa: value.id_empresa || null,
      nombre_entidad: value.nombre_entidad || null,
      grupo_tecnico: value.grupo_tecnico || null,
      sla_asignacion: value.sla_asignacion || null,
      prefijo_regla: String(value.prefijo_regla || 'TIC').trim().toUpperCase(),
      estado: !!value.estado,
      ans: (value.ans as GlpiPlantillaAns[]).map((fila) => ({
        ...fila,
        prioridad: fila.prioridad as GlpiPrioridad,
        tiempo_asignacion: fila.tiempo_asignacion || null,
        tiempo_solucion: fila.tiempo_solucion || null
      })),
      categorias: this.limpiarArbol(value.categoriasPadre || [])
    };
  }

  private limpiarArbol(nodos: GlpiCategoriaNodo[] | null | undefined): GlpiCategoriaNodo[] {
    const limpios: GlpiCategoriaNodo[] = [];

    for (const nodo of nodos || []) {
      const nombre = String(nodo?.nombre || '').trim();
      if (!nombre) {
        continue;
      }

      limpios.push({
        nombre,
        prioridad: nodo.prioridad || 'baja',
        ans_nombre: String(nodo.ans_nombre || '').trim() || null,
        hijas: this.limpiarArbol(nodo.hijas)
      });
    }

    return limpios;
  }

  campoInvalido(control: AbstractControl | null): boolean {
    return !!control && control.invalid && (control.touched || this.submitted);
  }

  private contarCoincidencias(nodos: FormArray, q: string): number {
    let total = 0;
    for (const control of nodos.controls) {
      const grupo = control as FormGroup;
      if (this.normalizarBusqueda(grupo.get('nombre')?.value).includes(q)) {
        total++;
      }
      const hijas = grupo.get('hijas') as FormArray | null;
      if (hijas?.length) {
        total += this.contarCoincidencias(hijas, q);
      }
    }
    return total;
  }

  private normalizarBusqueda(valor: unknown): string {
    return String(valor || '')
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }
}
