import type { RecommendationsResponse } from '@vigia/contracts'

import { apiGet, uploadScope } from '../api'

// Nivel de alerta, acciones sugeridas y proyección a varios años
export function fetchRecommendations(
  uploadId: number | null,
  indicator: string | null,
): Promise<RecommendationsResponse> {
  return apiGet<RecommendationsResponse>('/api/recommendations', uploadScope(uploadId, indicator))
}
