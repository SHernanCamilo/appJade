import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../../modules/auth/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent implements OnInit {
  currentUser: any = null;
  isDropdownOpen = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) { }

  ngOnInit(): void {
    // Suscribirse a los cambios del usuario actual
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });

    // Cargar usuario si no está cargado
    if (!this.currentUser && this.authService.isAuthenticated()) {
      this.loadUserData();
    }
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
    console.log('🔴 Navbar: Botón logout clickeado');
    this.closeDropdown();
    console.log('🔴 Navbar: Dropdown cerrado, llamando authService.logout()');
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
}
