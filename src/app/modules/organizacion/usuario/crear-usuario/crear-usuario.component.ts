import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { UsuarioService, Usuario, CreateUsuarioRequest } from '../services/usuario.service';

// PrimeNG Imports
import { TableModule, Table } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TagModule } from 'primeng/tag';
import { AvatarModule } from 'primeng/avatar';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService, ConfirmationService } from 'primeng/api';

@Component({
  selector: 'app-crear-usuario',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    ReactiveFormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    DialogModule,
    ToastModule,
    ConfirmDialogModule,
    TagModule,
    AvatarModule,
    TooltipModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './crear-usuario.component.html',
  styleUrl: './crear-usuario.component.css'
})
export class CrearUsuarioComponent implements OnInit {
  @ViewChild('dt') dt!: Table;
  
  usuarios: Usuario[] = [];
  usuarioForm!: FormGroup;
  isLoading = false;
  isSubmitting = false;
  showForm = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private fb: FormBuilder,
    private usuarioService: UsuarioService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    this.loadUsuarios();
  }

  initForm(): void {
    this.usuarioForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      password_confirmation: ['', [Validators.required]]
    });
  }

  loadUsuarios(): void {
    console.log('🔄 Cargando usuarios...');
    this.isLoading = true;
    this.errorMessage = '';
    
    this.usuarioService.getUsuarios().subscribe({
      next: (usuarios) => {
        console.log('✅ Usuarios cargados:', usuarios);
        this.usuarios = usuarios;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ Error cargando usuarios:', error);
        console.error('Status:', error.status);
        console.error('Message:', error.message);
        this.errorMessage = 'Error al cargar los usuarios. Por favor, intenta nuevamente.';
        this.isLoading = false;
        // Mostrar usuarios de prueba si hay error
        this.usuarios = [];
      }
    });
  }

  toggleForm(): void {
    this.showForm = !this.showForm;
    if (!this.showForm) {
      this.usuarioForm.reset();
      this.errorMessage = '';
      this.successMessage = '';
    }
  }

  onSubmit(): void {
    if (this.usuarioForm.invalid) {
      this.usuarioForm.markAllAsTouched();
      return;
    }

    const { password, password_confirmation } = this.usuarioForm.value;
    if (password !== password_confirmation) {
      this.errorMessage = 'Las contraseñas no coinciden';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    const newUsuario: CreateUsuarioRequest = {
      name: this.usuarioForm.value.name,
      email: this.usuarioForm.value.email,
      password: this.usuarioForm.value.password,
      password_confirmation: this.usuarioForm.value.password_confirmation
    };

    this.usuarioService.createUsuario(newUsuario).subscribe({
      next: (usuario) => {
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: 'Usuario creado exitosamente'
        });
        this.usuarioForm.reset();
        this.showForm = false;
        this.loadUsuarios();
        this.isSubmitting = false;
      },
      error: (error) => {
        console.error('Error creando usuario:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: error.error?.message || 'Error al crear el usuario'
        });
        this.isSubmitting = false;
      }
    });
  }

  deleteUsuario(usuario: Usuario): void {
    this.confirmationService.confirm({
      message: `¿Estás seguro de eliminar al usuario "${usuario.name}"?`,
      header: 'Confirmar Eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.usuarioService.deleteUsuario(usuario.id).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: 'Usuario eliminado exitosamente'
            });
            this.loadUsuarios();
          },
          error: (error) => {
            console.error('Error eliminando usuario:', error);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Error al eliminar el usuario'
            });
          }
        });
      }
    });
  }

  getInitials(name: string): string {
    const names = name.split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  onGlobalFilter(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.dt.filterGlobal(input.value, 'contains');
  }
}
