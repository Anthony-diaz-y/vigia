// Identifica en la caché el archivo elegido o el conjunto de todos los archivos
function scope(uploadId: number | null): number | 'all' {
  return uploadId ?? 'all'
}

// Claves de consulta de TanStack Query, centralizadas para evitar colisiones
export const queryKeys = {
  health: ['health'] as const,
  uploads: ['uploads'] as const,
  analysis: {
    series: (uploadId: number | null) => ['analysis', 'series', scope(uploadId)] as const,
    interannual: (uploadId: number | null) => ['analysis', 'interannual', scope(uploadId)] as const,
    heatmap: (uploadId: number | null, year: number | null) =>
      ['analysis', 'heatmap', scope(uploadId), year] as const,
    ranking: (uploadId: number | null, year: number | null) =>
      ['analysis', 'ranking', scope(uploadId), year] as const,
    anomalies: (uploadId: number | null) => ['analysis', 'anomalies', scope(uploadId)] as const,
  },
  forecast: (uploadId: number | null) => ['forecast', scope(uploadId)] as const,
  recommendations: (uploadId: number | null) => ['recommendations', scope(uploadId)] as const,
  explanation: (uploadId: number | null) => ['explanation', scope(uploadId)] as const,
}
