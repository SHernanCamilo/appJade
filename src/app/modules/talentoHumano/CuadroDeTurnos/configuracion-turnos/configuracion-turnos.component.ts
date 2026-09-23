import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TabViewModule } from 'primeng/tabview';
import { DropdownModule } from 'primeng/dropdown';

import { ParametrizacionComponent } from '../parametrizacion/parametrizacion.component';
import { CierreCuadroComponent } from '../cierre-cuadro/cierre-cuadro.component';
import { ConceptosCuadroComponent } from '../conceptos-cuadro/conceptos-cuadro.component';
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';
import { PermissionService } from '../../../../core/services/permission.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-configuracion-turnos',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TabViewModule,
    DropdownModule,
    ParametrizacionComponent,
    CierreCuadroComponent,
    ConceptosCuadroComponent,
    HasPermissionDirective
  ],
  templateUrl: './configuracion-turnos.component.html',
  styleUrls: ['./configuracion-turnos.component.css']
})
export class ConfiguracionTurnosComponent implements OnInit {

  // ─── Selector de empresa GLOBAL, compartido por los 3 tabs ───
  empresasOptions: { label: string; value: number }[] = [];
  selectedEmpresa: number | null = null;
  esAdmin = false;          // más de una empresa => puede elegir (dropdown)
  empresasLoaded = false;

  constructor(
    public permissionService: PermissionService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.cargarEmpresas();
  }

  /**
   * Carga las empresas habilitadas para el usuario.
   * - Más de una => admin, muestra dropdown.
   * - Una sola => label fijo y se selecciona automáticamente.
   */
  private cargarEmpresas(): void {
    this.http.get<any>(`${environment.URL_SERVICIOS}/turnos/cuadro-turno-permisos/empresas`).subscribe({
      next: (resp) => {
        const empresas = resp.data || [];
        this.empresasOptions = empresas.map((e: any) => ({ label: e.nombre, value: e.id }));
        this.esAdmin = this.empresasOptions.length > 1;
        if (this.empresasOptions.length >= 1) {
          this.selectedEmpresa = this.empresasOptions[0].value;
        }
        this.empresasLoaded = true;
      },
      error: () => { this.empresasLoaded = true; }
    });
  }

  onEmpresaChange(): void {
    // El cambio se propaga a los hijos vía binding [idEmpresa].
  }

  /** Nombre de la empresa seleccionada (para el label fijo). */
  getNombreEmpresaSel(): string {
    return this.empresasOptions.find(e => e.value === this.selectedEmpresa)?.label || '—';
  }

  canEditConfig(): boolean { return this.permissionService.hasPermission('talhum-turnos-config-editar'); }
}
