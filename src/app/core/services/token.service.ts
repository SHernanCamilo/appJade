import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class TokenService {
  private checkInterval: any;

  constructor(private router: Router) {}

  /**
   * Decodifica un token JWT y retorna el payload
   */
  decodeToken(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error decodificando token:', error);
      return null;
    }
  }

  /**
   * Verifica si el token ha expirado
   */
  isTokenExpired(token: string): boolean {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) {
      return true;
    }

    const expirationDate = new Date(decoded.exp * 1000);
    const now = new Date();
    
    return expirationDate <= now;
  }

  /**
   * Obtiene el tiempo restante hasta la expiración en segundos
   */
  getTimeUntilExpiration(token: string): number {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) {
      return 0;
    }

    const expirationDate = new Date(decoded.exp * 1000);
    const now = new Date();
    const timeRemaining = Math.floor((expirationDate.getTime() - now.getTime()) / 1000);
    
    return timeRemaining > 0 ? timeRemaining : 0;
  }

  /**
   * Inicia la verificación periódica del token
   */
  startTokenCheck(onExpired: () => void, checkIntervalMs: number = 60000): void {
    // Limpiar intervalo anterior si existe
    this.stopTokenCheck();

    // Verificar cada minuto (o el intervalo especificado)
    this.checkInterval = setInterval(() => {
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.log('🔒 No hay token, deteniendo verificación');
        this.stopTokenCheck();
        return;
      }

      if (this.isTokenExpired(token)) {
        console.warn('⚠️ Token expirado detectado');
        this.stopTokenCheck();
        onExpired();
      } else {
        const timeRemaining = this.getTimeUntilExpiration(token);
        console.log(`✅ Token válido. Expira en ${Math.floor(timeRemaining / 60)} minutos`);
        
        // Advertir si queda menos de 5 minutos
        if (timeRemaining < 300 && timeRemaining > 0) {
          console.warn(`⏰ El token expirará en ${Math.floor(timeRemaining / 60)} minutos`);
        }
      }
    }, checkIntervalMs);

    console.log('🔄 Verificación de token iniciada');
  }

  /**
   * Detiene la verificación periódica del token
   */
  stopTokenCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('⏹️ Verificación de token detenida');
    }
  }

  /**
   * Obtiene información del token
   */
  getTokenInfo(token: string): { 
    isValid: boolean; 
    expiresAt?: Date; 
    timeRemaining?: number;
    userId?: number;
    email?: string;
  } {
    if (!token) {
      return { isValid: false };
    }

    const decoded = this.decodeToken(token);
    if (!decoded) {
      return { isValid: false };
    }

    const isExpired = this.isTokenExpired(token);
    const timeRemaining = this.getTimeUntilExpiration(token);
    const expiresAt = decoded.exp ? new Date(decoded.exp * 1000) : undefined;

    return {
      isValid: !isExpired,
      expiresAt,
      timeRemaining,
      userId: decoded.sub,
      email: decoded.email
    };
  }
}
