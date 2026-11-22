import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/modules/shared/constants'

import { fetchExplanation } from '../services/explanation.service'

// Explicación del archivo activo, usada solo en su página
export function useExplanation(uploadId: number | null) {
  return useQuery({
    queryKey: queryKeys.explanation(uploadId),
    queryFn: () => fetchExplanation(uploadId),
    placeholderData: keepPreviousData,
  })
}
