import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface ImportResult {
  success: boolean;
  message: string;
  data?: {
    exitosas: number;
    errores: { fila: number; mensaje: string }[];
    total: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class CargaMasivaService {

  private apiUrl = `${environment.URL_SERVICIOS}/turnos/carga-masiva`;

  constructor(private http: HttpClient) {}

  /**
   * Descarga el formato Excel pre-llenado.
   */
  descargarFormato(idUnidad: number, anio: number, mes: number): void {
    const url = `${this.apiUrl}/formato?id_unidad=${idUnidad}&anio=${anio}&mes=${mes}`;

    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const a = document.createElement('a');
        const objectUrl = URL.createObjectURL(blob);
        a.href = objectUrl;
        a.download = `turnos_formato_${anio}_${mes}.xlsx`;
        a.click();
        URL.revokeObjectURL(objectUrl);
      },
      error: (err) => {
        console.error('Error al descargar formato:', err);
      }
    });
  }

  /**
   * Importa el archivo Excel diligenciado.
   */
  importar(file: File, idUnidad: number, anio: number, mes: number): Observable<ImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('id_unidad', idUnidad.toString());
    formData.append('anio', anio.toString());
    formData.append('mes', mes.toString());

    return this.http.post<ImportResult>(`${this.apiUrl}/importar`, formData);
  }
}
