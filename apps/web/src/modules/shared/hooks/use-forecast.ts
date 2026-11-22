import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { queryKeys } from '../constants/query-keys'
import { fetchForecast } from '../services/forecast.service'

// Pronóstico del archivo activo, compartido por el resumen y el pronóstico
export function useForecast(uploadId: number | null) {
  return useQuery({
    queryKey: queryKeys.forecast(uploadId),
    queryFn: () => fetchForecast(uploadId),
    placeholderData: keepPreviousData,
  })
}
