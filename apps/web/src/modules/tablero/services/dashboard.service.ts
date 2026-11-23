import type { DashboardResponse } from '@vigia/contracts'

import { apiGet } from '@/modules/shared/api'

// Tablero de un archivo con el indicador y el año elegidos
export function fetchDashboard(
  uploadId: number,
  indicator: string | null,
  year: number | null,
): Promise<DashboardResponse> {
  return apiGet<DashboardResponse>('/api/dashboard', {
    upload_id: uploadId,
    indicator: indicator ?? undefined,
    year: year ?? undefined,
  })
}
