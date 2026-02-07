import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../auth.service';
import { MicrosoftAuthService } from '../microsoft-auth.service';
import { InactivityService } from '../../../core/services/inactivity.service';
import { CommonModule } from '@angular/common';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { DividerModule } from 'primeng/divider';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    RouterModule,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    CheckboxModule,
    CardModule,
    MessageModule,
    DividerModule
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  isLoading = false;
  isMicrosoftLoading = false;
  hasError = false;
  errorMsg = '';
  returnUrl = '/dashboard';
  showPassword = false;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private microsoftAuth: MicrosoftAuthService,
    private inactivityService: InactivityService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    // Redirigir si ya está autenticado
    if (this.auth.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    }

    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [false]
    });
  }

  ngOnInit(): void {
    // Obtener la URL de retorno si existe
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
    
    // Verificar si la sesión expiró
    const reason = this.route.snapshot.queryParams['reason'];
    if (reason === 'session_expired') {
      this.hasError = true;
      this.errorMsg = 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.';
    }
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.hasError = false;
    this.errorMsg = '';

    const { email, password } = this.loginForm.value;
    
    this.auth.login(email, password).subscribe({
      next: () => {
        this.isLoading = false;
        this.hasError = false;
        // Navegar a la URL de retorno o al dashboard
        this.router.navigateByUrl(this.returnUrl).then(
          (success) => console.log('✅ Navegación exitosa:', success),
          (error) => console.error('❌ Error en navegación:', error)
        );
      },
      error: (error) => {
        this.isLoading = false;
        this.hasError = true;
        
        // Manejar diferentes tipos de errores
        if (error.status === 401) {
          this.errorMsg = 'Credenciales incorrectas. Por favor, verifica tu email y contraseña.';
        } else if (error.status === 403) {
          // Usuario inactivo - mostrar mensaje del backend
          this.errorMsg = error.error?.message || 'Usuario inactivo';
        } else if (error.status === 0) {
          this.errorMsg = 'No se puede conectar con el servidor. Verifica tu conexión.';
        } else {
          this.errorMsg = 'Error al iniciar sesión. Por favor, intenta nuevamente.';
        }
        
        console.error('Error en login:', error);
      }
    });
  }

  // Método para limpiar errores cuando el usuario empiece a escribir
  clearError(): void {
    this.hasError = false;
    this.errorMsg = '';
  }

  // Método para mostrar/ocultar contraseña
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  // Método para login con Microsoft usando popup
  loginWithMicrosoft(): void {
    this.isMicrosoftLoading = true;
    this.hasError = false;
    this.errorMsg = '';

    this.microsoftAuth.loginWithPopup().subscribe({
      next: (response) => {
        console.log('✅ Respuesta de Microsoft Auth:', response);
        
        this.isMicrosoftLoading = false;
        
        // Guardar token y datos de sesión (igual que el login normal)
        localStorage.setItem('token', response.access_token);
        localStorage.setItem('session_start', Date.now().toString());
        
        if (response.user) {
          localStorage.setItem('user', JSON.stringify(response.user));
          this.auth['currentUserSubject'].next(response.user);
          
          // Cargar permisos del usuario (igual que el login normal)
          if ((response.user as any).permissions) {
            console.log('🔐 Cargando permisos de Microsoft Auth:', (response.user as any).permissions);
            this.auth['permissionService'].setPermissions((response.user as any).permissions);
          }
        }

        // Cargar módulos del sidebar si vienen en la respuesta (igual que el login normal)
        if ((response as any).sidebar && (response as any).sidebar.length > 0) {
          console.log('📋 Cargando sidebar de Microsoft Auth:', (response as any).sidebar);
          this.auth['sidebarService'].cargarModulosDesdeLogin((response as any).sidebar);
        } else {
          // Si no vienen en el login, cargarlos con endpoint separado
          this.auth['loadSidebarModules']();
        }

        // Iniciar validación de token (igual que el login normal)
        this.auth['startTokenValidation']();
        // Iniciar validación de sesión máxima (8 horas)
        this.auth['startMaxSessionCheck']();
        
        // Iniciar monitoreo de inactividad
        this.inactivityService.startWatching();
        
        console.log('🚀 Login con Microsoft completado, navegando a:', this.returnUrl);
        
        // Navegar al dashboard
        this.router.navigateByUrl(this.returnUrl).then(
          (success) => console.log('✅ Navegación exitosa:', success),
          (error) => console.error('❌ Error en navegación:', error)
        );
      },
      error: (error) => {
        console.error('❌ Error en login con Microsoft:', error);
        this.isMicrosoftLoading = false;
        this.hasError = true;
        
        if (error.status === 403) {
          // Manejar diferentes tipos de errores 403
          if (error.error?.error?.includes('no tiene acceso')) {
            this.errorMsg = 'Tu dominio de correo no tiene acceso a esta aplicación';
          } else if (error.error?.error?.includes('debe ser creada por un administrador')) {
            this.errorMsg = 'Tu cuenta debe ser creada por un administrador antes de poder acceder. Contacta al administrador para solicitar acceso.';
          } else if (error.error?.error?.includes('desactivada')) {
            this.errorMsg = 'Tu cuenta ha sido desactivada. Contacta al administrador para más información.';
          } else {
            this.errorMsg = error.error?.error || 'No tienes autorización para acceder a esta aplicación';
          }
        } else if (error.message?.includes('popups')) {
          this.errorMsg = 'Por favor, permite los popups para iniciar sesión con Microsoft';
        } else if (error.message?.includes('cancelada')) {
          this.errorMsg = 'Autenticación cancelada';
        } else {
          this.errorMsg = 'Error al iniciar sesión con Microsoft. Intenta nuevamente.';
        }
      }
    });
  }

  // Método alternativo: login con Microsoft usando redirect
  loginWithMicrosoftRedirect(): void {
    this.microsoftAuth.loginWithRedirect();
  }
}
