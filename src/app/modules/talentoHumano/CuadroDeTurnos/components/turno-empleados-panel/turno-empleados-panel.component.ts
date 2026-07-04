import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CheckboxModule } from 'primeng/checkbox';
import { DropdownOption, EmpleadoTurno } from '../../models/cuadro-turnos.models';

@Component({
  selector: 'app-turno-empleados-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, CheckboxModule],
  templateUrl: './turno-empleados-panel.component.html',
  styleUrls: ['./turno-empleados-panel.component.css']
})
export class TurnoEmpleadosPanelComponent {
  @Input({ required: true }) empleados: DropdownOption<EmpleadoTurno>[] = [];
  @Input({ required: true }) selectedIds: number[] = [];
  @Input() sinUnidad = false;
  @Input() cargando = false;

  @Output() toggle = new EventEmitter<number>();
  @Output() toggleAll = new EventEmitter<void>();

  isSelected(id: number): boolean {
    return this.selectedIds.includes(id);
  }
}
