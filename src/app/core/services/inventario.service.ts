import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse, Pedido, OrdenCompra, RecepcionItem, Producto } from '../models/inventario.model';

@Injectable({
  providedIn: 'root'
})
export class InventarioService {

  // URL relativa. El auth.interceptor agregará el URL base de la API y el token.
  private baseUrl = '/inventario';

  constructor(private http: HttpClient) { }

  // ==========================================
  // PEDIDOS
  // ==========================================
  getPedidos(params?: any): Observable<ApiResponse<Pedido[]>> {
    return this.http.get<ApiResponse<Pedido[]>>(`${this.baseUrl}/pedidos`, { params });
  }

  getPedido(id: number | string): Observable<ApiResponse<Pedido>> {
    return this.http.get<ApiResponse<Pedido>>(`${this.baseUrl}/pedidos/${id}`);
  }

  createPedido(data: any): Observable<ApiResponse<Pedido>> {
    return this.http.post<ApiResponse<Pedido>>(`${this.baseUrl}/pedidos`, data);
  }

  updatePedido(id: number | string, data: any): Observable<ApiResponse<Pedido>> {
    return this.http.put<ApiResponse<Pedido>>(`${this.baseUrl}/pedidos/${id}`, data);
  }

  changePedidoEstado(id: number | string, estado: string): Observable<ApiResponse<any>> {
    return this.http.patch<ApiResponse<any>>(`${this.baseUrl}/pedidos/${id}/estado`, { estado });
  }

  // ==========================================
  // ORDENES DE COMPRA
  // ==========================================
  getOrdenesCompra(params?: any): Observable<ApiResponse<OrdenCompra[]>> {
    return this.http.get<ApiResponse<OrdenCompra[]>>(`${this.baseUrl}/ordenes-compra`, { params });
  }

  getOrdenCompra(id: number | string): Observable<ApiResponse<OrdenCompra>> {
    return this.http.get<ApiResponse<OrdenCompra>>(`${this.baseUrl}/ordenes-compra/${id}`);
  }

  syncOrdenCompra(numeroOrden: string): Observable<ApiResponse<OrdenCompra>> {
    return this.http.post<ApiResponse<OrdenCompra>>(`${this.baseUrl}/ordenes-compra/sync`, { numero_orden: numeroOrden });
  }

  // ==========================================
  // RECEPCIONES TECNICAS
  // ==========================================
  getRecepciones(params?: any): Observable<ApiResponse<OrdenCompra[]>> {
    return this.http.get<ApiResponse<OrdenCompra[]>>(`${this.baseUrl}/recepciones`, { params });
  }

  getRecepcion(id: number | string): Observable<ApiResponse<RecepcionItem[]>> {
    return this.http.get<ApiResponse<RecepcionItem[]>>(`${this.baseUrl}/recepciones/${id}`);
  }

  createRecepcion(data: any): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.baseUrl}/recepciones`, data);
  }

  confirmarRecepcion(id: number | string): Observable<ApiResponse<any>> {
    return this.http.patch<ApiResponse<any>>(`${this.baseUrl}/recepciones/${id}/confirmar`, {});
  }

  // ==========================================
  // PRODUCTOS (GRAPH-FABRIC / LOCAL)
  // ==========================================
  getProductos(params?: any): Observable<ApiResponse<Producto[]>> {
    return this.http.get<ApiResponse<Producto[]>>(`${this.baseUrl}/productos`, { params });
  }

  validateBulkProducts(data: any[]): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.baseUrl}/productos/bulk-validate`, data);
  }

  // ==========================================
  // INVIMA
  // ==========================================
  searchInvima(query: string): Observable<ApiResponse<any>> {
    let params = new HttpParams().set('query', query);
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/invima/buscar`, { params });
  }
}
