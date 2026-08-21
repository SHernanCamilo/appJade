import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TabViewModule } from 'primeng/tabview';

import { ParametrizacionComponent } from '../parametrizacion/parametrizacion.component';
import { CierreCuadroComponent } from '../cierre-cuadro/cierre-cuadro.component';
import { ConceptosCuadroComponent } from '../conceptos-cuadro/conceptos-cuadro.component';
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';
import { PermissionService } from '../../../../core/services/permission.service';

@Component({
  selector: 'app-configuracion-turnos',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TabViewModule,
    ParametrizacionComponent,
    CierreCuadroComponent,
    ConceptosCuadroComponent,
    HasPermissionDirective
  ],
  templateUrl: './configuracion-turnos.component.html',
  styleUrls: ['./configuracion-turnos.component.css']
})
export class ConfiguracionTurnosComponent {
  constructor(public permissionService: PermissionService) {}

  canEditConfig(): boolean { return this.permissionService.hasPermission('talhum-turnos-config-editar'); }
}
