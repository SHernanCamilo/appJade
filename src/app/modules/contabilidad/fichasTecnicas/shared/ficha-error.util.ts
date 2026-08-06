import { HttpErrorResponse } from '@angular/common/http';

import { ConflictoProfesional } from '../models/ficha.model';

/** Errores de validación de Laravel: { campo: [mensajes] }. */
export interface ErroresValidacion {
  [campo: string]: string[];
}

export interface ErrorFicha {
  /** Mensaje listo para mostrar al usuario. */
  mensaje: string;
  /** Conflictos de profesionales cuando el backend responde 409. */
  conflictos: ConflictoProfesional[];
  /** Errores por campo cuando el backend responde 422. */
  errores: ErroresValidacion | null;
  status: number;
}

interface CuerpoError {
  message?: string;
  error?: string;
  errors?: ErroresValidacion;
  conflictos?: ConflictoProfesional[];
}

/**
 * Traduce una respuesta de error del backend a una forma tipada y presentable.
 *
 * Centraliza el manejo que en el legacy estaba repetido en cada archivo con
 * bloques `Swal.fire` distintos y mensajes construidos a mano.
 */
export function interpretarErrorFicha(error: unknown): ErrorFicha {
  if (!(error instanceof HttpErrorResponse)) {
    return {
      mensaje: 'Ocurrió un error inesperado. Intente de nuevo.',
      conflictos: [],
      errores: null,
      status: 0,
    };
  }

  const cuerpo = (error.error ?? {}) as CuerpoError;

  // 409: conflicto de profesionales con fichas vigentes
  if (error.status === 409) {
    return {
      mensaje: cuerpo.message ?? 'La ficha entra en conflicto con otras vigentes.',
      conflictos: cuerpo.conflictos ?? [],
      errores: null,
      status: 409,
    };
  }

  // 422: validación de campos o transición de estado inválida
  if (error.status === 422) {
    const errores = cuerpo.errors ?? null;

    return {
      mensaje: errores ? primerMensaje(errores) : (cuerpo.message ?? 'Datos inválidos.'),
      conflictos: [],
      errores,
      status: 422,
    };
  }

  if (error.status === 404) {
    return {
      mensaje: cuerpo.message ?? 'El registro solicitado no existe.',
      conflictos: [],
      errores: null,
      status: 404,
    };
  }

  return {
    mensaje: cuerpo.message ?? cuerpo.error ?? 'No se pudo completar la operación.',
    conflictos: [],
    errores: null,
    status: error.status,
  };
}

function primerMensaje(errores: ErroresValidacion): string {
  const primeraClave = Object.keys(errores)[0];

  return errores[primeraClave]?.[0] ?? 'Datos inválidos.';
}
