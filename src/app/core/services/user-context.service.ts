import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, tap, shareReplay } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface UserContext {
  isSuperAdmin: boolean;
  accessLevel: string;
  empresas: { id: number; nombre: string }[];
}

/**
 * Servicio que cachea el contexto del usuario (access_level + empresas).
 * Se consulta al backend UNA SOLA VEZ por sesión.
 * Los módulos que necesiten saber si el usuario es super_admin o qué empresas tiene
 * usan este servicio en vez de hacer sus propios requests.
 */
@Injectable({ providedIn: 'root' })
export class UserContextService {

  private context$: Observable<UserContext> | null = null;

  constructor(private http: HttpClient) {}

  /**
   * Obtiene el contexto del usuario (cacheado).
   * Primera llamada: 1 request ligero + 1 request empresas.
   * Siguientes llamadas: instantáneo (0 requests).
   */
  getContext(): Observable<UserContext> {
    if (!this.context$) {
      this.context$ = this.http.get<any>(
        `${environment.URL_SERVICIOS}/turnos/unidades-funcionales/del-usuario?solo_nivel=1`
      ).pipe(
        map(response => {
          const accessLevel = response.access_level || 'normal';
          const isSuperAdmin = accessLevel === 'super_admin' || accessLevel === 'transversal';
          return { isSuperAdmin, accessLevel, empresas: [] as { id: number; nombre: string }[] };
        }),
        // Encadenar la carga de empresas
        tap(() => {}),
        shareReplay(1)
      );

      // Cargar empresas en paralelo y enriquecer el contexto
      this.context$ = new Observable<UserContext>(subscriber => {
        let ctx: UserContext = { isSuperAdmin: false, accessLevel: 'normal', empresas: [] };

        this.http.get<any>(
          `${environment.URL_SERVICIOS}/turnos/unidades-funcionales/del-usuario?solo_nivel=1`
        ).subscribe({
          next: (response) => {
            const accessLevel = response.access_level || 'normal';
            ctx.isSuperAdmin = accessLevel === 'super_admin' || accessLevel === 'transversal';
            ctx.accessLevel = accessLevel;

            const empresasUrl = ctx.isSuperAdmin
              ? `${environment.URL_SERVICIOS}/empresas-activas`
              : `${environment.URL_SERVICIOS}/contexto/empresas-disponibles`;

            this.http.get<any>(empresasUrl).subscribe({
              next: (empRes) => {
                const empresas = empRes.data || empRes || [];
                ctx.empresas = (Array.isArray(empresas) ? empresas : [])
                  .map((e: any) => ({ id: e.id, nombre: e.nombre }));
                subscriber.next(ctx);
                subscriber.complete();
              },
              error: () => { subscriber.next(ctx); subscriber.complete(); }
            });
          },
          error: () => { subscriber.next(ctx); subscriber.complete(); }
        });
      }).pipe(shareReplay(1));
    }

    return this.context$;
  }

  /**
   * Invalida el caché (ej: si el usuario cambia de rol o empresa en la sesión).
   */
  invalidate(): void {
    this.context$ = null;
  }
}
