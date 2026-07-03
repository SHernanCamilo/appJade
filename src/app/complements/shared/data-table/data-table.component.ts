import {
  AfterContentInit,
  Component,
  ContentChildren,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  QueryList,
  TemplateRef,
  ViewChild
} from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrimeTemplate } from 'primeng/api';
import { Table, TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { DropdownModule } from 'primeng/dropdown';
import { ColumnFilterType, TableColumn } from './table-column.model';

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    TagModule,
    TooltipModule,
    DropdownModule
  ],
  providers: [DatePipe, CurrencyPipe, DecimalPipe],
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.css'
})
export class DataTableComponent implements AfterContentInit {
  @Input() value: any[] = [];
  @Input() columns: TableColumn[] = [];
  @Input() loading = false;
  @Input() paginator = true;
  @Input() rows = 10;
  @Input() rowsPerPageOptions: number[] = [10, 25, 50];
  @Input() dataKey?: string;
  @Input() styleClass = '';
  @Input() showCaption = true;

  @Input() selectable = false;
  @Input() selection: any[] = [];
  @Output() selectionChange = new EventEmitter<any[]>();
  @Input() selectionMode: 'single' | 'multiple' = 'multiple';

  @Input() title?: string;
  @Input() titleIcon?: string;
  @Input() showCount = true;

  @Input() showGlobalSearch = true;
  @Input() globalPlaceholder = 'Buscar...';
  @Input() globalFilterFields?: string[];

  /** 'menu' = icono de embudo con match modes; 'row' = input inline. */
  @Input() filterDisplay: 'menu' | 'row' = 'menu';

  @Input() currentPageReportTemplate = 'Mostrando {first} a {last} de {totalRecords} registros';
  @Input() tableStyle: { [key: string]: string } = { 'min-width': '50rem' };

  @Input() emptyMessage = 'No hay registros para mostrar';
  @Input() actionsHeader = 'Acciones';
  @Input() actionsWidth = '150px';

  @ViewChild('dt') dt!: Table;
  @ViewChild('globalInput') globalInput?: ElementRef<HTMLInputElement>;
  @ContentChildren(PrimeTemplate) templates!: QueryList<PrimeTemplate>;

  cellTemplates: { [field: string]: TemplateRef<any> } = {};
  actionsTemplate?: TemplateRef<any>;
  captionTemplate?: TemplateRef<any>;
  emptyTemplate?: TemplateRef<any>;

  constructor(
    private datePipe: DatePipe,
    private currencyPipe: CurrencyPipe,
    private decimalPipe: DecimalPipe
  ) {}

  ngAfterContentInit(): void {
    this.templates.forEach(tpl => {
      const type = tpl.getType();
      if (!type) {
        return;
      }

      if (type.startsWith('cell-')) {
        this.cellTemplates[type.substring(5)] = tpl.template;
      } else if (type === 'actions') {
        this.actionsTemplate = tpl.template;
      } else if (type === 'caption') {
        this.captionTemplate = tpl.template;
      } else if (type === 'empty') {
        this.emptyTemplate = tpl.template;
      }
    });
  }

  get resolvedGlobalFilterFields(): string[] {
    return this.globalFilterFields ?? this.columns.map(c => c.field);
  }

  get totalCols(): number {
    let cols = this.columns.length + (this.actionsTemplate ? 1 : 0);
    if (this.selectable) {
      cols += 1;
    }
    return cols;
  }

  filterTypeFor(col: TableColumn): ColumnFilterType {
    return col.filterType === 'select' ? 'text' : (col.filterType ?? 'text');
  }

  matchModeFor(col: TableColumn): string | undefined {
    if (col.filterMatchMode) {
      return col.filterMatchMode;
    }
    if (col.filterType === 'select') {
      return 'equals';
    }
    return undefined;
  }

  onGlobalFilter(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.dt.filterGlobal(value, 'contains');
  }

  clear(): void {
    this.dt.clear();
    if (this.globalInput) {
      this.globalInput.nativeElement.value = '';
    }
  }

  resolveFieldData(row: any, field: string): any {
    if (!row || !field) {
      return null;
    }
    if (field.indexOf('.') === -1) {
      return row[field];
    }
    return field.split('.').reduce((acc, key) => (acc == null ? null : acc[key]), row);
  }

  renderValue(row: any, col: TableColumn): any {
    const raw = this.resolveFieldData(row, col.field);
    if (raw == null) {
      return '';
    }
    switch (col.pipe) {
      case 'date':
        return this.datePipe.transform(raw, col.pipeFormat ?? 'dd/MM/yyyy');
      case 'currency':
        return this.currencyPipe.transform(raw, col.pipeFormat ?? 'USD');
      case 'number':
        return this.decimalPipe.transform(raw, col.pipeFormat);
      default:
        return raw;
    }
  }
}
