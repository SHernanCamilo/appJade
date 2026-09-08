import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
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
  Sede,
  TipoAlcance,
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
export class PasoDatosComponent implements OnInit, OnDestroy {
  private readonly fb         = inject(FormBuilder);
  private readonly parametros = inject(ParametrosService);
  private readonly destroy$   = new Subject<void>();

  // ── Inputs ──────────────────────────────────────────────────────────────
  /** Opciones de los selects — las provee el padre, no se vuelven a pedir. */
  readonly opciones  = input<OpcionesFormulario | null>(null);
  /** Ficha existente en modo edición. */
  readonly ficha     = input<Ficha | null>(null);
  readonly guardando = input<boolean>(false);
  /**
   * Datos previos del paso 1 — se reciben cuando el usuario vuelve del paso 2.
   * Al recibirlos se re-hidrata el formulario sin perder los valores ingresados.
   */
  readonly datosPrevios = input<CrearFichaPayload | null>(null);

  // ── Output ──────────────────────────────────────────────────────────────
  readonly continuar = output<CrearFichaPayload>();
  /** Mapa código→nombre de los profesionales seleccionados (para la revisión). */
  readonly profesionalesInfo = output<Record<string, string>>();

  // ── Estado local ────────────────────────────────────────────────────────
  protected readonly profesionales          = signal<ProfesionalDeEspecialidad[]>([]);
  protected readonly cargandoProfesionales  = signal<boolean>(false);

  /** Subject para debounce del filtro de búsqueda libre en el MultiSelect. */
  private readonly filtroBusqueda$ = new Subject<string>();

  protected readonly formulario = this.fb.nonNullable.group({
    id_agremiacion:    [null as number | null, Validators.required],
    id_objeto_contrato:[null as number | null, Validators.required],
    id_forma_pago:     [null as number | null, Validators.required],
    id_especialidad:   [null as number | null, Validators.required],
    tipo_alcance:      ['sucursal' as TipoAlcance, Validators.required],
    sucursales:        [[] as number[]],
    sedes:             [[] as number[]],
    vlr_contrato:      [null as number | null, [Validators.required, Validators.min(1)]],
    vigencia:          [null as unknown,        Validators.required],
    profesionales:     [[] as string[],         [Validators.required, Validators.minLength(1)]],
    obs_os:            [''],
  });

  /** Opciones de alcance para el select. */
  protected readonly OPCIONES_ALCANCE: { label: string; value: TipoAlcance }[] = [
    { label: 'Nacional (todas las sucursales)', value: 'nacional' },
    { label: 'Por sucursal(es)',                value: 'sucursal' },
    { label: 'Por sede(s)',                     value: 'sede' },
  ];

  /** Sedes disponibles según las sucursales elegidas (cascada). */
  protected readonly sedes = signal<Sede[]>([]);
  protected readonly cargandoSedes = signal<boolean>(false);

  constructor() {
    // ── Cascada: especialidad → profesionales ────────────────────────────
    this.formulario.controls.id_especialidad.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((id) => {
        this.formulario.controls.profesionales.setValue([]);
        this.cargarPorEspecialidad(id);
      });

    // ── Alcance: ajustar validadores requeridos según el tipo ────────────
    this.formulario.controls.tipo_alcance.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((tipo) => this.aplicarValidadoresAlcance(tipo, true));

    // ── Cascada: sucursales → sedes ──────────────────────────────────────
    this.formulario.controls.sucursales.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((ids) => this.cargarSedes(ids ?? []));

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

  }

  /**
   * Restaura el formulario al crearse el componente:
   *  - Modo edición (ficha existente): pre-carga desde la ficha.
   *  - Volver del paso 2 (datosPrevios): re-hidrata la cabecera guardada.
   *
   * Los inputs signal ya tienen su valor cuando corre ngOnInit (el padre
   * los enlaza antes del primer render), por eso es determinístico —
   * a diferencia de effect(), que dependía del orden de detección.
   */
  ngOnInit(): void {
    const ficha = this.ficha();
    const prev  = this.datosPrevios();

    // ── Modo edición ──
    if (ficha) {
      this.formulario.patchValue({
        id_agremiacion:     ficha.id_agremiacion,
        id_objeto_contrato: ficha.id_objeto_contrato,
        id_forma_pago:      ficha.id_forma_pago ?? null,
        id_especialidad:    ficha.id_especialidad,
        vlr_contrato:       Number(ficha.vlr_contrato),
        vigencia: [
          new Date(`${ficha.fecha_ini}T00:00:00`),
          new Date(`${ficha.fecha_fin}T00:00:00`),
        ],
        profesionales: (ficha.profesionales ?? []).map((p) => p.codigo ?? String(p.id)),
        obs_os: ficha.obs_os ?? '',
      }, { emitEvent: false });

      this.cargarPorEspecialidadSinLimpiar(
        ficha.id_especialidad,
        (ficha.profesionales ?? []).map((p) => p.codigo ?? String(p.id)),
      );
      return;
    }

    // ── Volver del paso 2: restaurar cabecera guardada ──
    if (prev) {
      const tipoPrev = (prev.tipo_alcance ?? 'sucursal') as TipoAlcance;
      this.formulario.patchValue({
        id_agremiacion:     prev.id_agremiacion,
        id_objeto_contrato: prev.id_objeto_contrato,
        id_forma_pago:      prev.id_forma_pago ?? null,
        id_especialidad:    prev.id_especialidad,
        tipo_alcance:       tipoPrev,
        sucursales:         prev.sucursales ?? [],
        sedes:              prev.sedes ?? [],
        vlr_contrato:       prev.vlr_contrato,
        vigencia: [
          new Date(`${prev.fecha_ini}T00:00:00`),
          new Date(`${prev.fecha_fin}T00:00:00`),
        ],
        profesionales: prev.profesionales ?? [],
        obs_os: prev.obs_os ?? '',
      }, { emitEvent: false }); // no dispara las cascadas

      this.aplicarValidadoresAlcance(tipoPrev, false);
      if ((prev.sucursales ?? []).length > 0) {
        this.cargarSedes(prev.sucursales ?? []);
      }
      this.cargarPorEspecialidadSinLimpiar(prev.id_especialidad, prev.profesionales ?? []);
    }
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

    const codigos = v.profesionales as string[];

    // Emitir el mapa código→nombre para que la revisión muestre los nombres
    const mapa: Record<string, string> = {};
    for (const cod of codigos) {
      const prof = this.profesionales().find((p) => p.codigo === cod);
      mapa[cod] = prof?.nombre ?? cod;
    }
    this.profesionalesInfo.emit(mapa);

    const tipoAlcance = v.tipo_alcance as TipoAlcance;

    this.continuar.emit({
      id_agremiacion:     v.id_agremiacion!,
      id_objeto_contrato: v.id_objeto_contrato!,
      id_forma_pago:      v.id_forma_pago ?? null,
      id_especialidad:    v.id_especialidad!,
      tipo_alcance:       tipoAlcance,
      sucursales:         tipoAlcance === 'nacional' ? [] : (v.sucursales as number[]),
      sedes:              tipoAlcance === 'sede' ? (v.sedes as number[]) : [],
      vlr_contrato:       v.vlr_contrato!,
      fecha_ini:          this.aIso(inicio),
      fecha_fin:          this.aIso(fin),
      profesionales:      codigos,
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
  /**
   * Carga profesionales filtrando por el texto de la especialidad seleccionada.
   * Limpia los profesionales seleccionados (se usa al cambiar especialidad).
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
   * Carga profesionales SIN limpiar los seleccionados.
   * Se usa al restaurar el formulario desde datosPrevios para que los chips
   * sigan visibles aunque Fabric tarde en responder.
   */
  private cargarPorEspecialidadSinLimpiar(idEspecialidad: number | null, codigosSeleccionados: string[]): void {
    if (!idEspecialidad) return;

    const descripcion = this.opciones()?.especialidades
      ?.find((e) => e.id === idEspecialidad)?.descripcion ?? '';

    this.cargandoProfesionales.set(true);

    const obs$ = descripcion.trim()
      ? this.parametros.profesionalesPorEspecialidad(descripcion, 100)
      : this.parametros.buscarProfesionales('a', 80);

    obs$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (lista) => {
        const arr = Array.isArray(lista) ? lista : [];
        // Asegurarse de que los seleccionados estén en la lista aunque no vengan de Fabric
        const codigos = new Set(arr.map((p) => p.codigo));
        const extras = codigosSeleccionados
          .filter((c) => !codigos.has(c))
          .map((c): ProfesionalDeEspecialidad => ({ codigo: c, nombre: c, profesion: null, sucursal_sede: null }));

        this.profesionales.set([...arr, ...extras]);
        this.cargandoProfesionales.set(false);
      },
      error: () => {
        // En caso de error, crear entries mínimas para que los chips sean visibles
        const minimos = codigosSeleccionados.map(
          (c): ProfesionalDeEspecialidad => ({ codigo: c, nombre: c, profesion: null, sucursal_sede: null })
        );
        this.profesionales.set(minimos);
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

  /**
   * Ajusta los validadores requeridos de sucursales/sedes según el alcance.
   *  - nacional → ninguno requerido, limpia selecciones.
   *  - sucursal → sucursales requerido.
   *  - sede     → sucursales (para filtrar) + sedes requeridos.
   */
  private aplicarValidadoresAlcance(tipo: TipoAlcance, limpiar: boolean): void {
    const suc = this.formulario.controls.sucursales;
    const sed = this.formulario.controls.sedes;

    suc.clearValidators();
    sed.clearValidators();

    if (tipo === 'sucursal') {
      suc.setValidators([Validators.required, Validators.minLength(1)]);
    } else if (tipo === 'sede') {
      suc.setValidators([Validators.required, Validators.minLength(1)]);
      sed.setValidators([Validators.required, Validators.minLength(1)]);
    }

    if (limpiar && tipo === 'nacional') {
      suc.setValue([], { emitEvent: false });
      sed.setValue([], { emitEvent: false });
      this.sedes.set([]);
    }

    suc.updateValueAndValidity({ emitEvent: false });
    sed.updateValueAndValidity({ emitEvent: false });
  }

  /** Carga las sedes de las sucursales seleccionadas (cascada del alcance). */
  private cargarSedes(idsSucursales: number[]): void {
    // Al cambiar de sucursales, descarta sedes que ya no pertenecen.
    if (idsSucursales.length === 0) {
      this.sedes.set([]);
      this.formulario.controls.sedes.setValue([], { emitEvent: false });
      return;
    }

    this.cargandoSedes.set(true);
    this.parametros.sedesPorSucursales(idsSucursales).subscribe({
      next: (lista) => {
        const arr = Array.isArray(lista) ? lista : [];
        this.sedes.set(arr);
        // Conservar solo las sedes seleccionadas que sigan disponibles.
        const validas = new Set(arr.map((s) => s.id));
        const actuales = this.formulario.controls.sedes.value as number[];
        this.formulario.controls.sedes.setValue(
          actuales.filter((id) => validas.has(id)),
          { emitEvent: false },
        );
        this.cargandoSedes.set(false);
      },
      error: () => {
        this.sedes.set([]);
        this.cargandoSedes.set(false);
      },
    });
  }
}
