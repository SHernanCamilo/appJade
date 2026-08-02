import { Component, OnInit, ChangeDetectionStrategy, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { CheckboxModule } from 'primeng/checkbox';
import { InventarioService } from '../../../../core/services/inventario.service';

interface RecepcionRow {
  // Datos del producto (solo lectura)
  codigo_producto: string;
  producto_nombre: string;
  marca: string;
  tipo_producto: string;
  forma_farmaceutica: string;
  concentracion: string;
  unidad_empaque: string;
  cantidad_solicitada: number;

  // Campos editables (Vista Excel)
  es_medicamento_vital: boolean;
  codigo_sanitario: string;
  estado_invima: string;
  fabricante: string;
  vida_util: string;
  fecha_vencimiento: string;
  cantidad_recibida: number;
  muestra_poblacion: number | null;
  numero_lote: string;
  aspecto_cumple: string;
  embalaje_cumple: string;
  contenido_cumple: string;
  cadena_frio_temperatura: number | null;
  concepto_recepcion: string;
  observaciones_recepcion: string;

  // Estado interno
  _validatingInvima: boolean;
  _invimaValid: boolean | null;
  _semaforo: 'verde' | 'amarillo' | 'rojo' | '';
  pedido_detalle_id: number | null;
  recibido: boolean;
}

@Component({
  selector: 'app-recepcion-excel',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    TableModule, ButtonModule, InputTextModule, InputNumberModule,
    DropdownModule, CalendarModule, TagModule, TooltipModule,
    SkeletonModule, ToastModule, CheckboxModule
  ],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recepcion-excel.component.html',
  styleUrl: './recepcion-excel.component.css'
})
export class RecepcionExcelComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly inventarioService = inject(InventarioService);
  private readonly msg = inject(MessageService);

  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly rows = signal<RecepcionRow[]>([]);
  readonly ordenInfo = signal<{ numero: string; proveedor: string; compraId: number } | null>(null);
  readonly observacionesGlobal = signal('');

  readonly totalItems = computed(() => this.rows().length);
  readonly totalRecibidos = computed(() => this.rows().filter(r => r.recibido && r.cantidad_recibida > 0).length);

  readonly cumpleOptions = [
    { label: 'Cumple', value: 'Cumple' },
    { label: 'No Cumple', value: 'No Cumple' },
  ];

  readonly conceptoOptions = [
    { label: 'Seleccionar...', value: '' },
    { label: 'Aceptado', value: 'aceptado' },
    { label: 'Cuarentena', value: 'cuarentena' },
    { label: 'Rechazado', value: 'rechazado' },
  ];

  private compraId = 0;

  ngOnInit(): void {
    this.compraId = Number(this.route.snapshot.paramMap.get('compraId') || 0);
    if (!this.compraId) {
      this.router.navigate(['/inventario/recepciones-tecnicas']);
      return;
    }
    this.loadData();
  }

  // ─── Cargar datos ─────────────────────────────────────────────────────────

  private loadData(): void {
    this.isLoading.set(true);
    this.inventarioService.getRecepcion(this.compraId).subscribe({
      next: (res: any) => {
        this.isLoading.set(false);
        if (res.success && res.data) {
          const items: RecepcionRow[] = (Array.isArray(res.data) ? res.data : []).map((item: any) => ({
            codigo_producto: item.codigo_producto || '',
            producto_nombre: item.producto_nombre || '',
            marca: item.marca || '',
            tipo_producto: item.tipo_producto || 'Medicamento',
            forma_farmaceutica: item.forma_farmaceutica || '',
            concentracion: item.concentracion || '',
            unidad_empaque: item.unidad_empaque || '',
            cantidad_solicitada: item.cantidad_solicitada_compra || item.cantidad_solicitada || 0,
            es_medicamento_vital: false,
            codigo_sanitario: '',
            estado_invima: '',
            fabricante: '',
            vida_util: '',
            fecha_vencimiento: '',
            cantidad_recibida: item.cantidad_solicitada_compra || item.cantidad_solicitada || 0,
            muestra_poblacion: null,
            numero_lote: '',
            aspecto_cumple: 'Cumple',
            embalaje_cumple: 'Cumple',
            contenido_cumple: 'Cumple',
            cadena_frio_temperatura: null,
            concepto_recepcion: 'aceptado',
            observaciones_recepcion: '',
            _validatingInvima: false,
            _invimaValid: null,
            _semaforo: '',
            pedido_detalle_id: item.pedido_detalle_id || item.id || null,
            recibido: true,
          }));
          this.rows.set(items);
          this.ordenInfo.set({
            numero: res.orden_numero || `OC-${this.compraId}`,
            proveedor: res.proveedor || '',
            compraId: this.compraId,
          });
        }
      },
      error: () => {
        this.isLoading.set(false);
        this.msg.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la orden.' });
      }
    });
  }

  // ─── Validar INVIMA al salir del campo ────────────────────────────────────

  onCodigoSanitarioBlur(row: RecepcionRow): void {
    const code = row.codigo_sanitario?.trim();
    if (!code || code.length < 5) {
      row.estado_invima = '';
      row._invimaValid = null;
      return;
    }

    row._validatingInvima = true;
    this.inventarioService.validateInvima(code).subscribe({
      next: (res: any) => {
        row._validatingInvima = false;
        if (res.success && res.data) {
          const d = res.data;
          row.estado_invima = d.status === 'active' ? 'Vigente' : d.status === 'expired' ? 'Vencido' : 'No encontrado';
          row._invimaValid = d.valid;
          if (d.laboratory) row.fabricante = d.laboratory;
          if (d.vida_util) row.vida_util = d.vida_util;
        } else {
          row.estado_invima = 'No encontrado';
          row._invimaValid = false;
        }
        this.rows.update(r => [...r]);
      },
      error: () => {
        row._validatingInvima = false;
        row.estado_invima = 'Error';
        row._invimaValid = null;
        this.rows.update(r => [...r]);
      }
    });
  }

  // ─── Semáforo de vencimiento ──────────────────────────────────────────────

  onFechaVencimientoChange(row: RecepcionRow): void {
    if (!row.fecha_vencimiento) {
      row._semaforo = '';
      return;
    }
    const venc = new Date(row.fecha_vencimiento);
    const hoy = new Date();
    const diffMeses = (venc.getFullYear() - hoy.getFullYear()) * 12 + (venc.getMonth() - hoy.getMonth());

    if (diffMeses <= 0) row._semaforo = 'rojo';
    else if (diffMeses <= 6) row._semaforo = 'amarillo';
    else row._semaforo = 'verde';

    this.rows.update(r => [...r]);
  }

  // ─── Guardar recepción ────────────────────────────────────────────────────

  guardar(): void {
    const items = this.rows().filter(r => r.recibido && r.cantidad_recibida > 0);

    if (items.length === 0) {
      this.msg.add({ severity: 'warn', summary: 'Sin datos', detail: 'Marque al menos un producto como recibido.' });
      return;
    }

    // Validación: lote y vencimiento obligatorios
    const incompletos = items.filter(i => !i.numero_lote || !i.fecha_vencimiento || !i.concepto_recepcion);
    if (incompletos.length > 0) {
      this.msg.add({
        severity: 'warn',
        summary: 'Campos faltantes',
        detail: `${incompletos.length} producto(s) sin Lote, Vencimiento o Concepto.`
      });
      return;
    }

    this.isSaving.set(true);

    const payload = {
      compra_id: this.compraId,
      observaciones: this.observacionesGlobal(),
      items: items.map(r => ({
        ...r,
        recibido: 1,
        _validatingInvima: undefined,
        _invimaValid: undefined,
        _semaforo: undefined,
      })),
    };

    this.inventarioService.createRecepcion(payload).subscribe({
      next: (res: any) => {
        this.isSaving.set(false);
        if (res.success) {
          this.msg.add({ severity: 'success', summary: 'Guardado', detail: res.message || 'Recepción guardada.' });
          setTimeout(() => this.router.navigate(['/inventario/recepciones-tecnicas']), 1500);
        } else {
          this.msg.add({ severity: 'error', summary: 'Error', detail: res.message || 'No se pudo guardar.' });
        }
      },
      error: (err: any) => {
        this.isSaving.set(false);
        this.msg.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'Error de conexión.' });
      }
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  getSemaforoClass(row: RecepcionRow): string {
    return row._semaforo ? `semaforo-${row._semaforo}` : '';
  }

  getInvimaIcon(row: RecepcionRow): string {
    if (row._validatingInvima) return 'pi pi-spin pi-spinner';
    if (row._invimaValid === true) return 'pi pi-check-circle';
    if (row._invimaValid === false) return 'pi pi-times-circle';
    return '';
  }

  getInvimaColor(row: RecepcionRow): string {
    if (row._invimaValid === true) return '#22c55e';
    if (row._invimaValid === false) return '#ef4444';
    return '#94a3b8';
  }
}
