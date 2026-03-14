import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SidebarService } from './sidebar.service';
import { MenuService, MenuItem } from '../../../core/services/menu.service';
import { Observable, combineLatest, of } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './sidebar-dynamic.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent implements OnInit {
  isCollapsed = false;
  isMobileOpen = false;
  modulos$;
  searchTerm = '';
  modulosFiltrados: any[] = [];
  todosModulos: any[] = [];

  constructor(
    private sidebarService: SidebarService
  ) {
    this.modulos$ = this.sidebarService.modulos$;
  }

  ngOnInit(): void {
    this.sidebarService.isCollapsed$.subscribe(collapsed => {
      this.isCollapsed = collapsed;
      if (collapsed) {
        this.closeAllDropdowns();
        this.searchTerm = '';
      }
    });

    this.sidebarService.isMobileOpen$.subscribe(open => {
      this.isMobileOpen = open;
    });

    this.modulos$.subscribe((modulos: any[]) => {
      this.todosModulos = modulos;
      this.modulosFiltrados = modulos;
    });

    if (!this.sidebarService.getModulos().length) {
      const cargado = this.sidebarService.cargarModulosDesdeCache();
    }
  }

  filtrarModulos(): void {
    const term = this.searchTerm.toLowerCase().trim();
    if (!term) {
      this.modulosFiltrados = this.todosModulos;
      return;
    }

    this.modulosFiltrados = this.todosModulos
      .map(modulo => {
        // Verificar si el módulo padre coincide
        const padreCoincide = modulo.nombre.toLowerCase().includes(term);

        // Filtrar hijos que coincidan
        const hijosFiltrados = (modulo.hijos || [])
          .map((hijo: any) => {
            const hijoCoincide = hijo.nombre.toLowerCase().includes(term);
            const subhijosFiltrados = (hijo.hijos || []).filter((sub: any) =>
              sub.nombre.toLowerCase().includes(term)
            );
            if (hijoCoincide || subhijosFiltrados.length > 0) {
              return { ...hijo, hijos: hijoCoincide ? hijo.hijos : subhijosFiltrados };
            }
            return null;
          })
          .filter(Boolean);

        if (padreCoincide || hijosFiltrados.length > 0) {
          return { ...modulo, hijos: padreCoincide ? modulo.hijos : hijosFiltrados, _expanded: true };
        }
        return null;
      })
      .filter(Boolean);
  }

  limpiarBusqueda(): void {
    this.searchTerm = '';
    this.modulosFiltrados = this.todosModulos;
  }

  private closeAllDropdowns(): void {
    const collapseElements = document.querySelectorAll('.sidebar .collapse.show');
    collapseElements.forEach(element => {
      element.classList.remove('show');
    });
  }

  toggleSidebar(): void {
    if (window.innerWidth < 992) {
      this.closeMobileSidebar();
    } else {
      this.sidebarService.toggleSidebar();
    }
  }

  closeMobileSidebar(): void {
    this.sidebarService.closeMobileSidebar();
  }
}
