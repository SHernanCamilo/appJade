/**
 * Pre-built ribbon tab configurations.
 * Consumers can use these directly or extend them.
 */

import { RibbonTab } from '../models/excel-sheet.models';

// ─── Recepción Técnica: Basic ribbon ────────────────────────────────────────

export const RIBBON_RECEPCION: RibbonTab[] = [
  {
    id: 'inicio',
    label: 'Inicio',
    groups: [
      {
        title: 'Portapapeles',
        items: [
          { type: 'button', id: 'copy', label: 'Copiar', icon: 'pi pi-copy', size: 'sm' },
          { type: 'button', id: 'paste', label: 'Pegar', icon: 'pi pi-clipboard', size: 'sm' },
        ],
      },
      {
        title: 'Fuente',
        items: [
          { type: 'toggle', id: 'bold', icon: 'pi pi-bold', tooltip: 'Negrita', size: 'sm' },
          { type: 'toggle', id: 'italic', icon: 'pi pi-italic', tooltip: 'Cursiva', size: 'sm' },
          { type: 'separator' },
        ],
      },
      {
        title: 'Alineación',
        items: [
          { type: 'button', id: 'align-left', icon: 'pi pi-align-left', tooltip: 'Alinear izquierda', size: 'sm' },
          { type: 'button', id: 'align-center', icon: 'pi pi-align-center', tooltip: 'Centrar', size: 'sm' },
          { type: 'button', id: 'align-right', icon: 'pi pi-align-right', tooltip: 'Alinear derecha', size: 'sm' },
        ],
      },
      {
        title: 'Selección',
        items: [
          { type: 'button', id: 'select-all', label: 'Marcar\ntodos', icon: 'pi pi-check-square', size: 'lg' },
          { type: 'button', id: 'select-none', label: 'Quitar\ntodos', icon: 'pi pi-stop', size: 'lg' },
        ],
      },
      {
        title: 'Hoja',
        items: [
          { type: 'button', id: 'autofit', label: 'Ajustar\ncolumnas', icon: 'pi pi-arrows-h', size: 'lg' },
          { type: 'button', id: 'export-csv', label: 'Exportar\nCSV', icon: 'pi pi-file-export', size: 'lg' },
        ],
      },
      {
        title: 'Formato condicional',
        grow: true,
        items: [
          {
            type: 'legend',
            items: [
              { color: '#c6efce', label: 'Más de 6 meses' },
              { color: '#ffeb9c', label: '6 meses o menos' },
              { color: '#ffc7ce', label: 'Vencido' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'datos',
    label: 'Datos',
    groups: [
      {
        title: 'Ordenar y filtrar',
        items: [
          { type: 'button', id: 'sort-asc', label: 'A → Z', icon: 'pi pi-sort-alpha-down', size: 'lg' },
          { type: 'button', id: 'sort-desc', label: 'Z → A', icon: 'pi pi-sort-alpha-up', size: 'lg' },
          { type: 'button', id: 'clear-filters', label: 'Limpiar\nfiltros', icon: 'pi pi-filter-slash', size: 'lg' },
        ],
      },
    ],
  },
  {
    id: 'vista',
    label: 'Vista',
    groups: [
      {
        title: 'Ventana',
        items: [
          { type: 'button', id: 'freeze-cols', label: 'Inmovilizar\npaneles', icon: 'pi pi-lock', size: 'lg' },
          { type: 'button', id: 'zoom-fit', label: 'Ajustar\nal ancho', icon: 'pi pi-expand', size: 'lg' },
        ],
      },
    ],
  },
];

// ─── BI Vistas: Full ribbon (placeholder for future use) ────────────────────

export const RIBBON_BI_VISTAS: RibbonTab[] = [
  ...RIBBON_RECEPCION,
  // Future: add 'Insertar' tab with pivot tables, charts
  // Future: add 'Fórmulas' tab
  // Future: add 'Datos' tab with Power Query / Conexiones
];
