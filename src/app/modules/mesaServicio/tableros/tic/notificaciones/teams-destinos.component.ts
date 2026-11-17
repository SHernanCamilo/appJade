import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { MultiSelectModule } from 'primeng/multiselect';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import {
  ModoTeams,
  TeamsDestino,
  TeamsDestinoPayload,
  TeamsDestinosService,
  TeamsGrupo,
  TeamsOpcion,
  TeamsVista
} from './teams-destinos.service';

interface FormularioDestino {
  id: number | null;
  nombre: string;
  activo: boolean;
  modo: ModoTeams;
  grupos: string[];
  intervalo_minutos: number;
  programacion: 'intervalo' | 'hora';
  hora: string;
  omitir_si_vacio: boolean;
  webhook_url: string;
  quitar_webhook: boolean;
  tiene_webhook: boolean;
  team_id: string;
  team_nombre: string;
  channel_id: string;
  channel_nombre: string;
  chat_id: string;
}

@Component({
  selector: 'app-teams-destinos',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    ButtonModule,
    DropdownModule,
    MultiSelectModule,
    ToastModule
  ],
  providers: [MessageService],
  templateUrl: './teams-destinos.component.html',
  styleUrl: './teams-destinos.component.css'
})
export class TeamsDestinosComponent implements OnInit {
  destinos: TeamsDestino[] = [];
  grupos: TeamsGrupo[] = [];
  equipos: TeamsOpcion[] = [];
  canales: TeamsOpcion[] = [];
  chats: TeamsOpcion[] = [];
  vista: TeamsVista | null = null;
  form = this.formularioVacio();
  editando = false;

  cargando = false;
  guardando = false;
  buscandoEquipos = false;
  buscandoCanales = false;
  buscandoChats = false;
  enviandoId: number | null = null;

  readonly opcionesModo = [
    { label: 'Resumen por grupos', value: 'resumen' },
    { label: 'Casos del grupo', value: 'detalle' }
  ];

  constructor(
    private destinosService: TeamsDestinosService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.cargar();
    this.cargarGrupos();
  }

  get opcionesGrupo(): { label: string; value: string }[] {
    const opciones = this.grupos
      .filter((grupo) => this.grupoValido(grupo.nombre))
      .map((grupo) => ({
        label: `${this.etiquetaNivel(grupo.nivel)} · ${grupo.nombre} (${grupo.total})`,
        value: grupo.nombre
      }));
    const presentes = new Set(opciones.map((opcion) => opcion.value));
    for (const nombre of this.gruposLimpios(this.form.grupos)) {
      if (!presentes.has(nombre)) {
        opciones.unshift({ label: nombre, value: nombre });
      }
    }
    return opciones;
  }

  get opcionesChat(): { label: string; value: string }[] {
    return this.chats.map((chat) => ({ label: chat.nombre, value: chat.id }));
  }

  get opcionesEquipo(): { label: string; value: string }[] {
    return this.equipos.map((equipo) => ({ label: equipo.nombre, value: equipo.id }));
  }

  get opcionesCanal(): { label: string; value: string }[] {
    return this.canales.map((canal) => ({ label: canal.nombre, value: canal.id }));
  }

  cargar(): void {
    this.cargando = true;
    this.destinosService.listar().subscribe({
      next: (data) => {
        this.destinos = data;
        this.cargando = false;
      },
      error: (err) => {
        this.cargando = false;
        this.avisar('error', this.textoError(err, 'No se pudieron cargar los destinos.'));
      }
    });
  }

  cargarGrupos(): void {
    this.destinosService.grupos().subscribe({
      next: (data) => {
        this.grupos = data.filter((grupo) => this.grupoValido(grupo.nombre));
        this.form.grupos = this.gruposLimpios(this.form.grupos);
      },
      error: () => {
        this.grupos = [];
      }
    });
  }

  nuevo(): void {
    this.form = this.formularioVacio();
    this.editando = true;
    this.vista = null;
    this.canales = [];
    this.buscarChats();
  }

  usarEjemplo(tipo: 'nacional' | 'desarrollo'): void {
    this.nuevo();
    if (tipo === 'nacional') {
      this.form.nombre = 'TIC NACIONAL';
      this.form.modo = 'resumen';
      this.form.grupos = [];
      return;
    }

    this.form.nombre = 'Proyecto JADE - ONE';
    this.form.modo = 'detalle';
    const grupo = this.grupos.find((item) => item.nombre.toLowerCase().includes('desarrollo'));
    this.form.grupos = grupo ? [grupo.nombre] : [];
  }

  editar(destino: TeamsDestino): void {
    const canal = destino.channel_id ?? '';
    const esChat = !destino.team_id && canal.includes('@thread');
    this.form = {
      id: destino.id,
      nombre: destino.nombre,
      activo: destino.activo,
      modo: destino.modo,
      grupos: this.gruposLimpios(destino.grupos),
      intervalo_minutos: this.intervaloValido(destino.intervalo_minutos),
      programacion: destino.programacion === 'hora' ? 'hora' : 'intervalo',
      hora: (destino.hora || '08:00').slice(0, 5),
      omitir_si_vacio: destino.omitir_si_vacio,
      webhook_url: '',
      quitar_webhook: false,
      tiene_webhook: destino.tiene_webhook,
      team_id: esChat ? '' : (destino.team_id ?? ''),
      team_nombre: esChat ? 'Chat' : (destino.team_nombre ?? ''),
      channel_id: esChat ? '' : canal,
      channel_nombre: esChat ? (destino.channel_nombre ?? '') : (destino.channel_nombre ?? ''),
      chat_id: esChat ? canal : ''
    };
    this.editando = true;
    this.vista = null;
    this.canales = !esChat && canal
      ? [{ id: canal, nombre: destino.channel_nombre || canal }]
      : [];
    if (esChat) {
      this.agregarChat({ id: canal, nombre: destino.channel_nombre || 'Chat de Teams' });
    }
    if (destino.team_id && !this.equipos.some((equipo) => equipo.id === destino.team_id)) {
      this.equipos = [
        ...this.equipos,
        { id: destino.team_id, nombre: destino.team_nombre || destino.team_id }
      ];
    }
    this.buscarChats();
  }

  cancelar(): void {
    this.editando = false;
    this.vista = null;
    this.form = this.formularioVacio();
  }

  buscarChats(): void {
    this.buscandoChats = true;
    this.destinosService.chats().subscribe({
      next: (data) => {
        const elegido = this.form.chat_id
          ? this.chats.find((chat) => chat.id === this.form.chat_id)
          : undefined;
        this.chats = data;
        if (elegido && !this.chats.some((chat) => chat.id === elegido.id)) {
          this.chats = [elegido, ...this.chats];
        }
        this.buscandoChats = false;
        if (!data.length) {
          this.avisar('warn', 'La cuenta de notificaciones no está en ningún chat de grupo.');
        }
      },
      error: (err) => {
        this.buscandoChats = false;
        this.avisar('error', this.textoError(err, 'No se pudieron leer los chats de Teams.'));
      }
    });
  }

  alElegirChat(event?: { value?: string | null }): void {
    if (event && 'value' in event) {
      this.form.chat_id = event.value ?? '';
    }
    const chat = this.chats.find((item) => item.id === this.form.chat_id);
    if (!this.form.chat_id) {
      if (this.form.team_nombre === 'Chat') {
        this.form.team_nombre = '';
        this.form.channel_nombre = '';
      }
      return;
    }
    this.form.team_id = '';
    this.form.team_nombre = 'Chat';
    this.form.channel_id = '';
    this.form.channel_nombre = chat?.nombre ?? this.form.channel_nombre;
    this.canales = [];
  }

  buscarEquipos(): void {
    this.buscandoEquipos = true;
    this.destinosService.equipos().subscribe({
      next: (data) => {
        this.equipos = data;
        this.buscandoEquipos = false;
        if (!data.length) {
          this.avisar('warn', 'Microsoft no devolvió equipos. Puedes pegar el webhook del canal.');
        }
      },
      error: (err) => {
        this.buscandoEquipos = false;
        this.avisar('error', this.textoError(err, 'No se pudieron leer los equipos de Teams.'));
      }
    });
  }

  alElegirEquipo(event?: { value?: string | null }): void {
    if (event && 'value' in event) {
      this.form.team_id = event.value ?? '';
    }
    const equipo = this.equipos.find((item) => item.id === this.form.team_id);
    this.form.team_nombre = equipo?.nombre ?? '';
    this.form.channel_id = '';
    this.form.channel_nombre = '';
    this.form.chat_id = '';
    this.canales = [];
    if (this.form.team_id) {
      this.cargarCanales();
    }
  }

  alElegirCanal(event?: { value?: string | null }): void {
    if (event && 'value' in event) {
      this.form.channel_id = event.value ?? '';
    }
    const canal = this.canales.find((item) => item.id === this.form.channel_id);
    this.form.channel_nombre = canal?.nombre ?? '';
  }

  guardar(): void {
    const nombre = this.form.nombre.trim();
    if (!nombre) {
      this.avisar('warn', 'Escribe el nombre del destino.');
      return;
    }

    const intervalo = this.intervaloValido(Number(this.form.intervalo_minutos));
    const hora = (this.form.hora || '').slice(0, 5);
    if (this.form.programacion === 'hora' && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
      this.avisar('warn', 'Elige la hora del aviso.');
      return;
    }

    const chat = this.chats.find((item) => item.id === this.form.chat_id);
    const payload: TeamsDestinoPayload = {
      nombre,
      activo: this.form.activo,
      modo: this.form.modo,
      grupos: this.gruposLimpios(this.form.grupos),
      intervalo_minutos: intervalo,
      programacion: this.form.programacion,
      hora: this.form.programacion === 'hora' ? hora : null,
      omitir_si_vacio: this.form.omitir_si_vacio,
      team_id: this.form.chat_id ? null : (this.form.team_id || null),
      team_nombre: this.form.chat_id ? 'Chat' : (this.form.team_nombre || null),
      channel_id: this.form.chat_id || this.form.channel_id || null,
      channel_nombre: this.form.chat_id
        ? (chat?.nombre || this.form.channel_nombre || null)
        : (this.form.channel_nombre || null),
      quitar_webhook: this.form.quitar_webhook
    };
    const webhook = this.form.webhook_url.trim();
    if (webhook) {
      payload.webhook_url = webhook;
    }

    this.guardando = true;
    this.destinosService.guardar(payload, this.form.id).subscribe({
      next: () => {
        this.guardando = false;
        this.avisar('success', this.form.id ? 'Destino actualizado.' : 'Destino guardado.');
        this.cancelar();
        this.cargar();
      },
      error: (err) => {
        this.guardando = false;
        this.avisar('error', this.textoError(err, 'No se pudo guardar el destino.'));
      }
    });
  }

  vistaPrevia(): void {
    this.destinosService.vistaPrevia({
      nombre: this.form.nombre.trim() || 'Vista previa',
      modo: this.form.modo,
      grupos: this.form.grupos
    }).subscribe({
      next: (data) => {
        this.vista = data;
      },
      error: (err) => {
        this.avisar('error', this.textoError(err, 'No se pudo armar la vista previa.'));
      }
    });
  }

  probar(destino: TeamsDestino): void {
    this.enviandoId = destino.id;
    this.destinosService.enviar(destino.id).subscribe({
      next: (mensaje) => {
        this.enviandoId = null;
        this.avisar('success', mensaje);
        this.cargar();
      },
      error: (err) => {
        this.enviandoId = null;
        this.avisar('error', this.textoError(err, 'No se pudo enviar a Teams.'));
        this.cargar();
      }
    });
  }

  eliminar(destino: TeamsDestino): void {
    if (!window.confirm(`¿Eliminar el destino ${destino.nombre}?`)) {
      return;
    }
    this.destinosService.eliminar(destino.id).subscribe({
      next: () => {
        this.avisar('success', 'Destino eliminado.');
        if (this.form.id === destino.id) {
          this.cancelar();
        }
        this.cargar();
      },
      error: (err) => {
        this.avisar('error', this.textoError(err, 'No se pudo eliminar el destino.'));
      }
    });
  }

  alcance(destino: TeamsDestino): string {
    if (!destino.grupos?.length) {
      return 'Todos los grupos';
    }
    return destino.grupos.join(', ');
  }

  conexion(destino: TeamsDestino): string {
    if (destino.tiene_webhook) {
      return 'Webhook del canal';
    }
    const equipo = destino.team_nombre || 'Equipo';
    const canal = destino.channel_nombre || 'canal';
    return `${equipo} · ${canal}`;
  }

  textoPrograma(destino: TeamsDestino): string {
    if (destino.programacion === 'hora') {
      return `todos los días a las ${destino.hora || '08:00'}`;
    }
    return this.intervaloValido(destino.intervalo_minutos) === 60
      ? 'cada hora'
      : `cada ${this.intervaloValido(destino.intervalo_minutos)} min`;
  }

  private intervaloValido(minutos: number): 5 | 15 | 30 | 60 {
    if (minutos <= 5) {
      return 5;
    }
    if (minutos <= 15) {
      return 15;
    }
    if (minutos <= 30) {
      return 30;
    }
    return 60;
  }

  etiquetaModo(modo: ModoTeams): string {
    return modo === 'detalle' ? 'Casos del grupo' : 'Resumen por grupos';
  }

  etiquetaNivel(nivel: number): string {
    return nivel === 4 ? 'Proveedor' : `N${nivel}`;
  }

  private cargarCanales(): void {
    const teamId = this.form.team_id;
    if (!teamId) {
      return;
    }
    this.buscandoCanales = true;
    this.destinosService.canales(teamId).subscribe({
      next: (data) => {
        this.canales = data;
        this.buscandoCanales = false;
        this.alElegirCanal();
      },
      error: (err) => {
        this.buscandoCanales = false;
        this.avisar('error', this.textoError(err, 'No se pudieron leer los canales.'));
      }
    });
  }

  private formularioVacio(): FormularioDestino {
    return {
      id: null,
      nombre: '',
      activo: true,
      modo: 'resumen',
      grupos: [],
      intervalo_minutos: 30,
      programacion: 'intervalo',
      hora: '08:00',
      omitir_si_vacio: true,
      webhook_url: '',
      quitar_webhook: false,
      tiene_webhook: false,
      team_id: '',
      team_nombre: '',
      channel_id: '',
      channel_nombre: '',
      chat_id: ''
    };
  }

  private gruposLimpios(grupos: Array<string | null> | null | undefined): string[] {
    return (grupos ?? []).filter((grupo): grupo is string => this.grupoValido(grupo));
  }

  private grupoValido(nombre: string | null | undefined): boolean {
    const texto = (nombre ?? '').trim();
    return texto !== '' && texto.toLowerCase() !== 'null';
  }

  private agregarChat(chat: TeamsOpcion): void {
    if (!this.chats.some((item) => item.id === chat.id)) {
      this.chats = [chat, ...this.chats];
    }
  }

  private avisar(severity: 'success' | 'info' | 'warn' | 'error', detail: string): void {
    this.messageService.add({ severity, summary: 'Teams', detail });
  }

  private textoError(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      const cuerpo = err.error;
      const errores = cuerpo?.errors;
      if (errores && typeof errores === 'object') {
        const primero = Object.values(errores)[0];
        if (Array.isArray(primero) && primero[0]) {
          return String(primero[0]);
        }
      }
      if (typeof cuerpo?.message === 'string' && cuerpo.message) {
        return cuerpo.message;
      }
    }
    return fallback;
  }
}
