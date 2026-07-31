import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { PerfilService, Perfil, CreatePerfilRequest } from '../services/perfil.service';
import { PermisoService, Permiso } from '../services/permiso.service';
import { DataTableComponent } from '../../../../complements/shared/data-table/data-table.component';
import { TableColumn } from '../../../../complements/shared/data-table/table-column.model';

// PrimeNG Imports
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

// Interfaz extendida para permisos con información del módulo
interface PermisoConModulo extends Permiso {
  modulo_nombre?: string;
  modulo_id?: number;
  modulo_nivel?: number;
}

@Component({
  selector: 'app-perfiles',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    FormsModule,
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
    MultiSelectModule,
    DataTableComponent
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './perfiles.component.html',
  styleUrl: './perfiles.component.css'
})
export class PerfilesComponent implements OnInit {
  perfiles: Perfil[] = [];
  columns: TableColumn[] = [];
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

  // Árbol de permisos (rediseño tipo árbol con Sí/No por acción)
  arbolPermisos: any[] = [];
  arbolMostrado: any[] = [];
  isLoadingPermisos = false;
  filtroPermiso = '';
  // Fuente única de selección para el árbol (la usan tanto el form como el modal "Ver permisos")
  private _permisosSeleccionados: number[] = [];
  permisosSeleccionadosSet = new Set<number>();
  isSavingPermisosModal = false;

  get permisosSeleccionados(): number[] {
    return this._permisosSeleccionados;
  }

  set permisosSeleccionados(ids: number[]) {
    this._permisosSeleccionados = ids || [];
    this.permisosSeleccionadosSet = new Set(this._permisosSeleccionados);
  }

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
    this.buildColumns();
    this.loadPerfiles();
    this.loadModulos();
    this.loadModulosJerarquia();
  }

  buildColumns(): void {
    this.columns = [
      { field: 'nombre', header: 'Perfil', sortable: true, filter: true, filterType: 'text' },
      { field: 'modulo', header: 'Módulo' },
      { field: 'permisos', header: 'Permisos' },
      {
        field: 'estado',
        header: 'Estado',
        sortable: true,
        filter: true,
        filterType: 'select',
        filterOptions: [
          { label: 'Activo', value: true },
          { label: 'Inactivo', value: false }
        ]
      }
    ];
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
   * Cargar TODOS los módulos y permisos en una sola pasada (2 peticiones en paralelo).
   * Reemplaza el esquema anterior que hacía una petición HTTP por cada módulo (N+1).
   */
  loadTodosLosPermisos(): void {
    this.isLoadingPermisos = true;
    this.permisosDisponibles = [];
    this.arbolPermisos = [];
    this.arbolMostrado = [];

    forkJoin({
      modulos: this.permisoService.getModulos(),
      permisos: this.permisoService.getPermisos()
    }).subscribe({
      next: ({ modulos, permisos }) => {
        const modulosData: any[] = (modulos as any).data || (modulos as any) || [];
        const permisosData: any[] = (permisos as any).data || (permisos as any) || [];

        // Solo permisos activos disponibles para asignar
        const permisosActivos = permisosData.filter((p: any) => !!p.estado);

        // Mapa id_modulo -> nombre (para enriquecer permisos que no traen el nombre del módulo)
        const moduloNombre = new Map<number, string>();
        modulosData.forEach((m: any) => moduloNombre.set(m.id, m.nombre));

        this.permisosDisponibles = permisosActivos.map((p: any) => ({
          ...p,
          modulo_id: p.id_modulo,
          modulo_nombre: p.modulo_nombre || moduloNombre.get(p.id_modulo) || 'Sin módulo'
        }));

        this.construirArbolPermisos(modulosData, this.permisosDisponibles);
        this.prepararModulosParaFiltro();
        this.isLoadingPermisos = false;
      },
      error: (error) => {
        console.error('❌ Error cargando módulos/permisos:', error);
        this.isLoadingPermisos = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los permisos'
        });
      }
    });
  }

  /**
   * Construye el árbol jerárquico de módulos con sus permisos.
   * Solo se incluyen módulos que tienen permisos en su subárbol.
   */
  construirArbolPermisos(modulos: any[], permisos: any[]): void {
    // Agrupar permisos por módulo
    const permisosPorModulo = new Map<number, any[]>();
    permisos.forEach((p: any) => {
      if (!permisosPorModulo.has(p.id_modulo)) {
        permisosPorModulo.set(p.id_modulo, []);
      }
      permisosPorModulo.get(p.id_modulo)!.push(p);
    });
    permisosPorModulo.forEach(arr => arr.sort((a, b) => (a.orden || 0) - (b.orden || 0)));

    // Crear nodos
    const nodeMap = new Map<number, any>();
    modulos.forEach((m: any) => {
      nodeMap.set(m.id, {
        ...m,
        permisos: permisosPorModulo.get(m.id) || [],
        hijos: []
      });
    });

    // Enlazar jerarquía
    const raiz: any[] = [];
    modulos.forEach((m: any) => {
      const node = nodeMap.get(m.id)!;
      if (m.id_modulo_padre && nodeMap.has(m.id_modulo_padre)) {
        nodeMap.get(m.id_modulo_padre)!.hijos.push(node);
      } else {
        raiz.push(node);
      }
    });

    // Ordenar recursivamente por 'orden'
    const ordenar = (nodes: any[]) => {
      nodes.sort((a, b) => (a.orden || 0) - (b.orden || 0));
      nodes.forEach(n => ordenar(n.hijos));
    };
    ordenar(raiz);

    // Filtrar módulos sin permisos en su subárbol
    const tienePermisos = (node: any): boolean =>
      node.permisos.length > 0 || node.hijos.some((h: any) => tienePermisos(h));
    const filtrar = (nodes: any[]): any[] =>
      nodes
        .filter(n => tienePermisos(n))
        .map(n => ({ ...n, hijos: filtrar(n.hijos) }));

    this.arbolPermisos = filtrar(raiz);

    // Precomputar IDs de permisos por subárbol (para conteos O(1) en la vista)
    const indexar = (nodo: any): number[] => {
      let ids = (nodo.permisos || []).map((p: any) => p.id);
      (nodo.hijos || []).forEach((h: any) => {
        ids = ids.concat(indexar(h));
      });
      nodo._idsPermisos = ids;
      return ids;
    };
    this.arbolPermisos.forEach(indexar);

    // El árbol mostrado arranca igual al completo
    this.arbolMostrado = this.arbolPermisos;

    // Colapsar todo por defecto
    this.modulosColapsados.clear();
    const colapsar = (nodes: any[]) => nodes.forEach(n => {
      this.modulosColapsados.add(n.id);
      colapsar(n.hijos);
    });
    colapsar(this.arbolPermisos);
  }

  /**
   * IDs de todos los permisos de un nodo (incluyendo hijos), precomputado en construirArbolPermisos.
   */
  private idsPermisosNodo(nodo: any): number[] {
    return nodo._idsPermisos || [];
  }

  contarPermisosNodo(nodo: any): number {
    return this.idsPermisosNodo(nodo).length;
  }

  contarSeleccionadosNodo(nodo: any): number {
    let n = 0;
    for (const id of this.idsPermisosNodo(nodo)) {
      if (this.permisosSeleccionadosSet.has(id)) n++;
    }
    return n;
  }

  nodoTodoSeleccionado(nodo: any): boolean {
    const ids = this.idsPermisosNodo(nodo);
    if (ids.length === 0) return false;
    return ids.every((id: number) => this.permisosSeleccionadosSet.has(id));
  }

  nodoParcialSeleccionado(nodo: any): boolean {
    const ids = this.idsPermisosNodo(nodo);
    if (ids.length === 0) return false;
    const seleccionados = this.contarSeleccionadosNodo(nodo);
    return seleccionados > 0 && seleccionados < ids.length;
  }

  /**
   * Activa o desactiva todos los permisos de un módulo (y sus hijos).
   */
  toggleSeleccionNodo(nodo: any, event?: Event): void {
    event?.stopPropagation();
    const idsNodo = this.idsPermisosNodo(nodo);
    const seleccion = [...this.permisosSeleccionados];
    const todos = idsNodo.length > 0 && idsNodo.every((id: number) => this.permisosSeleccionadosSet.has(id));

    if (todos) {
      const remover = new Set(idsNodo);
      this.permisosSeleccionados = seleccion.filter((id: number) => !remover.has(id));
    } else {
      const actuales = new Set(seleccion);
      idsNodo.forEach((id: number) => {
        if (!actuales.has(id)) seleccion.push(id);
      });
      this.permisosSeleccionados = seleccion;
    }
  }

  /**
   * Establece explícitamente el estado Sí/No de un permiso.
   */
  setPermiso(permiso: any, valor: boolean, event?: Event): void {
    event?.stopPropagation();
    const ids = [...this.permisosSeleccionados];
    const idx = ids.indexOf(permiso.id);
    if (valor && idx === -1) {
      ids.push(permiso.id);
    } else if (!valor && idx > -1) {
      ids.splice(idx, 1);
    }
    this.permisosSeleccionados = ids;
  }

  /**
   * Da todos los permisos disponibles.
   */
  darTodosLosPermisos(): void {
    this.permisosSeleccionados = this.permisosDisponibles.map((p: any) => p.id);
  }

  /**
   * Quita todos los permisos.
   */
  quitarTodosLosPermisos(): void {
    this.permisosSeleccionados = [];
  }

  /**
   * Indica si hay un texto de búsqueda activo.
   */
  hayFiltroPermiso(): boolean {
    return !!this.filtroPermiso && this.filtroPermiso.trim().length > 0;
  }

  /**
   * Recalcula el árbol visible. Se llama SOLO cuando cambia el texto de búsqueda,
   * evitando reconstruir el árbol en cada ciclo de detección de cambios (causa de bloqueos).
   */
  onFiltroPermisoChange(): void {
    this.arbolMostrado = this.hayFiltroPermiso()
      ? this.filtrarArbol(this.arbolPermisos, this.filtroPermiso)
      : this.arbolPermisos;
  }

  trackByNodo = (_: number, nodo: any) => nodo.id;
  trackByPermiso = (_: number, permiso: any) => permiso.id;

  /**
   * Un nodo se considera expandido si hay búsqueda activa (auto-expandir)
   * o si no está marcado como colapsado.
   */
  estaNodoExpandido(nodo: any): boolean {
    return this.hayFiltroPermiso() || !this.isModuloColapsado(nodo.id);
  }

  /**
   * Filtra el árbol por nombre/código de módulo o de permiso.
   */
  filtrarArbol(nodos: any[], termino: string): any[] {
    const t = termino.trim().toLowerCase();
    const norm = (s: any) => (s ? String(s).toLowerCase() : '');

    const filtrarNodo = (nodo: any): any | null => {
      const moduloMatch = norm(nodo.nombre).includes(t) || norm(nodo.codigo).includes(t);
      const permisosFiltrados = moduloMatch
        ? nodo.permisos
        : (nodo.permisos || []).filter(
            (p: any) => norm(p.nombre).includes(t) || norm(p.codigo).includes(t)
          );
      const hijosFiltrados = (nodo.hijos || [])
        .map(filtrarNodo)
        .filter((n: any) => n !== null);

      if (moduloMatch || permisosFiltrados.length > 0 || hijosFiltrados.length > 0) {
        return { ...nodo, permisos: permisosFiltrados, hijos: hijosFiltrados };
      }
      return null;
    };

    return nodos.map(filtrarNodo).filter((n: any) => n !== null);
  }

  limpiarFiltroPermiso(): void {
    this.filtroPermiso = '';
    this.onFiltroPermisoChange();
  }

  expandirTodosArbol(): void {
    this.modulosColapsados.clear();
  }

  colapsarTodosArbol(): void {
    this.modulosColapsados.clear();
    const colapsar = (nodes: any[]) => nodes.forEach(n => {
      this.modulosColapsados.add(n.id);
      colapsar(n.hijos);
    });
    colapsar(this.arbolPermisos);
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
      this.permisosSeleccionados = [];
      this.filtroPermiso = '';
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
      this.arbolPermisos = [];
      this.arbolMostrado = [];
      this.permisosSeleccionados = [];
      this.filtroPermiso = '';
      this.modulosColapsados.clear();
    }
  }

  onSubmit(): void {
    if (this.perfilForm.invalid) {
      this.perfilForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;

    const perfilData: CreatePerfilRequest = {
      ...this.perfilForm.value,
      permisos_ids: this.permisosSeleccionados
    };

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
    this.filtroPermiso = '';

    // Selección inicial = permisos actuales del perfil
    this.permisosSeleccionados = perfil.permisos?.map(p => p.id) || [];

    // Cargar todos los permisos
    this.loadTodosLosPermisos();

    this.perfilForm.patchValue({
      nombre: perfil.nombre,
      codigo: perfil.codigo,
      descripcion: perfil.descripcion,
      permisos_ids: this.permisosSeleccionados,
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
    this.filtroPermiso = '';

    // Selección inicial = permisos actuales del perfil + cargar el árbol
    this.permisosSeleccionados = perfil.permisos?.map(p => p.id) || [];
    this.loadTodosLosPermisos();

    this.showPermisosModal = true;
  }

  closePermisosModal(): void {
    this.showPermisosModal = false;
    this.currentPerfil = undefined;
    this.selectedModuloId = undefined;
    this.permisosDelModulo = [];
    this.permisosSeleccionados = [];
    this.arbolPermisos = [];
    this.arbolMostrado = [];
    this.permisosDisponibles = [];
    this.filtroPermiso = '';
  }

  /**
   * Guarda los permisos seleccionados en el modal "Ver permisos".
   */
  guardarPermisosModal(): void {
    if (!this.currentPerfil) return;

    this.isSavingPermisosModal = true;
    this.perfilService.updatePerfil(this.currentPerfil.id, {
      permisos_ids: this.permisosSeleccionados
    }).subscribe({
      next: (response: any) => {
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: response.message || 'Permisos actualizados exitosamente'
        });
        this.isSavingPermisosModal = false;
        this.closePermisosModal();
        this.loadPerfiles();
      },
      error: (error) => {
        console.error('Error guardando permisos:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: error.error?.message || 'Error al guardar los permisos'
        });
        this.isSavingPermisosModal = false;
      }
    });
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
    return this.permisosSeleccionadosSet.has(permiso.id);
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
