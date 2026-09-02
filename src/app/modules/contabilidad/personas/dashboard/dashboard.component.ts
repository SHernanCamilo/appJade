import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { CalendarModule } from 'primeng/calendar';
import { InputSwitchModule } from 'primeng/inputswitch';
import { TableModule } from 'primeng/table';
import { ContextoService, Empresa as EmpresaContexto } from '../../../../core/services/contexto.service';
import { environment } from '../../../../environments/environment';
import {
  CargoOpcion,
  Empleado,
  PersonaPayload,
  PersonaService,
  UsuarioLookup
} from '../services/persona.service';

@Component({
  selector: 'app-dashboard-personas',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    DialogModule,
    ToastModule,
    TagModule,
    TooltipModule,
    CalendarModule,
    InputSwitchModule,
    TableModule
  ],
  providers: [MessageService],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardPersonasComponent implements OnInit, OnDestroy {
  form!: FormGroup;
  cargos: CargoOpcion[] = [];
  empresasOptions: { label: string; value: number }[] = [];

  esTransversal = false;
  empresaNombre = '';
  isLoadingEmpresas = false;
  isSubmitting = false;
  isSearching = false;
  isLoadingUsuarios = false;
  editMode = false;
  formularioListo = false;
  currentId?: number;
  currentPersona?: Empleado;
  usuarioVinculado: UsuarioLookup | null = null;

  usuarios: UsuarioLookup[] = [];
  usuariosTotal = 0;
  usuariosFirst = 0;
  usuariosRows = 25;
  busquedaUsuarios = '';
  showModalUsuarios = false;
  scopeUsuarios: 'todos' | 'empresas' | undefined;

  tiposDocumento = [
    { label: 'Cédula de ciudadanía', value: 'CC' },
    { label: 'Cédula de extranjería', value: 'CE' },
    { label: 'NIT', value: 'NIT' },
    { label: 'Tarjeta de identidad', value: 'TI' },
    { label: 'Pasaporte', value: 'PP' },
    { label: 'PEP', value: 'PEP' }
  ];

  private silencioBusqueda = false;
  private readonly camposBloqueados = [
    'tipo_identificacion',
    'nombre',
    'email',
    'telefono',
    'direccion',
    'id_cargo',
    'unidad',
    'contrato',
    'fecha_inicio_contrato',
    'fecha_fin_contrato',
    'estado',
    'id_user'
  ];
  private readonly documento$ = new Subject<string>();
  private subs: Subscription[] = [];

  constructor(
    private fb: FormBuilder,
    private personaService: PersonaService,
    private contextoService: ContextoService,
    private http: HttpClient,
    private messageService: MessageService
  ) {
    this.form = this.fb.group({
      id_empresa: [null, Validators.required],
      id_user: [null],
      id_cargo: [null],
      tipo_identificacion: ['CC', Validators.required],
      numero_identificacion: ['', [Validators.required, Validators.maxLength(50)]],
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      telefono: [''],
      direccion: [''],
      unidad: [''],
      contrato: [''],
      fecha_inicio_contrato: [null],
      fecha_fin_contrato: [null],
      estado: [true]
    });
    this.setCamposHabilitados(false);
  }

  ngOnInit(): void {
    this.cargarEmpresasDisponibles();
    this.cargarCargos();
    this.subs.push(
      this.documento$.pipe(
        debounceTime(450),
        distinctUntilChanged()
      ).subscribe((doc) => this.buscarPorDocumento(doc))
    );
    this.subs.push(
      this.form.get('numero_identificacion')!.valueChanges.subscribe((valor) => {
        if (this.silencioBusqueda) {
          return;
        }
        const doc = String(valor ?? '').trim();
        if (doc.length < 5) {
          this.setCamposHabilitados(false);
          return;
        }
        this.documento$.next(doc);
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  get empresaSeleccionada(): boolean {
    return !!this.form.get('id_empresa')?.value;
  }

  get estadoActivo(): boolean {
    return this.form.get('estado')?.value !== false;
  }

  onEstadoChange(activo: boolean): void {
    this.form.patchValue({ estado: activo });
  }

  onEmpresaChange(): void {
    const empresaId = this.form.get('id_empresa')?.value;
    if (this.esTransversal && empresaId) {
      this.empresaNombre = this.empresasOptions.find(e => e.value === empresaId)?.label ?? '';
    }
  }

  onDocumentoEnter(): void {
    const doc = String(this.form.get('numero_identificacion')?.value ?? '').trim();
    this.buscarPorDocumento(doc, true);
  }

  buscarPorDocumento(documento: string, forzar = false): void {
    const doc = documento.trim();
    if (!forzar && doc.length < 5) {
      return;
    }
    if (!doc) {
      this.messageService.add({ severity: 'warn', summary: 'Documento', detail: 'Ingrese un número de identificación' });
      return;
    }

    this.isSearching = true;
    this.personaService.buscarPorDocumento({
      documento: doc,
      empresaId: this.form.get('id_empresa')?.value || undefined
    }).subscribe({
      next: (res) => {
        this.isSearching = false;
        if (res.persona) {
          this.aplicarPersona(res.persona, res.usuario);
          this.messageService.add({ severity: 'success', summary: 'Encontrado', detail: 'Se cargaron los datos de la persona / tercero' });
          return;
        }
        if (res.usuario) {
          this.aplicarUsuario(res.usuario, true);
          this.messageService.add({ severity: 'info', summary: 'Usuario', detail: 'No hay tercero; se cargaron los datos del usuario' });
          return;
        }
        this.setCamposHabilitados(true);
        if (forzar) {
          this.messageService.add({
            severity: 'info',
            summary: 'Sin registro',
            detail: 'No existe. Complete los campos para crear.'
          });
        }
      },
      error: () => {
        this.isSearching = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo buscar el documento' });
      }
    });
  }

  abrirModalUsuarios(): void {
    this.showModalUsuarios = true;
    this.cargarUsuarios(1);
  }

  onBuscarUsuarios(): void {
    this.cargarUsuarios(1);
  }

  onUsuariosPage(event: { first?: number; rows?: number }): void {
    this.usuariosFirst = event.first ?? 0;
    this.usuariosRows = event.rows ?? 25;
    const page = Math.floor(this.usuariosFirst / this.usuariosRows) + 1;
    this.cargarUsuarios(page);
  }

  cargarUsuarios(page = 1): void {
    this.isLoadingUsuarios = true;
    this.personaService.listarUsuarios({
      empresaId: this.form.get('id_empresa')?.value || undefined,
      buscar: this.busquedaUsuarios.trim().length >= 2 ? this.busquedaUsuarios.trim() : undefined,
      page,
      perPage: this.usuariosRows
    }).subscribe({
      next: (res) => {
        this.usuarios = res.data;
        this.usuariosTotal = res.total;
        this.scopeUsuarios = res.scope;
        this.isLoadingUsuarios = false;
      },
      error: () => {
        this.usuarios = [];
        this.usuariosTotal = 0;
        this.isLoadingUsuarios = false;
      }
    });
  }

  seleccionarUsuario(user: UsuarioLookup): void {
    this.showModalUsuarios = false;
    if (!user.numero_identificacion && !user.email) {
      this.aplicarUsuario(user, true);
      return;
    }
    this.isSearching = true;
    this.personaService.buscarPorDocumento({
      documento: user.numero_identificacion || undefined,
      email: user.email || undefined,
      empresaId: this.form.get('id_empresa')?.value || undefined
    }).subscribe({
      next: (res) => {
        this.isSearching = false;
        if (res.persona) {
          this.aplicarPersona(res.persona, res.usuario ?? user);
          return;
        }
        this.aplicarUsuario(res.usuario ?? user, true);
      },
      error: () => {
        this.isSearching = false;
        this.aplicarUsuario(user, true);
      }
    });
  }

  desvincularUsuario(): void {
    this.form.patchValue({ id_user: null });
    this.usuarioVinculado = null;
  }

  nuevaPersona(): void {
    const empresaId = this.form.get('id_empresa')?.value;
    this.resetForm(empresaId);
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    const payload = this.toPayload();
    const request$ = this.editMode && this.currentId
      ? this.personaService.actualizar(this.currentId, payload)
      : this.personaService.crear(payload);

    request$.subscribe({
      next: (persona) => {
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: this.editMode ? 'Registro actualizado' : 'Registro creado'
        });
        this.aplicarPersona(persona, this.usuarioVinculado);
        this.isSubmitting = false;
      },
      error: (error) => {
        this.isSubmitting = false;
        const errors = error.error?.errors;
        const firstError = errors ? Object.values(errors).flat()[0] : null;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: (firstError as string) || error.error?.message || 'No se pudo guardar'
        });
      }
    });
  }

  get auditoriaCreacion(): string {
    const row = this.currentPersona;
    if (!row?.created_at) {
      return '';
    }
    const fecha = new Date(row.created_at).toLocaleString('es-CO');
    const usuario = row.usuario_crea?.name || '—';
    return `${fecha} · ${usuario}`;
  }

  get auditoriaEdicion(): string {
    const row = this.currentPersona;
    if (!row?.updated_at) {
      return '';
    }
    const fecha = new Date(row.updated_at).toLocaleString('es-CO');
    const usuario = row.usuario_actualiza?.name || '—';
    return `${fecha} · ${usuario}`;
  }

  private aplicarPersona(persona: Empleado, usuario?: UsuarioLookup | null): void {
    this.silencioBusqueda = true;
    this.setCamposHabilitados(true);
    this.editMode = true;
    this.currentId = persona.id;
    this.currentPersona = persona;
    this.form.patchValue({
      id_empresa: persona.id_empresa,
      id_user: persona.id_user ?? usuario?.id ?? null,
      id_cargo: persona.id_cargo,
      tipo_identificacion: persona.tipo_identificacion || 'CC',
      numero_identificacion: persona.numero_identificacion,
      nombre: persona.nombre,
      email: persona.email ?? '',
      telefono: persona.telefono ?? '',
      direccion: persona.direccion ?? '',
      unidad: persona.unidad ?? '',
      contrato: persona.contrato ?? '',
      fecha_inicio_contrato: this.parseDate(persona.fecha_inicio_contrato),
      fecha_fin_contrato: this.parseDate(persona.fecha_fin_contrato),
      estado: persona.estado !== false
    });
    this.usuarioVinculado = usuario ?? (persona.usuario ? {
      id: persona.usuario.id,
      name: persona.usuario.name,
      email: persona.usuario.email,
      numero_identificacion: persona.usuario.numero_identificacion,
      tipo_identificacion: persona.usuario.tipo_identificacion,
      telefono: persona.usuario.telefono,
      direccion: persona.usuario.direccion
    } : null);
    if (this.usuarioVinculado && !this.form.get('id_user')?.value) {
      this.form.patchValue({ id_user: this.usuarioVinculado.id });
    }
    setTimeout(() => { this.silencioBusqueda = false; });
  }

  private aplicarUsuario(user: UsuarioLookup, comoNuevo: boolean): void {
    this.silencioBusqueda = true;
    this.setCamposHabilitados(true);
    if (comoNuevo) {
      this.editMode = false;
      this.currentId = undefined;
      this.currentPersona = undefined;
    }
    this.usuarioVinculado = user;
    this.form.patchValue({
      id_user: user.id,
      tipo_identificacion: user.tipo_identificacion || this.form.get('tipo_identificacion')?.value || 'CC',
      numero_identificacion: user.numero_identificacion || this.form.get('numero_identificacion')?.value,
      nombre: user.name || this.form.get('nombre')?.value,
      email: user.email ?? this.form.get('email')?.value,
      telefono: user.telefono ?? this.form.get('telefono')?.value,
      direccion: user.direccion ?? this.form.get('direccion')?.value
    });
    setTimeout(() => { this.silencioBusqueda = false; });
  }

  private cargarEmpresasDisponibles(): void {
    this.isLoadingEmpresas = true;
    this.contextoService.obtenerEmpresasDisponibles().subscribe({
      next: (empresas: EmpresaContexto[]) => {
        if (empresas.length === 0) {
          this.esTransversal = true;
          this.http.get<{ success: boolean; data: { nombre: string; id: number }[] }>(
            `${environment.URL_SERVICIOS}/empresas-activas`
          ).subscribe({
            next: (response) => {
              this.empresasOptions = (response.data || []).map(e => ({ label: e.nombre, value: e.id }));
              this.isLoadingEmpresas = false;
            },
            error: () => {
              this.isLoadingEmpresas = false;
              this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las empresas' });
            }
          });
        } else if (empresas.length === 1) {
          this.esTransversal = false;
          this.empresaNombre = empresas[0].nombre;
          this.form.patchValue({ id_empresa: empresas[0].id });
          this.isLoadingEmpresas = false;
        } else {
          this.esTransversal = true;
          this.empresasOptions = empresas.map(e => ({ label: e.nombre, value: e.id }));
          this.isLoadingEmpresas = false;
        }
      },
      error: () => {
        this.isLoadingEmpresas = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las empresas disponibles' });
      }
    });
  }

  private cargarCargos(): void {
    this.personaService.cargos().subscribe({
      next: (cargos) => { this.cargos = cargos; },
      error: () => { this.cargos = []; }
    });
  }

  private resetForm(empresaId?: number | null): void {
    this.silencioBusqueda = true;
    this.form.reset({
      id_empresa: empresaId ?? (!this.esTransversal ? this.form.get('id_empresa')?.value : null),
      tipo_identificacion: 'CC',
      estado: true
    });
    this.editMode = false;
    this.currentId = undefined;
    this.currentPersona = undefined;
    this.usuarioVinculado = null;
    this.setCamposHabilitados(false);
    setTimeout(() => { this.silencioBusqueda = false; });
  }

  private setCamposHabilitados(habilitar: boolean): void {
    this.formularioListo = habilitar;
    for (const campo of this.camposBloqueados) {
      const control = this.form.get(campo);
      if (!control) {
        continue;
      }
      if (habilitar) {
        control.enable({ emitEvent: false });
      } else {
        control.disable({ emitEvent: false });
      }
    }
  }

  private toPayload(): PersonaPayload {
    const v = this.form.getRawValue();
    return {
      id_empresa: v.id_empresa,
      id_user: v.id_user || null,
      id_cargo: v.id_cargo || null,
      tipo_identificacion: v.tipo_identificacion,
      numero_identificacion: v.numero_identificacion,
      nombre: v.nombre,
      email: v.email || null,
      telefono: v.telefono || null,
      direccion: v.direccion || null,
      unidad: v.unidad || null,
      contrato: v.contrato || null,
      fecha_inicio_contrato: this.toYmd(v.fecha_inicio_contrato),
      fecha_fin_contrato: this.toYmd(v.fecha_fin_contrato),
      estado: v.estado !== false
    };
  }

  private parseDate(value?: string | null): Date | null {
    if (!value) {
      return null;
    }
    const d = new Date(value.includes('T') ? value : `${value}T00:00:00`);
    return isNaN(d.getTime()) ? null : d;
  }

  private toYmd(value: Date | string | null): string | null {
    if (!value) {
      return null;
    }
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) {
      return null;
    }
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }
}
