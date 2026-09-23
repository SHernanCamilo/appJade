import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { StepsModule } from 'primeng/steps';
import { ToastModule } from 'primeng/toast';
import { forkJoin } from 'rxjs';

import { ActualizarFichaPayload, ConflictoProfesional, CrearFichaPayload, DetalleFicha, DetallePayload, Ficha, OpcionesFormulario } from '../models/ficha.model';
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
        <h1>{{ tituloWizard() }}</h1>
        <p>{{ subtituloWizard() }}</p>
      </header>

      <p-steps
        [model]="pasos"
        [activeIndex]="pasoActual"
        [readonly]="true"
        styleClass="ft-steps"
      />

      @switch (pasoActual) {
        @case (0) {
          @if (!esEdicion() || fichaEdicion()) {
            <app-paso-datos
              [opciones]="opciones()"
              [ficha]="fichaEdicion()"
              [guardando]="guardando()"
              [datosPrevios]="cabecera()"
              (continuar)="onPaso1($event)"
              (profesionalesInfo)="nombresProfesionales.set($event)"
            />
          } @else {
            <p class="ft-generador__cargando">
              <i class="pi pi-spin pi-spinner"></i> Cargando ficha…
            </p>
          }
        }
        @case (1) {
          <app-paso-servicios
            [guardando]="guardando()"
            [detallesExistentes]="detallesExistentes()"
            [detallesPrevios]="detallesPayload()"
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
              [nombresProfesionales]="nombresProfesionales()"
              [observacionesPrevias]="observacionesGenerales()"
              (observacionesCambian)="observacionesGenerales.set($event)"
              (confirmar)="onConfirmar($event)"
              (volver)="pasoActual = 1"
              (volverADatos)="pasoActual = 0"
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

      /* ══ Steps más notorios ══════════════════════════════════════════ */
      :host ::ng-deep .ft-steps {
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 1.1rem 1rem 0.6rem;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
      }

      /* Línea de conexión entre pasos (más gruesa y visible) */
      :host ::ng-deep .ft-steps .p-steps .p-steps-item::before {
        border-top: 3px solid #e2e8f0;
        top: 45%;
      }

      /* Número del paso: círculo grande */
      :host ::ng-deep .ft-steps .p-steps .p-steps-item .p-menuitem-link .p-steps-number {
        width: 2.6rem;
        height: 2.6rem;
        font-size: 1.1rem;
        font-weight: 700;
        border: 2px solid #cbd5e1;
        background: #f8fafc;
        color: #64748b;
        transition: all 0.25s ease;
      }

      /* Etiqueta del paso */
      :host ::ng-deep .ft-steps .p-steps .p-steps-item .p-menuitem-link .p-steps-title {
        font-size: 0.9rem;
        font-weight: 500;
        color: #94a3b8;
        margin-top: 0.45rem;
        transition: color 0.25s ease;
      }

      /* Pasos ya completados (antes del activo) */
      :host ::ng-deep .ft-steps .p-steps .p-steps-item:not(.p-highlight):not(.p-disabled) .p-steps-number {
        border-color: #34d399;
        background: #34d399;
        color: #ffffff;
      }
      :host ::ng-deep .ft-steps .p-steps .p-steps-item:not(.p-highlight):not(.p-disabled) .p-steps-title {
        color: #059669;
      }

      /* Paso ACTIVO: destacado con color primario y escala */
      :host ::ng-deep .ft-steps .p-steps .p-steps-item.p-highlight .p-steps-number {
        border-color: #2563eb;
        background: #2563eb;
        color: #ffffff;
        transform: scale(1.15);
        box-shadow: 0 0 0 6px rgba(37, 99, 235, 0.15);
      }
      :host ::ng-deep .ft-steps .p-steps .p-steps-item.p-highlight .p-steps-title {
        color: #1d4ed8;
        font-weight: 700;
        font-size: 0.95rem;
      }
    `,
  ],
})
export class GeneradorFichaComponent {
  private readonly fichaService = inject(FichasTecnicasService);
  private readonly parametrosService = inject(ParametrosService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
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
  /** Mapa código→nombre de profesionales para mostrar en la revisión. */
  protected readonly nombresProfesionales = signal<Record<string, string>>({});
  /** Observaciones generales del paso 3, conservadas al navegar entre pasos. */
  protected readonly observacionesGenerales = signal<string[]>([]);
  protected mostrarConflictos = false;

  // ── Modo edición / actualización (OS) ──────────────────────────────────
  /** Id de la ficha en edición (null = creación). */
  protected readonly fichaId = signal<number | null>(null);
  /** Ficha cargada para editar (prellena el paso 1). */
  protected readonly fichaEdicion = signal<Ficha | null>(null);
  /** Detalles existentes de la ficha en edición (prellena el paso 2). */
  protected readonly detallesExistentes = signal<DetalleFicha[]>([]);
  /** true cuando se está creando una actualización (OS) sobre una ficha vigente. */
  protected readonly esActualizacion = signal<boolean>(false);

  protected readonly esEdicion = () => this.fichaId() !== null;

  protected readonly tituloWizard = () =>
    this.esActualizacion()
      ? 'Actualización de ficha técnica'
      : this.esEdicion()
        ? 'Editar ficha técnica'
        : 'Nueva ficha técnica';

  protected readonly subtituloWizard = () =>
    this.esEdicion()
      ? 'Modifique los datos y guarde los cambios.'
      : 'Complete los tres pasos para crear una ficha y enviarla a validación.';

  constructor() {
    this.parametrosService.opcionesFormulario().subscribe((o) => this.opciones.set(o));

    // Si la ruta trae :id, entramos en modo edición y cargamos la ficha.
    const idParam = this.ruta.snapshot.paramMap.get('id');
    const esOs = this.ruta.snapshot.queryParamMap.get('os') === '1';

    if (idParam) {
      const id = Number(idParam);
      this.fichaId.set(id);
      this.esActualizacion.set(esOs);
      this.cargarFichaParaEdicion(id);
    }
  }

  /** Carga la ficha y sus detalles para prellenar el wizard en modo edición. */
  private cargarFichaParaEdicion(id: number): void {
    this.guardando.set(true);

    forkJoin({
      ficha: this.fichaService.obtener(id),
      detalles: this.fichaService.detalles(id),
    }).subscribe({
      next: ({ ficha, detalles }) => {
        this.fichaEdicion.set(ficha);
        this.detallesExistentes.set(Array.isArray(detalles) ? detalles : []);
        this.guardando.set(false);
      },
      error: (err: unknown) => {
        this.guardando.set(false);
        this.mensajes.add({
          severity: 'error',
          summary: 'No se pudo cargar la ficha',
          detail: interpretarErrorFicha(err).mensaje,
          life: 6000,
        });
        void this.router.navigate(['/contabilidad/fichas-tecnicas/bandeja/borradores']);
      },
    });
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

  protected onConfirmar(evento: { observaciones: string[]; enviar: boolean }): void {
    const { observaciones, enviar } = evento;
    const cabecera = this.cabecera();

    if (!cabecera) {
      return;
    }

    this.guardando.set(true);

    // Adjunta el mapa código→nombre para que el backend guarde el nombre real
    // del profesional (en lugar del placeholder "PROF-documento").
    const nombres = this.nombresProfesionales();
    const cabeceraConNombres: CrearFichaPayload = {
      ...cabecera,
      profesionales_info: Object.keys(nombres).length > 0 ? nombres : undefined,
    };

    // Modo edición: actualizar la ficha existente en vez de crear una nueva.
    const idEdicion = this.fichaId();
    if (idEdicion !== null) {
      this.actualizarFicha(idEdicion, cabeceraConNombres, observaciones, enviar);
      return;
    }

    // 1. Crear la ficha con sus profesionales.
    this.fichaService.crear(cabeceraConNombres).subscribe({
      next: (ficha) => {
        // Guard defensivo: si el backend no devolvió un id válido, abortar.
        if (!ficha?.id) {
          this.guardando.set(false);
          this.mensajes.add({
            severity: 'error',
            summary: 'No se pudo crear la ficha',
            detail: 'El servidor no devolvió el identificador de la ficha.',
            life: 6000,
          });
          return;
        }

        // 2. Guardar servicios en lote.
        this.fichaService.guardarDetalles(ficha.id, this.detallesPayload()).subscribe({
          next: () => {
            // 3. Observaciones generales (varias, opcionales) — en secuencia.
            const obs = observaciones.filter((o) => o.trim() !== '');
            this.guardarObservaciones(ficha.id, obs, () => {
              // 4. Si el usuario eligió "Guardar y enviar", se envía a validación.
              if (enviar) {
                this.enviarAValidacion(ficha.id);
              } else {
                this.finalizarCreacion(ficha.id, false);
              }
            });
          },
          error: (err: unknown) => {
            // Los servicios fallaron: la ficha quedaría huérfana (sin ítems).
            // La cancelamos para no dejar borradores vacíos y devolvemos al
            // paso 2 para que el usuario corrija los servicios.
            this.fichaService.cancelar(ficha.id, 'Creación revertida: error al guardar los servicios').subscribe({
              next: () => this.finalizarConErrorDetalles(err),
              error: () => this.finalizarConErrorDetalles(err),
            });
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

  /**
   * Guarda los cambios de una ficha existente (edición de borrador):
   * actualiza cabecera, reemplaza los servicios y las observaciones.
   */
  private actualizarFicha(
    id: number,
    cabecera: CrearFichaPayload,
    observaciones: string[],
    enviar: boolean,
  ): void {
    const payload: ActualizarFichaPayload = { ...cabecera };

    this.fichaService.actualizar(id, payload).subscribe({
      next: () => {
        // Reemplazar los servicios con los del wizard.
        this.fichaService.guardarDetalles(id, this.detallesPayload()).subscribe({
          next: () => {
            const obs = observaciones.filter((o) => o.trim() !== '');
            this.guardarObservaciones(id, obs, () => {
              if (enviar) {
                this.enviarAValidacion(id);
              } else {
                this.finalizarCreacion(id, false);
              }
            });
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

  /**
   * Guarda las observaciones una a una (el backend acepta una por request).
   * Al terminar (con o sin observaciones) invoca el callback.
   */
  private guardarObservaciones(idFicha: number, observaciones: string[], onDone: () => void): void {
    if (observaciones.length === 0) {
      onDone();
      return;
    }

    let pendientes = observaciones.length;
    observaciones.forEach((texto) => {
      this.fichaService.agregarObservacion(idFicha, texto).subscribe({
        next: () => {
          if (--pendientes === 0) onDone();
        },
        error: () => {
          // No bloqueamos el flujo por una observación fallida
          if (--pendientes === 0) onDone();
        },
      });
    });
  }

  /** Envía la ficha recién creada a validación; si falla, queda como borrador. */
  private enviarAValidacion(idFicha: number): void {
    this.fichaService.enviar(idFicha).subscribe({
      next: () => this.finalizarCreacion(idFicha, true),
      error: (err: unknown) => {
        // La ficha quedó creada como borrador; informamos que no se pudo enviar.
        this.guardando.set(false);
        const { mensaje } = interpretarErrorFicha(err);
        this.mensajes.add({
          severity: 'warn',
          summary: 'Ficha guardada como borrador',
          detail: `Se creó la ficha #${idFicha}, pero no se pudo enviar a validación: ${mensaje}`,
          life: 8000,
        });
        void this.router.navigate(['/contabilidad/fichas-tecnicas/bandeja/borradores']);
      },
    });
  }

  /** Cierra el flujo exitoso: muestra el mensaje según la acción y navega. */
  private finalizarCreacion(idFicha: number, enviada: boolean): void {
    this.guardando.set(false);
    const edicion = this.esEdicion();
    this.mensajes.add({
      severity: 'success',
      summary: enviada
        ? 'Ficha enviada a validación'
        : edicion
          ? 'Cambios guardados'
          : 'Borrador guardado',
      detail: enviada
        ? `La ficha #${idFicha} fue enviada a validación.`
        : edicion
          ? `Los cambios de la ficha #${idFicha} se guardaron correctamente.`
          : `La ficha #${idFicha} se guardó como borrador. Puede enviarla a validación más tarde.`,
      life: 5000,
    });
    void this.router.navigate([
      '/contabilidad/fichas-tecnicas/bandeja/' + (enviada ? 'procesando' : 'borradores'),
    ]);
  }

  /**
   * Cierra el flujo cuando fallaron los servicios: informa el error y regresa
   * al paso 2 para corregir, tras haber revertido la ficha huérfana.
   */
  private finalizarConErrorDetalles(err: unknown): void {
    this.guardando.set(false);
    const { mensaje } = interpretarErrorFicha(err);
    this.mensajes.add({
      severity: 'error',
      summary: 'No se guardaron los servicios',
      detail: `${mensaje} La ficha no se creó; corrija los servicios e intente de nuevo.`,
      life: 8000,
    });
    // Regresar al paso 2 para corregir los ítems.
    this.pasoActual = 1;
  }

  private mostrarError(err: unknown): void {
    const { mensaje } = interpretarErrorFicha(err);
    this.mensajes.add({ severity: 'error', summary: 'Error', detail: mensaje, life: 6000 });
  }
}
