import type { WeeklySeriesRow } from '@vigia/contracts'

import type { WeeklyPoint } from '@/modules/shared/components/charts'

// Suma los casos de todos los departamentos por año y semana epidemiológica
export function toWeeklyPoints(series: ReadonlyArray<WeeklySeriesRow>): WeeklyPoint[] {
  const totals = new Map<string, number>()
  for (const row of series) {
    const key = `${row.year}-S${String(row.epi_week).padStart(2, '0')}`
    totals.set(key, (totals.get(key) ?? 0) + (row.cases ?? 0))
  }
  return [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, total]) => ({ label, total }))
}
