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
  color: string;
  items: ModuleDashboardItem[];
}

@Injectable({
  providedIn: 'root'
})
export class ModuleDashboardService {
  private readonly cardColors = ['primary', 'success', 'info', 'warning', 'secondary'];

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
      color: this.cardColors[index % this.cardColors.length],
      items: this.collectItems(grupo)
    };
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
