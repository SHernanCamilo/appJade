import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface UsuarioDisponible {
  id: number;
  name: string;
  email: string;
  empresas: string[];
  roles: string[];
  ultimo_acceso: string;
  created_at: string;
}

export interface PersonificacionData {
  activa: boolean;
  original_user?: {
    id: number;
    name: string;
    email: string;
  };
  started_at?: string;
  duration?: number;
}

export interface PersonificacionResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: any;
    personificacion: PersonificacionData;
  };
}

@Injectable({
  providedIn: 'root'
})
export class PersonificarService {
  private apiUrl = '/personificar';
  private personificacionSubject = new BehaviorSubject<PersonificacionData>({ activa: false });
  private estadoVerificado = false;
  
  public personificacion$ = this.personificacionSubject.asObservable();

  constructor(private http: HttpClient) {
    // NO verificar automáticamente al iniciar - solo cuando sea necesario
  }

  /**
   * Obtener usuarios disponibles para personificar
   */
  getUsuariosDisponibles(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/usuarios-disponibles`);
  }

  /**
   * Iniciar personificación de un usuario
   */
  iniciarPersonificacion(userId: number): Observable<PersonificacionResponse> {
    // console.log('🎭 Iniciando personificación para usuario ID:', userId);
    
    return this.http.post<PersonificacionResponse>(`${this.apiUrl}/iniciar`, {
      user_id: userId
    }).pipe(
      tap(response => {        
        if (response.success) {
          // Actualizar token en localStorage
          localStorage.setItem('token', response.data.token);
          
          // Actualizar estado de personificación
          this.personificacionSubject.next(response.data.personificacion);
          
          // Emitir evento para que otros componentes se actualicen
          window.dispatchEvent(new CustomEvent('personificacion-iniciada', {
            detail: response.data
          }));
        } else {
          console.warn('⚠️ Personificación no exitosa:', response.message);
        }
      })
    );
  }

  /**
   * Finalizar personificación y volver al usuario original
   */
  finalizarPersonificacion(): Observable<PersonificacionResponse> {
    // console.log('🔚 PersonificarService: Finalizando personificación...');
    
    return this.http.post<PersonificacionResponse>(`${this.apiUrl}/finalizar`, {}).pipe(
      tap(response => {
        // console.log('📦 PersonificarService: Respuesta de finalización:', response);
        
        if (response.success) {
          // console.log('✅ PersonificarService: Finalizando personificación...');
          
          // Actualizar estado de personificación a INACTIVO INMEDIATAMENTE
          const estadoInactivo = { activa: false };
          this.personificacionSubject.next(estadoInactivo);
          // console.log('📊 Estado actualizado a inactivo en BehaviorSubject');
          
          // Emitir evento para que otros componentes se actualicen
          window.dispatchEvent(new CustomEvent('personificacion-finalizada', {
            detail: response.data
          }));
          
          // NOTA: El token se guarda en el componente del banner para evitar condiciones de carrera
        }
      })
    );
  }

  /**
   * Obtener estado actual de personificación
   */
  getEstadoPersonificacion(): Observable<any> {
    // console.log('🌐 PersonificarService: Consultando estado al backend...');
    
    return this.http.get<any>(`${this.apiUrl}/estado`).pipe(
      tap(response => {
        // console.log('📦 PersonificarService: Respuesta del estado:', response);
        
        if (response.success && response.data) {
          // Solo actualizar si hay datos válidos
          const estado = {
            activa: response.data.activa === true,
            original_user: response.data.original_user || null,
            started_at: response.data.started_at || null,
            duration: response.data.duration || 0
          };
          this.personificacionSubject.next(estado);
        } else {
          // Si no hay datos válidos, establecer como inactivo
          this.personificacionSubject.next({ activa: false });
        }
      })
    );
  }

  /**
   * Verificar estado de personificación - solo hace llamada al backend si
   * el token parece tener claims de personificación
   */
  verificarEstadoSiNecesario(): void {
    // Solo verificar una vez por sesión
    if (this.estadoVerificado) {
      // console.log('🔍 PersonificarService: Ya verificado, saltando...');
      return;
    }
    
    const token = localStorage.getItem('token');
    if (token) {
      // Decodificar el token para ver si tiene claims de personificación
      // sin hacer llamada al backend
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        // console.log('🔍 PersonificarService: Token decodificado, personificando =', payload.personificando);
        
        if (payload.personificando === true) {
          // Solo si hay personificación activa, verificar con el backend
          // console.log('🎭 PersonificarService: Token tiene personificación activa, consultando backend...');
          this.estadoVerificado = true;
          this.getEstadoPersonificacion().subscribe({
            error: () => {
              this.personificacionSubject.next({ activa: false });
            }
          });
        } else {
          // Token limpio, asegurar que el estado sea inactivo
          // console.log('✅ PersonificarService: Token limpio, sin personificación');
          this.estadoVerificado = true;
          this.personificacionSubject.next({ activa: false });
        }
      } catch (e) {
        // Si hay error decodificando, asumir que no hay personificación
        console.error('❌ PersonificarService: Error decodificando token:', e);
        this.personificacionSubject.next({ activa: false });
      }
    } else {
      // console.log('⚠️ PersonificarService: No hay token');
    }
  }
  
  /**
   * Resetear el flag de verificación (útil después de finalizar personificación)
   */
  resetearVerificacion(): void {
    this.estadoVerificado = false;
  }

  /**
   * Obtener estado actual de personificación (síncrono)
   */
  get estadoActual(): PersonificacionData {
    return this.personificacionSubject.value;
  }

  /**
   * Verificar si hay una personificación activa
   */
  get estaPersonificando(): boolean {
    return this.personificacionSubject.value.activa;
  }

  /**
   * Obtener historial de personificaciones
   */
  getHistorial(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/historial`);
  }
}