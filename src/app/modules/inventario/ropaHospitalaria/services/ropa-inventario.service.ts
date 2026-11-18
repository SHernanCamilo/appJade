import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface ApiRopa<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface RopaPrendaOpcion {
  id: number;
  codigo: string | null;
  nombre: string;
  estado: number;
}

export interface RopaEmpresa {
  id: number;
  nombre: string;
}

export interface RopaEmpresasRespuesta {
  success: boolean;
  debe_elegir: boolean;
  data: RopaEmpresa[];
}

export interface RopaUnidadOpcion {
  id: number;
  codigo: string;
  nombre: string;
  empresa_id: number | null;
  sucursal_id: number | null;
  sucursal_nombre: string | null;
  sede_id: number | null;
  sede_nombre: string | null;
  tiene_cupo: boolean;
  camas: number | null;
}

export interface ApoyoInventario {
  camas: number | null;
  tiene_cupo: boolean;
  constante: string | null;
  inventario_cerrado: boolean;
}

export interface LineaInventario {
  id: number;
  id_prenda: number;
  prenda_codigo: string | null;
  prenda_nombre: string | null;
  constante: string;
  camas: number;
  cama_extra: number;
  camas_vista: number;
  cantidad: number;
  fijo?: string;
  faltante?: string;
}

export interface InventarioRopa {
  id: number;
  consecutivo: number;
  consecutivo_toma: number | null;
  estado: number;
  periodo: string | null;
  fecha_corte: string | null;
  comentario: string | null;
  fecha_registro: string | null;
  sucursal_id: number | null;
  sucursal_nombre: string | null;
  sede_id: number | null;
  sede_nombre: string | null;
  unidad_id: number | null;
  unidad_codigo: string | null;
  unidad_nombre: string | null;
  usuario: string | null;
  lineas: LineaInventario[];
}

export interface FilaReportePropio {
  periodo: string;
  sucursal: string | null;
  sede: string | null;
  unidad: string | null;
  usuario: string | null;
  prenda: string | null;
  camas: number;
  camas_medico: number;
  personal: number;
  constante: string;
  fijo: string;
  cantidad: number;
  faltante: string;
}

export interface ResumenInventario {
  id: number;
  consecutivo: number;
  consecutivo_toma: number | null;
  periodo: string | null;
  fecha_corte: string | null;
  unidad_codigo: string | null;
  unidad_nombre: string | null;
  sede_nombre: string | null;
  sucursal_nombre: string | null;
  lineas: number;
  usuario: string | null;
}

export interface CerrarInventarioPayload {
  id_sucursal: number;
  id_sede: number | null;
  id_unidad: number;
  periodo: string;
  comentario: string | null;
}

@Injectable({ providedIn: 'root' })
export class RopaInventarioService {
  private readonly base = `${environment.URL_SERVICIOS}/inventario/ropa-hospitalaria`;

  constructor(private readonly http: HttpClient) {}

  prendas(): Observable<ApiRopa<RopaPrendaOpcion[]>> {
    const params = new HttpParams().set('estado', '1');
    return this.http.get<ApiRopa<RopaPrendaOpcion[]>>(`${this.base}/prendas`, { params });
  }

  empresas(): Observable<RopaEmpresasRespuesta> {
    return this.http.get<RopaEmpresasRespuesta>(`${this.base}/empresas`);
  }

  unidades(): Observable<ApiRopa<RopaUnidadOpcion[]>> {
    return this.http.get<ApiRopa<RopaUnidadOpcion[]>>(`${this.base}/unidades`);
  }

  reportePropio(idSucursal: number, idSede: number | null, periodo: string, idUnidad?: number | null): Observable<ApiRopa<FilaReportePropio[]> & { consulta_general?: boolean }> {
    let params = new HttpParams()
      .set('id_sucursal', idSucursal)
      .set('periodo', periodo);
    if (idSede) params = params.set('id_sede', idSede);
    if (idUnidad) params = params.set('id_unidad', idUnidad);
    return this.http.get<ApiRopa<FilaReportePropio[]>>(`${this.base}/reporte-propio`, { params });
  }

  listar(periodo?: string): Observable<ApiRopa<ResumenInventario[]>> {
    let params = new HttpParams();
    if (periodo) params = params.set('periodo', periodo);
    return this.http.get<ApiRopa<ResumenInventario[]>>(`${this.base}/inventarios`, { params });
  }

  apoyo(idUnidad: number, idPrenda?: number | null, periodo?: string | null): Observable<ApiRopa<ApoyoInventario>> {
    let params = new HttpParams().set('id_unidad', idUnidad);
    if (idPrenda) params = params.set('id_prenda', idPrenda);
    if (periodo) params = params.set('periodo', periodo);
    return this.http.get<ApiRopa<ApoyoInventario>>(`${this.base}/inventarios/apoyo`, { params });
  }

  abrir(): Observable<ApiRopa<InventarioRopa>> {
    return this.http.post<ApiRopa<InventarioRopa>>(`${this.base}/inventarios`, {});
  }

  ver(id: number): Observable<ApiRopa<InventarioRopa>> {
    return this.http.get<ApiRopa<InventarioRopa>>(`${this.base}/inventarios/${id}`);
  }

  agregarLinea(id: number, payload: { id_unidad: number; id_prenda: number; cama_extra: number; cantidad: number }): Observable<ApiRopa<InventarioRopa>> {
    return this.http.post<ApiRopa<InventarioRopa>>(`${this.base}/inventarios/${id}/lineas`, payload);
  }

  quitarLinea(id: number, linea: number): Observable<ApiRopa<InventarioRopa>> {
    return this.http.delete<ApiRopa<InventarioRopa>>(`${this.base}/inventarios/${id}/lineas/${linea}`);
  }

  vaciar(id: number): Observable<ApiRopa<InventarioRopa>> {
    return this.http.delete<ApiRopa<InventarioRopa>>(`${this.base}/inventarios/${id}/lineas`);
  }

  cerrar(id: number, payload: CerrarInventarioPayload): Observable<ApiRopa<InventarioRopa>> {
    return this.http.post<ApiRopa<InventarioRopa>>(`${this.base}/inventarios/${id}/cerrar`, payload);
  }
}
