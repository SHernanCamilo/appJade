import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MessageService, ConfirmationService } from 'primeng/api';
import { Subscription } from 'rxjs';

// PrimeNG
import { ButtonModule }        from 'primeng/button';
import { TableModule }         from 'primeng/table';
import { DialogModule }        from 'primeng/dialog';
import { InputTextModule }     from 'primeng/inputtext';
import { InputNumberModule }   from 'primeng/inputnumber';
import { DropdownModule }      from 'primeng/dropdown';
import { SelectModule }        from 'primeng/select';
import { TagModule }           from 'primeng/tag';
import { ToastModule }         from 'primeng/toast';
import { TooltipModule }       from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { SkeletonModule }      from 'primeng/skeleton';
import { TextareaModule }      from 'primeng/textarea';
import { ToggleSwitchModule }  from 'primeng/toggleswitch';
import { DividerModule }       from 'primeng/divider';

import {
  SecuenciaNumericaService,
  SecPatron,
  SecSecuencia,
  SecDetalle
} from './services/secuencia-numerica.service';
import { AuthService }     from '../../../auth/auth.service';
import { ContextoService } from '../../../../core/services/contexto.service';
import { ModuloService, Modulo } from '../../empresa/services/modulo.service';
import { SucursalService, Sucursal } from '../../empresa/services/sucursal.service';
import { SedeService, Sede } from '../../empresa/services/sede.service';
import { EmpresaService, Empresa } from '../../empresa/services/empresa.service';

@Component({
  selector: 'app-secuencia-numerica',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    ButtonModule, TableModule, DialogModule,
    InputTextModule, InputNumberModule, DropdownModule, SelectModule,
    TagModule, ToastModule, TooltipModule,
    ConfirmDialogModule, SkeletonModule,
    TextareaModule, ToggleSwitchModule, DividerModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './secuenciaNumerica.component.html',
  styleUrl:    './secuenciaNumerica.component.css'
})
export class SecuenciaNumericaComponent implements OnInit, OnDestroy {

  private subs = new Subscription();

  // ── Empresa ────────────────────────────────────────────────────────────────
  empresaId: number | null = null;
  empresaNombre = '';
  empresas: Empresa[] = [];
  empresasOptions: { label: string; value: number }[] = [];
  isLoadingEmpresas = false;

  // ── Módulos (árbol aplanado) ───────────────────────────────────────────────
  modulosFlat: { id: number; nombre: string; nombreOriginal: string; codigo: string; nivel: number }[] = [];
  isLoadingModulos = false;

  // ── Selector de módulo (panel izquierdo) ───────────────────────────────────
  moduloSeleccionadoId: number | null = null;

  // ── Sucursales y sedes de la empresa ──────────────────────────────────────
  sucursales: Sucursal[] = [];
  sedes: Sede[] = [];
  sucursalesOptions: { label: string; value: number }[] = [];
  sedesOptions: { label: string; value: number }[] = [];

  // ── Secuencia activa para el módulo seleccionado ───────────────────────────
  secuenciaActiva: SecSecuencia | null = null;
  isLoadingSecuencia = false;
  isSavingSecuencia  = false;

  // Formulario inline del panel izquierdo
  secForm = {
    es_manual:     false,
    ambito:        'empresa' as 'empresa' | 'sucursal' | 'sede',
    es_secuencial: true,
    rango:         4,
    estado:        true
  };

  // ── Detalles (panel derecho) ───────────────────────────────────────────────
  detalles: SecDetalle[]           = [];
  isLoadingDetalles                = false;
  detalleForm: Partial<SecDetalle> = {};
  isSavingDetalle                  = false;
  showDialogDetalle                = false;
  detalleEditando: SecDetalle | null = null;

  // Sedes filtradas según la sucursal seleccionada en el detalle
  sedesDetalleOptions: { label: string; value: number }[] = [];

  // ── Patrones ───────────────────────────────────────────────────────────────
  patrones: SecPatron[] = [];
  patronesOptions: { label: string; value: number }[] = [];

  // Modal gestión de patrones (tabla + crear)
  showModalPatrones     = false;
  empresaPatronesId: number | null = null;  // empresa seleccionada dentro del modal
  isLoadingPatronesModal = false;
  patronesModal: SecPatron[] = [];          // patrones mostrados en la tabla del modal

  // Formulario inline de nuevo patrón dentro del modal
  showFormNuevoPatron   = false;
  isSavingPatron        = false;
  patronForm: Partial<SecPatron> = {};
  previsualizacionPatron = '';

  // ── Opciones ───────────────────────────────────────────────────────────────
  ambitoOptions = [
    { label: 'Empresa',          value: 'empresa'  },
    { label: 'Sucursal',         value: 'sucursal' },
    { label: 'Sede',             value: 'sede'     }
  ];

  esManualOptions = [
    { label: 'No (automático)', value: false },
    { label: 'Sí (manual)',     value: true  }
  ];

  esSecuencialOptions = [
    { label: 'Sí', value: true  },
    { label: 'No', value: false }
  ];

  constructor(
    private service:             SecuenciaNumericaService,
    private authService:         AuthService,
    private contextoService:     ContextoService,
    private moduloService:       ModuloService,
    private sucursalService:     SucursalService,
    private sedeService:         SedeService,
    private empresaService:      EmpresaService,
    private messageService:      MessageService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit(): void {
    // Suscribirse al contexto reactivo para capturar cuando se cargue
    this.subs.add(
      this.contextoService.contexto$.subscribe(ctx => {
        if (ctx?.empresa_id && !this.empresaId) {
          this.empresaId     = ctx.empresa_id;
          this.empresaNombre = ctx.empresa?.nombre ?? '';
          this.loadPatrones();
          this.loadSucursalesYSedes();
        }
      })
    );

    // Intento sincrónico primero
    const ctx = this.contextoService.getContextoActual();
    if (ctx?.empresa_id) {
      this.empresaId     = ctx.empresa_id;
      this.empresaNombre = ctx.empresa?.nombre ?? '';
    } else {
      // Fallback 1: primera empresa del usuario desde el subject
      const user = this.authService.currentUser;
      if (user?.empresas?.length) {
        const emp = user.empresas[0];
        this.empresaId     = emp.id ?? null;
        this.empresaNombre = emp.nombre ?? '';
      }
    }

    // Fallback 2: leer directamente de localStorage si aún no tenemos empresa
    if (!this.empresaId) {
      try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          if (user?.empresas?.length) {
            this.empresaId     = user.empresas[0].id;
            this.empresaNombre = user.empresas[0].nombre ?? '';
          }
        }
      } catch { /* ignorar */ }
    }

    this.loadModulos();
    this.loadEmpresas();
    if (this.empresaId) {
      this.loadPatrones();
      this.loadSucursalesYSedes();
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  // ── Sucursales y Sedes ─────────────────────────────────────────────────────

  loadEmpresas(): void {
    this.isLoadingEmpresas = true;
    this.empresaService.getEmpresas().subscribe({
      next: (list: Empresa[]) => {
        this.empresas = list.filter(e => e.estado === 1);
        this.empresasOptions = this.empresas.map(e => ({ label: e.nombre, value: e.id }));
        // Pre-seleccionar la empresa del contexto si existe
        if (this.empresaId && this.empresas.find(e => e.id === this.empresaId)) {
          this.onEmpresaChange();
        }
        this.isLoadingEmpresas = false;
      },
      error: () => { this.isLoadingEmpresas = false; }
    });
  }

  onEmpresaChange(): void {
    // Resetear módulo y secuencia al cambiar empresa
    this.moduloSeleccionadoId = null;
    this.secuenciaActiva      = null;
    this.detalles             = [];
    this.secForm = { es_manual: false, ambito: 'empresa', es_secuencial: true, rango: 4, estado: true };

    if (!this.empresaId) return;

    const emp = this.empresas.find(e => e.id === this.empresaId);
    this.empresaNombre = emp?.nombre ?? '';

    this.loadPatrones();
    this.loadSucursalesYSedes();
  }

  loadSucursalesYSedes(): void {
    if (!this.empresaId) return;

    this.sucursalService.getSucursalesPorEmpresa(this.empresaId).subscribe({
      next: (list: Sucursal[]) => {
        this.sucursales = list;
        this.sucursalesOptions = list.map(s => ({ label: s.nombre, value: s.id }));
      }
    });

    this.sedeService.getSedesPorEmpresa(this.empresaId).subscribe({
      next: (list: Sede[]) => {
        this.sedes = list;
        this.sedesOptions = list.map(s => ({
          label: `${s.nombre}${s.sucursal ? ' — ' + s.sucursal.nombre : ''}`,
          value: s.id
        }));
      }
    });
  }

  // ── Módulos ────────────────────────────────────────────────────────────────

  loadModulos(): void {
    this.isLoadingModulos = true;
    this.moduloService.getModulos(false, true).subscribe({
      next: (res: any) => {
        const data = res?.data ?? res ?? [];
        this.modulosFlat = this.aplanarModulos(Array.isArray(data) ? data : []);
        this.isLoadingModulos = false;
      },
      error: () => { this.isLoadingModulos = false; }
    });
  }

  private aplanarModulos(modulos: Modulo[], nivel = 0): any[] {
    let r: any[] = [];
    modulos.forEach(m => {
      const icono  = nivel === 0 ? '📁' : nivel === 1 ? '📂' : '📄';
      const indent = '　'.repeat(nivel);
      r.push({ id: m.id, nombre: `${indent}${icono} ${m.nombre}`, nombreOriginal: m.nombre, codigo: m.codigo, nivel });
      if (m.hijos?.length) r = r.concat(this.aplanarModulos(m.hijos, nivel + 1));
    });
    return r;
  }

  getModuloNombre(id: number | undefined): string {
    if (!id) return '—';
    return this.modulosFlat.find(x => x.id === id)?.nombreOriginal ?? `ID: ${id}`;
  }

  // ── Al cambiar módulo → cargar secuencia y detalles ────────────────────────

  onModuloChange(): void {
    this.secuenciaActiva = null;
    this.detalles        = [];
    if (!this.moduloSeleccionadoId) return;
    this.cargarSecuenciaDelModulo();
  }

  private cargarSecuenciaDelModulo(): void {
    if (!this.empresaId || !this.moduloSeleccionadoId) return;
    this.isLoadingSecuencia = true;

    this.service.getSecuencias({
      empresa_id: this.empresaId,
      modulo_id:  this.moduloSeleccionadoId
    }).subscribe({
      next: res => {
        const lista = res.data ?? [];
        // Buscar la que coincide con el proceso seleccionado (o null si no hay proceso)
        const match = lista.find(s =>
          s.modulo_id === this.moduloSeleccionadoId &&
          (s.proceso_id ?? null)
        ) ?? lista[0] ?? null;

        this.secuenciaActiva = match;

        if (match) {
          this.secForm = {
            es_manual:     match.es_manual,
            ambito:        match.ambito,
            es_secuencial: match.es_secuencial,
            rango:         match.rango,
            estado:        match.estado
          };
          this.cargarDetalles(match.id);
        } else {
          // No existe → formulario en blanco listo para crear
          this.secForm = { es_manual: false, ambito: 'empresa', es_secuencial: true, rango: 4, estado: true };
          this.detalles = [];
        }
        this.isLoadingSecuencia = false;
      },
      error: () => { this.isLoadingSecuencia = false; }
    });
  }

  private cargarDetalles(secuenciaId: number): void {
    this.isLoadingDetalles = true;
    this.service.getDetalles(secuenciaId).subscribe({
      next: res => { this.detalles = res.data ?? []; this.isLoadingDetalles = false; },
      error: () => { this.isLoadingDetalles = false; }
    });
  }

  // ── Guardar / actualizar secuencia ─────────────────────────────────────────

  guardarSecuencia(): void {
    if (!this.empresaId) {
      this.toast('warn', 'Sin empresa', 'No se detectó empresa activa. Verifica el contexto.');
      return;
    }
    if (!this.moduloSeleccionadoId) {
      this.toast('warn', 'Validación', 'Selecciona un módulo');
      return;
    }
    this.isSavingSecuencia = true;

    const payload: Partial<SecSecuencia> = {
      empresa_id:    this.empresaId,
      modulo_id:     this.moduloSeleccionadoId,
      ...this.secForm
    };

    const obs = this.secuenciaActiva
      ? this.service.updateSecuencia(this.secuenciaActiva.id, payload)
      : this.service.createSecuencia(payload);

    obs.subscribe({
      next: res => {
        if (res.success) {
          this.toast('success', 'Éxito', this.secuenciaActiva ? 'Secuencia actualizada' : 'Secuencia creada');
          this.cargarSecuenciaDelModulo();
        } else { this.toast('error', 'Error', res.message ?? 'No se pudo guardar'); }
        this.isSavingSecuencia = false;
      },
      error: err => { this.toast('error', 'Error', err?.error?.message ?? 'Error al guardar'); this.isSavingSecuencia = false; }
    });
  }

  confirmarEliminarSecuencia(): void {
    if (!this.secuenciaActiva) return;
    this.confirmationService.confirm({
      message: '¿Eliminar la secuencia de este módulo y todos sus detalles?',
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar', rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.service.deleteSecuencia(this.secuenciaActiva!.id).subscribe({
        next: res => {
          if (res.success) {
            this.toast('success', 'Eliminado', 'Secuencia eliminada');
            this.secuenciaActiva = null;
            this.detalles = [];
            this.secForm = { es_manual: false, ambito: 'empresa', es_secuencial: true, rango: 4, estado: true };
          }
        },
        error: err => this.toast('error', 'Error', err?.error?.message ?? 'Error al eliminar')
      })
    });
  }

  // ── Detalles ───────────────────────────────────────────────────────────────

  abrirNuevoDetalle(): void {
    this.detalleEditando      = null;
    this.detalleForm          = { siguiente_numero: 1, estado: true };
    this.sedesDetalleOptions  = [];
    this.showDialogDetalle    = true;
  }

  abrirEditarDetalle(d: SecDetalle): void {
    this.detalleEditando = d;
    this.detalleForm     = { patron_id: d.patron_id, sucursal_id: d.sucursal_id, sede_id: d.sede_id, siguiente_numero: d.siguiente_numero, estado: d.estado };
    // Cargar sedes de la sucursal si aplica
    this.sedesDetalleOptions = [];
    if (d.sucursal_id) {
      this.onSucursalDetalleChange(d.sucursal_id);
    }
    this.showDialogDetalle = true;
  }

  onSucursalDetalleChange(sucursalId?: number): void {
    const id = sucursalId ?? this.detalleForm.sucursal_id;
    // Limpiar sede al cambiar sucursal (solo si no viene de edición)
    if (!sucursalId) {
      this.detalleForm.sede_id = undefined;
    }
    if (!id) {
      this.sedesDetalleOptions = [];
      return;
    }
    // Filtrar sedes que pertenecen a esta sucursal
    this.sedesDetalleOptions = this.sedes
      .filter(s => s.id_Sucursal === id)
      .map(s => ({ label: s.nombre, value: s.id }));
  }

  guardarDetalle(): void {
    if (!this.detalleForm.patron_id || !this.secuenciaActiva) {
      this.toast('warn', 'Validación', 'El patrón es obligatorio'); return;
    }
    this.isSavingDetalle = true;

    const obs = this.detalleEditando
      ? this.service.updateDetalle(this.secuenciaActiva.id, this.detalleEditando.id, this.detalleForm)
      : this.service.createDetalle(this.secuenciaActiva.id, this.detalleForm);

    obs.subscribe({
      next: res => {
        if (res.success) {
          this.toast('success', 'Éxito', this.detalleEditando ? 'Detalle actualizado' : 'Detalle agregado');
          this.showDialogDetalle = false;
          this.cargarDetalles(this.secuenciaActiva!.id);
        } else { this.toast('error', 'Error', res.message ?? 'No se pudo guardar'); }
        this.isSavingDetalle = false;
      },
      error: err => { this.toast('error', 'Error', err?.error?.message ?? 'Error al guardar'); this.isSavingDetalle = false; }
    });
  }

  confirmarEliminarDetalle(d: SecDetalle): void {
    this.confirmationService.confirm({
      message: '¿Eliminar este detalle?',
      header: 'Confirmar',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí', rejectLabel: 'No',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.service.deleteDetalle(this.secuenciaActiva!.id, d.id).subscribe({
        next: res => { if (res.success) { this.toast('success', 'Eliminado', 'Detalle eliminado'); this.cargarDetalles(this.secuenciaActiva!.id); } },
        error: () => this.toast('error', 'Error', 'No se pudo eliminar')
      })
    });
  }

  // ── Patrones ───────────────────────────────────────────────────────────────

  loadPatrones(): void {
    if (!this.empresaId) return;
    this.service.getPatrones(this.empresaId).subscribe({
      next: res => {
        this.patrones = res.data ?? [];
        this.patronesOptions = this.patrones
          .filter(p => p.estado)
          .map(p => ({ label: `${p.nombre} — ${p.patron}`, value: p.id }));
      }
    });
  }

  // ── Modal gestión de patrones ──────────────────────────────────────────────

  abrirModalPatrones(): void {
    this.empresaPatronesId  = this.empresaId;
    this.showFormNuevoPatron = false;
    this.patronForm          = {};
    this.previsualizacionPatron = '';
    this.showModalPatrones   = true;
    if (this.empresaPatronesId) {
      this.cargarPatronesModal();
    }
  }

  onEmpresaPatronesChange(): void {
    this.patronesModal = [];
    if (this.empresaPatronesId) {
      this.cargarPatronesModal();
    }
  }

  cargarPatronesModal(): void {
    if (!this.empresaPatronesId) return;
    this.isLoadingPatronesModal = true;
    this.service.getPatrones(this.empresaPatronesId).subscribe({
      next: res => {
        this.patronesModal = res.data ?? [];
        this.isLoadingPatronesModal = false;
        // Refrescar opciones si es la misma empresa activa
        if (this.empresaPatronesId === this.empresaId) {
          this.patronesOptions = this.patronesModal
            .filter(p => p.estado)
            .map(p => ({ label: `${p.nombre} — ${p.patron}`, value: p.id }));
        }
      },
      error: () => { this.isLoadingPatronesModal = false; }
    });
  }

  abrirFormNuevoPatron(): void {
    this.patronForm = {
      empresa_id: this.empresaPatronesId ?? undefined,
      estado: true
    };
    this.previsualizacionPatron = '';
    this.showFormNuevoPatron = true;
  }

  cancelarFormPatron(): void {
    this.showFormNuevoPatron = false;
    this.patronForm = {};
    this.previsualizacionPatron = '';
  }

  guardarPatron(): void {
    if (!this.patronForm.nombre?.trim() || !this.patronForm.patron?.trim()) {
      this.toast('warn', 'Validación', 'Nombre y patrón son obligatorios'); return;
    }
    if (!this.patronForm.empresa_id) {
      this.toast('warn', 'Validación', 'Selecciona una empresa para el patrón'); return;
    }
    this.isSavingPatron = true;
    this.service.createPatron(this.patronForm).subscribe({
      next: res => {
        if (res.success) {
          this.toast('success', 'Éxito', 'Patrón creado');
          this.showFormNuevoPatron = false;
          this.patronForm = {};
          this.previsualizacionPatron = '';
          this.cargarPatronesModal();
        } else { this.toast('error', 'Error', res.message ?? 'No se pudo guardar'); }
        this.isSavingPatron = false;
      },
      error: err => { this.toast('error', 'Error', err?.error?.message ?? 'Error al guardar'); this.isSavingPatron = false; }
    });
  }

  confirmarEliminarPatron(p: SecPatron): void {
    this.confirmationService.confirm({
      message: `¿Eliminar el patrón <strong>${p.nombre}</strong>?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar', rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.service.deletePatron(p.id).subscribe({
        next: res => { if (res.success) { this.toast('success', 'Eliminado', 'Patrón eliminado'); this.cargarPatronesModal(); } },
        error: err => this.toast('error', 'Error', err?.error?.message ?? 'No se puede eliminar: está en uso')
      })
    });
  }

  actualizarPrevisualizacion(): void {
    const patron = this.patronForm.patron ?? '';
    if (!patron) { this.previsualizacionPatron = ''; return; }
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const Y = now.getFullYear().toString();
    let r = patron.replace(/%Y/g, Y).replace(/%y/g, Y.slice(2))
                  .replace(/%M/g, pad(now.getMonth() + 1)).replace(/%D/g, pad(now.getDate()));
    const h = (r.match(/#/g) || []).length;
    this.previsualizacionPatron = r.replace(/#+/, '1'.padStart(h, '0'));
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private toast(severity: 'success' | 'error' | 'warn', summary: string, detail: string): void {
    this.messageService.add({ severity, summary, detail, life: 4000 });
  }

  getTagSeverity(estado: boolean): 'success' | 'danger' { return estado ? 'success' : 'danger'; }

  getSucursalNombre(id: number | null | undefined): string {
    if (!id) return '—';
    return this.sucursales.find(s => s.id === id)?.nombre ?? `ID: ${id}`;
  }

  getSedeNombre(id: number | null | undefined): string {
    if (!id) return '—';
    const sede = this.sedes.find(s => s.id === id);
    if (!sede) return `ID: ${id}`;
    return sede.sucursal ? `${sede.nombre} (${sede.sucursal.nombre})` : sede.nombre;
  }

  getUnidadOperativa(det: SecDetalle): string {
    if (det.sucursal_id) return this.getSucursalNombre(det.sucursal_id);
    if (det.sede_id)     return this.getSedeNombre(det.sede_id);
    return 'General (Empresa)';
  }

  aplicarPatronPreview(patron: string, siguiente: number, rango: number): string {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    let r = patron.replace(/%Y/g, now.getFullYear().toString())
                  .replace(/%y/g, now.getFullYear().toString().slice(2))
                  .replace(/%M/g, pad(now.getMonth() + 1))
                  .replace(/%D/g, pad(now.getDate()));
    const h = Math.max((r.match(/#/g) || []).length, rango);
    return r.replace(/#+/, siguiente.toString().padStart(h, '0'));
  }
}
