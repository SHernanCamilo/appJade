import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';

export interface MenuItem {
  id: number;
  nombre: string;
  codigo: string;
  icono: string;
  ruta: string;
  orden: number;
  hijos: MenuItem[];
}

@Injectable({
  providedIn: 'root'
})
export class MenuService {
  private menuItemsSubject = new BehaviorSubject<MenuItem[]>([]);
  public menuItems$ = this.menuItemsSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Carga el menú del usuario desde el backend
   */
  loadUserMenu(): void {
    const token = localStorage.getItem('token');
    if (!token) {
      // console.log('No hay token, no se carga el menú');
      return;
    }

    this.http.get<any>('/auth/modulos').subscribe({
      next: (response) => {
        // console.log('Menú del usuario:', response.data);
        this.menuItemsSubject.next(response.data || []);
      },
      error: (error) => {
        console.error('Error cargando menú:', error);
        this.menuItemsSubject.next([]);
      }
    });
  }

  /**
   * Obtiene los items del menú
   */
  getMenuItems(): MenuItem[] {
    return this.menuItemsSubject.value;
  }

  /**
   * Establece los items del menú
   */
  setMenuItems(items: MenuItem[]): void {
    this.menuItemsSubject.next(items);
  }

  /**
   * Limpia el menú (útil al hacer logout)
   */
  clearMenu(): void {
    this.menuItemsSubject.next([]);
  }

  /**
   * Busca un item del menú por código
   */
  findMenuItemByCode(codigo: string): MenuItem | undefined {
    const items = this.menuItemsSubject.value;
    return this.searchInItems(items, codigo);
  }

  private searchInItems(items: MenuItem[], codigo: string): MenuItem | undefined {
    for (const item of items) {
      if (item.codigo === codigo) {
        return item;
      }
      if (item.hijos && item.hijos.length > 0) {
        const found = this.searchInItems(item.hijos, codigo);
        if (found) {
          return found;
        }
      }
    }
    return undefined;
  }
}
