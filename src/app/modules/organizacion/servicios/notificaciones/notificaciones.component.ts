import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { TabViewModule } from 'primeng/tabview';
import { DatePickerModule } from 'primeng/datepicker';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';

import {
  NotificacionService, DashboardResponse, EmailNotificacion,
  EmailDetalleResponse, EmailRebotado, EmailFiltros, PaginatedMeta, EmailTrace
} from './services/notificacion.service';

import * as XLSX from 'xlsx';

@Component({
  selector: 'app-notificaciones',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    TableModule, ButtonModule, TagModule, ToastModule, DialogModule,
    DropdownModule, InputTextModule, SkeletonModule, TooltipModule,
    TabViewModule, DatePickerModule, ConfirmDialogModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './notificaciones.component.html',
  styleUrl: './notificaciones.component.css'
})
export class NotificacionesComponent implements OnInit {

  // Tabs
  activeTab = 0;

  // Dashboard
  dashboard: DashboardResponse | null = null;
  isLoadingDashboard = false;

  // Listado emails
  emails: EmailNotificacion[] = [];
  meta: PaginatedMeta = { total: 0, per_page: 20, current_page: 1, last_page: 1 };
  isLoadingEmails = false;

  // Filtros
  filtros: EmailFiltros = { per_page: 20, page: 1 };
  fechaDesde: Date | null = null;
  fechaHasta: Date | null = null;
  busqueda = '';

  // Detalle
  showDetalle = false;
  detalle: EmailDetalleResponse | null = null;
  isLoadingDetalle = false;

  // Rebotados
  rebotados: EmailRebotado[] = [];
  isLoadingRebotados = false;
  isCheckingBounces = false;

  // Opciones filtros
  statusOptions = [
    { label: 'Todos', value: null },
    { label: 'Pendiente', value: 'PENDING' },
    { label: 'Enviado', value: 'SENT' },
    { label: 'Error', value: 'ERROR' },
    { label: 'Expirado', value: 'EXPIRED' }
  ];

  deliveryOptions = [
    { label: 'Todos', value: null },
    { label: 'Pendiente', value: 'PENDING' },
    { label: 'Entregado', value: 'DELIVERED' },
    { label: 'Rebotado', value: 'BOUNCED' },
    { label: 'Fallido', value: 'FAILED' }
  ];

  clinicaOptions: { label: string; value: string | null }[] = [
    { label: 'Todos los centros', value: null }
  ];

  constructor(
    private notificacionService: NotificacionService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.setFechasHoy();
    this.cargarDashboard();
    this.cargarEmails();
  }

  // ── TAB CAMBIO ────────────────────────────────────────────────────────────

  onTabChange(index: number): void {
    this.activeTab = index;
    if (index === 0) this.cargarDashboard();
    if (index === 1) this.cargarEmails();
    if (index === 2) this.cargarRebotados();
  }

  // ── DASHBOARD ─────────────────────────────────────────────────────────────

  cargarDashboard(): void {
    this.isLoadingDashboard = true;
    const desde = this.fechaDesde ? this.formatDate(this.fechaDesde) : undefined;
    const hasta = this.fechaHasta ? this.formatDate(this.fechaHasta) : undefined;

    this.notificacionService.getDashboard(desde, hasta).subscribe({
      next: (data) => { this.dashboard = data; this.isLoadingDashboard = false; },
      error: () => { this.isLoadingDashboard = false; this.toast('error', 'No se pudo cargar el dashboard'); }
    });
  }

  // ── EMAILS ────────────────────────────────────────────────────────────────

  cargarEmails(): void {
    this.isLoadingEmails = true;
    const clinicaFiltro = this.filtros.clinica; // Guardar para filtro local

    // Construir filtros para el backend (sin clinica, no lo soporta)
    const f: EmailFiltros = {
      status: this.filtros.status,
      delivery_status: this.filtros.delivery_status,
      tipo: this.filtros.tipo,
      email_to: this.filtros.email_to,
      identificacion: this.busqueda || undefined,
      fecha_desde: this.fechaDesde ? this.formatDate(this.fechaDesde) : undefined,
      fecha_hasta: this.fechaHasta ? this.formatDate(this.fechaHasta) : undefined,
      per_page: clinicaFiltro ? 100 : this.filtros.per_page,
      page: clinicaFiltro ? 1 : this.filtros.page
    };

    this.notificacionService.getEmails(f).subscribe({
      next: (res) => {
        let data = res.data;

        // Filtrar por clínica en frontend
        if (clinicaFiltro) {
          data = data.filter(e => e.clinica === clinicaFiltro);
        }

        this.emails = data;
        this.meta = {
          ...res.meta,
          total: clinicaFiltro ? data.length : res.meta.total
        };
        this.isLoadingEmails = false;
        this.actualizarClinicasDisponibles(res.data);
      },
      error: () => { this.emails = []; this.isLoadingEmails = false; this.toast('error', 'No se pudieron cargar los emails'); }
    });
  }

  /** Extrae clínicas únicas de los datos para el filtro */
  private actualizarClinicasDisponibles(emails: EmailNotificacion[]): void {
    const clinicas = new Set<string>();
    emails.forEach(e => { if (e.clinica) clinicas.add(e.clinica); });

    // Solo actualizar si hay nuevas clínicas (no perder las que ya tenemos)
    clinicas.forEach(c => {
      if (!this.clinicaOptions.find(o => o.value === c)) {
        this.clinicaOptions.push({ label: c, value: c });
      }
    });
  }

  onPageChange(event: any): void {
    const first = event.first ?? 0;
    const rows = event.rows ?? this.meta.per_page;
    this.filtros.page = Math.floor(first / rows) + 1;
    this.filtros.per_page = rows;
    this.cargarEmails();
  }

  aplicarFiltros(): void {
    this.filtros.page = 1;
    this.cargarEmails();
    this.cargarDashboard();
  }

  limpiarFiltros(): void {
    this.filtros = { per_page: 20, page: 1 };
    this.busqueda = '';
    this.setFechasHoy();
    this.cargarEmails();
    this.cargarDashboard();
  }

  // ── DETALLE ───────────────────────────────────────────────────────────────

  verDetalle(email: EmailNotificacion): void {
    this.showDetalle = true;
    this.isLoadingDetalle = true;
    this.detalle = null;

    this.notificacionService.getEmailDetail(email.id).subscribe({
      next: (data) => { this.detalle = data; this.isLoadingDetalle = false; },
      error: () => { this.isLoadingDetalle = false; this.toast('error', 'No se pudo cargar el detalle'); }
    });
  }

  // ── REBOTADOS ─────────────────────────────────────────────────────────────

  cargarRebotados(): void {
    this.isLoadingRebotados = true;
    this.notificacionService.getRebotados().subscribe({
      next: (data) => { this.rebotados = data; this.isLoadingRebotados = false; },
      error: () => { this.isLoadingRebotados = false; this.toast('error', 'No se pudieron cargar los rebotados'); }
    });
  }

  verificarRebotes(): void {
    this.isCheckingBounces = true;
    this.notificacionService.checkBounces().subscribe({
      next: (res) => {
        this.isCheckingBounces = false;
        this.toast('success', res.message);
        this.cargarRebotados();
        this.cargarDashboard();
      },
      error: () => { this.isCheckingBounces = false; this.toast('error', 'Error al verificar rebotes'); }
    });
  }

  // ── EXPORT EXCEL ──────────────────────────────────────────────────────────

  exportarExcel(): void {
    this.toast('info', 'Generando Excel con todos los registros...');

    const filtrosBase: EmailFiltros = {
      status: this.filtros.status,
      delivery_status: this.filtros.delivery_status,
      tipo: this.filtros.tipo,
      identificacion: this.busqueda || undefined,
      fecha_desde: this.fechaDesde ? this.formatDate(this.fechaDesde) : undefined,
      fecha_hasta: this.fechaHasta ? this.formatDate(this.fechaHasta) : undefined,
      per_page: 100,
      page: 1
    };

    const todosLosEmails: EmailNotificacion[] = [];
    const clinicaFiltro = this.filtros.clinica;

    const cargarPagina = (page: number): void => {
      this.notificacionService.getEmails({ ...filtrosBase, page }).subscribe({
        next: (res) => {
          todosLosEmails.push(...res.data);

          if (page < res.meta.last_page) {
            cargarPagina(page + 1);
          } else {
            // Todas las páginas cargadas — filtrar por clínica si aplica y generar Excel
            let data = todosLosEmails;
            if (clinicaFiltro) {
              data = data.filter(e => e.clinica === clinicaFiltro);
            }

            if (data.length === 0) {
              this.toast('warn', 'No hay datos para exportar');
              return;
            }

            const datos = data.map(e => ({
              'Estado Envío': e.status,
              'Estado Entrega': e.delivery_status,
              'Paciente': e.nombre_paciente,
              'Identificación': e.identificacion_paciente,
              'Profesional': e.profesional_nombre,
              'Email': e.email_to,
              'Clínica': e.clinica,
              'Especialidad': e.especialidad,
              'Tipo': e.tipo,
              'Fecha': e.created_at,
              'Intentos': e.intentos,
              'Error': e.error_message ?? ''
            }));

            const ws = XLSX.utils.json_to_sheet(datos);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Notificaciones');
            XLSX.writeFile(wb, `notificaciones_${this.formatDate(new Date())}.xlsx`);
            this.toast('success', `Excel exportado: ${datos.length} registros`);
          }
        },
        error: () => this.toast('error', 'Error al generar el Excel')
      });
    };

    cargarPagina(1);
  }

  // ── HELPERS ───────────────────────────────────────────────────────────────

  getDeliverySeverity(status: string): 'success' | 'danger' | 'warn' | 'info' | 'secondary' {
    const map: Record<string, 'success' | 'danger' | 'warn' | 'info' | 'secondary'> = {
      DELIVERED: 'success', BOUNCED: 'danger', PENDING: 'warn', FAILED: 'secondary'
    };
    return map[status] ?? 'info';
  }

  getDeliveryLabel(status: string): string {
    const map: Record<string, string> = { DELIVERED: 'Entregado', BOUNCED: 'Rebotado', PENDING: 'Pendiente', FAILED: 'Fallido' };
    return map[status] ?? status;
  }

  getStatusSeverity(status: string): 'success' | 'danger' | 'warn' | 'info' | 'secondary' {
    const map: Record<string, 'success' | 'danger' | 'warn' | 'info' | 'secondary'> = {
      SENT: 'info', PENDING: 'warn', ERROR: 'danger', EXPIRED: 'secondary'
    };
    return map[status] ?? 'info';
  }

  getTraceIcon(eventType: string): string {
    const map: Record<string, string> = {
      PROGRAMADO: 'pi-calendar', ENVIADO: 'pi-send', ENTREGADO: 'pi-check-circle',
      REBOTADO: 'pi-exclamation-triangle', ERROR: 'pi-times-circle'
    };
    return map[eventType] ?? 'pi-circle';
  }

  getTraceColor(eventStatus: string): string {
    const map: Record<string, string> = { SUCCESS: '#27AE60', PENDING: '#F39C12', ERROR: '#E74C3C' };
    return map[eventStatus] ?? '#95A5A6';
  }

  private setFechasHoy(): void {
    const hoy = new Date();
    this.fechaDesde = hoy;
    this.fechaHasta = hoy;
  }

  private formatDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private toast(severity: string, detail: string): void {
    this.messageService.add({ severity, summary: severity === 'error' ? 'Error' : severity === 'warn' ? 'Advertencia' : 'Éxito', detail, life: 4000 });
  }
}
