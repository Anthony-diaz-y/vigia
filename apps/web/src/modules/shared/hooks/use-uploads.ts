import { skipToken, useQuery } from '@tanstack/react-query'

import { queryKeys } from '../constants/query-keys'
import { fetchUploads, fetchUploadYears } from '../services/uploads.service'

// Archivos cargados, compartidos por el layout, el resumen y la página de archivos
export function useUploads() {
  return useQuery({
    queryKey: queryKeys.uploads,
    queryFn: fetchUploads,
  })
}

// Años con datos del archivo elegido, para el filtro de año
export function useUploadYears(uploadId: number | null) {
  return useQuery({
    queryKey: queryKeys.uploadYears(uploadId),
    queryFn: uploadId === null ? skipToken : () => fetchUploadYears(uploadId),
  })
}
