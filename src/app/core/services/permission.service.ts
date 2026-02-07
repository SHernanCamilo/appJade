import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UserPermission {
  codigo: string;
  nombre: string;
  tipo: 'boton' | 'accion' | 'menu';
  estado: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PermissionService {
  private permissionsSubject = new BehaviorSubject<UserPermission[]>([]);
  public permissions$ = this.permissionsSubject.asObservable();

  constructor(private http: HttpClient) {
    // NO cargar permisos automáticamente en el constructor
    // Se cargarán después del login desde el AuthService
  }

  /**
   * Carga los permisos del usuario desde el backend
   */
  loadUserPermissions(): void {
    console.log('🔄 Iniciando carga de permisos...');
    
    // Verificar si hay un token de autenticación
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('⚠️ No hay token, no se cargarán permisos');
      return;
    }

    console.log('✅ Token encontrado, consultando permisos al backend...');
    
    this.http.get<any>(`${environment.URL_SERVICIOS}/auth/me`).subscribe({
      next: (response) => {
        console.log('📦 Respuesta completa del backend:', response);
        console.log('🔑 Permisos del usuario:', response.permissions);
        
        // Manejar diferentes formatos de respuesta
        let permissionsCodes: string[] = [];
        
        if (Array.isArray(response.permissions)) {
          permissionsCodes = response.permissions;
        } else if (response.data && Array.isArray(response.data.permissions)) {
          permissionsCodes = response.data.permissions;
        } else if (response.permisos && Array.isArray(response.permisos)) {
          permissionsCodes = response.permisos;
        }
        
        console.log('📋 Códigos de permisos procesados:', permissionsCodes);
        
        
        // Convertir los códigos de permisos a objetos UserPermission
        const permissions: UserPermission[] = permissionsCodes.map((codigo: string) => ({
          codigo: codigo,
          nombre: codigo,
          tipo: this.getTipoPermiso(codigo),
          estado: true
        }));
        
        console.log('✅ Permisos cargados:', permissions.length);
        this.permissionsSubject.next(permissions);
      },
      error: (error) => {
        console.error('❌ Error cargando permisos:', error);
        console.error('Status:', error.status);
        console.error('Message:', error.message);
        
      }
    });
  }

  /**
   * Determina el tipo de permiso basado en su código
   */
  private getTipoPermiso(codigo: string): 'boton' | 'accion' | 'menu' {
    if (codigo.includes('crear') || codigo.includes('editar') || codigo.includes('eliminar')) {
      return 'boton';
    }
    if (codigo.includes('menu')) {
      return 'menu';
    }
    return 'accion';
  }

  /**
   * Verifica si el usuario tiene un permiso específico
   */
  hasPermission(codigo: string): boolean {
    const permissions = this.permissionsSubject.value;
    const permission = permissions.find(p => p.codigo === codigo);
    return permission ? permission.estado : false;
  }

  /**
   * Verifica si el usuario tiene alguno de los permisos especificados
   */
  hasAnyPermission(codigos: string[]): boolean {
    return codigos.some(codigo => this.hasPermission(codigo));
  }

  /**
   * Verifica si el usuario tiene todos los permisos especificados
   */
  hasAllPermissions(codigos: string[]): boolean {
    return codigos.every(codigo => this.hasPermission(codigo));
  }

  /**
   * Obtiene todos los permisos del usuario
   */
  getUserPermissions(): UserPermission[] {
    return this.permissionsSubject.value;
  }

  /**
   * Obtiene permisos por tipo
   */
  getPermissionsByType(tipo: 'boton' | 'accion' | 'menu'): UserPermission[] {
    return this.permissionsSubject.value.filter(p => p.tipo === tipo);
  }

  /**
   * Establece los permisos del usuario
   */
  setPermissions(permissions: any[]): void {
    // Convertir permisos del backend al formato UserPermission
    const userPermissions: UserPermission[] = permissions.map(p => ({
      codigo: p.codigo || p,
      nombre: p.nombre || p,
      tipo: p.tipo || 'accion',
      estado: p.estado !== undefined ? p.estado : true
    }));
    this.permissionsSubject.next(userPermissions);
  }

  /**
   * Limpia los permisos (útil al hacer logout)
   */
  clearPermissions(): void {
    this.permissionsSubject.next([]);
  }

  /**
   * Recarga los permisos del usuario
   */
  reloadPermissions(): void {
    this.loadUserPermissions();
  }
}
