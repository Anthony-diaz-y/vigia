import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  clearUploads,
  createUpload,
  previewUpload,
  type UploadReview,
} from '../services/uploads.service'

interface UploadInput {
  file: File
  review: UploadReview
}

// Vista previa del archivo antes de confirmar el mapeo de columnas
export function useUploadPreview() {
  return useMutation({
    mutationFn: previewUpload,
  })
}

// Ingesta el archivo y espera a que se refresquen los datos antes de terminar
export function useUploadFile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ file, review }: UploadInput) => createUpload(file, review),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

// Borra todos los datos y descarta la caché de los archivos que ya no existen
export function useClearUploads() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: clearUploads,
    onSuccess: () => queryClient.resetQueries(),
  })
}
