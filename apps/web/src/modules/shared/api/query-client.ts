import { QueryClient } from '@tanstack/react-query'

import { ApiError } from './client'

const MAX_RETRIES = 1

// Reintenta solo fallas de red o del servidor; un error 4xx no cambia al repetir
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status < 500) {
    return false
  }
  return failureCount < MAX_RETRIES
}

// Crea el cliente de consultas con la política de caché y reintentos de la app
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: shouldRetry,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  })
}
