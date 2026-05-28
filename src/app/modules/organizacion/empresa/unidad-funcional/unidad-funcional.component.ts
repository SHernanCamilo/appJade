import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MessageService } from 'primeng/api';

import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { MultiSelectModule } from 'primeng/multiselect';
import { InputSwitchModule } from 'primeng/inputswitch';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { TabViewModule } from 'primeng/tabview';

import { SucursalService } from '../services/sucursal.service';
import { SedeService } from '../services/sede.service';
import {
  UnidadFuncionalService,
  UnidadFuncional,
  UsuarioAutorizado,
  JefeEncargado
} from '../services/unidad-funcional.service';
import { UsuarioService, Usuario } from '../../usuario/services/usuario.service';
import { ContextoService, Empresa as EmpresaContexto } from '../../../../core/services/contexto.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-unidad-funcional',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    MultiSelectModule,
    InputSwitchModule,
    TableModule,
    ToastModule,
    TooltipModule,
    DialogModule,
    TagModule,
    TabViewModule
  ],
  providers: [MessageService],
  templateUrl: './unidad-funcional.component.html',
  styleUrl: './unidad-funcional.component.css'
})
export class UnidadFuncionalComponent implements OnInit {
  unidadForm!: FormGroup;

  empresasOptions: { label: string; value: number }[] = [];
  sucursalesOptions: { label: string; value: number }[] = [];
  sedesOptions: { label: string; value: number }[] = [];

  usuariosDisponibles: Usuario[] = [];
  usuariosOptions: { label: string; value: number }[] = [];
  usuariosAutorizados: UsuarioAutorizado[] = [];
  selectedUsuarioIds: number[] = [];

  jefesEncargados: JefeEncargado[] = [];
  selectedJefeIds: number[] = [];

  activeAsignacionTab = 0;

  currentUnidadId: number | null = null;
  editMode = false;
  unidadListaParaUsuarios = false;

  esTransversal = false;
  empresaNombre = '';

  isLoadingEmpresas = false;
  isLoadingSucursales = false;
  isLoadingSedes = false;
  isLoadingUsuarios = false;
  isSearching = false;
  isSaving = false;

  showModalUnidades = false;
  unidadesModal: UnidadFuncional[] = [];
  modalSearchTerm = '';
  isLoadingModal = false;

  constructor(
    private fb: FormBuilder,
    private sucursalService: SucursalService,
    private sedeService: SedeService,
    private unidadFuncionalService: UnidadFuncionalService,
    private usuarioService: UsuarioService,
    private contextoService: ContextoService,
    private http: HttpClient,
    private messageService: MessageService
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    this.loadEmpresasDisponibles();
  }

  private initForm(): void {
    this.unidadForm = this.fb.group({
      codigo: [{ value: '', disabled: true }, [Validators.required, Validators.maxLength(20)]],
      id_empresa: [null, Validators.required],
      id_sucursal: [null, Validators.required],
      id_sede: [null],
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      estado: [1, Validators.required]
    });
  }

  get empresaSeleccionada(): boolean {
    return !!this.unidadForm.get('id_empresa')?.value;
  }

  get puedeGestionarUsuarios(): boolean {
    return this.unidadListaParaUsuarios && this.empresaSeleccionada;
  }

  get usuariosOptionsDisponibles(): { label: string; value: number }[] {
    const idsAutorizados = new Set(this.usuariosAutorizados.map(u => u.id_user));
    return this.usuariosOptions.filter(o => !idsAutorizados.has(o.value));
  }

  get jefesOptionsDisponibles(): { label: string; value: number }[] {
    const idsAsignados = new Set(this.jefesEncargados.map(j => j.id_user));
    return this.usuariosOptions.filter(o => !idsAsignados.has(o.value));
  }

  get estadoActivo(): boolean {
    const estado = this.unidadForm.get('estado')?.value;
    return estado === 1 || estado === true;
  }

  onEstadoChange(activo: boolean): void {
    this.unidadForm.patchValue({ estado: activo ? 1 : 0 });
  }

  get unidadesModalFiltradas(): UnidadFuncional[] {
    const term = this.modalSearchTerm.trim().toLowerCase();
    if (!term) return this.unidadesModal;

    return this.unidadesModal.filter(u =>
      u.codigo.toLowerCase().includes(term) ||
      u.nombre.toLowerCase().includes(term) ||
      (u.sucursal?.nombre || '').toLowerCase().includes(term) ||
      (u.sede?.nombre || '').toLowerCase().includes(term)
    );
  }

  loadEmpresasDisponibles(): void {
    this.isLoadingEmpresas = true;

    this.contextoService.obtenerEmpresasDisponibles().subscribe({
      next: (empresas: EmpresaContexto[]) => {
        if (empresas.length === 0) {
          this.esTransversal = true;
          this.http.get<{ success: boolean; data: { nombre: string; id: number }[] }>(
            `${environment.URL_SERVICIOS}/empresas-activas`
          ).subscribe({
            next: (response) => {
              this.empresasOptions = (response.data || []).map(e => ({
                label: e.nombre,
                value: e.id
              }));
              this.isLoadingEmpresas = false;
            },
            error: () => {
              this.isLoadingEmpresas = false;
              this.showError('Error al cargar las empresas');
            }
          });
        } else if (empresas.length === 1) {
          this.esTransversal = false;
          this.empresaNombre = empresas[0].nombre;
          this.establecerEmpresa(empresas[0].id);
          this.isLoadingEmpresas = false;
        } else {
          this.esTransversal = true;
          this.empresasOptions = empresas.map(e => ({
            label: e.nombre,
            value: e.id
          }));
          this.isLoadingEmpresas = false;
        }
      },
      error: () => {
        this.isLoadingEmpresas = false;
        this.showError('Error al cargar las empresas disponibles');
      }
    });
  }

  private establecerEmpresa(empresaId: number): void {
    this.unidadForm.patchValue({ id_empresa: empresaId });
    this.onEmpresaChange();
  }

  private actualizarEstadoCodigo(): void {
    const codigoControl = this.unidadForm.get('codigo');
    if (!codigoControl) return;

    if (this.empresaSeleccionada) {
      codigoControl.enable({ emitEvent: false });
    } else {
      codigoControl.disable({ emitEvent: false });
    }
  }

  private limpiarContextoUsuarios(): void {
    this.unidadListaParaUsuarios = false;
    this.usuariosAutorizados = [];
    this.jefesEncargados = [];
    this.limpiarUsuariosDisponibles();
    this.selectedJefeIds = [];
  }

  private habilitarGestionUsuarios(empresaId: number): void {
    this.unidadListaParaUsuarios = true;
    this.loadUsuariosPorEmpresa(empresaId);
  }

  private limpiarUsuariosDisponibles(): void {
    this.usuariosDisponibles = [];
    this.usuariosOptions = [];
    this.selectedUsuarioIds = [];
  }

  private mapearUsuariosOptions(usuarios: Usuario[]): void {
    this.usuariosDisponibles = usuarios.filter(u => u.estado === true || u.estado === 1);
    this.usuariosOptions = this.usuariosDisponibles.map(u => ({
      label: `${u.name} (${u.email})`,
      value: u.id
    }));
  }

  loadUsuariosPorEmpresa(empresaId: number): void {
    this.isLoadingUsuarios = true;
    this.limpiarUsuariosDisponibles();

    this.usuarioService.getUsuariosPorEmpresa(empresaId).subscribe({
      next: (usuarios) => {
        this.mapearUsuariosOptions(usuarios);
        this.isLoadingUsuarios = false;
      },
      error: () => {
        this.limpiarUsuariosDisponibles();
        this.isLoadingUsuarios = false;
        this.showError('Error al cargar los usuarios de la empresa');
      }
    });
  }

  onEmpresaChange(): void {
    const empresaId = this.unidadForm.get('id_empresa')?.value;

    if (this.esTransversal && empresaId) {
      const empresa = this.empresasOptions.find(e => e.value === empresaId);
      this.empresaNombre = empresa?.label ?? '';
    }

    this.editMode = false;
    this.currentUnidadId = null;
    this.limpiarContextoUsuarios();

    this.unidadForm.patchValue({
      codigo: '',
      id_sucursal: null,
      id_sede: null,
      nombre: '',
      estado: 1
    });
    this.sucursalesOptions = [];
    this.sedesOptions = [];
    this.actualizarEstadoCodigo();

    if (!empresaId) {
      return;
    }

    this.isLoadingSucursales = true;
    this.sucursalService.getSucursalesPorEmpresa(empresaId).subscribe({
      next: (sucursales) => {
        this.sucursalesOptions = sucursales.map(s => ({
          label: s.nombre,
          value: s.id
        }));
        this.isLoadingSucursales = false;
      },
      error: () => {
        this.isLoadingSucursales = false;
        this.showError('Error al cargar las sucursales');
      }
    });
  }

  onSucursalChange(): void {
    const sucursalId = this.unidadForm.get('id_sucursal')?.value;
    this.unidadForm.patchValue({ id_sede: null });
    this.sedesOptions = [];

    if (!sucursalId) return;

    this.isLoadingSedes = true;
    this.sedeService.getSedesPorSucursal(sucursalId).subscribe({
      next: (sedes) => {
        this.sedesOptions = sedes.map(s => ({
          label: s.nombre,
          value: s.id
        }));
        this.isLoadingSedes = false;
      },
      error: () => {
        this.isLoadingSedes = false;
        this.showError('Error al cargar las sedes');
      }
    });
  }

  buscarPorCodigo(): void {
    if (!this.empresaSeleccionada) {
      this.showWarn('Seleccione primero una empresa');
      return;
    }

    const codigo = (this.unidadForm.get('codigo')?.value || '').trim();
    if (!codigo) {
      this.showWarn('Ingrese un código para buscar');
      return;
    }

    const empresaId = this.unidadForm.get('id_empresa')?.value;
    this.isSearching = true;

    this.unidadFuncionalService.buscarPorCodigo(codigo, empresaId).subscribe({
      next: (unidad) => {
        this.isSearching = false;
        if (unidad) {
          this.cargarUnidad(unidad);
          this.showSuccess('Unidad funcional encontrada');
        } else {
          this.prepararNuevoRegistro(codigo);
          this.showInfo('No se encontró la unidad. Puede crear un nuevo registro.');
        }
      },
      error: () => {
        this.isSearching = false;
        this.showWarn('No se pudo buscar el código. Verifique la conexión con el servidor.');
      }
    });
  }

  abrirModalUnidades(): void {
    if (!this.empresaSeleccionada) {
      this.showWarn('Seleccione primero una empresa');
      return;
    }

    const empresaId = this.unidadForm.get('id_empresa')?.value;
    this.modalSearchTerm = '';
    this.showModalUnidades = true;
    this.isLoadingModal = true;
    this.unidadesModal = [];

    this.unidadFuncionalService.getUnidadesFuncionales(empresaId).subscribe({
      next: (unidades) => {
        this.unidadesModal = unidades;
        this.isLoadingModal = false;
      },
      error: () => {
        this.unidadesModal = [];
        this.isLoadingModal = false;
        this.showError('Error al cargar las unidades funcionales');
      }
    });
  }

  cerrarModalUnidades(): void {
    this.showModalUnidades = false;
    this.modalSearchTerm = '';
    this.unidadesModal = [];
  }

  seleccionarDesdeModal(unidad: UnidadFuncional): void {
    this.unidadFuncionalService.getUnidadFuncional(unidad.id).subscribe({
      next: (detalle) => {
        this.cargarUnidad(detalle);
        this.cerrarModalUnidades();
      },
      error: () => {
        this.cargarUnidad(unidad);
        this.cerrarModalUnidades();
      }
    });
  }

  private cargarUnidad(unidad: UnidadFuncional): void {
    this.editMode = true;
    this.currentUnidadId = unidad.id;

    this.unidadForm.patchValue({
      codigo: unidad.codigo,
      id_empresa: unidad.id_empresa,
      id_sucursal: null,
      id_sede: null,
      nombre: unidad.nombre,
      estado: unidad.estado ?? 1
    });

    if (!this.esTransversal) {
      this.empresaNombre = unidad.empresa?.nombre || this.empresaNombre;
    }

    this.actualizarEstadoCodigo();

    this.isLoadingSucursales = true;
    this.sucursalService.getSucursalesPorEmpresa(unidad.id_empresa).subscribe({
      next: (sucursales) => {
        this.sucursalesOptions = sucursales.map(s => ({
          label: s.nombre,
          value: s.id
        }));
        this.unidadForm.patchValue({ id_sucursal: unidad.id_sucursal });
        this.isLoadingSucursales = false;

        if (unidad.id_sucursal) {
          this.isLoadingSedes = true;
          this.sedeService.getSedesPorSucursal(unidad.id_sucursal).subscribe({
            next: (sedes) => {
              this.sedesOptions = sedes.map(s => ({
                label: s.nombre,
                value: s.id
              }));
              this.unidadForm.patchValue({ id_sede: unidad.id_sede ?? null });
              this.isLoadingSedes = false;
            },
            error: () => {
              this.isLoadingSedes = false;
            }
          });
        }
      },
      error: () => {
        this.isLoadingSucursales = false;
      }
    });

    this.usuariosAutorizados = [...(unidad.usuarios_autorizados ?? [])];
    this.jefesEncargados = [...(unidad.jefes_encargados ?? [])];
    this.habilitarGestionUsuarios(unidad.id_empresa);
  }

  private prepararNuevoRegistro(codigo: string): void {
    const empresaId = this.unidadForm.get('id_empresa')?.value;

    this.editMode = false;
    this.currentUnidadId = null;
    this.limpiarContextoUsuarios();

    this.unidadForm.patchValue({
      codigo,
      id_sucursal: null,
      id_sede: null,
      nombre: '',
      estado: 1
    });

    this.sedesOptions = [];

    if (empresaId) {
      this.habilitarGestionUsuarios(empresaId);
      this.isLoadingSucursales = true;
      this.sucursalService.getSucursalesPorEmpresa(empresaId).subscribe({
        next: (sucursales) => {
          this.sucursalesOptions = sucursales.map(s => ({
            label: s.nombre,
            value: s.id
          }));
          this.isLoadingSucursales = false;
        },
        error: () => {
          this.isLoadingSucursales = false;
        }
      });
    }
  }

  nuevaUnidad(): void {
    const empresaId = this.unidadForm.get('id_empresa')?.value;

    this.editMode = false;
    this.currentUnidadId = null;
    this.limpiarContextoUsuarios();
    this.sucursalesOptions = [];
    this.sedesOptions = [];

    this.unidadForm.reset({ estado: 1 });

    if (!this.esTransversal && empresaId) {
      this.establecerEmpresa(empresaId);
    } else {
      this.actualizarEstadoCodigo();
    }
  }

  agregarUsuarios(): void {
    if (!this.puedeGestionarUsuarios) {
      this.showWarn('Seleccione o cree una unidad funcional primero');
      return;
    }

    if (!this.selectedUsuarioIds.length) {
      this.showWarn('Seleccione al menos un usuario');
      return;
    }

    const nuevos: UsuarioAutorizado[] = [];
    let duplicados = 0;

    for (const id of this.selectedUsuarioIds) {
      if (this.usuariosAutorizados.some(u => u.id_user === id)) {
        duplicados++;
        continue;
      }

      const usuario = this.usuariosDisponibles.find(u => u.id === id);
      if (!usuario) continue;

      nuevos.push({
        id_user: usuario.id,
        codigo: String(usuario.id).padStart(3, '0'),
        nombre: usuario.name
      });
    }

    if (!nuevos.length) {
      this.showWarn('Los usuarios seleccionados ya están en la lista');
      this.selectedUsuarioIds = [];
      return;
    }

    this.usuariosAutorizados = [...this.usuariosAutorizados, ...nuevos];
    this.selectedUsuarioIds = [];

    if (duplicados > 0) {
      this.showInfo(`${nuevos.length} usuario(s) agregado(s). ${duplicados} ya estaban en la lista.`);
    }
  }

  eliminarUsuario(usuario: UsuarioAutorizado): void {
    this.usuariosAutorizados = this.usuariosAutorizados.filter(
      u => u.id_user !== usuario.id_user
    );
  }

  agregarJefes(): void {
    if (!this.puedeGestionarUsuarios) {
      this.showWarn('Seleccione o cree una unidad funcional primero');
      return;
    }

    if (!this.selectedJefeIds.length) {
      this.showWarn('Seleccione al menos un jefe encargado');
      return;
    }

    const nuevos: JefeEncargado[] = [];
    let duplicados = 0;

    for (const id of this.selectedJefeIds) {
      if (this.jefesEncargados.some(j => j.id_user === id)) {
        duplicados++;
        continue;
      }

      const jefe = this.usuariosDisponibles.find(u => u.id === id);
      if (!jefe) continue;

      nuevos.push({
        id_user: jefe.id,
        codigo: String(jefe.id).padStart(3, '0'),
        nombre: jefe.name
      });
    }

    if (!nuevos.length) {
      this.showWarn('Los jefes seleccionados ya están en la lista');
      this.selectedJefeIds = [];
      return;
    }

    this.jefesEncargados = [...this.jefesEncargados, ...nuevos];
    this.selectedJefeIds = [];

    if (duplicados > 0) {
      this.showInfo(`${nuevos.length} jefe(s) agregado(s). ${duplicados} ya estaban en la lista.`);
    }
  }

  eliminarJefe(jefe: JefeEncargado): void {
    this.jefesEncargados = this.jefesEncargados.filter(
      j => j.id_user !== jefe.id_user
    );
  }

  guardar(): void {
    if (this.unidadForm.invalid) {
      this.unidadForm.markAllAsTouched();
      this.showWarn('Complete los campos obligatorios');
      return;
    }

    this.isSaving = true;
    const formValue = this.unidadForm.getRawValue();
    const wasEdit = this.editMode && !!this.currentUnidadId;
    const payload = {
      codigo: formValue.codigo.trim(),
      nombre: formValue.nombre.trim(),
      id_empresa: formValue.id_empresa,
      id_sucursal: formValue.id_sucursal,
      id_sede: formValue.id_sede || null,
      estado: formValue.estado === 1 || formValue.estado === true ? 1 : 0,
      usuarios_autorizados: this.usuariosAutorizados.map(u => u.id_user),
      jefes_encargados: this.jefesEncargados.map(j => j.id_user)
    };

    const request$ = wasEdit
      ? this.unidadFuncionalService.updateUnidadFuncional(this.currentUnidadId!, payload)
      : this.unidadFuncionalService.createUnidadFuncional(payload);

    request$.subscribe({
      next: (unidad) => {
        this.isSaving = false;
        this.cargarUnidad(unidad);
        this.showSuccess(wasEdit ? 'Unidad funcional actualizada' : 'Unidad funcional creada');
      },
      error: (error) => {
        this.isSaving = false;
        this.showError(error.error?.message || 'Error al guardar la unidad funcional');
      }
    });
  }

  getEstadoLabel(estado?: number): string {
    return estado === 1 ? 'Activo' : 'Inactivo';
  }

  getEstadoSeverity(estado?: number): 'success' | 'danger' {
    return estado === 1 ? 'success' : 'danger';
  }

  private showSuccess(message: string): void {
    this.messageService.add({ severity: 'success', summary: 'Éxito', detail: message });
  }

  private showError(message: string): void {
    this.messageService.add({ severity: 'error', summary: 'Error', detail: message, life: 5000 });
  }

  private showWarn(message: string): void {
    this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: message, life: 4000 });
  }

  private showInfo(message: string): void {
    this.messageService.add({ severity: 'info', summary: 'Información', detail: message, life: 4000 });
  }
}
