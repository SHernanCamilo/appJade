import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, map } from 'rxjs';

export interface UserPermission {
  codigo: string;
  nombre: string;
  tipo: 'boton' | 'accion' | 'menu';
  estado: boolean;
}

export interface Sede {
  id: number;
  nombre: string;
  codigo?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PermissionService {
  private permissionsSubject = new BehaviorSubject<UserPermission[]>([]);
  public permissions$ = this.permissionsSubject.asObservable();
  
  private sedesSubject = new BehaviorSubject<Sede[]>([]);
  public sedes$ = this.sedesSubject.asObservable();

  constructor(private http: HttpClient) {
    // Cargar permisos y sedes desde localStorage si existen
    this.loadPermissionsFromStorage();
    this.loadSedesFromStorage();
  }

  /**
   * Carga los permisos desde localStorage al iniciar
   */
  private loadPermissionsFromStorage(): void {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.permissions && Array.isArray(user.permissions)) {
          this.setPermissions(user.permissions);
        }
      } catch (e) {
        console.error('❌ Error cargando permisos desde localStorage:', e);
      }
    }
  }

  /**
   * Carga las sedes desde localStorage al iniciar
   */
  private loadSedesFromStorage(): void {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.sedes && Array.isArray(user.sedes)) {
          this.setSedes(user.sedes);
        }
      } catch (e) {
        console.error('❌ Error cargando sedes desde localStorage:', e);
      }
    }
  }

  /**
   * Carga los permisos del usuario desde el backend
   */
  loadUserPermissions(): void {
    const token = localStorage.getItem('token');
    if (!token) {
      return;
    }

    this.http.get<any>('/auth/me').subscribe({
      next: (response) => {
        let permissionsCodes: string[] = [];
        
        if (Array.isArray(response.permissions)) {
          permissionsCodes = response.permissions;
        } else if (response.data && Array.isArray(response.data.permissions)) {
          permissionsCodes = response.data.permissions;
        } else if (response.permisos && Array.isArray(response.permisos)) {
          permissionsCodes = response.permisos;
        }
        
        const permissions: UserPermission[] = permissionsCodes.map((codigo: string) => ({
          codigo: codigo,
          nombre: codigo,
          tipo: this.getTipoPermiso(codigo),
          estado: true
        }));
        
        this.permissionsSubject.next(permissions);
      },
      error: (error) => {
        console.error('❌ Error cargando permisos:', error);
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
    const userPermissions: UserPermission[] = permissions.map(p => ({
      codigo: p.codigo || p,
      nombre: p.nombre || p,
      tipo: p.tipo || 'accion',
      estado: p.estado !== undefined ? p.estado : true
    }));
    this.permissionsSubject.next(userPermissions);
  }

  /**
   * Obtiene las sedes del usuario
   */
  getSedes(): Sede[] {
    return this.sedesSubject.value;
  }

  /**
   * Establece las sedes del usuario
   */
  setSedes(sedes: any[]): void {
    const sedesData: Sede[] = sedes.map(s => ({
      id: s.id,
      nombre: s.nombre || s.name,
      codigo: s.codigo || s.code
    }));
    this.sedesSubject.next(sedesData);
  }

  /**
   * Limpia los permisos y sedes (útil al hacer logout)
   */
  clearPermissions(): void {
    this.permissionsSubject.next([]);
    this.sedesSubject.next([]);
  }

  /**
   * Recarga los permisos y sedes del usuario
   */
  reloadPermissions(): void {
    this.loadUserPermissions();
    this.loadSedesFromStorage();
  }
}
