import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { PermisoService, Permiso, Modulo } from '../services/permiso.service';

// PrimeNG Imports
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextarea } from 'primeng/inputtextarea';
import { DropdownModule } from 'primeng/dropdown';
import { InputSwitchModule } from 'primeng/inputswitch';
import { AccordionModule } from 'primeng/accordion';
import { TagModule } from 'primeng/tag';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { InputNumberModule } from 'primeng/inputnumber';

interface ModuloConPermisos extends Modulo {
  permisos: Permiso[];
  expanded: boolean;
  hijos?: ModuloConPermisos[];
  esHijo?: boolean;
}

@Component({
  selector: 'app-permisos-modulo',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    ReactiveFormsModule, 
    FormsModule,
    CardModule,
    ButtonModule,
    TableModule,
    DialogModule,
    InputTextModule,
    InputTextarea,
    DropdownModule,
    InputSwitchModule,
    AccordionModule,
    TagModule,
    ConfirmDialogModule,
    ToastModule,
    ProgressSpinnerModule,
    InputNumberModule
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './permisos-modulo.component.html',
  styleUrls: ['./permisos-modulo.component.css']
})
export class PermisosModuloComponent implements OnInit {
  modulosConPermisos: ModuloConPermisos[] = [];
  loading = false;
  
  showPermisoDialog = false;
  editingPermiso: Permiso | null = null;
  permisoForm: FormGroup;
  moduloSeleccionado: Modulo | null = null;

  tiposPermiso = [
    { label: 'Botón', value: 'boton' },
    { label: 'Acción', value: 'accion' },
    { label: 'Menú', value: 'menu' }
  ];

  constructor(
    private permisoService: PermisoService,
    private fb: FormBuilder,
    private confirmationService: ConfirmationService,
    private messageService: MessageService
  ) {
    this.permisoForm = this.fb.group({
      id_modulo: [null, Validators.required],
      nombre: ['', [Validators.required, Validators.maxLength(100)]],
      codigo: ['', [Validators.required, Validators.maxLength(50)]],
      descripcion: [''],
      tipo: ['boton', Validators.required],
      icono: [''],
      orden: [0],
      estado: [true]
    });
  }

  ngOnInit(): void {
    this.loadModulosConPermisos();
  }

  loadModulosConPermisos(): void {
    // console.log('Iniciando carga de módulos y permisos...');
    this.loading = true;
    
    this.permisoService.getModulos().subscribe({
      next: (responseModulos) => {
        // console.log('✅ Respuesta módulos completa:', responseModulos);
        // console.log('✅ Success:', responseModulos.success);
        // console.log('✅ Data:', responseModulos.data);
        // console.log('✅ Cantidad de módulos:', responseModulos.data?.length);
        
        if (responseModulos.success && responseModulos.data) {
          const modulos = responseModulos.data;
          
          this.permisoService.getPermisos().subscribe({
            next: (responsePermisos) => {
              // console.log('✅ Respuesta permisos completa:', responsePermisos);
              // console.log('✅ Cantidad de permisos:', responsePermisos.data?.length);
              
              if (responsePermisos.success && responsePermisos.data) {
                const permisos = responsePermisos.data;
                
                // Crear mapa de módulos con permisos
                const modulosMap = modulos.map(modulo => ({
                  ...modulo,
                  permisos: permisos.filter(p => p.id_modulo === modulo.id),
                  expanded: false,
                  hijos: [],
                  esHijo: false
                }));
                
                // Organizar por jerarquía
                this.modulosConPermisos = this.organizarJerarquia(modulosMap);
                
                // console.log('✅ Módulos con permisos procesados:', this.modulosConPermisos);
                // console.log('✅ Total módulos raíz:', this.modulosConPermisos.length);
              } else {
                console.warn('⚠️ Respuesta de permisos sin success o data');
                // Cargar módulos sin permisos
                const modulosMap = modulos.map(modulo => ({
                  ...modulo,
                  permisos: [],
                  expanded: false,
                  hijos: [],
                  esHijo: false
                }));
                this.modulosConPermisos = this.organizarJerarquia(modulosMap);
              }
              this.loading = false;
            },
            error: (error) => {
              console.error('❌ Error al cargar permisos:', error);
              console.error('❌ Status:', error.status);
              console.error('❌ Message:', error.message);
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'No se pudieron cargar los permisos: ' + (error.message || 'Error desconocido')
              });
              // Cargar módulos sin permisos
              const modulosMap = modulos.map(modulo => ({
                ...modulo,
                permisos: [],
                expanded: false,
                hijos: [],
                esHijo: false
              }));
              this.modulosConPermisos = this.organizarJerarquia(modulosMap);
              this.loading = false;
            }
          });
        } else {
          console.warn('⚠️ Respuesta de módulos sin success o data');
          this.loading = false;
          this.messageService.add({
            severity: 'warn',
            summary: 'Advertencia',
            detail: 'No se encontraron módulos'
          });
        }
      },
      error: (error) => {
        console.error('❌ Error al cargar módulos:', error);
        console.error('❌ Status:', error.status);
        console.error('❌ Message:', error.message);
        console.error('❌ URL:', error.url);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los módulos: ' + (error.message || 'Error desconocido')
        });
        this.loading = false;
      }
    });
  }

  toggleModulo(modulo: ModuloConPermisos): void {
    modulo.expanded = !modulo.expanded;
  }

  openPermisoDialog(modulo?: Modulo, permiso?: Permiso): void {
    this.editingPermiso = permiso || null;
    this.moduloSeleccionado = modulo || null;

    if (permiso) {
      this.permisoForm.patchValue({
        id_modulo: permiso.id_modulo,
        nombre: permiso.nombre,
        codigo: permiso.codigo,
        descripcion: permiso.descripcion,
        tipo: permiso.tipo,
        icono: permiso.icono,
        orden: permiso.orden,
        estado: permiso.estado
      });
    } else {
      this.permisoForm.reset({
        id_modulo: modulo?.id || null,
        tipo: 'boton',
        estado: true,
        orden: 0
      });
    }

    this.showPermisoDialog = true;
  }

  closePermisoDialog(): void {
    this.showPermisoDialog = false;
    this.editingPermiso = null;
    this.moduloSeleccionado = null;
    this.permisoForm.reset();
  }

  savePermiso(): void {
    if (this.permisoForm.invalid) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Validación',
        detail: 'Por favor completa todos los campos requeridos'
      });
      return;
    }

    const permisoData = this.permisoForm.value;

    if (this.editingPermiso) {
      this.permisoService.updatePermiso(this.editingPermiso.id, permisoData).subscribe({
        next: (response) => {
          if (response.success) {
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: 'Permiso actualizado exitosamente'
            });
            this.closePermisoDialog();
            this.loadModulosConPermisos();
          }
        },
        error: (error) => {
          console.error('Error al actualizar permiso:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: error.error?.message || 'Error al actualizar el permiso'
          });
        }
      });
    } else {
      this.permisoService.createPermiso(permisoData).subscribe({
        next: (response) => {
          if (response.success) {
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: 'Permiso creado exitosamente'
            });
            this.closePermisoDialog();
            this.loadModulosConPermisos();
          }
        },
        error: (error) => {
          console.error('Error al crear permiso:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: error.error?.message || 'Error al crear el permiso'
          });
        }
      });
    }
  }

  deletePermiso(permiso: Permiso, event: Event): void {
    event.stopPropagation();
    
    this.confirmationService.confirm({
      message: `¿Estás seguro de eliminar el permiso "${permiso.nombre}"?`,
      header: 'Confirmar Eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.permisoService.deletePermiso(permiso.id).subscribe({
          next: (response) => {
            if (response.success) {
              this.messageService.add({
                severity: 'success',
                summary: 'Éxito',
                detail: 'Permiso eliminado exitosamente'
              });
              this.loadModulosConPermisos();
            }
          },
          error: (error) => {
            console.error('Error al eliminar permiso:', error);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: error.error?.message || 'Error al eliminar el permiso'
            });
          }
        });
      }
    });
  }

  toggleEstado(permiso: Permiso): void {
    const nuevoEstado = !permiso.estado;
    
    this.permisoService.updatePermiso(permiso.id, { estado: nuevoEstado }).subscribe({
      next: (response) => {
        if (response.success) {
          permiso.estado = nuevoEstado;
          this.messageService.add({
            severity: 'info',
            summary: 'Estado Actualizado',
            detail: `Permiso ${nuevoEstado ? 'activado' : 'desactivado'}`
          });
        }
      },
      error: (error) => {
        console.error('Error al cambiar estado:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error al cambiar el estado del permiso'
        });
      }
    });
  }

  generarCodigo(): void {
    const nombre = this.permisoForm.get('nombre')?.value;
    if (nombre) {
      const codigo = nombre
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      this.permisoForm.patchValue({ codigo });
    }
  }

  getTipoSeverity(tipo: string): 'success' | 'info' | 'warn' | 'danger' {
    const severities: { [key: string]: 'success' | 'info' | 'warn' | 'danger' } = {
      'boton': 'success',
      'accion': 'info',
      'menu': 'warn'
    };
    return severities[tipo] || 'info';
  }

  getTipoIcon(tipo: string): string {
    const icons: { [key: string]: string } = {
      'boton': 'pi-hand-pointer',
      'accion': 'pi-bolt',
      'menu': 'pi-list'
    };
    return icons[tipo] || 'pi-circle';
  }

  getTotalPermisos(): number {
    return this.modulosConPermisos.reduce((total, modulo) => total + modulo.permisos.length, 0);
  }

  getPermisosActivos(): number {
    return this.modulosConPermisos.reduce((total, modulo) => 
      total + modulo.permisos.filter(p => p.estado).length, 0);
  }

  getPermisosActivosPorModulo(modulo: ModuloConPermisos): number {
    return modulo.permisos.filter(p => p.estado).length;
  }

  organizarJerarquia(modulos: ModuloConPermisos[]): ModuloConPermisos[] {
    // Crear un mapa de módulos por ID
    const modulosMap = new Map<number, ModuloConPermisos>();
    modulos.forEach(modulo => {
      modulosMap.set(modulo.id, { ...modulo, hijos: [] });
    });

    // Identificar módulos raíz (sin padre)
    const modulosRaiz: ModuloConPermisos[] = [];
    
    modulos.forEach(modulo => {
      const moduloActual = modulosMap.get(modulo.id)!;
      
      if (!modulo.id_modulo_padre) {
        // Es un módulo raíz (nivel 0)
        modulosRaiz.push(moduloActual);
      } else {
        // Tiene padre, buscar el padre y agregarlo como hijo
        const padre = modulosMap.get(modulo.id_modulo_padre);
        if (padre) {
          moduloActual.esHijo = true;
          if (!padre.hijos) {
            padre.hijos = [];
          }
          padre.hijos.push(moduloActual);
        } else {
          // Si no encuentra el padre, lo trata como raíz
          console.warn(`⚠️ Módulo ${modulo.nombre} (ID: ${modulo.id}) tiene padre ${modulo.id_modulo_padre} pero no se encontró`);
          modulosRaiz.push(moduloActual);
        }
      }
    });

    // Función recursiva para ordenar hijos
    const ordenarHijosRecursivo = (modulo: ModuloConPermisos) => {
      if (modulo.hijos && modulo.hijos.length > 0) {
        modulo.hijos.sort((a, b) => a.orden - b.orden);
        // Llamada recursiva para ordenar los hijos de los hijos
        modulo.hijos.forEach(hijo => ordenarHijosRecursivo(hijo));
      }
    };

    // Ordenar módulos raíz
    modulosRaiz.sort((a, b) => a.orden - b.orden);
    
    // Ordenar todos los hijos recursivamente
    modulosRaiz.forEach(modulo => ordenarHijosRecursivo(modulo));

    // Función recursiva para contar profundidad
    const contarProfundidad = (modulo: ModuloConPermisos, nivel: number = 0): number => {
      if (!modulo.hijos || modulo.hijos.length === 0) {
        return nivel;
      }
      return Math.max(...modulo.hijos.map(hijo => contarProfundidad(hijo, nivel + 1)));
    };

    const profundidadMaxima = Math.max(...modulosRaiz.map(m => contarProfundidad(m)));

    /* console.log('📊 Jerarquía organizada:', {
      modulosRaiz: modulosRaiz.length,
      profundidadMaxima: profundidadMaxima,
      estructura: modulosRaiz.map(m => ({
        nombre: m.nombre,
        hijos: m.hijos?.length || 0
      }))
    });*/

    return modulosRaiz;
  }

  getTotalPermisosConHijos(modulo: ModuloConPermisos): number {
    let total = modulo.permisos.length;
    if (modulo.hijos) {
      modulo.hijos.forEach(hijo => {
        total += this.getTotalPermisosConHijos(hijo);
      });
    }
    return total;
  }

  getPermisosActivosConHijos(modulo: ModuloConPermisos): number {
    let total = modulo.permisos.filter(p => p.estado).length;
    if (modulo.hijos) {
      modulo.hijos.forEach(hijo => {
        total += this.getPermisosActivosConHijos(hijo);
      });
    }
    return total;
  }

  // Aplanar jerarquía para el dropdown
  get modulosParaDropdown(): any[] {
    const aplanar = (modulos: ModuloConPermisos[], nivel: number = 0): any[] => {
      let resultado: any[] = [];
      
      modulos.forEach(modulo => {
        // Agregar el módulo actual con indentación
        const prefijo = '　'.repeat(nivel); // Espacio japonés para indentación
        const icono = nivel === 0 ? '📁' : nivel === 1 ? '📂' : '📄';
        
        resultado.push({
          id: modulo.id,
          nombre: `${prefijo}${icono} ${modulo.nombre}`,
          nombreOriginal: modulo.nombre,
          codigo: modulo.codigo,
          nivel: nivel,
          disabled: false
        });
        
        // Si tiene hijos, agregarlos recursivamente
        if (modulo.hijos && modulo.hijos.length > 0) {
          resultado = resultado.concat(aplanar(modulo.hijos, nivel + 1));
        }
      });
      
      return resultado;
    };
    
    return aplanar(this.modulosConPermisos);
  }
}
