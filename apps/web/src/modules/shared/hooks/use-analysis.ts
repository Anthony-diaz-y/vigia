import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { queryKeys } from '../constants/query-keys'
import { fetchAnomalies, fetchSeries } from '../services/analysis.service'

// Serie semanal de casos; el layout la pide solo cuando ya hay archivos cargados
export function useSeries(uploadId: number | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.analysis.series(uploadId),
    queryFn: () => fetchSeries(uploadId),
    enabled,
    placeholderData: keepPreviousData,
  })
}

// Semanas fuera de lo esperado, compartidas por el resumen y el análisis
export function useAnomalies(uploadId: number | null) {
  return useQuery({
    queryKey: queryKeys.analysis.anomalies(uploadId),
    queryFn: () => fetchAnomalies(uploadId),
    placeholderData: keepPreviousData,
  })
}
