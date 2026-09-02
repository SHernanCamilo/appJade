# Componentes de Vistas BI

Esta carpeta contiene los diferentes componentes de visualización de datos de Business Intelligence.

## Estructura

```
components/
├── view-vistas-grid/          # Vista estándar con paginación server-side
│   ├── viewVistas.component.ts
│   ├── viewVistas.component.html
│   └── viewVistas.component.css
│
├── view-vistas-excel/         # Vista Excel básica (deprecada, usar refresh)
│   ├── viewVistasExcel.component.ts
│   ├── viewVistasExcel.component.html
│   └── viewVistasExcel.component.css
│
├── view-vistas-fullscreen/    # Vista fullscreen con AG Grid
│   ├── viewVistasFullscreen.component.ts
│   ├── viewVistasFullscreen.component.html
│   └── viewVistasFullscreen.component.css
│
├── view-vistas-pivot/         # Vista con tabla dinámica (pivot)
│   ├── viewVistasPivot.component.ts
│   ├── viewVistasPivot.component.html
│   └── viewVistasPivot.component.css
│
└── view-vistas-refresh/       # Vista tipo Excel Online con carga parquet
    ├── viewVistasRefresh.component.ts
    ├── viewVistasRefresh.component.html
    └── viewVistasRefresh.component.css
```

## Componentes

### 1. `view-vistas-grid` (Vista principal)
- **Ruta**: `/inteligenciaNegocios/vistas/viewVistas/:schema/:viewName`
- **Layout**: Con sidebar de navegación
- **Características**:
  - Paginación server-side
  - Filtros y ordenamiento
  - Exportación a Excel
  - Detección automática de vistas pesadas
  - Filtros requeridos para vistas grandes

### 2. `view-vistas-refresh` (Vista Excel - Recomendada)
- **Ruta**: `/vistaBI-refresh/:schema/:viewName`
- **Layout**: Sin sidebar (pantalla completa)
- **Características**:
  - Carga completa de datos vía parquet/R2
  - Virtual scroll (maneja 500k+ registros)
  - Panel lateral de progreso tipo Excel Online
  - Filtros dinámicos en ribbon
  - Botón "Agregar vista" para múltiples pestañas
  - Estilo visual tipo Excel Desktop

### 3. `view-vistas-fullscreen`
- **Ruta**: `/inteligenciaNegocios/vistas/viewVistas/fullscreen/:schema/:viewName`
- **Layout**: Con sidebar
- **Estado**: Activa, uso específico

### 4. `view-vistas-excel`
- **Ruta**: No disponible directamente
- **Estado**: Deprecada, reemplazada por `view-vistas-refresh`

### 5. `view-vistas-pivot`
- **Ruta**: `/inteligenciaNegocios/vistas/viewVistas/pivot/:schema/:viewName`
- **Layout**: Sin sidebar
- **Características**:
  - Tabla dinámica tipo Excel
  - Drag & drop de campos
  - Agrupaciones y agregaciones

## Flujo de navegación

```
Listado de Vistas
    │
    ├─> [Clic en fila] ────────────> view-vistas-grid (con sidebar)
    │                                     │
    │                                     ├─> [Pantalla completa] ──> view-vistas-refresh (sin sidebar)
    │                                     ├─> [Dinamizar] ─────────> view-vistas-pivot (sin sidebar)
    │                                     └─> [Descargar Excel] ───> Export service
    │
    └─> [Botón verde Excel] ───────────> view-vistas-refresh (sin sidebar)
```

## Mejores prácticas

### Cuándo usar cada componente

**Use `view-vistas-grid` cuando**:
- El usuario necesita navegación con el sidebar
- Los datos son pocos (<10k registros)
- Se requiere paginación server-side

**Use `view-vistas-refresh` cuando**:
- Necesita carga completa de datos (hasta 500k registros)
- El usuario quiere experiencia tipo Excel Online
- Se requiere pantalla completa sin distracciones
- Múltiples vistas en diferentes pestañas del navegador

**Use `view-vistas-pivot` cuando**:
- El usuario necesita análisis dinámico de datos
- Se requieren agrupaciones y agregaciones personalizadas
- Tablas dinámicas tipo Excel

## Rutas absolutas vs relativas

### Componentes CON sidebar (dentro de MainLayoutComponent)
```typescript
// Rutas relativas dentro del módulo inteligenciaNegocios
path: 'vistas/viewVistas/:schema/:viewName'
```

### Componentes SIN sidebar (nivel raíz en app.routes.ts)
```typescript
// Rutas absolutas en app.routes.ts
path: 'vistaBI-refresh/:schema/:viewName'
```

## Servicios compartidos

Todos los componentes usan:
- `VistasService` - Consultas a Microsoft Fabric
- `FabricExportService` - Exportaciones asíncronas
- `AG_GRID_LOCALE` - Configuración de idioma para AG Grid

## Estilos globales

Los componentes de vista usan clases CSS compartidas:
- `.bi-vista-grid` - Estilos base de AG Grid
- `.bi-cell--*` - Estilos por tipo de dato (number, date, text)
- `.grid-loader` - Skeleton loaders
- `.export-progress-*` - Indicadores de progreso

## Componentes de apoyo

Para no alargar `view-vistas-refresh` se extrajeron piezas reutilizables:

- `grid-search-box/` — buscador flotante (Ctrl+F) que filtra por TODAS las
  columnas de la fila usando `quickFilterText`. Reemplazo del `prompt()`.
- `../helpers/grid-columns.helper.ts` — `makeRowNumberColDef` (banda de números
  de fila, antes duplicada 5 veces), `autoSizeGridColumns`, `isTypingTarget`
  (evita que los atajos roben el teclado a los inputs), `toNumericValue` y
  `computeColumnStats` (agregados de columna).
- `../helpers/cell-range-selection.ts` — selección de rango tipo Excel.

## AG Grid Community vs Enterprise (importante)

El proyecto usa **ag-grid-community 32.3.3 sin licencia**. Estas funciones son
**solo Enterprise** y NO están disponibles, por más que se configuren:

- Cell Selection / Range Selection (seleccionar un rectángulo de celdas
  arrastrando el mouse). Ref oficial: la página *Cell Selection* está marcada
  como Enterprise, y *Clipboard* dice que copiar del grid solo viene habilitado
  para Enterprise. Contenido reformulado por restricciones de licencia.
- `copySelectedRangeToClipboard()`, `clearRangeSelection()`, `getCellRanges()`.
- Row Grouping, Pivoting nativo, Excel Export con formato.

Por eso la selección de rango, la copia a portapapeles y los agregados se
implementan **a mano** en `cell-range-selection.ts` (mousedown + drag + clase
CSS aplicada vía `cellClass`). No replica todo Enterprise, pero da: arrastrar
para seleccionar, Shift+clic para extender, Ctrl+C para copiar como TSV y el
resumen del rango en la barra de estado.

Si en el futuro se compra la licencia Enterprise, se puede reemplazar
`cell-range-selection.ts` por `cellSelection: true` y borrar este apaño.

## Notas de desarrollo

- Los componentes son standalone (no requieren NgModule)
- Todos usan `OnPush` change detection para mejor rendimiento
- La inyección de dependencias usa `inject()` en lugar de constructor
- Los signals de Angular se usan para estado reactivo
- Los atajos de teclado globales (Ctrl+C/V/F, Delete, Escape) deben ignorar los
  eventos que nacen en inputs/textarea/select, o rompen los campos de texto
  (buscadores de filtro, paneles). Ver `isTypingTarget`.
