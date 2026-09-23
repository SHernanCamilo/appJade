import { Injectable } from '@angular/core';
import { ModuloSidebar, SidebarService } from '../../complements/shared/sidebar/sidebar.service';
import { buildBootstrapIconClass } from '../utils/bootstrap-icon.util';

export interface ModuleDashboardItem {
  name: string;
  route: string;
  icon: string;
  orden: number;
}

export interface ModuleDashboardCard {
  title: string;
  icon: string;
  description: string;
  /** Nombre de color (compatibilidad; ya no controla el fondo). */
  color: string;
  /** Gradiente listo para aplicar inline al encabezado del card. */
  headerStyle: string;
  items: ModuleDashboardItem[];
}

@Injectable({
  providedIn: 'root'
})
export class ModuleDashboardService {
  /**
   * Paleta base de gradientes para el encabezado de los cards. Son los mismos
   * colores corporativos de siempre (morado, verde, azul, naranja, gris) más
   * dos extra. El color se aplica INLINE desde aquí, así que ya no depende de
   * que exista una clase CSS por color en cada módulo.
   */
  private readonly cardGradients: Array<[string, string]> = [
    ['#667eea', '#764ba2'], // morado  (primary)
    ['#10b981', '#059669'], // verde   (success)
    ['#3b82f6', '#2563eb'], // azul    (info)
    ['#f59e0b', '#d97706'], // naranja (warning)
    ['#64748b', '#475569'], // gris    (secondary)
    ['#ec4899', '#db2777'], // rosa
    ['#14b8a6', '#0d9488'], // teal
    ['#8b5cf6', '#6d28d9'], // violeta
  ];

  /** Nombres solo para retrocompatibilidad del campo `color`. */
  private readonly colorNames = ['primary', 'success', 'info', 'warning', 'secondary'];

  constructor(private sidebarService: SidebarService) {}

  buildDashboardCards(baseRoute: string): ModuleDashboardCard[] {
    const modulo = this.sidebarService.buscarModuloPorRuta(baseRoute);
    if (!modulo?.hijos?.length) {
      return [];
    }

    return modulo.hijos
      .map((grupo, index) => this.mapGrupoToCard(grupo, index))
      .filter(card => card.items.length > 0);
  }

  private mapGrupoToCard(grupo: ModuloSidebar, index: number): ModuleDashboardCard {
    return {
      title: grupo.nombre,
      icon: buildBootstrapIconClass(grupo.icono),
      description: '',
      color: this.colorNames[index % this.colorNames.length],
      headerStyle: this.gradientForIndex(index),
      items: this.collectItems(grupo)
    };
  }

  /**
   * Devuelve el gradiente CSS para un card según su posición.
   *
   * Mientras haya colores en la paleta, se usan esos (aspecto corporativo).
   * Si se agotan (muchos cards), se generan colores nuevos por HSL rotando el
   * matiz: así NUNCA queda un card sin color y no se repite tan pronto, sin
   * tener que definir nada en el CSS. Totalmente dinámico.
   */
  private gradientForIndex(index: number): string {
    if (index < this.cardGradients.length) {
      const [from, to] = this.cardGradients[index];
      return `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;
    }

    // Más cards que colores en la paleta: generar por matiz (golden angle para
    // repartir bien los tonos) y oscurecer el segundo tono para el degradado.
    const extra = index - this.cardGradients.length;
    const hue   = (extra * 137.508) % 360;
    return `linear-gradient(135deg, hsl(${hue}, 62%, 58%) 0%, hsl(${hue}, 66%, 45%) 100%)`;
  }

  private collectItems(grupo: ModuloSidebar): ModuleDashboardItem[] {
    if (!grupo.hijos?.length) {
      return grupo.ruta ? [this.toItem(grupo)] : [];
    }

    const items: ModuleDashboardItem[] = [];

    for (const hijo of grupo.hijos) {
      if (hijo.hijos && hijo.hijos.length > 0) {
        const childItems = this.collectItems(hijo);
        if (childItems.length > 0) {
          items.push(...childItems);
        } else if (hijo.ruta) {
          items.push(this.toItem(hijo));
        }
      } else if (hijo.ruta) {
        items.push(this.toItem(hijo));
      }
    }

    return items.sort((a, b) => a.orden - b.orden);
  }

  private toItem(modulo: ModuloSidebar): ModuleDashboardItem {
    return {
      name: modulo.nombre,
      route: modulo.ruta!,
      icon: buildBootstrapIconClass(modulo.icono),
      orden: modulo.orden
    };
  }
}
