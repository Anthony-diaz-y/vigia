import type { ExplainResponse } from '@vigia/contracts'

import { apiGet, uploadScope } from '@/modules/shared/api'

// Factores que explican el pronóstico y acciones sugeridas por departamento
export function fetchExplanation(
  uploadId: number | null,
  indicator: string | null,
): Promise<ExplainResponse> {
  return apiGet<ExplainResponse>('/api/explain', uploadScope(uploadId, indicator))
}
