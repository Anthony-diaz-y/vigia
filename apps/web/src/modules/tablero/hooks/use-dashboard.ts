import { skipToken, useQuery } from '@tanstack/react-query'

import { placeholderFor } from '@/modules/shared/api'
import { queryKeys } from '@/modules/shared/constants'

import { fetchDashboard } from '../services/dashboard.service'

// Tablero del archivo elegido; espera a tener archivo y años para no pedirlo dos veces
export function useDashboard(
  uploadId: number | null,
  indicator: string | null,
  year: number | null,
  ready: boolean,
) {
  return useQuery({
    queryKey: queryKeys.dashboard(uploadId, indicator, year),
    queryFn:
      uploadId === null || !ready ? skipToken : () => fetchDashboard(uploadId, indicator, year),
    placeholderData: placeholderFor(uploadId),
  })
}
