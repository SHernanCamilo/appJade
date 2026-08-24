import { ChangeDetectorRef, Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { firstValueFrom } from 'rxjs';

import { EmpresaService } from '../../../organizacion/empresa/services/empresa.service';
import { TrasladoAsistencialService } from './services/traslado-asistencial.service';
import {
  CAUSAS_ATENCION,
  crearHistoriaVacia,
  glasgowTotal,
  GRUPOS_ATENCION_ESPECIAL,
  GRUPOS_SERVICIO_TRASLADO,
  GlasgowTraslado,
  HistoriaTrasladoAsistencial,
  RegistroTrasladoLista,
  TipoTrasladoAsistencial
} from './models/traslado-asistencial.model';

@Component({
  selector: 'app-traslado-asistencial',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ToastModule, TooltipModule, TableModule, TagModule],
  providers: [MessageService],
  templateUrl: './trasladoAsistencial.component.html',
  styleUrl: './trasladoAsistencial.component.css',
  encapsulation: ViewEncapsulation.None
})
export class TrasladoAsistencialComponent implements OnInit {
  private readonly medilaserEmpresaId = 1;
  private readonly medilaserLogoUrl =
    'https://ticketprocess.medilaser.com.co/assets/images/Logo-Medilaser-grande.png';

  readonly gruposServicio = GRUPOS_SERVICIO_TRASLADO;
  readonly gruposAtencion = GRUPOS_ATENCION_ESPECIAL;
  readonly causasAtencion = CAUSAS_ATENCION;

  readonly glasgowMotora = [
    { valor: 6, label: 'Órdenes' },
    { valor: 5, label: 'Localiza' },
    { valor: 4, label: 'Retira' },
    { valor: 3, label: 'Flexión anormal' },
    { valor: 2, label: 'Extensión anormal' },
    { valor: 1, label: 'No hay' }
  ];

  readonly glasgowVerbal = [
    { valor: 5, label: 'Orientada' },
    { valor: 4, label: 'Confusa' },
    { valor: 3, label: 'Inapropiado' },
    { valor: 2, label: 'Incomprensible' },
    { valor: 1, label: 'No hay' }
  ];

  readonly glasgowOcular = [
    { valor: 4, label: 'Espontánea' },
    { valor: 3, label: 'Al llamado' },
    { valor: 2, label: 'Al dolor' },
    { valor: 1, label: 'No hay' }
  ];

  tipo: TipoTrasladoAsistencial | null = null;
  form: HistoriaTrasladoAsistencial = crearHistoriaVacia();
  logoUrl: string | null = null;
  empresaNombre = 'Clínica Medilaser S.A.S.';
  registros: RegistroTrasladoLista[] = [];
  registroId: number | null = null;
  estadoRegistro: 'guardado' | 'confirmado' | null = null;
  isSaving = false;
  isConfirming = false;
  isLoadingRegistros = false;

  constructor(
    private readonly empresaService: EmpresaService,
    private readonly trasladoService: TrasladoAsistencialService,
    private readonly messageService: MessageService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarRegistros();
  }

  get tituloFormulario(): string {
    if (this.tipo === 'secundario' || this.tipo === 'secundarioCompleto') {
      return 'HISTORIA CLÍNICA EN EL TRASLADO SECUNDARIO ASISTENCIAL';
    }
    if (this.tipo === 'primario') {
      return 'HOJA DE TRASLADO PRIMARIO ASISTENCIAL DE PERSONAS';
    }
    return 'HISTORIA CLÍNICA EN EL TRASLADO PRIMARIO ASISTENCIAL';
  }

  get codigoFormulario(): string {
    if (this.tipo === 'secundario') {
      return 'Res. 2284 / 2023';
    }
    if (this.tipo === 'secundarioCompleto') {
      return 'F-AU-1165 MD';
    }
    if (this.tipo === 'primario') {
      return 'Res. 2284 / 2023';
    }
    return 'F-AU-1164 MD';
  }

  get esFormatoCompleto(): boolean {
    return this.tipo === 'primarioCompleto' || this.tipo === 'secundarioCompleto';
  }

  get glasgowInicioTotal(): number | '' {
    return glasgowTotal(this.form.glasgow);
  }

  get esConfirmado(): boolean {
    return this.estadoRegistro === 'confirmado';
  }

  seleccionarTipo(tipo: TipoTrasladoAsistencial): void {
    this.tipo = tipo;
    this.form = crearHistoriaVacia();
    this.registroId = null;
    this.estadoRegistro = null;
    void this.cargarLogoMedilaser();
  }

  volverSeleccion(): void {
    this.tipo = null;
    this.registroId = null;
    this.estadoRegistro = null;
    this.cargarRegistros();
  }

  toggleLista(lista: string[], valor: string): void {
    const idx = lista.indexOf(valor);
    if (idx >= 0) {
      lista.splice(idx, 1);
    } else {
      lista.push(valor);
    }
  }

  estaEnLista(lista: string[], valor: string): boolean {
    return lista.includes(valor);
  }

  setGlasgow(campo: keyof GlasgowTraslado, valor: number): void {
    this.form.glasgow[campo] = this.form.glasgow[campo] === valor ? null : valor;
  }

  imprimir(): void {
    window.print();
  }

  limpiar(): void {
    if (this.esConfirmado) {
      return;
    }
    this.form = crearHistoriaVacia();
    this.messageService.add({
      severity: 'info',
      summary: 'Formulario limpio',
      detail: 'Se reiniciaron todos los campos.',
      life: 3000
    });
  }

  async guardar(): Promise<void> {
    if (!this.tipo || this.isSaving || this.esConfirmado) {
      return;
    }

    this.isSaving = true;
    try {
      const saved = this.registroId
        ? await firstValueFrom(this.trasladoService.actualizar(this.registroId, this.buildPayload()))
        : await firstValueFrom(this.trasladoService.guardar(this.buildPayload()));

      this.registroId = saved.id;
      this.estadoRegistro = saved.estado;
      this.messageService.add({
        severity: 'success',
        summary: 'Guardado',
        detail: 'El traslado quedó en estado guardado.',
        life: 4000
      });
    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: 'No se pudo guardar',
        detail: this.errorDetail(err, 'Ocurrió un error al guardar el traslado.'),
        life: 6000
      });
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }

  async confirmar(): Promise<void> {
    if (!this.tipo || this.isConfirming || this.esConfirmado) {
      return;
    }

    this.isConfirming = true;
    try {
      let id = this.registroId;
      if (!id) {
        const saved = await firstValueFrom(this.trasladoService.guardar(this.buildPayload()));
        id = saved.id;
        this.registroId = id;
      }

      const confirmed = await firstValueFrom(
        this.trasladoService.confirmar(id, this.buildPayload())
      );
      this.registroId = confirmed.id;
      this.estadoRegistro = confirmed.estado;
      this.messageService.add({
        severity: 'success',
        summary: 'Confirmado',
        detail: 'El traslado quedó confirmado.',
        life: 4500
      });
    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: 'No se pudo confirmar',
        detail: this.errorDetail(err, 'Ocurrió un error al confirmar el traslado.'),
        life: 6000
      });
    } finally {
      this.isConfirming = false;
      this.cdr.detectChanges();
    }
  }

  abrirRegistro(row: RegistroTrasladoLista): void {
    this.trasladoService.obtener(row.id).subscribe({
      next: (detalle) => {
        this.tipo = (detalle.formato as TipoTrasladoAsistencial) || (detalle.tipo === 'secundario' ? 'secundario' : 'primario');
        this.form = { ...crearHistoriaVacia(), ...(detalle.datos ?? {}) };
        this.registroId = detalle.id;
        this.estadoRegistro = detalle.estado;
        void this.cargarLogoMedilaser();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo abrir',
          detail: this.errorDetail(err, 'Ocurrió un error al cargar el registro.'),
          life: 6000
        });
      }
    });
  }

  private cargarRegistros(): void {
    this.isLoadingRegistros = true;
    this.trasladoService.listar().subscribe({
      next: (rows) => {
        this.registros = rows;
        this.isLoadingRegistros = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.registros = [];
        this.isLoadingRegistros = false;
        this.cdr.detectChanges();
      }
    });
  }

  private buildPayload() {
    if (!this.tipo) {
      throw new Error('Debe seleccionar el tipo de formulario.');
    }

    return {
      formato: this.tipo,
      datos: this.form,
      fecha_atencion: this.form.fechaAtencion || null,
      nombres_apellidos: this.form.nombresApellidos || null,
      tipo_identificacion: this.form.tipoIdentificacion || null,
      numero_identificacion: this.form.numeroIdentificacion || null,
      estado_paciente: this.form.estadoFinal || null
    };
  }

  private errorDetail(err: unknown, fallback: string): string {
    const httpErr = err as { error?: { message?: string } };
    return httpErr?.error?.message || fallback;
  }

  onLogoError(): void {
    if (this.logoUrl?.startsWith('data:image')) {
      return;
    }
    this.logoUrl = null;
    this.cdr.detectChanges();
  }

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
}
