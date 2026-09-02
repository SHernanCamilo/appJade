import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { GlpiTableroTic } from '../interfaces/glpi-tickets-tic.interface';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class GlpiTicketsTicService {
  private readonly apiUrl = '/mesa-servicio/glpi/tablero-tic';

  constructor(private http: HttpClient) {}

  tablero(fresh = false): Observable<GlpiTableroTic> {
    let params = new HttpParams();
    if (fresh) {
      params = params.set('fresh', '1');
    }

    return this.http.get<ApiResponse<GlpiTableroTic>>(this.apiUrl, { params }).pipe(
      map((response) => response.data)
    );
  }
}
