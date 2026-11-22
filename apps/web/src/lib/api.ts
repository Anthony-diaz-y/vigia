import type {
  AnomalyRow,
  ClearUploadsResponse,
  ExplainResponse,
  ForecastResponse,
  HealthDto,
  HeatmapResponse,
  InterannualRow,
  QualityReportDto,
  RankingRow,
  RecommendationsResponse,
  UploadDto,
  UploadPreview,
  WeeklySeriesRow,
} from '@vigia/contracts'

const TOKEN_KEY = 'vigia-token'

// Obtiene el token de acceso guardado o el de desarrollo por defecto
export function getToken(): string {
  if (typeof window === 'undefined') {
    return 'vigia-dev'
  }
  return window.localStorage.getItem(TOKEN_KEY) || 'vigia-dev'
}

// Guarda el token de acceso en el almacenamiento local
export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token)
}

// Hace una petición a la API con el token y devuelve el JSON o lanza error
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      'X-Access-Token': getToken(),
      ...(options.headers ?? {}),
    },
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`${response.status}: ${detail}`)
  }
  return (await response.json()) as T
}

// Construye la query string omitiendo parámetros vacíos
function query(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value))
    }
  }
  const encoded = search.toString()
  return encoded ? `?${encoded}` : ''
}

export const endpoints = {
  health: () => request<HealthDto>('/api/health'),
  uploads: () => request<UploadDto[]>('/api/uploads'),
  clear: () => request<ClearUploadsResponse>('/api/uploads', { method: 'DELETE' }),
  quality: (uploadId: number) => request<QualityReportDto>(`/api/uploads/${uploadId}/quality`),
  preview: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<UploadPreview>('/api/upload/preview', { method: 'POST', body: form })
  },
  upload: (file: File, mapping?: Record<string, string>) => {
    const form = new FormData()
    form.append('file', file)
    if (mapping) {
      form.append('mapping', JSON.stringify(mapping))
    }
    return request<UploadDto>('/api/upload', { method: 'POST', body: form })
  },
  series: (uploadId?: number | null) =>
    request<WeeklySeriesRow[]>(`/api/analysis/series${query({ upload_id: uploadId })}`),
  interannual: (uploadId?: number | null) =>
    request<InterannualRow[]>(`/api/analysis/interannual${query({ upload_id: uploadId })}`),
  heatmap: (year: number, uploadId?: number | null) =>
    request<HeatmapResponse>(`/api/analysis/heatmap${query({ year, upload_id: uploadId })}`),
  ranking: (year: number, uploadId?: number | null) =>
    request<RankingRow[]>(`/api/analysis/ranking${query({ year, upload_id: uploadId })}`),
  anomalies: (uploadId?: number | null) =>
    request<AnomalyRow[]>(`/api/analysis/anomalies${query({ upload_id: uploadId })}`),
  forecast: (uploadId?: number | null) =>
    request<ForecastResponse>(`/api/forecast${query({ upload_id: uploadId })}`),
  explain: (uploadId?: number | null) =>
    request<ExplainResponse>(`/api/explain${query({ upload_id: uploadId })}`),
  recommendations: (uploadId?: number | null) =>
    request<RecommendationsResponse>(`/api/recommendations${query({ upload_id: uploadId })}`),
}
