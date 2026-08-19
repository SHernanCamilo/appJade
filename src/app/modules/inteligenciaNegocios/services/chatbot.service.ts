import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ChatMessage {
  id?: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at?: string;
}

export interface ChatConversation {
  id: number;
  user_id: number;
  titulo: string | null;
  activa: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatResponse {
  success: boolean;
  response?: string;
  message?: string;
  conversation_id?: number;
  model_used?: string;
  tokens?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  type?: string;
}

export interface ChatCatalogItem {
  schema: string;
  vista: string;
  descripcion: string;
  ejemplo_preguntas: string[] | null;
}

export interface ChatCatalogResponse {
  success: boolean;
  esquemas: string[];
  data: ChatCatalogItem[];
}

@Injectable({
  providedIn: 'root'
})
export class ChatBotService {
  private readonly baseUrl = `${environment.URL_SERVICIOS}/chatbot`;

  constructor(private http: HttpClient) {}

  /**
   * Envía un mensaje al chatbot y recibe la respuesta.
   */
  sendMessage(message: string, conversationId?: number): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(`${this.baseUrl}/message`, {
      message,
      conversation_id: conversationId ?? null
    });
  }

  /**
   * Obtiene el historial de conversaciones del usuario.
   */
  getConversations(): Observable<{ success: boolean; data: ChatConversation[] }> {
    return this.http.get<{ success: boolean; data: ChatConversation[] }>(`${this.baseUrl}/conversations`);
  }

  /**
   * Obtiene los mensajes de una conversación.
   */
  getMessages(conversationId: number): Observable<{ success: boolean; data: ChatMessage[] }> {
    return this.http.get<{ success: boolean; data: ChatMessage[] }>(`${this.baseUrl}/conversations/${conversationId}`);
  }

  /**
   * Cierra (elimina) una conversación.
   */
  deleteConversation(conversationId: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.baseUrl}/conversations/${conversationId}`);
  }

  /**
   * Obtiene el catálogo de vistas disponibles para el usuario.
   */
  getCatalog(): Observable<ChatCatalogResponse> {
    return this.http.get<ChatCatalogResponse>(`${this.baseUrl}/catalog`);
  }
}
