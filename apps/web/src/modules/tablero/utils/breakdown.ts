import { MISSING_VALUE } from '@vigia/contracts'

import { formatNumber } from '@/modules/shared/utils'

export interface BreakdownRow {
  name: string
  value: number
  label?: string
}

// Indica si la fila es el grupo "Sin dato"
export function isMissingRow(row: BreakdownRow): boolean {
  return row.name === MISSING_VALUE
}

// Texto visible de una fila: su significado si lo tiene y, si no, el valor normalizado
export function rowText(row: BreakdownRow): string {
  return row.label ?? row.name
}

// Código original de la fila cuando se muestra su significado; null si no hay nada que aclarar
export function rowCode(row: BreakdownRow): string | null {
  return row.label && row.label !== row.name && !isMissingRow(row) ? row.name : null
}

// Porcentaje con un decimal en formato local ("16.4 %"); vacío si no hay total
export function formatShare(value: number, total: number): string {
  return total > 0 ? `${formatNumber((value / total) * 100, 1)} %` : ''
}

// Suma de los valores de las filas
export function sumRows(rows: ReadonlyArray<BreakdownRow>): number {
  return rows.reduce((sum, row) => sum + row.value, 0)
}
