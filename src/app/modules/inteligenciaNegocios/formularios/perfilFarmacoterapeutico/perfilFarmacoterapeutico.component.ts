import { ChangeDetectorRef, Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { firstValueFrom, Subscription } from 'rxjs';

import { VistasService } from '../../services/vistas.service';
import { handleFabricError } from '../../helpers/fabric-error.helper';
import { EmpresaService } from '../../../organizacion/empresa/services/empresa.service';
import { PerfilFarmacoterapeuticoExportService } from './services/perfil-farmacoterapeutico-export.service';
import {
  PerfilFarmacoDraft,
  PerfilFarmacoterapeuticoDraftService
} from './services/perfil-farmacoterapeutico-draft.service';

interface PacientePerfil {
  nombre: string;
  edad: string;
  sexo: string;
  peso: string;
  historia: string;
  ingreso: string;
  diagnostico: string;
  servicio: string;
  cama: string;
  alergias: '' | 'si' | 'no' | 'no_esp';
  alergiasCual: string;
  mesReferencia: Date;
}

interface MedicamentoFila {
  key: string;
  cuenta: string;
  producto: string;
  concentracion: string;
  presentacion: string;
  dosis: string;
  unidad: string;
  viaAdm: string;
  frecuencia: string;
  unidadFrecuencia: string;
  peso: string;
  /** Texto editable por día del mes (clave = número de día). */
  dias: Record<number, string>;
  /** Presente en la vista pero no en el guardado temporal. */
  esNuevo?: boolean;
}

@Component({
  selector: 'app-perfil-farmacoterapeutico',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    ToastModule,
    TooltipModule
  ],
  providers: [MessageService],
  templateUrl: './perfilFarmacoterapeutico.component.html',
  styleUrl: './perfilFarmacoterapeutico.component.css',
  encapsulation: ViewEncapsulation.None
})
export class PerfilFarmacoterapeuticoComponent implements OnInit, OnDestroy {
  private readonly schema = 'in';
  private readonly viewName = 'VW_PerfilMedicamentos';
  private readonly filterColumn = 'Documento';

  /** Este formato siempre usa el logo de Clínica Medilaser (empresa id 1). */
  private readonly medilaserEmpresaId = 1;
  private readonly medilaserLogoUrl =
    'https://ticketprocess.medilaser.com.co/assets/images/Logo-Medilaser-grande.png';

  numeroCc = '';
  isLoading = false;
  isExporting = false;
  consultado = false;
  ultimaConsulta = '';

  paciente: PacientePerfil | null = null;
  medicamentos: MedicamentoFila[] = [];
  diasDelMes: number[] = [];
  logoUrl: string | null = null;
  empresaNombre = 'Clínica Medilaser S.A.S.';
  tieneTemporal = false;
  medicamentosNuevos = 0;

  private dataSub?: Subscription;

  constructor(
    private readonly vistasService: VistasService,
    private readonly messageService: MessageService,
    private readonly empresaService: EmpresaService,
    private readonly cdr: ChangeDetectorRef,
    private readonly exportService: PerfilFarmacoterapeuticoExportService,
    private readonly draftService: PerfilFarmacoterapeuticoDraftService
  ) {}

  ngOnInit(): void {
    void this.cargarLogoMedilaser();
  }

  ngOnDestroy(): void {
    this.dataSub?.unsubscribe();
  }

  get ccValida(): boolean {
    return /^\d{5,20}$/.test(this.numeroCc.trim());
  }

  get puedeExportar(): boolean {
    return !!this.paciente && !this.isLoading && !this.isExporting;
  }

  get puedeGuardarTemporal(): boolean {
    return !!this.paciente && !this.isLoading && !this.isExporting;
  }

  get mesEtiqueta(): string {
    if (!this.paciente) {
      return '';
    }
    return this.paciente.mesReferencia.toLocaleDateString('es-CO', {
      month: 'long',
      year: 'numeric'
    });
  }

  onLogoError(): void {
    // Si falla una URL remota, no borrar un data URL válido
    if (this.logoUrl?.startsWith('data:image')) {
      return;
    }
    this.logoUrl = null;
    this.cdr.detectChanges();
  }

  onCcInput(value: string): void {
    this.numeroCc = value.replace(/\D/g, '');
  }

  onCcKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.consultar();
    }
  }

  consultar(): void {
    const cc = this.numeroCc.trim();

    if (!cc) {
      this.messageService.add({
        severity: 'warn',
        summary: 'CC requerida',
        detail: 'Digite el número de cédula para consultar.',
        life: 4000
      });
      return;
    }

    if (!this.ccValida) {
      this.messageService.add({
        severity: 'warn',
        summary: 'CC inválida',
        detail: 'Ingrese solo números (entre 5 y 20 dígitos).',
        life: 4000
      });
      return;
    }

    this.cargarDatos(cc);
  }

  limpiar(): void {
    this.dataSub?.unsubscribe();
    this.numeroCc = '';
    this.paciente = null;
    this.medicamentos = [];
    this.diasDelMes = [];
    this.consultado = false;
    this.ultimaConsulta = '';
    this.isLoading = false;
    this.tieneTemporal = false;
    this.medicamentosNuevos = 0;
  }

  recargar(): void {
    if (!this.ultimaConsulta) {
      return;
    }
    this.cargarDatos(this.ultimaConsulta);
  }

  guardarTemporal(): void {
    if (!this.paciente || !this.ultimaConsulta) {
      return;
    }

    try {
      this.draftService.guardar(this.buildDraftPayload());
      this.tieneTemporal = true;
      this.medicamentosNuevos = 0;
      this.medicamentos = this.medicamentos.map(m => ({ ...m, esNuevo: false }));
      this.messageService.add({
        severity: 'success',
        summary: 'Guardado temporal',
        detail: `Borrador guardado para la CC ${this.ultimaConsulta}.`,
        life: 4500
      });
      this.cdr.detectChanges();
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'No se pudo guardar el temporal.';
      this.messageService.add({
        severity: 'error',
        summary: 'Error al guardar',
        detail,
        life: 6000
      });
    }
  }

  async exportarExcel(): Promise<void> {
    if (!this.paciente || this.isExporting) {
      return;
    }

    this.isExporting = true;
    try {
      const logoDataUrl = await this.resolveLogoDataUrl();
      if (!logoDataUrl) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Logo no incluido',
          detail: 'No se pudo obtener el logo de la empresa; el Excel se genera sin imagen.',
          life: 5000
        });
      }

      const documento = this.ultimaConsulta || this.paciente.historia;
      const filename = await this.exportService.exportar({
        paciente: this.paciente,
        medicamentos: this.medicamentos,
        diasDelMes: this.diasDelMes,
        documento,
        empresaNombre: this.empresaNombre,
        logoDataUrl
      });

      this.draftService.eliminar(documento);
      this.tieneTemporal = false;
      this.medicamentosNuevos = 0;
      this.medicamentos = this.medicamentos.map(m => ({ ...m, esNuevo: false }));

      this.messageService.add({
        severity: 'success',
        summary: 'Excel generado',
        detail: `${filename} · Temporal eliminado.`,
        life: 5000
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'No se pudo generar el archivo Excel.';
      this.messageService.add({
        severity: 'error',
        summary: 'Error al exportar',
        detail,
        life: 6000
      });
    } finally {
      this.isExporting = false;
      this.cdr.detectChanges();
    }
  }

  private cargarDatos(cc: string): void {
    this.dataSub?.unsubscribe();
    this.isLoading = true;
    this.consultado = true;
    this.ultimaConsulta = cc;
    this.paciente = null;
    this.medicamentos = [];
    this.diasDelMes = [];
    this.tieneTemporal = false;
    this.medicamentosNuevos = 0;

    this.dataSub = this.vistasService.getVistaDatosTodos(this.schema, this.viewName, {
      filters: { [this.filterColumn]: cc }
    }).subscribe({
      next: (response) => {
        if (response.partial) {
          return;
        }

        this.isLoading = false;
        const rows = (response.rowData ?? []).map(r => this.trimRow(r));

        if (!rows.length) {
          this.messageService.add({
            severity: 'info',
            summary: 'Sin resultados',
            detail: `No se encontró perfil farmacoterapéutico para la CC ${cc}.`,
            life: 5000
          });
          return;
        }

        this.paciente = this.mapPaciente(rows[0], cc);
        this.diasDelMes = this.buildDiasDelMes(this.paciente.mesReferencia);
        this.medicamentos = this.mapMedicamentos(rows, this.diasDelMes);
        this.aplicarTemporalSiExiste(cc);
        void this.cargarLogoMedilaser();
      },
      error: (err: unknown) => {
        this.isLoading = false;
        this.paciente = null;
        this.medicamentos = [];
        this.tieneTemporal = false;
        this.medicamentosNuevos = 0;
        const detail = err instanceof HttpErrorResponse
          ? handleFabricError(err)
          : 'No se pudo consultar el perfil farmacoterapéutico.';
        this.messageService.add({
          severity: 'error',
          summary: 'Error al consultar',
          detail,
          life: 7000
        });
      }
    });
  }

  private buildDraftPayload(): PerfilFarmacoDraft {
    if (!this.paciente) {
      throw new Error('No hay paciente para guardar.');
    }

    return {
      documento: this.ultimaConsulta || this.paciente.historia,
      guardadoEn: new Date().toISOString(),
      diasDelMes: [...this.diasDelMes],
      paciente: {
        nombre: this.paciente.nombre,
        edad: this.paciente.edad,
        sexo: this.paciente.sexo,
        peso: this.paciente.peso,
        historia: this.paciente.historia,
        ingreso: this.paciente.ingreso,
        diagnostico: this.paciente.diagnostico,
        servicio: this.paciente.servicio,
        cama: this.paciente.cama,
        alergias: this.paciente.alergias,
        alergiasCual: this.paciente.alergiasCual,
        mesReferencia: this.paciente.mesReferencia.toISOString()
      },
      medicamentos: this.medicamentos.map(m => ({
        key: m.key,
        cuenta: m.cuenta,
        producto: m.producto,
        concentracion: m.concentracion,
        presentacion: m.presentacion,
        dosis: m.dosis,
        unidad: m.unidad,
        viaAdm: m.viaAdm,
        frecuencia: m.frecuencia,
        unidadFrecuencia: m.unidadFrecuencia,
        peso: m.peso,
        dias: Object.fromEntries(
          Object.entries(m.dias).map(([k, v]) => [String(k), v ?? ''])
        )
      }))
    };
  }

  /**
   * Si hay borrador temporal para la CC:
   * - restaura alergias y casillas DIA/MES
   * - marca en amarillo los medicamentos nuevos de la vista que no estaban en el temporal
   */
  private aplicarTemporalSiExiste(cc: string): void {
    const draft = this.draftService.obtener(cc);
    if (!draft || !this.paciente) {
      this.tieneTemporal = false;
      this.medicamentosNuevos = 0;
      return;
    }

    this.tieneTemporal = true;

    const alergias = draft.paciente.alergias;
    if (alergias === 'si' || alergias === 'no' || alergias === 'no_esp' || alergias === '') {
      this.paciente.alergias = alergias;
    }
    this.paciente.alergiasCual = draft.paciente.alergiasCual ?? '';

    const draftByKey = new Map(draft.medicamentos.map(m => [m.key, m]));
    let nuevos = 0;

    this.medicamentos = this.medicamentos.map(med => {
      const saved = draftByKey.get(med.key);
      if (!saved) {
        nuevos++;
        return { ...med, esNuevo: true };
      }

      const dias: Record<number, string> = { ...med.dias };
      for (const d of this.diasDelMes) {
        const val = saved.dias?.[String(d)] ?? saved.dias?.[d as unknown as string];
        if (val != null) {
          dias[d] = String(val);
        }
      }

      return { ...med, dias, esNuevo: false };
    });

    this.medicamentosNuevos = nuevos;

    const cuando = draft.guardadoEn
      ? new Date(draft.guardadoEn).toLocaleString('es-CO')
      : '';

    this.messageService.add({
      severity: 'info',
      summary: 'Temporal restaurado',
      detail: nuevos > 0
        ? `Borrador cargado${cuando ? ` (${cuando})` : ''}. ${nuevos} medicamento(s) nuevo(s) marcado(s) en amarillo.`
        : `Borrador cargado${cuando ? ` (${cuando})` : ''}.`,
      life: 6500
    });
  }

  private mapPaciente(row: Record<string, unknown>, cc: string): PacientePerfil {
    const fechaIngreso = this.parseDate(row['FechaIngreso']);
    const edadNum = this.toNumber(row['Edad']);
    const pesoNum = this.toNumber(row['Peso']);
    // Historia Nº = columna Documento de la vista
    const historia = this.clean(row['Documento']) || cc;

    return {
      nombre: this.clean(row['Paciente']) || 'PACIENTE',
      edad: edadNum > 0 ? `${edadNum} años` : '—',
      sexo: this.clean(row['Sexo']) || '—',
      peso: pesoNum > 0 ? String(pesoNum) : '—',
      historia,
      ingreso: this.clean(row['Ingreso']) || '—',
      diagnostico: this.clean(row['Diagnostico']) || '—',
      servicio: this.clean(row['Servicio']) || '—',
      cama: this.clean(row['Cama']) || '—',
      alergias: '',
      alergiasCual: '',
      mesReferencia: fechaIngreso ?? new Date()
    };
  }

  private mapMedicamentos(rows: Record<string, unknown>[], dias: number[]): MedicamentoFila[] {
    const byKey = new Map<string, MedicamentoFila>();
    const diasVacios = (): Record<number, string> => {
      const map: Record<number, string> = {};
      for (const d of dias) {
        map[d] = '';
      }
      return map;
    };

    for (const row of rows) {
      const producto = this.clean(row['Producto']);
      if (!producto) {
        continue;
      }

      const cuenta = this.clean(row['Cuenta']);
      const concentracion = this.clean(row['Concentracion']);
      const presentacion = this.clean(row['Presentacion']);
      const dosis = this.clean(row['Dosis']);
      const unidad = this.clean(row['Unidad']);
      const via = this.clean(row['ViaAdm']);
      const freq = this.clean(row['Frecuencia']);
      const unidadFreq = this.clean(row['UnidadFrecuencia']);
      const peso = this.clean(row['Peso']);

      const key = [
        cuenta,
        producto,
        concentracion,
        dosis,
        via,
        freq,
        unidadFreq
      ].join('|').toLowerCase();

      if (byKey.has(key)) {
        continue;
      }

      byKey.set(key, {
        key,
        cuenta,
        producto,
        concentracion,
        presentacion,
        dosis,
        unidad,
        viaAdm: via,
        frecuencia: freq,
        unidadFrecuencia: unidadFreq,
        peso,
        dias: diasVacios()
      });
    }

    return Array.from(byKey.values()).sort((a, b) =>
      a.producto.localeCompare(b.producto, 'es')
    );
  }

  private buildDiasDelMes(ref: Date): number[] {
    const total = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  /** Logo fijo de Clínica Medilaser para pantalla y Excel. */
  private async cargarLogoMedilaser(): Promise<void> {
    this.empresaNombre = 'Clínica Medilaser S.A.S.';
    try {
      const logoResp = await firstValueFrom(
        this.empresaService.getLogoBase64(this.medilaserEmpresaId)
      );
      if (logoResp?.nombre) {
        this.empresaNombre = String(logoResp.nombre).trim();
      }
      const base64 = String(logoResp?.logo_base64 ?? '').trim();
      if (base64.startsWith('data:image') && !base64.includes('image/svg')) {
        this.logoUrl = base64;
        this.cdr.detectChanges();
        return;
      }
      if (base64.length > 100 && !base64.startsWith('data:')) {
        this.logoUrl = `data:image/png;base64,${base64}`;
        this.cdr.detectChanges();
        return;
      }
      const url = String(logoResp?.logo_url ?? this.medilaserLogoUrl).trim();
      this.logoUrl = url || this.medilaserLogoUrl;
      this.cdr.detectChanges();
    } catch {
      this.logoUrl = this.medilaserLogoUrl;
      this.cdr.detectChanges();
    }
  }

  /**
   * Excel solo incrusta imágenes embebidas (buffer/base64).
   * Siempre Clínica Medilaser: data URL → API logo-base64 → URL fija.
   */
  private async resolveLogoDataUrl(): Promise<string | null> {
    if (this.logoUrl?.startsWith('data:image') && !this.logoUrl.includes('image/svg')) {
      return this.logoUrl;
    }

    try {
      const resp = await firstValueFrom(
        this.empresaService.getLogoBase64(this.medilaserEmpresaId)
      );
      const base64 = String(resp?.logo_base64 ?? '').trim();
      if (base64.startsWith('data:image') && !base64.includes('image/svg')) {
        this.logoUrl = base64;
        this.cdr.detectChanges();
        return base64;
      }
      if (base64.length > 100 && !base64.startsWith('data:')) {
        const dataUrl = `data:image/png;base64,${base64}`;
        this.logoUrl = dataUrl;
        this.cdr.detectChanges();
        return dataUrl;
      }
    } catch {
      // se intenta con URL fija de Medilaser
    }

    for (const candidate of [this.logoUrl, this.medilaserLogoUrl]) {
      if (!candidate?.trim()) {
        continue;
      }
      const dataUrl = await this.loadImageAsDataUrl(candidate.trim());
      if (dataUrl) {
        this.logoUrl = dataUrl;
        this.cdr.detectChanges();
        return dataUrl;
      }
    }

    return null;
  }

  private async loadImageAsDataUrl(url: string): Promise<string | null> {
    try {
      if (url.startsWith('data:image')) {
        return url.includes('image/svg') ? null : url;
      }

      const absolute = /^https?:\/\//i.test(url)
        ? url
        : `${window.location.origin}/${url.replace(/^\//, '')}`;

      // fetch evita problemas de HttpClient/CORS en URLs externas del logo
      const response = await fetch(absolute, {
        mode: 'cors',
        credentials: /^https?:\/\//i.test(url) ? 'omit' : 'same-origin'
      });
      if (!response.ok) {
        return null;
      }

      const blob = await response.blob();
      if (!blob.type.startsWith('image/') || blob.type.includes('svg')) {
        return null;
      }

      return await this.blobToDataUrl(blob);
    } catch {
      return null;
    }
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('No se pudo leer el logo.'));
      reader.readAsDataURL(blob);
    });
  }

  private trimRow(row: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      out[k] = typeof v === 'string' ? v.trim() : v;
    }
    return out;
  }

  private clean(value: unknown): string {
    if (value == null) {
      return '';
    }
    return String(value).replace(/\s+/g, ' ').trim();
  }

  private toNumber(value: unknown): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }
    const n = Number(String(value ?? '').replace(',', '.').trim());
    return Number.isFinite(n) ? n : 0;
  }

  private parseDate(value: unknown): Date | null {
    if (!value) {
      return null;
    }
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value;
    }
    const d = new Date(String(value));
    return Number.isNaN(d.getTime()) ? null : d;
  }
}
