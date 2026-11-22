import type { ForecastResponse } from '@vigia/contracts'

import type { ForecastPoint } from '@/modules/shared/components/charts'

type ForecastRow = ForecastResponse['forecasts'][number]
type ScorecardRow = ForecastResponse['scorecard'][number]

// Filas del pronóstico de un departamento ordenadas por horizonte
export function departmentForecast(
  forecasts: ReadonlyArray<ForecastRow>,
  department: string,
): ForecastRow[] {
  return forecasts
    .filter((row) => row.department === department)
    .sort((left, right) => left.horizon - right.horizon)
}

// Adapta las filas del pronóstico al gráfico de banda entre p10 y p90
export function toForecastPoints(rows: ReadonlyArray<ForecastRow>): ForecastPoint[] {
  return rows.map((row) => ({
    horizon: row.horizon,
    p10: row.p10,
    p50: row.p50,
    p90: row.p90,
    low: row.p10,
    band: row.p90 - row.p10,
    target: row.target_epi_week,
  }))
}

// Promedio del MASE de los departamentos indicados, o null si ninguno tiene valor
export function averageMase(rows: ReadonlyArray<ScorecardRow>): number | null {
  const values = rows.map((row) => Number(row.mase)).filter((value) => Number.isFinite(value))
  if (values.length === 0) {
    return null
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}
