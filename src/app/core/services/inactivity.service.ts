import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class InactivityService {
  private inactivityTime = 30 * 60 * 1000; // 30 minutos
  private inactivityTimer: any;

  constructor(
    private router: Router,
    private ngZone: NgZone
  ) {}

  startWatching(): void {
    // console.log('👁️ Monitoreo de inactividad iniciado');
    this.resetTimer();
  }

  stopWatching(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }
  }

  private resetTimer(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }

    this.inactivityTimer = setTimeout(() => {
      this.handleInactivity();
    }, this.inactivityTime);
  }

  private handleInactivity(): void {
    // console.log('⏰ Sesión cerrada por inactividad');
    localStorage.removeItem('access_token');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.router.navigate(['/login']);
  }
}
