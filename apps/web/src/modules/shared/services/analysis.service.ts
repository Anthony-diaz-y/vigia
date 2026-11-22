import type { AnomalyRow, WeeklySeriesRow } from '@vigia/contracts'

import { apiGet, uploadScope } from '../api'

// Serie semanal de casos por departamento y semana epidemiológica
export function fetchSeries(uploadId: number | null): Promise<WeeklySeriesRow[]> {
  return apiGet<WeeklySeriesRow[]>('/api/analysis/series', uploadScope(uploadId))
}

// Semanas con casos fuera del rango esperado
export function fetchAnomalies(uploadId: number | null): Promise<AnomalyRow[]> {
  return apiGet<AnomalyRow[]>('/api/analysis/anomalies', uploadScope(uploadId))
}
