export type ColumnType = 'text' | 'number' | 'date' | 'boolean';

const TYPE_MAP: Record<string, ColumnType> = {
  varchar: 'text',
  nvarchar: 'text',
  char: 'text',
  nchar: 'text',
  text: 'text',
  ntext: 'text',
  uniqueidentifier: 'text',
  int: 'number',
  bigint: 'number',
  smallint: 'number',
  tinyint: 'number',
  decimal: 'number',
  numeric: 'number',
  float: 'number',
  real: 'number',
  money: 'number',
  smallmoney: 'number',
  datetime: 'date',
  datetime2: 'date',
  date: 'date',
  time: 'text',
  datetimeoffset: 'date',
  smalldatetime: 'date',
  bit: 'boolean'
};

export function getColumnType(sqlType: string): ColumnType {
  return TYPE_MAP[sqlType.toLowerCase()] ?? 'text';
}

export function humanizeColumnName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, s => s.toUpperCase());
}
