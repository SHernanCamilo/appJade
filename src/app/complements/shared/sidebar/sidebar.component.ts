import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SidebarService } from './sidebar.service';
import { MenuService, MenuItem } from '../../../core/services/menu.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar-dynamic.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent implements OnInit {
  isCollapsed = false;
  isMobileOpen = false;
  modulos$;

  constructor(
    private sidebarService: SidebarService
  ) {
    this.modulos$ = this.sidebarService.modulos$;
  }

  ngOnInit(): void {
    this.sidebarService.isCollapsed$.subscribe(collapsed => {
      this.isCollapsed = collapsed;
      // Cerrar todos los dropdowns cuando se colapsa el sidebar
      if (collapsed) {
        this.closeAllDropdowns();
      }
    });

    this.sidebarService.isMobileOpen$.subscribe(open => {
      this.isMobileOpen = open;
    });


    // Intentar cargar módulos desde cache (útil en refresh)
    if (!this.sidebarService.getModulos().length) {
      const cargado = this.sidebarService.cargarModulosDesdeCache();
      if (!cargado) {
      } else {
      }
    } else {
      
    }
  }

  private closeAllDropdowns(): void {
    // Cerrar todos los collapse de Bootstrap
    const collapseElements = document.querySelectorAll('.sidebar .collapse.show');
    collapseElements.forEach(element => {
      element.classList.remove('show');
    });
  }

  toggleSidebar(): void {
    // En móvil, cerrar el sidebar; en desktop, colapsar
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
