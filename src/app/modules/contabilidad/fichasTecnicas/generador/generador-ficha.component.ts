import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { StepsModule } from 'primeng/steps';
import { ToastModule } from 'primeng/toast';

import { ConflictoProfesional, CrearFichaPayload, DetallePayload, OpcionesFormulario } from '../models/ficha.model';
import { FichasTecnicasService } from '../services/fichas-tecnicas.service';
import { ParametrosService } from '../services/parametros.service';
import { ConflictosDialogComponent } from '../shared/conflictos-dialog.component';
import { interpretarErrorFicha } from '../shared/ficha-error.util';
import { PasoDatosComponent } from './components/paso-datos.component';
import { PasoRevisionComponent } from './components/paso-revision.component';
import { PasoServiciosComponent } from './components/paso-servicios.component';

/**
 * Contenedor (smart) del wizard de creación de fichas técnicas.
 *
 * Orquesta los tres pasos y es el único que habla con los servicios HTTP.
 * Reemplaza la cadena `form1.php → insertar.php → form2.php → insertar2.php
 * → form3.php → insertar3.php` del legacy, donde cada transición era un POST
 * con redirect y la ficha podía quedar a medias si el usuario cerraba el
 * navegador entre pasos.
 *
 * Aquí la ficha se crea en un solo commit al confirmar el paso 3.
 */
@Component({
  selector: 'app-generador-ficha',
  standalone: true,
  imports: [
    CommonModule,
    StepsModule,
    ToastModule,
    PasoDatosComponent,
    PasoServiciosComponent,
    PasoRevisionComponent,
    ConflictosDialogComponent,
  ],
  providers: [MessageService],
  template: `
    <p-toast position="top-right" />

    <section class="ft-generador">
      <header class="ft-generador__header">
        <h1>Nueva ficha técnica</h1>
        <p>Complete los tres pasos para crear una ficha y enviarla a validación.</p>
      </header>

      <p-steps [model]="pasos" [activeIndex]="pasoActual" [readonly]="true" />

      @switch (pasoActual) {
        @case (0) {
          <app-paso-datos
            [guardando]="guardando()"
            (continuar)="onPaso1($event)"
          />
        }
        @case (1) {
          <app-paso-servicios
            [guardando]="guardando()"
            (continuar)="onPaso2($event)"
            (volver)="pasoActual = 0"
          />
        }
        @case (2) {
          @if (cabecera()) {
            <app-paso-revision
              [cabecera]="cabecera()!"
              [detalles]="detallesPayload()"
              [opciones]="opciones()"
              [guardando]="guardando()"
              (confirmar)="onConfirmar($event)"
              (volver)="pasoActual = 1"
            />
          }
        }
      }
    </section>

    <app-conflictos-dialog
      [(visible)]="mostrarConflictos"
      [conflictos]="conflictos()"
    />
  `,
  styles: [
    `
      .ft-generador {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding: 1.25rem;
      }

      .ft-generador__header h1 {
        margin: 0;
        font-size: 1.3rem;
        font-weight: 600;
      }

      .ft-generador__header p {
        margin: 0.2rem 0 0;
        font-size: 0.85rem;
        color: #6c757d;
      }
    `,
  ],
})
export class GeneradorFichaComponent {
  private readonly fichaService = inject(FichasTecnicasService);
  private readonly parametrosService = inject(ParametrosService);
  private readonly router = inject(Router);
  private readonly mensajes = inject(MessageService);

  protected pasoActual = 0;
  protected readonly pasos = [
    { label: '1. Datos del contrato' },
    { label: '2. Servicios' },
    { label: '3. Revisión' },
  ];
  protected readonly guardando = signal<boolean>(false);
  protected readonly cabecera = signal<CrearFichaPayload | null>(null);
  protected readonly detallesPayload = signal<DetallePayload[]>([]);
  protected readonly opciones = signal<OpcionesFormulario | null>(null);
  protected readonly conflictos = signal<ConflictoProfesional[]>([]);
  protected mostrarConflictos = false;

  constructor() {
    this.parametrosService.opcionesFormulario().subscribe((o) => this.opciones.set(o));
  }

  protected onPaso1(datos: CrearFichaPayload): void {
    // Verificar conflictos antes de avanzar.
    this.guardando.set(true);

    this.fichaService
      .verificarConflictos(datos.profesionales, datos.fecha_ini, datos.fecha_fin)
      .subscribe({
        next: (resp) => {
          this.guardando.set(false);

          if (resp.tiene_conflictos) {
            this.conflictos.set(resp.conflictos);
            this.mostrarConflictos = true;
            return;
          }

          this.cabecera.set(datos);
          this.pasoActual = 1;
        },
        error: (err: unknown) => {
          this.guardando.set(false);
          this.mostrarError(err);
        },
      });
  }

  protected onPaso2(items: DetallePayload[]): void {
    this.detallesPayload.set(items);
    this.pasoActual = 2;
  }

  protected onConfirmar(observacion: string): void {
    const cabecera = this.cabecera();

    if (!cabecera) {
      return;
    }

    this.guardando.set(true);

    // 1. Crear la ficha con sus profesionales.
    this.fichaService.crear(cabecera).subscribe({
      next: (ficha) => {
        // 2. Guardar servicios en lote.
        this.fichaService.guardarDetalles(ficha.id, this.detallesPayload()).subscribe({
          next: () => {
            // 3. Observación (opcional).
            if (observacion) {
              this.fichaService.agregarObservacion(ficha.id, observacion).subscribe();
            }

            this.guardando.set(false);
            this.mensajes.add({
              severity: 'success',
              summary: 'Ficha creada',
              detail: `La ficha #${ficha.id} fue creada y enviada a validación.`,
              life: 5000,
            });

            void this.router.navigate(['/contabilidad/fichas-tecnicas/bandeja/borradores']);
          },
          error: (err: unknown) => {
            this.guardando.set(false);
            this.mostrarError(err);
          },
        });
      },
      error: (err: unknown) => {
        this.guardando.set(false);
        const error = interpretarErrorFicha(err);

        if (error.status === 409 && error.conflictos.length > 0) {
          this.conflictos.set(error.conflictos);
          this.mostrarConflictos = true;
          return;
        }

        this.mostrarError(err);
      },
    });
  }

  private mostrarError(err: unknown): void {
    const { mensaje } = interpretarErrorFicha(err);
    this.mensajes.add({ severity: 'error', summary: 'Error', detail: mensaje, life: 6000 });
  }
}
