import { Component, OnInit, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../../modules/auth/auth.service';
import { SidebarService } from '../../sidebar/sidebar.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { PersonificarService } from '../../../../services/personificar.service';
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { MenuModule } from 'primeng/menu';
import { BadgeModule } from 'primeng/badge';
import { DialogModule } from 'primeng/dialog';
import { MenuItem } from 'primeng/api';
import { PersonificarSimpleComponent } from '../../../../components/personificar-simple/personificar-simple.component';
import { PersonificarBannerComponent } from '../../../../components/personificar-banner/personificar-banner.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule, ButtonModule, AvatarModule, MenuModule, BadgeModule, DialogModule, PersonificarSimpleComponent],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent implements OnInit {
  currentUser: any = null;
  isDropdownOpen = false;
  isSidebarCollapsed = false;
  userMenuItems: MenuItem[] = [];
  showPersonificarModal = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private sidebarService: SidebarService,
    private permissionService: PermissionService,
    private personificarService: PersonificarService
  ) { }

  ngOnInit(): void {
    // Suscribirse a los cambios del usuario actual
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      this.initUserMenu();
    });

    // Suscribirse a los cambios del sidebar
    this.sidebarService.isCollapsed$.subscribe(collapsed => {
      this.isSidebarCollapsed = collapsed;
    });

    // Cargar usuario si no está cargado
    if (!this.currentUser && this.authService.isAuthenticated()) {
      this.loadUserData();
    }
    
    this.initUserMenu();
  }

  initUserMenu(): void {
    const menuItems: MenuItem[] = [
      {
        label: 'Mi Perfil',
        icon: 'pi pi-user',
        command: () => this.goToProfile()
      },
      {
        label: 'Configuración',
        icon: 'pi pi-cog',
        command: () => this.goToSettings()
      }
    ];

    // Agregar opción de personificar si tiene permisos
    if (this.canPersonificar()) {
      menuItems.push({
        separator: true
      });
      menuItems.push({
        label: 'Personificar Usuario',
        icon: 'pi pi-user-edit',
        command: () => this.openPersonificarModal(),
        styleClass: 'text-warning'
      });
    }

    menuItems.push(
      {
        separator: true
      },
      {
        label: 'Cerrar Sesión',
        icon: 'pi pi-sign-out',
        command: () => this.logout(),
        styleClass: 'text-danger'
      }
    );

    this.userMenuItems = menuItems;
  }

  loadUserData(): void {
    this.authService.me().subscribe({
      next: (user) => {
        this.currentUser = user;
      },
      error: (error) => {
        console.error('Error loading user data:', error);
      }
    });
  }

  toggleDropdown(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  closeDropdown(): void {
    this.isDropdownOpen = false;
  }

  logout(): void {
    this.closeDropdown();
    this.authService.logout();
  }

  goToProfile(): void {
    this.closeDropdown();
    this.router.navigate(['/profile']);
  }

  goToSettings(): void {
    this.closeDropdown();
    this.router.navigate(['/settings']);
  }

  // Obtener iniciales del nombre para el avatar
  getUserInitials(): string {
    if (!this.currentUser?.name) return 'U';
    const names = this.currentUser.name.split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[1][0]).toUpperCase();
    }
    return this.currentUser.name.substring(0, 2).toUpperCase();
  }

  // Obtener el rol principal del usuario
  getUserRole(): string {
    if (!this.currentUser?.roles || this.currentUser.roles.length === 0) {
      return 'Usuario';
    }
    return this.currentUser.roles[0];
  }

  // Toggle sidebar en móvil
  toggleMobileSidebar(): void {
    this.sidebarService.toggleMobileSidebar();
  }

  // Verificar si puede personificar usuarios
  canPersonificar(): boolean {
    // Verificar si es administrador
    if (this.isCurrentUserAdmin()) {
      return true;
    }
    
    // Verificar si tiene el permiso específico
    return this.permissionService.hasPermission('org-personificar');
  }

  // Verificar si el usuario actual es administrador
  private isCurrentUserAdmin(): boolean {
    const currentUser = this.authService.currentUser;
    if (!currentUser || !currentUser.roles) {
      return false;
    }
    
    return currentUser.roles.some((rol: any) => rol.es_admin === true);
  }

  // Abrir modal de personificación
  openPersonificarModal(): void {
    this.showPersonificarModal = true;
  }

  // Cerrar modal de personificación
  closePersonificarModal(): void {
    this.showPersonificarModal = false;
  }
}
