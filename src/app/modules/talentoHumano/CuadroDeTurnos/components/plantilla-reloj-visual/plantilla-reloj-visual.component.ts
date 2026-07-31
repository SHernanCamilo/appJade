import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RangoHorario } from '../../models/cuadro-turnos.models';
import { describeArc, duracionHoras, formatHora12, minutosToAngle, timeToMinutes } from '../../utils/horario.util';

interface ArcSegment {
  path: string;
  color: string;
  etiqueta: string;
  esEvento?: boolean;
}

@Component({
  selector: 'app-plantilla-reloj-visual',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './plantilla-reloj-visual.component.html',
  styleUrls: ['./plantilla-reloj-visual.component.css']
})
export class PlantillaRelojVisualComponent {
  private readonly cx = 100;
  private readonly cy = 100;
  private readonly rOuter = 78;
  private readonly rInner = 58;

  @Input({ required: true }) set rangos(value: RangoHorario[]) {
    this.rangosSignal.set(value ?? []);
  }

  @Input() titulo = 'Horario del turno';
  @Input() vacio = false;

  private rangosSignal = signal<RangoHorario[]>([]);

  readonly hourMarks = [0, 6, 12, 18];

  readonly hourMarkPositions = computed(() =>
    this.hourMarks.map(h => {
      const angle = (h / 24) * 2 * Math.PI;
      return {
        h: h === 0 ? '24' : String(h),
        x: 100 + 68 * Math.sin(angle),
        y: 100 - 68 * Math.cos(angle)
      };
    })
  );

  readonly arcos = computed<ArcSegment[]>(() =>
    this.rangosSignal().map(r => {
      const startMin = timeToMinutes(r.inicio);
      let endMin = timeToMinutes(r.fin);
      if (endMin <= startMin) endMin += 24 * 60;
      const startDeg = minutosToAngle(startMin);
      const endDeg = minutosToAngle(endMin % (24 * 60));
      return {
        path: describeArc(this.cx, this.cy, this.rOuter, startDeg, endDeg),
        color: r.color,
        etiqueta: r.etiqueta,
        esEvento: r.esEvento
      };
    })
  );

  readonly totalHoras = computed(() =>
    this.rangosSignal().reduce((acc, r) => acc + duracionHoras(r.inicio, r.fin), 0)
  );

  readonly leyenda = computed(() => this.rangosSignal());

  formatHora = formatHora12;
}
