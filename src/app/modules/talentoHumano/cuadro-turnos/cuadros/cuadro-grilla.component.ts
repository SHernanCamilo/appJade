import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { RadioButtonModule } from 'primeng/radiobutton';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';

import { CuadroService } from '../services/cuadro.service';
import { PlantillaService } from '../services/plantilla.service';
import { AsignacionService } from '../services/asignacion.service';
import { CuadroGrilla, CeldaGrilla, ESTADO_CUADRO_CONFIG, EstadoCuadro } from '../models/cuadro.model';
import { Plantilla } from '../models/plantilla.model';
import { AsignacionMasiva, ResultadoMasivo } from '../models/asignacion.model';

interface CeldaClick { idEmpleado: number; fecha: string; celda: CeldaGrilla | null; }

@Component({
  selector: 'app-cuadro-grilla',
  standalone: true,
  imports: [
    CommonModule, RouterModule, FormsModule,
    ButtonModule, ToastModule, DialogModule, DropdownModule, TooltipModule,
    TagModule, SkeletonModule, RadioButtonModule, InputTextModule, TextareaModule,
    ConfirmDialogModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './cuadro-grilla.component.html',
  styleUrl: './cuadro-grilla.component.css'
})
export class CuadroGrillaComponent implements OnInit {

  cuadroId!: number;
  grilla: CuadroGrilla | null = null;
  plantillas: Plantilla[] = [];
  isLoading = false;
  isSaving = false;
  estadoConfig = ESTADO_CUADRO_CONFIG;

  // Panel lateral
  panelVisible = true;
  plantillaActiva: Plantilla | null = null;

  // Dialog asignar turno
  showDialog = false;
  celdaActual: CeldaClick | null = null;
  formTurno: {
    tipo: 'turno' | 'descanso' | 'festivo';
    id_plantilla: number | null;
    hora_inicio_override: string | null;
    hora_fin_override: string | null;
    observacion: string | null;
    showOverride: boolean;
  } = this.emptyForm();

  // Selección múltiple con Shift
  private ultimaCeldaClick: { idEmpleado: number; diaIndex: number } | null = null;
  celdasSeleccionadas = new Set<string>();

  // Resumen
  resumen: { [codigo: string]: { plantilla: Plantilla; count: number } } = {};
  totalDescansos = 0;

  constructor(
    private route: ActivatedRoute,
    private cuadroService: CuadroService,
    private plantillaService: PlantillaService,
    private asignacionService: AsignacionService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit(): void {
    this.cuadroId = Number(this.route.snapshot.paramMap.get('id'));
    this.cargarPlantillas();
    this.cargarGrilla();
  }

  cargarGrilla(): void {
    this.isLoading = true;
    this.cuadroService.getGrilla(this.cuadroId).subscribe({
      next: (data: CuadroGrilla) => { this.grilla = data; this.calcularResumen(); this.isLoading = false; },
      error: () => { this.isLoading = false; this.toast('error', 'No se pudo cargar la grilla'); }
    });
  }

  cargarPlantillas(): void {
    this.plantillaService.getAll({ estado: true }).subscribe({
      next: (data: Plantilla[]) => { this.plantillas = data; },
      error: () => {}
    });
  }

  // ── GETTERS ───────────────────────────────────────────────────────────────

  get esEditable(): boolean {
    return this.grilla?.cuadro.estado === 'borrador';
  }

  get diasSemana(): string[] {
    if (!this.grilla) return [];
    return this.grilla.dias.map((d: number) => {
      const fecha = new Date(this.grilla!.cuadro.anio, this.grilla!.cuadro.mes - 1, d);
      return ['D', 'L', 'M', 'X', 'J', 'V', 'S'][fecha.getDay()];
    });
  }

  esFindeSemana(dia: number): boolean {
    if (!this.grilla) return false;
    const fecha = new Date(this.grilla.cuadro.anio, this.grilla.cuadro.mes - 1, dia);
    return fecha.getDay() === 0 || fecha.getDay() === 6;
  }

  getFecha(dia: number): string {
    if (!this.grilla) return '';
    const m = String(this.grilla.cuadro.mes).padStart(2, '0');
    const d = String(dia).padStart(2, '0');
    return `${this.grilla.cuadro.anio}-${m}-${d}`;
  }

  getCelda(idEmpleado: number, dia: number): CeldaGrilla | null {
    return this.grilla?.grilla?.[idEmpleado]?.[this.getFecha(dia)] ?? null;
  }

  getCeldaTooltip(celda: CeldaGrilla | null): string {
    if (!celda) return 'Sin asignar — click para asignar';
    if (celda.es_descanso) return 'Descanso';
    if (celda.es_festivo) return 'Festivo';
    if (celda.plantilla) return `${celda.plantilla.nombre} | ${celda.plantilla.hora_inicio.slice(0,5)} - ${celda.plantilla.hora_fin.slice(0,5)}`;
    return '';
  }

  getCeldaClase(celda: CeldaGrilla | null): string {
    if (!celda) return 'celda-vacia';
    if (celda.es_descanso) return 'celda-descanso';
    if (celda.es_festivo) return 'celda-festivo';
    if (celda.plantilla) return 'celda-turno';
    return 'celda-vacia';
  }

  getCeldaColor(celda: CeldaGrilla | null): string {
    if (celda?.plantilla?.color_hex) return celda.plantilla.color_hex;
    return 'transparent';
  }

  getCeldaTexto(celda: CeldaGrilla | null): string {
    if (!celda) return '';
    if (celda.es_descanso) return 'D';
    if (celda.es_festivo) return 'F';
    return celda.plantilla?.codigo ?? '';
  }

  esCeldaSeleccionada(idEmpleado: number, dia: number): boolean {
    return this.celdasSeleccionadas.has(`${idEmpleado}-${dia}`);
  }

  // ── CLICK EN CELDA ────────────────────────────────────────────────────────

  onCeldaClick(event: MouseEvent, idEmpleado: number, dia: number): void {
    if (!this.esEditable) return;

    const fecha = this.getFecha(dia);
    const celda = this.getCelda(idEmpleado, dia);

    // Shift+click: selección múltiple
    if (event.shiftKey && this.ultimaCeldaClick) {
      this.seleccionarRango(idEmpleado, this.ultimaCeldaClick.diaIndex, dia);
      return;
    }

    this.celdasSeleccionadas.clear();
    this.ultimaCeldaClick = { idEmpleado, diaIndex: dia };

    // Si hay plantilla activa, asignar directamente
    if (this.plantillaActiva && !celda) {
      this.asignarRapido(idEmpleado, fecha, this.plantillaActiva);
      return;
    }

    // Abrir dialog
    this.celdaActual = { idEmpleado, fecha, celda };
    this.formTurno = this.emptyForm();
    if (celda?.plantilla) {
      this.formTurno.tipo = 'turno';
      this.formTurno.id_plantilla = celda.id_plantilla;
    } else if (celda?.es_descanso) {
      this.formTurno.tipo = 'descanso';
    } else if (celda?.es_festivo) {
      this.formTurno.tipo = 'festivo';
    }
    this.showDialog = true;
  }

  private seleccionarRango(idEmpleado: number, desde: number, hasta: number): void {
    const min = Math.min(desde, hasta);
    const max = Math.max(desde, hasta);
    this.celdasSeleccionadas.clear();
    for (let d = min; d <= max; d++) {
      this.celdasSeleccionadas.add(`${idEmpleado}-${d}`);
    }
  }

  private asignarRapido(idEmpleado: number, fecha: string, plantilla: Plantilla): void {
    const asignacion: AsignacionMasiva = { id_empleado: idEmpleado, fecha, id_plantilla: plantilla.id, es_descanso: false, es_festivo: false };
    this.cuadroService.asignarMasivo(this.cuadroId, [asignacion]).subscribe({
      next: (r: ResultadoMasivo) => {
        if (r.total_err > 0) this.toast('warn', `Error: ${r.errores[0]?.error}`);
        else this.cargarGrilla();
      },
      error: (e: any) => this.toast('error', e.error?.message || 'Error al asignar')
    });
  }

  // ── GUARDAR DESDE DIALOG ──────────────────────────────────────────────────

  guardarAsignacion(): void {
    if (!this.celdaActual) return;
    if (this.formTurno.tipo === 'turno' && !this.formTurno.id_plantilla) {
      this.toast('warn', 'Seleccione una plantilla de turno');
      return;
    }

    this.isSaving = true;
    const { idEmpleado, fecha, celda } = this.celdaActual;

    const data: any = {
      id_cuadro: this.cuadroId,
      id_empleado: idEmpleado,
      fecha,
      id_plantilla: this.formTurno.tipo === 'turno' ? this.formTurno.id_plantilla : null,
      es_descanso: this.formTurno.tipo === 'descanso',
      es_festivo: this.formTurno.tipo === 'festivo',
      hora_inicio_override: this.formTurno.showOverride ? this.formTurno.hora_inicio_override : null,
      hora_fin_override: this.formTurno.showOverride ? this.formTurno.hora_fin_override : null,
      observacion: this.formTurno.observacion
    };

    const op$ = celda?.id
      ? this.asignacionService.update(celda.id, data)
      : this.asignacionService.create(data);

    op$.subscribe({
      next: () => { this.showDialog = false; this.isSaving = false; this.cargarGrilla(); },
      error: (e: any) => {
        this.isSaving = false;
        const msg = e.error?.message || 'Error al guardar';
        this.toast('error', msg);
      }
    });
  }

  eliminarAsignacion(): void {
    if (!this.celdaActual?.celda?.id) return;
    this.confirmationService.confirm({
      message: '¿Eliminar esta asignación?',
      header: 'Confirmar',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.asignacionService.delete(this.celdaActual!.celda!.id).subscribe({
          next: () => { this.showDialog = false; this.cargarGrilla(); },
          error: (e: any) => this.toast('error', e.error?.message || 'Error al eliminar')
        });
      }
    });
  }

  // ── ASIGNACIÓN MASIVA POR SELECCIÓN ───────────────────────────────────────

  asignarSeleccionados(): void {
    if (!this.plantillaActiva || this.celdasSeleccionadas.size === 0) return;
    const asignaciones: AsignacionMasiva[] = [];
    this.celdasSeleccionadas.forEach(key => {
      const [idEmp, dia] = key.split('-').map(Number);
      asignaciones.push({ id_empleado: idEmp, fecha: this.getFecha(dia), id_plantilla: this.plantillaActiva!.id, es_descanso: false, es_festivo: false });
    });
    this.cuadroService.asignarMasivo(this.cuadroId, asignaciones).subscribe({
      next: (r: ResultadoMasivo) => {
        this.celdasSeleccionadas.clear();
        if (r.total_err > 0) this.toast('warn', `${r.total_ok} asignadas, ${r.total_err} con error`);
        else this.toast('success', `${r.total_ok} asignaciones guardadas`);
        this.cargarGrilla();
      },
      error: (e: any) => this.toast('error', e.error?.message || 'Error en asignación masiva')
    });
  }

  // ── PUBLICAR / CERRAR ─────────────────────────────────────────────────────

  publicar(): void {
    this.confirmationService.confirm({
      message: '¿Publicar el cuadro? Los empleados podrán verlo.',
      header: 'Confirmar publicación',
      icon: 'pi pi-check-circle',
      acceptLabel: 'Sí, publicar',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.cuadroService.publicar(this.cuadroId).subscribe({
          next: () => { this.toast('success', 'Cuadro publicado'); this.cargarGrilla(); },
          error: (e: any) => this.toast('error', e.error?.message || 'Error al publicar')
        });
      }
    });
  }

  // ── RESUMEN ───────────────────────────────────────────────────────────────

  calcularResumen(): void {
    this.resumen = {};
    this.totalDescansos = 0;
    if (!this.grilla) return;
    Object.values(this.grilla.grilla).forEach((empleadoGrilla) => {
      Object.values(empleadoGrilla as any).forEach((celda) => {
        const celd = celda as CeldaGrilla;
        if (celd.es_descanso) { this.totalDescansos++; return; }
        if (celd.plantilla) {
          const c = celd.plantilla.codigo;
          if (!this.resumen[c]) {
            const p = this.plantillas.find((p: Plantilla) => p.id === celd.id_plantilla) ?? { ...celd.plantilla, duracion_horas: 0, es_nocturno: false, id_empresa: null, estado: true };
            this.resumen[c] = { plantilla: p as Plantilla, count: 0 };
          }
          this.resumen[c].count++;
        }
      });
    });
  }

  get resumenEntries() { return Object.values(this.resumen); }

  getSeverity(estado: EstadoCuadro): any { return this.estadoConfig[estado]?.severity ?? 'secondary'; }
  getLabel(estado: EstadoCuadro): string { return this.estadoConfig[estado]?.label ?? estado; }

  private emptyForm() {
    return { tipo: 'turno' as 'turno' | 'descanso' | 'festivo', id_plantilla: null as number | null, hora_inicio_override: null as string | null, hora_fin_override: null as string | null, observacion: null as string | null, showOverride: false };
  }

  private toast(severity: string, detail: string): void {
    this.messageService.add({ severity, summary: severity === 'error' ? 'Error' : severity === 'warn' ? 'Advertencia' : 'Éxito', detail, life: 3500 });
  }

  trackByEmpleado(_: number, e: any) { return e.id; }
  trackByDia(_: number, d: number) { return d; }
}
