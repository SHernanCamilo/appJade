import { Injectable, inject } from '@angular/core';
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';

export const userInactiveInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const messageService = inject(MessageService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Verificar si es un error de usuario inactivo
      if (error.status === 403 && error.error?.code === 'USER_INACTIVE') {
        console.warn('🚫 Usuario inactivo detectado. Cerrando sesión...');
        
        // Limpiar sesión
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('sidebar_modules');
        
        // Mostrar mensaje
        messageService.add({
          severity: 'warn',
          summary: 'Cuenta Inactiva',
          detail: error.error.message || 'Tu cuenta ha sido desactivada. Contacta al administrador.',
          life: 8000
        });
        
        // Redirigir al login después de un breve delay
        setTimeout(() => {
          router.navigate(['/login']);
        }, 2000);
        
        // No propagar el error para evitar múltiples mensajes
        return throwError(() => new Error('Usuario inactivo'));
      }
      
      // Para otros errores, propagar normalmente
      return throwError(() => error);
    })
  );
};