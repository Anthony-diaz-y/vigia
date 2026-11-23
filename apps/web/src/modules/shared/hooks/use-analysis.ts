import { skipToken, useQuery } from '@tanstack/react-query'

import { placeholderFor } from '../api'
import { queryKeys } from '../constants/query-keys'
import { fetchAnomalies, fetchSeries } from '../services/analysis.service'

// Serie semanal de casos de la capa epidemiológica, usada en el análisis
export function useSeries(uploadId: number | null, indicator: string | null) {
  return useQuery({
    queryKey: queryKeys.analysis.series(uploadId, indicator),
    queryFn: uploadId === null ? skipToken : () => fetchSeries(uploadId, indicator),
    placeholderData: placeholderFor(uploadId),
  })
}

// Semanas fuera de lo esperado, compartidas por el resumen y el análisis
export function useAnomalies(uploadId: number | null, indicator: string | null) {
  return useQuery({
    queryKey: queryKeys.analysis.anomalies(uploadId, indicator),
    queryFn: uploadId === null ? skipToken : () => fetchAnomalies(uploadId, indicator),
    placeholderData: placeholderFor(uploadId),
  })
}
