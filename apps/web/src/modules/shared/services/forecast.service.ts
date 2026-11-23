import type { ForecastResponse } from '@vigia/contracts'

import { apiGet, uploadScope } from '../api'

// Pronóstico de casos con su scorecard de calidad por departamento
export function fetchForecast(
  uploadId: number | null,
  indicator: string | null,
): Promise<ForecastResponse> {
  return apiGet<ForecastResponse>('/api/forecast', uploadScope(uploadId, indicator))
}
