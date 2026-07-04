/**
 * Configuración de AG Grid — Packages Mode (ag-grid-community 32+)
 * En packages mode NO se registran módulos manualmente.
 * Solo exportamos el locale en español para pasar como [localeText] al componente.
 */
export const AG_GRID_LOCALE: Record<string, string> = {
  // Paginación
  page: 'Página',
  pageSizeSelectorLabel: 'Registros por página:',
  more: 'Más',
  to: 'a',
  of: 'de',
  next: 'Siguiente',
  last: 'Último',
  first: 'Primero',
  previous: 'Anterior',

  // Carga
  loadingOoo: 'Cargando...',
  loadingError: 'Error al cargar',
  noRowsToShow: 'No hay datos para mostrar',

  // Filtros
  filterOoo: 'Filtrar...',
  applyFilter: 'Aplicar filtro',
  resetFilter: 'Restablecer filtro',
  clearFilter: 'Limpiar filtro',
  equals: 'Igual a',
  notEqual: 'Diferente de',
  contains: 'Contiene',
  notContains: 'No contiene',
  startsWith: 'Empieza con',
  endsWith: 'Termina con',
  blank: 'En blanco',
  notBlank: 'No en blanco',
  lessThan: 'Menor que',
  greaterThan: 'Mayor que',
  lessThanOrEqual: 'Menor o igual que',
  greaterThanOrEqual: 'Mayor o igual que',
  inRange: 'En rango',
  andCondition: 'Y',
  orCondition: 'O',

  // Selección
  selectAll: 'Seleccionar todo',
  selectAllSearchResults: 'Seleccionar todos los resultados',
  searchOoo: 'Buscar...',

  // Columnas
  pinColumn: 'Fijar columna',
  pinLeft: 'Fijar a la izquierda',
  pinRight: 'Fijar a la derecha',
  noPin: 'No fijar',
  autosizeThisColumn: 'Autoajustar esta columna',
  autosizeAllColumns: 'Autoajustar todas',
  resetColumns: 'Restablecer columnas',
  sortAscending: 'Ordenar ascendente',
  sortDescending: 'Ordenar descendente',
  sortUnSort: 'Quitar orden',

  // Copiar/Exportar
  copy: 'Copiar',
  copyWithHeaders: 'Copiar con encabezados',
  export: 'Exportar',
  csvExport: 'Exportar a CSV',
  excelExport: 'Exportar a Excel',
};
