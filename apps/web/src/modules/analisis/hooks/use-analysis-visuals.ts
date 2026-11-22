import { keepPreviousData, skipToken, useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/modules/shared/constants'

import { fetchHeatmap, fetchRanking } from '../services/analysis-visuals.service'

// Mapa de calor del año elegido; no consulta hasta que haya un año con datos
export function useHeatmap(uploadId: number | null, year: number | null) {
  return useQuery({
    queryKey: queryKeys.analysis.heatmap(uploadId, year),
    queryFn: year === null ? skipToken : () => fetchHeatmap(uploadId, year),
    placeholderData: keepPreviousData,
  })
}

// Ranking de departamentos del año elegido; no consulta hasta que haya un año con datos
export function useRanking(uploadId: number | null, year: number | null) {
  return useQuery({
    queryKey: queryKeys.analysis.ranking(uploadId, year),
    queryFn: year === null ? skipToken : () => fetchRanking(uploadId, year),
    placeholderData: keepPreviousData,
  })
}
