import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface Usuario {
  id: number;
  name: string;
  cargo?: string;
  email: string;
  estado?: boolean;
  created_at?: string;
  roles?: any[];
  permissions?: string[];
  empresa?: any;
  empresas?: any[];
}

export interface CreateUsuarioRequest {
  name: string;
  email: string;
  password: string;
  password_confirmation?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UsuarioService {
  private apiUrl = environment.URL_SERVICIOS + '/users';

  constructor(private http: HttpClient) {
    console.log('📡 UsuarioService initialized. API URL:', this.apiUrl);
  }

  // Obtener todos los usuarios
  getUsuarios(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(this.apiUrl);
  }

  // Obtener un usuario por ID
  getUsuario(id: number): Observable<Usuario> {
    return this.http.get<Usuario>(`${this.apiUrl}/${id}`);
  }

  // Crear nuevo usuario
  createUsuario(usuario: CreateUsuarioRequest): Observable<Usuario> {
    return this.http.post<Usuario>(this.apiUrl, usuario);
  }

  // Actualizar usuario
  updateUsuario(id: number, usuario: Partial<Usuario>): Observable<Usuario> {
    return this.http.put<Usuario>(`${this.apiUrl}/${id}`, usuario);
  }

  // Eliminar usuario
  deleteUsuario(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  // Cambiar estado del usuario (activar/inactivar)
  cambiarEstadoUsuario(id: number, estado: boolean): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/${id}/cambiar-estado`, { estado });
  }

  // Obtener usuarios del tenant de Microsoft
  obtenerUsuariosTenant(tenantType: 'medilaser' | 'jersalud' = 'medilaser'): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/tenant/obtener?tenant=${tenantType}`);
  }

  // Verificar si un email ya existe
  checkEmailExists(email: string): Observable<{exists: boolean}> {
    return this.http.post<{exists: boolean}>(`${this.apiUrl}/check-email`, { email });
  }

  // Sincronizar usuarios seleccionados del tenant
  sincronizarUsuariosTenant(usuarios: any[]): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/tenant/sincronizar`, {
      usuarios
    });
  }
}
