import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextarea } from 'primeng/inputtextarea';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { ChatBotService, ChatMessage, ChatConversation, ChatCatalogItem } from '../services/chatbot.service';
import { FormatMarkdownPipe } from './format-markdown.pipe';

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextarea,
    ProgressSpinnerModule,
    TooltipModule,
    TagModule,
    FormatMarkdownPipe
  ],
  templateUrl: './chatbot.component.html',
  styleUrl: './chatbot.component.css'
})
export class ChatBotComponent implements OnInit, AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
  @ViewChild('messageInput') private messageInput!: ElementRef;

  messages: ChatMessage[] = [];
  conversations: ChatConversation[] = [];
  catalog: ChatCatalogItem[] = [];
  esquemas: string[] = [];

  currentMessage = '';
  conversationId: number | undefined;
  loading = false;
  loadingConversations = false;
  showSidebar = false;
  showCatalog = false;
  private shouldScroll = false;

  ngOnInit(): void {
    this.loadConversations();
    this.loadCatalog();
    this.addWelcomeMessage();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  constructor(private chatBotService: ChatBotService) {}

  sendMessage(): void {
    const msg = this.currentMessage.trim();
    if (!msg || this.loading) return;

    // Agregar mensaje del usuario a la UI
    this.messages.push({ role: 'user', content: msg });
    this.currentMessage = '';
    this.loading = true;
    this.shouldScroll = true;

    this.chatBotService.sendMessage(msg, this.conversationId).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success && response.response) {
          this.messages.push({ role: 'assistant', content: response.response });
          this.conversationId = response.conversation_id;
        } else {
          this.messages.push({
            role: 'assistant',
            content: response.message || 'Lo siento, no pude procesar tu consulta. Intenta de nuevo.'
          });
        }
        this.shouldScroll = true;
      },
      error: (err) => {
        this.loading = false;
        const errorMsg = err.error?.message || 'Error de conexión. Verifica tu conexión a internet.';
        this.messages.push({ role: 'assistant', content: errorMsg });
        this.shouldScroll = true;
      }
    });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  newConversation(): void {
    this.conversationId = undefined;
    this.messages = [];
    this.addWelcomeMessage();
  }

  loadConversation(conv: ChatConversation): void {
    this.conversationId = conv.id;
    this.messages = [];
    this.loading = true;
    this.showSidebar = false;

    this.chatBotService.getMessages(conv.id).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success) {
          this.messages = res.data;
          this.shouldScroll = true;
        }
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  deleteConversation(conv: ChatConversation, event: Event): void {
    event.stopPropagation();
    this.chatBotService.deleteConversation(conv.id).subscribe({
      next: () => {
        this.conversations = this.conversations.filter(c => c.id !== conv.id);
        if (this.conversationId === conv.id) {
          this.newConversation();
        }
      }
    });
  }

  useSuggestion(question: string): void {
    this.currentMessage = question;
    this.sendMessage();
  }

  toggleSidebar(): void {
    this.showSidebar = !this.showSidebar;
    if (this.showSidebar) {
      this.loadConversations();
    }
  }

  toggleCatalog(): void {
    this.showCatalog = !this.showCatalog;
  }

  private loadConversations(): void {
    this.loadingConversations = true;
    this.chatBotService.getConversations().subscribe({
      next: (res) => {
        this.loadingConversations = false;
        if (res.success) {
          this.conversations = res.data;
        }
      },
      error: () => {
        this.loadingConversations = false;
      }
    });
  }

  private loadCatalog(): void {
    this.chatBotService.getCatalog().subscribe({
      next: (res) => {
        if (res.success) {
          this.catalog = res.data;
          this.esquemas = res.esquemas;
        }
      }
    });
  }

  private addWelcomeMessage(): void {
    this.messages.push({
      role: 'assistant',
      content: '¡Hola! Soy el asistente de datos de Medilaser. Puedo ayudarte a consultar información de las vistas analíticas disponibles para tu perfil.\n\n¿En qué puedo ayudarte hoy?'
    });
  }

  private scrollToBottom(): void {
    try {
      const container = this.messagesContainer?.nativeElement;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    } catch (err) {}
  }

  formatTime(dateStr?: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  }
}
