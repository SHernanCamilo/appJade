import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DropdownModule } from 'primeng/dropdown';
import { HttpErrorResponse } from '@angular/common/http';

import { ToastModule } from 'primeng/toast';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';

import {
  ConstantePayload,
  CupoPayload,
  PrendaPayload,
  ReglaRopa,
  RopaConstante,
  RopaParametrosService,
  RopaPrenda,
  RopaUnidad
} from '../services/ropa-parametros.service';

type Pestana = 'prendas' | 'cupos' | 'constantes';

interface FormPrenda {
  codigo: string;
  nombre: string;
  regla: ReglaRopa | '';
  vigente: boolean;
}

interface FormCupo {
  camas: number | null;
  camas_medico: number | null;
  personal: number | null;
  aplica_estar_medico: boolean;
  aplica_personal: boolean;
}

interface FormConstante {
  id_prenda: number | null;
  id_unidad: number | null;
  constante: number | null;
}

interface OpcionUbicacion {
  id: number;
  nombre: string;
}

const FORM_PRENDA: FormPrenda = { codigo: '', nombre: '', regla: '', vigente: true };
const FORM_CUPO: FormCupo = {
  camas: 0,
  camas_medico: 0,
  personal: 0,
  aplica_estar_medico: false,
  aplica_personal: false
};
const FORM_CONSTANTE: FormConstante = {
  id_prenda: null,
  id_unidad: null,
  constante: null
};

@Component({
  selector: 'app-parametros-ropa',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    DropdownModule,
    ToastModule,
    TableModule,
    TagModule,
    TooltipModule,
    ConfirmDialogModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './parametros-ropa.component.html',
  styleUrls: ['./parametros-ropa.component.css', '../shared/ropa-page-header.css']
})
export class ParametrosRopaComponent implements OnInit {
  private readonly service = inject(RopaParametrosService);
  private readonly messages = inject(MessageService);
  private readonly confirmar = inject(ConfirmationService);

  pestana: Pestana = 'prendas';

  prendas: RopaPrenda[] = [];
  unidades: RopaUnidad[] = [];
  constantes: RopaConstante[] = [];

  cargandoPrendas = false;
  cargandoUnidades = false;
  cargandoConstantes = false;
  guardando = false;

  filtroPrenda = '';
  filtroRegla = '';
  filtroEstadoPrenda = '1';

  filtroUnidad = '';
  filtroSucursal: number | null = null;
  filtroSede: number | null = null;
  cupoNuevo = false;

  filtroConstante = '';

  dialogPrenda = false;
  dialogCupo = false;
  dialogConstante = false;
  modoEdicion = false;
  idEditando: number | null = null;
  unidadEditando: RopaUnidad | null = null;

  formPrenda: FormPrenda = { ...FORM_PRENDA };
  formCupo: FormCupo = { ...FORM_CUPO };
  formConstante: FormConstante = { ...FORM_CONSTANTE };

  readonly estadosPrenda = [
    { valor: '1', etiqueta: 'Vigentes' },
    { valor: '0', etiqueta: 'Inactivas' },
    { valor: 'todas', etiqueta: 'Todas' }
  ];

  readonly reglas: Array<{ valor: ReglaRopa; etiqueta: string; ayuda: string }> = [
    { valor: 'cama', etiqueta: 'Cama', ayuda: 'El fijo es camas de la línea por la constante. La cama extra no entra.' },
    { valor: 'estar_medico', etiqueta: 'Estar médico', ayuda: 'Si la unidad está marcada, el fijo es camas de médico por la constante. Si no, usa camas.' },
    { valor: 'personal', etiqueta: 'Personal', ayuda: 'Si la unidad está marcada, el fijo es personal por la constante. Si no, usa camas.' }
  ];

  ngOnInit(): void {
    this.cargarPrendas();
    this.cargarUnidades();
    this.cargarConstantes();
  }

  get prendasVisibles(): RopaPrenda[] {
    const texto = this.filtroPrenda.trim().toLowerCase();
    return this.prendas.filter(prenda => {
      if (this.filtroEstadoPrenda !== 'todas' && String(prenda.estado) !== this.filtroEstadoPrenda) return false;
      if (this.filtroRegla && prenda.regla !== this.filtroRegla) return false;
      if (!texto) return true;
      return prenda.nombre.toLowerCase().includes(texto) || (prenda.codigo ?? '').toLowerCase().includes(texto);
    });
  }

  get prendasVigentes(): RopaPrenda[] {
    return this.prendas.filter(prenda => prenda.estado === 1);
  }

  get sucursales(): OpcionUbicacion[] {
    const mapa = new Map<number, string>();
    for (const unidad of this.unidades) {
      if (!unidad.tiene_cupo) continue;
      if (unidad.sucursal_id && unidad.sucursal_nombre) mapa.set(unidad.sucursal_id, unidad.sucursal_nombre);
    }
    return [...mapa.entries()]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  get sedes(): OpcionUbicacion[] {
    const mapa = new Map<number, string>();
    for (const unidad of this.unidades) {
      if (!unidad.tiene_cupo) continue;
      if (this.filtroSucursal && unidad.sucursal_id !== this.filtroSucursal) continue;
      if (unidad.sede_id && unidad.sede_nombre) mapa.set(unidad.sede_id, unidad.sede_nombre);
    }
    return [...mapa.entries()]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  get unidadesVisibles(): RopaUnidad[] {
    const texto = this.filtroUnidad.trim().toLowerCase();
    return this.unidades.filter(unidad => {
      if (!unidad.tiene_cupo) return false;
      if (this.filtroSucursal && unidad.sucursal_id !== this.filtroSucursal) return false;
      if (this.filtroSede && unidad.sede_id !== this.filtroSede) return false;
      if (!texto) return true;
      return unidad.nombre.toLowerCase().includes(texto) || (unidad.codigo ?? '').toLowerCase().includes(texto);
    });
  }

  get constantesVisibles(): RopaConstante[] {
    const texto = this.filtroConstante.trim().toLowerCase();
    if (!texto) return this.constantes;
    return this.constantes.filter(fila => {
      const campos = [
        fila.prenda_codigo, fila.prenda_nombre, fila.unidad_codigo,
        fila.unidad_nombre, fila.sede_nombre, fila.sucursal_nombre
      ];
      return campos.some(campo => (campo ?? '').toLowerCase().includes(texto));
    });
  }

  get prendasDropdown(): Array<{ id: number; etiqueta: string }> {
    return this.prendasVigentes.map(prenda => ({
      id: prenda.id,
      etiqueta: `${prenda.codigo ? prenda.codigo + ' — ' : ''}${prenda.nombre}`
    }));
  }

  get unidadesSinCupo(): Array<{ id: number; etiqueta: string }> {
    return this.unidades
      .filter(unidad => !unidad.tiene_cupo)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .map(unidad => ({
        id: unidad.id,
        etiqueta: `${unidad.codigo} — ${unidad.nombre}${unidad.sede_nombre ? ' · ' + unidad.sede_nombre : ''}`
      }));
  }

  get unidadesDropdown(): Array<{ id: number; etiqueta: string }> {
    return [...this.unidades]
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .map(unidad => ({
        id: unidad.id,
        etiqueta: `${unidad.codigo} — ${unidad.nombre}${unidad.sede_nombre ? ' · ' + unidad.sede_nombre : ''}`
      }));
  }

  get formPrendaValido(): boolean {
    return this.formPrenda.nombre.trim().length >= 2 && this.formPrenda.regla !== '';
  }

  get formCupoValido(): boolean {
    return this.enteroValido(this.formCupo.camas)
      && this.enteroValido(this.formCupo.camas_medico)
      && this.enteroValido(this.formCupo.personal);
  }

  get formConstanteValido(): boolean {
    return this.formConstante.id_prenda !== null
      && this.formConstante.id_unidad !== null
      && this.formConstante.constante !== null
      && this.formConstante.constante >= 0;
  }

  ayudaRegla(regla: string): string {
    return this.reglas.find(item => item.valor === regla)?.ayuda ?? '';
  }

  severidadRegla(regla: string | null): 'info' | 'warn' | 'success' | 'secondary' {
    if (regla === 'estar_medico') return 'warn';
    if (regla === 'personal') return 'success';
    if (regla === 'cama') return 'info';
    return 'secondary';
  }

  alCambiarSucursal(): void {
    this.filtroSede = null;
  }

  cargarPrendas(): void {
    this.cargandoPrendas = true;
    this.service.prendas().subscribe({
      next: resp => {
        this.cargandoPrendas = false;
        this.prendas = resp.data ?? [];
      },
      error: (err: HttpErrorResponse) => {
        this.cargandoPrendas = false;
        this.aviso('error', 'Prendas', this.detalleError(err, 'No se pudieron cargar las prendas.'));
      }
    });
  }

  cargarUnidades(): void {
    this.cargandoUnidades = true;
    this.service.unidades().subscribe({
      next: resp => {
        this.cargandoUnidades = false;
        this.unidades = resp.data ?? [];
      },
      error: (err: HttpErrorResponse) => {
        this.cargandoUnidades = false;
        this.aviso('error', 'Unidades', this.detalleError(err, 'No se pudieron cargar las unidades.'));
      }
    });
  }

  cargarConstantes(): void {
    this.cargandoConstantes = true;
    this.service.constantes().subscribe({
      next: resp => {
        this.cargandoConstantes = false;
        this.constantes = resp.data ?? [];
      },
      error: (err: HttpErrorResponse) => {
        this.cargandoConstantes = false;
        this.aviso('error', 'Constantes', this.detalleError(err, 'No se pudieron cargar las constantes.'));
      }
    });
  }

  abrirCrearPrenda(): void {
    this.modoEdicion = false;
    this.idEditando = null;
    this.formPrenda = { ...FORM_PRENDA };
    this.dialogPrenda = true;
  }

  abrirEditarPrenda(prenda: RopaPrenda): void {
    this.modoEdicion = true;
    this.idEditando = prenda.id;
    this.formPrenda = {
      codigo: prenda.codigo ?? '',
      nombre: prenda.nombre,
      regla: prenda.regla,
      vigente: prenda.estado === 1
    };
    this.dialogPrenda = true;
  }

  guardarPrenda(): void {
    if (!this.formPrendaValido || this.guardando || this.formPrenda.regla === '') return;
    this.guardando = true;
    const payload: PrendaPayload = {
      codigo: this.formPrenda.codigo.trim() || null,
      nombre: this.formPrenda.nombre.trim(),
      regla: this.formPrenda.regla,
      estado: this.formPrenda.vigente ? 1 : 0
    };
    const operacion = this.modoEdicion && this.idEditando !== null
      ? this.service.actualizarPrenda(this.idEditando, payload)
      : this.service.crearPrenda(payload);

    operacion.subscribe({
      next: () => {
        this.guardando = false;
        this.aviso('success', 'Prenda', this.modoEdicion ? 'Prenda actualizada.' : 'Prenda creada.');
        this.dialogPrenda = false;
        this.cargarPrendas();
      },
      error: (err: HttpErrorResponse) => {
        this.guardando = false;
        this.aviso('error', 'Prenda', this.detalleError(err, 'No se pudo guardar la prenda.'));
      }
    });
  }

  eliminarPrenda(prenda: RopaPrenda): void {
    this.confirmar.confirm({
      message: `¿Dar de baja la prenda <strong>${prenda.nombre}</strong>? Deja de verse en los conteos nuevos.`,
      header: 'Dar de baja',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, dar de baja',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-sm p-button-danger',
      rejectButtonStyleClass: 'p-button-sm p-button-outlined',
      accept: () => {
        this.service.eliminarPrenda(prenda.id).subscribe({
          next: () => {
            this.aviso('info', 'Prenda', `"${prenda.nombre}" quedó inactiva.`);
            this.cargarPrendas();
          },
          error: (err: HttpErrorResponse) => {
            this.aviso('error', 'Prenda', this.detalleError(err, 'No se pudo dar de baja la prenda.'));
          }
        });
      }
    });
  }

  abrirAgregarUnidad(): void {
    this.cupoNuevo = true;
    this.unidadEditando = null;
    this.formCupo = { ...FORM_CUPO };
    this.dialogCupo = true;
  }

  alElegirUnidadNueva(id: number | null): void {
    this.unidadEditando = this.unidades.find(unidad => unidad.id === id) ?? null;
    this.formCupo = { ...FORM_CUPO };
  }

  abrirCupo(unidad: RopaUnidad): void {
    this.cupoNuevo = false;
    this.unidadEditando = unidad;
    this.formCupo = {
      camas: unidad.camas ?? 0,
      camas_medico: unidad.camas_medico ?? 0,
      personal: unidad.personal ?? 0,
      aplica_estar_medico: unidad.aplica_estar_medico,
      aplica_personal: unidad.aplica_personal
    };
    this.dialogCupo = true;
  }

  guardarCupo(): void {
    if (!this.formCupoValido || this.guardando || !this.unidadEditando) return;
    this.guardando = true;
    const payload: CupoPayload = {
      camas: Number(this.formCupo.camas),
      camas_medico: Number(this.formCupo.camas_medico),
      personal: Number(this.formCupo.personal),
      aplica_estar_medico: this.formCupo.aplica_estar_medico,
      aplica_personal: this.formCupo.aplica_personal
    };
    this.service.guardarCupo(this.unidadEditando.id, payload).subscribe({
      next: resp => {
        this.guardando = false;
        const idx = this.unidades.findIndex(unidad => unidad.id === resp.data.id);
        if (idx >= 0) this.unidades[idx] = resp.data;
        this.aviso('success', 'Cupo', `Cupo de ${resp.data.codigo} guardado.`);
        this.dialogCupo = false;
      },
      error: (err: HttpErrorResponse) => {
        this.guardando = false;
        this.aviso('error', 'Cupo', this.detalleError(err, 'No se pudo guardar el cupo.'));
      }
    });
  }

  abrirCrearConstante(): void {
    this.modoEdicion = false;
    this.idEditando = null;
    this.formConstante = { ...FORM_CONSTANTE };
    this.dialogConstante = true;
  }

  abrirEditarConstante(fila: RopaConstante): void {
    this.modoEdicion = true;
    this.idEditando = fila.id;
    this.formConstante = {
      id_prenda: fila.id_prenda,
      id_unidad: fila.id_unidad,
      constante: Number(fila.constante)
    };
    this.dialogConstante = true;
  }

  guardarConstante(): void {
    if (!this.formConstanteValido || this.guardando || this.formConstante.id_prenda === null || this.formConstante.id_unidad === null || this.formConstante.constante === null) {
      return;
    }
    this.guardando = true;
    const payload: ConstantePayload = {
      id_prenda: this.formConstante.id_prenda,
      id_unidad: this.formConstante.id_unidad,
      constante: Number(this.formConstante.constante)
    };
    const operacion = this.modoEdicion && this.idEditando !== null
      ? this.service.actualizarConstante(this.idEditando, payload)
      : this.service.crearConstante(payload);

    operacion.subscribe({
      next: () => {
        this.guardando = false;
        this.aviso('success', 'Constante', this.modoEdicion ? 'Constante actualizada.' : 'Constante creada.');
        this.dialogConstante = false;
        this.cargarConstantes();
        this.cargarPrendas();
      },
      error: (err: HttpErrorResponse) => {
        this.guardando = false;
        this.aviso('error', 'Constante', this.detalleError(err, 'No se pudo guardar la constante.'));
      }
    });
  }

  eliminarConstante(fila: RopaConstante): void {
    this.confirmar.confirm({
      message: `¿Dar de baja la constante de <strong>${fila.prenda_nombre}</strong> en <strong>${fila.unidad_nombre}</strong>?`,
      header: 'Dar de baja',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, dar de baja',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-sm p-button-danger',
      rejectButtonStyleClass: 'p-button-sm p-button-outlined',
      accept: () => {
        this.service.eliminarConstante(fila.id).subscribe({
          next: () => {
            this.constantes = this.constantes.filter(item => item.id !== fila.id);
            this.aviso('info', 'Constante', 'La constante quedó inactiva.');
            this.cargarPrendas();
          },
          error: (err: HttpErrorResponse) => {
            this.aviso('error', 'Constante', this.detalleError(err, 'No se pudo dar de baja la constante.'));
          }
        });
      }
    });
  }

  cerrarDialogos(): void {
    if (this.guardando) return;
    this.dialogPrenda = false;
    this.dialogCupo = false;
    this.dialogConstante = false;
  }

  private enteroValido(valor: number | null): boolean {
    return valor !== null && Number.isInteger(Number(valor)) && Number(valor) >= 0 && Number(valor) <= 9999;
  }

  private detalleError(err: HttpErrorResponse, fallback: string): string {
    const body = err.error as { message?: string; errors?: Record<string, string[]> } | null;
    if (body?.errors) {
      const texto = Object.values(body.errors).flat().join(' ');
      if (texto) return texto;
    }
    return body?.message || fallback;
  }

  private aviso(severity: 'success' | 'info' | 'error', summary: string, detail: string): void {
    this.messages.add({ severity, summary, detail, life: severity === 'error' ? 7000 : 4000 });
  }
}
