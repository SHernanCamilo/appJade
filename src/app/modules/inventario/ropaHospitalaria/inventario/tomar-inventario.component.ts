import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { DropdownModule } from 'primeng/dropdown';
import {
  InventarioRopa,
  LineaInventario,
  RopaEmpresa,
  RopaInventarioService,
  RopaPrendaOpcion,
  RopaUnidadOpcion
} from '../services/ropa-inventario.service';

interface Opcion {
  id: number;
  nombre: string;
}

@Component({
  selector: 'app-tomar-inventario',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ToastModule, ConfirmDialogModule, DropdownModule],
  providers: [MessageService, ConfirmationService],
  templateUrl: './tomar-inventario.component.html',
  styleUrls: ['./tomar-inventario.component.css', '../shared/ropa-page-header.css']
})
export class TomarInventarioComponent implements OnInit {
  private readonly service = inject(RopaInventarioService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly messages = inject(MessageService);
  private readonly confirmar = inject(ConfirmationService);

  documento: InventarioRopa | null = null;
  prendas: RopaPrendaOpcion[] = [];
  unidades: RopaUnidadOpcion[] = [];
  empresas: RopaEmpresa[] = [];
  debeElegirEmpresa = true;
  lineas: LineaInventario[] = [];

  empresaId: number | null = null;
  sucursalId: number | null = null;
  sedeId: number | null = null;
  unidadId: number | null = null;
  periodo = '';
  comentario = '';

  prendaId: number | null = null;
  camaExtra: 'no' | 'si' = 'no';
  readonly camaExtraOpciones = [
    { valor: 'no', etiqueta: 'No' },
    { valor: 'si', etiqueta: 'Sí' }
  ];
  camaExtraNumero = 1;
  cantidad: number | null = null;
  camas: number | null = null;
  constante: string | null = null;
  tieneCupo = false;
  yaCerrado = false;

  cargando = true;
  guardando = false;
  error = '';
  private apoyoToken = 0;

  ngOnInit(): void {
    this.service.prendas().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: resp => { this.prendas = (resp.data ?? []).filter(prenda => prenda.estado === 1); },
      error: () => this.aviso('No se pudieron cargar las prendas.')
    });
    this.service.empresas().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: resp => {
        this.empresas = resp.data ?? [];
        this.debeElegirEmpresa = resp.debe_elegir;
        this.sincronizarEmpresa();
      },
      error: () => this.aviso('No se pudieron cargar las empresas.')
    });
    this.service.unidades().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: resp => {
        this.unidades = resp.data ?? [];
        this.sincronizarEmpresa();
      },
      error: () => this.aviso('No se pudieron cargar las unidades.')
    });

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const id = params.get('id');
      if (!id) {
        this.abrirNueva();
        return;
      }
      this.cargar(Number(id));
    });
  }

  get soloLectura(): boolean {
    return this.documento?.estado === 1;
  }

  get subtitulo(): string {
    if (!this.documento) {
      return 'Abriendo la toma.';
    }
    if (this.soloLectura) {
      return `Toma ${this.documento.consecutivo_toma || '—'} · ${this.documento.usuario || '—'} · ${this.documento.fecha_registro || '—'}`;
    }
    return `Toma ${this.documento.consecutivo}. Al guardar recibe otro número y queda cerrado.`;
  }

  get sucursales(): Opcion[] {
    const mapa = new Map<number, string>();
    for (const unidad of this.unidades) {
      if (this.empresaId !== null && Number(unidad.empresa_id) !== Number(this.empresaId)) continue;
      if (unidad.sucursal_id && unidad.sucursal_nombre) {
        mapa.set(unidad.sucursal_id, unidad.sucursal_nombre);
      }
    }
    return [...mapa.entries()].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  get sedes(): Opcion[] {
    const mapa = new Map<number, string>();
    for (const unidad of this.unidades) {
      if (this.sucursalId && unidad.sucursal_id !== this.sucursalId) continue;
      if (unidad.sede_id && unidad.sede_nombre) mapa.set(unidad.sede_id, unidad.sede_nombre);
    }
    return [...mapa.entries()].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  get unidadesSede(): RopaUnidadOpcion[] {
    return this.unidades
      .filter(unidad => {
        if (!unidad.tiene_cupo) return false;
        if (this.sucursalId && unidad.sucursal_id !== this.sucursalId) return false;
        if (this.sedes.length === 0) return true;
        return unidad.sede_id === this.sedeId;
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  get unidadesDropdown(): Array<{ id: number; etiqueta: string }> {
    return this.unidadesSede.map(unidad => ({
      id: unidad.id,
      etiqueta: `${unidad.codigo} — ${unidad.nombre}`
    }));
  }

  get prendasDropdown(): Array<{ id: number; etiqueta: string }> {
    return this.prendas.map(prenda => ({
      id: prenda.id,
      etiqueta: `${prenda.codigo ? prenda.codigo + ' — ' : ''}${prenda.nombre}`
    }));
  }

  get puedeAgregar(): boolean {
    return !this.soloLectura
      && !this.guardando
      && this.unidadId !== null
      && this.prendaId !== null
      && this.constante !== null
      && this.tieneCupo
      && this.cantidad !== null
      && this.cantidad >= 0
      && (this.camaExtra === 'no' || this.camaExtraNumero >= 1);
  }

  get puedeGuardar(): boolean {
    return !this.soloLectura
      && !this.guardando
      && !this.yaCerrado
      && this.empresaId !== null
      && this.sucursalId !== null
      && (this.sedes.length === 0 || this.sedeId !== null)
      && this.unidadId !== null
      && this.periodo !== ''
      && this.lineas.length > 0;
  }

  alElegirEmpresa(id: number | null): void {
    this.cambiarUbicacion(() => {
      this.empresaId = id;
      this.sucursalId = null;
      this.sedeId = null;
      this.unidadId = null;
      this.limpiarApoyo();
    });
  }

  alElegirSucursal(id: number | null): void {
    this.cambiarUbicacion(() => {
      this.sucursalId = id;
      this.sedeId = null;
      this.unidadId = null;
      this.limpiarApoyo();
    });
  }

  alElegirSede(id: number | null): void {
    this.cambiarUbicacion(() => {
      this.sedeId = id;
      this.unidadId = null;
      this.limpiarApoyo();
    });
  }

  alElegirUnidad(id: number | null): void {
    this.cambiarUbicacion(() => {
      this.unidadId = id;
      this.prendaId = null;
      this.constante = null;
      this.pedirApoyo();
    });
  }

  alElegirPrenda(id: number | null): void {
    this.prendaId = id;
    this.pedirApoyo();
  }

  alCambiarPeriodo(): void {
    this.pedirApoyo();
  }

  agregar(): void {
    if (!this.puedeAgregar || !this.documento || this.unidadId === null || this.prendaId === null || this.cantidad === null) {
      return;
    }
    this.guardando = true;
    this.service.agregarLinea(this.documento.id, {
      id_unidad: this.unidadId,
      id_prenda: this.prendaId,
      cama_extra: this.camaExtra === 'si' ? Number(this.camaExtraNumero) : 0,
      cantidad: Number(this.cantidad)
    }).subscribe({
      next: resp => {
        this.guardando = false;
        this.aplicarDocumento(resp.data, false);
        this.prendaId = null;
        this.constante = null;
        this.cantidad = null;
        this.camaExtra = 'no';
        this.camaExtraNumero = 1;
      },
      error: (err: HttpErrorResponse) => {
        this.guardando = false;
        this.aviso(this.detalle(err, 'No se pudo agregar la prenda.'));
      }
    });
  }

  quitar(linea: LineaInventario): void {
    if (!this.documento || this.soloLectura) return;
    this.service.quitarLinea(this.documento.id, linea.id).subscribe({
      next: resp => this.aplicarDocumento(resp.data, false),
      error: (err: HttpErrorResponse) => this.aviso(this.detalle(err, 'No se pudo quitar la prenda.'))
    });
  }

  guardar(): void {
    if (!this.puedeGuardar || !this.documento || this.sucursalId === null || this.unidadId === null) {
      return;
    }
    this.guardando = true;
    this.service.cerrar(this.documento.id, {
      id_sucursal: this.sucursalId,
      id_sede: this.sedeId,
      id_unidad: this.unidadId,
      periodo: this.periodo,
      comentario: this.comentario.trim() || null
    }).subscribe({
      next: resp => {
        this.guardando = false;
        const toma = resp.data.consecutivo_toma ?? this.documento?.consecutivo;
        this.messages.add({
          severity: 'success',
          summary: 'Inventario guardado',
          detail: `La toma ${toma} quedó cerrada con el número ${resp.data.consecutivo}.`,
          life: 6000
        });
        this.router.navigate(['/inventario/ropaHospitalaria/inventario', resp.data.id], { replaceUrl: true });
      },
      error: (err: HttpErrorResponse) => {
        this.guardando = false;
        this.aviso(this.detalle(err, 'No se pudo guardar el inventario.'));
      }
    });
  }

  limpiar(): void {
    if (!this.documento || this.soloLectura) return;
    this.confirmar.confirm({
      message: 'Se abandona esta toma y se abre otra. Lo que no se guardó no entra en los reportes.',
      header: 'Limpiar',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, limpiar',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.service.abrir().subscribe({
          next: resp => this.router.navigate(['/inventario/ropaHospitalaria/inventario', resp.data.id], { replaceUrl: true }),
          error: (err: HttpErrorResponse) => this.aviso(this.detalle(err, 'No se pudo abrir otra toma.'))
        });
      }
    });
  }

  imprimir(): void {
    window.print();
  }

  private abrirNueva(): void {
    this.cargando = true;
    this.service.abrir().subscribe({
      next: resp => {
        this.router.navigate(['/inventario/ropaHospitalaria/inventario', resp.data.id], { replaceUrl: true });
      },
      error: (err: HttpErrorResponse) => {
        this.cargando = false;
        this.error = this.detalle(err, 'No se pudo abrir la toma.');
      }
    });
  }

  private cargar(id: number): void {
    this.cargando = true;
    this.service.ver(id).subscribe({
      next: resp => {
        this.cargando = false;
        this.aplicarDocumento(resp.data, true);
      },
      error: (err: HttpErrorResponse) => {
        this.cargando = false;
        this.error = this.detalle(err, 'No se encontró el inventario.');
      }
    });
  }

  private aplicarDocumento(doc: InventarioRopa, inicial: boolean): void {
    this.documento = doc;
    this.lineas = doc.lineas ?? [];
    if (!inicial) return;
    this.sucursalId = doc.sucursal_id;
    this.sedeId = doc.sede_id;
    this.unidadId = doc.unidad_id;
    this.sincronizarEmpresa();
    this.periodo = doc.periodo ?? this.mesActual();
    this.comentario = doc.comentario ?? '';
    this.prendaId = null;
    this.cantidad = null;
    this.camaExtra = 'no';
    this.camaExtraNumero = 1;
    if (doc.unidad_id && doc.estado !== 1) this.pedirApoyo();
  }

  private sincronizarEmpresa(): void {
    const unidad = this.unidades.find(item => item.id === this.documento?.unidad_id);
    if (unidad?.empresa_id) {
      this.empresaId = unidad.empresa_id;
      return;
    }
    if (!this.debeElegirEmpresa && this.empresas.length === 1 && this.empresaId === null) {
      this.empresaId = this.empresas[0].id;
    }
  }

  private cambiarUbicacion(aplicar: () => void): void {
    if (this.soloLectura) return;
    if (this.lineas.length === 0 || !this.documento) {
      aplicar();
      return;
    }
    this.confirmar.confirm({
      message: 'Cambiar la unidad quita las prendas ya agregadas.',
      header: 'Cambiar unidad',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Quitar prendas',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.service.vaciar(this.documento!.id).subscribe({
          next: resp => {
            this.aplicarDocumento(resp.data, false);
            aplicar();
          },
          error: (err: HttpErrorResponse) => this.aviso(this.detalle(err, 'No se pudieron quitar las prendas.'))
        });
      }
    });
  }

  private pedirApoyo(): void {
    if (!this.unidadId || this.soloLectura) {
      this.limpiarApoyo();
      return;
    }
    const token = ++this.apoyoToken;
    const unidadId = this.unidadId;
    this.service.apoyo(unidadId, this.prendaId, this.periodo || null).subscribe({
      next: resp => {
        if (token !== this.apoyoToken || this.unidadId !== unidadId) return;
        this.camas = resp.data.camas;
        this.tieneCupo = resp.data.tiene_cupo;
        this.constante = this.prendaId ? resp.data.constante : null;
        this.yaCerrado = resp.data.inventario_cerrado;
      },
      error: () => {
        if (token === this.apoyoToken) this.limpiarApoyo();
      }
    });
  }

  private limpiarApoyo(): void {
    this.camas = null;
    this.constante = null;
    this.tieneCupo = false;
    this.yaCerrado = false;
  }

  private mesActual(): string {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  }

  private detalle(err: HttpErrorResponse, fallback: string): string {
    const body = err.error as { message?: string; errors?: Record<string, string[]> } | null;
    if (body?.errors) {
      const texto = Object.values(body.errors).flat().join(' ');
      if (texto) return texto;
    }
    return body?.message || fallback;
  }

  private aviso(detail: string): void {
    this.messages.add({ severity: 'error', summary: 'Inventario', detail, life: 7000 });
  }
}
