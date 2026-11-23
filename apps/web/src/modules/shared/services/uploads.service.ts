import type {
  ClearUploadsResponse,
  DatasetColumnDto,
  UploadDto,
  UploadPreview,
} from '@vigia/contracts'

import { apiDelete, apiGet, apiPost } from '../api'

export interface UploadReview {
  columns: DatasetColumnDto[]
  title: string
  topic: string
}

// Lista los archivos cargados en el servicio
export function fetchUploads(): Promise<UploadDto[]> {
  return apiGet<UploadDto[]>('/api/uploads')
}

// Años con datos de una carga, del más reciente al más antiguo
export function fetchUploadYears(uploadId: number): Promise<number[]> {
  return apiGet<number[]>(`/api/uploads/${uploadId}/years`)
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

// Ingesta un archivo con las columnas, el título y el tema confirmados en la revisión
export function createUpload(file: File, review: UploadReview): Promise<UploadDto> {
  const form = new FormData()
  form.append('file', file)
  form.append('columns', JSON.stringify(review.columns))
  form.append('title', review.title)
  form.append('topic', review.topic)
  return apiPost<UploadDto>('/api/upload', form)
}
