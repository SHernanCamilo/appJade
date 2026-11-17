import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export type ModoTeams = 'resumen' | 'detalle';

export interface TeamsDestino {
  id: number;
  nombre: string;
  activo: boolean;
  modo: ModoTeams;
  grupos: string[];
  intervalo_minutos: number;
  programacion: 'intervalo' | 'hora';
  hora: string | null;
  scheduled_task_id: number | null;
  omitir_si_vacio: boolean;
  tiene_webhook: boolean;
  team_id: string | null;
  team_nombre: string | null;
  channel_id: string | null;
  channel_nombre: string | null;
  ultima_notificacion_at: string | null;
  ultimo_estado: string | null;
  ultimo_error: string | null;
}

export interface TeamsDestinoPayload {
  nombre: string;
  activo: boolean;
  modo: ModoTeams;
  grupos: string[];
  intervalo_minutos: number;
  programacion: 'intervalo' | 'hora';
  hora?: string | null;
  omitir_si_vacio: boolean;
  webhook_url?: string;
  quitar_webhook?: boolean;
  team_id?: string | null;
  team_nombre?: string | null;
  channel_id?: string | null;
  channel_nombre?: string | null;
}

export interface TeamsOpcion {
  id: string;
  nombre: string;
}

export interface TeamsGrupo {
  nombre: string;
  nivel: number;
  total: number;
}

export interface TeamsVista {
  titulo: string;
  texto: string;
  casos: number;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TeamsDestinosService {
  private readonly apiUrl = '/mesa-servicio/glpi/teams-destinos';

  constructor(private http: HttpClient) {}

  listar(): Observable<TeamsDestino[]> {
    return this.http.get<ApiResponse<TeamsDestino[]>>(this.apiUrl).pipe(
      map((response) => response.data ?? [])
    );
  }

  guardar(payload: TeamsDestinoPayload, id?: number | null): Observable<TeamsDestino> {
    const peticion = id
      ? this.http.put<ApiResponse<TeamsDestino>>(`${this.apiUrl}/${id}`, payload)
      : this.http.post<ApiResponse<TeamsDestino>>(this.apiUrl, payload);

    return peticion.pipe(map((response) => response.data));
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<ApiResponse<unknown>>(`${this.apiUrl}/${id}`).pipe(map(() => undefined));
  }

  enviar(id: number): Observable<string> {
    return this.http.post<ApiResponse<TeamsDestino>>(`${this.apiUrl}/${id}/enviar`, {}).pipe(
      map((response) => response.message || 'Notificación enviada.')
    );
  }

  vistaPrevia(payload: Pick<TeamsDestinoPayload, 'nombre' | 'modo' | 'grupos'>): Observable<TeamsVista> {
    return this.http.post<ApiResponse<TeamsVista>>(`${this.apiUrl}/vista-previa`, payload).pipe(
      map((response) => response.data)
    );
  }

  grupos(): Observable<TeamsGrupo[]> {
    return this.http.get<ApiResponse<TeamsGrupo[]>>(`${this.apiUrl}/grupos`).pipe(
      map((response) => response.data ?? [])
    );
  }

  equipos(): Observable<TeamsOpcion[]> {
    return this.http.get<ApiResponse<TeamsOpcion[]>>(`${this.apiUrl}/equipos`).pipe(
      map((response) => response.data ?? [])
    );
  }

  canales(teamId: string): Observable<TeamsOpcion[]> {
    return this.http.get<ApiResponse<TeamsOpcion[]>>(`${this.apiUrl}/equipos/${teamId}/canales`).pipe(
      map((response) => response.data ?? [])
    );
  }

  chats(): Observable<TeamsOpcion[]> {
    return this.http.get<ApiResponse<TeamsOpcion[]>>(`${this.apiUrl}/chats`).pipe(
      map((response) => response.data ?? [])
    );
  }
}
