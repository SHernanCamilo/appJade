import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService, ConfirmationService } from 'primeng/api';
import { TagModule } from 'primeng/tag';
import { TabViewModule } from 'primeng/tabview';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DropdownModule } from 'primeng/dropdown';
import { TooltipModule } from 'primeng/tooltip';
import { SkeletonModule } from 'primeng/skeleton';
import { ConfirmDialogModule } from 'primeng/confirmdialog';

import { AnticipoSolicitudService } from '../../services/anticipo-solicitud.service';
import { AnticipoDocumentoService, Documento, TIPOS_DOCUMENTO } from '../../services/anticipo-documento.service';
import { Solicitud, Aprobacion, ACCIONES_POR_ESTADO } from '../../models/anticipo.models';

@Component({
  selector: 'app-detalle-solicitud',
  standalone: true,
  imports: [
    CommonModule, RouterModule, FormsModule,
    ButtonModule, ToastModule, TagModule, TabViewModule, DialogModule,
    InputTextModule, InputNumberModule, DropdownModule, TooltipModule,
    SkeletonModule, ConfirmDialogModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './detalle-solicitud.component.html',
  styleUrl: './detalle-solicitud.component.css'
})
export class DetalleSolicitudComponent implements OnInit {

  solicitud: Solicitud | null = null;
  aprobaciones: Aprobacion[] = [];
  documentos: Documento[] = [];
  isLoading = true;
  activeTab = 0;

  // Acciones
  displayAprobar = false;
  displayRechazar = false;
  displayLegalizar = false;
  displayDecision = false;

  comentarioAprobacion = '';
  montoAutorizado: number | null = null;
  comentarioRechazo = '';
  montoLegalizado: number | null = null;
  observacionesLegalizacion = '';
  decisionContabilidad: 'aceptar' | 'sobrante' | 'excedente' = 'aceptar';
  comentarioDecision = '';

  // Documentos
  tiposDocumento = TIPOS_DOCUMENTO;
  tipoDocumentoSeleccionado = 'soporte_viaje';
  archivoSeleccionado: File | null = null;
  isSubiendo = false;

  decisionOptions = [
    { label: 'Aceptar (cerrar)', value: 'aceptar' },
    { label: 'Sobrante (reintegro)', value: 'sobrante' },
    { label: 'Excedente (pago adicional)', value: 'excedente' }
  ];

  constructor(
    private route: ActivatedRoute,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private solicitudService: AnticipoSolicitudService,
    private documentoService: AnticipoDocumentoService
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) this.cargarSolicitud(id);
  }

  // ── CARGA ─────────────────────────────────────────────────────────────────

  cargarSolicitud(id: number): void {
    this.isLoading = true;
    this.solicitudService.verSolicitud(id).subscribe({
      next: (res: any) => {
        this.solicitud = res.data ?? res;
        this.isLoading = false;
        this.cargarHistorial(id);
        this.cargarDocumentos(id);
      },
      error: () => { this.toast('error', 'No se pudo cargar la solicitud'); this.isLoading = false; }
    });
  }

  cargarHistorial(id: number): void {
    this.solicitudService.obtenerHistorial(id).subscribe({
      next: (res: any) => {
        const data = res.data ?? res;
        this.aprobaciones = data.aprobaciones ?? [];
      },
      error: () => { this.aprobaciones = []; }
    });
  }

  cargarDocumentos(id: number): void {
    this.documentoService.listarDocumentos(id).subscribe({
      next: (res: any) => {
        this.documentos = res.data ?? res ?? [];
      },
      error: () => { this.documentos = []; }
    });
  }

  // ── ACCIONES ──────────────────────────────────────────────────────────────

  getAccionesDisponibles(): string[] {
    if (!this.solicitud) return [];
    return ACCIONES_POR_ESTADO[this.solicitud.estado] ?? [];
  }

  tieneAccion(accion: string): boolean {
    return this.getAccionesDisponibles().includes(accion);
  }

  // Aprobar
  abrirAprobar(): void {
    this.comentarioAprobacion = '';
    this.montoAutorizado = null;
    this.displayAprobar = true;
  }

  confirmarAprobar(): void {
    if (!this.solicitud) return;
    this.solicitudService.aprobarSolicitud(this.solicitud.id, {
      comentario: this.comentarioAprobacion || undefined,
      monto_autorizado: this.montoAutorizado || undefined
    }).subscribe({
      next: (res: any) => {
        this.toast('success', res.message || 'Solicitud aprobada');
        this.displayAprobar = false;
        this.cargarSolicitud(this.solicitud!.id);
      },
      error: (err) => this.toast('error', err.error?.message || 'Error al aprobar')
    });
  }

  // Rechazar
  abrirRechazar(): void {
    this.comentarioRechazo = '';
    this.displayRechazar = true;
  }

  confirmarRechazar(): void {
    if (!this.solicitud || !this.comentarioRechazo.trim()) {
      this.toast('warn', 'El comentario es obligatorio para rechazar');
      return;
    }
    this.solicitudService.rechazarSolicitud(this.solicitud.id, {
      comentario: this.comentarioRechazo
    }).subscribe({
      next: (res: any) => {
        this.toast('success', res.message || 'Solicitud rechazada');
        this.displayRechazar = false;
        this.cargarSolicitud(this.solicitud!.id);
      },
      error: (err) => this.toast('error', err.error?.message || 'Error al rechazar')
    });
  }

  // Desembolsar
  desembolsar(): void {
    if (!this.solicitud) return;
    this.confirmationService.confirm({
      message: '¿Confirma el desembolso de esta solicitud?',
      header: 'Confirmar Desembolso',
      icon: 'pi pi-wallet',
      acceptLabel: 'Sí, desembolsar',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.solicitudService.desembolsar(this.solicitud!.id).subscribe({
          next: (res: any) => {
            this.toast('success', res.message || 'Anticipo desembolsado');
            this.cargarSolicitud(this.solicitud!.id);
          },
          error: (err) => this.toast('error', err.error?.message || 'Error al desembolsar')
        });
      }
    });
  }

  // Legalizar
  abrirLegalizar(): void {
    this.montoLegalizado = null;
    this.observacionesLegalizacion = '';
    this.displayLegalizar = true;
  }

  confirmarLegalizar(): void {
    if (!this.solicitud || !this.montoLegalizado || this.montoLegalizado <= 0) {
      this.toast('warn', 'Ingrese el monto legalizado');
      return;
    }
    this.solicitudService.legalizar(this.solicitud.id, {
      monto_legalizado: this.montoLegalizado,
      observaciones: this.observacionesLegalizacion || undefined
    }).subscribe({
      next: (res: any) => {
        this.toast('success', res.message || 'Solicitud legalizada');
        this.displayLegalizar = false;
        this.cargarSolicitud(this.solicitud!.id);
      },
      error: (err) => this.toast('error', err.error?.message || 'Error al legalizar')
    });
  }

  // Decidir Contabilidad
  abrirDecision(): void {
    this.decisionContabilidad = 'aceptar';
    this.comentarioDecision = '';
    this.displayDecision = true;
  }

  confirmarDecision(): void {
    if (!this.solicitud) return;
    this.solicitudService.decidirContabilidad(this.solicitud.id, {
      decision: this.decisionContabilidad,
      comentario: this.comentarioDecision || undefined
    }).subscribe({
      next: (res: any) => {
        this.toast('success', res.message || 'Decisión registrada');
        this.displayDecision = false;
        this.cargarSolicitud(this.solicitud!.id);
      },
      error: (err) => this.toast('error', err.error?.message || 'Error al registrar decisión')
    });
  }

  // Registrar Devolución
  registrarDevolucion(): void {
    if (!this.solicitud) return;
    this.solicitudService.registrarDevolucion(this.solicitud.id).subscribe({
      next: (res: any) => {
        this.toast('success', res.message || 'Devolución registrada');
        this.cargarSolicitud(this.solicitud!.id);
      },
      error: (err) => this.toast('error', err.error?.message || 'Error')
    });
  }

  // Cerrar
  cerrarSolicitud(): void {
    if (!this.solicitud) return;
    this.solicitudService.cerrar(this.solicitud.id).subscribe({
      next: (res: any) => {
        this.toast('success', res.message || 'Solicitud cerrada');
        this.cargarSolicitud(this.solicitud!.id);
      },
      error: (err) => this.toast('error', err.error?.message || 'Error al cerrar')
    });
  }

  // ── DOCUMENTOS ────────────────────────────────────────────────────────────

  onArchivoSeleccionado(event: any): void {
    const file = event.target.files?.[0];
    if (file) this.archivoSeleccionado = file;
  }

  subirDocumento(): void {
    if (!this.solicitud || !this.archivoSeleccionado) {
      this.toast('warn', 'Seleccione un archivo');
      return;
    }
    this.isSubiendo = true;
    this.documentoService.subirDocumento(
      this.solicitud.id,
      this.archivoSeleccionado,
      this.tipoDocumentoSeleccionado
    ).subscribe({
      next: (res: any) => {
        this.toast('success', 'Documento subido correctamente');
        this.archivoSeleccionado = null;
        this.isSubiendo = false;
        this.cargarDocumentos(this.solicitud!.id);
      },
      error: (err) => {
        this.toast('error', err.error?.message || 'Error al subir documento');
        this.isSubiendo = false;
      }
    });
  }

  descargarDocumento(doc: Documento): void {
    this.documentoService.descargarDocumento(doc.id).subscribe({
      next: (res: any) => {
        const data = res.data ?? res;
        if (data.url) {
          window.open(data.url, '_blank');
        }
      },
      error: () => this.toast('error', 'Error al descargar')
    });
  }

  eliminarDocumento(doc: Documento): void {
    this.confirmationService.confirm({
      message: `¿Eliminar "${doc.nombre_archivo}"?`,
      header: 'Confirmar',
      icon: 'pi pi-trash',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.documentoService.eliminarDocumento(doc.id).subscribe({
          next: () => {
            this.toast('success', 'Documento eliminado');
            this.cargarDocumentos(this.solicitud!.id);
          },
          error: () => this.toast('error', 'No se pudo eliminar')
        });
      }
    });
  }

  // ── HELPERS ───────────────────────────────────────────────────────────────

  formatCurrency(value: number | string | null): string {
    if (!value) return '$0';
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(Number(value));
  }

  formatDate(date: string | null): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  formatDateTime(date: string | null): string {
    if (!date) return '-';
    return new Date(date).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  getSeverity(estado: string): 'success' | 'warn' | 'danger' | 'info' | 'secondary' {
    const map: Record<string, any> = {
      autorizado: 'success', en_viaje: 'success', legalizado: 'success', reintegrado: 'success',
      aprobado_excedente: 'success', cerrado: 'secondary',
      pendiente_jefe: 'warn', pendiente_jefe_inmediato: 'warn',
      pendiente_financiero: 'warn', pendiente_tesoreria: 'warn',
      pendiente_vicepresidente: 'warn', pendiente_legalizacion: 'warn',
      pendiente_reintegro: 'warn', pendiente_excedente: 'warn', borrador: 'info',
      rechazado_jefe: 'danger', rechazado_jefe_inmediato: 'danger',
      rechazado_financiero: 'danger', rechazado_excedente: 'danger'
    };
    return map[estado] ?? 'info';
  }

  getEstadoLabel(estado: string): string {
    const map: Record<string, string> = {
      borrador: 'Borrador', pendiente_jefe: 'Pendiente Jefe', pendiente_jefe_inmediato: 'Pendiente Jefe',
      rechazado_jefe: 'Rechazado', rechazado_jefe_inmediato: 'Rechazado',
      pendiente_financiero: 'Pendiente Financiero', rechazado_financiero: 'Rechazado Financiero',
      pendiente_tesoreria: 'Pendiente Tesorería', pendiente_vicepresidente: 'Pendiente VP',
      autorizado: 'Autorizado', en_viaje: 'En Viaje', pendiente_legalizacion: 'Pend. Legalización',
      legalizado: 'Legalizado', pendiente_reintegro: 'Pend. Reintegro', reintegrado: 'Reintegrado',
      pendiente_excedente: 'Pend. Excedente', aprobado_excedente: 'Excedente Aprobado',
      rechazado_excedente: 'Excedente Rechazado', cerrado: 'Cerrado'
    };
    return map[estado] ?? estado;
  }

  getAccionIcon(accion: string): string {
    const map: Record<string, string> = { aprobado: 'pi pi-check-circle', rechazado: 'pi pi-times-circle', observacion: 'pi pi-comment' };
    return map[accion] ?? 'pi pi-circle';
  }

  getAccionColor(accion: string): string {
    const map: Record<string, string> = { aprobado: '#10b981', rechazado: '#ef4444', observacion: '#f59e0b' };
    return map[accion] ?? '#6b7280';
  }

  getTipoDocLabel(tipo: string): string {
    return TIPOS_DOCUMENTO.find(t => t.value === tipo)?.label ?? tipo;
  }

  private toast(severity: string, detail: string): void {
    this.messageService.add({
      severity,
      summary: severity === 'error' ? 'Error' : severity === 'warn' ? 'Advertencia' : 'Éxito',
      detail, life: 3500
    });
  }
}
