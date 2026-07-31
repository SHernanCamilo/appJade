export type ColumnFilterType = 'text' | 'numeric' | 'date' | 'boolean' | 'select';

export interface TableColumn {
  /** Propiedad del objeto. Soporta notación con punto: 'empresa.nombre'. */
  field: string;
  /** Texto del encabezado. */
  header: string;
  /** Habilita ordenamiento por esta columna. */
  sortable?: boolean;
  /** Habilita el filtro por columna. */
  filter?: boolean;
  /** Tipo de filtro. Por defecto 'text'. */
  filterType?: ColumnFilterType;
  /** Match mode de PrimeNG (contains, equals, startsWith, etc.). */
  filterMatchMode?: string;
  /** Opciones para filterType === 'select'. */
  filterOptions?: { label: string; value: any }[];
  /** Ancho de la columna, ej. '150px'. */
  width?: string;
  /** Clase CSS aplicada al th y td. */
  styleClass?: string;
  /** Pipe para el renderizado por defecto cuando no se proyecta celda. */
  pipe?: 'date' | 'currency' | 'number';
  /** Formato del pipe, ej. 'dd/MM/yyyy' para date. */
  pipeFormat?: string;
}
