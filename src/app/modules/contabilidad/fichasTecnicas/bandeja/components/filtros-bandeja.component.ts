import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

import { Agremiacion, Especialidad, FiltrosFichas } from '../../models/ficha.model';
import { ParametrosService } from '../../services/parametros.service';

/**
 * Barra de filtros de la bandeja.
 *
 * Deliberadamente mínima: empresa y sucursal las deduce el backend del JWT y
 * los roles del usuario, así que no se le pide al usuario elegir en cascada.
 */
@Component({
  selector: 'app-filtros-bandeja',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    SelectModule,
    DatePickerModule,
    ButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ft-filtros">
      <p-iconfield iconPosition="left" class="ft-filtros__buscar">
        <p-inputicon styleClass="pi pi-search" />
        <input
          pInputText
          type="search"
          placeholder="Consecutivo, agremiación o especialidad…"
          [ngModel]="texto()"
          (ngModelChange)="onTexto($event)"
          aria-label="Buscar fichas"
        />
      </p-iconfield>

      <p-select
        [options]="agremiaciones()"
        optionLabel="nombre"
        optionValue="id"
        placeholder="Agremiación"
        [showClear]="true"
        [filter]="true"
        filterBy="nombre,nit"
        [ngModel]="idAgremiacion()"
        (ngModelChange)="onAgremiacion($event)"
        styleClass="ft-filtros__select"
        emptyMessage="Sin agremiaciones"
      />

      <p-select
        [options]="especialidades()"
        optionLabel="descripcion"
        optionValue="id"
        placeholder="Especialidad"
        [showClear]="true"
        [filter]="true"
        filterBy="descripcion"
        [ngModel]="idEspecialidad()"
        (ngModelChange)="onEspecialidad($event)"
        styleClass="ft-filtros__select"
        emptyMessage="Sin especialidades"
      />

      <p-datepicker
        [ngModel]="rango()"
        (ngModelChange)="onRango($event)"
        selectionMode="range"
        [readonlyInput]="true"
        dateFormat="dd/mm/yy"
        placeholder="Rango de vigencia"
        [showButtonBar]="true"
        styleClass="ft-filtros__fecha"
      />

      <p-button
        icon="pi pi-filter-slash"
        severity="secondary"
        [text]="true"
        pTooltip="Limpiar filtros"
        (onClick)="limpiar()"
      />
    </div>
  `,
  styles: [
    `
      .ft-filtros {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
        padding: 0.75rem 0;
      }

      .ft-filtros__buscar {
        flex: 1 1 18rem;
      }

      .ft-filtros__buscar input {
        width: 100%;
      }

      :host ::ng-deep .ft-filtros__select {
        min-width: 13rem;
      }

      :host ::ng-deep .ft-filtros__fecha input {
        min-width: 13rem;
      }
    `,
  ],
})
export class FiltrosBandejaComponent implements OnInit {
  private readonly parametros = inject(ParametrosService);

  readonly cambio = output<FiltrosFichas>();

  protected readonly agremiaciones = signal<Agremiacion[]>([]);
  protected readonly especialidades = signal<Especialidad[]>([]);

  protected readonly texto = signal<string>('');
  protected readonly idAgremiacion = signal<number | null>(null);
  protected readonly idEspecialidad = signal<number | null>(null);
  protected readonly rango = signal<Date[] | null>(null);

  /** Debounce del texto para no disparar una petición por tecla. */
  private readonly textoStream = new Subject<string>();

  ngOnInit(): void {
    this.parametros.opcionesFormulario().subscribe((opciones) => {
      this.agremiaciones.set(opciones.agremiaciones);
      this.especialidades.set(opciones.especialidades);
    });

    this.textoStream
      .pipe(debounceTime(350), distinctUntilChanged())
      .subscribe(() => this.emitir());
  }

  protected onTexto(valor: string): void {
    this.texto.set(valor);
    this.textoStream.next(valor);
  }

  protected onAgremiacion(valor: number | null): void {
    this.idAgremiacion.set(valor);
    this.emitir();
  }

  protected onEspecialidad(valor: number | null): void {
    this.idEspecialidad.set(valor);
    this.emitir();
  }

  protected onRango(valor: Date[] | null): void {
    this.rango.set(valor);

    // Solo emitir cuando el rango está completo
    if (!valor || (valor[0] && valor[1])) {
      this.emitir();
    }
  }

  protected limpiar(): void {
    this.texto.set('');
    this.idAgremiacion.set(null);
    this.idEspecialidad.set(null);
    this.rango.set(null);
    this.emitir();
  }

  private emitir(): void {
    const rango = this.rango();

    this.cambio.emit({
      buscar: this.texto().trim() || undefined,
      id_agremiacion: this.idAgremiacion() ?? undefined,
      id_especialidad: this.idEspecialidad() ?? undefined,
      desde: rango?.[0] ? this.aIso(rango[0]) : undefined,
      hasta: rango?.[1] ? this.aIso(rango[1]) : undefined,
    });
  }

  private aIso(fecha: Date): string {
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
  }
}
