import {
  MAX_EPI_WEEK,
  MAX_YEAR,
  MIN_EPI_WEEK,
  MIN_YEAR,
  parseDate,
  parseNumber,
  type ColumnRole,
  type DatasetColumn,
} from '@vigia/epidemiology'

export type TypedValue = string | number | null

const NUMERIC_ROLES: ReadonlySet<ColumnRole> = new Set(['measure', 'count'])
const SKIPPED_ROLES: ReadonlySet<ColumnRole> = new Set(['identifier', 'ignore'])
const TIME_RANGES: Partial<Record<ColumnRole, readonly [number, number]>> = {
  year: [MIN_YEAR, MAX_YEAR],
  week: [MIN_EPI_WEEK, MAX_EPI_WEEK],
  month: [1, 12],
}

// Convierte las filas crudas a valores tipados según el rol, sin identificadores ni columnas sin uso
export function typedRows(
  raw: readonly Record<string, string>[],
  columns: readonly DatasetColumn[],
): Record<string, TypedValue>[] {
  const kept = columns.filter((column) => !SKIPPED_ROLES.has(column.role))
  return raw.map((row) =>
    Object.fromEntries(kept.map((column) => [column.name, typedValue(row[column.name], column)])),
  )
}

// Interpreta un valor: fecha ISO, número o texto recortado; null si está vacío, es ilegible o fuera de rango
function typedValue(text: string | undefined, column: DatasetColumn): TypedValue {
  const value = (text ?? '').trim()
  if (value === '') {
    return null
  }
  if (column.role === 'date') {
    const date = parseDate(value)
    const year = date?.getUTCFullYear() ?? 0
    return date && year >= MIN_YEAR && year <= MAX_YEAR ? date.toISOString().slice(0, 10) : null
  }
  const range = TIME_RANGES[column.role]
  if (range) {
    const number = parseNumber(value)
    return number !== null && Number.isInteger(number) && number >= range[0] && number <= range[1]
      ? number
      : null
  }
  if (NUMERIC_ROLES.has(column.role)) {
    return parseNumber(value)
  }
  return value
}
