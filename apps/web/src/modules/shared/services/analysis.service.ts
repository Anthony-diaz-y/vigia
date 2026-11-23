import type { AnomalyRow, WeeklySeriesRow } from '@vigia/contracts'

import { apiGet, uploadScope } from '../api'

// Serie semanal de casos por departamento y semana epidemiológica
export function fetchSeries(
  uploadId: number | null,
  indicator: string | null,
): Promise<WeeklySeriesRow[]> {
  return apiGet<WeeklySeriesRow[]>('/api/analysis/series', uploadScope(uploadId, indicator))
}

// Semanas con casos fuera del rango esperado
export function fetchAnomalies(
  uploadId: number | null,
  indicator: string | null,
): Promise<AnomalyRow[]> {
  return apiGet<AnomalyRow[]>('/api/analysis/anomalies', uploadScope(uploadId, indicator))
}
