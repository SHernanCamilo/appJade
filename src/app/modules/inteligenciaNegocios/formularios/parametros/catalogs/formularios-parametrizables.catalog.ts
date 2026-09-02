import { CampoFormularioDef, FormularioParametrizable } from '../models/form-parametros.model';

const DATOS_PERSONA: CampoFormularioDef[] = [
  { key: 'nombresApellidos', seccion: 'Datos de la persona', label: 'Nombres y apellidos', tipo: 'text', requeridoPorDefecto: true },
  { key: 'tipoIdentificacion', seccion: 'Datos de la persona', label: 'Tipo de documento', tipo: 'radio', requeridoPorDefecto: true },
  { key: 'tipoIdentificacionOtro', seccion: 'Datos de la persona', label: 'Tipo de documento (otro)', tipo: 'text', requeridoPorDefecto: false },
  { key: 'numeroIdentificacion', seccion: 'Datos de la persona', label: 'Número de documento', tipo: 'text', requeridoPorDefecto: false },
  { key: 'edad', seccion: 'Datos de la persona', label: 'Edad', tipo: 'text', requeridoPorDefecto: true },
  { key: 'edadUnidad', seccion: 'Datos de la persona', label: 'Unidad de edad', tipo: 'radio', requeridoPorDefecto: false },
  { key: 'sexo', seccion: 'Datos de la persona', label: 'Sexo biológico', tipo: 'radio', requeridoPorDefecto: false }
];

const PROCEDIMIENTOS: CampoFormularioDef[] = [
  { key: 'procedimientos', seccion: 'Procedimientos, medicamentos y código de traslado', label: 'Procedimientos realizados (CUPS)', tipo: 'tabla', requeridoPorDefecto: true },
  { key: 'medicamentos', seccion: 'Procedimientos, medicamentos y código de traslado', label: 'Medicamentos (CUMS o IUMS)', tipo: 'tabla', requeridoPorDefecto: true },
  { key: 'insumos', seccion: 'Procedimientos, medicamentos y código de traslado', label: 'Dispositivos médicos', tipo: 'textarea', requeridoPorDefecto: false },
  { key: 'cupsTraslado', seccion: 'Procedimientos, medicamentos y código de traslado', label: 'Código de traslado (CUPS)', tipo: 'text', requeridoPorDefecto: true }
];

const ORIGEN_COMUN: CampoFormularioDef[] = [
  { key: 'origenReps', seccion: 'Origen, destino y estado', label: 'Lugar de origen — Código REPS', tipo: 'text', requeridoPorDefecto: true },
  { key: 'origenDepartamento', seccion: 'Origen, destino y estado', label: 'Lugar de origen — Departamento', tipo: 'text', requeridoPorDefecto: false },
  { key: 'origenMunicipio', seccion: 'Origen, destino y estado', label: 'Lugar de origen — Municipio', tipo: 'text', requeridoPorDefecto: false },
  { key: 'origenLocalidad', seccion: 'Origen, destino y estado', label: 'Lugar de origen — Localidad', tipo: 'text', requeridoPorDefecto: false },
  { key: 'origenBarrio', seccion: 'Origen, destino y estado', label: 'Lugar de origen — Barrio', tipo: 'text', requeridoPorDefecto: false },
  { key: 'origenDireccion', seccion: 'Origen, destino y estado', label: 'Lugar de origen — Dirección', tipo: 'text', requeridoPorDefecto: false }
];

const ACOMPANANTE: CampoFormularioDef[] = [
  { key: 'nombreAcompanante', seccion: 'Acompañante', label: 'Nombres y apellidos del acompañante', tipo: 'text', requeridoPorDefecto: true },
  { key: 'acompananteTipoId', seccion: 'Acompañante', label: 'Tipo de documento del acompañante', tipo: 'radio', requeridoPorDefecto: false },
  { key: 'acompananteNumeroId', seccion: 'Acompañante', label: 'Número de documento del acompañante', tipo: 'text', requeridoPorDefecto: false },
  { key: 'parentesco', seccion: 'Acompañante', label: 'Relación / parentesco', tipo: 'text', requeridoPorDefecto: false }
];

const TRIPULACION: CampoFormularioDef[] = [
  { key: 'medico1.nombre', seccion: 'Tripulación', label: 'Médico — Nombres y apellidos', tipo: 'text', requeridoPorDefecto: true },
  { key: 'medico1.tipoDocumento', seccion: 'Tripulación', label: 'Médico — Tipo de documento', tipo: 'text', requeridoPorDefecto: false },
  { key: 'medico1.documento', seccion: 'Tripulación', label: 'Médico — Número de documento', tipo: 'text', requeridoPorDefecto: false },
  { key: 'auxiliar1.nombre', seccion: 'Tripulación', label: 'Auxiliar de enfermería — Nombres y apellidos', tipo: 'text', requeridoPorDefecto: true },
  { key: 'auxiliar1.tipoDocumento', seccion: 'Tripulación', label: 'Auxiliar de enfermería — Tipo de documento', tipo: 'text', requeridoPorDefecto: false },
  { key: 'auxiliar1.documento', seccion: 'Tripulación', label: 'Auxiliar de enfermería — Número de documento', tipo: 'text', requeridoPorDefecto: false },
  { key: 'comandante1.nombre', seccion: 'Tripulación', label: 'Comandante / conductor — Nombres y apellidos', tipo: 'text', requeridoPorDefecto: true },
  { key: 'comandante1.tipoDocumento', seccion: 'Tripulación', label: 'Comandante / conductor — Tipo de documento', tipo: 'text', requeridoPorDefecto: false },
  { key: 'comandante1.documento', seccion: 'Tripulación', label: 'Comandante / conductor — Número de documento', tipo: 'text', requeridoPorDefecto: false }
];

const PROFESIONAL_RECIBE: CampoFormularioDef[] = [
  { key: 'profesionalDestino1', seccion: 'Profesional que recibe', label: 'Nombres y apellidos', tipo: 'text', requeridoPorDefecto: true },
  { key: 'profesionalRecibeTipoId', seccion: 'Profesional que recibe', label: 'Tipo de documento', tipo: 'radio', requeridoPorDefecto: false },
  { key: 'profesionalDestino1Cc', seccion: 'Profesional que recibe', label: 'Número de documento', tipo: 'text', requeridoPorDefecto: false }
];

export const CATALOGO_TRASLADO_PRIMARIO: CampoFormularioDef[] = [
  ...DATOS_PERSONA,
  { key: 'horaDespacho', seccion: 'Tiempos del servicio y escena', label: 'Hora del despacho', tipo: 'time', requeridoPorDefecto: true },
  { key: 'horaLlegadaEscena', seccion: 'Tiempos del servicio y escena', label: 'Hora de llegada al lugar de la escena', tipo: 'time', requeridoPorDefecto: true },
  { key: 'signosInicio.triage', seccion: 'Tiempos del servicio y escena', label: 'Triage del paciente en escena', tipo: 'text', requeridoPorDefecto: true },
  { key: 'horaSalidaEscena', seccion: 'Tiempos del servicio y escena', label: 'Hora de salida del lugar de la escena', tipo: 'time', requeridoPorDefecto: true },
  ...PROCEDIMIENTOS,
  { key: 'causaAtencion', seccion: 'Examen físico', label: 'Causa de la atención', tipo: 'checkbox', requeridoPorDefecto: false },
  { key: 'causaAtencionOtra', seccion: 'Examen físico', label: 'Causa de la atención (otra)', tipo: 'text', requeridoPorDefecto: false },
  { key: 'signosInicio.taSistolica', seccion: 'Examen físico', label: 'Tensión arterial sistólica', tipo: 'text', requeridoPorDefecto: false },
  { key: 'signosInicio.taDiastolica', seccion: 'Examen físico', label: 'Tensión arterial diastólica', tipo: 'text', requeridoPorDefecto: false },
  { key: 'signosInicio.tamSistolica', seccion: 'Examen físico', label: 'TAM sistólica', tipo: 'text', requeridoPorDefecto: false },
  { key: 'signosInicio.tamDiastolica', seccion: 'Examen físico', label: 'TAM diastólica', tipo: 'text', requeridoPorDefecto: false },
  { key: 'signosInicio.fc', seccion: 'Examen físico', label: 'Frecuencia cardíaca (FC)', tipo: 'text', requeridoPorDefecto: false },
  { key: 'signosInicio.fr', seccion: 'Examen físico', label: 'Frecuencia respiratoria (FR)', tipo: 'text', requeridoPorDefecto: false },
  { key: 'signosInicio.temperatura', seccion: 'Examen físico', label: 'Temperatura', tipo: 'text', requeridoPorDefecto: false },
  { key: 'signosInicio.fcf', seccion: 'Examen físico', label: 'Frecuencia cardíaca fetal (FCF)', tipo: 'text', requeridoPorDefecto: false },
  { key: 'signosInicio.pupilaDerecha', seccion: 'Examen físico', label: 'Pupila derecha', tipo: 'text', requeridoPorDefecto: false },
  { key: 'signosInicio.pupilaIzquierda', seccion: 'Examen físico', label: 'Pupila izquierda', tipo: 'text', requeridoPorDefecto: false },
  { key: 'signosInicio.spo2', seccion: 'Examen físico', label: 'SPO2', tipo: 'text', requeridoPorDefecto: false },
  { key: 'signosInicio.peso', seccion: 'Examen físico', label: 'Peso', tipo: 'text', requeridoPorDefecto: false },
  { key: 'signosInicio.pesoUnidad', seccion: 'Examen físico', label: 'Unidad de peso', tipo: 'radio', requeridoPorDefecto: false },
  { key: 'glasgow', seccion: 'Examen físico', label: 'Escala de Glasgow', tipo: 'tabla', requeridoPorDefecto: false },
  { key: 'motivoConsulta', seccion: 'Examen físico', label: 'Motivo de consulta', tipo: 'textarea', requeridoPorDefecto: false },
  { key: 'enfermedadActual', seccion: 'Examen físico', label: 'Enfermedad actual', tipo: 'textarea', requeridoPorDefecto: false },
  ...ORIGEN_COMUN.map(c => ({ ...c, seccion: 'Origen, destino y estado' })),
  { key: 'horaLlegadaServicio', seccion: 'Origen, destino y estado', label: 'Hora de llegada de la ambulancia al servicio', tipo: 'time', requeridoPorDefecto: true },
  { key: 'destino1Reps', seccion: 'Origen, destino y estado', label: 'Código REPS de la institución receptora', tipo: 'text', requeridoPorDefecto: true },
  { key: 'horaRecepcion', seccion: 'Origen, destino y estado', label: 'Hora de recepción del paciente por la institución', tipo: 'time', requeridoPorDefecto: true },
  { key: 'estadoFinal', seccion: 'Origen, destino y estado', label: 'Estado del paciente al ingreso', tipo: 'radio', requeridoPorDefecto: true },
  ...ACOMPANANTE,
  ...TRIPULACION,
  ...PROFESIONAL_RECIBE
];

export const CATALOGO_TRASLADO_SECUNDARIO: CampoFormularioDef[] = [
  ...DATOS_PERSONA,
  { key: 'gruposServicio', seccion: 'Datos de la persona', label: 'Grupo de servicio al cual es trasladada la persona', tipo: 'checkbox', requeridoPorDefecto: true },
  ...PROCEDIMIENTOS,
  { key: 'fechaHoraInicioRecorrido', seccion: 'Recorrido, origen y destino', label: 'Fecha y hora de inicio del recorrido', tipo: 'datetime', requeridoPorDefecto: true },
  { key: 'fechaHoraFinRecorrido', seccion: 'Recorrido, origen y destino', label: 'Fecha y hora de finalización del recorrido', tipo: 'datetime', requeridoPorDefecto: true },
  ...ORIGEN_COMUN.map(c => ({ ...c, seccion: 'Recorrido, origen y destino' })),
  { key: 'destino1Reps', seccion: 'Recorrido, origen y destino', label: 'Lugar de destino — Código REPS', tipo: 'text', requeridoPorDefecto: true },
  { key: 'destinoDepartamento', seccion: 'Recorrido, origen y destino', label: 'Lugar de destino — Departamento', tipo: 'text', requeridoPorDefecto: false },
  { key: 'destinoMunicipio', seccion: 'Recorrido, origen y destino', label: 'Lugar de destino — Municipio', tipo: 'text', requeridoPorDefecto: false },
  { key: 'destinoLocalidad', seccion: 'Recorrido, origen y destino', label: 'Lugar de destino — Localidad', tipo: 'text', requeridoPorDefecto: false },
  { key: 'destinoBarrio', seccion: 'Recorrido, origen y destino', label: 'Lugar de destino — Barrio', tipo: 'text', requeridoPorDefecto: false },
  { key: 'destinoDireccion', seccion: 'Recorrido, origen y destino', label: 'Lugar de destino — Dirección', tipo: 'text', requeridoPorDefecto: false },
  { key: 'estadoFinal', seccion: 'Recorrido, origen y destino', label: 'Estado al finalizar el traslado', tipo: 'radio', requeridoPorDefecto: true },
  { key: 'trasladoRedondo', seccion: 'Recorrido, origen y destino', label: 'Traslado redondo', tipo: 'radio', requeridoPorDefecto: true },
  { key: 'horasEspera', seccion: 'Recorrido, origen y destino', label: 'Horas de espera', tipo: 'text', requeridoPorDefecto: false },
  { key: 'unidadDistancia', seccion: 'Recorrido, origen y destino', label: 'Unidad de distancia', tipo: 'radio', requeridoPorDefecto: true },
  { key: 'kmInicio', seccion: 'Recorrido, origen y destino', label: 'Distancia iniciales', tipo: 'text', requeridoPorDefecto: true },
  { key: 'kmFinales', seccion: 'Recorrido, origen y destino', label: 'Distancia finales', tipo: 'text', requeridoPorDefecto: true },
  ...ACOMPANANTE,
  ...TRIPULACION,
  ...PROFESIONAL_RECIBE,
  { key: 'causaDesvio', seccion: 'Ingreso a prestador durante el recorrido', label: 'Causa (complicación o deterioro)', tipo: 'textarea', requeridoPorDefecto: false },
  { key: 'prestadorDesvio', seccion: 'Ingreso a prestador durante el recorrido', label: 'Nombre del prestador', tipo: 'text', requeridoPorDefecto: false },
  { key: 'kmDesviacion', seccion: 'Ingreso a prestador durante el recorrido', label: 'Kilómetros de desviación', tipo: 'text', requeridoPorDefecto: false },
  { key: 'tiempoAtencionDesvio', seccion: 'Ingreso a prestador durante el recorrido', label: 'Tiempo utilizado', tipo: 'text', requeridoPorDefecto: false }
];

export const FORMULARIOS_PARAMETRIZABLES: FormularioParametrizable[] = [
  {
    codigo: 'traslado-primario',
    titulo: 'HOJA DE TRASLADO PRIMARIO ASISTENCIAL DE PERSONAS',
    descripcion: 'Campos de la Resolución 2284 de 2023 — traslado desde el sitio del evento.',
    parametrizable: true,
    campos: CATALOGO_TRASLADO_PRIMARIO
  },
  {
    codigo: 'traslado-secundario',
    titulo: 'HOJA DE TRASLADO SECUNDARIO ASISTENCIAL DE PERSONAS',
    descripcion: 'Campos de la Resolución 2284 de 2023 — traslado entre instituciones.',
    parametrizable: true,
    campos: CATALOGO_TRASLADO_SECUNDARIO
  }
];

export function formularioPorCodigo(codigo: string | null | undefined): FormularioParametrizable | undefined {
  if (!codigo) {
    return undefined;
  }
  return FORMULARIOS_PARAMETRIZABLES.find(f => f.codigo === codigo);
}

export function catalogoPorTipoTraslado(tipo: string | null | undefined): CampoFormularioDef[] {
  if (tipo === 'primario') {
    return CATALOGO_TRASLADO_PRIMARIO;
  }
  if (tipo === 'secundario') {
    return CATALOGO_TRASLADO_SECUNDARIO;
  }
  return [];
}

export function codigoParametroPorTipo(tipo: string | null | undefined): string | null {
  if (tipo === 'primario') {
    return 'traslado-primario';
  }
  if (tipo === 'secundario') {
    return 'traslado-secundario';
  }
  return null;
}
