import type { HeatmapResponse, RankingRow } from '@vigia/contracts'

import { apiGet, uploadScope } from '@/modules/shared/api'

// Mapa de calor de casos por departamento y semana para un año
export function fetchHeatmap(uploadId: number | null, year: number): Promise<HeatmapResponse> {
  return apiGet<HeatmapResponse>('/api/analysis/heatmap', {
    ...uploadScope(uploadId),
    year,
  })
}

// Ranking de departamentos con más casos en un año
export function fetchRanking(uploadId: number | null, year: number): Promise<RankingRow[]> {
  return apiGet<RankingRow[]>('/api/analysis/ranking', {
    ...uploadScope(uploadId),
    year,
  })
}
