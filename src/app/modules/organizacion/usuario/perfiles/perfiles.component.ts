import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { PerfilService, Perfil, CreatePerfilRequest } from '../services/perfil.service';
import { PermisoService, Permiso } from '../services/permiso.service';

// Interfaz extendida para permisos con información del módulo
interface PermisoConModulo extends Permiso {
  modulo_nombre?: string;
  modulo_id?: number;
  modulo_nivel?: number;
}

// PrimeNG Imports
import { TableModule, Table } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { DropdownModule } from 'primeng/dropdown';
import { CheckboxModule } from 'primeng/checkbox';
import { AccordionModule } from 'primeng/accordion';
import { MessageService, ConfirmationService } from 'primeng/api';
import { MultiSelectModule } from 'primeng/multiselect';

@Component({
  selector: 'app-perfiles',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    DialogModule,
    ToastModule,
    ConfirmDialogModule,
    TagModule,
    TooltipModule,
    DropdownModule,
    CheckboxModule,
    AccordionModule,
    MultiSelectModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './perfiles.component.html',
  styleUrl: './perfiles.component.css'
})
export class PerfilesComponent implements OnInit {
  @ViewChild('dt') dt!: Table;

  perfiles: Perfil[] = [];
  perfilesPorModulo: any[] = [];
  modulos: any[] = [];
  modulosJerarquia: any[] = [];
  permisosDisponibles: Permiso[] = [];
  matrizPermisos: any[] = [];
  permisosAgrupados: any[] = [];
  modulosColapsados: Set<number> = new Set();
  
  // Nuevas variables para filtrado
  moduloFiltroId: number | null = null;
  modulosParaFiltro: any[] = [];
  permisosFiltrados: Permiso[] = [];
  
  perfilForm!: FormGroup;
  isLoading = false;
  isSubmitting = false;
  showForm = false;
  showPermisosModal = false;
  editMode = false;
  currentPerfilId?: number;
  currentPerfil?: Perfil;
  selectedModuloId?: number;
  permisosDelModulo: PermisoConModulo[] = [];

  constructor(
    private fb: FormBuilder,
    private perfilService: PerfilService,
    private permisoService: PermisoService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    this.loadPerfiles();
    this.loadModulos();
    this.loadModulosJerarquia();
  }

  initForm(): void {
    this.perfilForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50)]],
      codigo: ['', [Validators.maxLength(20)]],
      descripcion: ['', [Validators.maxLength(255)]],
      permisos_ids: [[]],
      estado: [true]
    });
  }

  loadPerfiles(): void {
    this.isLoading = true;

    this.perfilService.getPerfiles().subscribe({
      next: (response: any) => {
        this.perfiles = response.data || response;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error cargando perfiles:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error al cargar los perfiles'
        });
        this.isLoading = false;
      }
    });
  }

  loadModulos(): void {
    this.permisoService.getModulos().subscribe({
      next: (response: any) => {
        this.modulos = response.data || response;
      },
      error: (error) => {
        console.error('Error cargando módulos:', error);
      }
    });
  }

  /**
   * Cargar TODOS los permisos de TODOS los módulos
   */
  loadTodosLosPermisos(): void {
    // console.log('🔍 Cargando TODOS los permisos de todos los módulos');
    
    // Obtener todos los módulos de la jerarquía
    const todosLosModulos = this.obtenerTodosLosModulosPlanos(this.modulosJerarquia);
    // console.log('📦 Total de módulos:', todosLosModulos.length, todosLosModulos.map(m => m.nombre));
    
    // Cargar permisos de todos los módulos
    this.permisosDisponibles = [];
    let permisosCompletos = 0;
    
    if (todosLosModulos.length === 0) {
      console.warn('⚠️ No hay módulos para cargar');
      this.generarPermisosAgrupadosTodos();
      return;
    }
    
    todosLosModulos.forEach(modulo => {
      this.perfilService.getPermisosDisponibles(modulo.id).subscribe({
        next: (response: any) => {
          const permisos = response.data?.permisos || [];
          // console.log(`✅ Permisos cargados para ${modulo.nombre}:`, permisos.length);
          
          // Agregar información del módulo a cada permiso
          const permisosConModulo = permisos.map((permiso: any) => ({
            ...permiso,
            modulo_nombre: modulo.nombre,
            modulo_id: modulo.id,
            modulo_nivel: modulo.nivel
          }));
          
          this.permisosDisponibles = [...this.permisosDisponibles, ...permisosConModulo];
          
          permisosCompletos++;
          
          // Cuando todos los permisos estén cargados, generar la agrupación
          if (permisosCompletos === todosLosModulos.length) {
            // console.log('🎉 Todos los permisos cargados. Total:', this.permisosDisponibles.length);
            this.generarPermisosAgrupadosTodos();
            this.prepararModulosParaFiltro(); // Preparar módulos para el filtro
          }
        },
        error: (error) => {
          console.error(`❌ Error cargando permisos del módulo ${modulo.nombre}:`, error);
          permisosCompletos++;
          
          if (permisosCompletos === todosLosModulos.length) {
            // console.log('⚠️ Carga completada con errores');
            this.generarPermisosAgrupadosTodos();
          }
        }
      });
    });
  }

  /**
   * Obtener todos los módulos en formato plano con nivel
   */
  obtenerTodosLosModulosPlanos(modulos: any[], nivel: number = 0): any[] {
    let resultado: any[] = [];
    
    modulos.forEach(modulo => {
      resultado.push({ ...modulo, nivel });
      
      if (modulo.hijos && modulo.hijos.length > 0) {
        resultado = resultado.concat(this.obtenerTodosLosModulosPlanos(modulo.hijos, nivel + 1));
      }
    });
    
    return resultado;
  }

  /**
   * Generar permisos agrupados para todos los módulos
   */
  generarPermisosAgrupadosTodos(): void {
    // console.log('📊 Generando permisos agrupados para todos los módulos...');
    
    // Obtener módulos únicos de los permisos
    const modulosUnicos = new Map<number, any>();
    
    this.permisosDisponibles.forEach((permiso: any) => {
      if (!modulosUnicos.has(permiso.modulo_id)) {
        modulosUnicos.set(permiso.modulo_id, {
          modulo_id: permiso.modulo_id,
          modulo_nombre: permiso.modulo_nombre,
          nivel: permiso.modulo_nivel || 0,
          permisos: []
        });
      }
      modulosUnicos.get(permiso.modulo_id)!.permisos.push(permiso);
    });
    
    // Convertir a array y ordenar por nivel
    this.permisosAgrupados = Array.from(modulosUnicos.values())
      .sort((a, b) => a.nivel - b.nivel);
    
    // console.log('✅ Permisos agrupados generados:', this.permisosAgrupados.length, 'grupos');
    this.permisosAgrupados.forEach(g => {
      // console.log(`  - ${g.modulo_nombre} (nivel ${g.nivel}): ${g.permisos.length} permisos`);
    });

    // Colapsar todos los módulos por defecto
    this.modulosColapsados.clear();
    this.permisosAgrupados.forEach(grupo => {
      this.modulosColapsados.add(grupo.modulo_id);
    });
  }

  loadPermisosDisponibles(idModulo: number): void {
    // Buscar el módulo seleccionado en la jerarquía
    const moduloSeleccionado = this.buscarModuloEnJerarquia(idModulo, this.modulosJerarquia);
    
    if (!moduloSeleccionado) {
      this.permisosDisponibles = [];
      this.permisosAgrupados = [];
      return;
    }

    // Obtener todos los módulos (el seleccionado + sus hijos y nietos)
    const todosLosModulos = this.obtenerModuloYHijos(moduloSeleccionado);
    
    // Cargar permisos de todos los módulos
    this.permisosDisponibles = [];
    let permisosCompletos = 0;
    
    todosLosModulos.forEach(modulo => {
      this.perfilService.getPermisosDisponibles(modulo.id).subscribe({
        next: (response: any) => {
          const permisos = response.data?.permisos || [];
          
          // Agregar información del módulo a cada permiso para mejor identificación
          const permisosConModulo = permisos.map((permiso: any) => ({
            ...permiso,
            modulo_nombre: modulo.nombre,
            modulo_id: modulo.id
          }));
          
          this.permisosDisponibles = [...this.permisosDisponibles, ...permisosConModulo];
          
          permisosCompletos++;
          
          // Cuando todos los permisos estén cargados, generar la agrupación
          if (permisosCompletos === todosLosModulos.length) {
            this.generarPermisosAgrupados(moduloSeleccionado);
            this.prepararModulosParaFiltro(); // Preparar módulos para el filtro
          }
        },
        error: (error) => {
          console.error(`Error cargando permisos del módulo ${modulo.nombre}:`, error);
          permisosCompletos++;
          
          if (permisosCompletos === todosLosModulos.length) {
            this.generarPermisosAgrupados(moduloSeleccionado);
            this.prepararModulosParaFiltro(); // Preparar módulos para el filtro
          }
        }
      });
    });
  }

  generarPermisosAgrupados(moduloSeleccionado: any): void {
    // Obtener todos los módulos en jerarquía con nivel
    const todosLosModulos = this.obtenerModuloYHijosConNivel(moduloSeleccionado, 0);
    
    // Agrupar permisos por módulo
    this.permisosAgrupados = todosLosModulos.map(modulo => {
      const permisosModulo = this.permisosDisponibles.filter(
        (p: any) => p.modulo_id === modulo.id
      );

      return {
        modulo_id: modulo.id,
        modulo_nombre: modulo.nombre,
        nivel: modulo.nivel,
        permisos: permisosModulo
      };
    }).filter(grupo => grupo.permisos.length > 0); // Solo módulos con permisos

    // Colapsar todos los módulos por defecto
    this.modulosColapsados.clear();
    this.permisosAgrupados.forEach(grupo => {
      this.modulosColapsados.add(grupo.modulo_id);
    });
  }

  toggleForm(): void {
    this.showForm = !this.showForm;
    if (this.showForm && !this.editMode) {
      // Cargar todos los permisos al abrir el formulario
      this.loadTodosLosPermisos();
    }
    if (!this.showForm) {
      this.perfilForm.reset({ 
        estado: true,
        permisos_ids: []
      });
      this.editMode = false;
      this.currentPerfilId = undefined;
      this.permisosDisponibles = [];
      this.permisosAgrupados = [];
      this.modulosColapsados.clear();
    }
  }

  onSubmit(): void {
    if (this.perfilForm.invalid) {
      this.perfilForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;

    const perfilData: CreatePerfilRequest = this.perfilForm.value;

    if (this.editMode && this.currentPerfilId) {
      this.perfilService.updatePerfil(this.currentPerfilId, perfilData).subscribe({
        next: (response: any) => {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: response.message || 'Perfil actualizado exitosamente'
          });
          this.perfilForm.reset({ estado: true });
          this.showForm = false;
          this.editMode = false;
          this.loadPerfiles();
          this.isSubmitting = false;
        },
        error: (error) => {
          console.error('Error actualizando perfil:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: error.error?.message || 'Error al actualizar el perfil'
          });
          this.isSubmitting = false;
        }
      });
    } else {
      this.perfilService.createPerfil(perfilData).subscribe({
        next: (response: any) => {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: response.message || 'Perfil creado exitosamente'
          });
          this.perfilForm.reset({ estado: true });
          this.showForm = false;
          this.loadPerfiles();
          this.isSubmitting = false;
        },
        error: (error) => {
          console.error('Error creando perfil:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: error.error?.message || 'Error al crear el perfil'
          });
          this.isSubmitting = false;
        }
      });
    }
  }

  editPerfil(perfil: Perfil): void {
    this.editMode = true;
    this.currentPerfilId = perfil.id;
    
    // Cargar todos los permisos
    this.loadTodosLosPermisos();
    
    // Extraer IDs de permisos si vienen en la relación
    const permisosIds = perfil.permisos?.map(p => p.id) || [];
    
    this.perfilForm.patchValue({
      nombre: perfil.nombre,
      codigo: perfil.codigo,
      descripcion: perfil.descripcion,
      permisos_ids: permisosIds,
      estado: perfil.estado
    });
    this.showForm = true;
  }

  deletePerfil(perfil: Perfil): void {
    this.confirmationService.confirm({
      message: `¿Estás seguro de eliminar el perfil "${perfil.nombre}"?`,
      header: 'Confirmar Eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.perfilService.deletePerfil(perfil.id).subscribe({
          next: (response: any) => {
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: response.message || 'Perfil eliminado exitosamente'
            });
            this.loadPerfiles();
          },
          error: (error) => {
            console.error('Error eliminando perfil:', error);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: error.error?.message || 'Error al eliminar el perfil'
            });
          }
        });
      }
    });
  }

  getRolesCount(perfil: Perfil): number {
    return perfil.roles?.length || 0;
  }

  getTotalPerfiles(): number {
    return this.perfiles.length;
  }

  getPerfilesActivos(): number {
    return this.perfiles.filter(p => p.estado).length;
  }

  loadModulosJerarquia(): void {
    this.permisoService.getModulos().subscribe({
      next: (response: any) => {
        const modulos = response.data || response;
        this.modulosJerarquia = this.organizarJerarquia(modulos);
      },
      error: (error) => {
        console.error('Error cargando módulos:', error);
      }
    });
  }

  organizarJerarquia(modulos: any[]): any[] {
    const modulosMap = new Map<number, any>();
    modulos.forEach(modulo => {
      modulosMap.set(modulo.id, { ...modulo, hijos: [] });
    });

    const modulosRaiz: any[] = [];
    
    modulos.forEach(modulo => {
      const moduloActual = modulosMap.get(modulo.id)!;
      
      if (!modulo.id_modulo_padre) {
        modulosRaiz.push(moduloActual);
      } else {
        const padre = modulosMap.get(modulo.id_modulo_padre);
        if (padre) {
          if (!padre.hijos) {
            padre.hijos = [];
          }
          padre.hijos.push(moduloActual);
        } else {
          modulosRaiz.push(moduloActual);
        }
      }
    });

    modulosRaiz.sort((a, b) => a.orden - b.orden);
    return modulosRaiz;
  }

  get modulosParaDropdown(): any[] {
    const aplanar = (modulos: any[], nivel: number = 0): any[] => {
      let resultado: any[] = [];
      
      modulos.forEach(modulo => {
        const prefijo = '　'.repeat(nivel);
        const icono = nivel === 0 ? '📁' : nivel === 1 ? '📂' : '📄';
        
        resultado.push({
          id: modulo.id,
          nombre: `${prefijo}${icono} ${modulo.nombre}`,
          nombreOriginal: modulo.nombre,
          codigo: modulo.codigo,
          nivel: nivel
        });
        
        if (modulo.hijos && modulo.hijos.length > 0) {
          resultado = resultado.concat(aplanar(modulo.hijos, nivel + 1));
        }
      });
      
      return resultado;
    };
    
    return aplanar(this.modulosJerarquia);
  }

  openPermisosModal(perfil: Perfil): void {
    this.currentPerfil = perfil;
    this.selectedModuloId = undefined;
    this.permisosDelModulo = [];
    this.showPermisosModal = true;
  }

  closePermisosModal(): void {
    this.showPermisosModal = false;
    this.currentPerfil = undefined;
    this.selectedModuloId = undefined;
    this.permisosDelModulo = [];
  }

  onModuloChange(event: any): void {
    const moduloId = event.value;
    if (moduloId) {
      this.loadPermisosDelModuloConHijos(moduloId);
    }
  }

  loadPermisosDelModulo(moduloId: number): void {
    this.perfilService.getPermisosDisponibles(moduloId).subscribe({
      next: (response: any) => {
        this.permisosDelModulo = response.data?.permisos || [];
      },
      error: (error) => {
        console.error('Error cargando permisos:', error);
        this.permisosDelModulo = [];
      }
    });
  }

  loadPermisosDelModuloConHijos(moduloId: number): void {
    // Buscar el módulo seleccionado en la jerarquía
    const moduloSeleccionado = this.buscarModuloEnJerarquia(moduloId, this.modulosJerarquia);
    
    if (!moduloSeleccionado) {
      this.permisosDelModulo = [];
      return;
    }

    // Obtener todos los módulos (el seleccionado + sus hijos)
    const todosLosModulos = this.obtenerModuloYHijos(moduloSeleccionado);
    
    // Cargar permisos de todos los módulos
    this.cargarPermisosMultiplesModulos(todosLosModulos);
  }

  buscarModuloEnJerarquia(moduloId: number, modulos: any[]): any {
    for (const modulo of modulos) {
      if (modulo.id === moduloId) {
        return modulo;
      }
      if (modulo.hijos && modulo.hijos.length > 0) {
        const encontrado = this.buscarModuloEnJerarquia(moduloId, modulo.hijos);
        if (encontrado) {
          return encontrado;
        }
      }
    }
    return null;
  }

  obtenerModuloYHijos(modulo: any): any[] {
    const resultado = [modulo];
    
    if (modulo.hijos && modulo.hijos.length > 0) {
      modulo.hijos.forEach((hijo: any) => {
        resultado.push(...this.obtenerModuloYHijos(hijo));
      });
    }
    
    return resultado;
  }

  cargarPermisosMultiplesModulos(modulos: any[]): void {
    this.permisosDelModulo = [];
    
    modulos.forEach(modulo => {
      this.perfilService.getPermisosDisponibles(modulo.id).subscribe({
        next: (response: any) => {
          const permisos = response.data?.permisos || [];
          
          // Agregar información del módulo a cada permiso
          const permisosConModulo: PermisoConModulo[] = permisos.map((permiso: Permiso) => ({
            ...permiso,
            modulo_nombre: modulo.nombre,
            modulo_id: modulo.id,
            modulo_nivel: modulo.nivel || 0
          }));
          
          this.permisosDelModulo = [...this.permisosDelModulo, ...permisosConModulo];
        },
        error: (error) => {
          console.error(`Error cargando permisos del módulo ${modulo.nombre}:`, error);
        }
      });
    });
  }

  togglePermisoEnPerfil(permiso: PermisoConModulo): void {
    // Aquí implementarías la lógica para agregar/quitar el permiso del perfil
    // console.log('Toggle permiso:', permiso);
  }

  onGlobalFilter(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.dt.filterGlobal(input.value, 'contains');
  }

  getModuloNombre(idModulo: number): string {
    const buscarEnArbol = (modulos: any[]): string | null => {
      for (const modulo of modulos) {
        if (modulo.id === idModulo) {
          return modulo.nombre;
        }
        if (modulo.hijos && modulo.hijos.length > 0) {
          const encontrado = buscarEnArbol(modulo.hijos);
          if (encontrado) {
            return encontrado;
          }
        }
      }
      return null;
    };

    return buscarEnArbol(this.modulosJerarquia) || 'Desconocido';
  }

  getPermisosAgrupadosPorModulo(): any[] {
    // Agrupar permisos por módulo
    const grupos = new Map<number, any>();
    
    this.permisosDelModulo.forEach(permiso => {
      const moduloId = permiso.modulo_id;
      
      // Solo procesar si tiene modulo_id definido
      if (moduloId !== undefined) {
        if (!grupos.has(moduloId)) {
          grupos.set(moduloId, {
            modulo_id: moduloId,
            modulo_nombre: permiso.modulo_nombre || 'Sin nombre',
            modulo_nivel: permiso.modulo_nivel || 0,
            permisos: []
          });
        }
        
        grupos.get(moduloId)!.permisos.push(permiso);
      }
    });
    
    // Convertir a array y ordenar por nivel (padres primero)
    return Array.from(grupos.values()).sort((a, b) => a.modulo_nivel - b.modulo_nivel);
  }

  getPermisosDisponiblesAgrupados(): any[] {
    // Agrupar permisos disponibles por módulo para el formulario
    const grupos = new Map<number, any>();
    
    this.permisosDisponibles.forEach((permiso: any) => {
      const moduloId = permiso.modulo_id;
      const moduloNombre = permiso.modulo_nombre || 'Sin módulo';
      
      if (!grupos.has(moduloId)) {
        grupos.set(moduloId, {
          label: moduloNombre,
          value: moduloId,
          items: []
        });
      }
      
      grupos.get(moduloId)!.items.push(permiso);
    });
    
    return Array.from(grupos.values());
  }

  // Retorna la matriz de permisos ya calculada
  getMatrizPermisosJerarquica(): any[] {
    return this.matrizPermisos;
  }

  // Retorna los permisos agrupados ya calculados
  getPermisosAgrupadosSimple(): any[] {
    return this.permisosAgrupados;
  }

  // Toggle colapsar/expandir módulo
  toggleModuloColapsado(moduloId: number): void {
    if (this.modulosColapsados.has(moduloId)) {
      this.modulosColapsados.delete(moduloId);
    } else {
      this.modulosColapsados.add(moduloId);
    }
  }

  // Verificar si un módulo está colapsado
  isModuloColapsado(moduloId: number): boolean {
    return this.modulosColapsados.has(moduloId);
  }

  // Expandir todos los módulos
  expandirTodos(): void {
    this.modulosColapsados.clear();
  }

  // Colapsar todos los módulos
  colapsarTodos(): void {
    this.permisosAgrupados.forEach(grupo => {
      this.modulosColapsados.add(grupo.modulo_id);
    });
  }

  obtenerModuloYHijosConNivel(modulo: any, nivel: number): any[] {
    const resultado = [{ ...modulo, nivel }];
    
    if (modulo.hijos && modulo.hijos.length > 0) {
      modulo.hijos.forEach((hijo: any) => {
        resultado.push(...this.obtenerModuloYHijosConNivel(hijo, nivel + 1));
      });
    }
    
    return resultado;
  }

  isPermisoSeleccionado(permiso: any): boolean {
    if (!permiso) return false;
    const permisosIds = this.perfilForm.get('permisos_ids')?.value || [];
    return permisosIds.includes(permiso.id);
  }

  togglePermisoMatriz(permiso: any): void {
    if (!permiso) return;
    
    const permisosIds = this.perfilForm.get('permisos_ids')?.value || [];
    const index = permisosIds.indexOf(permiso.id);
    
    if (index > -1) {
      permisosIds.splice(index, 1);
    } else {
      permisosIds.push(permiso.id);
    }
    
    this.perfilForm.patchValue({ permisos_ids: [...permisosIds] });
  }

  seleccionarTodoModulo(fila: any): void {
    const permisosIds = this.perfilForm.get('permisos_ids')?.value || [];
    const permisosFila = Object.values(fila.permisos).filter(p => p !== null);
    
    const todosSeleccionados = permisosFila.every((p: any) => 
      permisosIds.includes(p.id)
    );

    if (todosSeleccionados) {
      // Deseleccionar todos
      permisosFila.forEach((p: any) => {
        const index = permisosIds.indexOf(p.id);
        if (index > -1) {
          permisosIds.splice(index, 1);
        }
      });
    } else {
      // Seleccionar todos
      permisosFila.forEach((p: any) => {
        if (!permisosIds.includes(p.id)) {
          permisosIds.push(p.id);
        }
      });
    }
    
    this.perfilForm.patchValue({ permisos_ids: [...permisosIds] });
  }

  todoModuloSeleccionado(fila: any): boolean {
    const permisosIds = this.perfilForm.get('permisos_ids')?.value || [];
    const permisosFila = Object.values(fila.permisos).filter(p => p !== null);
    
    if (permisosFila.length === 0) return false;
    
    return permisosFila.every((p: any) => permisosIds.includes(p.id));
  }

  // ============================================
  // MÉTODOS PARA FILTRADO DE PERMISOS
  // ============================================

  /**
   * Prepara la lista de módulos para el filtro
   */
  prepararModulosParaFiltro(): void {
    const modulosMap = new Map<number, any>();
    
    // Extraer módulos únicos de los permisos disponibles
    this.permisosDisponibles.forEach((permiso: any) => {
      if (!modulosMap.has(permiso.modulo_id)) {
        modulosMap.set(permiso.modulo_id, {
          id: permiso.modulo_id,
          nombre: permiso.modulo_nombre || 'Sin módulo',
          codigo: permiso.modulo_codigo || '',
          nivel: permiso.modulo_nivel || 0,
          permisos_count: 0
        });
      }
      
      // Incrementar contador de permisos
      const modulo = modulosMap.get(permiso.modulo_id);
      if (modulo) {
        modulo.permisos_count++;
      }
    });
    
    this.modulosParaFiltro = Array.from(modulosMap.values())
      .sort((a, b) => {
        // Ordenar por nivel y luego por nombre
        if (a.nivel !== b.nivel) {
          return a.nivel - b.nivel;
        }
        return a.nombre.localeCompare(b.nombre);
      });
    
    // console.log('📋 Módulos para filtro preparados:', this.modulosParaFiltro);
  }

  /**
   * Maneja el cambio de filtro de módulo
   */
  onModuloFiltroChange(): void {
    // console.log('🔍 Filtro de módulo cambiado:', this.moduloFiltroId);
    // No necesitamos hacer nada más, getPermisosFiltrados() se encarga
  }

  /**
   * Obtiene los permisos filtrados según el módulo seleccionado
   */
  getPermisosFiltrados(): Permiso[] {
    if (!this.moduloFiltroId) {
      // Si no hay filtro, mostrar todos
      return this.permisosDisponibles;
    }
    
    // Filtrar por módulo seleccionado
    return this.permisosDisponibles.filter((permiso: any) => 
      permiso.modulo_id === this.moduloFiltroId
    );
  }

  /**
   * Obtiene el nombre corto del módulo para mostrar en las tarjetas
   */
  getModuloNombreCorto(moduloId: number): string {
    const modulo = this.modulosParaFiltro.find(m => m.id === moduloId);
    if (!modulo) return 'Sin módulo';
    
    // Si el nombre es muy largo, truncarlo
    const nombre = modulo.nombre;
    if (nombre.length > 25) {
      return nombre.substring(0, 22) + '...';
    }
    return nombre;
  }

  /**
   * Selecciona todos los permisos visibles (filtrados)
   */
  seleccionarTodosPermisos(): void {
    const permisosFiltrados = this.getPermisosFiltrados();
    const permisosIds = this.perfilForm.get('permisos_ids')?.value || [];
    
    // Agregar todos los permisos filtrados que no estén ya seleccionados
    permisosFiltrados.forEach((permiso: any) => {
      if (!permisosIds.includes(permiso.id)) {
        permisosIds.push(permiso.id);
      }
    });
    
    this.perfilForm.patchValue({ permisos_ids: permisosIds });
    
    this.messageService.add({
      severity: 'success',
      summary: 'Permisos seleccionados',
      detail: `Se seleccionaron ${permisosFiltrados.length} permisos`,
      life: 2000
    });
  }

  /**
   * Deselecciona todos los permisos visibles (filtrados)
   */
  deseleccionarTodosPermisos(): void {
    const permisosFiltrados = this.getPermisosFiltrados();
    let permisosIds = this.perfilForm.get('permisos_ids')?.value || [];
    
    // Remover todos los permisos filtrados
    const idsARemover = permisosFiltrados.map((p: any) => p.id);
    permisosIds = permisosIds.filter((id: number) => !idsARemover.includes(id));
    
    this.perfilForm.patchValue({ permisos_ids: permisosIds });
    
    this.messageService.add({
      severity: 'info',
      summary: 'Permisos deseleccionados',
      detail: `Se deseleccionaron ${permisosFiltrados.length} permisos`,
      life: 2000
    });
  }

}
