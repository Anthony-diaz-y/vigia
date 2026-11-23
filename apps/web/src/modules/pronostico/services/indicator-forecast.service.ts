import type { IndicatorForecastResponse } from '@vigia/contracts'

import { apiGet } from '@/modules/shared/api'

// Pronóstico del indicador elegido de un archivo
export function fetchIndicatorForecast(
  uploadId: number,
  indicator: string | null,
): Promise<IndicatorForecastResponse> {
  return apiGet<IndicatorForecastResponse>('/api/forecast/indicator', {
    upload_id: uploadId,
    indicator: indicator ?? undefined,
  })
}
