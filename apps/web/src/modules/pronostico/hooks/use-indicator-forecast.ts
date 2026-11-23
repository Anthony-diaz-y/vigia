import { skipToken, useQuery } from '@tanstack/react-query'

import { placeholderFor } from '@/modules/shared/api'
import { queryKeys } from '@/modules/shared/constants'

import { fetchIndicatorForecast } from '../services/indicator-forecast.service'

// Pronóstico del indicador del archivo elegido; no consulta hasta que haya un archivo
export function useIndicatorForecast(uploadId: number | null, indicator: string | null) {
  return useQuery({
    queryKey: queryKeys.indicatorForecast(uploadId, indicator),
    queryFn: uploadId === null ? skipToken : () => fetchIndicatorForecast(uploadId, indicator),
    placeholderData: placeholderFor(uploadId),
  })
}
