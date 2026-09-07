import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageModule } from 'primeng/message';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import {
  CrearFichaPayload,
  Ficha,
  OpcionesFormulario,
  ProfesionalDeEspecialidad,
} from '../../models/ficha.model';
import { ParametrosService } from '../../services/parametros.service';

/**
 * Paso 1 del generador: datos principales del contrato.
 *
 * Recibe `opciones` del padre (GeneradorFichaComponent) para evitar
 * hacer una petición duplicada — el padre ya carga y cachea las opciones.
 *
 * Profesionales: al seleccionar especialidad se hace una búsqueda a Fabric
 * filtrando por Especialidad1. El MultiSelect permite además búsqueda libre
 * escribiendo en el filtro (mínimo 2 chars → nueva petición a Fabric).
 */
@Component({
  selector: 'app-paso-datos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    SelectModule,
    MultiSelectModule,
    DatePickerModule,
    InputNumberModule,
    ButtonModule,
    MessageModule,
    SkeletonModule,
  ],
  templateUrl: './paso-datos.component.html',
  styleUrl: './paso-datos.component.css',
})
export class PasoDatosComponent implements OnDestroy {
  private readonly fb         = inject(FormBuilder);
  private readonly parametros = inject(ParametrosService);
  private readonly destroy$   = new Subject<void>();

  // ── Inputs ──────────────────────────────────────────────────────────────
  /** Opciones de los selects — las provee el padre, no se vuelven a pedir. */
  readonly opciones  = input<OpcionesFormulario | null>(null);
  /** Ficha existente en modo edición. */
  readonly ficha     = input<Ficha | null>(null);
  readonly guardando = input<boolean>(false);

  // ── Output ──────────────────────────────────────────────────────────────
  readonly continuar = output<CrearFichaPayload>();

  // ── Estado local ────────────────────────────────────────────────────────
  protected readonly profesionales          = signal<ProfesionalDeEspecialidad[]>([]);
  protected readonly cargandoProfesionales  = signal<boolean>(false);

  /** Subject para debounce del filtro de búsqueda libre en el MultiSelect. */
  private readonly filtroBusqueda$ = new Subject<string>();

  protected readonly formulario = this.fb.nonNullable.group({
    id_agremiacion:    [null as number | null, Validators.required],
    id_objeto_contrato:[null as number | null, Validators.required],
    id_especialidad:   [null as number | null, Validators.required],
    vlr_contrato:      [null as number | null, [Validators.required, Validators.min(1)]],
    vigencia:          [null as unknown,        Validators.required],
    profesionales:     [[] as string[],         [Validators.required, Validators.minLength(1)]],
    obs_os:            [''],
  });

  constructor() {
    // ── Cascada: especialidad → profesionales ────────────────────────────
    this.formulario.controls.id_especialidad.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((id) => {
        this.formulario.controls.profesionales.setValue([]);
        this.cargarPorEspecialidad(id);
      });

    // ── Búsqueda libre en MultiSelect (debounce 400 ms) ──────────────────
    this.filtroBusqueda$.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      switchMap((q) => {
        if (q.trim().length < 2) {
          return of([]);
        }
        this.cargandoProfesionales.set(true);
        return this.parametros.buscarProfesionales(q.trim(), 80);
      }),
      takeUntil(this.destroy$),
    ).subscribe({
      next: (lista) => {
        const arr = Array.isArray(lista) ? lista : [];
        if (arr.length > 0) {
          this.fusionarProfesionales(arr);
        }
        this.cargandoProfesionales.set(false);
      },
      error: () => this.cargandoProfesionales.set(false),
    });

    // ── Pre-carga en modo edición ────────────────────────────────────────
    effect(() => {
      const ficha = this.ficha();
      if (!ficha) return;

      this.formulario.patchValue({
        id_agremiacion:    ficha.id_agremiacion,
        id_objeto_contrato: ficha.id_objeto_contrato,
        id_especialidad:   ficha.id_especialidad,
        vlr_contrato:      Number(ficha.vlr_contrato),
        vigencia: [
          new Date(`${ficha.fecha_ini}T00:00:00`),
          new Date(`${ficha.fecha_fin}T00:00:00`),
        ],
        profesionales: (ficha.profesionales ?? []).map((p) => p.codigo ?? String(p.id)),
        obs_os: ficha.obs_os ?? '',
      });

      // Cargar profesionales de la especialidad guardada
      this.cargarPorEspecialidad(ficha.id_especialidad);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Getters del template ────────────────────────────────────────────────
  protected get esActualizacion(): boolean {
    return this.ficha()?.id_padre != null;
  }

  // ── Filtro del MultiSelect ──────────────────────────────────────────────
  /**
   * Llamado desde (onFilter) del p-multiselect.
   * Si el usuario escribe ≥2 chars, busca en Fabric en tiempo real.
   */
  protected onFiltroMultiselect(evento: { filter: string }): void {
    this.filtroBusqueda$.next(evento.filter ?? '');
  }

  // ── Envío del formulario ────────────────────────────────────────────────
  protected enviar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const v       = this.formulario.getRawValue();
    const vigencia = v.vigencia as Date[] | null;
    const inicio  = vigencia?.[0];
    const fin     = vigencia?.[1];

    if (!inicio || !fin) return;

    this.continuar.emit({
      id_agremiacion:     v.id_agremiacion!,
      id_objeto_contrato: v.id_objeto_contrato!,
      id_especialidad:    v.id_especialidad!,
      vlr_contrato:       v.vlr_contrato!,
      fecha_ini:          this.aIso(inicio),
      fecha_fin:          this.aIso(fin),
      profesionales:      v.profesionales as string[],
      obs_os:             v.obs_os.trim() || null,
    });
  }

  protected control(nombre: keyof typeof this.formulario.controls): boolean {
    const c = this.formulario.controls[nombre];
    return c.invalid && (c.dirty || c.touched);
  }

  // ── Helpers privados ────────────────────────────────────────────────────

  /**
   * Carga profesionales filtrando por el texto de la especialidad seleccionada.
   * Busca la descripción en el catálogo local de opciones para pasarla a Fabric.
   */
  private cargarPorEspecialidad(idEspecialidad: number | null): void {
    if (!idEspecialidad) {
      this.profesionales.set([]);
      return;
    }

    const descripcion = this.opciones()?.especialidades
      ?.find((e) => e.id === idEspecialidad)?.descripcion ?? '';

    this.cargandoProfesionales.set(true);

    const obs$ = descripcion.trim()
      ? this.parametros.profesionalesPorEspecialidad(descripcion, 100)
      : this.parametros.buscarProfesionales('a', 80);

    obs$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (lista) => {
        // Garantizar que siempre sea un array plano antes de asignar al signal
        this.profesionales.set(Array.isArray(lista) ? lista : []);
        this.cargandoProfesionales.set(false);
      },
      error: () => {
        this.profesionales.set([]);
        this.cargandoProfesionales.set(false);
      },
    });
  }

  /**
   * Fusiona lista nueva con los ya cargados, sin perder los seleccionados.
   * Evita duplicados por `codigo`.
   */
  private fusionarProfesionales(nuevos: ProfesionalDeEspecialidad[]): void {
    const existentes  = this.profesionales();
    const seleccionados = new Set(this.formulario.controls.profesionales.value as string[]);

    // Conservar los ya seleccionados aunque no estén en la búsqueda nueva
    const base = existentes.filter((p) => seleccionados.has(p.codigo));
    const codigos = new Set(base.map((p) => p.codigo));

    for (const p of nuevos) {
      if (!codigos.has(p.codigo)) {
        base.push(p);
        codigos.add(p.codigo);
      }
    }

    this.profesionales.set(base);
  }

  private aIso(fecha: Date): string {
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
  }
}
