import type { AnomalyRow, WeeklySeriesRow } from '@vigia/contracts'

// Casos acumulados del año elegido en toda la serie
export function totalCasesForYear(
  series: ReadonlyArray<WeeklySeriesRow>,
  year: number | null,
): number {
  if (year === null) {
    return 0
  }
  return series.filter((row) => row.year === year).reduce((sum, row) => sum + (row.cases ?? 0), 0)
}

// Semanas marcadas como anómalas
export function flaggedAnomalies(anomalies: ReadonlyArray<AnomalyRow>): AnomalyRow[] {
  return anomalies.filter((row) => row.is_anomaly)
}

// Cantidad de semanas epidemiológicas distintas con alguna señal
export function countSignalWeeks(anomalies: ReadonlyArray<AnomalyRow>): number {
  return new Set(anomalies.map((row) => `${row.year}-${row.epi_week}`)).size
}
