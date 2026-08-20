import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

// PrimeNG
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { SkeletonModule } from 'primeng/skeleton';
import { DropdownModule } from 'primeng/dropdown';
import { InputMaskModule } from 'primeng/inputmask';
import { CalendarModule } from 'primeng/calendar';
import { MessageService, ConfirmationService } from 'primeng/api';

// Services
import { PlantillaService, Plantilla } from '../services/plantilla.service';
import { UserContextService } from '../../../../core/services/user-context.service';
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';
import { PermissionService } from '../../../../core/services/permission.service';
import { environment } from '../../../../environments/environment';

interface EmpresaOption {
  id: number;
  nombre: string;
}

@Component({
  selector: 'app-plantillas-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    DialogModule,
    ToastModule,
    ConfirmDialogModule,
    TagModule,
    TooltipModule,
    SkeletonModule,
    DropdownModule,
    InputMaskModule,
    CalendarModule,
    HasPermissionDirective
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './plantillas-list.component.html',
  styleUrl: './plantillas-list.component.css'
})
export class PlantillasListComponent implements OnInit {

  plantillas: Plantilla[] = [];
  plantillasFiltradas: Plantilla[] = [];
  isLoading = false;
  isSubmitting = false;

  searchTerm = '';
  showFormDialog = false;
  editMode = false;
  currentId?: number;
  submitted = false;

  // Multi-empresa
  isSuperAdmin = false;
  userEmpresas: EmpresaOption[] = [];
  selectedEmpresaFilter: number | null = null;
  empresasLoaded = false;

  formData = this.emptyForm();

  constructor(
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private plantillaService: PlantillaService,
    private userContextService: UserContextService,
    public permissionService: PermissionService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadUserContext();
  }

  // ── Permisos ──────────────────────────────────────────────
  canCreate(): boolean { return this.permissionService.hasPermission('talhum-turnos-plantillas-crear'); }
  canEdit(): boolean { return this.permissionService.hasPermission('talhum-turnos-plantillas-editar'); }
  canDelete(): boolean { return this.permissionService.hasPermission('talhum-turnos-plantillas-eliminar'); }

  /**
   * Carga empresas habilitadas para Cuadro de Turnos (filtrado por CUADRO_TURNOS_EMPRESAS en backend).
   */
  private loadUserContext(): void {
    this.http.get<any>(`${environment.URL_SERVICIOS}/turnos/cuadro-turno-permisos/empresas`).subscribe({
      next: (response) => {
        const empresas = response.data || [];
        this.userEmpresas = empresas.map((e: any) => ({ id: e.id, nombre: e.nombre }));
        this.isSuperAdmin = this.userEmpresas.length > 1;
        this.empresasLoaded = true;
        if (this.userEmpresas.length === 1) {
          this.selectedEmpresaFilter = this.userEmpresas[0].id;
        }
        this.loadPlantillas();
      },
      error: () => { this.empresasLoaded = true; this.loadPlantillas(); }
    });
  }

  emptyForm() {
    return {
      codigo: '',
      nombre: '',
      descripcion: '',
      hora_inicio: '',
      hora_fin: '',
      hora_inicio_2: '',
      hora_fin_2: '',
      // Custom time fields
      hora_inicio_h: '', hora_inicio_m: '', hora_inicio_ampm: 'AM',
      hora_fin_h: '', hora_fin_m: '', hora_fin_ampm: 'AM',
      hora_inicio_2_h: '', hora_inicio_2_m: '', hora_inicio_2_ampm: 'AM',
      hora_fin_2_h: '', hora_fin_2_m: '', hora_fin_2_ampm: 'AM',
      hora_inicio_date: new Date(),
      hora_fin_date: new Date(),
      hora_inicio_2_date: new Date(),
      hora_fin_2_date: new Date(),
      id_empresa: null as number | null,
      activo: true
    };
  }

  loadPlantillas(): void {
    this.isLoading = true;

    const params: any = {};

    // Si no es super_admin, filtrar por su empresa
    if (!this.isSuperAdmin && this.selectedEmpresaFilter) {
      params.id_empresa = this.selectedEmpresaFilter;
    } else if (this.isSuperAdmin && this.selectedEmpresaFilter) {
      params.id_empresa = this.selectedEmpresaFilter;
    }

    this.plantillaService.getPlantillas(params).subscribe({
      next: (plantillas) => {
        this.plantillas = plantillas;
        this.aplicarFiltros();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar plantillas:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar las plantillas'
        });
        this.isLoading = false;
      }
    });
  }

  aplicarFiltros(): void {
    let result = [...this.plantillas];
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(p =>
        p.nombre?.toLowerCase().includes(term) ||
        p.codigo?.toLowerCase().includes(term) ||
        p.descripcion?.toLowerCase().includes(term)
      );
    }
    this.plantillasFiltradas = result;
  }

  limpiarFiltros(): void {
    this.searchTerm = '';
    if (this.isSuperAdmin) {
      this.selectedEmpresaFilter = null;
    }
    this.aplicarFiltros();
    if (this.isSuperAdmin) {
      this.loadPlantillas();
    }
  }

  onEmpresaFilterChange(): void {
    this.loadPlantillas();
  }

  abrirFormulario(): void {
    this.editMode = false;
    this.currentId = undefined;
    this.submitted = false;
    this.formData = this.emptyForm();

    // Si no es super_admin y tiene una sola empresa, asignarla automáticamente
    if (!this.isSuperAdmin && this.userEmpresas.length === 1) {
      this.formData.id_empresa = this.userEmpresas[0].id;
    }

    this.showFormDialog = true;
  }

  private horaParaInput(hora: string): string {
    if (!hora) return '';
    const [h, m] = hora.split(':');
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
  }

  /** Convierte string HH:MM a Date */
  private horaToDate(hora: string): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (!hora) return d;
    const [h, m] = hora.split(':').map(Number);
    d.setHours(h || 0, m || 0, 0, 0);
    return d;
  }

  /** Convierte Date a string HH:MM */
  private dateToHora(date: Date): string {
    if (!date) return '';
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }

  /** Sincroniza los campos custom con los strings HH:MM 24h para el backend */
  onTimeChange(): void {
    this.formData.hora_inicio = this.fieldsToHora24('inicio');
    this.formData.hora_fin = this.fieldsToHora24('fin');
    this.formData.hora_inicio_2 = this.fieldsToHora24('inicio_2');
    this.formData.hora_fin_2 = this.fieldsToHora24('fin_2');
  }

  /** Cuando el usuario edita los inputs */
  onTimeInput(): void {
    // Validar horas (1-12) y minutos (0-59)
    this.clampTimeField('hora_inicio_h', 1, 12);
    this.clampTimeField('hora_fin_h', 1, 12);
    this.clampTimeField('hora_inicio_2_h', 1, 12);
    this.clampTimeField('hora_fin_2_h', 1, 12);
    this.clampTimeField('hora_inicio_m', 0, 59);
    this.clampTimeField('hora_fin_m', 0, 59);
    this.clampTimeField('hora_inicio_2_m', 0, 59);
    this.clampTimeField('hora_fin_2_m', 0, 59);
    this.onTimeChange();
  }

  /** Limita un campo numérico entre min y max */
  private clampTimeField(field: string, min: number, max: number): void {
    const val = (this.formData as any)[field];
    if (!val) return;
    const num = parseInt(val, 10);
    if (isNaN(num)) { (this.formData as any)[field] = ''; return; }
    if (num > max) (this.formData as any)[field] = max.toString().padStart(2, '0');
    if (num < min && val.length >= 2) (this.formData as any)[field] = min.toString().padStart(2, '0');
  }

  /** Toggle AM/PM */
  toggleAmPm(field: string): void {
    // Mapear nombres cortos a keys reales del formulario
    const keyMap: { [k: string]: string } = {
      'inicio': 'hora_inicio_ampm',
      'fin': 'hora_fin_ampm',
      'inicio2': 'hora_inicio_2_ampm',
      'fin2': 'hora_fin_2_ampm',
    };
    const key = keyMap[field];
    if (!key) return;
    (this.formData as any)[key] = (this.formData as any)[key] === 'AM' ? 'PM' : 'AM';
    this.onTimeChange();
  }

  /** Pad time input to 2 digits on blur */
  padTime(field: string): void {
    const val = (this.formData as any)[field];
    if (val && val.length === 1) {
      (this.formData as any)[field] = val.padStart(2, '0');
    }
    this.onTimeChange();
  }

  /** Convierte campos h/m/ampm a string 24h "HH:MM" */
  private fieldsToHora24(prefix: string): string {
    const h = (this.formData as any)[`hora_${prefix}_h`];
    const m = (this.formData as any)[`hora_${prefix}_m`];
    const ampm = (this.formData as any)[`hora_${prefix}_ampm`];
    if (!h && !m) return '';
    let hour = parseInt(h || '0', 10);
    const min = parseInt(m || '0', 10);
    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    return `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
  }

  /** Parsea HH:MM 24h a los campos h/m/ampm */
  private parseHora24ToFields(hora: string, prefix: string): any {
    const result: any = {};
    if (!hora) {
      result[`hora_${prefix}_h`] = '';
      result[`hora_${prefix}_m`] = '';
      result[`hora_${prefix}_ampm`] = 'AM';
      return result;
    }
    const [hStr, mStr] = hora.split(':');
    let h = parseInt(hStr || '0', 10);
    const m = parseInt(mStr || '0', 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    if (h > 12) h -= 12;
    if (h === 0) h = 12; // 00:00 en 24h = 12:00 AM
    result[`hora_${prefix}_h`] = h.toString().padStart(2, '0');
    result[`hora_${prefix}_m`] = m.toString().padStart(2, '0');
    result[`hora_${prefix}_ampm`] = ampm;
    return result;
  }

  private normalizarHora(hora: string): string {
    if (!hora) return hora;
    // Truncar a HH:MM (quitar segundos si vienen) — mantener cero líder (formato H:i de Laravel)
    return hora.substring(0, 5);
  }

  /** Convierte HH:MM 24h a formato 12h con AM/PM para mostrar en tabla */
  formatHora12(hora: string | null | undefined): string {
    if (!hora) return '--';
    const [hStr, mStr] = hora.split(':');
    let h = parseInt(hStr || '0', 10);
    const m = (mStr || '00').substring(0, 2);
    const ampm = h >= 12 ? 'PM' : 'AM';
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${ampm}`;
  }

  // ═══════ RELOJ SVG ═══════
  readonly Math = Math;

  getDuracionTotal(): number {
    this.onTimeChange();
    const inicio = this.formData.hora_inicio;
    const fin = this.formData.hora_fin;
    if (!inicio || !fin) return 0;

    // Rango 1
    const [h1, m1] = inicio.split(':').map(Number);
    const [h2, m2] = fin.split(':').map(Number);
    let minutos1 = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (minutos1 <= 0) minutos1 += 24 * 60;

    // Rango 2 (si existe)
    let minutos2 = 0;
    const inicio2 = this.formData.hora_inicio_2;
    const fin2 = this.formData.hora_fin_2;
    if (inicio2 && fin2) {
      const [h3, m3] = inicio2.split(':').map(Number);
      const [h4, m4] = fin2.split(':').map(Number);
      minutos2 = (h4 * 60 + m4) - (h3 * 60 + m3);
      if (minutos2 <= 0) minutos2 += 24 * 60;
    }

    return (minutos1 + minutos2) / 60;
  }

  getDuracionTexto(): string {
    const dur = this.getDuracionTotal();
    if (dur <= 0) return '--';
    return `${Math.floor(dur)}h ${Math.round((dur % 1) * 60).toString().padStart(2, '0')}m`;
  }

  getHorarioTexto(): string {
    const inicio = this.formData.hora_inicio;
    const fin = this.formData.hora_fin;
    if (!inicio || !fin) return '';
    return `${inicio.substring(0, 5)} - ${fin.substring(0, 5)}`;
  }

  getRelojArco(): string {
    const inicio = this.formData.hora_inicio;
    const fin = this.formData.hora_fin;
    if (!inicio || !fin) return '';
    return this.calcularArcoSvg(inicio, fin);
  }

  getRelojArco2(): string {
    const inicio = this.formData.hora_inicio_2;
    const fin = this.formData.hora_fin_2;
    if (!inicio || !fin) return '';
    return this.calcularArcoSvg(inicio, fin);
  }

  private calcularArcoSvg(inicio: string, fin: string): string {
    const [h1, m1] = inicio.split(':').map(Number);
    const [h2, m2] = fin.split(':').map(Number);
    const toAngle = (h: number, m: number) => ((h % 12) + m / 60) * 30;
    const a1 = toAngle(h1, m1);
    let a2 = toAngle(h2, m2);
    if (a2 <= a1) a2 += 360;
    const polar = (cx: number, cy: number, r: number, deg: number) => {
      const rad = (deg - 90) * Math.PI / 180;
      return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    };
    const p1 = polar(80, 80, 60, a1);
    const p2 = polar(80, 80, 60, a2);
    const large = (a2 - a1) > 180 ? 1 : 0;
    return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A 60 60 0 ${large} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  editarPlantilla(plantilla: any): void {
    this.editMode = true;
    this.currentId = plantilla.id;
    this.submitted = false;
    this.formData = {
      codigo:      plantilla.codigo ?? '',
      nombre:      plantilla.nombre,
      descripcion: plantilla.descripcion ?? '',
      hora_inicio: this.horaParaInput(plantilla.hora_inicio),
      hora_fin:    this.horaParaInput(plantilla.hora_fin),
      hora_inicio_2: this.horaParaInput(plantilla.hora_inicio_2 ?? ''),
      hora_fin_2:    this.horaParaInput(plantilla.hora_fin_2 ?? ''),
      ...this.parseHora24ToFields(plantilla.hora_inicio, 'inicio'),
      ...this.parseHora24ToFields(plantilla.hora_fin, 'fin'),
      ...this.parseHora24ToFields(plantilla.hora_inicio_2 ?? '', 'inicio_2'),
      ...this.parseHora24ToFields(plantilla.hora_fin_2 ?? '', 'fin_2'),
      hora_inicio_date: this.horaToDate(plantilla.hora_inicio),
      hora_fin_date:    this.horaToDate(plantilla.hora_fin),
      hora_inicio_2_date: this.horaToDate(plantilla.hora_inicio_2 ?? ''),
      hora_fin_2_date:    this.horaToDate(plantilla.hora_fin_2 ?? ''),
      id_empresa:  plantilla.id_empresa ?? null,
      activo:      plantilla.activo ?? plantilla.estado ?? true,
    };
    this.showFormDialog = true;
  }

  onSubmit(): void {
    this.submitted = true;
    this.onTimeChange(); // Sincronizar dates → strings
    if (!this.formData.codigo || !this.formData.nombre || !this.formData.hora_inicio || !this.formData.hora_fin) return;

    // Validar que tenga empresa asignada
    if (!this.formData.id_empresa) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Atención',
        detail: 'Debe seleccionar una empresa'
      });
      return;
    }

    this.isSubmitting = true;

    const payload: any = {
      codigo:      this.formData.codigo,
      nombre:      this.formData.nombre,
      descripcion: this.formData.descripcion ?? null,
      hora_inicio: this.normalizarHora(this.formData.hora_inicio),
      hora_fin:    this.normalizarHora(this.formData.hora_fin),
      hora_inicio_2: this.formData.hora_inicio_2 ? this.normalizarHora(this.formData.hora_inicio_2) : null,
      hora_fin_2:    this.formData.hora_fin_2 ? this.normalizarHora(this.formData.hora_fin_2) : null,
      id_empresa:  this.formData.id_empresa,
      estado:      this.formData.activo,
    };

    const request = this.editMode
      ? this.plantillaService.updatePlantilla(this.currentId!, payload)
      : this.plantillaService.createPlantilla(payload);

    request.subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: this.editMode ? 'Plantilla actualizada' : 'Plantilla creada'
        });
        this.showFormDialog = false;
        this.isSubmitting = false;
        this.loadPlantillas();
      },
      error: (error) => {
        console.error('Error al guardar plantilla:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: error.error?.message ?? 'No se pudo guardar la plantilla'
        });
        this.isSubmitting = false;
      }
    });
  }

  eliminarPlantilla(plantilla: any): void {
    this.confirmationService.confirm({
      message: `¿Eliminar la plantilla "${plantilla.codigo} - ${plantilla.nombre}"?`,
      header: 'Confirmar Eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.plantillaService.deletePlantilla(plantilla.id).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: 'Plantilla eliminada'
            });
            this.loadPlantillas();
          },
          error: (error) => {
            console.error('Error al eliminar plantilla:', error);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'No se pudo eliminar la plantilla'
            });
          }
        });
      }
    });
  }

  /**
   * Toggle estado activo/inactivo directamente desde la tabla
   */
  toggleEstadoPlantilla(plantilla: any): void {
    const nuevoEstado = !plantilla.estado;
    this.plantillaService.updatePlantilla(plantilla.id, { estado: nuevoEstado }).subscribe({
      next: () => {
        plantilla.estado = nuevoEstado;
        this.messageService.add({
          severity: 'success',
          summary: 'Estado actualizado',
          detail: `${plantilla.nombre} ahora está ${nuevoEstado ? 'activo' : 'inactivo'}`
        });
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cambiar el estado' });
      }
    });
  }

  /**
   * Obtiene el nombre de la empresa por ID
   */
  getNombreEmpresa(plantilla: any): string {
    if (plantilla.empresa?.nombre) return plantilla.empresa.nombre;
    if (!plantilla.id_empresa) return '—';
    const emp = this.userEmpresas.find(e => e.id === plantilla.id_empresa);
    return emp?.nombre ?? '—';
  }
}
