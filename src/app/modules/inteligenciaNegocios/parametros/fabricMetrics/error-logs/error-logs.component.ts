import { Component, OnInit, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

import {
  FabricMetricsService,
  ErrorLog,
  ErrorLogSummary,
  ErrorByView
} from '../../../services/fabric-metrics.service';

@Component({
  selector: 'app-error-logs',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TableModule, TagModule, TooltipModule,
    CalendarModule, DropdownModule, ButtonModule, ConfirmDialogModule, ToastModule
  ],
  providers: [ConfirmationService, MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './error-logs.component.html',
  styleUrl: './error-logs.component.css'
})
export class ErrorLogsComponent implements OnInit {
  logs = signal<ErrorLog[]>([]);
  summary = signal<ErrorLogSummary | null>(null);
  errorsByView = signal<ErrorByView[]>([]);
  isLoading = signal(true);

  // Filtros
  filterSchema = '';
  filterView = '';
  filterType = '';
  filterFrom: Date | null = null;
  filterTo: Date | null = null;
  filterUnresolved = true;

  readonly errorTypes = [
    { label: 'Todos', value: '' },
    { label: 'Timeout', value: 'timeout' },
    { label: 'Error Fabric', value: 'fabric_error' },
    { label: 'Permiso', value: 'permission' },
  ];

  constructor(
    private metricsService: FabricMetricsService,
    private confirmService: ConfirmationService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadLogs();
    this.loadByView();
  }

  loadLogs(): void {
    this.isLoading.set(true);
    this.metricsService.getErrorLogs({
      schema: this.filterSchema || undefined,
      view: this.filterView || undefined,
      error_type: this.filterType || undefined,
      from: this.filterFrom ? this.formatDate(this.filterFrom) : undefined,
      to: this.filterTo ? this.formatDate(this.filterTo) : undefined,
      unresolved: this.filterUnresolved || undefined,
      limit: 100,
    }).subscribe({
      next: res => {
        this.logs.set(res.data ?? []);
        this.summary.set(res.summary ?? null);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  loadByView(): void {
    this.metricsService.getErrorsByView(7).subscribe({
      next: data => this.errorsByView.set(data)
    });
  }

  applyFilters(): void {
    this.loadLogs();
  }

  clearFilters(): void {
    this.filterSchema = '';
    this.filterView = '';
    this.filterType = '';
    this.filterFrom = null;
    this.filterTo = null;
    this.filterUnresolved = true;
    this.loadLogs();
  }

  resolveError(log: ErrorLog): void {
    this.metricsService.resolveError(log.id).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Resuelto', detail: 'Error marcado como resuelto.' });
        this.loadLogs();
      },
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo resolver.' })
    });
  }

  resolveView(item: ErrorByView): void {
    this.confirmService.confirm({
      message: `Resolver todos los errores de ${item.schema_name}.${item.view_name} y reactivar la vista?`,
      header: 'Confirmar reactivacion',
      acceptLabel: 'Reactivar',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.metricsService.resolveView(item.schema_name, item.view_name).subscribe({
          next: res => {
            this.messageService.add({ severity: 'success', summary: 'Vista reactivada', detail: res.message });
            this.loadLogs();
            this.loadByView();
          },
          error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo reactivar.' })
        });
      }
    });
  }

  getTypeSeverity(type: string): 'danger' | 'warn' | 'info' {
    if (type === 'timeout') return 'danger';
    if (type === 'fabric_error') return 'warn';
    return 'info';
  }

  private formatDate(d: Date): string {
    return d.toISOString().slice(0, 19).replace('T', ' ');
  }
}
