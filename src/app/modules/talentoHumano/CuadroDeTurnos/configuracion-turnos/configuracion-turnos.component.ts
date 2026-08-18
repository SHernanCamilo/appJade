import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TabViewModule } from 'primeng/tabview';

import { ParametrizacionComponent } from '../parametrizacion/parametrizacion.component';
import { CierreCuadroComponent } from '../cierre-cuadro/cierre-cuadro.component';
import { ConceptosCuadroComponent } from '../conceptos-cuadro/conceptos-cuadro.component';

@Component({
  selector: 'app-configuracion-turnos',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TabViewModule,
    ParametrizacionComponent,
    CierreCuadroComponent,
    ConceptosCuadroComponent
  ],
  templateUrl: './configuracion-turnos.component.html',
  styleUrls: ['./configuracion-turnos.component.css']
})
export class ConfiguracionTurnosComponent {}
