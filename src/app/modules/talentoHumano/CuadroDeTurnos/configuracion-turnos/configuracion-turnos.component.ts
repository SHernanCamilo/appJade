import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TabViewModule } from 'primeng/tabview';

import { ParametrizacionComponent } from '../parametrizacion/parametrizacion.component';
import { CierreCuadroComponent } from '../cierre-cuadro/cierre-cuadro.component';
import { ConceptosCuadroComponent } from '../conceptos-cuadro/conceptos-cuadro.component';
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';
import { PermissionService } from '../../../../core/services/permission.service';
import { ParametrizacionService } from '../services/parametrizacion.service';
import { ConceptoService } from '../services/concepto.service';
import { CierreCuadroService } from '../services/cierre-cuadro.service';

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
export class ConfiguracionTurnosComponent implements OnInit {

  constructor(
    public permissionService: PermissionService,
    private parametrizacionService: ParametrizacionService,
    private conceptoService: ConceptoService,
    private cierreCuadroService: CierreCuadroService
  ) {}

  ngOnInit(): void {
    // Precargar en paralelo la data de los 3 tabs al entrar. Cada servicio
    // cachea su resultado, asi cuando el usuario abre cualquier tab los datos
    // ya estan listos (o llegando). No bloquea la UI: cada hijo muestra su
    // propio skeleton mientras su data llega.
    this.parametrizacionService.getParametrosJornada().subscribe({ error: () => {} });
    this.conceptoService.getAll().subscribe({ error: () => {} });
    this.conceptoService.getVariables().subscribe({ error: () => {} });
    this.cierreCuadroService.getParametros().subscribe({ error: () => {} });
  }

  canEditConfig(): boolean { return this.permissionService.hasPermission('talhum-turnos-config-editar'); }
}
