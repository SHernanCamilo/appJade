import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { TooltipModule } from 'primeng/tooltip';
import { CheckboxModule } from 'primeng/checkbox';

import { ContextoService } from '../../../../core/services/contexto.service';
import { AuthService } from '../../../auth/auth.service';
import { PersonaService, Empleado } from '../../../contabilidad/personas/services/persona.service';
import { AnticipoSolicitudService } from '../services/anticipo-solicitud.service';
import { AnticipoCiudadService } from '../services/anticipo-ciudad.service';
import { Ciudad, CalculoTopesResponse, TopeItem } from '../models/anticipo.models';

interface EmpleadoUI {
  id: number; nombre: string; cedula: string; cargo: string; area: string;
  email?: string | null; raw: Empleado;
}

interface DesglosAlimentacion {
  desayuno: number; almuerzo: number; cena: number; totalDiario: number;
}

@Component({
  selector: 'app-solicitudes-anticipos',
  standalone: true,
  imports: [
    CommonModule, RouterModule, FormsModule,
    ButtonModule, ToastModule, TableModule, TagModule, SkeletonModule,
    InputTextModule, DropdownModule, DatePickerModule, DialogModule,
    InputNumberModule, TooltipModule, CheckboxModule
  ],
  providers: [MessageService],
  templateUrl: './solicitudes.component.html',
  styleUrl: './solicitudes.component.css'
})
export class SolicitudesAnticiposComponent implements OnInit, OnDestroy {

  isLoading = false;
  isLoadingEmpleados = false;
  solicitudes: any[] = [];
  totalRecords = 0;
  empleadosOptions: { label: string; value: EmpleadoUI }[] = [];
  searchTerm = '';
  selectedEstado: string | null = null;

  // Modal
  displayNuevaSolicitud = false;
  esParaMi = false;
  usuarioSeleccionado: EmpleadoUI | null = null;
  usuarioActual: EmpleadoUI | null = null;
  private empresaIdActual: number | null = null;
  private subscriptions: Subscription[] = [];
  private busquedaEmpleado$ = new Subject<string>();
  private empleadosPagina = 1;
  private empleadosPerPage = 30;
  private empleadosTotalPages = 1;
  private empleadosCargados = false;

  motivoSeleccionado: 'viaje' | 'otros' | null = null;
  ciudadesOptions: Ciudad[] = [];
  ciudadSeleccionada: Ciudad | null = null;

  topesCalculados: CalculoTopesResponse | null = null;
  desglose: DesglosAlimentacion | null = null;
  isCalculandoTopes = false;

  incluirAlimentacion = true;
  incluirHospedaje = false;

  formularioViaje = {
    pasajeIntermunicipal: { cantidad: 1, valor: 0 },
    transporteInterno: { cantidad: 1, valor: 0 },
    alimentacion: { cantidad: 1, valor: 0 },
    hospedaje: { cantidad: 1, valor: 0 },
    motivo: '',
    fechaSalida: null as Date | null,
    fechaRegreso: null as Date | null,
    cobertura: 'nacional' as 'nacional' | 'internacional'
  };

  formularioOtros = { moneda: 'pesos', valor: 0, descripcion: '', archivos: [] as File[] };

  estadosOptions = [
    { label: 'Todos', value: null },
    { label: 'Pendiente Jefe', value: 'pendiente_jefe' },
    { label: 'Pendiente Financiero', value: 'pendiente_financiero' },
    { label: 'Autorizado', value: 'autorizado' },
    { label: 'En Viaje', value: 'en_viaje' },
    { label: 'Pendiente Legalización', value: 'pendiente_legalizacion' },
    { label: 'Cerrado', value: 'cerrado' },
    { label: 'Rechazado', value: 'rechazado_jefe' }
  ];

  constructor(
    private messageService: MessageService,
    private contextoService: ContextoService,
    private authService: AuthService,
    private personaService: PersonaService,
    private anticipoSolicitudService: AnticipoSolicitudService,
    private ciudadService: AnticipoCiudadService
  ) {}

  ngOnInit(): void {
    this.iniciarContexto();
    this.loadSolicitudes();
    this.cargarCiudades();

    this.subscriptions.push(
      this.busquedaEmpleado$.pipe(
        debounceTime(400), distinctUntilChanged(),
        switchMap((termino) => {
          this.isLoadingEmpleados = true;
          this.empleadosPagina = 1;
          return this.personaService.buscarEmpleadosPaginados({
            empresaId: this.empresaIdActual!, termino: termino || undefined,
            estado: true, page: 1, perPage: this.empleadosPerPage
          });
        })
      ).subscribe({
        next: (r) => {
          this.empleadosTotalPages = r.last_page;
          this.empleadosOptions = r.data.filter(e => e.estado !== false)
            .map(e => ({ label: `${e.nombre} - ${e.numero_identificacion}`, value: this.mapEmpleadoUI(e) }));
          this.isLoadingEmpleados = false;
        },
        error: () => { this.isLoadingEmpleados = false; this.toast('error', 'No se pudieron cargar los empleados'); }
      })
    );
  }

  ngOnDestroy(): void { this.subscriptions.forEach(s => s.unsubscribe()); }

  // ── CIUDADES ──────────────────────────────────────────────────────────────
  cargarCiudades(): void {
    this.ciudadService.getCiudades().subscribe({
      next: (response: any) => {
        const lista = Array.isArray(response?.data) ? response.data
          : Array.isArray(response) ? response : [];
        this.ciudadesOptions = lista.filter((c: Ciudad) => c.estado !== false);
      },
      error: () => this.toast('error', 'No se pudieron cargar las ciudades')
    });
  }

  // ── SOLICITUDES ───────────────────────────────────────────────────────────
  loadSolicitudes(): void {
    this.isLoading = true;
    this.anticipoSolicitudService.listarSolicitudes({
      estado: this.selectedEstado || undefined, page: 1, per_page: 20
    }).subscribe({
      next: (response: any) => {
        if (Array.isArray(response?.data)) {
          this.solicitudes = response.data; this.totalRecords = response.total ?? response.data.length;
        } else if (Array.isArray(response?.data?.data)) {
          this.solicitudes = response.data.data; this.totalRecords = response.data.total ?? 0;
        } else { this.solicitudes = []; this.totalRecords = 0; }
        this.isLoading = false;
      },
      error: () => { this.solicitudes = []; this.totalRecords = 0; this.isLoading = false; }
    });
  }

  aplicarFiltros(): void { this.loadSolicitudes(); }
  limpiarFiltros(): void { this.selectedEstado = null; this.searchTerm = ''; this.loadSolicitudes(); }

  // ── MODAL ─────────────────────────────────────────────────────────────────
  abrirNuevaSolicitud(): void {
    this.displayNuevaSolicitud = true;
    this.resetFormulario();
    if (!this.empresaIdActual) this.resolverEmpresaActual();
    if (this.empleadosOptions.length === 0 && this.empresaIdActual && !this.isLoadingEmpleados) {
      this.empleadosCargados = false; this.cargarEmpleadosEmpresa();
    }
  }

  cerrarNuevaSolicitud(): void { this.displayNuevaSolicitud = false; this.resetFormulario(); }

  resetFormulario(): void {
    this.esParaMi = false; this.usuarioSeleccionado = null;
    this.motivoSeleccionado = null; this.ciudadSeleccionada = null;
    this.topesCalculados = null; this.desglose = null;
    this.incluirAlimentacion = true; this.incluirHospedaje = false;
    this.formularioViaje = {
      pasajeIntermunicipal: { cantidad: 1, valor: 0 }, transporteInterno: { cantidad: 1, valor: 0 },
      alimentacion: { cantidad: 1, valor: 0 }, hospedaje: { cantidad: 1, valor: 0 },
      motivo: '', fechaSalida: null, fechaRegreso: null, cobertura: 'nacional'
    };
    this.formularioOtros = { moneda: 'pesos', valor: 0, descripcion: '', archivos: [] };
  }

  onEsParaMiChange(): void {
    if (this.esParaMi) this.autocompletarEmpleadoActual();
    else this.usuarioSeleccionado = null;
  }

  seleccionarMotivo(motivo: 'viaje' | 'otros'): void { this.motivoSeleccionado = motivo; }

  // ── TOPES ─────────────────────────────────────────────────────────────────
  onFechaSalidaChange(): void {
    if (this.formularioViaje.fechaRegreso && this.formularioViaje.fechaSalida &&
      this.formularioViaje.fechaRegreso < this.formularioViaje.fechaSalida) {
      this.formularioViaje.fechaRegreso = null;
      this.toast('info', 'La fecha de regreso debe ser posterior a la de salida');
    }
    this.calcularTopesAutomatico();
  }

  onFechaRegresoChange(): void { this.calcularTopesAutomatico(); }

  onCiudadChange(ciudad: Ciudad | null): void {
    this.ciudadSeleccionada = ciudad;
    this.calcularTopesAutomatico();
  }

  calcularTopesAutomatico(): void {
    if (this.usuarioSeleccionado && this.ciudadSeleccionada &&
      this.formularioViaje.fechaSalida && this.formularioViaje.fechaRegreso) {
      this.calcularTopes();
    }
  }

  calcularTopes(): void {
    if (!this.usuarioSeleccionado || !this.ciudadSeleccionada ||
      !this.formularioViaje.fechaSalida || !this.formularioViaje.fechaRegreso) return;

    this.isCalculandoTopes = true;

    this.anticipoSolicitudService.calcularTopes({
      id_empleado: this.usuarioSeleccionado.id,
      id_ciudad_destino: this.ciudadSeleccionada.id,
      fecha_salida: this.formatDate(this.formularioViaje.fechaSalida),
      fecha_regreso: this.formatDate(this.formularioViaje.fechaRegreso),
      cobertura: this.formularioViaje.cobertura
    }).subscribe({
      next: (response: any) => {
        const topes: CalculoTopesResponse = response?.data ?? response;
        if (!topes || (!topes.items && topes.alimentacion_diario === undefined)) {
          this.toast('warn', 'No se encontraron topes para los parámetros indicados');
          this.isCalculandoTopes = false; return;
        }
        this.topesCalculados = topes;
        this.desglose = this.extraerDesglose(topes.items ?? []);
        const dias = topes.dias ?? topes.dias_viaje ?? 1;
        const transporteDiario = Number(topes.transporte_diario ?? 0);

        this.formularioViaje.transporteInterno.cantidad = dias;
        this.formularioViaje.transporteInterno.valor = transporteDiario;

        if (this.incluirAlimentacion) {
          this.formularioViaje.alimentacion.cantidad = dias;
          this.formularioViaje.alimentacion.valor = Number(topes.alimentacion_diario ?? 0);
        }
        this.toast('success', `Topes calculados — Total estimado: ${this.formatCurrency(topes.total ?? topes.monto_total_estimado ?? 0)}`);
        this.isCalculandoTopes = false;
      },
      error: (error) => {
        this.toast('error', error.error?.message || 'No se pudieron calcular los topes');
        this.isCalculandoTopes = false;
      }
    });
  }

  private extraerDesglose(items: TopeItem[]): DesglosAlimentacion {
    const find = (desc: string) => {
      const item = items.find(i => i.descripcion?.toLowerCase().includes(desc));
      return item ? Number(item.valor_unitario) : 0;
    };
    const desayuno = find('desayuno'), almuerzo = find('almuerzo'), cena = find('cena');
    return { desayuno, almuerzo, cena, totalDiario: desayuno + almuerzo + cena };
  }

  onIncluirAlimentacionChange(): void {
    if (!this.incluirAlimentacion) {
      this.formularioViaje.alimentacion = { cantidad: 1, valor: 0 };
    } else if (this.topesCalculados) {
      const dias = this.topesCalculados.dias ?? this.topesCalculados.dias_viaje ?? 1;
      this.formularioViaje.alimentacion.cantidad = dias;
      this.formularioViaje.alimentacion.valor = Number(this.topesCalculados.alimentacion_diario ?? 0);
    }
  }

  onIncluirHospedajeChange(): void {
    if (!this.incluirHospedaje) this.formularioViaje.hospedaje = { cantidad: 1, valor: 0 };
  }

  // ── CÁLCULOS ──────────────────────────────────────────────────────────────
  calcularTotalViaje(): number {
    const { pasajeIntermunicipal, transporteInterno, alimentacion, hospedaje } = this.formularioViaje;
    let total = (pasajeIntermunicipal.cantidad * pasajeIntermunicipal.valor)
      + (transporteInterno.cantidad * transporteInterno.valor);
    if (this.incluirAlimentacion) total += alimentacion.cantidad * alimentacion.valor;
    if (this.incluirHospedaje) total += hospedaje.cantidad * hospedaje.valor;
    return total;
  }

  incrementarCantidad(c: 'pasajeIntermunicipal' | 'transporteInterno' | 'alimentacion' | 'hospedaje'): void {
    this.formularioViaje[c].cantidad++;
  }

  decrementarCantidad(c: 'pasajeIntermunicipal' | 'transporteInterno' | 'alimentacion' | 'hospedaje'): void {
    if (this.formularioViaje[c].cantidad > 1) this.formularioViaje[c].cantidad--;
  }

  // ── GUARDAR ───────────────────────────────────────────────────────────────
  guardarSolicitud(): void {
    if (!this.usuarioSeleccionado) { this.toast('warn', 'Debe seleccionar un responsable'); return; }
    if (!this.motivoSeleccionado) { this.toast('warn', 'Debe seleccionar un motivo'); return; }

    if (this.motivoSeleccionado === 'viaje') {
      if (!this.ciudadSeleccionada) { this.toast('warn', 'Debe seleccionar una ciudad destino'); return; }
      if (!this.formularioViaje.fechaSalida || !this.formularioViaje.fechaRegreso) {
        this.toast('warn', 'Debe seleccionar fechas de salida y regreso'); return;
      }
      if (!this.formularioViaje.motivo?.trim()) { this.toast('warn', 'Debe ingresar el motivo del viaje'); return; }
      this.crearSolicitudViaje();
    } else {
      this.toast('info', 'Funcionalidad de otros conceptos en desarrollo');
    }
  }

  private crearSolicitudViaje(): void {
    const items: any[] = [];

    if (this.formularioViaje.pasajeIntermunicipal.valor > 0) {
      items.push({
        id_concepto: 1, descripcion: 'Pasaje Intermunicipal',
        cantidad: this.formularioViaje.pasajeIntermunicipal.cantidad,
        valor_unitario: this.formularioViaje.pasajeIntermunicipal.valor,
        valor_total: this.formularioViaje.pasajeIntermunicipal.cantidad * this.formularioViaje.pasajeIntermunicipal.valor
      });
    }

    items.push({
      id_concepto: 2, descripcion: 'Transporte Interno',
      cantidad: this.formularioViaje.transporteInterno.cantidad,
      valor_unitario: this.formularioViaje.transporteInterno.valor,
      valor_total: this.formularioViaje.transporteInterno.cantidad * this.formularioViaje.transporteInterno.valor
    });

    if (this.incluirAlimentacion && this.formularioViaje.alimentacion.valor > 0) {
      items.push({
        id_concepto: 3, descripcion: 'Alimentación',
        cantidad: this.formularioViaje.alimentacion.cantidad,
        valor_unitario: this.formularioViaje.alimentacion.valor,
        valor_total: this.formularioViaje.alimentacion.cantidad * this.formularioViaje.alimentacion.valor
      });
    }

    if (this.incluirHospedaje && this.formularioViaje.hospedaje.valor > 0) {
      items.push({
        id_concepto: 4, descripcion: 'Hospedaje',
        cantidad: this.formularioViaje.hospedaje.cantidad,
        valor_unitario: this.formularioViaje.hospedaje.valor,
        valor_total: this.formularioViaje.hospedaje.cantidad * this.formularioViaje.hospedaje.valor
      });
    }

    this.anticipoSolicitudService.crearSolicitud({
      id_empleado: this.usuarioSeleccionado!.id,
      id_ciudad_destino: this.ciudadSeleccionada!.id,
      fecha_salida: this.formatDate(this.formularioViaje.fechaSalida!),
      fecha_regreso: this.formatDate(this.formularioViaje.fechaRegreso!),
      motivo: this.formularioViaje.motivo,
      cobertura: this.formularioViaje.cobertura,
      items
    }).subscribe({
      next: (response: any) => {
        if (response?.success !== false) {
          this.toast('success', response?.message || 'Solicitud creada correctamente');
          this.cerrarNuevaSolicitud(); this.loadSolicitudes();
        }
      },
      error: (error) => this.toast('error', error.error?.message || 'No se pudo crear la solicitud')
    });
  }

  onFileSelect(event: any): void {
    const files = event.target.files;
    if (files?.length) { this.formularioOtros.archivos = Array.from(files); this.toast('success', `${files.length} archivo(s) seleccionado(s)`); }
  }

  onEmpleadoSeleccionado(empleado: EmpleadoUI | null): void {
    if (!empleado) return;
    if (!this.esEmpleadoActivo(empleado)) { this.toast('warn', 'El empleado seleccionado está inactivo'); this.usuarioSeleccionado = null; return; }
    this.usuarioSeleccionado = empleado;
    this.calcularTopesAutomatico();
  }

  // ── CONTEXTO / EMPRESA ────────────────────────────────────────────────────
  private iniciarContexto(): void {
    this.subscriptions.push(
      this.contextoService.contexto$.subscribe(ctx => { if (ctx) this.resolverEmpresaDesdeContexto(ctx); })
    );
    this.subscriptions.push(
      this.authService.currentUser$.subscribe(usuario => {
        if (!usuario) return;
        const ctx = this.contextoService.getContextoActual();
        if (ctx) this.resolverEmpresaDesdeContexto(ctx);
      })
    );
  }

  private resolverEmpresaDesdeContexto(ctx: any): void {
    const usuario = this.authService.currentUser;
    const empresasUsuario: number[] = (usuario?.empresas ?? []).map((e: any) => e.id);
    const empresaDelContexto = ctx?.empresa_id ?? null;
    let empresaResuelta: number | null = null;
    if (empresaDelContexto && (empresasUsuario.length === 0 || empresasUsuario.includes(empresaDelContexto))) {
      empresaResuelta = empresaDelContexto;
    } else {
      empresaResuelta = empresasUsuario[0] ?? usuario?.empresa?.id ?? null;
    }
    if (empresaResuelta && empresaResuelta !== this.empresaIdActual) {
      this.empresaIdActual = empresaResuelta;
      this.empleadosOptions = []; this.empleadosCargados = false;
      this.cargarEmpleadosEmpresa();
    }
  }

  private resolverEmpresaActual(): void {
    if (this.empresaIdActual) return;
    const ctx = this.contextoService.getContextoActual();
    if (ctx?.empresa_id) { this.empresaIdActual = ctx.empresa_id; return; }
    this.empresaIdActual = this.authService.currentUser?.empresa?.id ?? null;
  }

  private cargarEmpleadosEmpresa(): void {
    if (!this.empresaIdActual || this.isLoadingEmpleados || this.empleadosCargados) return;
    this.isLoadingEmpleados = true;
    this.personaService.buscarEmpleadosPaginados({
      empresaId: this.empresaIdActual, estado: true, page: 1, perPage: this.empleadosPerPage
    }).subscribe({
      next: (r) => {
        this.empleadosTotalPages = r.last_page;
        this.empleadosOptions = r.data.filter(e => e.estado !== false)
          .map(e => ({ label: `${e.nombre} - ${e.numero_identificacion}`, value: this.mapEmpleadoUI(e) }));
        this.isLoadingEmpleados = false; this.empleadosCargados = true;
      },
      error: () => { this.isLoadingEmpleados = false; this.toast('error', 'No se pudieron cargar los empleados'); }
    });
  }

  onBuscarEmpleado(termino: string): void {
    if (!this.empresaIdActual) { this.resolverEmpresaActual(); if (!this.empresaIdActual) return; }
    this.busquedaEmpleado$.next(termino ?? '');
  }

  private autocompletarEmpleadoActual(): void {
    if (!this.empresaIdActual) { this.toast('warn', 'No se pudo determinar la empresa'); this.esParaMi = false; return; }
    this.personaService.obtenerEmpleadoActual().subscribe({
      next: (empleado) => {
        if (empleado) {
          const ui = this.mapEmpleadoUI(empleado);
          if (!this.esEmpleadoActivo(ui)) { this.toast('warn', 'El empleado está inactivo'); this.esParaMi = false; return; }
          this.usuarioActual = ui; this.usuarioSeleccionado = { ...ui }; return;
        }
        this.autocompletarPorDatosUsuario();
      },
      error: () => this.autocompletarPorDatosUsuario()
    });
  }

  private autocompletarPorDatosUsuario(): void {
    const usuario = this.authService.currentUser;
    if (!usuario) { this.authService.me().subscribe({ next: (u) => this.buscarEmpleadoPorTermino(u) }); return; }
    this.buscarEmpleadoPorTermino(usuario);
  }

  private buscarEmpleadoPorTermino(usuario: any): void {
    if (!this.empresaIdActual) return;
    const termino = usuario?.numero_identificacion || usuario?.documento || usuario?.email || usuario?.name;
    if (!termino) { this.toast('warn', 'No se encontró información para identificar al empleado'); this.esParaMi = false; return; }
    this.personaService.buscarEmpleadosPaginados({ empresaId: this.empresaIdActual, termino, estado: true, page: 1, perPage: 5 }).subscribe({
      next: (r) => {
        if (!r.data.length) { this.toast('warn', 'No se encontró empleado asociado al usuario'); this.esParaMi = false; return; }
        const ui = this.mapEmpleadoUI(r.data[0]);
        if (!this.esEmpleadoActivo(ui)) { this.toast('warn', 'El empleado está inactivo'); this.esParaMi = false; return; }
        this.usuarioActual = ui; this.usuarioSeleccionado = { ...ui };
      },
      error: () => { this.toast('error', 'No se pudo autocompletar el empleado'); this.esParaMi = false; }
    });
  }

  // ── HELPERS ───────────────────────────────────────────────────────────────
  private mapEmpleadoUI(e: Empleado): EmpleadoUI {
    return {
      id: e.id, nombre: e.nombre, cedula: e.numero_identificacion,
      cargo: e.cargo_relacion?.nombre_cargo || 'Sin cargo', area: e.unidad || 'Sin unidad',
      email: e.email, raw: e
    };
  }

  private esEmpleadoActivo(e: EmpleadoUI): boolean { return e.raw.estado !== false; }

  private formatDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  formatCurrency(value: number | string): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(Number(value));
  }

  private toast(severity: string, detail: string): void {
    this.messageService.add({
      severity,
      summary: severity === 'error' ? 'Error' : severity === 'warn' ? 'Advertencia' : severity === 'info' ? 'Info' : 'Éxito',
      detail, life: 3500
    });
  }

  getSeverity(estado: string): 'success' | 'warn' | 'danger' | 'info' | 'secondary' {
    const map: Record<string, any> = {
      autorizado: 'success', en_viaje: 'success', legalizado: 'success', cerrado: 'secondary',
      pendiente_jefe: 'warn', pendiente_financiero: 'warn', pendiente_legalizacion: 'warn',
      pendiente_reintegro: 'warn', pendiente_excedente: 'warn', borrador: 'info',
      rechazado_jefe: 'danger', rechazado_financiero: 'danger', rechazado_excedente: 'danger'
    };
    return map[estado] ?? 'info';
  }

  getEstadoLabel(estado: string): string {
    const map: Record<string, string> = {
      borrador: 'Borrador', pendiente_jefe: 'Pendiente Jefe', rechazado_jefe: 'Rechazado Jefe',
      pendiente_financiero: 'Pendiente Financiero', rechazado_financiero: 'Rechazado Financiero',
      autorizado: 'Autorizado', en_viaje: 'En Viaje', pendiente_legalizacion: 'Pend. Legalización',
      legalizado: 'Legalizado', pendiente_reintegro: 'Pend. Reintegro', reintegrado: 'Reintegrado',
      pendiente_excedente: 'Pend. Excedente', aprobado_excedente: 'Excedente Aprobado',
      rechazado_excedente: 'Excedente Rechazado', cerrado: 'Cerrado'
    };
    return map[estado] ?? estado;
  }
}
