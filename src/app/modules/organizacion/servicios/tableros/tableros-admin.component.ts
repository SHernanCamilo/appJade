import { Component, OnInit, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

import { TableroAdminService } from './services/tablero-admin.service';
import { TableroDevice, CreateTableroPayload } from './models/tablero-device.model';

@Component({
  selector: 'app-tableros-admin',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    TableModule, ButtonModule, DialogModule, InputTextModule,
    DropdownModule, TagModule, TooltipModule, InputNumberModule, ToastModule
  ],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tableros-admin.component.html',
  styleUrl: './tableros-admin.component.css'
})
export class TablerosAdminComponent implements OnInit {
  private readonly service = inject(TableroAdminService);
  private readonly msg = inject(MessageService);

  readonly devices = signal<TableroDevice[]>([]);
  readonly loading = signal(false);

  // Diálogo crear
  showCreateDialog = false;
  newName = '';
  newSede = '';
  newSchemaName = 'ug';
  newViewName = 'VW_HC_TableroUrgencias';
  newMaxConnections = 3;
  creating = false;

  // Diálogo código
  showCodeDialog = false;
  currentCode = '';
  currentInstructions = '';

  /**
   * Sedes del desplegable.
   *
   * Se cargan del backend, que las lee de la MISMA vista que alimenta el tablero
   * ([UG].[VW_HC_TableroUrgencias]). Antes estaban escritas a mano aqui y no
   * coincidian con la vista: faltaba TUNJA y sobraban sedes que la vista no
   * devuelve, asi que abrir una sede obligaba a tocar codigo y desplegar.
   *
   * El fallback solo se usa si el servicio de datos no responde.
   */
  readonly sedeOptions = signal<Array<{ label: string; value: string }>>([
    { label: 'Todas las sedes', value: '' },
  ]);

  readonly loadingSedes = signal(false);

  readonly viewOptions = [
    { label: 'Tablero Urgencias', value: 'VW_HC_TableroUrgencias' },
  ];

  ngOnInit(): void {
    this.loadDevices();
    this.loadSedes();
  }

  /** Trae las sedes reales de la vista para el desplegable */
  loadSedes(): void {
    this.loadingSedes.set(true);

    this.service.sedes().subscribe({
      next: (res) => {
        const sedes = res.data ?? [];
        this.sedeOptions.set([
          { label: 'Todas las sedes', value: '' },
          ...sedes.map(s => ({ label: s, value: s })),
        ]);
        this.loadingSedes.set(false);

        if (sedes.length === 0) {
          this.msg.add({
            severity: 'warn',
            summary: 'Sin sedes',
            detail: 'No se pudieron leer las sedes de la vista. Puede dejar "Todas las sedes".',
          });
        }
      },
      error: () => {
        // Sin sedes del backend queda al menos "Todas las sedes": el tablero
        // funciona igual, solo sin filtrar.
        this.loadingSedes.set(false);
        this.msg.add({
          severity: 'warn',
          summary: 'Sedes no disponibles',
          detail: 'No se pudo consultar la lista de sedes. Intente recargar.',
        });
      },
    });
  }

  loadDevices(): void {
    this.loading.set(true);
    this.service.list().subscribe({
      next: (res) => {
        this.devices.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los dispositivos.' });
        this.loading.set(false);
      }
    });
  }

  // ── Crear ──────────────────────────────────────────────────────────────────

  openCreate(): void {
    this.newName = '';
    this.newSede = '';
    this.newSchemaName = 'ug';
    this.newViewName = 'VW_HC_TableroUrgencias';
    this.newMaxConnections = 3;
    this.showCreateDialog = true;
  }

  submitCreate(): void {
    if (!this.newName.trim()) {
      this.msg.add({ severity: 'warn', summary: 'Requerido', detail: 'Ingrese un nombre para el tablero.' });
      return;
    }

    this.creating = true;
    const payload: CreateTableroPayload = {
      name: this.newName.trim(),
      schema_name: this.newSchemaName,
      view_name: this.newViewName,
      sede_filter: this.newSede || undefined,
      max_connections: this.newMaxConnections,
    };

    this.service.create(payload).subscribe({
      next: (res) => {
        this.creating = false;
        this.showCreateDialog = false;
        this.loadDevices();

        // Mostrar el código
        this.currentCode = res.data.pairing_code;
        this.currentInstructions = res.data.instructions;
        this.showCodeDialog = true;

        this.msg.add({ severity: 'success', summary: 'Creado', detail: `Tablero "${res.data.name}" creado.` });
      },
      error: (err) => {
        this.creating = false;
        this.msg.add({ severity: 'error', summary: 'Error', detail: err?.error?.message ?? 'Error creando tablero.' });
      }
    });
  }

  // ── Regenerar código ───────────────────────────────────────────────────────

  regenerateCode(device: TableroDevice): void {
    this.service.regenerateCode(device.id).subscribe({
      next: (res) => {
        this.currentCode = res.data.pairing_code;
        this.currentInstructions = `En la TV "${device.name}", navegue a jade.medilaser.com.co/tableroUrgencias e ingrese el código: ${res.data.pairing_code}`;
        this.showCodeDialog = true;
        this.loadDevices();
      },
      error: (err) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: err?.error?.message ?? 'No se pudo regenerar.' });
      }
    });
  }

  // ── Revocar / Activar ──────────────────────────────────────────────────────

  toggleActive(device: TableroDevice): void {
    const action = device.active ? this.service.revoke(device.id) : this.service.activate(device.id);

    action.subscribe({
      next: (res) => {
        this.msg.add({ severity: 'success', summary: 'OK', detail: res.message });
        this.loadDevices();
      },
      error: () => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cambiar el estado.' });
      }
    });
  }

  // ── Eliminar ───────────────────────────────────────────────────────────────

  deleteDevice(device: TableroDevice): void {
    if (!confirm(`¿Eliminar permanentemente "${device.name}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    this.service.delete(device.id).subscribe({
      next: () => {
        this.msg.add({ severity: 'success', summary: 'Eliminado', detail: `"${device.name}" eliminado.` });
        this.loadDevices();
      },
      error: () => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar.' });
      }
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  getStatusSeverity(device: TableroDevice): 'success' | 'warn' | 'danger' | 'info' {
    if (!device.active) return 'danger';
    if (!device.paired) return 'warn';
    if (device.last_seen_at) {
      const lastSeen = new Date(device.last_seen_at).getTime();
      const fiveMinAgo = Date.now() - 5 * 60 * 1000;
      if (lastSeen >= fiveMinAgo) return 'success';
    }
    return 'info';
  }

  getStatusLabel(device: TableroDevice): string {
    if (!device.active) return 'Revocado';
    if (!device.paired) return 'Esperando código';
    if (device.last_seen_at) {
      const lastSeen = new Date(device.last_seen_at).getTime();
      const fiveMinAgo = Date.now() - 5 * 60 * 1000;
      if (lastSeen >= fiveMinAgo) return 'Conectado';
    }
    return 'Emparejado';
  }

  timeSince(dateStr: string | null): string {
    if (!dateStr) return 'Nunca';
    const diff = Date.now() - new Date(dateStr).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'Ahora';
    if (min < 60) return `${min} min`;
    const hours = Math.floor(min / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  }
}
