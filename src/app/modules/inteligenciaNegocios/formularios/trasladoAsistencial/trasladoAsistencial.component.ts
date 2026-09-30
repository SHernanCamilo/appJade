import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { DropdownModule } from 'primeng/dropdown';
import { MessageService } from 'primeng/api';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../../auth/auth.service';
import { EmpresaService } from '../../../organizacion/empresa/services/empresa.service';
import { SinDatoDirective } from './sin-dato.directive';
import { TrasladoAsistencialService } from './services/traslado-asistencial.service';
import { TrasladoAsistencialExportService } from './services/traslado-asistencial-export.service';
import { TrasladoAsistencialPdfService } from './services/traslado-asistencial-pdf.service';
import { FormParametrosService } from '../parametros/services/form-parametros.service';
import { handleFabricError } from '../../helpers/fabric-error.helper';
import {
  catalogoPorTipoTraslado
} from '../parametros/catalogs/formularios-parametrizables.catalog';
import {
  CampoParametro,
  camposAMapa,
  mergeCamposCatalogo,
  OpcionCatalogoCampo
} from '../parametros/models/form-parametros.model';
import {
  CAUSAS_ATENCION,
  crearHistoriaVacia,
  CUPS_TRASLADO_PRIMARIO,
  glasgowTotal,
  GRUPOS_ATENCION_ESPECIAL,
  GRUPOS_SERVICIO_TRASLADO,
  GlasgowTraslado,
  HistoriaTrasladoAsistencial,
  MedicamentoTrasladoFila,
  ProcedimientoTrasladoFila,
  RegistroTrasladoLista,
  TipoTrasladoAsistencial
} from './models/traslado-asistencial.model';

@Component({
  selector: 'app-traslado-asistencial',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ToastModule, TooltipModule, TableModule, TagModule, DropdownModule, SinDatoDirective],
  providers: [MessageService],
  templateUrl: './trasladoAsistencial.component.html',
  styleUrl: './trasladoAsistencial.component.css',
  encapsulation: ViewEncapsulation.None
})
export class TrasladoAsistencialComponent implements OnInit {
  @ViewChild('docPacienteInput') docPacienteInput?: ElementRef<HTMLInputElement>;

  private readonly medilaserEmpresaId = 1;
  private readonly medilaserLogoUrl =
    'https://ticketprocess.medilaser.com.co/assets/images/Logo-Medilaser-grande.png';

  readonly gruposServicio = GRUPOS_SERVICIO_TRASLADO;
  readonly gruposAtencion = GRUPOS_ATENCION_ESPECIAL;
  readonly causasAtencion = CAUSAS_ATENCION;

  readonly glasgowMotora = [
    { valor: 6, label: 'Órdenes' },
    { valor: 5, label: 'Localiza' },
    { valor: 4, label: 'Retira' },
    { valor: 3, label: 'Flexión anormal' },
    { valor: 2, label: 'Extensión anormal' },
    { valor: 1, label: 'No hay' }
  ];

  readonly glasgowVerbal = [
    { valor: 5, label: 'Orientada' },
    { valor: 4, label: 'Confusa' },
    { valor: 3, label: 'Inapropiado' },
    { valor: 2, label: 'Incomprensible' },
    { valor: 1, label: 'No hay' }
  ];

  readonly glasgowOcular = [
    { valor: 4, label: 'Espontánea' },
    { valor: 3, label: 'Al llamado' },
    { valor: 2, label: 'Al dolor' },
    { valor: 1, label: 'No hay' }
  ];

  tipo: TipoTrasladoAsistencial | null = null;
  form: HistoriaTrasladoAsistencial = crearHistoriaVacia();
  logoUrl: string | null = null;
  empresaNombre = 'Clínica Medilaser S.A.S.';
  registros: RegistroTrasladoLista[] = [];
  registroId: number | null = null;
  estadoRegistro: 'guardado' | 'confirmado' | null = null;
  isSaving = false;
  isConfirming = false;
  isExporting = false;
  isExportingPdf = false;
  isLoadingRegistros = false;
  isBuscandoPaciente = false;
  isBuscandoProfesional = false;
  /** true = el usuario puede editar DATOS DE LA PERSONA (Fabric no halló o falló). */
  personaManual = false;
  profesionalManual = false;
  /** El auxiliar es quien diligencia; se bloquea tras autollenar. */
  auxiliarEsDiligenciador = false;
  private paramsPrimario = new Map<string, CampoParametro>();
  private paramsSecundario = new Map<string, CampoParametro>();
  private ultimaBusquedaDoc = '';
  private ultimaBusquedaEstado: 'found' | 'missing' | 'error' | null = null;
  private ultimaBusquedaProfDoc = '';
  private ultimaBusquedaProfEstado: 'found' | 'missing' | 'error' | null = null;

  constructor(
    private readonly empresaService: EmpresaService,
    private readonly trasladoService: TrasladoAsistencialService,
    private readonly exportService: TrasladoAsistencialExportService,
    private readonly pdfService: TrasladoAsistencialPdfService,
    private readonly formParametros: FormParametrosService,
    private readonly authService: AuthService,
    private readonly messageService: MessageService,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.paramsPrimario = camposAMapa(mergeCamposCatalogo(catalogoPorTipoTraslado('primario'), null));
    this.paramsSecundario = camposAMapa(mergeCamposCatalogo(catalogoPorTipoTraslado('secundario'), null));
  }

  ngOnInit(): void {
    this.cargarRegistros();
    this.cargarParametros();
  }

  get tituloFormulario(): string {
    if (this.tipo === 'secundario' || this.tipo === 'secundarioCompleto') {
      return 'HISTORIA CLÍNICA EN EL TRASLADO SECUNDARIO ASISTENCIAL';
    }
    if (this.tipo === 'primario') {
      return 'HOJA DE TRASLADO PRIMARIO ASISTENCIAL DE PERSONAS';
    }
    return 'HISTORIA CLÍNICA EN EL TRASLADO PRIMARIO ASISTENCIAL';
  }

  get codigoFormulario(): string {
    if (this.tipo === 'secundario') {
      return 'Res. 2284 / 2023';
    }
    if (this.tipo === 'secundarioCompleto') {
      return 'F-AU-1165 MD';
    }
    if (this.tipo === 'primario') {
      return 'Res. 2284 / 2023';
    }
    return 'F-AU-1164 MD';
  }

  get esFormatoCompleto(): boolean {
    return this.tipo === 'primarioCompleto' || this.tipo === 'secundarioCompleto';
  }

  get esPrimario(): boolean {
    return this.tipo === 'primario' || this.tipo === 'primarioCompleto';
  }

  get esSecundario(): boolean {
    return this.tipo === 'secundario' || this.tipo === 'secundarioCompleto';
  }

  esRegistroCompleto(row: RegistroTrasladoLista): boolean {
    return row.formato === 'primarioCompleto' || row.formato === 'secundarioCompleto';
  }

  get glasgowInicioTotal(): number | '' {
    return glasgowTotal(this.form.glasgow);
  }

  get esConfirmado(): boolean {
    return this.estadoRegistro === 'confirmado';
  }

  get destacarDocumentoPaciente(): boolean {
    return this.tipo === 'primario' && !this.esConfirmado && !this.ultimaBusquedaEstado;
  }

  auxiliarCampoBloqueado(): boolean {
    return this.esConfirmado || this.auxiliarEsDiligenciador;
  }

  profesionalCampoBloqueado(key: string): boolean {
    if (this.esConfirmado) {
      return true;
    }
    if (key === 'profesionalDestino1Cc') {
      return this.isBuscandoProfesional;
    }
    if (this.ultimaBusquedaProfEstado === 'found') {
      return key === 'profesionalDestino1' || key === 'profesionalRecibeTipoId';
    }
    if (this.profesionalManual) {
      return false;
    }
    return true;
  }

  /** En primario: el documento siempre es editable; si hay paciente, nombres y tipo de documento quedan fijos. */
  personaCampoBloqueado(key: string): boolean {
    if (this.esConfirmado) {
      return true;
    }
    if (this.tipo !== 'primario') {
      return false;
    }
    if (key === 'numeroIdentificacion') {
      return this.isBuscandoPaciente;
    }

    const identidadFija = key === 'nombresApellidos'
      || key === 'tipoIdentificacion'
      || key === 'tipoIdentificacionOtro';

    if (this.ultimaBusquedaEstado === 'found') {
      return identidadFija;
    }
    if (this.personaManual) {
      return false;
    }
    return true;
  }

  campoVisible(key: string): boolean {
    return this.paramsActuales().get(key)?.visible !== false;
  }

  campoRequerido(key: string): boolean {
    const cfg = this.paramsActuales().get(key);
    if (!cfg?.visible || !cfg?.requerido) {
      return false;
    }
    if (key === 'causaAtencionOtra') {
      return this.estaEnLista(this.form.causaAtencion, 'Otra');
    }
    if (key === 'tipoIdentificacionOtro') {
      return this.form.tipoIdentificacion === 'otro';
    }
    return true;
  }

  campoLabel(key: string, fallback: string): string {
    return this.paramsActuales().get(key)?.label || fallback;
  }

  opcionesCampo(key: string): OpcionCatalogoCampo[] {
    return this.paramsActuales().get(key)?.opciones ?? [];
  }

  tieneOpciones(key: string): boolean {
    return this.opcionesCampo(key).length > 0;
  }

  aplicarOpcionProcedimiento(fila: ProcedimientoTrasladoFila, codigo: string): void {
    const op = this.opcionesCampo('procedimientos').find(o => o.codigo === codigo);
    fila.cupsProcedimientos = codigo ?? '';
    fila.procedimientos = op?.descripcion ?? '';
  }

  aplicarOpcionMedicamento(med: MedicamentoTrasladoFila, codigo: string): void {
    const op = this.opcionesCampo('medicamentos').find(o => o.codigo === codigo);
    med.codigoCumIum = codigo ?? '';
    med.nombre = op?.descripcion ?? '';
  }

  codigoOpcion(sel: unknown): string {
    if (sel && typeof sel === 'object' && 'codigo' in sel) {
      return String((sel as OpcionCatalogoCampo).codigo ?? '');
    }
    return String(sel ?? '');
  }

  seccionVisible(seccion: string): boolean {
    return catalogoPorTipoTraslado(this.tipo)
      .filter(c => c.seccion === seccion)
      .some(c => this.campoVisible(c.key));
  }

  algunoVisible(...keys: string[]): boolean {
    return keys.some(key => this.campoVisible(key));
  }

  algunoRequerido(...keys: string[]): boolean {
    return keys.some(key => this.campoRequerido(key));
  }

  reiniciarEstadoPacienteFabric(): void {
    this.personaManual = false;
    this.isBuscandoPaciente = false;
    this.ultimaBusquedaDoc = '';
    this.ultimaBusquedaEstado = null;
  }

  reiniciarEstadoProfesionalFabric(): void {
    this.profesionalManual = false;
    this.isBuscandoProfesional = false;
    this.ultimaBusquedaProfDoc = '';
    this.ultimaBusquedaProfEstado = null;
  }

  actualizarEdadPorNacimiento(): void {
    const raw = (this.form.fechaNacimiento ?? '').trim();
    if (!raw) {
      this.form.edad = '';
      this.form.edadUnidad = '';
      return;
    }

    const nacimiento = this.parseFechaLocal(raw);
    if (!nacimiento) {
      return;
    }

    const edad = this.edadDesdeFecha(nacimiento);
    this.form.edad = edad.valor;
    this.form.edadUnidad = edad.unidad;
  }

  seleccionarTipo(tipo: TipoTrasladoAsistencial): void {
    this.tipo = tipo;
    this.form = crearHistoriaVacia(tipo);
    this.registroId = null;
    this.estadoRegistro = null;
    this.reiniciarEstadoPacienteFabric();
    this.reiniciarEstadoProfesionalFabric();
    this.aplicarDiligenciadorComoAuxiliar();
    void this.cargarLogoMedilaser();
    if (tipo === 'primario') {
      setTimeout(() => this.docPacienteInput?.nativeElement.focus(), 0);
    }
  }

  volverSeleccion(): void {
    this.tipo = null;
    this.registroId = null;
    this.estadoRegistro = null;
    this.auxiliarEsDiligenciador = false;
    this.reiniciarEstadoPacienteFabric();
    this.reiniciarEstadoProfesionalFabric();
    this.cargarRegistros();
  }

  toggleLista(lista: string[], valor: string): void {
    const idx = lista.indexOf(valor);
    if (idx >= 0) {
      lista.splice(idx, 1);
    } else {
      lista.push(valor);
    }
    if (lista === this.form.causaAtencion && valor === 'Otra' && idx >= 0) {
      this.form.causaAtencionOtra = '';
    }
  }

  seleccionarCausa(valor: string): void {
    this.form.causaAtencion = [valor];
    if (valor !== 'Otra') {
      this.form.causaAtencionOtra = '';
    }
  }

  estaEnLista(lista: string[], valor: string): boolean {
    return lista.includes(valor);
  }

  setGlasgow(campo: keyof GlasgowTraslado, valor: number): void {
    this.form.glasgow[campo] = this.form.glasgow[campo] === valor ? null : valor;
  }

  async buscarPacienteFabric(): Promise<void> {
    if (this.tipo !== 'primario' || this.esConfirmado || this.isBuscandoPaciente) {
      return;
    }

    const doc = this.form.numeroIdentificacion.trim();
    if (!doc) {
      this.limpiarDatosPersona();
      this.reiniciarEstadoPacienteFabric();
      this.cdr.detectChanges();
      return;
    }

    if (
      doc === this.ultimaBusquedaDoc
      && (this.ultimaBusquedaEstado === 'found' || this.ultimaBusquedaEstado === 'missing')
    ) {
      return;
    }

    this.isBuscandoPaciente = true;
    this.limpiarDatosPersona();
    this.cdr.detectChanges();

    try {
      const row = await firstValueFrom(this.trasladoService.buscarPaciente(doc));
      this.ultimaBusquedaDoc = doc;
      if (!row) {
        this.habilitarPersonaManual('No se encontró el paciente. Puede diligenciar los datos.');
        this.ultimaBusquedaEstado = 'missing';
        return;
      }

      this.aplicarPacienteFabric(row);
      this.personaManual = false;
      this.ultimaBusquedaEstado = 'found';
      this.messageService.add({
        severity: 'success',
        summary: 'Paciente encontrado',
        detail: this.form.nombresApellidos || doc,
        life: 3500
      });
    } catch (err) {
      this.ultimaBusquedaDoc = doc;
      this.ultimaBusquedaEstado = 'error';
      const detail = err instanceof HttpErrorResponse
        ? handleFabricError(err)
        : 'No se pudo consultar Fabric. Puede diligenciar los datos.';
      this.habilitarPersonaManual(detail);
    } finally {
      this.isBuscandoPaciente = false;
      this.cdr.detectChanges();
    }
  }

  async buscarProfesionalFabric(): Promise<void> {
    if (this.esConfirmado || this.isBuscandoProfesional) {
      return;
    }

    const doc = this.form.profesionalDestino1Cc.trim();
    if (!doc) {
      this.limpiarDatosProfesional();
      this.reiniciarEstadoProfesionalFabric();
      this.cdr.detectChanges();
      return;
    }

    if (
      doc === this.ultimaBusquedaProfDoc
      && (this.ultimaBusquedaProfEstado === 'found' || this.ultimaBusquedaProfEstado === 'missing')
    ) {
      return;
    }

    this.isBuscandoProfesional = true;
    this.limpiarDatosProfesional();
    this.cdr.detectChanges();

    try {
      const row = await firstValueFrom(this.trasladoService.buscarProfesional(doc));
      this.ultimaBusquedaProfDoc = doc;
      if (!row) {
        this.profesionalManual = true;
        this.ultimaBusquedaProfEstado = 'missing';
        this.messageService.add({
          severity: 'warn',
          summary: 'Diligencie los datos',
          detail: 'No se encontró el profesional. Puede diligenciar los datos.',
          life: 5000
        });
        return;
      }

      this.aplicarProfesionalFabric(row);
      this.profesionalManual = false;
      this.ultimaBusquedaProfEstado = 'found';
      this.messageService.add({
        severity: 'success',
        summary: 'Profesional encontrado',
        detail: this.form.profesionalDestino1 || doc,
        life: 3500
      });
    } catch (err) {
      this.ultimaBusquedaProfDoc = doc;
      this.ultimaBusquedaProfEstado = 'error';
      this.profesionalManual = true;
      const detail = err instanceof HttpErrorResponse
        ? handleFabricError(err)
        : 'No se pudo consultar Fabric. Puede diligenciar los datos.';
      this.messageService.add({
        severity: 'warn',
        summary: 'Diligencie los datos',
        detail,
        life: 5000
      });
    } finally {
      this.isBuscandoProfesional = false;
      this.cdr.detectChanges();
    }
  }

  private habilitarPersonaManual(detail: string): void {
    this.personaManual = true;
    this.messageService.add({
      severity: 'warn',
      summary: 'Diligencie los datos',
      detail,
      life: 5000
    });
  }

  private aplicarProfesionalFabric(row: Record<string, unknown>): void {
    const nombres = this.pickValue(row, [
      'Medico', 'Profesional', 'NombreCompleto', 'NombreProfesional', 'Nombre'
    ]);
    const apellidos = this.pickValue(row, ['Apellidos']);
    const nombrePartes = this.pickValue(row, ['Nombres']);
    this.form.profesionalDestino1 = nombres || [nombrePartes, apellidos].filter(Boolean).join(' ').trim();

    const tipoRaw = this.pickValue(row, [
      'TipoIdentificacion', 'TipoDocumento', 'TipoId', 'Tipo_Identificacion'
    ]);
    const tipo = this.mapTipoIdentificacion(tipoRaw);
    this.form.profesionalRecibeTipoId = tipo === 'ce' || tipo === 'otro' ? tipo : 'cc';
  }

  private limpiarDatosProfesional(): void {
    this.form.profesionalDestino1 = '';
    this.form.profesionalRecibeTipoId = '';
  }

  private aplicarPacienteFabric(row: Record<string, unknown>): void {
    const nombres = this.pickValue(row, ['Paciente', 'NombreCompleto', 'NombrePaciente', 'Nombre']);
    const apellidos = this.pickValue(row, ['Apellidos']);
    const nombrePartes = this.pickValue(row, ['Nombres']);
    this.form.nombresApellidos = nombres || [nombrePartes, apellidos].filter(Boolean).join(' ').trim();

    const tipoRaw = this.pickValue(row, ['TipoIdentificacion', 'TipoDocumento', 'TipoId', 'Tipo_Identificacion']);
    const tipo = this.mapTipoIdentificacion(tipoRaw);
    this.form.tipoIdentificacion = tipo;
    this.form.tipoIdentificacionOtro = tipo === 'otro' ? tipoRaw : '';

    this.form.sexo = this.mapSexo(this.pickValue(row, ['Sexo', 'Genero', 'SexoBiologico', 'Sexo_Biologico']));

    const nacimiento = this.parseFecha(this.pickValue(row, [
      'FechaNacimiento', 'Fecha_Nacimiento', 'Fnacimiento', 'FecNacimiento'
    ]));
    this.form.fechaNacimiento = nacimiento ? this.formatoFechaInput(nacimiento) : '';
    this.actualizarEdadPorNacimiento();
    if (!this.form.edad) {
      const edad = this.resolverEdad(row);
      this.form.edad = edad.valor;
      this.form.edadUnidad = edad.unidad;
    }
    this.form.lugarExpedicion = this.pickValue(row, ['LugarExpedicion', 'Expedicion', 'Lugar_Expedicion']);
    this.form.ocupacion = this.pickValue(row, ['Ocupacion', 'Ocupación']);
    this.form.telefono = this.pickValue(row, ['Telefono', 'Teléfono', 'Celular', 'Telefono1']);
    this.form.estadoCivil = this.pickValue(row, ['EstadoCivil', 'Estado_Civil']);
    this.form.correoEmail = this.pickValue(row, ['Email', 'Correo', 'CorreoElectronico', 'Mail']);
    this.form.direccionResidencia = this.pickValue(row, ['Direccion', 'DireccionResidencia', 'Dirección']);
    this.form.zonaResidencia = this.mapZonaResidencia(this.pickValue(row, ['Zona', 'ZonaResidencia', 'Zona_Residencia']));
  }

  private formatoFechaInput(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private mapZonaResidencia(raw: string): HistoriaTrasladoAsistencial['zonaResidencia'] {
    const v = raw.toLowerCase();
    if (v.includes('urb')) {
      return 'urbano';
    }
    if (v.includes('rur')) {
      return 'rural';
    }
    return '';
  }

  /**
   * Fabric a veces manda Edad como serial de fecha (ej. 46049 = ~ene 2026),
   * no como años. Si el número no es una edad creíble, se calcula desde
   * FechaNacimiento.
   */
  private resolverEdad(row: Record<string, unknown>): {
    valor: string;
    unidad: HistoriaTrasladoAsistencial['edadUnidad'];
  } {
    const nacimiento = this.parseFecha(this.pickValue(row, [
      'FechaNacimiento', 'Fecha_Nacimiento', 'Fnacimiento', 'FecNacimiento'
    ]));
    if (nacimiento) {
      return this.edadDesdeFecha(nacimiento);
    }

    const edadRaw = this.pickValue(row, ['Edad', 'EdadAnos', 'EdadAños']);
    const comoFecha = this.parseFecha(edadRaw);
    if (comoFecha) {
      return this.edadDesdeFecha(comoFecha);
    }

    const numero = Number(String(edadRaw).replace(',', '.'));
    if (Number.isFinite(numero) && numero >= 0 && numero <= 150) {
      return { valor: String(Math.floor(numero)), unidad: this.mapEdadUnidad(edadRaw) || 'anos' };
    }

    return { valor: '', unidad: '' };
  }

  private parseFecha(raw: string): Date | null {
    const text = raw.trim();
    if (!text) {
      return null;
    }

    const iso = Date.parse(text);
    if (!Number.isNaN(iso)) {
      const d = new Date(iso);
      return this.esFechaNacimiento(d) ? d : null;
    }

    const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmy) {
      const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
      return this.esFechaNacimiento(d) ? d : null;
    }

    const serial = Number(text.replace(',', '.'));
    if (Number.isFinite(serial) && serial > 20000 && serial < 80000) {
      const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
      return this.esFechaNacimiento(d) ? d : null;
    }

    return null;
  }

  private esFechaNacimiento(d: Date): boolean {
    if (Number.isNaN(d.getTime())) {
      return false;
    }
    const y = d.getUTCFullYear();
    return y >= 1900 && y <= new Date().getFullYear();
  }

  private parseFechaLocal(raw: string): Date | null {
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
      return this.esFechaNacimiento(d) ? d : null;
    }
    return this.parseFecha(raw);
  }

  /**
   * 0–30 días → Días (incluye 0–7 y 8–30).
   * Más de 30 días y menos de 12 meses → Meses.
   * 12 meses o más → Años.
   */
  private edadDesdeFecha(nacimiento: Date): {
    valor: string;
    unidad: HistoriaTrasladoAsistencial['edadUnidad'];
  } {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const nac = new Date(nacimiento.getFullYear(), nacimiento.getMonth(), nacimiento.getDate());
    const dias = Math.floor((hoy.getTime() - nac.getTime()) / 86400000);
    if (dias < 0) {
      return { valor: '', unidad: '' };
    }

    if (dias <= 30) {
      return { valor: String(dias), unidad: 'dias' };
    }

    let meses = (hoy.getFullYear() - nac.getFullYear()) * 12 + (hoy.getMonth() - nac.getMonth());
    if (hoy.getDate() < nac.getDate()) {
      meses--;
    }
    meses = Math.max(meses, 1);

    if (meses < 12) {
      return { valor: String(meses), unidad: 'meses' };
    }

    let anos = hoy.getFullYear() - nac.getFullYear();
    if (
      hoy.getMonth() < nac.getMonth()
      || (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate())
    ) {
      anos--;
    }
    return { valor: String(Math.max(anos, 1)), unidad: 'anos' };
  }

  private limpiarDatosPersona(): void {
    this.form.nombresApellidos = '';
    this.form.tipoIdentificacion = '';
    this.form.tipoIdentificacionOtro = '';
    this.form.lugarExpedicion = '';
    this.form.fechaNacimiento = '';
    this.form.edad = '';
    this.form.edadUnidad = '';
    this.form.sexo = '';
    this.form.ocupacion = '';
    this.form.telefono = '';
    this.form.estadoCivil = '';
    this.form.correoEmail = '';
    this.form.direccionResidencia = '';
    this.form.zonaResidencia = '';
  }

  private pickValue(row: Record<string, unknown>, aliases: string[]): string {
    const keys = Object.keys(row);
    for (const alias of aliases) {
      const found = keys.find(k => k.toLowerCase() === alias.toLowerCase());
      if (found == null) {
        continue;
      }
      const value = String(row[found] ?? '').trim();
      if (value !== '') {
        return value;
      }
    }
    return '';
  }

  private aplicarDiligenciadorComoAuxiliar(): void {
    const aplicar = (user: unknown): void => {
      const datos = this.datosDiligenciador(user);
      if (!datos.nombre && !datos.documento) {
        this.auxiliarEsDiligenciador = false;
        this.cdr.detectChanges();
        return;
      }
      this.form.auxiliar1 = {
        ...this.form.auxiliar1,
        nombre: datos.nombre || this.form.auxiliar1.nombre,
        tipoDocumento: datos.tipo || this.form.auxiliar1.tipoDocumento,
        documento: datos.documento || this.form.auxiliar1.documento
      };
      this.auxiliarEsDiligenciador = true;
      this.cdr.detectChanges();
    };

    const user = this.authService.currentUser;
    if (user) {
      aplicar(user);
      return;
    }
    this.authService.me().subscribe({ next: aplicar, error: () => {
      this.auxiliarEsDiligenciador = false;
    } });
  }

  private datosDiligenciador(user: unknown): { nombre: string; tipo: string; documento: string } {
    const u = (user ?? {}) as Record<string, unknown>;
    const nombre = String(
      u['nombre_completo'] ||
      u['nombre'] ||
      u['name'] ||
      [u['nombres'], u['apellidos']].filter(Boolean).join(' ') ||
      ''
    ).trim();
    const documento = String(u['numero_identificacion'] || u['documento'] || '').trim();
    const mapped = this.mapTipoIdentificacion(String(u['tipo_identificacion'] || ''));
    let tipo = '';
    if (mapped === 'cc' || mapped === 'ce' || mapped === 'otro') {
      tipo = mapped;
    } else if (mapped) {
      tipo = 'otro';
    } else if (documento) {
      tipo = 'cc';
    }
    return { nombre, tipo, documento };
  }

  private mapTipoIdentificacion(
    raw: string
  ): HistoriaTrasladoAsistencial['tipoIdentificacion'] {
    const v = raw.toLowerCase().replace(/[\s.]/g, '');
    if (v === 'as') return 'as';
    if (v === 'ms' || v === 'msi') return 'ms';
    if (v === 'rc' || v.includes('registro')) return 'rc';
    if (v === 'ti' || v.includes('tarjeta')) return 'ti';
    if (v === 'cc' || (v.includes('cedula') && !v.includes('extranj'))) return 'cc';
    if (v === 'ce' || v.includes('extranj')) return 'ce';
    return raw ? 'otro' : '';
  }

  private mapSexo(raw: string): HistoriaTrasladoAsistencial['sexo'] {
    const v = raw.toLowerCase();
    if (v.startsWith('f') || v.includes('femen')) {
      return 'femenino';
    }
    if (v.startsWith('m') || v.includes('masc')) {
      return 'masculino';
    }
    return '';
  }

  private mapEdadUnidad(raw: string): HistoriaTrasladoAsistencial['edadUnidad'] {
    const v = raw.toLowerCase();
    if (v.includes('mes')) return 'meses';
    if (v.includes('dia') || v.includes('día')) return 'dias';
    if (v.includes('hora')) return 'horas';
    return raw ? 'anos' : '';
  }

  async exportarExcel(): Promise<void> {
    if (!this.tipo || this.isExporting || !this.esConfirmado) {
      return;
    }

    this.isExporting = true;
    try {
      const logoDataUrl = await this.resolveLogoDataUrl();
      if (!logoDataUrl) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Logo no incluido',
          detail: 'No se pudo obtener el logo de la empresa; el Excel se genera sin imagen.',
          life: 5000
        });
      }

      const filename = await this.exportService.exportar({
        tipo: this.tipo,
        form: this.form,
        titulo: this.tituloFormulario,
        codigo: this.codigoFormulario,
        empresaNombre: this.empresaNombre,
        logoDataUrl
      });

      this.messageService.add({
        severity: 'success',
        summary: 'Excel generado',
        detail: filename,
        life: 5000
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'No se pudo generar el archivo Excel.';
      this.messageService.add({
        severity: 'error',
        summary: 'Error al exportar',
        detail,
        life: 6000
      });
    } finally {
      this.isExporting = false;
      this.cdr.detectChanges();
    }
  }

  async exportarPdf(): Promise<void> {
    if (!this.tipo || this.isExportingPdf || !this.esConfirmado) {
      return;
    }

    this.isExportingPdf = true;
    try {
      const logoDataUrl = await this.resolveLogoDataUrl();
      const filename = await this.pdfService.exportar({
        tipo: this.tipo,
        form: this.form,
        titulo: this.tituloFormulario,
        codigo: this.codigoFormulario,
        empresaNombre: this.empresaNombre,
        logoDataUrl
      });

      this.messageService.add({
        severity: 'success',
        summary: 'PDF generado',
        detail: filename,
        life: 5000
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'No se pudo generar el archivo PDF.';
      this.messageService.add({
        severity: 'error',
        summary: 'Error al exportar',
        detail,
        life: 6000
      });
    } finally {
      this.isExportingPdf = false;
      this.cdr.detectChanges();
    }
  }

  limpiar(): void {
    if (this.esConfirmado) {
      return;
    }
    this.form = crearHistoriaVacia(this.tipo);
    this.reiniciarEstadoPacienteFabric();
    this.reiniciarEstadoProfesionalFabric();
    this.aplicarDiligenciadorComoAuxiliar();
    this.messageService.add({
      severity: 'info',
      summary: 'Formulario limpio',
      detail: 'Se reiniciaron todos los campos.',
      life: 3000
    });
  }

  async guardar(): Promise<void> {
    if (!this.tipo || this.isSaving || this.esConfirmado) {
      return;
    }
    if (!this.validarRequeridos()) {
      return;
    }

    this.isSaving = true;
    try {
      const saved = this.registroId
        ? await firstValueFrom(this.trasladoService.actualizar(this.registroId, this.buildPayload()))
        : await firstValueFrom(this.trasladoService.guardar(this.buildPayload()));

      this.registroId = saved.id;
      this.estadoRegistro = saved.estado;
      this.messageService.add({
        severity: 'success',
        summary: 'Guardado',
        detail: 'El traslado quedó en estado guardado.',
        life: 4000
      });
    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: 'No se pudo guardar',
        detail: this.errorDetail(err, 'Ocurrió un error al guardar el traslado.'),
        life: 6000
      });
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }

  async confirmar(): Promise<void> {
    if (!this.tipo || this.isConfirming || this.esConfirmado) {
      return;
    }
    if (!this.validarRequeridos()) {
      return;
    }

    this.isConfirming = true;
    try {
      let id = this.registroId;
      if (!id) {
        const saved = await firstValueFrom(this.trasladoService.guardar(this.buildPayload()));
        id = saved.id;
        this.registroId = id;
      }

      const confirmed = await firstValueFrom(
        this.trasladoService.confirmar(id, this.buildPayload())
      );
      this.registroId = confirmed.id;
      this.estadoRegistro = confirmed.estado;
      this.messageService.add({
        severity: 'success',
        summary: 'Confirmado',
        detail: 'El traslado quedó confirmado.',
        life: 4500
      });
    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: 'No se pudo confirmar',
        detail: this.errorDetail(err, 'Ocurrió un error al confirmar el traslado.'),
        life: 6000
      });
    } finally {
      this.isConfirming = false;
      this.cdr.detectChanges();
    }
  }

  abrirRegistro(row: RegistroTrasladoLista): void {
    this.trasladoService.obtener(row.id).subscribe({
      next: (detalle) => {
        this.tipo = (detalle.formato as TipoTrasladoAsistencial) || (detalle.tipo === 'secundario' ? 'secundario' : 'primario');
        this.form = { ...crearHistoriaVacia(this.tipo), ...(detalle.datos ?? {}) };
        if (
          (this.tipo === 'primario' || this.tipo === 'primarioCompleto')
          && !this.form.cupsTraslado?.trim()
        ) {
          this.form.cupsTraslado = CUPS_TRASLADO_PRIMARIO;
        }
        this.registroId = detalle.id;
        this.estadoRegistro = detalle.estado;
        this.personaManual = !this.esConfirmado;
        this.auxiliarEsDiligenciador = false;
        if (!this.form.auxiliar1?.nombre?.trim() && !this.form.auxiliar1?.documento?.trim()) {
          this.aplicarDiligenciadorComoAuxiliar();
        }
        this.ultimaBusquedaDoc = this.form.numeroIdentificacion.trim();
        this.ultimaBusquedaEstado = this.ultimaBusquedaDoc ? 'found' : null;
        this.ultimaBusquedaProfDoc = this.form.profesionalDestino1Cc.trim();
        this.ultimaBusquedaProfEstado = this.ultimaBusquedaProfDoc ? 'found' : null;
        this.profesionalManual = !this.esConfirmado && !this.ultimaBusquedaProfDoc;
        void this.cargarLogoMedilaser();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo abrir',
          detail: this.errorDetail(err, 'Ocurrió un error al cargar el registro.'),
          life: 6000
        });
      }
    });
  }

  private cargarParametros(): void {
    this.formParametros.obtener('traslado-primario').subscribe(campos => {
      this.paramsPrimario = camposAMapa(mergeCamposCatalogo(catalogoPorTipoTraslado('primario'), campos));
      this.cdr.detectChanges();
    });
    this.formParametros.obtener('traslado-secundario').subscribe(campos => {
      this.paramsSecundario = camposAMapa(mergeCamposCatalogo(catalogoPorTipoTraslado('secundario'), campos));
      this.cdr.detectChanges();
    });
  }

  private paramsActuales(): Map<string, CampoParametro> {
    return this.tipo === 'secundario' ? this.paramsSecundario : this.paramsPrimario;
  }

  private validarRequeridos(): boolean {
    if (this.tipo !== 'primario' && this.tipo !== 'secundario') {
      return true;
    }

    const faltantes = catalogoPorTipoTraslado(this.tipo)
      .filter(c => this.campoRequerido(c.key) && this.estaVacio(this.valorPorKey(c.key)))
      .map(c => this.campoLabel(c.key, c.label));

    if (!faltantes.length) {
      return true;
    }

    const preview = faltantes.slice(0, 4).join(', ');
    this.messageService.add({
      severity: 'warn',
      summary: 'Campos requeridos',
      detail: faltantes.length > 4 ? `${preview} y ${faltantes.length - 4} más.` : preview,
      life: 6000
    });
    return false;
  }

  private valorPorKey(key: string): unknown {
    return key.split('.').reduce((acc: unknown, part) => {
      if (acc == null || typeof acc !== 'object') {
        return undefined;
      }
      return (acc as Record<string, unknown>)[part];
    }, this.form);
  }

  private estaVacio(valor: unknown): boolean {
    if (valor == null) {
      return true;
    }
    if (typeof valor === 'string') {
      return valor.trim() === '';
    }
    if (Array.isArray(valor)) {
      return valor.length === 0 || valor.every(item => this.estaVacio(item));
    }
    if (typeof valor === 'object') {
      return Object.values(valor as Record<string, unknown>).every(item => this.estaVacio(item));
    }
    return false;
  }

  private cargarRegistros(): void {
    this.isLoadingRegistros = true;
    this.trasladoService.listar().subscribe({
      next: (rows) => {
        this.registros = rows;
        this.isLoadingRegistros = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.registros = [];
        this.isLoadingRegistros = false;
        this.cdr.detectChanges();
      }
    });
  }

  private buildPayload() {
    if (!this.tipo) {
      throw new Error('Debe seleccionar el tipo de formulario.');
    }

    return {
      formato: this.tipo,
      datos: this.form,
      fecha_atencion: this.form.fechaAtencion || null,
      nombres_apellidos: this.form.nombresApellidos || null,
      tipo_identificacion: this.form.tipoIdentificacion || null,
      numero_identificacion: this.form.numeroIdentificacion || null,
      estado_paciente: this.form.estadoFinal || null
    };
  }

  private errorDetail(err: unknown, fallback: string): string {
    const httpErr = err as { error?: { message?: string } };
    return httpErr?.error?.message || fallback;
  }

  onLogoError(): void {
    if (this.logoUrl?.startsWith('data:image')) {
      return;
    }
    this.logoUrl = null;
    this.cdr.detectChanges();
  }

  private async resolveLogoDataUrl(): Promise<string | null> {
    if (this.logoUrl?.startsWith('data:image') && !this.logoUrl.includes('image/svg')) {
      return this.logoUrl;
    }

    try {
      const resp = await firstValueFrom(
        this.empresaService.getLogoBase64(this.medilaserEmpresaId)
      );
      const base64 = String(resp?.logo_base64 ?? '').trim();
      if (base64.startsWith('data:image') && !base64.includes('image/svg')) {
        this.logoUrl = base64;
        this.cdr.detectChanges();
        return base64;
      }
      if (base64.length > 100 && !base64.startsWith('data:')) {
        const dataUrl = `data:image/png;base64,${base64}`;
        this.logoUrl = dataUrl;
        this.cdr.detectChanges();
        return dataUrl;
      }
    } catch {
      // se intenta con URL fija de Medilaser
    }

    for (const candidate of [this.logoUrl, this.medilaserLogoUrl]) {
      if (!candidate?.trim()) {
        continue;
      }
      const dataUrl = await this.loadImageAsDataUrl(candidate.trim());
      if (dataUrl) {
        this.logoUrl = dataUrl;
        this.cdr.detectChanges();
        return dataUrl;
      }
    }

    return null;
  }

  private async loadImageAsDataUrl(url: string): Promise<string | null> {
    try {
      if (url.startsWith('data:image')) {
        return url.includes('image/svg') ? null : url;
      }

      const absolute = /^https?:\/\//i.test(url)
        ? url
        : `${window.location.origin}/${url.replace(/^\//, '')}`;

      const response = await fetch(absolute, {
        mode: 'cors',
        credentials: /^https?:\/\//i.test(url) ? 'omit' : 'same-origin'
      });
      if (!response.ok) {
        return null;
      }

      const blob = await response.blob();
      if (!blob.type.startsWith('image/') || blob.type.includes('svg')) {
        return null;
      }

      return await this.blobToDataUrl(blob);
    } catch {
      return null;
    }
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('No se pudo leer el logo.'));
      reader.readAsDataURL(blob);
    });
  }

  private async cargarLogoMedilaser(): Promise<void> {
    this.empresaNombre = 'Clínica Medilaser S.A.S.';
    try {
      const logoResp = await firstValueFrom(
        this.empresaService.getLogoBase64(this.medilaserEmpresaId)
      );
      if (logoResp?.nombre) {
        this.empresaNombre = String(logoResp.nombre).trim();
      }
      const base64 = String(logoResp?.logo_base64 ?? '').trim();
      if (base64.startsWith('data:image') && !base64.includes('image/svg')) {
        this.logoUrl = base64;
        this.cdr.detectChanges();
        return;
      }
      if (base64.length > 100 && !base64.startsWith('data:')) {
        this.logoUrl = `data:image/png;base64,${base64}`;
        this.cdr.detectChanges();
        return;
      }
      const url = String(logoResp?.logo_url ?? this.medilaserLogoUrl).trim();
      this.logoUrl = url || this.medilaserLogoUrl;
      this.cdr.detectChanges();
    } catch {
      this.logoUrl = this.medilaserLogoUrl;
      this.cdr.detectChanges();
    }
  }
}
