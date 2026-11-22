import type { HeatmapResponse } from '@vigia/contracts'

// Mayor cantidad de casos de un departamento en una sola semana
export function heatmapPeak(heatmap: HeatmapResponse | null): number {
  if (!heatmap) {
    return 0
  }
  return heatmap.values.reduce((peak, row) => Math.max(peak, ...row), 0)
}
