import type { InterannualRow } from '@vigia/contracts'

import { apiGet, uploadScope } from '@/modules/shared/api'

// Comparación de casos semanales entre años
export function fetchInterannual(uploadId: number | null): Promise<InterannualRow[]> {
  return apiGet<InterannualRow[]>('/api/analysis/interannual', uploadScope(uploadId))
}
