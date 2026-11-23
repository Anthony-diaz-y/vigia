import { formatNumber } from '@/modules/shared/utils'

// Formatea un valor del indicador: con un decimal si es un promedio, entero si es un conteo o suma
export function formatValue(value: number | null, indicatorId: string): string {
  return formatNumber(value, indicatorId.startsWith('mean:') ? 1 : 0)
}
