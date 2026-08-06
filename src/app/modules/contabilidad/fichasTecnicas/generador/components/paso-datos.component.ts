import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageModule } from 'primeng/message';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';

import { CrearFichaPayload, Ficha, OpcionesFormulario, ProfesionalDeEspecialidad } from '../../models/ficha.model';
import { ParametrosService } from '../../services/parametros.service';

/**
 * Paso 1 del generador: datos principales del contrato.
 *
 * Sustituye `generador/form1.php`. La carga de profesionales en cascada al
 * elegir especialidad reemplaza `select_especialidad.php`, que devolvía HTML
 * generado en el servidor.
 */
@Component({
  selector: 'app-paso-datos',
  standalone: true,
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './paso-datos.component.html',
  styleUrl: './paso-datos.component.css',
})
export class PasoDatosComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly parametros = inject(ParametrosService);

  /** Ficha existente en modo edición. */
  readonly ficha = input<Ficha | null>(null);
  readonly guardando = input<boolean>(false);

  readonly continuar = output<CrearFichaPayload>();

  protected readonly opciones = signal<OpcionesFormulario | null>(null);
  protected readonly profesionales = signal<ProfesionalDeEspecialidad[]>([]);
  protected readonly cargandoProfesionales = signal<boolean>(false);

  protected readonly formulario = this.fb.nonNullable.group({
    id_agremiacion: [null as number | null, Validators.required],
    id_objeto_contrato: [null as number | null, Validators.required],
    id_especialidad: [null as number | null, Validators.required],
    vlr_contrato: [null as number | null, [Validators.required, Validators.min(1)]],
    vigencia: [null as unknown, Validators.required],
    profesionales: [[] as number[], [Validators.required, Validators.minLength(1)]],
    obs_os: [''],
  });

  constructor() {
    // Al cambiar la especialidad se recarga la lista de profesionales.
    this.formulario.controls.id_especialidad.valueChanges.subscribe((id) => {
      this.formulario.controls.profesionales.setValue([]);
      this.cargarProfesionales(id);
    });

    // Precarga en modo edición.
    effect(() => {
      const ficha = this.ficha();

      if (!ficha) {
        return;
      }

      this.formulario.patchValue({
        id_agremiacion: ficha.id_agremiacion,
        id_objeto_contrato: ficha.id_objeto_contrato,
        id_especialidad: ficha.id_especialidad,
        vlr_contrato: Number(ficha.vlr_contrato),
        vigencia: [new Date(`${ficha.fecha_ini}T00:00:00`), new Date(`${ficha.fecha_fin}T00:00:00`)],
        profesionales: (ficha.profesionales ?? []).map((p) => p.id),
        obs_os: ficha.obs_os ?? '',
      });

      this.cargarProfesionales(ficha.id_especialidad);
    });
  }

  ngOnInit(): void {
    this.parametros.opcionesFormulario().subscribe((opciones) => this.opciones.set(opciones));
  }

  protected get esActualizacion(): boolean {
    return this.ficha()?.id_padre !== null && this.ficha()?.id_padre !== undefined;
  }

  protected enviar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();

      return;
    }

    const v = this.formulario.getRawValue();
    const vigencia = v.vigencia as Date[] | null;
    const inicio = vigencia?.[0];
    const fin = vigencia?.[1];

    if (!inicio || !fin) {
      return;
    }

    this.continuar.emit({
      id_agremiacion: v.id_agremiacion!,
      id_objeto_contrato: v.id_objeto_contrato!,
      id_especialidad: v.id_especialidad!,
      vlr_contrato: v.vlr_contrato!,
      fecha_ini: this.aIso(inicio),
      fecha_fin: this.aIso(fin),
      profesionales: v.profesionales,
      obs_os: v.obs_os.trim() || null,
    });
  }

  protected control(nombre: keyof typeof this.formulario.controls): boolean {
    const c = this.formulario.controls[nombre];

    return c.invalid && (c.dirty || c.touched);
  }

  private cargarProfesionales(idEspecialidad: number | null): void {
    if (!idEspecialidad) {
      this.profesionales.set([]);

      return;
    }

    this.cargandoProfesionales.set(true);

    this.parametros.profesionalesPorEspecialidad(idEspecialidad).subscribe({
      next: (lista) => {
        this.profesionales.set(lista);
        this.cargandoProfesionales.set(false);
      },
      error: () => {
        this.profesionales.set([]);
        this.cargandoProfesionales.set(false);
      },
    });
  }

  private aIso(fecha: Date | undefined): string {
    if (!fecha) {
      return '';
    }

    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
  }
}
