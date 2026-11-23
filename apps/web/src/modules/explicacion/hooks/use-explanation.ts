import { skipToken, useQuery } from '@tanstack/react-query'

import { placeholderFor } from '@/modules/shared/api'
import { queryKeys } from '@/modules/shared/constants'

import { fetchExplanation } from '../services/explanation.service'

// Explicación del archivo activo, usada solo en su página
export function useExplanation(uploadId: number | null, indicator: string | null) {
  return useQuery({
    queryKey: queryKeys.explanation(uploadId, indicator),
    queryFn: uploadId === null ? skipToken : () => fetchExplanation(uploadId, indicator),
    placeholderData: placeholderFor(uploadId),
  })
}
