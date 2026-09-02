export type TipoTrasladoAsistencial = 'primario' | 'secundario' | 'primarioCompleto' | 'secundarioCompleto';

export interface RegistroTrasladoLista {
  id: number;
  tipo: 'primario' | 'secundario';
  formato?: TipoTrasladoAsistencial;
  estado: 'guardado' | 'confirmado';
  fechaAtencion: string;
  paciente: string;
  identificacion: string;
  estadoFinal: string;
  fechaGuarda?: string;
  usuarioGuarda?: string;
  fechaConfirma?: string | null;
  usuarioConfirma?: string | null;
}

export interface SignosVitalesTraslado {
  taSistolica: string;
  taDiastolica: string;
  tamSistolica: string;
  tamDiastolica: string;
  fc: string;
  fr: string;
  temperatura: string;
  fcf: string;
  pupilaDerecha: string;
  pupilaIzquierda: string;
  spo2: string;
  peso: string;
  pesoUnidad: '' | 'gramos' | 'kg';
  triage: string;
}

export interface GlasgowTraslado {
  motora: number | null;
  verbal: number | null;
  ocular: number | null;
}

export interface SeguimientoVitalFila {
  hora: string;
  tensionArterial: string;
  frecuenciaCardiaca: string;
  frecuenciaRespiratoria: string;
  temperatura: string;
  spo2: string;
  glasgow: string;
}

export interface ProcedimientoTrasladoFila {
  recomendaciones: string;
  procedimientos: string;
  cupsProcedimientos: string;
  paraclinicos: string;
  cupsParaclinicos: string;
}

export interface MedicamentoTrasladoFila {
  codigoCumIum: string;
  nombre: string;
}

export interface TripulanteTraslado {
  nombre: string;
  tipoDocumento: string;
  documento: string;
}

export interface HistoriaTrasladoAsistencial {
  recordNumero: string;
  identificacionNumero: string;
  autorizacionNumero: string;
  reciboCajaNumero: string;
  unidad: string;
  fechaAtencion: string;

  convenio: string;
  origen: string;
  origenReps: string;
  kmInicio: string;
  destino1: string;
  destino1Reps: string;
  kmLlegada1: string;
  destino2: string;
  destino2Reps: string;
  kmLlegada2: string;

  complejidad: '' | 'baja' | 'mediana';
  tipoTransporte: '' | 'terrestre' | 'aereo';
  tipoTraslado: '' | 'local' | 'intermunicipal';
  tipoServicio: '' | 'sencillo' | 'doble';
  tipoUsuario: '' | 'neonatal' | 'pediatrico' | 'adulto';
  cupsTraslado: string;

  horaSolicitud: string;
  solicitadoPor: string;
  horaLlegada1: string;
  horaSalida1: string;
  horaLlegada2: string;
  horaSalida2: string;
  horaLlegada3: string;
  horaSalida3: string;

  horaDespacho: string;
  horaLlegadaEscena: string;
  horaSalidaEscena: string;
  horaLlegadaServicio: string;
  horaRecepcion: string;
  origenDepartamento: string;
  origenMunicipio: string;
  origenLocalidad: string;
  origenBarrio: string;
  origenDireccion: string;
  acompananteTipoId: string;
  acompananteNumeroId: string;
  profesionalRecibeTipoId: string;

  fechaHoraInicioRecorrido: string;
  fechaHoraFinRecorrido: string;
  destinoDepartamento: string;
  destinoMunicipio: string;
  destinoLocalidad: string;
  destinoBarrio: string;
  destinoDireccion: string;
  trasladoRedondo: '' | 'si' | 'no';
  horasEspera: string;
  unidadDistancia: '' | 'km' | 'millas';
  kmFinales: string;
  causaDesvio: string;
  prestadorDesvio: string;
  kmDesviacion: string;
  tiempoAtencionDesvio: string;

  jornada: '' | 'diurno' | 'nocturno';
  ubicacion: '' | 'residencia' | 'via_publica' | 'ips' | 'trabajo' | 'comercio' | 'otro';
  ubicacionOtro: string;
  gruposServicio: string[];

  nombresApellidos: string;
  edad: string;
  edadUnidad: '' | 'anos' | 'meses' | 'dias' | 'horas';
  sexo: '' | 'femenino' | 'masculino';
  tipoIdentificacion: '' | 'msi' | 'rc' | 'ti' | 'cc' | 'ce' | 'otro';
  tipoIdentificacionOtro: string;
  numeroIdentificacion: string;
  fechaNacimiento: string;
  estadoCivil: '' | 'casado' | 'soltero' | 'divorciado' | 'union_libre' | 'viudo' | 'otro';
  estadoCivilOtro: string;
  ocupacion: string;
  direccionResidencia: string;
  ciudad: string;
  telefono: string;
  nombreAcompanante: string;
  telefonoAcompanante: string;
  parentesco: string;
  zonaResidencia: '' | 'rural' | 'urbano';
  gruposAtencionEspecial: string[];
  grupoAtencionOtro: string;
  eapb: string;
  aseguradoraPoliza: string;
  tipoVinculacion: '' | 'subsidiado' | 'contributivo' | 'excepcion';
  tipoAfiliado: '' | 'cotizante' | 'beneficiario' | 'no_asegurado';
  diagnosticoPrincipal: string;
  cie10: string;

  causaAtencion: string[];
  causaAtencionOtra: string;
  signosInicio: SignosVitalesTraslado;
  glasgow: GlasgowTraslado;
  motivoConsulta: string;
  enfermedadActual: string;

  antecedentesPatologicos: string;
  antecedentesQuirurgicos: string;
  antecedentesToxicos: string;
  antecedentesAlergicos: string;
  antecedentesFarmacologicos: string;
  gestaciones: string;
  partos: string;
  abortos: string;
  vivos: string;
  mortinatos: string;
  fechaUltimaMenstruacion: string;
  antecedentesHospitalarios: string;
  antecedentesTraumas: string;
  antecedentesOtros: string;

  inmovilizacionCervical: string;
  soporteOxigeno: string;
  tuboTraqueal: string;
  fijadoCm: string;
  tipoVentilacion: string;
  frVentilacion: string;
  peep: string;
  pip: string;
  fio2: string;
  relacionIE1: string;
  relacionIE2: string;
  volumenTidal: string;
  lineasVenosas: string;
  permeables: string;

  seguimientoVitales: SeguimientoVitalFila[];
  examenEvolucion: string;
  procedimientos: ProcedimientoTrasladoFila[];
  medicamentos: MedicamentoTrasladoFila[];
  insumos: string;
  complicaciones: string;
  motivosEspera: string;

  estadoFinal: '' | 'vivo' | 'muerto';
  signosEntrega: SignosVitalesTraslado;
  glasgowEntrega: string;
  motivoTraslado: string;
  fechaHoraEntrega: string;

  medico1: TripulanteTraslado;
  medico2: TripulanteTraslado;
  auxiliar1: TripulanteTraslado;
  auxiliar2: TripulanteTraslado;
  comandante1: TripulanteTraslado;
  comandante2: TripulanteTraslado;
  profesionalOrigen: string;
  profesionalOrigenCc: string;
  profesionalDestino1: string;
  profesionalDestino1Cc: string;
  profesionalDestino2: string;
  profesionalDestino2Cc: string;

  /** Campos propios del traslado secundario. */
  ipsOrigen: string;
  servicioOrigen: string;
  medicoRemite: string;
  ipsDestino: string;
  servicioDestino: string;
  medicoRecibe: string;
  motivoRemision: string;
  resumenClinico: string;
  tratamientoActual: string;
}

const GRUPOS_SERVICIO = [
  'ATENCIÓN INMEDIATA',
  'QUIRÚRGICO',
  'INTERNACIÓN',
  'APOYO DIAGNÓSTICO Y COMPLEMENTACIÓN TERAPÉUTICA',
  'CONSULTA EXTERNA'
] as const;

export const GRUPOS_SERVICIO_TRASLADO = GRUPOS_SERVICIO;

export const GRUPOS_ATENCION_ESPECIAL = [
  'Víctima',
  'Indígena',
  'Afrodescendiente',
  'Discapacidad',
  'Gestante',
  'Otro'
] as const;

export const CAUSAS_ATENCION = [
  'Enfermedad general',
  'Accidente de tránsito',
  'Accidente de trabajo',
  'Enfermedad laboral',
  'Violencia sexual',
  'Violencia intrafamiliar',
  'Otra'
] as const;

function emptySignos(): SignosVitalesTraslado {
  return {
    taSistolica: '',
    taDiastolica: '',
    tamSistolica: '',
    tamDiastolica: '',
    fc: '',
    fr: '',
    temperatura: '',
    fcf: '',
    pupilaDerecha: '',
    pupilaIzquierda: '',
    spo2: '',
    peso: '',
    pesoUnidad: '',
    triage: ''
  };
}

function emptyTripulante(): TripulanteTraslado {
  return { nombre: '', tipoDocumento: '', documento: '' };
}

function emptySeguimiento(): SeguimientoVitalFila {
  return {
    hora: '',
    tensionArterial: '',
    frecuenciaCardiaca: '',
    frecuenciaRespiratoria: '',
    temperatura: '',
    spo2: '',
    glasgow: ''
  };
}

function emptyProcedimiento(): ProcedimientoTrasladoFila {
  return {
    recomendaciones: '',
    procedimientos: '',
    cupsProcedimientos: '',
    paraclinicos: '',
    cupsParaclinicos: ''
  };
}

function emptyMedicamento(): MedicamentoTrasladoFila {
  return { codigoCumIum: '', nombre: '' };
}

export function crearHistoriaVacia(): HistoriaTrasladoAsistencial {
  return {
    recordNumero: '',
    identificacionNumero: '',
    autorizacionNumero: '',
    reciboCajaNumero: '',
    unidad: '',
    fechaAtencion: '',
    convenio: '',
    origen: '',
    origenReps: '',
    kmInicio: '',
    destino1: '',
    destino1Reps: '',
    kmLlegada1: '',
    destino2: '',
    destino2Reps: '',
    kmLlegada2: '',
    complejidad: '',
    tipoTransporte: '',
    tipoTraslado: '',
    tipoServicio: '',
    tipoUsuario: '',
    cupsTraslado: '',
    horaSolicitud: '',
    solicitadoPor: '',
    horaLlegada1: '',
    horaSalida1: '',
    horaLlegada2: '',
    horaSalida2: '',
    horaLlegada3: '',
    horaSalida3: '',
    horaDespacho: '',
    horaLlegadaEscena: '',
    horaSalidaEscena: '',
    horaLlegadaServicio: '',
    horaRecepcion: '',
    origenDepartamento: '',
    origenMunicipio: '',
    origenLocalidad: '',
    origenBarrio: '',
    origenDireccion: '',
    acompananteTipoId: '',
    acompananteNumeroId: '',
    profesionalRecibeTipoId: '',
    fechaHoraInicioRecorrido: '',
    fechaHoraFinRecorrido: '',
    destinoDepartamento: '',
    destinoMunicipio: '',
    destinoLocalidad: '',
    destinoBarrio: '',
    destinoDireccion: '',
    trasladoRedondo: '',
    horasEspera: '',
    unidadDistancia: '',
    kmFinales: '',
    causaDesvio: '',
    prestadorDesvio: '',
    kmDesviacion: '',
    tiempoAtencionDesvio: '',
    jornada: '',
    ubicacion: '',
    ubicacionOtro: '',
    gruposServicio: [],
    nombresApellidos: '',
    edad: '',
    edadUnidad: '',
    sexo: '',
    tipoIdentificacion: '',
    tipoIdentificacionOtro: '',
    numeroIdentificacion: '',
    fechaNacimiento: '',
    estadoCivil: '',
    estadoCivilOtro: '',
    ocupacion: '',
    direccionResidencia: '',
    ciudad: '',
    telefono: '',
    nombreAcompanante: '',
    telefonoAcompanante: '',
    parentesco: '',
    zonaResidencia: '',
    gruposAtencionEspecial: [],
    grupoAtencionOtro: '',
    eapb: '',
    aseguradoraPoliza: '',
    tipoVinculacion: '',
    tipoAfiliado: '',
    diagnosticoPrincipal: '',
    cie10: '',
    causaAtencion: [],
    causaAtencionOtra: '',
    signosInicio: emptySignos(),
    glasgow: { motora: null, verbal: null, ocular: null },
    motivoConsulta: '',
    enfermedadActual: '',
    antecedentesPatologicos: '',
    antecedentesQuirurgicos: '',
    antecedentesToxicos: '',
    antecedentesAlergicos: '',
    antecedentesFarmacologicos: '',
    gestaciones: '',
    partos: '',
    abortos: '',
    vivos: '',
    mortinatos: '',
    fechaUltimaMenstruacion: '',
    antecedentesHospitalarios: '',
    antecedentesTraumas: '',
    antecedentesOtros: '',
    inmovilizacionCervical: '',
    soporteOxigeno: '',
    tuboTraqueal: '',
    fijadoCm: '',
    tipoVentilacion: '',
    frVentilacion: '',
    peep: '',
    pip: '',
    fio2: '',
    relacionIE1: '',
    relacionIE2: '',
    volumenTidal: '',
    lineasVenosas: '',
    permeables: '',
    seguimientoVitales: [emptySeguimiento(), emptySeguimiento(), emptySeguimiento()],
    examenEvolucion: '',
    procedimientos: [
      emptyProcedimiento(),
      emptyProcedimiento(),
      emptyProcedimiento(),
      emptyProcedimiento()
    ],
    medicamentos: [
      emptyMedicamento(),
      emptyMedicamento(),
      emptyMedicamento(),
      emptyMedicamento()
    ],
    insumos: '',
    complicaciones: '',
    motivosEspera: '',
    estadoFinal: '',
    signosEntrega: emptySignos(),
    glasgowEntrega: '',
    motivoTraslado: '',
    fechaHoraEntrega: '',
    medico1: emptyTripulante(),
    medico2: emptyTripulante(),
    auxiliar1: emptyTripulante(),
    auxiliar2: emptyTripulante(),
    comandante1: emptyTripulante(),
    comandante2: emptyTripulante(),
    profesionalOrigen: '',
    profesionalOrigenCc: '',
    profesionalDestino1: '',
    profesionalDestino1Cc: '',
    profesionalDestino2: '',
    profesionalDestino2Cc: '',
    ipsOrigen: '',
    servicioOrigen: '',
    medicoRemite: '',
    ipsDestino: '',
    servicioDestino: '',
    medicoRecibe: '',
    motivoRemision: '',
    resumenClinico: '',
    tratamientoActual: ''
  };
}

export function glasgowTotal(g: GlasgowTraslado): number | '' {
  if (g.motora == null && g.verbal == null && g.ocular == null) {
    return '';
  }
  return (g.motora ?? 0) + (g.verbal ?? 0) + (g.ocular ?? 0);
}
