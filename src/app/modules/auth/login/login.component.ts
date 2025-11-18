import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../auth.service';
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
        console.log('✅ Login exitoso, navegando a:', this.returnUrl);
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

  // Método para login con Microsoft (placeholder)
  loginWithMicrosoft(): void {
    this.isMicrosoftLoading = true;
    
    // Simular proceso de autenticación con Microsoft
    setTimeout(() => {
      this.isMicrosoftLoading = false;
      // Aquí implementarías la lógica real de Microsoft OAuth
      console.log('Login con Microsoft - Por implementar');
      alert('Funcionalidad de Microsoft OAuth por implementar');
    }, 2000);
  }
}
