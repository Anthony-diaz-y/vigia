import { skipToken, useQuery } from '@tanstack/react-query'

import { placeholderFor } from '../api'
import { queryKeys } from '../constants/query-keys'
import { fetchRecommendations } from '../services/recommendations.service'

// Recomendaciones del archivo activo, compartidas por el resumen y su página
export function useRecommendations(uploadId: number | null, indicator: string | null) {
  return useQuery({
    queryKey: queryKeys.recommendations(uploadId, indicator),
    queryFn: uploadId === null ? skipToken : () => fetchRecommendations(uploadId, indicator),
    placeholderData: placeholderFor(uploadId),
  })
}
