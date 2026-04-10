import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ModuloService, Modulo, MatrizPermisos } from '../services/modulo.service';
import { AllowedDomainService, AllowedDomain } from '../services/allowed-domain.service';

// PrimeNG Imports
import { TableModule, Table } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ToastModule } from 'primeng/toast';
import { AvatarModule } from 'primeng/avatar';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-modulos',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    ReactiveFormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    DialogModule,
    TagModule,
    TooltipModule,
    ToastModule,
    AvatarModule
  ],
  providers: [MessageService],
  templateUrl: './modulos.component.html',
  styleUrls: ['./modulos.component.css']
})
export class ModulosComponent implements OnInit {
  @ViewChild('dtDomains') dtDomains!: Table;
  
  activeTab: 'modulos' | 'dominios' = 'modulos';
  
  // Módulos
  modulos: Modulo[] = [];
  modulosRaiz: Modulo[] = [];
  loading = false;
  
  // Control de expansión
  expandedModulos: Set<number> = new Set();
  
  // Matriz de permisos
  matrizPermisos: MatrizPermisos[] = [];
  loadingMatriz = false;
  
  // Modal
  showModuloDialog = false;
  editingModulo: Modulo | null = null;
  parentModuloId: number | null = null;
  moduloForm: FormGroup;

  // Modal asignar
  showAsignarDialog = false;
  preselectedEmpresaId: number | null = null;
  asignarForm: FormGroup;
  empresasList: any[] = [];
  
  // Control de expansión de submódulos
  expandedSubmodulos: Set<string> = new Set();

  // Dominios permitidos
  domains: AllowedDomain[] = [];
  loadingDomains = false;
  showDomainDialog = false;
  editingDomain: AllowedDomain | null = null;
  domainForm: FormGroup;

  constructor(
    private moduloService: ModuloService,
    private allowedDomainService: AllowedDomainService,
    private fb: FormBuilder,
    private messageService: MessageService
  ) {
    this.moduloForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.maxLength(50)]],
      codigo: ['', [Validators.required, Validators.maxLength(20)]],
      descripcion: [''],
      icono: [''],
      ruta: [''],
      orden: [0],
      id_modulo_padre: [null],
      estado: [true]
    });

    this.asignarForm = this.fb.group({
      id_empresa: ['', Validators.required],
      id_modulo: ['', Validators.required],
      hereda_hijos: [true],
      activo: [true]
    });

    this.domainForm = this.fb.group({
      domain: ['', [Validators.required, Validators.pattern(/^@?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)]],
      tenant_id: ['', Validators.required],
      tenant_name: ['', [Validators.required, Validators.maxLength(255)]],
      id_empresa: [null],
      descripcion: [''],
      activo: [true]
    });
  }

  ngOnInit(): void {
    this.loadModulos();
    this.loadEmpresas();
  }

  loadEmpresas(): void {
    // Cargar empresas activas desde el backend
    this.moduloService.getEmpresasActivas().subscribe({
      next: (response) => {
        if (response.success) {
          this.empresasList = response.data;
        }
      },
      error: (error) => {
        console.error('Error al cargar empresas:', error);
        this.empresasList = [];
      }
    });
  }

  // Contar módulos activos recursivamente
  contarModulosActivos(): number {
    const contarRecursivo = (modulos: Modulo[]): number => {
      let count = 0;
      for (const modulo of modulos) {
        if (modulo.estado) {
          count++;
        }
        if (modulo.hijos && modulo.hijos.length > 0) {
          count += contarRecursivo(modulo.hijos);
        }
      }
      return count;
    };
    return contarRecursivo(this.modulos);
  }

  // Contar módulos inactivos recursivamente
  contarModulosInactivos(): number {
    const contarRecursivo = (modulos: Modulo[]): number => {
      let count = 0;
      for (const modulo of modulos) {
        if (!modulo.estado) {
          count++;
        }
        if (modulo.hijos && modulo.hijos.length > 0) {
          count += contarRecursivo(modulo.hijos);
        }
      }
      return count;
    };
    return contarRecursivo(this.modulos);
  }

  // Contar total de módulos recursivamente
  contarTotalModulos(): number {
    const contarRecursivo = (modulos: Modulo[]): number => {
      let count = modulos.length;
      for (const modulo of modulos) {
        if (modulo.hijos && modulo.hijos.length > 0) {
          count += contarRecursivo(modulo.hijos);
        }
      }
      return count;
    };
    return contarRecursivo(this.modulos);
  }

  toggleExpand(moduloId: number): void {
    if (this.expandedModulos.has(moduloId)) {
      this.expandedModulos.delete(moduloId);
    } else {
      this.expandedModulos.add(moduloId);
    }
  }

  isExpanded(moduloId: number): boolean {
    return this.expandedModulos.has(moduloId);
  }

  expandAll(): void {
    const expandRecursive = (modulos: Modulo[]) => {
      modulos.forEach(modulo => {
        this.expandedModulos.add(modulo.id);
        if (modulo.hijos && modulo.hijos.length > 0) {
          expandRecursive(modulo.hijos);
        }
      });
    };
    expandRecursive(this.modulos);
  }

  collapseAll(): void {
    this.expandedModulos.clear();
  }

  loadModulos(): void {
    this.loading = true;
    this.moduloService.getModulosTree().subscribe({
      next: (response) => {
        // console.log('Módulos cargados:', response);
        if (response.success) {
          this.modulos = response.data;
          this.modulosRaiz = response.data;
          // NO expandir automáticamente - dejar colapsados por defecto
          // Si quieres expandir solo el primer nivel, descomenta la siguiente línea:
          // this.modulos.forEach(m => this.expandedModulos.add(m.id));
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar módulos:', error);
        this.loading = false;
        alert('Error al cargar los módulos');
      }
    });
  }

  loadMatrizPermisos(): void {
    this.loadingMatriz = true;
    this.moduloService.getMatrizPermisos().subscribe({
      next: (response) => {
        if (response.success) {
          this.matrizPermisos = response.data;
          // Extraer módulos raíz únicos
          if (this.matrizPermisos.length > 0) {
            this.modulosRaiz = this.matrizPermisos[0].modulos.map(m => ({
              id: m.id_modulo,
              nombre: m.nombre,
              codigo: m.codigo,
              icono: null,
              id_modulo_padre: null,
              descripcion: null,
              ruta: null,
              orden: 0,
              nivel: 0,
              estado: true
            }));
          }
        }
        this.loadingMatriz = false;
      },
      error: (error) => {
        console.error('Error al cargar matriz de permisos:', error);
        this.loadingMatriz = false;
        alert('Error al cargar la matriz de permisos');
      }
    });
  }

  openModuloDialog(modulo?: Modulo, parentId?: number): void {
    this.editingModulo = modulo || null;
    this.parentModuloId = parentId || null;

    if (modulo) {
      // Editar módulo existente
      this.moduloForm.patchValue({
        nombre: modulo.nombre,
        codigo: modulo.codigo,
        descripcion: modulo.descripcion,
        icono: modulo.icono,
        ruta: modulo.ruta,
        orden: modulo.orden,
        id_modulo_padre: modulo.id_modulo_padre,
        estado: modulo.estado
      });
    } else if (parentId) {
      // Crear hijo de un módulo
      this.moduloForm.patchValue({
        id_modulo_padre: parentId,
        estado: true,
        orden: 0
      });
    } else {
      // Nuevo módulo raíz
      this.moduloForm.reset({
        id_modulo_padre: null,
        estado: true,
        orden: 0
      });
    }

    this.showModuloDialog = true;
  }

  closeModuloDialog(): void {
    this.showModuloDialog = false;
    this.editingModulo = null;
    this.parentModuloId = null;
    this.moduloForm.reset();
  }

  saveModulo(): void {
    if (this.moduloForm.invalid) {
      return;
    }

    const moduloData = this.moduloForm.value;

    if (this.editingModulo) {
      // Actualizar
      this.moduloService.updateModulo(this.editingModulo.id, moduloData).subscribe({
        next: (response) => {
          if (response.success) {
            alert('Módulo actualizado exitosamente');
            this.closeModuloDialog();
            this.loadModulos();
          }
        },
        error: (error) => {
          console.error('Error al actualizar módulo:', error);
          alert(error.error?.message || 'Error al actualizar el módulo');
        }
      });
    } else {
      // Crear
      this.moduloService.createModulo(moduloData).subscribe({
        next: (response) => {
          if (response.success) {
            alert('Módulo creado exitosamente');
            this.closeModuloDialog();
            this.loadModulos();
          }
        },
        error: (error) => {
          console.error('Error al crear módulo:', error);
          alert(error.error?.message || 'Error al crear el módulo');
        }
      });
    }
  }

  deleteModulo(modulo: Modulo): void {
    if (!confirm(`¿Estás seguro de eliminar el módulo "${modulo.nombre}"?`)) {
      return;
    }

    this.moduloService.deleteModulo(modulo.id).subscribe({
      next: (response) => {
        if (response.success) {
          alert('Módulo eliminado exitosamente');
          this.loadModulos();
        }
      },
      error: (error) => {
        console.error('Error al eliminar módulo:', error);
        alert(error.error?.message || 'Error al eliminar el módulo');
      }
    });
  }

  togglePermiso(idEmpresa: number, idModulo: number, tieneAcceso: boolean): void {
    if (tieneAcceso) {
      // Remover permiso
      if (!confirm('¿Deseas remover el acceso a este módulo?')) {
        return;
      }

      this.moduloService.removerModulo({ id_modulo: idModulo, id_empresa: idEmpresa }).subscribe({
        next: (response) => {
          if (response.success) {
            this.loadMatrizPermisos();
          }
        },
        error: (error) => {
          console.error('Error al remover permiso:', error);
          alert('Error al remover el permiso');
        }
      });
    } else {
      // Asignar permiso
      this.moduloService.asignarModulo({
        id_modulo: idModulo,
        id_empresa: idEmpresa,
        hereda_hijos: true,
        activo: true
      }).subscribe({
        next: (response) => {
          if (response.success) {
            this.loadMatrizPermisos();
          }
        },
        error: (error) => {
          console.error('Error al asignar permiso:', error);
          alert('Error al asignar el permiso');
        }
      });
    }
  }

  // Helper para contar hijos con acceso
  contarHijosConAcceso(hijos: any[]): number {
    if (!hijos || !Array.isArray(hijos)) {
      return 0;
    }
    return hijos.filter(h => h && h.tiene_acceso).length;
  }

  // Helper para contar hijos con acceso recursivamente
  contarHijosConAccesoRecursivo(hijos: any[]): number {
    if (!hijos || !Array.isArray(hijos)) {
      return 0;
    }
    
    let count = 0;
    for (const hijo of hijos) {
      if (hijo) {
        count++; // Contar el hijo actual
        if (hijo.hijos && hijo.hijos.length > 0) {
          count += this.contarHijosConAccesoRecursivo(hijo.hijos);
        }
      }
    }
    return count;
  }

  // Helper para generar tooltip con lista de hijos
  getHijosTooltip(hijos: any[]): string {
    if (!hijos || !Array.isArray(hijos)) {
      return '';
    }
    return hijos.map(h => {
      const icono = h.tiene_acceso ? '✓' : '○';
      return `${icono} ${h.nombre}`;
    }).join('\n');
  }

  // Helper para obtener nombre del módulo por ID
  getModuloNombre(id: number): string {
    const buscarEnArbol = (modulos: Modulo[]): string | null => {
      for (const modulo of modulos) {
        if (modulo.id === id) {
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

    return buscarEnArbol(this.modulos) || 'Desconocido';
  }

  // Helper para obtener icono del módulo por ID
  getModuloIcono(id: number): string | null {
    const buscarEnArbol = (modulos: Modulo[]): string | null => {
      for (const modulo of modulos) {
        if (modulo.id === id) {
          return modulo.icono;
        }
        if (modulo.hijos && modulo.hijos.length > 0) {
          const encontrado = buscarEnArbol(modulo.hijos);
          if (encontrado !== null) {
            return encontrado;
          }
        }
      }
      return null;
    };

    return buscarEnArbol(this.modulos);
  }

  // Contar módulos de una empresa
  contarModulosEmpresa(empresa: any): number {
    return empresa.modulos ? empresa.modulos.length : 0;
  }

  // Modal de asignación
  openAsignarDialog(empresaId?: number): void {
    this.preselectedEmpresaId = empresaId || null;
    
    if (empresaId) {
      this.asignarForm.patchValue({ id_empresa: empresaId });
    } else {
      this.asignarForm.reset({
        hereda_hijos: true,
        activo: true
      });
    }
    
    this.showAsignarDialog = true;
  }

  closeAsignarDialog(): void {
    this.showAsignarDialog = false;
    this.preselectedEmpresaId = null;
    this.asignarForm.reset();
  }

  saveAsignacion(): void {
    if (this.asignarForm.invalid) {
      return;
    }

    const asignacionData = this.asignarForm.value;

    this.moduloService.asignarModulo(asignacionData).subscribe({
      next: (response) => {
        if (response.success) {
          alert('Módulo asignado exitosamente');
          this.closeAsignarDialog();
          this.loadMatrizPermisos();
        }
      },
      error: (error) => {
        console.error('Error al asignar módulo:', error);
        alert(error.error?.message || 'Error al asignar el módulo');
      }
    });
  }

  // Remover asignación
  removerAsignacion(empresaId: number, moduloId: number): void {
    if (!confirm('¿Está seguro de remover esta autorización?')) {
      return;
    }

    this.moduloService.removerModulo({ 
      id_empresa: empresaId, 
      id_modulo: moduloId 
    }).subscribe({
      next: (response) => {
        if (response.success) {
          alert('Autorización removida exitosamente');
          this.loadMatrizPermisos();
        }
      },
      error: (error) => {
        console.error('Error al remover autorización:', error);
        alert(error.error?.message || 'Error al remover la autorización');
      }
    });
  }

  // Control de expansión de submódulos
  toggleSubmodulos(empresaId: number, moduloId: number): void {
    const key = `${empresaId}-${moduloId}`;
    if (this.expandedSubmodulos.has(key)) {
      this.expandedSubmodulos.delete(key);
    } else {
      this.expandedSubmodulos.add(key);
    }
  }

  isSubmodulosExpanded(empresaId: number, moduloId: number): boolean {
    const key = `${empresaId}-${moduloId}`;
    return this.expandedSubmodulos.has(key);
  }

  // ========== GESTIÓN DE DOMINIOS ==========

  loadDomains(): void {
    this.loadingDomains = true;
    this.allowedDomainService.getAll().subscribe({
      next: (response) => {
        // console.log('Dominios cargados:', response);
        this.domains = response.domains || [];
        this.loadingDomains = false;
      },
      error: (error) => {
        console.error('Error al cargar dominios:', error);
        this.loadingDomains = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error al cargar los dominios permitidos'
        });
      }
    });
  }

  onGlobalFilterDomains(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.dtDomains.filterGlobal(input.value, 'contains');
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }

  openDomainDialog(domain?: AllowedDomain): void {
    this.editingDomain = domain || null;

    if (domain) {
      // Editar dominio existente
      this.domainForm.patchValue({
        domain: domain.domain,
        tenant_id: domain.tenant_id,
        tenant_name: domain.tenant_name,
        id_empresa: domain.id_empresa,
        descripcion: domain.descripcion,
        activo: domain.activo
      });
    } else {
      // Nuevo dominio
      this.domainForm.reset({
        activo: true
      });
    }

    this.showDomainDialog = true;
  }

  closeDomainDialog(): void {
    this.showDomainDialog = false;
    this.editingDomain = null;
    this.domainForm.reset();
  }

  saveDomain(): void {
    if (this.domainForm.invalid) {
      return;
    }

    const domainData = this.domainForm.value;

    // Asegurar que el dominio tenga @
    if (domainData.domain && !domainData.domain.startsWith('@')) {
      domainData.domain = '@' + domainData.domain;
    }

    if (this.editingDomain) {
      // Actualizar
      this.allowedDomainService.update(this.editingDomain.id, domainData).subscribe({
        next: (response) => {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Dominio actualizado exitosamente'
          });
          this.closeDomainDialog();
          this.loadDomains();
        },
        error: (error) => {
          console.error('Error al actualizar dominio:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: error.error?.message || 'Error al actualizar el dominio'
          });
        }
      });
    } else {
      // Crear
      this.allowedDomainService.create(domainData).subscribe({
        next: (response) => {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Dominio creado exitosamente'
          });
          this.closeDomainDialog();
          this.loadDomains();
        },
        error: (error) => {
          console.error('Error al crear dominio:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: error.error?.message || 'Error al crear el dominio'
          });
        }
      });
    }
  }

  deleteDomain(domain: AllowedDomain): void {
    if (!confirm(`¿Estás seguro de eliminar el dominio "${domain.domain}"?`)) {
      return;
    }

    this.allowedDomainService.delete(domain.id).subscribe({
      next: (response) => {
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: 'Dominio eliminado exitosamente'
        });
        this.loadDomains();
      },
      error: (error) => {
        console.error('Error al eliminar dominio:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: error.error?.message || 'Error al eliminar el dominio'
        });
      }
    });
  }

  toggleDomainStatus(domain: AllowedDomain): void {
    this.allowedDomainService.toggleStatus(domain.id).subscribe({
      next: (response) => {
        const status = !domain.activo ? 'activado' : 'desactivado';
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: `Dominio ${status} exitosamente`
        });
        this.loadDomains();
      },
      error: (error) => {
        console.error('Error al cambiar estado del dominio:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error al cambiar el estado del dominio'
        });
      }
    });
  }

  getEmpresaNombre(idEmpresa: number | null): string {
    if (!idEmpresa) return 'Sin asignar';
    const empresa = this.empresasList.find(e => e.id === idEmpresa);
    return empresa ? empresa.nombre : 'Desconocida';
  }
}
