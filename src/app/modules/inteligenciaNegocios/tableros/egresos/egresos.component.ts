import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { Subscription } from 'rxjs';

import { VistasService } from '../../services/vistas.service';
import { handleFabricError } from '../../helpers/fabric-error.helper';
import { GridLoaderComponent } from '../../../../complements/shared/grid-loader/grid-loader.component';

interface PivotCellCounts {
  [monthKey: string]: number;
}

interface UnidadPivot {
  unidad: string;
  /** Valores numéricos por mes (alineados a monthCols). */
  valores: number[];
  /** Valores ya formateados, alineados a monthCols. */
  cells: string[];
  total: number;
  totalTexto: string;
  activa: boolean;
}

interface SucursalPivot {
  sucursal: string;
  unidades: UnidadPivot[];
  cells: string[];
  total: number;
  totalTexto: string;
  expanded: boolean;
}

interface MonthCol {
  key: string;
  label: string;
  sortKey: string;
}

/** Unidad funcional disponible para incluir/excluir del conteo. */
interface UnidadFiltro {
  nombre: string;
  total: number;
  totalTexto: string;
  activa: boolean;
}

const MESES_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_FULL = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

/** Intl no requiere registrar locales de Angular (evita NG0701 en los pipes). */
const NUM_FORMAT = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

@Component({
  selector: 'app-tablero-egresos',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    ToastModule,
    TooltipModule,
    GridLoaderComponent
  ],
  providers: [MessageService],
  templateUrl: './egresos.component.html',
  styleUrl: './egresos.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EgresosTableroComponent implements OnInit, OnDestroy {
  private readonly schema = 'dc';
  private readonly viewName = 'VW_HC_Egresos_Conteo';

  isLoading = false;
  isLoadingColumns = true;
  errorMessage = '';
  elapsedMs = 0;
  totalGrupos = 0;

  anioSeleccionado = new Date().getFullYear();
  anioOptions: number[] = [];

  /** Nombres reales de columnas detectados en la vista. */
  private colSucursal = 'Sucursal';
  private colUnidad = 'UnidadFuncional';
  private colAnio = '';
  private colMes = '';
  private colConteo = '';
  /** Si la vista ya viene ancha (ene..dic como columnas). */
  private wideMonthCols: string[] = [];

  monthCols: MonthCol[] = [];
  sucursales: SucursalPivot[] = [];
  grandCells: string[] = [];
  grandTotal = 0;
  grandTotalTexto = '';
  elapsedTexto = '';

  /** Filtro de unidades funcionales (se aplica sobre los datos ya cargados). */
  unidadesDisponibles: UnidadFiltro[] = [];
  unidadesVisibles: UnidadFiltro[] = [];
  unidadesActivasCount = 0;
  filtroUnidad = '';
  showUnidadesPanel = false;

  /** Datos crudos: permiten recalcular sin volver a consultar Fabric. */
  private rawBySucursal = new Map<string, Map<string, PivotCellCounts>>();
  private rawMonthMap = new Map<string, MonthCol>();
  private unidadesActivas = new Set<string>();

  private sub?: Subscription;

  constructor(
    private readonly vistasService: VistasService,
    private readonly messageService: MessageService,
    private readonly cdr: ChangeDetectorRef
  ) {
    const y = new Date().getFullYear();
    this.anioOptions = [y, y - 1, y - 2];
  }

  ngOnInit(): void {
    this.cargarColumnasYDatos();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  recargar(): void {
    this.cargarDatos();
  }

  onAnioChange(): void {
    this.cargarDatos();
  }

  toggleSucursal(item: SucursalPivot): void {
    item.expanded = !item.expanded;
    this.cdr.markForCheck();
  }

  expandirTodo(): void {
    this.sucursales.forEach(s => (s.expanded = true));
    this.cdr.markForCheck();
  }

  colapsarTodo(): void {
    this.sucursales.forEach(s => (s.expanded = false));
    this.cdr.markForCheck();
  }

  toggleUnidadesPanel(): void {
    this.showUnidadesPanel = !this.showUnidadesPanel;
    this.cdr.markForCheck();
  }

  trackSucursal(_: number, item: SucursalPivot): string {
    return item.sucursal;
  }

  trackUnidad(_: number, item: UnidadPivot): string {
    return item.unidad;
  }

  trackMes(_: number, item: MonthCol): string {
    return item.key;
  }

  trackUnidadFiltro(_: number, item: UnidadFiltro): string {
    return item.nombre;
  }

  /** Incluye o excluye una unidad funcional del conteo. */
  toggleUnidad(unidad: UnidadFiltro, event?: Event): void {
    event?.stopPropagation();
    unidad.activa = !unidad.activa;
    this.aplicarSeleccionUnidades();
  }

  /** Checkbox en la fila de la tabla. */
  toggleUnidadEnTabla(unidadNombre: string, event: Event): void {
    event.stopPropagation();
    const item = this.unidadesDisponibles.find(u => u.nombre === unidadNombre);
    if (!item) {
      return;
    }
    item.activa = !item.activa;
    this.aplicarSeleccionUnidades();
  }

  onCheckboxUnidad(unidadNombre: string, checked: boolean, event: Event): void {
    event.stopPropagation();
    const item = this.unidadesDisponibles.find(u => u.nombre === unidadNombre);
    if (!item) {
      return;
    }
    item.activa = checked;
    this.aplicarSeleccionUnidades();
  }

  activarTodasUnidades(): void {
    this.unidadesDisponibles.forEach(u => (u.activa = true));
    this.aplicarSeleccionUnidades();
  }

  desactivarTodasUnidades(): void {
    this.unidadesDisponibles.forEach(u => (u.activa = false));
    this.aplicarSeleccionUnidades();
  }

  /** Marca solo las unidades que coinciden con el texto del buscador. */
  activarSoloVisibles(): void {
    const visibles = new Set(this.unidadesVisibles.map(u => u.nombre));
    this.unidadesDisponibles.forEach(u => (u.activa = visibles.has(u.nombre)));
    this.aplicarSeleccionUnidades();
  }

  onFiltroUnidadChange(): void {
    this.aplicarFiltroUnidades();
    this.cdr.markForCheck();
  }

  private aplicarFiltroUnidades(): void {
    const texto = this.filtroUnidad.trim().toLowerCase();
    this.unidadesVisibles = texto
      ? this.unidadesDisponibles.filter(u => u.nombre.toLowerCase().includes(texto))
      : this.unidadesDisponibles;
  }

  private aplicarSeleccionUnidades(): void {
    this.unidadesActivas = new Set(
      this.unidadesDisponibles.filter(u => u.activa).map(u => u.nombre)
    );
    this.unidadesActivasCount = this.unidadesActivas.size;
    this.recalcularPivot();
    this.cdr.markForCheck();
  }

  private cargarColumnasYDatos(): void {
    this.isLoadingColumns = true;
    this.errorMessage = '';

    this.vistasService.getColumnas(this.schema, this.viewName).subscribe({
      next: res => {
        const cols = (res.data?.columns ?? []).map(c => c.name);
        if (!this.mapearColumnas(cols)) {
          this.isLoadingColumns = false;
          this.cdr.markForCheck();
          return;
        }
        this.isLoadingColumns = false;
        this.cargarDatos();
      },
      error: (err: unknown) => {
        this.isLoadingColumns = false;
        this.errorMessage =
          err instanceof HttpErrorResponse
            ? handleFabricError(err)
            : 'No se pudieron cargar las columnas de la vista.';
        this.cdr.markForCheck();
      }
    });
  }

  private mapearColumnas(cols: string[]): boolean {
    const lower = new Map(cols.map(c => [c.toLowerCase(), c]));

    this.colSucursal = lower.get('sucursal') ?? '';
    this.colUnidad =
      lower.get('unidadfuncional') ??
      lower.get('unidad_funcional') ??
      lower.get('unidad') ??
      '';

    if (!this.colSucursal || !this.colUnidad) {
      this.errorMessage =
        'La vista no tiene las columnas Sucursal / UnidadFuncional requeridas.';
      return false;
    }

    this.colAnio =
      lower.get('ano') ??
      lower.get('anio') ??
      lower.get('año') ??
      lower.get('anoegreso') ??
      lower.get('anioegreso') ??
      lower.get('year') ??
      '';

    this.colMes =
      lower.get('mes') ??
      lower.get('mesnumero') ??
      lower.get('nummes') ??
      lower.get('nromes') ??
      lower.get('mesnombre') ??
      lower.get('month') ??
      '';

    this.colConteo =
      lower.get('conteo') ??
      lower.get('cantidad') ??
      lower.get('total') ??
      lower.get('cuenta') ??
      lower.get('egresos') ??
      lower.get('ingreso') ??
      lower.get('ingresos') ??
      lower.get('cantidadegresos') ??
      lower.get('totalegresos') ??
      lower.get('cnt') ??
      lower.get('conteoingreso') ??
      lower.get('cuentaingreso') ??
      lower.get('totalingresos') ??
      lower.get('valor') ??
      '';

    // Formato ancho solo si NO hay Mes+Conteo (evitar falsos positivos)
    this.wideMonthCols = [];
    if (!this.colMes || !this.colConteo) {
      for (let i = 0; i < 12; i++) {
        const short = MESES_ES[i];
        const full = MESES_FULL[i];
        const found =
          lower.get(short) ??
          lower.get(full) ??
          lower.get(`mes${i + 1}`) ??
          lower.get(`m${String(i + 1).padStart(2, '0')}`);
        if (found) {
          this.wideMonthCols.push(found);
        }
      }
    }

    if (this.colMes && this.colConteo) {
      return true;
    }

    if (this.wideMonthCols.length >= 2) {
      return true;
    }

    this.errorMessage =
      'La vista no tiene columnas de Mes/Conteo (ni columnas mensuales ene..dic).';
    return false;
  }

  private columnasConsulta(): string[] {
    const cols = new Set<string>([this.colSucursal, this.colUnidad]);
    if (this.colAnio) cols.add(this.colAnio);
    if (this.colMes) cols.add(this.colMes);
    if (this.colConteo) cols.add(this.colConteo);
    for (const m of this.wideMonthCols) cols.add(m);
    return Array.from(cols).filter(Boolean);
  }

  private cargarDatos(): void {
    this.sub?.unsubscribe();
    this.isLoading = true;
    this.errorMessage = '';
    this.sucursales = [];
    this.monthCols = [];
    this.grandTotal = 0;
    this.grandTotalTexto = '';
    this.grandCells = [];
    this.unidadesDisponibles = [];
    this.unidadesVisibles = [];
    this.unidadesActivasCount = 0;
    this.filtroUnidad = '';
    this.unidadesActivas.clear();
    this.cdr.markForCheck();

    const filters: Record<string, string> = {};
    if (this.colAnio && this.anioSeleccionado) {
      filters[this.colAnio] = String(this.anioSeleccionado);
    }

    const t0 = performance.now();

    // Una sola consulta: vista ya preagregada + solo columnas necesarias
    this.sub = this.vistasService
      .getVistaDatos(this.schema, this.viewName, {
        columns: this.columnasConsulta(),
        filters,
        sort_col: this.colSucursal,
        sort_dir: 'asc',
        limit: 5000,
        skip_count: true
      })
      .subscribe({
        next: res => {
          this.isLoading = false;
          this.elapsedMs = res.meta?.elapsed_ms ?? Math.round(performance.now() - t0);
          this.elapsedTexto = `${(this.elapsedMs / 1000).toFixed(1)}s`;
          if (!res.success) {
            this.errorMessage = 'No se pudieron cargar los egresos.';
            this.cdr.markForCheck();
            return;
          }
          this.construirPivot(res.rowData ?? []);
          this.cdr.markForCheck();
        },
        error: (err: unknown) => {
          this.isLoading = false;
          this.errorMessage =
            err instanceof HttpErrorResponse
              ? handleFabricError(err)
              : 'No se pudo consultar la vista de egresos.';
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: this.errorMessage,
            life: 7000
          });
          this.cdr.markForCheck();
        }
      });
  }

  private construirPivot(rows: Record<string, unknown>[]): void {
    if (this.wideMonthCols.length >= 2) {
      this.construirDesdeFormatoAncho(rows);
    } else {
      this.construirDesdeFormatoLargo(rows);
    }
  }

  /** Filas: Sucursal + Unidad + Mes + Conteo */
  private construirDesdeFormatoLargo(rows: Record<string, unknown>[]): void {
    const bySucursal = new Map<string, Map<string, PivotCellCounts>>();
    const monthMap = new Map<string, MonthCol>();
    let grupos = 0;

    for (const row of rows) {
      const sucursal = String(row[this.colSucursal] ?? '').trim() || '(Sin sucursal)';
      const unidad = String(row[this.colUnidad] ?? '').trim() || '(Sin unidad)';
      const count = this.toNumber(row[this.colConteo]);
      if (!count) {
        continue;
      }

      if (this.colAnio) {
        const y = this.toNumber(row[this.colAnio]);
        if (y && y !== this.anioSeleccionado) {
          continue;
        }
      }

      const month = this.resolveMonthCol(row[this.colMes], this.anioSeleccionado);
      if (!month) {
        continue;
      }

      monthMap.set(month.key, month);
      grupos += 1;

      if (!bySucursal.has(sucursal)) {
        bySucursal.set(sucursal, new Map());
      }
      const byUnidad = bySucursal.get(sucursal)!;
      if (!byUnidad.has(unidad)) {
        byUnidad.set(unidad, {});
      }
      const counts = byUnidad.get(unidad)!;
      counts[month.key] = (counts[month.key] ?? 0) + count;
    }

    this.totalGrupos = grupos;
    this.finalizarPivot(bySucursal, monthMap);
  }

  /** Filas: Sucursal + Unidad + columnas ene..dic */
  private construirDesdeFormatoAncho(rows: Record<string, unknown>[]): void {
    const bySucursal = new Map<string, Map<string, PivotCellCounts>>();
    const monthMap = new Map<string, MonthCol>();
    let grupos = 0;

    for (let i = 0; i < this.wideMonthCols.length; i++) {
      const colName = this.wideMonthCols[i];
      const monthNum = this.monthNumberFromLabel(colName) ?? i + 1;
      const month = this.buildMonthCol(this.anioSeleccionado, monthNum);
      monthMap.set(month.key, month);
    }

    for (const row of rows) {
      if (this.colAnio) {
        const y = this.toNumber(row[this.colAnio]);
        if (y && y !== this.anioSeleccionado) {
          continue;
        }
      }

      const sucursal = String(row[this.colSucursal] ?? '').trim() || '(Sin sucursal)';
      const unidad = String(row[this.colUnidad] ?? '').trim() || '(Sin unidad)';

      if (!bySucursal.has(sucursal)) {
        bySucursal.set(sucursal, new Map());
      }
      const byUnidad = bySucursal.get(sucursal)!;
      if (!byUnidad.has(unidad)) {
        byUnidad.set(unidad, {});
      }
      const counts = byUnidad.get(unidad)!;

      for (let i = 0; i < this.wideMonthCols.length; i++) {
        const colName = this.wideMonthCols[i];
        const monthNum = this.monthNumberFromLabel(colName) ?? i + 1;
        const month = this.buildMonthCol(this.anioSeleccionado, monthNum);
        const n = this.toNumber(row[colName]);
        if (!n) {
          continue;
        }
        counts[month.key] = (counts[month.key] ?? 0) + n;
        grupos += 1;
      }
    }

    this.totalGrupos = grupos;
    this.finalizarPivot(bySucursal, monthMap);
  }

  private finalizarPivot(
    bySucursal: Map<string, Map<string, PivotCellCounts>>,
    monthMap: Map<string, MonthCol>
  ): void {
    this.rawBySucursal = bySucursal;
    this.rawMonthMap = monthMap;
    this.sincronizarUnidades();
    this.recalcularPivot();
  }

  /** Lista de unidades funcionales con su total, conservando las excluidas. */
  private sincronizarUnidades(): void {
    const totales = new Map<string, number>();

    for (const unidades of this.rawBySucursal.values()) {
      for (const [unidad, counts] of unidades) {
        let total = 0;
        for (const v of Object.values(counts)) {
          total += v;
        }
        totales.set(unidad, (totales.get(unidad) ?? 0) + total);
      }
    }

    const excluidasPrevias = new Set(
      this.unidadesDisponibles.filter(u => !u.activa).map(u => u.nombre)
    );

    this.unidadesDisponibles = Array.from(totales.entries())
      .filter(([, total]) => total > 0)
      .map(([nombre, total]) => ({
        nombre,
        total,
        totalTexto: this.formatear(total),
        activa: !excluidasPrevias.has(nombre)
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    this.unidadesActivas = new Set(
      this.unidadesDisponibles.filter(u => u.activa).map(u => u.nombre)
    );
    this.unidadesActivasCount = this.unidadesActivas.size;
    this.aplicarFiltroUnidades();
  }

  /** Rearma la tabla: muestra todas las unidades; solo las activas suman al total. */
  private recalcularPivot(): void {
    const used = new Set<string>();
    for (const unidades of this.rawBySucursal.values()) {
      for (const counts of unidades.values()) {
        for (const [k, v] of Object.entries(counts)) {
          if (v) used.add(k);
        }
      }
    }

    this.monthCols = Array.from(this.rawMonthMap.values())
      .filter(m => used.has(m.key))
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    const expandidaPrevia = new Map(this.sucursales.map(s => [s.sucursal, s.expanded]));
    const grand = this.monthCols.map(() => 0);
    let grandTotal = 0;

    this.sucursales = Array.from(this.rawBySucursal.entries())
      .map(([sucursal, unidadesMap]) => {
        const sucValores = this.monthCols.map(() => 0);
        let sucTotal = 0;

        const unidades: UnidadPivot[] = Array.from(unidadesMap.entries())
          .map(([unidad, counts]) => {
            const valores = this.monthCols.map(m => counts[m.key] ?? 0);
            const total = valores.reduce((a, b) => a + b, 0);
            const activa = this.unidadesActivas.has(unidad);
            if (activa) {
              for (let i = 0; i < valores.length; i++) {
                const n = valores[i];
                if (!n) continue;
                sucValores[i] += n;
                grand[i] += n;
              }
              sucTotal += total;
              grandTotal += total;
            }
            return {
              unidad,
              valores,
              cells: valores.map(n => this.formatear(n)),
              total,
              totalTexto: this.formatear(total),
              activa
            };
          })
          .filter(u => u.total > 0)
          .sort((a, b) => a.unidad.localeCompare(b.unidad, 'es'));

        return {
          sucursal,
          unidades,
          cells: sucValores.map(n => this.formatear(n)),
          total: sucTotal,
          totalTexto: this.formatear(sucTotal),
          expanded: expandidaPrevia.get(sucursal) ?? true
        };
      })
      .filter(s => s.unidades.length > 0)
      .sort((a, b) => a.sucursal.localeCompare(b.sucursal, 'es'));

    this.grandCells = grand.map(n => this.formatear(n));
    this.grandTotal = grandTotal;
    this.grandTotalTexto = this.formatear(grandTotal);
  }

  private formatear(n: number): string {
    return n ? NUM_FORMAT.format(n) : '';
  }

  private resolveMonthCol(value: unknown, year: number): MonthCol | null {
    if (value == null || value === '') {
      return null;
    }

    // Número 1..12
    const asNum = Number(value);
    if (Number.isFinite(asNum) && asNum >= 1 && asNum <= 12) {
      return this.buildMonthCol(year, Math.trunc(asNum));
    }

    const raw = String(value).trim().toLowerCase();

    // "2026-07" / "2026/07"
    const ym = raw.match(/^(\d{4})[-/](\d{1,2})$/);
    if (ym) {
      return this.buildMonthCol(Number(ym[1]), Number(ym[2]));
    }

    // Fecha completa
    const iso = raw.includes('t') ? raw.split('t')[0] : raw.substring(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      const d = new Date(`${iso}T00:00:00`);
      if (!Number.isNaN(d.getTime())) {
        return this.buildMonthCol(d.getFullYear(), d.getMonth() + 1);
      }
    }

    const fromLabel = this.monthNumberFromLabel(raw);
    if (fromLabel) {
      return this.buildMonthCol(year, fromLabel);
    }

    return null;
  }

  private monthNumberFromLabel(label: string): number | null {
    const raw = label.trim().toLowerCase();
    const shortIdx = MESES_ES.indexOf(raw);
    if (shortIdx >= 0) return shortIdx + 1;
    const fullIdx = MESES_FULL.findIndex(m => raw.startsWith(m.substring(0, 3)) || raw === m);
    if (fullIdx >= 0) return fullIdx + 1;
    // mes1, m7, etc.
    const m = raw.match(/^(?:mes|m)?(\d{1,2})$/);
    if (m) {
      const n = Number(m[1]);
      if (n >= 1 && n <= 12) return n;
    }
    return null;
  }

  private buildMonthCol(year: number, month: number): MonthCol {
    return {
      key: `${year}-${String(month).padStart(2, '0')}`,
      label: MESES_ES[month - 1],
      sortKey: `${year}-${String(month).padStart(2, '0')}`
    };
  }

  private toNumber(value: unknown): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'bigint') return Number(value);
    if (value == null || value === '') return 0;
    const raw = String(value).trim();
    if (!raw) return 0;
    // Formato es-CO miles: 1.234.567 o 1.234.567,89
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw)) {
      return Number(raw.replace(/\./g, '').replace(',', '.')) || 0;
    }
    if (/^\d+,\d+$/.test(raw)) {
      return Number(raw.replace(',', '.')) || 0;
    }
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }
}
