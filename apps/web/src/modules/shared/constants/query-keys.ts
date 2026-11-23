// Identifica en la caché el archivo elegido o el conjunto de todos los archivos
function scope(uploadId: number | null): number | 'all' {
  return uploadId ?? 'all'
}

// Claves de consulta de TanStack Query, centralizadas para evitar colisiones
export const queryKeys = {
  health: ['health'] as const,
  uploads: ['uploads'] as const,
  uploadYears: (uploadId: number | null) => ['uploads', 'years', scope(uploadId)] as const,
  dashboard: (uploadId: number | null, indicator: string | null, year: number | null) =>
    ['dashboard', scope(uploadId), indicator ?? 'default', year ?? 'latest'] as const,
  analysis: {
    series: (uploadId: number | null, indicator: string | null) =>
      ['analysis', 'series', scope(uploadId), indicator] as const,
    heatmap: (uploadId: number | null, year: number | null, indicator: string | null) =>
      ['analysis', 'heatmap', scope(uploadId), year, indicator] as const,
    ranking: (uploadId: number | null, year: number | null, indicator: string | null) =>
      ['analysis', 'ranking', scope(uploadId), year, indicator] as const,
    anomalies: (uploadId: number | null, indicator: string | null) =>
      ['analysis', 'anomalies', scope(uploadId), indicator] as const,
  },
  forecast: (uploadId: number | null, indicator: string | null) =>
    ['forecast', scope(uploadId), indicator] as const,
  indicatorForecast: (uploadId: number | null, indicator: string | null) =>
    ['forecast', 'indicator', scope(uploadId), indicator ?? 'default'] as const,
  recommendations: (uploadId: number | null, indicator: string | null) =>
    ['recommendations', scope(uploadId), indicator] as const,
  explanation: (uploadId: number | null, indicator: string | null) =>
    ['explanation', scope(uploadId), indicator] as const,
}
