import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/modules/shared/constants'

import { fetchInterannual } from '../services/interannual.service'

// Comparación entre años, usada solo en el resumen
export function useInterannual(uploadId: number | null) {
  return useQuery({
    queryKey: queryKeys.analysis.interannual(uploadId),
    queryFn: () => fetchInterannual(uploadId),
    placeholderData: keepPreviousData,
  })
}
