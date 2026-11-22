import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

// Devuelve una acción que vuelve a pedir todas las consultas activas
export function useRefreshData() {
  const queryClient = useQueryClient()
  return useCallback(() => {
    void queryClient.invalidateQueries()
  }, [queryClient])
}
