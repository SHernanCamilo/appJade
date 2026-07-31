import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { CheckboxModule } from 'primeng/checkbox';
import { Plantilla } from '../../services/plantilla.service';
import { TurnoEditForm, getRangosPlantilla, EMPTY_TURNO_EDIT_FORM } from '../../models/cuadro-turnos.models';
import { PlantillaRelojVisualComponent } from '../plantilla-reloj-visual/plantilla-reloj-visual.component';
import { formatHora12 } from '../../utils/horario.util';

@Component({
  selector: 'app-turno-asignacion-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    ButtonModule, DialogModule, DropdownModule, InputTextModule, CheckboxModule,
    PlantillaRelojVisualComponent
  ],
  templateUrl: './turno-asignacion-dialog.component.html',
  styleUrls: ['./turno-asignacion-dialog.component.css']
})
export class TurnoAsignacionDialogComponent {
  @Input({ required: true }) saving = false;
  @Input({ required: true }) selectedCount = 0;
  @Input() puedeEliminar = false;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() save = new EventEmitter<TurnoEditForm>();
  @Output() delete = new EventEmitter<void>();

  /** Estado local del formulario — no se propaga al padre hasta guardar. */
  form: TurnoEditForm = { ...EMPTY_TURNO_EDIT_FORM };

  private plantillasSignal = signal<Plantilla[]>([]);
  private plantillaIdSignal = signal<number | null>(null);
  private eventoSignal = signal({ activo: false, inicio: '', fin: '' });
  private _visible = false;

  @Input({ required: true }) set visible(v: boolean) {
    const abriendo = v && !this._visible;
    this._visible = v;
    if (abriendo) {
      this.cargarFormularioLocal();
    }
  }

  get visible(): boolean {
    return this._visible;
  }

  @Input({ required: true }) set initialForm(v: TurnoEditForm) {
    this._initialForm = { ...v };
    if (this._visible) {
      this.cargarFormularioLocal();
    }
  }

  private _initialForm: TurnoEditForm = { ...EMPTY_TURNO_EDIT_FORM };

  @Input({ required: true }) set plantillas(v: Plantilla[]) {
    this.plantillasSignal.set(v ?? []);
  }

  readonly plantillaOptions = computed(() =>
    this.plantillasSignal().map(p => ({
      label: `${p.nombre} (${(p.hora_inicio ?? '').substring(0, 5)} – ${(p.hora_fin ?? '').substring(0, 5)})`,
      value: p.id as number
    })).filter(o => o.value != null)
  );

  readonly plantillaSeleccionada = computed(() =>
    this.plantillasSignal().find(p => p.id === this.plantillaIdSignal()) ?? null
  );

  readonly rangosReloj = computed(() => {
    const ev = this.eventoSignal();
    const evento = ev.activo && ev.inicio && ev.fin ? { inicio: ev.inicio, fin: ev.fin } : null;
    return getRangosPlantilla(this.plantillaSeleccionada(), evento);
  });

  readonly dialogHeader = computed(() => {
    const f = this.form?.fecha;
    return f ? `Asignar Turno — ${f}` : 'Asignar Turno';
  });

  formatHora = formatHora12;

  private cargarFormularioLocal(): void {
    this.form = { ...this._initialForm };
    this.plantillaIdSignal.set(this.form.idPlantilla);
    this.eventoSignal.set({
      activo: this.form.tieneEvento,
      inicio: this.form.eventoInicio,
      fin: this.form.eventoFin
    });
  }

  private actualizarEventoSignal(): void {
    this.eventoSignal.set({
      activo: this.form.tieneEvento,
      inicio: this.form.eventoInicio,
      fin: this.form.eventoFin
    });
  }

  onVisibleChange(open: boolean): void {
    this.visibleChange.emit(open);
  }

  onPlantillaChange(id: number | null): void {
    this.form = { ...this.form, idPlantilla: id, esDescanso: false };
    this.plantillaIdSignal.set(id);
  }

  onDescansoChange(esDescanso: boolean): void {
    this.form = {
      ...this.form,
      esDescanso,
      idPlantilla: esDescanso ? null : this.form.idPlantilla,
      tieneEvento: esDescanso ? false : this.form.tieneEvento,
      eventoInicio: esDescanso ? '' : this.form.eventoInicio,
      eventoFin: esDescanso ? '' : this.form.eventoFin
    };
    if (esDescanso) this.plantillaIdSignal.set(null);
    this.actualizarEventoSignal();
  }

  onEventoChange(activo: boolean): void {
    this.form = {
      ...this.form,
      tieneEvento: activo,
      eventoInicio: activo ? (this.form.eventoInicio || '18:00') : '',
      eventoFin: activo ? (this.form.eventoFin || '22:00') : ''
    };
    this.actualizarEventoSignal();
  }

  onEventoHoraChange(field: 'eventoInicio' | 'eventoFin', value: string): void {
    this.form = { ...this.form, [field]: value };
    this.actualizarEventoSignal();
  }

  guardar(): void {
    this.save.emit({ ...this.form });
  }
}
