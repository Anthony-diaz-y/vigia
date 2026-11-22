import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { queryKeys } from '../constants/query-keys'
import { fetchRecommendations } from '../services/recommendations.service'

// Recomendaciones del archivo activo, compartidas por el resumen y su página
export function useRecommendations(uploadId: number | null) {
  return useQuery({
    queryKey: queryKeys.recommendations(uploadId),
    queryFn: () => fetchRecommendations(uploadId),
    placeholderData: keepPreviousData,
  })
}
