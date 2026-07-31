export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  errors?: string[];
  warnings?: string[];
  details?: unknown[];
}

export interface ProductoItem {
  product_code: string;
  product_name: string;
  quantity: number;
  price?: number;
  brand?: string;
  rotation_type?: string;
  average_cost?: number;
}

export interface PedidoDetalle {
  id: number;
  pedido_id: number;
  codigo_producto: string;
  producto_nombre: string;
  producto_tipo?: string;
  producto_marca?: string;
  producto_promedio?: string;
  producto_rotacion?: string;
  codigo_sanitario?: string;
  cum_recibido?: string;
  cantidad_solicitada: number;
  cantidad_recibida: number;
  numero_lote?: string;
  fecha_vencimiento?: string;
  precio_unitario?: string;
  estado: string;
  aspecto_cumple?: boolean;
  embalaje_cumple?: boolean;
  cadena_frio_temperatura?: number;
  contenido_cumple?: boolean;
  concepto_recepcion?: string;
  recibido_por?: number;
  observaciones?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Pedido {
  id: number;
  numero_pedido: string;
  proveedor: string;
  fecha_pedido: string;
  fecha_esperada?: string;
  fecha_recibido?: string;
  estado: string;
  total_articulos: number;
  observaciones?: string;
  solicitado_por: number;
  recibido_por?: number;
  aprobado_por?: number;
  cancelado_por?: number;
  created_at?: string;
  updated_at?: string;
  detalles?: PedidoDetalle[];
  solicitado_por_nombre?: string;
  trazabilidad?: PedidoTrazabilidad[];
}

export interface PedidoTrazabilidad {
    id: number;
    pedido_id: number;
    estado: string;
    comentarios: string | null;
    cambiado_por: number | null;
    created_at: string;
    usuario?: {
        id: number;
        name: string;
    };
}

export interface OrdenCompraItem {
  codigo_producto?: string;
  producto_codigo?: string;
  producto_nombre?: string;
  cantidad: number;
  precio_unitario: number;
  total: number;
}

export interface OrdenCompra {
  id: number;
  compra_id?: number;
  numero_orden_compra: string;
  oc_indigo?: string;
  proveedor?: string;
  fecha_orden: string;
  estado: string;
  items_count: number;
  total?: number;
  creado_por_nombre?: string;
  detalles?: OrdenCompraItem[];
  total_items?: number;
  items_recibidos?: number;
}

export interface RecepcionItem {
  producto_nombre: string;
  codigo_producto: string;
  numero_pedido?: string;
  cantidad_solicitada_compra: number;
  cantidad_recibida?: number;
  numero_lote?: string;
  fecha_vencimiento?: string;
  codigo_sanitario?: string;
  codigo_sanitario_cum?: string;
  concepto_recepcion?: string;
  observaciones_recepcion?: string;
  observaciones?: string;
}

export interface Recepcion {
  id: number;
  // Puede ser la misma estructura que OrdenCompra para la vista
}

export interface Producto {
  id?: string;
  invima_code?: string;
  name?: string;
  nombre?: string;
  product_type?: string;
  tipo?: string;
  cum_code?: string;
  cum?: string;
  manufacturer?: string;
  fabricante?: string;
  min_stock?: number;
  stock_minimo?: number;
  max_stock?: number;
  stock_maximo?: number;
  avg_cost?: number;
  costo_promedio?: number;
  status?: string;
  estado?: string;
}
