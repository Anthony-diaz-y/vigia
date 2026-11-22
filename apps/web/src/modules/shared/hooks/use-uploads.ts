import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '../constants/query-keys'
import { fetchUploads } from '../services/uploads.service'

// Archivos cargados, compartidos por el layout, el resumen y la página de archivos
export function useUploads() {
  return useQuery({
    queryKey: queryKeys.uploads,
    queryFn: fetchUploads,
  })
}
