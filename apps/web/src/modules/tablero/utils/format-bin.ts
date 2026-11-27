import { formatNumber } from '@/modules/shared/utils'

export interface Bin {
  from: number
  to: number
  count: number
}

// Indica si todos los intervalos caen entre 0 y 1, es decir, el valor medido es una proporción
export function isRatioScale(bins: ReadonlyArray<Bin>): boolean {
  return (
    bins.length > 0 &&
    bins.every((bin) => bin.from >= 0 && bin.to <= 1.0001) &&
    bins.some((bin) => !Number.isInteger(bin.from) || !Number.isInteger(bin.to))
  )
}

// Decimales que bastan para distinguir los cortes según el ancho total de los intervalos
function decimalsFor(span: number): number {
  if (span >= 20) {
    return 0
  }
  return span >= 2 ? 1 : 2
}

// Texto del intervalo: porcentaje si es proporción, y un solo valor si los límites coinciden
export function formatBinRange(bin: Bin, bins: ReadonlyArray<Bin>): string {
  if (isRatioScale(bins)) {
    const width = (bin.to - bin.from) * 100
    const decimals = width >= 1 ? 0 : 1
    const from = formatNumber(bin.from * 100, decimals)
    const to = formatNumber(bin.to * 100, decimals)
    return from === to ? `${to} %` : `${from}–${to} %`
  }
  const first = bins[0]?.from ?? bin.from
  const last = bins[bins.length - 1]?.to ?? bin.to
  const decimals = decimalsFor(last - first)
  const from = formatNumber(bin.from, decimals)
  const to = formatNumber(bin.to, decimals)
  return from === to ? to : `${from}–${to}`
}

// Elige hasta `max` etiquetas repartidas por igual para que el eje X no se sature
export function sparseTicks(labels: ReadonlyArray<string>, max = 6): string[] {
  const step = Math.max(1, Math.ceil(labels.length / max))
  return labels.filter((_, index) => index % step === 0)
}
