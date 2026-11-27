import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useSyncExternalStore } from 'react'

import { clearSession, getSession, saveSession, subscribeSession } from '../api'
import { login } from '../services/auth.service'

// Sesión del navegador; en el servidor no hay sesión y ready queda en false
export function useSession() {
  const session = useSyncExternalStore(subscribeSession, getSession, () => null)
  const ready = useSyncExternalStore(
    subscribeSession,
    () => true,
    () => false,
  )
  return { session, user: session?.user ?? null, ready }
}

// Inicia sesión y descarta la caché de cualquier sesión anterior
export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: login,
    onSuccess: (session) => {
      queryClient.clear()
      saveSession(session)
    },
  })
}

// Cierra la sesión y olvida todos los datos en caché
export function useLogout() {
  const queryClient = useQueryClient()
  return useCallback(() => {
    clearSession(true)
    queryClient.clear()
  }, [queryClient])
}
