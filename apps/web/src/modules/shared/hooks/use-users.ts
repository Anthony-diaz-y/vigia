import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '../constants/query-keys'
import { createUser, deleteUser, fetchUsers } from '../services/auth.service'

// Usuarios de Vigia, solo para administradores
export function useUsers(enabled: boolean) {
  return useQuery({ queryKey: queryKeys.users, queryFn: fetchUsers, enabled })
}

// Crea un usuario y refresca la lista
export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users }),
  })
}

// Elimina un usuario y refresca la lista
export function useDeleteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users }),
  })
}
