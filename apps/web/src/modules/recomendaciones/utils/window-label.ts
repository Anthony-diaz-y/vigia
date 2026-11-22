import type { RecommendationsResponse } from '@vigia/contracts'

// Texto con el rango de semanas analizado o null si no hay ventana
export function windowLabel(data: RecommendationsResponse): string | null {
  if (!data.window) {
    return null
  }
  const { from, to } = data.window
  return from.year === to.year
    ? `semanas ${from.epi_week} a ${to.epi_week} de ${to.year}`
    : `semana ${from.epi_week} de ${from.year} a ${to.epi_week} de ${to.year}`
}
