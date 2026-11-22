import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '../constants/query-keys'
import { fetchHealth } from '../services/health.service'

// Estado del servicio, usado para mostrar el descargo de responsabilidad
export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: fetchHealth,
    staleTime: 5 * 60_000,
  })
}
