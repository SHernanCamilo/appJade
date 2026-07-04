import { Component, OnInit, ViewChild, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { FullCalendarModule, FullCalendarComponent } from '@fullcalendar/angular';
import { CalendarOptions, EventClickArg, EventContentArg } from '@fullcalendar/core';
import { DateClickArg } from '@fullcalendar/interaction';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';

import { CalculoHorasService, Festivo, TurnoEmpleado } from '../services/calculo-horas.service';
import { PlantillaService, Plantilla } from '../services/plantilla.service';
import { AsignacionService } from '../services/asignacion.service';
import { CuadroService } from '../services/cuadro.service';
import { environment } from '../../../../environments/environment';
import {
  AsignacionBulkPayload, AsignacionMasivaResponse, CalendarTurnoEvent,
  DropdownOption, EmpleadoTurno, EMPTY_TURNO_EDIT_FORM, TurnoEditForm,
  UnidadFuncionalTurno, buildUnidadLabel
} from '../models/cuadro-turnos.models';
import { hexToRgba } from '../utils/horario.util';
import { filtrarFestivosPorMes, fechasFestivoSet, normalizarFechaFestivo } from '../utils/festivo.util';
import { TurnoEmpleadosPanelComponent } from '../components/turno-empleados-panel/turno-empleados-panel.component';
import { TurnoAsignacionDialogComponent } from '../components/turno-asignacion-dialog/turno-asignacion-dialog.component';

type EmptyStateKind = 'uf' | 'empleados' | 'seleccion' | null;

@Component({
  selector: 'app-cuadro-mes-empleado',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    ButtonModule, DropdownModule, ToastModule, TooltipModule, FullCalendarModule,
    TurnoEmpleadosPanelComponent, TurnoAsignacionDialogComponent
  ],
  providers: [MessageService],
  templateUrl: './cuadro-mes-empleado.component.html',
  styleUrls: ['./cuadro-mes-empleado.component.css']
})
export class CuadroMesEmpleadoComponent implements OnInit {
  unidadOptions: DropdownOption<UnidadFuncionalTurno>[] = [];
  empleadoOptions = signal<DropdownOption<EmpleadoTurno>[]>([]);
  plantillas = signal<Plantilla[]>([]);
  empleadosCargados = signal(false);

  selectedUnidad = signal<number | null>(null);
  selectedEmpleadosIds = signal<number[]>([]);
  idCuadroActual = signal<number | null>(null);
  festivosMes = signal<Festivo[]>([]);
  private festivoFechasSet = new Set<string>();
  eventosMultiples = signal<CalendarTurnoEvent[]>([]);
  isLoading = signal(false);
  isSavingDay = signal(false);
  showEditDialog = signal(false);
  editForm = signal<TurnoEditForm>({ ...EMPTY_TURNO_EDIT_FORM });

  mesOptions = [
    { label: 'Enero', value: 1 }, { label: 'Febrero', value: 2 }, { label: 'Marzo', value: 3 },
    { label: 'Abril', value: 4 }, { label: 'Mayo', value: 5 }, { label: 'Junio', value: 6 },
    { label: 'Julio', value: 7 }, { label: 'Agosto', value: 8 }, { label: 'Septiembre', value: 9 },
    { label: 'Octubre', value: 10 }, { label: 'Noviembre', value: 11 }, { label: 'Diciembre', value: 12 }
  ];
  anioOptions: { label: string; value: number }[] = [];
  selectedMes = signal(new Date().getMonth() + 1);
  selectedAnio = signal(new Date().getFullYear());

  readonly modoMasivo = computed(() => this.selectedEmpleadosIds().length > 2);

  readonly emptyState = computed<EmptyStateKind>(() => {
    if (!this.selectedUnidad()) return 'uf';
    if (!this.empleadosCargados()) return null;
    if (this.empleadoOptions().length === 0) return 'empleados';
    if (this.selectedEmpleadosIds().length === 0) return 'seleccion';
    return null;
  });

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    locale: 'es',
    firstDay: 0,
    headerToolbar: false,
    initialDate: new Date(),
    dateClick: (arg) => this.handleDateClick(arg),
    eventClick: (arg) => this.handleEventClick(arg),
    eventContent: (arg) => this.renderEventContent(arg),
    dayCellClassNames: (arg) => this.claseCeldaFestivo(arg.date),
    events: [],
    height: '100%',
    dayMaxEvents: false
  };

  @ViewChild('calendar') calendarComponent?: FullCalendarComponent;

  constructor(
    private calculoService: CalculoHorasService,
    private plantillaService: PlantillaService,
    private asignacionService: AsignacionService,
    private cuadroService: CuadroService,
    private http: HttpClient,
    private message: MessageService
  ) {}

  ngOnInit(): void {
    const y = new Date().getFullYear();
    for (let i = y - 1; i <= y + 1; i++) this.anioOptions.push({ label: String(i), value: i });
    this.plantillaService.getPlantillas().subscribe({
      next: ps => this.plantillas.set(ps ?? []),
      error: () => this.toastWarn('No se pudieron cargar las plantillas de turno')
    });
    this.cargarUnidadesResponsable();
  }

  renderEventContent(arg: EventContentArg): { html: string } {
    if (arg.event.display === 'background') {
      return {
        html: `<div class="festivo-label">${arg.event.title}</div>`
      };
    }

    const props = arg.event.extendedProps as CalendarTurnoEvent['extendedProps'];
    const color = props?.color_hex ?? '#3b82f6';
    const code = props?.codigo ?? (props?.turno?.es_descanso ? 'D' : 'T');
    const extra = props?.tieneEvento ? '<i class="pi pi-bolt" style="font-size:0.6rem;color:#f97316"></i>' : '';
    const empName = arg.event.title.includes(':') ? arg.event.title.split(':')[0] : '';
    const nameLine = this.selectedEmpleadosIds().length > 1 && empName
      ? `<div class="evt-emp">${empName}</div>` : '';

    return {
      html: `
        <div class="custom-event-content" style="color:${color}">
          ${extra}
          <span class="evt-code">${code}</span>
          ${nameLine}
        </div>`
    };
  }

  cargarUnidadesResponsable(): void {
    this.http.get<{ success: boolean; data: UnidadFuncionalTurno[] }>(
      `${environment.URL_SERVICIOS}/turnos/unidades-funcionales/del-usuario`
    ).subscribe({
      next: (response) => {
        const list = response.data ?? [];
        this.unidadOptions = list.map(u => ({ label: buildUnidadLabel(u), value: u.id, data: u }));
        if (this.unidadOptions.length) {
          this.selectedUnidad.set(this.unidadOptions[0].value);
          this.onUnidadChange();
        }
      },
      error: () => this.toastError('Error al cargar unidades del usuario')
    });
  }

  onUnidadChange(): void {
    const id = this.selectedUnidad();
    if (!id) return;

    this.empleadoOptions.set([]);
    this.empleadosCargados.set(false);
    this.selectedEmpleadosIds.set([]);
    this.idCuadroActual.set(null);
    this.eventosMultiples.set([]);
    this.actualizarEventosCalendario();

    this.asegurarCuadroUnidad(id);
    this.cargarEmpleadosUnidad(id);
    this.cargarFestivosMes();
  }

  private asegurarCuadroUnidad(idUnidad: number): void {
    this.calculoService.ensureCuadroUnidad(idUnidad, this.selectedAnio(), this.selectedMes()).subscribe({
      next: (r) => this.idCuadroActual.set(r.data.id_cuadro),
      error: () => this.toastError('No se pudo preparar el cuadro de la unidad')
    });
  }

  cargarEmpleadosUnidad(idUnidad: number): void {
    this.isLoading.set(true);
    this.http.get<{ success: boolean; data: EmpleadoTurno[] }>(
      `${environment.URL_SERVICIOS}/turnos/unidades-funcionales/${idUnidad}/empleados`
    ).subscribe({
      next: (r) => {
        const empleados = r.data ?? [];
        this.empleadoOptions.set(empleados.map(e => ({ label: e.nombre, value: e.id, data: e })));
        this.empleadosCargados.set(true);
        if (!empleados.length) {
          this.toastInfo('No hay empleados en esta unidad');
          this.isLoading.set(false);
          return;
        }
        this.selectedEmpleadosIds.set([this.empleadoOptions()[0].value]);
        this.cargarDatosMultiples();
      },
      error: () => {
        this.empleadosCargados.set(true);
        this.isLoading.set(false);
        this.toastError('Error al cargar empleados');
      }
    });
  }

  cargarFestivosMes(): void {
    const anio = this.selectedAnio();
    const mes = this.selectedMes();

    this.calculoService.getFestivos(anio).subscribe({
      next: (festivos) => {
        if (!festivos?.length) {
          this.sincronizarFestivosColombia(anio, mes);
          return;
        }
        this.aplicarFestivosAlCalendario(festivos, mes, anio);
      },
      error: () => this.sincronizarFestivosColombia(anio, mes)
    });
  }

  private sincronizarFestivosColombia(anio: number, mes: number): void {
    this.calculoService.sincronizarFestivos(anio).pipe(
      catchError(() => of(null))
    ).subscribe(() => {
      this.calculoService.getFestivos(anio).subscribe(f => {
        this.aplicarFestivosAlCalendario(f ?? [], mes, anio);
      });
    });
  }

  private aplicarFestivosAlCalendario(festivos: Festivo[], mes: number, anio: number): void {
    const delMes = filtrarFestivosPorMes(festivos, mes, anio);
    this.festivosMes.set(delMes);
    this.festivoFechasSet = fechasFestivoSet(delMes);
    this.actualizarEventosCalendario();
    queueMicrotask(() => this.calendarComponent?.getApi()?.render());
  }

  private claseCeldaFestivo(date: Date): string[] {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return this.festivoFechasSet.has(`${y}-${m}-${d}`) ? ['dia-festivo'] : [];
  }

  toggleEmpleado(id: number): void {
    const ids = [...this.selectedEmpleadosIds()];
    const idx = ids.indexOf(id);
    if (idx > -1) ids.splice(idx, 1); else ids.push(id);
    this.selectedEmpleadosIds.set(ids);
    this.cargarDatosMultiples();
  }

  seleccionarTodos(): void {
    const opts = this.empleadoOptions();
    if (this.selectedEmpleadosIds().length === opts.length) {
      this.selectedEmpleadosIds.set([]);
    } else {
      this.selectedEmpleadosIds.set(opts.map(e => e.value));
    }
    this.cargarDatosMultiples();
  }

  onMesAnioChange(): void {
    this.actualizarVistaCalendario();
    const uf = this.selectedUnidad();
    if (uf) this.asegurarCuadroUnidad(uf);
    this.cargarFestivosMes();
    if (this.selectedEmpleadosIds().length) this.cargarDatosMultiples();
  }

  actualizarVistaCalendario(): void {
    const api = this.calendarComponent?.getApi();
    api?.gotoDate(new Date(this.selectedAnio(), this.selectedMes() - 1, 1));
  }

  cargarDatosMultiples(): void {
    this.eventosMultiples.set([]);
    const ids = this.selectedEmpleadosIds();

    if (!ids.length) {
      this.actualizarEventosCalendario();
      return;
    }

    if (this.modoMasivo()) {
      this.isLoading.set(false);
      this.actualizarEventosCalendario();
      return;
    }

    this.isLoading.set(true);
    forkJoin(
      ids.map(id => this.calculoService.getCuadroMesEmpleado(id, this.selectedAnio(), this.selectedMes()).pipe(
        catchError(() => of(null))
      ))
    ).subscribe(results => {
      const eventos: CalendarTurnoEvent[] = [];
      results.forEach((data, index) => {
        if (!data) return;
        const nombre = data.empleado?.nombre ?? 'Emp';
        eventos.push(...this.mapTurnosToEvents(data.turnos, nombre, ids.length > 1));
      });
      this.eventosMultiples.set(eventos);
      this.isLoading.set(false);
      this.actualizarEventosCalendario();
    });
  }

  private mapTurnosToEvents(turnos: TurnoEmpleado[], nombreCorto: string, multi: boolean): CalendarTurnoEvent[] {
    const prefijo = multi ? `${nombreCorto.split(' ')[0]}: ` : '';
    return (turnos ?? []).map(t => {
      const color = t.es_descanso ? '#64748b' : (t.plantilla?.color_hex ?? '#3b82f6');
      const title = t.es_descanso ? `${prefijo}Descanso` : `${prefijo}${t.plantilla?.nombre ?? 'Turno'}`;
      const tieneEvento = !!(t.hora_inicio_2 && t.hora_fin_2);
      return {
        id: String(t.id),
        title,
        start: t.fecha,
        backgroundColor: hexToRgba(color, 0.22),
        borderColor: color,
        extendedProps: {
          turno: t,
          color_hex: color,
          codigo: t.plantilla?.codigo,
          tieneEvento
        }
      };
    });
  }

  actualizarEventosCalendario(): void {
    const eventos: CalendarTurnoEvent[] = this.festivosMes().map(f => ({
      id: `festivo-${normalizarFechaFestivo(f.fecha)}`,
      title: f.nombre,
      start: normalizarFechaFestivo(f.fecha),
      display: 'background',
      backgroundColor: '#fecaca',
      classNames: ['evento-festivo-bg']
    }));
    eventos.push(...this.eventosMultiples());
    this.calendarOptions = { ...this.calendarOptions, events: [...eventos] };

    queueMicrotask(() => {
      const api = this.calendarComponent?.getApi();
      if (!api) return;
      api.removeAllEvents();
      eventos.forEach(ev => api.addEvent({ ...ev }));
    });
  }

  handleDateClick(arg: DateClickArg): void {
    if (this.emptyState() === 'uf') {
      this.toastWarn('Primero selecciona una Unidad Funcional');
      return;
    }
    if (!this.selectedEmpleadosIds().length) {
      this.toastWarn('Selecciona al menos un funcionario');
      return;
    }
    this.editForm.set({ ...EMPTY_TURNO_EDIT_FORM, fecha: arg.dateStr });
    this.showEditDialog.set(true);
  }

  handleEventClick(arg: EventClickArg): void {
    const props = arg.event.extendedProps as CalendarTurnoEvent['extendedProps'];
    if (!props?.turno) return;

    if (this.selectedEmpleadosIds().length > 1) {
      this.toastInfo('En modo múltiple, haz clic en un día vacío para asignar a todos.');
      return;
    }

    const t = props.turno;
    this.editForm.set({
      idAsignacionIndividual: t.id,
      fecha: t.fecha,
      esDescanso: !!t.es_descanso,
      idPlantilla: t.plantilla?.id ?? null,
      observacion: t.observacion ?? '',
      tieneEvento: !!(t.hora_inicio_2 && t.hora_fin_2),
      eventoInicio: t.hora_inicio_2?.substring(0, 5) ?? '',
      eventoFin: t.hora_fin_2?.substring(0, 5) ?? ''
    });
    this.showEditDialog.set(true);
  }

  guardarDiaMasivo(formDesdeDialog?: TurnoEditForm): void {
    const form = formDesdeDialog ?? this.editForm();
    const ids = this.selectedEmpleadosIds();
    const idCuadro = this.idCuadroActual();

    if (!ids.length || !form.fecha) {
      this.toastWarn('Debes tener al menos un funcionario seleccionado');
      return;
    }
    if (!form.esDescanso && !form.idPlantilla) {
      this.toastWarn('Selecciona una plantilla o marca descanso');
      return;
    }
    if (form.tieneEvento && (!form.eventoInicio || !form.eventoFin)) {
      this.toastWarn('Completa las horas del evento extra');
      return;
    }
    if (!idCuadro) {
      this.toastError('Cuadro no disponible. Verifica la Unidad Funcional.');
      return;
    }

    this.isSavingDay.set(true);
    const asignaciones: AsignacionBulkPayload[] = ids.map(idEmp => {
      const item: AsignacionBulkPayload = {
        id_empleado: idEmp,
        fecha: form.fecha,
        es_descanso: form.esDescanso,
        id_plantilla: form.esDescanso ? null : form.idPlantilla,
        observacion: form.observacion || null
      };
      if (form.tieneEvento && form.eventoInicio && form.eventoFin) {
        item.hora_inicio_override_2 = form.eventoInicio;
        item.hora_fin_override_2 = form.eventoFin;
      }
      return item;
    });

    this.cuadroService.asignarMasivo(idCuadro, asignaciones).subscribe({
      next: (res: AsignacionMasivaResponse) => this.onSaveResponse(res, false),
      error: (err) => {
        if (err.status === 207 && err.error) {
          this.onSaveResponse(err.error as AsignacionMasivaResponse, true);
          return;
        }
        this.isSavingDay.set(false);
        this.toastError(err?.error?.message ?? 'Error al guardar asignación');
      }
    });
  }

  private onSaveResponse(res: AsignacionMasivaResponse, partial: boolean): void {
    this.isSavingDay.set(false);
    this.showEditDialog.set(false);

    const errCount = res.data?.total_err ?? 0;
    const okCount = res.data?.total_ok ?? 0;

    if (partial || errCount > 0) {
      const detalle = (res.data?.errores ?? []).slice(0, 3).map(e => e.error).join('; ');
      this.toastWarn(`${okCount} asignados, ${errCount} con conflicto.${detalle ? ' ' + detalle : ''}`);
    } else {
      this.toastOk(`Turno asignado a ${okCount || this.selectedEmpleadosIds().length} funcionario(s).`);
    }
    this.cargarDatosMultiples();
  }

  eliminarTurnoIndividual(): void {
    const id = this.editForm().idAsignacionIndividual;
    if (!id || !confirm('¿Eliminar el turno de este día?')) return;

    this.isSavingDay.set(true);
    this.asignacionService.deleteAsignacion(id).subscribe({
      next: () => {
        this.isSavingDay.set(false);
        this.showEditDialog.set(false);
        this.toastOk('Turno eliminado');
        this.cargarDatosMultiples();
      },
      error: (err) => {
        this.isSavingDay.set(false);
        this.toastError(err?.error?.message ?? 'Error al eliminar');
      }
    });
  }

  toastOk(msg: string) { this.message.add({ severity: 'success', summary: 'Éxito', detail: msg }); }
  toastWarn(msg: string) { this.message.add({ severity: 'warn', summary: 'Atención', detail: msg }); }
  toastError(msg: string) { this.message.add({ severity: 'error', summary: 'Error', detail: msg }); }
  toastInfo(msg: string) { this.message.add({ severity: 'info', summary: 'Info', detail: msg }); }
}
