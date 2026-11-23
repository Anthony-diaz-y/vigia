import axios from 'axios'
import type { AxiosError } from 'axios'

import { getAccessToken } from './token'

// Parámetros de consulta aceptados por la API
export type QueryParams = Record<string, string | number | undefined>

// Error de la API con el código HTTP y el detalle devuelto por el servidor
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, detail: string) {
    super(detail ? `${status}: ${detail}` : String(status))
    this.name = 'ApiError'
    this.status = status
  }
}

const client = axios.create()

// Adjunta el token de acceso a cada petición
client.interceptors.request.use((config) => {
  config.headers.set('X-Access-Token', getAccessToken())
  return config
})

// Convierte las respuestas de error en ApiError con el detalle del backend
client.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status
    if (!status) {
      return Promise.reject(error)
    }
    return Promise.reject(new ApiError(status, detailFrom(error.response?.data) ?? error.message))
  },
)

// Extrae el mensaje de error del cuerpo devuelto por la API
function detailFrom(data: unknown): string | null {
  if (typeof data === 'string') {
    return data
  }
  if (data && typeof data === 'object' && 'detail' in data) {
    const detail = (data as { detail: unknown }).detail
    if (typeof detail === 'string') {
      return detail
    }
    if (detail) {
      return JSON.stringify(detail)
    }
  }
  return null
}

// Parámetros para filtrar por archivo (o todos si no hay uno) y por el indicador elegido
export function uploadScope(uploadId: number | null, indicator: string | null = null): QueryParams {
  return { upload_id: uploadId ?? undefined, indicator: indicator ?? undefined }
}

// Petición GET tipada
export async function apiGet<T>(url: string, params?: QueryParams): Promise<T> {
  const { data } = await client.get<T>(url, { params })
  return data
}

// Petición POST tipada, usada para enviar formularios
export async function apiPost<T>(url: string, body: FormData): Promise<T> {
  const { data } = await client.post<T>(url, body)
  return data
}

// Petición DELETE tipada
export async function apiDelete<T>(url: string): Promise<T> {
  const { data } = await client.delete<T>(url)
  return data
}
