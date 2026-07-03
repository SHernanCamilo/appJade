import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface PermisoBasico {
  puede_leer: boolean;
  puede_crear: boolean;
  puede_editar: boolean;
  puede_eliminar: boolean;
}

export interface ModuloSidebar {
  id: number;
  nombre: string;
  codigo: string;
  icono: string;
  ruta?: string;
  orden: number;
  nivel: number;
  id_modulo_padre?: number;
  tiene_acceso: boolean;
  permisos_basicos?: PermisoBasico;
  hijos?: ModuloSidebar[];
}

@Injectable({
  providedIn: 'root'
})
export class SidebarService {
  private isCollapsedSubject = new BehaviorSubject<boolean>(false);
  public isCollapsed$: Observable<boolean> = this.isCollapsedSubject.asObservable();

  private isMobileOpenSubject = new BehaviorSubject<boolean>(false);
  public isMobileOpen$: Observable<boolean> = this.isMobileOpenSubject.asObservable();

  private modulosSubject = new BehaviorSubject<ModuloSidebar[]>([]);
  public modulos$: Observable<ModuloSidebar[]> = this.modulosSubject.asObservable();

  constructor() {
    // Cargar módulos desde localStorage al iniciar
    this.cargarModulosDesdeCache();
  }

  toggleSidebar(): void {
    this.isCollapsedSubject.next(!this.isCollapsedSubject.value);
  }

  toggleMobileSidebar(): void {
    this.isMobileOpenSubject.next(!this.isMobileOpenSubject.value);
  }

  closeMobileSidebar(): void {
    this.isMobileOpenSubject.next(false);
  }

  getSidebarState(): boolean {
    return this.isCollapsedSubject.value;
  }

  getMobileSidebarState(): boolean {
    return this.isMobileOpenSubject.value;
  }

  /**
   * Carga los módulos del sidebar desde el login
   */
  cargarModulosDesdeLogin(modulos: ModuloSidebar[]): void {
    
    if (!modulos || !Array.isArray(modulos)) {
      console.error('❌ Los módulos no son un array válido');
      return;
    }
    
    // Filtrar solo módulos con acceso y organizar jerarquía
    const modulosConAcceso = this.filtrarYOrganizarModulos(modulos);
    
    this.modulosSubject.next(modulosConAcceso);
    
    // Guardar en localStorage para persistencia (refresh)
    localStorage.setItem('sidebar_modules', JSON.stringify(modulosConAcceso));
  }

  /**
   * Carga módulos desde localStorage (útil en refresh)
   */
  cargarModulosDesdeCache(): boolean {
    const cached = localStorage.getItem('sidebar_modules');
    if (cached) {
      try {
        const modulos = JSON.parse(cached);
        this.modulosSubject.next(modulos);
        return true;
      } catch (e) {
        console.error('Error parseando módulos del cache:', e);
        return false;
      }
    }
    return false;
  }

  /**
   * Filtra módulos sin acceso y organiza la jerarquía
   */
  private filtrarYOrganizarModulos(modulos: ModuloSidebar[]): ModuloSidebar[] {
    modulos.forEach(m => {
    });
    
    const filtrados = modulos
      .filter(m => {
        const tieneAcceso = m.tiene_acceso;
        return tieneAcceso;
      })
      .map(m => ({
        ...m,
        hijos: m.hijos ? this.filtrarYOrganizarModulos(m.hijos) : []
      }))
      .sort((a, b) => a.orden - b.orden);
    return filtrados;
  }

  /**
   * Verifica si el usuario tiene acceso a un módulo
   */
  tieneAccesoModulo(codigo: string): boolean {
    const modulos = this.modulosSubject.value;
    return this.buscarModuloPorCodigo(modulos, codigo) !== null;
  }

  /**
   * Busca un módulo por ruta en la jerarquía
   */
  buscarModuloPorRuta(ruta: string): ModuloSidebar | null {
    return this.buscarModuloPorRutaEnArbol(this.modulosSubject.value, ruta);
  }

  private buscarModuloPorRutaEnArbol(modulos: ModuloSidebar[], ruta: string): ModuloSidebar | null {
    const rutaNormalizada = this.normalizarRuta(ruta);

    for (const modulo of modulos) {
      if (modulo.ruta && this.normalizarRuta(modulo.ruta) === rutaNormalizada) {
        return modulo;
      }

      if (modulo.hijos && modulo.hijos.length > 0) {
        const encontrado = this.buscarModuloPorRutaEnArbol(modulo.hijos, ruta);
        if (encontrado) {
          return encontrado;
        }
      }
    }

    return null;
  }

  private normalizarRuta(ruta: string): string {
    const limpia = ruta.trim().replace(/\/+$/, '');
    if (!limpia) {
      return '/';
    }

    return limpia.startsWith('/') ? limpia : `/${limpia}`;
  }

  /**
   * Busca un módulo por código en la jerarquía
   */
  private buscarModuloPorCodigo(modulos: ModuloSidebar[], codigo: string): ModuloSidebar | null {
    for (const modulo of modulos) {
      if (modulo.codigo === codigo) {
        return modulo;
      }
      if (modulo.hijos && modulo.hijos.length > 0) {
        const encontrado = this.buscarModuloPorCodigo(modulo.hijos, codigo);
        if (encontrado) {
          return encontrado;
        }
      }
    }
    return null;
  }

  /**
   * Obtiene los permisos básicos de un módulo
   */
  getPermisosBasicos(codigo: string): PermisoBasico | null {
    const modulo = this.buscarModuloPorCodigo(this.modulosSubject.value, codigo);
    return modulo?.permisos_basicos || null;
  }

  /**
   * Limpia los módulos del sidebar (útil en logout)
   */
  limpiarModulos(): void {
    this.modulosSubject.next([]);
    localStorage.removeItem('sidebar_modules');
  }

  /**
   * Obtiene los módulos actuales
   */
  getModulos(): ModuloSidebar[] {
    return this.modulosSubject.value;
  }
}
