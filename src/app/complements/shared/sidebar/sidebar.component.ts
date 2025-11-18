import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SidebarService } from './sidebar.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component-primeng.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent implements OnInit {
  isCollapsed = false;
  isMobileOpen = false;

  constructor(private sidebarService: SidebarService) {}

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
      console.log('Toggle sidebar clicked, current state:', this.isCollapsed);
      this.sidebarService.toggleSidebar();
    }
  }

  closeMobileSidebar(): void {
    this.sidebarService.closeMobileSidebar();
  }
}
