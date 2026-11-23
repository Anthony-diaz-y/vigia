import { skipToken, useQuery } from '@tanstack/react-query'

import { placeholderFor } from '../api'
import { queryKeys } from '../constants/query-keys'
import { fetchForecast } from '../services/forecast.service'

// Pronóstico del archivo activo, compartido por el resumen y el pronóstico
export function useForecast(uploadId: number | null, indicator: string | null) {
  return useQuery({
    queryKey: queryKeys.forecast(uploadId, indicator),
    queryFn: uploadId === null ? skipToken : () => fetchForecast(uploadId, indicator),
    placeholderData: placeholderFor(uploadId),
  })
}
