import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '../models/anticipo.models';

export interface Documento {
  id: number;
  id_solicitud: number;
  tipo_documento: 'soporte_viaje' | 'factura' | 'recibo' | 'comprobante_devolucion' | 'otro';
  nombre_archivo: string;
  ruta_archivo: string;
  disco: string;
  mime_type: string;
  tamano: number;
  subido_por: number;
  subidoPor?: { id: number; name: string };
  created_at: string;
}

export const TIPOS_DOCUMENTO = [
  { label: 'Soporte de Viaje', value: 'soporte_viaje' },
  { label: 'Factura', value: 'factura' },
  { label: 'Recibo', value: 'recibo' },
  { label: 'Comprobante Devolución', value: 'comprobante_devolucion' },
  { label: 'Otro', value: 'otro' },
];

@Injectable({ providedIn: 'root' })
export class AnticipoDocumentoService {
  private api = '/anticipos';

  constructor(private http: HttpClient) {}

  /**
   * Sube un documento/soporte (PDF, imagen) a una solicitud.
   */
  subirDocumento(idSolicitud: number, archivo: File, tipoDocumento: string): Observable<ApiResponse<Documento>> {
    const formData = new FormData();
    formData.append('archivo', archivo);
    formData.append('tipo_documento', tipoDocumento);

    return this.http.post<ApiResponse<Documento>>(
      `${this.api}/solicitudes/${idSolicitud}/documentos`,
      formData
    );
  }

  /**
   * Lista documentos de una solicitud.
   */
  listarDocumentos(idSolicitud: number): Observable<ApiResponse<Documento[]>> {
    return this.http.get<ApiResponse<Documento[]>>(
      `${this.api}/solicitudes/${idSolicitud}/documentos`
    );
  }

  /**
   * Descargar/obtener URL de un documento.
   */
  descargarDocumento(idDocumento: number): Observable<ApiResponse<{ url: string; nombre: string }>> {
    return this.http.get<ApiResponse<any>>(
      `${this.api}/documentos/${idDocumento}/descargar`
    );
  }

  /**
   * Eliminar un documento.
   */
  eliminarDocumento(idDocumento: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(
      `${this.api}/documentos/${idDocumento}`
    );
  }
}
