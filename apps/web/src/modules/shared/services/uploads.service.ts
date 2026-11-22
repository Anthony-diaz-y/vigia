import type { ClearUploadsResponse, UploadDto, UploadPreview } from '@vigia/contracts'

import { apiDelete, apiGet, apiPost } from '../api'

// Lista los archivos cargados en el servicio
export function fetchUploads(): Promise<UploadDto[]> {
  return apiGet<UploadDto[]>('/api/uploads')
}

// Borra todos los datos ingeridos
export function clearUploads(): Promise<ClearUploadsResponse> {
  return apiDelete<ClearUploadsResponse>('/api/uploads')
}

// Pide la vista previa de un archivo para revisar su mapeo de columnas
export function previewUpload(file: File): Promise<UploadPreview> {
  const form = new FormData()
  form.append('file', file)
  return apiPost<UploadPreview>('/api/upload/preview', form)
}

// Ingesta un archivo con el mapeo de columnas confirmado
export function createUpload(file: File, mapping?: Record<string, string>): Promise<UploadDto> {
  const form = new FormData()
  form.append('file', file)
  if (mapping) {
    form.append('mapping', JSON.stringify(mapping))
  }
  return apiPost<UploadDto>('/api/upload', form)
}
