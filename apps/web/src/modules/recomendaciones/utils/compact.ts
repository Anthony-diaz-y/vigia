import { formatNumber } from '@/modules/shared/utils'

// Abrevia números grandes en miles, igual en servidor y navegador
export function compactNumber(value: number): string {
  if (value < 1000) {
    return formatNumber(value)
  }
  return `${formatNumber(value / 1000, value >= 10_000 ? 0 : 1)} mil`
}
